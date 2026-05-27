import { logCronExecution, getDb } from '../data/db';

class BrowserCronEngine {
  constructor() {
    this.jobs = new Map();
    this.timerId = null;
    this.ticking = false;
  }

  /**
   * Schedule a background job
   * @param {string} taskName Name of the task
   * @param {number} intervalMs Tick interval in milliseconds
   * @param {Function} callback Callback function to run
   */
  schedule(taskName, intervalMs, callback) {
    if (this.jobs.has(taskName)) {
      console.warn(`[Cron Engine] Task "${taskName}" is already scheduled. Overwriting...`);
    }
    this.jobs.set(taskName, {
      intervalMs,
      callback,
      lastRun: 0,
      running: false
    });
    console.log(`[Cron Engine] Scheduled background task "${taskName}" with interval ${intervalMs}ms`);
  }

  /**
   * Start the cron engine ticking
   */
  start() {
    if (this.ticking) return;
    this.ticking = true;
    console.log(`[Cron Engine] Background Scheduler Started.`);

    // Tick every 10 seconds to check job timings and run them securely
    this.timerId = setInterval(() => {
      this.tick();
    }, 10000);

    // Run first tick immediately asynchronously
    setTimeout(() => this.tick(), 1000);
  }

  /**
   * Stop the cron engine
   */
  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.ticking = false;
    console.log(`[Cron Engine] Background Scheduler Stopped.`);
  }

  async tick() {
    const now = Date.now();

    for (const [taskName, job] of this.jobs.entries()) {
      if (job.running) continue;

      if (now - job.lastRun >= job.intervalMs) {
        job.running = true;
        job.lastRun = now;

        try {
          console.log(`[Cron Engine] Triggering task "${taskName}"...`);
          await job.callback();
          await logCronExecution(taskName, 'SUCCESS', 'Task completed successfully.');
        } catch (error) {
          console.error(`[Cron Engine] Error in task "${taskName}":`, error);
          await logCronExecution(taskName, 'FAILED', `Error: ${error.message || String(error)}`);
        } finally {
          job.running = false;
        }
      }
    }
  }
}

export const cronEngine = new BrowserCronEngine();

/**
 * Auto-Approve Job logic
 */
export async function runAutoApproveJob() {
  const db = await getDb();
  
  // Select all pending approvals
  const pending = await db.select("SELECT * FROM approvals WHERE status = 'pending'");
  if (!pending || pending.length === 0) {
    return;
  }

  const now = new Date();
  let count = 0;

  for (const approval of pending) {
    const expiresAt = new Date(approval.expires_at);
    
    // Check if expired
    if (now >= expiresAt) {
      console.log(`[Cron Engine] Auto-approving expired approval ID: ${approval.id} (Title: ${approval.title})`);
      
      const auditNote = `Auto-approved by Mabishion Cron Gate after timeout at ${now.toISOString()}`;
      
      // Update in SQLite
      await db.execute(
        "UPDATE approvals SET status = $1, owner_notes = $2 WHERE id = $3",
        ['approved', auditNote, approval.id]
      );

      // Log action inside action_ledger if exists
      try {
        const ledgerId = crypto.randomUUID();
        await db.execute(
          "INSERT INTO action_ledger (id, action_type, decision, risk_level, rollback_data) VALUES ($1, $2, $3, $4, $5)",
          [ledgerId, 'Auto-Approve', `Approved: ${approval.title}`, approval.type, JSON.stringify(approval)]
        );
      } catch (ledgerErr) {
        console.warn("[Cron Engine] Ledger log skipped:", ledgerErr);
      }

      count++;
    }
  }

  if (count > 0) {
    console.log(`[Cron Engine] Auto-approved ${count} expired pending items.`);
  }
}

// Register the standard auto-approve cron job to run every 30 seconds
cronEngine.schedule('AutoApproveEngine', 30000, runAutoApproveJob);
