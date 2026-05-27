/**
 * Mickii Agent Cortex — OpenRouter Edition
 * ReAct reasoning loop using meta-llama/llama-3.1-8b-instruct:free via OpenRouter API.
 */

import { AgentRuntime, SystemTools } from './runtime.js';
import { invoke } from '@tauri-apps/api/core';
import { getSetting, getAllSettings, addProjectMemory, getProjectMemory } from '../data/db.js';
import { appDataDir } from '@tauri-apps/api/path';

const MAX_ITERATIONS = 12;

/* -------------------------------------------------------------------------- */
/* LLM Provider (OpenRouter — OpenAI Compatible)                               */
/* -------------------------------------------------------------------------- */

export class LLMProvider {
  constructor(cfg = {}) {
    this.primaryProvider = cfg.primaryProvider || 'gemini'; // gemini, groq, openrouter
    this.temperature = cfg.temperature ?? 0.1;
  }

  async chat(systemPrompt, messages, tools = []) {
    // Strict Context Window Manager
    let truncatedMessages = [...messages];
    if (truncatedMessages.length > 6) {
      truncatedMessages = truncatedMessages.slice(-6);
      while (truncatedMessages.length > 0 && truncatedMessages[0].role === 'tool') {
        truncatedMessages.shift();
      }
    }

    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...truncatedMessages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: m.tool_call_id || 'unknown',
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
          };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls };
        }
        return {
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        };
      })
    ];

    const apiKey = await getSetting('openrouter_api_key');
    if (apiKey === null || apiKey === 'null' || !apiKey || apiKey.startsWith('PASTE_YOUR')) {
      throw new Error('API Key not set. Please go to Settings.');
    }

    const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : String(apiKey).trim();

    // Try providers in order: Gemini -> Groq -> OpenRouter
    const providers = [
      {
        name: 'Gemini',
        url: async () => {
          const geminiKey = await getSetting('gemini_api_key');
          return { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', key: geminiKey };
        },
        buildPayload: (msgs) => ({
          contents: msgs.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content || '' }]
          }))
        }),
        parseResponse: (data) => {
          if (!data.candidates || !data.candidates[0]) throw new Error('Empty Gemini response');
          const content = data.candidates[0].content?.parts?.[0]?.text;
          if (!content) throw new Error('No text in Gemini response');
          return { role: 'assistant', content };
        }
      },
      {
        name: 'Groq',
        url: async () => {
          const groqKey = await getSetting('groq_api_key');
          return { url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey };
        },
        buildPayload: (msgs) => ({
          model: 'llama-3.3-70b-versatile',
          messages: msgs,
          temperature: this.temperature,
          max_tokens: 4096
        }),
        parseResponse: (data) => {
          if (!data.choices || !data.choices[0]) throw new Error('Empty Groq response');
          return { role: 'assistant', content: data.choices[0].message?.content || 'No content' };
        }
      },
      {
        name: 'OpenRouter',
        url: async () => ({ url: 'https://openrouter.ai/api/v1/chat/completions', key: cleanKey }),
        buildPayload: (msgs) => ({
          model: 'openrouter/auto',
          messages: msgs,
          temperature: this.temperature,
          max_tokens: 4096
        }),
        parseResponse: (data) => {
          if (!data.choices || !data.choices[0]) throw new Error('Empty OpenRouter response');
          return { role: 'assistant', content: data.choices[0].message?.content || 'No content' };
        }
      }
    ];

    let lastError = null;

    for (const provider of providers) {
      try {
        const { url, key } = await provider.url();
        if (!key || key.startsWith('PASTE_YOUR') || key.length < 10) {
          console.warn(`[Cortex] Skipping ${provider.name} — no valid key`);
          continue;
        }

        console.log(`[Cortex] Trying ${provider.name}...`);
        const payload = provider.buildPayload(openaiMessages);

        let data;
        if (provider.name === 'Gemini') {
          data = await invoke('gemini_proxy', { payload, apiKey: key, baseUrl: url });
        } else {
          data = await invoke('llm_proxy', { payload, apiKey: key, baseUrl: url, extraHeaders: provider.name === 'OpenRouter' ? { 'HTTP-Referer': 'http://localhost', 'X-Title': 'Mabishion-Mickii' } : {} });
        }

        if (data && data.error) {
          const errStr = JSON.stringify(data.error).toLowerCase();
          if (errStr.includes('429') || errStr.includes('rate limit')) {
            console.warn(`[Cortex] ${provider.name} rate limited, trying next...`);
            lastError = new Error(`${provider.name} rate limited`);
            continue;
          }
          throw new Error(`${provider.name} API Error: ${JSON.stringify(data.error)}`);
        }

        const result = provider.parseResponse(data);
        console.log(`[Cortex] ${provider.name} success!`);
        return result;

      } catch (err) {
        console.warn(`[Cortex] ${provider.name} failed:`, err.message || err);
        lastError = err;
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message || lastError}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Cortex Engine                                                               */
/* -------------------------------------------------------------------------- */

export class Cortex {
  constructor(config = {}) {
    this.llm = new LLMProvider(config);
    this.runtime = new AgentRuntime(SystemTools);
    this.maxIterations = config.maxIterations || MAX_ITERATIONS;
    this.history = [];
    this.projectId = config.projectId || null;
    this.systemPrompt = [
      'You are Mickii, Mabishion AI Business Agent.',
      'CRITICAL RULES (SEARCH-FIRST, DATE-AWARE):',
      '1. ALWAYS use mickii_web_search (and optionally mickii_deep_research) before any factual, market, or model-related answer.',
      '2. NEVER rely only on your training memory for facts, dates, or model lists. If something is not clearly present in the latest search results, you must say you are not sure.',
      '3. Every factual answer MUST clearly cite at least 2–3 specific search findings, including YEAR or DATE when visible in the result snippet.',
      '4. When search results are older than the current year or look outdated (e.g., pre-2025 pages for a 2026 query), clearly warn: ", but ye info old search results par based hai".',
      '5. If the user explicitly asks about a time window (for example: "in May 2026" or "latest 2026"), focus on results with dates closest to that window. If no such results appear, clearly say: "Boss, exact May 2026 ka data search mein nahi mila, sirf purani info mili".',
      '6. Your final answer MUST start with: "Based on search results:" and immediately quote 2–3 concrete findings (with dates/years when available).',
      '7. If search or deep research fails or returns nothing useful, respond: "Boss, search mein ye info nahi mili" and DO NOT guess or manufacture lists from memory.',
      '8. Speak in professional Hinglish ("Boss, kaam ho gaya" style), but keep facts strictly tied to the search data.'
    ].join('\n');
  }

  async think(userText, hooks = {}) {
    if (this.projectId && !this.memoryLoaded) {
      this.memoryLoaded = true;
      try {
        const mems = await getProjectMemory(this.projectId, 5);
        if (mems && mems.length > 0) {
          const memStr = mems.map(m => `- ${m.observation}`).join('\n');
          this.systemPrompt += `\n\n### PROJECT MEMORY (Last 5 Observations):\n${memStr}`;
        }
      } catch (err) { console.error('[Cortex] Failed to load project memory', err); }
    }

    this.history.push({ role: 'user', content: userText });

    const toolDefinitions = this.runtime.schemas().map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }));

    for (let i = 0; i < this.maxIterations; i++) {
      await new Promise(r => setTimeout(r, 2000));

      let messages = [...this.history];
      if (messages.length > 4) {
        let startIndex = messages.length - 4;
        while (startIndex > 0 && messages[startIndex].role === 'tool') startIndex--;
        messages = messages.slice(startIndex);
      }

      const fullPayload = { model: this.llm.model, temperature: this.llm.temperature, messages: [{role:'system', content: this.systemPrompt}, ...messages], tools: toolDefinitions };
      console.warn('[PAYLOAD DEBUG] Payload chars:', JSON.stringify(fullPayload).length, 'Msg count:', messages.length);

      try {
        const msg = await this.llm.chat(this.systemPrompt, messages, toolDefinitions);

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          this.history.push(msg);
          for (const call of msg.tool_calls) {
            const { id, function: { name, arguments: rawArgs } } = call;
            const validToolNames = this.runtime.schemas().map(s => s.name);
            if (!validToolNames.includes(name)) {
              this.history.push({ role: 'tool', tool_call_id: id, name, content: `ERROR: Tool "${name}" not found. Available: ${validToolNames.join(', ')}` });
              continue;
            }
            let args;
            try { args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs; }
            catch (e) { this.history.push({ role: 'tool', tool_call_id: id, name, content: 'ERROR: Invalid JSON arguments' }); continue; }

            if (hooks.onToolStart) hooks.onToolStart({ name, args });
            let observation;
            try {
              const result = await Promise.race([
                this.runtime.dispatch(name, args),
                new Promise((_, rej) => setTimeout(() => rej(new Error(`Tool ${name} timed out after 60s`)), 60000))
              ]);
              observation = typeof result === 'string' ? result : JSON.stringify(result);
            } catch (err) {
              console.error(`[Cortex] Tool Failed: ${err.message}`);
              observation = JSON.stringify({ error: true, message: err.message });
            }
            if (hooks.onToolEnd) hooks.onToolEnd({ name, args, result: observation });
            this.history.push({ role: 'tool', name, tool_call_id: id, content: observation });
            if (this.projectId) await addProjectMemory(this.projectId, observation).catch(e => console.error('[Cortex] Memory save failed', e));
            await new Promise(r => setTimeout(r, 1000));
          }
          continue;
        }

        let finalContent = msg.content;
        if (!finalContent || finalContent.trim() === '') {
          const obs = this.history.filter(h => h.role === 'tool').map(h => h.content).join('\n');
          finalContent = obs.length > 0
            ? 'Boss, task completed. Tool observations summary:\n' + obs.slice(0, 600) + '...'
            : "Boss, I've processed your request but have no further details to add.";
        }
        const finalMsg = { role: 'assistant', content: finalContent };
        this.history.push(finalMsg);
        return finalMsg;

      } catch (err) {
        console.error('[Cortex] Thinking Loop failed:', err);
        const errorMsg = typeof err === 'string' ? err : (err?.message || 'Unexpected reasoning error.');
        throw new Error(`Mickii Brain Error: ${errorMsg}`);
      }
    }

    return {
      content: 'Boss, max iteration limit reach ho gayi hai. Ab tak ki analysis ke hisaab se hume aage badhna chahiye.',
      role: 'assistant'
    };
  }

  reset() { this.history = []; }
}
