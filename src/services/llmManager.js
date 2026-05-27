import { getSetting, logLlmUsage } from '../data/db';

/**
 * Validates and checks standard API key setups
 * @param {string} provider Provider name
 * @param {string} apiKey Given API key
 * @returns {Promise<boolean>} Whether verification was successful
 */
export async function validateApiKey(provider, apiKey) {
  if (!apiKey || apiKey.includes('PASTE_YOUR') || apiKey.trim() === '') {
    return false;
  }

  try {
    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      return res.status === 200;
    }

    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      return res.status === 200;
    }

    if (provider === 'cerebras') {
      const res = await fetch('https://api.cerebras.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      return res.status === 200;
    }

    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      return res.status === 200;
    }
    
    return true;
  } catch (e) {
    console.error(`[LLM Key Validation] Failed for ${provider}:`, e);
    return false;
  }
}

/**
 * Execute Chat Completion through Groq
 */
async function callGroq(apiKey, prompt, systemInstruction) {
  const model = 'llama-3.3-70b-versatile';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemInstruction || 'You are Mickii, Mabishion AI director.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API returned ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;

  return { text, promptTokens, completionTokens, totalTokens, model };
}

/**
 * Execute Content Generation through Gemini
 */
async function callGemini(apiKey, prompt, systemInstruction) {
  const model = 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      systemInstruction: systemInstruction ? {
        parts: [{ text: systemInstruction }]
      } : undefined,
      generationConfig: {
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API returned ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Gemini token estimation if not returned
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(text.length / 4);
  const totalTokens = promptTokens + completionTokens;

  return { text, promptTokens, completionTokens, totalTokens, model };
}

/**
 * Execute Chat Completion through Cerebras
 */
async function callCerebras(apiKey, prompt, systemInstruction) {
  const model = 'llama3.1-70b';
  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemInstruction || 'You are Mickii, Mabishion AI director.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cerebras API returned ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;

  return { text, promptTokens, completionTokens, totalTokens, model };
}

/**
 * Execute Chat Completion through OpenRouter
 */
async function callOpenRouter(apiKey, prompt, systemInstruction) {
  const model = 'openrouter/auto';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://mabishion.ai',
      'X-Title': 'Mabishion AI'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemInstruction || 'You are Mickii, Mabishion AI director.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API returned ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;

  return { text, promptTokens, completionTokens, totalTokens, model };
}

/**
 * Master fallback runner that sequences: Groq -> Gemini -> Cerebras -> OpenRouter
 * @param {string} prompt Prompt content
 * @param {string} systemInstruction Optional system directives
 * @returns {Promise<string>} LLM text completion
 */
export async function executeLlmWithFallback(prompt, systemInstruction = '') {
  const fallbackChain = [
    { provider: 'groq', keyName: 'groq_api_key', runner: callGroq },
    { provider: 'gemini', keyName: 'gemini_api_key', runner: callGemini },
    { provider: 'cerebras', keyName: 'cerebras_api_key', runner: callCerebras },
    { provider: 'openrouter', keyName: 'openrouter_api_key', runner: callOpenRouter }
  ];

  let errors = [];

  for (const step of fallbackChain) {
    try {
      const apiKey = await getSetting(step.keyName);
      if (!apiKey || apiKey.includes('PASTE_YOUR') || apiKey.trim() === '') {
        console.log(`[LLM Fallback] Skipping ${step.provider} due to missing or placeholder key.`);
        continue;
      }

      console.log(`[LLM Fallback] Attempting ${step.provider}...`);
      const startTime = Date.now();
      const result = await step.runner(apiKey, prompt, systemInstruction);
      const duration = Date.now() - startTime;

      console.log(`[LLM Fallback] Success with ${step.provider} in ${duration}ms. Model: ${result.model}`);
      
      // Log usage metrics
      await logLlmUsage(
        step.provider,
        result.model,
        result.promptTokens,
        result.completionTokens,
        result.totalTokens,
        'SUCCESS'
      );

      return result.text;
    } catch (e) {
      console.warn(`[LLM Fallback] ${step.provider} failed:`, e);
      errors.push(`${step.provider}: ${e.message || String(e)}`);
      
      // Log failed call metric
      await logLlmUsage(
        step.provider,
        'unknown',
        0,
        0,
        0,
        `FAILED - ${e.message || String(e)}`
      );
    }
  }

  // If offline/emergency mode, trigger locally simulated Llama response
  console.warn("[LLM Fallback] All APIs in fallback chain failed. Resorting to local emergency simulated brain.");
  const localSimulatedResponse = `[Emergency Offline Mode] Mickii here! All external APIs failed. 
Here is a simulated diagnostic answer for your prompt: "${prompt.slice(0, 100)}...". 
Please ensure your API keys (Groq/Gemini/Cerebras/OpenRouter) are set correctly and connected in the Settings Screen.`;

  await logLlmUsage('local_offline', 'Gemma-3-4B-Simulated', 10, 20, 30, 'SUCCESS_OFFLINE');
  return localSimulatedResponse;
}
