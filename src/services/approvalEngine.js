import { 
  addApprovalExtended, 
  getApprovalById, 
  updateApprovalStatus, 
  setApprovalWhatsAppSent, 
  getPendingApprovals, 
  getSetting 
} from '../data/db.js';
import { WhatsAppService } from './whatsappService.js';

let isIntervalRunning = false;

export const ApprovalEngine = {
  /**
   * Initializes listeners and background auto-expire cron job
   */
  initialize() {
    console.log('[ApprovalEngine] Initializing bridge engine...');
    
    // Register WhatsApp message webhook listener
    WhatsAppService.onMessage(this.handleIncomingWhatsAppMessage.bind(this));
    
    // Start standard auto-approve background scanner (every 30 seconds for test responsiveness)
    if (!isIntervalRunning) {
      setInterval(() => {
        this.runExpiryCheck();
      }, 30000);
      isIntervalRunning = true;
      console.log('[ApprovalEngine] Automated 24h auto-approve background scanner started.');
    }
  },

  /**
   * Primary interface for workers to request approvals
   */
  async requestApproval(title, type, projectId, workerName, requestData) {
    console.log(`[ApprovalEngine] New Approval Requested: "${title}" | Type: ${type} | Worker: ${workerName}`);
    
    const now = new Date();
    // Expiration: 1h for critical, 24h for standard
    const expirationHours = type === 'critical' ? 1 : 24;
    const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000).toISOString();

    // 1. Save pending approval to SQLite
    const approvalId = await addApprovalExtended(title, type, projectId, workerName, requestData, expiresAt);

    // 2. Outbound Alert Dispatch
    if (type === 'critical') {
      this.triggerAudioBeep();
      this.triggerBrowserNotification(title, workerName);

      // Fetch owner's WhatsApp number
      const phone = await getSetting('whatsapp_owner_phone') || '919876543210';
      
      try {
        const amount = requestData?.amount || requestData?.budget || 'N/A';
        await WhatsAppService.sendTemplate(phone, 'CRITICAL', {
          worker_name: workerName,
          project_name: title,
          amount,
          id: approvalId
        });
        await setApprovalWhatsAppSent(approvalId);
      } catch (err) {
        console.warn('[ApprovalEngine] WhatsApp critical alert fail (using in-app fallbacks):', err);
      }
    }

    return approvalId;
  },

  /**
   * Inbound WhatsApp Webhook Processor
   */
  async handleIncomingWhatsAppMessage(message) {
    const text = message.body ? message.body.trim() : '';
    const phone = message.from;
    
    // Regex: Match "APPROVE 123-abc" or "REJECT 123-abc"
    const match = text.match(/^\s*(APPROVE|REJECT)\s+([a-f0-9a-fA-F-]+|[0-9a-zA-Z-]+)\s*$/i);
    
    if (!match) {
      // Invalid structure, reply with guidance help instructions
      const helpMsg = `❓ Mabishion Help: Command not recognized.\n\nReply in exact format:\n👉 *APPROVE [id]*\n👉 *REJECT [id]*`;
      try {
        await WhatsAppService.sendMessage(phone, helpMsg);
      } catch (e) {
        console.error('[ApprovalEngine] Webhook fallback help reply failed:', e);
      }
      return;
    }

    const command = match[1].toUpperCase();
    const approvalId = match[2];

    console.log(`[ApprovalEngine Webhook] Action parsed: COMMAND=${command}, ID=${approvalId}`);

    // Fetch approval record
    const approval = await getApprovalById(approvalId);

    if (!approval) {
      const errorMsg = `❌ Error: Approval ID "${approvalId}" does not exist in Mabishion database registry.`;
      try {
        await WhatsAppService.sendMessage(phone, errorMsg);
      } catch (e) {}
      return;
    }

    if (approval.status !== 'pending' && approval.status !== 'Pending') {
      const warnMsg = `⚠️ Status Alert: Approval ID "${approvalId}" is already resolved as "${approval.status}".`;
      try {
        await WhatsAppService.sendMessage(phone, warnMsg);
      } catch (e) {}
      return;
    }

    // Resolve approval
    const finalStatus = command === 'APPROVE' ? 'approved' : 'rejected';
    const notes = `Resolved remotely via Outbound WhatsApp Webhook Command.`;
    
    await updateApprovalStatus(approvalId, finalStatus, notes);

    // Send confirmation back to WhatsApp owner
    try {
      if (finalStatus === 'approved') {
        await WhatsAppService.sendTemplate(phone, 'APPROVED', {
          project_name: approval.title,
          worker_name: approval.worker_name
        });
      } else {
        await WhatsAppService.sendTemplate(phone, 'REJECTED', {
          project_name: approval.title,
          owner_notes: notes
        });
      }
    } catch (e) {
      console.error('[ApprovalEngine Webhook] Outbound confirmation failed:', e);
    }
  },

  /**
   * Background cron auto-expiration task
   * Scrapes pending standard approvals and auto-approves them after 24h
   */
  async runExpiryCheck() {
    try {
      const pendings = await getPendingApprovals();
      const now = new Date();

      for (const app of pendings) {
        const expiresAt = new Date(app.expires_at);
        if (now > expiresAt) {
          if (app.type === 'standard') {
            console.log(`[ApprovalEngine Expiry Scanner] Auto-approving standard item: ID=${app.id} ("${app.title}")`);
            await updateApprovalStatus(app.id, 'approved', 'System Auto-Approved after 24 hours of safety pending state.');
          } else {
            console.log(`[ApprovalEngine Expiry Scanner] Critical item ID=${app.id} expired. Tagging as expired/rejected.`);
            await updateApprovalStatus(app.id, 'rejected', 'Critical Approval Gate timed out (1 hour maximum limit).');
          }
        }
      }
    } catch (err) {
      console.error('[ApprovalEngine Expiry Scanner] Error checking expirations:', err);
    }
  },

  /**
   * Play standard warning alert sound
   */
  triggerAudioBeep() {
    try {
      // Standard synthetic Web Audio beep
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Triple alert beep pattern
      const playBeep = (delay, pitch, duration) => {
        setTimeout(() => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
          
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        }, delay);
      };

      playBeep(0, 880, 0.25);
      playBeep(300, 880, 0.25);
      playBeep(600, 1200, 0.4);
    } catch (e) {
      console.warn('[ApprovalEngine] Web Audio Beep failed:', e);
    }
  },

  /**
   * Triggers native browser push notifications
   */
  triggerBrowserNotification(title, workerName) {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      new Notification(`🚨 CRITICAL ACTION REQUIRED`, {
        body: `Worker "${workerName}" requires your immediate approval for: "${title}"`,
        icon: '/assets/mickii-avatar.png'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(`🚨 CRITICAL ACTION REQUIRED`, {
            body: `Worker "${workerName}" requires your immediate approval for: "${title}"`,
            icon: '/assets/mickii-avatar.png'
          });
        }
      });
    }
  }
};
