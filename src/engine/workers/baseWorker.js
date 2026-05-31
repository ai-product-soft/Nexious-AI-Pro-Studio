import { getDb } from '../../data/db.js';
import { logWorkerStart, logWorkerEnd, logWorkerFail, logApprovalWait } from '../utils/runtimeHealth.js';
import { emit } from '@tauri-apps/api/event';

// Safe SQLite string value sanitization helper
export const sanitizeSqlValue = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return String(val);
  return val.replace(/'/g, "''"); // escape single quotes safely
};

export class BaseWorker {
  constructor(name, queue, requiresApproval = false, approvalSeverity = 'standard') {
    this.name = name;
    this.queue = queue;
    this.requiresApproval = requiresApproval;
    this.approvalSeverity = approvalSeverity;
    this.status = 'idle';
  }

  /**
   * Abstract execution method to be overridden by subclasses
   * @param {string} targetId Target ID (e.g. lead_id, project_id)
   * @param {object} params Custom execution parameters
   */
  async execute(targetId, params) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Core runner wrapper with state logging, error handling, and database logging
   * @param {string} targetId Target row ID (e.g., project_id, lead_id)
   * @param {object} params Runtime options
   * @returns {Promise<object>} Run results
   */
  async run(targetId, params = {}) {
    const db = await getDb();
    const logId = crypto.randomUUID();
    this.status = 'running';
    const startTime = Date.now();

    // 1. Safe Parameter Validation (Prevent null/undefined crashes)
    const cleanTargetId = targetId ? String(targetId).trim() : 'demo-proj-1';
    const cleanParams = params && typeof params === 'object' ? params : {};
    const activeProvider = cleanParams.provider_used || 'Gemini';

    // Log worker start to runtime health monitor
    logWorkerStart(this.name);

    // 2. Proactively initialize/migrate worker_logs table with duration and provider metrics
    await db.execute(`
      CREATE TABLE IF NOT EXISTS worker_logs (
        id TEXT PRIMARY KEY,
        worker_name TEXT,
        status TEXT DEFAULT 'idle',
        input_data TEXT,
        output_data TEXT,
        error_message TEXT,
        duration_ms INTEGER DEFAULT 0,
        provider_used TEXT DEFAULT 'Gemini',
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(err => console.warn('[BaseWorker] worker_logs table structure check handled:', err));

    // Log startup (State: running)
    await db.execute(
      `INSERT INTO worker_logs (id, worker_name, status, input_data, provider_used, timestamp)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [logId, this.name, 'running', JSON.stringify({ targetId: cleanTargetId, params: cleanParams }), activeProvider]
    ).catch(err => console.error('[BaseWorker Log Insert Err]', err));

    try {
      emit('worker_log_updated', { worker_name: this.name, status: 'running' }).catch(() => {});
    } catch {}

    try {
      // If worker requires approval, transition status state to waiting_approval before triggering execution
      if (this.requiresApproval) {
        this.status = 'waiting_approval';
        logApprovalWait(this.name);
        await db.execute(
          `UPDATE worker_logs SET status = $1 WHERE id = $2`,
          ['waiting_approval', logId]
        ).catch(e => console.warn('[BaseWorker waiting_approval state transition ignored]', e));
        
        try {
          emit('worker_log_updated', { worker_name: this.name, status: 'waiting_approval' }).catch(() => {});
        } catch {}
      }

      // Run subclass execution method, injecting any dynamic rules (Self-Evolution Feature)
      let dynamicRules = '';
      try {
        const rulesDb = await db.select('SELECT prompt_rules FROM dynamic_worker_prompts WHERE worker_name = $1 LIMIT 1', [this.name]);
        if (rulesDb && rulesDb.length > 0) {
          dynamicRules = rulesDb[0].prompt_rules;
          cleanParams.dynamic_rules = dynamicRules;
          console.log(`[BaseWorker] Self-Evolution rules injected for ${this.name}`);
        }
      } catch (e) { /* table might not exist yet */ }

      const result = await this.execute(cleanTargetId, cleanParams);

      const durationMs = Date.now() - startTime;
      this.status = 'completed';

      // Log completion to runtime health monitor
      logWorkerEnd(this.name, durationMs);

      // Log success (State: completed)
      await db.execute(
        `UPDATE worker_logs 
         SET status = $1, output_data = $2, duration_ms = $3, timestamp = CURRENT_TIMESTAMP
         WHERE id = $4`,
        ['completed', JSON.stringify(result), durationMs, logId]
      ).catch(err => console.error('[BaseWorker Log Success Err]', err));

      try {
        emit('worker_log_updated', { worker_name: this.name, status: 'completed' }).catch(() => {});
      } catch {}

      return {
        success: true,
        workerName: this.name,
        logId,
        durationMs,
        providerUsed: activeProvider,
        output: result
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error(`[BaseWorker Error in ${this.name}]`, error);
      this.status = 'failed';

      // Log failure to runtime health monitor
      logWorkerFail(this.name, error);

      // Log failure (State: failed)
      await db.execute(
        `UPDATE worker_logs 
         SET status = $1, error_message = $2, duration_ms = $3, timestamp = CURRENT_TIMESTAMP
         WHERE id = $4`,
        ['failed', error.message || String(error), durationMs, logId]
      ).catch(err => console.error('[BaseWorker Log Error Err]', err));

      try {
        emit('worker_log_updated', { worker_name: this.name, status: 'failed' }).catch(() => {});
      } catch {}

      return {
        success: false,
        workerName: this.name,
        logId,
        durationMs,
        providerUsed: activeProvider,
        error: error.message || String(error)
      };
    }
  }
}
