import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';

/**
 * Notification System Worker
 * Handles WhatsApp alerts, in-app notifications, and email summaries.
 * Approval: NONE — pure system worker (auto-run).
 */
export class NotificationWorker extends BaseWorker {
  constructor() {
    super('Notification', 'system', false, null);
  }

  _channels() {
    return { whatsapp: 'WhatsApp Business API', inapp: 'In-App Toast', email: 'Email (SMTP)' };
  }

  _priorityConfig(priority) {
    const map = {
      critical: { channels: ['whatsapp', 'inapp'], sound: true,  badge: '🔴', expire: 0   },
      high:     { channels: ['inapp'],             sound: true,  badge: '🟠', expire: 3600 },
      standard: { channels: ['inapp'],             sound: false, badge: '🔵', expire: 86400 },
      info:     { channels: ['inapp'],             sound: false, badge: '⚪', expire: 86400 }
    };
    return map[priority] || map['standard'];
  }

  async execute(projectId, params = {}) {
    const db = await getDb();
    const action   = params.action   || 'send';    // 'send' | 'list' | 'mark_read' | 'clear'
    const priority = params.priority || 'standard'; // 'critical' | 'high' | 'standard' | 'info'

    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        message TEXT,
        priority TEXT DEFAULT 'standard',
        channels TEXT,
        is_read INTEGER DEFAULT 0,
        is_sent INTEGER DEFAULT 0,
        whatsapp_sent INTEGER DEFAULT 0,
        sound_played INTEGER DEFAULT 0,
        expires_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    // ── SEND: Create + dispatch notification ──────────────────────────────────
    if (action === 'send') {
      const title    = params.title   || 'Mabishion AI Notification';
      const message  = params.message || 'An action requires your attention.';
      const cfg      = this._priorityConfig(priority);
      const notifId  = crypto.randomUUID();
      const expiresAt = cfg.expire > 0 ? new Date(Date.now() + cfg.expire * 1000).toISOString() : null;

      await db.execute(
        `INSERT INTO notifications (id, project_id, title, message, priority, channels, is_read, is_sent, whatsapp_sent, sound_played, expires_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,0,0,0,0,$7,CURRENT_TIMESTAMP)`,
        [notifId, projectId || '', title, message, priority, JSON.stringify(cfg.channels), expiresAt]
      );

      // WhatsApp send attempt (real API if key is configured)
      let whatsappSent   = false;
      let whatsappResult = 'skipped';

      if (cfg.channels.includes('whatsapp')) {
        try {
          const waCfg = await db.select("SELECT value FROM settings WHERE key = 'whatsapp_api_key' LIMIT 1").catch(() => []);
          const waPhone = await db.select("SELECT value FROM settings WHERE key = 'owner_phone' LIMIT 1").catch(() => []);
          const apiKey = waCfg && waCfg.length > 0 ? waCfg[0].value : null;
          const phone  = waPhone && waPhone.length > 0 ? waPhone[0].value : null;

          if (apiKey && phone) {
            // Real Meta Business API call
            const waResp = await fetch('https://graph.facebook.com/v18.0/me/messages', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to:      phone.replace(/\D/g, ''),
                type:    'text',
                text:    { body: `${cfg.badge} *Mabishion AI Alert*\n\n*${title}*\n${message}\n\n_Tap to open app_` }
              }),
              signal: AbortSignal.timeout(5000)
            });
            if (waResp.ok) { whatsappSent = true; whatsappResult = 'sent'; }
            else { whatsappResult = `api_error_${waResp.status}`; }
          } else {
            whatsappResult = apiKey ? 'no_phone_configured' : 'no_api_key';
          }
        } catch (err) {
          whatsappResult = `failed: ${err.message}`;
        }
      }

      // In-app notification dispatch (via custom event for React to pick up)
      let inappDispatched = false;
      if (cfg.channels.includes('inapp') && typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('nexious_notification', {
            detail: { id: notifId, title, message, priority, badge: cfg.badge, sound: cfg.sound }
          }));
          inappDispatched = true;
        } catch { }
      }

      // Update sent status in DB
      await db.execute(
        'UPDATE notifications SET is_sent = 1, whatsapp_sent = $1 WHERE id = $2',
        [whatsappSent ? 1 : 0, notifId]
      ).catch(() => {});

      return {
        action: 'send',
        notifId,
        title,
        priority,
        badge:          cfg.badge,
        channels:       cfg.channels,
        whatsappResult,
        inappDispatched,
        summary: `Notification "${title}" [${priority}] | WhatsApp: ${whatsappResult} | In-App: ${inappDispatched}`
      };
    }

    // ── LIST: Fetch unread notifications ──────────────────────────────────────
    if (action === 'list') {
      const limit = params.limit || 20;
      const onlyUnread = params.unread_only !== false;
      const query = onlyUnread
        ? 'SELECT * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT $1'
        : 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1';
      const rows = await db.select(query, [limit]).catch(() => []);
      return {
        action: 'list',
        notifications: (rows || []).map(n => ({
          id:        n.id,
          title:     n.title,
          message:   n.message,
          priority:  n.priority,
          isRead:    n.is_read === 1,
          createdAt: n.created_at
        })),
        unreadCount: (rows || []).filter(n => n.is_read === 0).length,
        summary: `${(rows || []).length} notifications fetched | ${(rows || []).filter(n => n.is_read === 0).length} unread`
      };
    }

    // ── MARK READ ─────────────────────────────────────────────────────────────
    if (action === 'mark_read') {
      const targetId = params.notification_id;
      if (targetId) {
        await db.execute('UPDATE notifications SET is_read = 1 WHERE id = $1', [targetId]).catch(() => {});
      } else {
        await db.execute('UPDATE notifications SET is_read = 1').catch(() => {});
      }
      return { action: 'mark_read', target: targetId || 'all', summary: `Notifications marked read` };
    }

    // ── CLEAR: Delete old read notifications ──────────────────────────────────
    if (action === 'clear') {
      await db.execute("DELETE FROM notifications WHERE is_read = 1 AND created_at < datetime('now', '-7 days')").catch(() => {});
      return { action: 'clear', summary: 'Old read notifications cleared (>7 days)' };
    }

    return { action, summary: `Notification worker: action "${action}" acknowledged` };
  }
}
