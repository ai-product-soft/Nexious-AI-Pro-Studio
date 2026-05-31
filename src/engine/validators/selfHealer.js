/**
 * Self Healer
 * Retry mechanism with exponential backoff.
 * Three-strikes rule: retry up to maxRetries, then fallback to template.
 */

export class SelfHealer {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.backoffBase = options.backoffBase || 1000;
    this.fallbackTemplate = options.fallbackTemplate || null;
    this.attemptHistory = [];
  }

  async execute(operation, context = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation({ ...context, attempt, previousError: lastError });
        this.attemptHistory.push({ attempt, status: 'success', timestamp: Date.now() });
        return { success: true, result, attempts: attempt };
      } catch (error) {
        lastError = error;
        this.attemptHistory.push({
          attempt,
          status: 'failed',
          error: error.message,
          timestamp: Date.now()
        });

        if (attempt < this.maxRetries) {
          const delay = this.backoffBase * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    if (this.fallbackTemplate) {
      const fallbackResult = typeof this.fallbackTemplate === 'function'
        ? await this.fallbackTemplate(context, lastError)
        : this.fallbackTemplate;
      return {
        success: true,
        result: fallbackResult,
        attempts: this.maxRetries,
        fallback: true,
        warning: `Operation failed after ${this.maxRetries} attempts. Fallback used.`
      };
    }

    return {
      success: false,
      error: lastError,
      attempts: this.maxRetries,
      history: this.attemptHistory
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const total = this.attemptHistory.length;
    const successes = this.attemptHistory.filter(h => h.status === 'success').length;
    return { totalAttempts: total, successes, failures: total - successes };
  }
}

export default SelfHealer;
