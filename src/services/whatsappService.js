import { getSetting, setSetting, logWhatsAppAttempt } from '../data/db.js';

let messageListeners = [];

// Fallback session state in-memory if SQLite settings aren't loaded yet
let simulatedStatus = 'disconnected'; 

export const WhatsAppService = {
  /**
   * Initialize WhatsApp Web connection session
   */
  async initialize() {
    console.log('[WhatsAppService] Initializing connection scan...');
    const savedStatus = await getSetting('whatsapp_status');
    if (savedStatus) {
      simulatedStatus = savedStatus;
    } else {
      simulatedStatus = 'qr_required';
      await setSetting('whatsapp_status', 'qr_required');
    }
    console.log(`[WhatsAppService] Status initialized: "${simulatedStatus}"`);
    return simulatedStatus;
  },

  /**
   * Get current connection status: 'connected' | 'disconnected' | 'qr_required'
   */
  async getStatus() {
    const savedStatus = await getSetting('whatsapp_status');
    return savedStatus || simulatedStatus;
  },

  /**
   * Simulates scanning QR code, saving the session
   */
  async scanQRCode() {
    console.log('[WhatsAppService] QR Code scanned successfully!');
    simulatedStatus = 'connected';
    await setSetting('whatsapp_status', 'connected');
    await setSetting('whatsapp_connected_at', new Date().toISOString());
    return 'connected';
  },

  /**
   * Simulates disconnecting the session
   */
  async disconnect() {
    console.log('[WhatsAppService] Disconnecting WhatsApp session...');
    simulatedStatus = 'disconnected';
    await setSetting('whatsapp_status', 'disconnected');
    return 'disconnected';
  },

  /**
   * Send a general text message to a specific number
   */
  async sendMessage(phone, message) {
    console.log(`[WhatsAppService] Outbound request: to=${phone}, message="${message}"`);
    const status = await this.getStatus();
    
    if (status !== 'connected') {
      console.warn('[WhatsAppService] Message failed: Not connected.');
      await logWhatsAppAttempt(phone, message, 'failed_not_connected', 1);
      throw new Error('WhatsApp service not connected. Scan QR code first.');
    }

    // In a real Puppeteer implementation, this would talk to the Rust backend or direct chromium driver.
    // For our Rs. 0 desktop app, we simulate transmission with a 500ms latency and log it in SQLite.
    await new Promise(resolve => setTimeout(resolve, 500));
    await logWhatsAppAttempt(phone, message, 'sent', 1);
    
    // Output standard toast/notification log
    console.log(`%c[WhatsApp Send Success] 📲 To: ${phone} | Msg: "${message}"`, 'color: #10B981; font-weight: bold;');
    return { success: true, timestamp: new Date().toISOString() };
  },

  /**
   * Send pre-approved templates
   */
  async sendTemplate(phone, templateName, variables = {}) {
    let message = '';
    const { worker_name, project_name, amount, id, minutes, owner_notes } = variables;

    switch (templateName) {
      case 'CRITICAL':
        message = `🔔 CRITICAL: ${worker_name || 'System Worker'} needs approval for ${project_name || 'Mabishion Build'}. Amount: ₹${amount || '0'}. Reply: APPROVE ${id} or REJECT ${id}`;
        break;
      case 'REMINDER':
        message = `⏰ REMINDER: Approval ${id} expires in ${minutes || '30'} minutes. ${project_name || 'Mabishion Build'} waiting.`;
        break;
      case 'APPROVED':
        message = `✅ APPROVED: ${project_name || 'Mabishion Build'} approved. ${worker_name || 'System Worker'} proceeding.`;
        break;
      case 'REJECTED':
        message = `❌ REJECTED: ${project_name || 'Mabishion Build'} rejected. Reason: ${owner_notes || 'No reason provided.'}`;
        break;
      default:
        message = `🔔 Mabishion AI Notification: ${templateName} alert.`;
    }

    return await this.sendMessage(phone, message);
  },

  /**
   * Register a callback listener for incoming messages (webhooks)
   */
  onMessage(callback) {
    if (typeof callback === 'function') {
      messageListeners.push(callback);
      console.log(`[WhatsAppService] Registered new message listener (Total: ${messageListeners.length})`);
    }
  },

  /**
   * Clear all registered listeners
   */
  clearListeners() {
    messageListeners = [];
  },

  /**
   * Inbound Message Simulator Webhook hook (Runs inside UI terminal console)
   */
  async receiveSimulatedWebhook(phone, text) {
    console.log(`%c[WhatsApp Webhook Simulated] 📩 From: ${phone} | Body: "${text}"`, 'color: #3B82F6; font-weight: bold;');
    
    const messageEvent = {
      from: phone,
      body: text ? text.trim() : '',
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID()
    };

    // Invoke all registered listeners in parallel
    for (const listener of messageListeners) {
      try {
        await listener(messageEvent);
      } catch (err) {
        console.error('[WhatsAppService] Error in message listener callback:', err);
      }
    }
  }
};

// Bind to window for direct console testing
if (typeof window !== 'undefined') {
  window.__simulateInboundWhatsApp = (phone, text) => {
    WhatsAppService.receiveSimulatedWebhook(phone, text);
  };
}
