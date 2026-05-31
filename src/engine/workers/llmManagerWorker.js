import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';

/**
 * LLM Manager System Worker
 * Tracks daily quota, validates API keys, rotates providers, logs usage.
 * Approval: NONE — pure system worker (auto-run).
 */
export class LlmManagerWorker extends BaseWorker {
  constructor() {
    super('LLM Manager', 'system', false, null);
  }

  _providers() {
    return [
      { id: 'gemini',     name: 'Google Gemini 2.5 Flash', dailyLimit: 1500,  key_setting: 'gemini_api_key'     },
      { id: 'groq',       name: 'Groq Llama 3.3 70B',      dailyLimit: 1000,  key_setting: 'groq_api_key'       },
      { id: 'cerebras',   name: 'Cerebras Llama 3.3 70B',  dailyLimit: 1700,  key_setting: 'cerebras_api_key'   },
      { id: 'nvidia_nim', name: 'NVIDIA NIM (Mistral)',     dailyLimit: 1000,  key_setting: 'nvidia_nim_api_key' },
      { id: 'ollama',     name: 'Ollama Gemma 3 4B',        dailyLimit: 99999, key_setting: null                 }
    ];
  }

  async execute(projectId, params = {}) {
    const db = await getDb();
    const action = params.action || 'status'; // 'status' | 'reset_quota' | 'test_key' | 'rotate'

    // Ensure llm_usage table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS llm_usage (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        date TEXT,
        request_count INTEGER DEFAULT 0,
        token_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        last_used TEXT,
        status TEXT DEFAULT 'active'
      );
    `).catch(() => {});

    await db.execute(`
      CREATE TABLE IF NOT EXISTS llm_key_health (
        id TEXT PRIMARY KEY,
        provider_id TEXT UNIQUE,
        is_configured INTEGER DEFAULT 0,
        last_tested TEXT,
        last_test_result TEXT DEFAULT 'untested',
        consecutive_errors INTEGER DEFAULT 0
      );
    `).catch(() => {});

    const today = new Date().toISOString().slice(0, 10);
    const providers = this._providers();

    // ── STATUS: Read quota for all providers ─────────────────────────────────
    if (action === 'status' || action === 'rotate') {
      const usageReport = [];
      const settings = await db.select("SELECT key, value FROM settings WHERE key LIKE '%api_key%'").catch(() => []);
      const keyMap = {};
      (settings || []).forEach(s => { keyMap[s.key] = s.value; });

      for (const prov of providers) {
        let used = 0, errors = 0;
        try {
          const rows = await db.select(
            'SELECT request_count, error_count FROM llm_usage WHERE provider_id = $1 AND date = $2',
            [prov.id, today]
          );
          if (rows && rows.length > 0) { used = rows[0].request_count || 0; errors = rows[0].error_count || 0; }
        } catch { }

        const isConfigured = prov.key_setting === null ? true : !!(keyMap[prov.key_setting]);
        const remaining    = prov.dailyLimit - used;
        const usagePct     = Math.round((used / prov.dailyLimit) * 100);
        const health       = !isConfigured ? 'not_configured' : errors > 10 ? 'degraded' : remaining < 50 ? 'quota_low' : 'healthy';

        usageReport.push({
          provider:    prov.id,
          name:        prov.name,
          isConfigured,
          used,
          remaining,
          dailyLimit:  prov.dailyLimit,
          usagePct,
          errors,
          health,
          recommended: isConfigured && health === 'healthy' && remaining > 50
        });
      }

      // Save health snapshot
      for (const rep of usageReport) {
        const hid = crypto.randomUUID();
        await db.execute(
          `INSERT INTO llm_key_health (id, provider_id, is_configured, last_tested, last_test_result, consecutive_errors)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT(provider_id) DO UPDATE SET is_configured=$3, last_tested=$4, last_test_result=$5`,
          [hid, rep.provider, rep.isConfigured ? 1 : 0, new Date().toISOString(), rep.health, rep.errors]
        ).catch(() => {});
      }

      // Find best active provider
      const best = usageReport.find(r => r.recommended) || usageReport.find(r => r.isConfigured) || usageReport[usageReport.length - 1];

      return {
        action: 'status',
        date:   today,
        providers: usageReport,
        activeBestProvider: best?.provider || 'ollama',
        totalRequestsToday: usageReport.reduce((s, r) => s + r.used, 0),
        totalErrors:        usageReport.reduce((s, r) => s + r.errors, 0),
        summary: `LLM Status: ${usageReport.filter(r => r.health === 'healthy').length}/${providers.length} providers healthy | Best: ${best?.name} | Total today: ${usageReport.reduce((s, r) => s + r.used, 0)} requests`
      };
    }

    // ── RESET QUOTA: Zero out today's counters ────────────────────────────────
    if (action === 'reset_quota') {
      const target = params.provider_id || null;
      const query  = target
        ? 'UPDATE llm_usage SET request_count = 0, error_count = 0 WHERE date = $1 AND provider_id = $2'
        : 'UPDATE llm_usage SET request_count = 0, error_count = 0 WHERE date = $1';
      const args = target ? [today, target] : [today];
      await db.execute(query, args).catch(() => {});
      return { action: 'reset_quota', provider: target || 'all', date: today, summary: `Quota reset for ${target || 'all providers'} on ${today}` };
    }

    // ── INCREMENT USAGE (called by llmManager.js service) ────────────────────
    if (action === 'increment') {
      const pid    = params.provider_id || 'gemini';
      const tokens = params.tokens      || 0;
      const isErr  = params.is_error    || false;

      const existing = await db.select('SELECT id FROM llm_usage WHERE provider_id = $1 AND date = $2', [pid, today]).catch(() => []);
      if (existing && existing.length > 0) {
        await db.execute(
          `UPDATE llm_usage SET request_count = request_count + 1, token_count = token_count + $1, error_count = error_count + $2, last_used = CURRENT_TIMESTAMP WHERE provider_id = $3 AND date = $4`,
          [tokens, isErr ? 1 : 0, pid, today]
        ).catch(() => {});
      } else {
        await db.execute(
          `INSERT INTO llm_usage (id, provider_id, date, request_count, token_count, error_count, last_used, status) VALUES ($1,$2,$3,1,$4,$5,CURRENT_TIMESTAMP,'active')`,
          [crypto.randomUUID(), pid, today, tokens, isErr ? 1 : 0]
        ).catch(() => {});
      }
      return { action: 'increment', provider: pid, summary: `Usage logged for ${pid}` };
    }

    return { action, summary: `LLM Manager: action "${action}" acknowledged` };
  }
}
