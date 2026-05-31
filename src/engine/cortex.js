/**
 * Mickii Agent Cortex — Direct Multi-LLM Edition
 * ReAct reasoning loop using direct APIs (Gemini / Groq / NVIDIA NIM).
 */

import { AgentRuntime, SystemTools } from "./runtime.js";
import { invoke } from "@tauri-apps/api/core";
import {
  getSetting,
  getAllSettings,
  addProjectMemory,
  getProjectMemory,
} from "../data/db.js";
import { appDataDir } from "@tauri-apps/api/path";
import { logLLMProvider, logMemoryPrune } from "./utils/runtimeHealth.js";

const MAX_ITERATIONS = 12;

/* -------------------------------------------------------------------------- */
/* LLM Provider (Direct API Integrations)                                     */
/* -------------------------------------------------------------------------- */

// Helper utility for lightweight context memory protection
const pruneContextString = (str, limit = 800) => {
  if (typeof str !== "string") return "";
  if (str.length <= limit) return str;
  logMemoryPrune(1);
  return (
    str.substring(0, limit) +
    "... [Context pruned safely to prevent token-limit overflow]"
  );
};

function selectGeminiModel(userText) {
  const lower = userText.toLowerCase();
  
  // Tool/Worker execution tasks
  const toolTasks = ['worker','trigger','tool','run',
    'execute','dispatch','start','activate','call','use'];
  
  // Deep thinking tasks  
  const complexTasks = ['architecture','schema','blueprint',
    'design','plan','strategy','analyze','security',
    'database','implement','structure'];
  
  if (toolTasks.some(k => lower.includes(k))) {
    return 'gemini-3.1-pro-preview-customtools'; // Best for Mickii
  }
  if (complexTasks.some(k => lower.includes(k))) {
    return 'gemini-3.1-pro-preview'; // Deep reasoning
  }
  return 'gemini-3.5-flash'; // Default — fast + capable
}

export class LLMProvider {
  constructor(cfg = {}) {
    this.primaryProvider = cfg.primaryProvider || "gemini"; // gemini, groq, openrouter
    this.temperature = cfg.temperature ?? 0.1;
  }

  async chat(systemPrompt, messages, tools = []) {
    // Strict Context Window Manager
    let truncatedMessages = [...messages];
    if (truncatedMessages.length > 6) {
      truncatedMessages = truncatedMessages.slice(-6);
      while (
        truncatedMessages.length > 0 &&
        truncatedMessages[0].role === "tool"
      ) {
        truncatedMessages.shift();
      }
    }

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...truncatedMessages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool",
            tool_call_id: m.tool_call_id || "unknown",
            content:
              typeof m.content === "string"
                ? m.content
                : JSON.stringify(m.content),
          };
        }
        if (m.role === "assistant" && m.tool_calls) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.tool_calls,
          };
        }
        return {
          role: m.role,
          content:
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content),
        };
      }),
    ];

    const geminiKey = await getSetting("gemini_api_key");
    const groqKey = await getSetting("groq_api_key");
    const nimKey = await getSetting("nvidia_nim_api_key");

    const hasAnyKey = (geminiKey && !geminiKey.startsWith("PASTE_YOUR")) ||
                      (groqKey && !groqKey.startsWith("PASTE_YOUR")) ||
                      (nimKey && !nimKey.startsWith("PASTE_YOUR"));

    if (!hasAnyKey) {
      throw new Error("API Key not set. Please go to Settings and configure at least one API Key (Gemini, Groq, or NVIDIA NIM).");
    }

    // Try providers in order: Gemini -> Groq -> NVIDIA NIM
    const providers = [
      {
        name: "Gemini",
        url: async () => {
          const userMsgs = messages.filter(m => m.role === 'user');
          const userMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : null;
          const userText = userMsg ? (typeof userMsg.content === 'string' ? userMsg.content : JSON.stringify(userMsg.content)) : '';
          const modelName = selectGeminiModel(userText);
          
          return {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
            key: geminiKey,
          };
        },
        buildPayload: (msgs) => {
          const systemMsgs = msgs.filter((m) => m.role === "system");
          const nonSystemMsgs = msgs.filter((m) => m.role !== "system");
          const payload = {
            contents: nonSystemMsgs.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content || "" }],
            })),
          };
          if (systemMsgs.length > 0) {
            payload.systemInstruction = {
              parts: [{ text: systemMsgs.map((m) => m.content).join("\n") }],
            };
          }
          return payload;
        },
        parseResponse: (data) => {
          if (!data.candidates || !data.candidates[0])
            throw new Error("Empty Gemini response");
          const content = data.candidates[0].content?.parts?.[0]?.text;
          if (!content) throw new Error("No text in Gemini response");
          return { role: "assistant", content };
        },
      },
      {
        name: "Groq",
        url: async () => {
          return {
            url: "https://api.groq.com/openai/v1/chat/completions",
            key: groqKey,
          };
        },
        buildPayload: (msgs) => ({
          model: "llama-3.3-70b-versatile",
          messages: msgs,
          temperature: this.temperature,
          max_tokens: 4096,
        }),
        parseResponse: (data) => {
          if (!data.choices || !data.choices[0])
            throw new Error("Empty Groq response");
          return {
            role: "assistant",
            content: data.choices[0].message?.content || "No content",
          };
        },
      },
      {
        name: "NVIDIA NIM",
        url: async () => {
          return {
            url: "https://integrate.api.nvidia.com/v1/chat/completions",
            key: nimKey,
          };
        },
        buildPayload: (msgs) => ({
          model: "mistralai/mistral-nemo",
          messages: msgs,
          temperature: this.temperature,
          max_tokens: 4096,
        }),
        parseResponse: (data) => {
          if (!data.choices?.[0]) throw new Error("Empty NVIDIA response");
          return {
            role: "assistant",
            content: data.choices[0].message?.content || "No content",
          };
        },
      },
    ];

    let lastError = null;

    for (const provider of providers) {
      try {
        const { url, key } = await provider.url();
        if (!key || key.startsWith("PASTE_YOUR") || key.length < 10) {
          console.warn(
            `[Cortex] Skipping ${provider.name} — no valid key configured.`,
          );
          continue;
        }

        console.log(`[Cortex] Trying ${provider.name}...`);
        logLLMProvider(provider.name);
        const payload = provider.buildPayload(openaiMessages);

        let data;
        let retries = 0;
        const maxRetries = provider.name === "Gemini" ? 1 : 0; // Retry Gemini safely once

        while (retries <= maxRetries) {
          try {
            if (provider.name === "Gemini") {
              data = await invoke("gemini_proxy", {
                payload,
                apiKey: key,
                baseUrl: url,
              });
            } else {
              data = await invoke("llm_proxy", {
                payload,
                apiKey: key,
                baseUrl: url,
                extraHeaders:
                  provider.name === "OpenRouter"
                    ? {
                        "HTTP-Referer": "http://localhost",
                        "X-Title": "Mabishion-Mickii",
                      }
                    : {},
              });
            }

            if (data && data.error) {
              throw new Error(
                typeof data.error === "string"
                  ? data.error
                  : JSON.stringify(data.error),
              );
            }
            break; // Success! Break retry loop
          } catch (retryErr) {
            retries++;
            if (retries > maxRetries) {
              throw retryErr; // Out of retries, escalate to fallback handler
            }
            console.warn(
              `[Cortex Alert] ${provider.name} attempt failed, retrying safely once in 1.5s... Error:`,
              retryErr.message || retryErr,
            );
            await new Promise((r) => setTimeout(r, 1500));
          }
        }

        const result = provider.parseResponse(data);
        console.log(`[Cortex] ${provider.name} completed successfully!`);
        return result;
      } catch (err) {
        const readableMsg = err.message || String(err);
        console.warn(
          `[Cortex Alert] ${provider.name} pipeline execution failed:`,
          readableMsg,
        );
        lastError = new Error(`${provider.name} failure (${readableMsg})`);
      }
    }

    throw new Error(
      `All LLM providers failed. Fallback pipeline exhausted. Last error details: ${lastError?.message || lastError}`,
    );
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
      "You are Mickii, Mabishion AI Business Agent.",
      "CRITICAL RULES (SEARCH-FIRST, DATE-AWARE):",
      "1. ALWAYS use mickii_web_search (and optionally mickii_deep_research) before any factual, market, or model-related answer.",
      "2. NEVER rely only on your training memory for facts, dates, or model lists. If something is not clearly present in the latest search results, you must say you are not sure.",
      "3. When search results are available, cite specific findings including YEAR or DATE when visible in the snippet.",
      '4. When search results are older than the current year or look outdated, clearly warn: ", but ye info old search results par based hai".',
      '5. If the user explicitly asks about a time window (for example: "in May 2026"), focus on results with dates closest to that window. If no such results appear, clearly say: "Boss, exact May 2026 ka data search mein nahi mila, sirf purani info mili".',
      '6. If search is successful, your answer should start with: "Based on search results:" and quote the real findings.',
      '7. CRITICAL: If search or deep research FAILS, errors out, or returns nothing useful, YOU MUST ABORT factual answering. Respond ONLY with: "Boss, live web search failed or returned no data. I cannot provide verified info right now." DO NOT guess, DO NOT invent lists, DO NOT say "Based on search results:".',
      '8. Speak in professional Hinglish ("Boss, kaam ho gaya" style), but keep facts strictly tied to the search data.',
      "ANTI-HALLUCINATION SHIELD:",
      '9. NEVER fabricate fake citations like "TechCrunch May 2026" or "Microsoft blog May 5". If you cannot verify a source, DO NOT cite it.',
      '10. Distinguish between "AI app builders" (Bolt, Taskade) and "ML platforms" (TensorFlow, Azure). They are different categories.',
      '11. Before recommending a tool as free, verify: "Does this tool actually have a free tier in the search results?" If unsure, say "I need to verify the pricing."'
    ].join("\n");
  }

  async think(userText, hooks = {}) {
    if (this.projectId && !this.memoryLoaded) {
      this.memoryLoaded = true;
      try {
        const mems = await getProjectMemory(this.projectId, 5);
        if (mems && mems.length > 0) {
          // Safeguard: Prune observations text to keep memory payload under token limit
          const memStr = mems
            .map((m) => `- ${pruneContextString(m.observation)}`)
            .join("\n");
          this.systemPrompt += `\n\n### PROJECT MEMORY (Last 5 Observations):\n${memStr}`;
        }
      } catch (err) {
        console.error("[Cortex] Failed to load project memory", err);
      }
    }

    this.history.push({ role: "user", content: userText });

    const toolDefinitions = this.runtime.schemas().map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    for (let i = 0; i < this.maxIterations; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      let messages = [...this.history];
      if (messages.length > 4) {
        let startIndex = messages.length - 4;
        while (startIndex > 0 && messages[startIndex].role === "tool")
          startIndex--;
        messages = messages.slice(startIndex);
      }

      const fullPayload = {
        model: this.llm.model,
        temperature: this.llm.temperature,
        messages: [{ role: "system", content: this.systemPrompt }, ...messages],
        tools: toolDefinitions,
      };
      console.warn(
        "[PAYLOAD DEBUG] Payload chars:",
        JSON.stringify(fullPayload).length,
        "Msg count:",
        messages.length,
      );

      try {
        const msg = await this.llm.chat(
          this.systemPrompt,
          messages,
          toolDefinitions,
        );

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          this.history.push(msg);
          for (const call of msg.tool_calls) {
            const {
              id,
              function: { name, arguments: rawArgs },
            } = call;
            const validToolNames = this.runtime.schemas().map((s) => s.name);
            if (!validToolNames.includes(name)) {
              this.history.push({
                role: "tool",
                tool_call_id: id,
                name,
                content: `ERROR: Tool "${name}" not found. Available: ${validToolNames.join(", ")}`,
              });
              continue;
            }
            let args;
            try {
              args =
                typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
            } catch (e) {
              this.history.push({
                role: "tool",
                tool_call_id: id,
                name,
                content: "ERROR: Invalid JSON arguments",
              });
              continue;
            }

            if (hooks.onToolStart) hooks.onToolStart({ name, args });
            let observation;
            try {
              const result = await Promise.race([
                this.runtime.dispatch(name, args),
                new Promise((_, rej) =>
                  setTimeout(
                    () => rej(new Error(`Tool ${name} timed out after 60s`)),
                    60000,
                  ),
                ),
              ]);
              observation =
                typeof result === "string" ? result : JSON.stringify(result);
            } catch (err) {
              console.error(`[Cortex] Tool Failed: ${err.message}`);
              observation = JSON.stringify({
                error: true,
                message: err.message,
              });
            }

            // ── Kimi Search Result Validation ──────────────────────────────────
            if (name === 'mickii_web_search') {
              const searchResult = observation;
              if (!searchResult || searchResult.includes('error') || searchResult.includes('failed') || searchResult.includes('empty results')) {
                observation = 'SEARCH_FAILED: No live data available. Do not hallucinate sources. Inform the user in Hinglish that the search failed and you can only give a standard disclaimer or tell them to check settings API keys.';
              }
            }
            if (hooks.onToolEnd)
              hooks.onToolEnd({ name, args, result: observation });
            this.history.push({
              role: "tool",
              name,
              tool_call_id: id,
              content: observation,
            });
            if (this.projectId)
              await addProjectMemory(this.projectId, observation).catch((e) =>
                console.error("[Cortex] Memory save failed", e),
              );
            await new Promise((r) => setTimeout(r, 1000));
          }
          continue;
        }

        let finalContent = msg.content;
        if (!finalContent || finalContent.trim() === "") {
          const obs = this.history
            .filter((h) => h.role === "tool")
            .map((h) => h.content)
            .join("\n");
          finalContent =
            obs.length > 0
              ? "Boss, task completed. Tool observations summary:\n" +
                obs.slice(0, 600) +
                "..."
              : "Boss, I've processed your request but have no further details to add.";
        }
        const finalMsg = { role: "assistant", content: finalContent };
        this.history.push(finalMsg);
        return finalMsg;
      } catch (err) {
        console.error("[Cortex] Thinking Loop failed:", err);
        const errorMsg =
          typeof err === "string"
            ? err
            : err?.message || "Unexpected reasoning error.";
        throw new Error(`Mickii Brain Error: ${errorMsg}`);
      }
    }

    return {
      content:
        "Boss, max iteration limit reach ho gayi hai. Ab tak ki analysis ke hisaab se hume aage badhna chahiye.",
      role: "assistant",
    };
  }

  reset() {
    this.history = [];
  }
}
