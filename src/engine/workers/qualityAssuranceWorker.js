import { BaseWorker } from './baseWorker.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class QualityAssuranceWorker extends BaseWorker {
  constructor() {
    // SYSTEM worker, no approval needed for automated linting
    super('QA Validator', 'system', false, 'standard');
  }

  /**
   * Validates and fixes broken LLM outputs.
   * @param {string} targetId - project or lead ID
   * @param {Object} params - { rawOutput: string, expectedFormat: 'json' | 'html', rules: string }
   */
  async execute(targetId, params = {}) {
    const rawOutput = params.rawOutput || '';
    const format = params.expectedFormat || 'json';
    const maxRetries = 3;

    if (!rawOutput.trim()) {
      throw new Error('[QAWorker] Empty output provided for validation.');
    }

    let currentOutput = rawOutput;
    let isValid = false;
    let errorLog = '';
    
    // First pass validation without LLM
    if (format === 'json') {
      try {
        let clean = currentOutput.trim();
        if (clean.startsWith('```')) clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(clean);
        return { valid: true, fixedOutput: parsed, correctionsMade: 0 };
      } catch (e) {
        errorLog = `JSON Parse Error: ${e.message}`;
      }
    } else if (format === 'html') {
      // Basic check for unclosed main tags or missing body
      const lower = currentOutput.toLowerCase();
      if (!lower.includes('</html>') || !lower.includes('</body>')) {
        errorLog = 'HTML structure is missing closing </body> or </html> tags.';
      } else {
        return { valid: true, fixedOutput: currentOutput, correctionsMade: 0 };
      }
    }

    // If it reaches here, it failed initial validation. Start self-correction loop.
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.warn(`[QAWorker] Validation failed (${errorLog}). Attempting LLM fix ${attempt}/${maxRetries}...`);
      
      const systemPrompt = `You are Mickii QA Engineer. Your job is strictly to fix broken code or JSON.
Do not add any conversational text. Output ONLY the fixed ${format.toUpperCase()}.
Error to fix: ${errorLog}
Rules: ${params.rules || 'Ensure valid syntax.'}`;
      
      const userPrompt = `Fix the following broken output:\n\n${currentOutput}`;

      try {
        const fixed = await executeLlmWithFallback(userPrompt, systemPrompt);
        let cleanFixed = fixed.trim();

        // Re-validate the fix
        if (format === 'json') {
          if (cleanFixed.startsWith('```')) cleanFixed = cleanFixed.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(cleanFixed);
          console.log(`[QAWorker] Successfully fixed JSON on attempt ${attempt}.`);
          return { valid: true, fixedOutput: parsed, correctionsMade: attempt };
        } else if (format === 'html') {
          const lower = cleanFixed.toLowerCase();
          if (lower.includes('</html>') && lower.includes('</body>')) {
            console.log(`[QAWorker] Successfully fixed HTML on attempt ${attempt}.`);
            return { valid: true, fixedOutput: cleanFixed, correctionsMade: attempt };
          } else {
            errorLog = 'HTML still missing closing tags after fix.';
            currentOutput = cleanFixed; // feed it back
          }
        }
      } catch (err) {
        errorLog = `LLM Fix Error: ${err.message}`;
      }
    }

    throw new Error(`[QAWorker] Failed to validate and fix output after ${maxRetries} attempts. Last error: ${errorLog}`);
  }
}
