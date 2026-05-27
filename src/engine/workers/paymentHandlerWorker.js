import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';
import { jsPDF } from 'jspdf';

export class PaymentHandlerWorker extends BaseWorker {
  constructor() {
    // CRITICAL — money involved
    super('Payment Handler', 'sales', true, 'critical');
  }

  async execute(projectId, params = {}) {
    const db = await getDb();
    const milestone = params.milestone || 'advance';

    // ── 1. Fetch project ──────────────────────────────────────────────────────
    const projRows = await db.select('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRows || projRows.length === 0) throw new Error(`Project "${projectId}" not found.`);
    const project = projRows[0];

    const clientName = project.client_name || params.client_name || 'Client';
    const projectName = project.name || 'Project';

    // ── 2. Determine amount from milestone ────────────────────────────────────
    const totalBudget = params.total_amount || 5000;
    const milestoneMap = {
      advance: { label: 'Advance / Booking Fee (50%)', pct: 0.5 },
      midway:  { label: 'Midway Milestone Payment',    pct: 0.25 },
      final:   { label: 'Final Delivery Payment',      pct: 0.25 },
      full:    { label: 'Full Project Payment',         pct: 1.0 },
    };
    const ms = milestoneMap[milestone] || milestoneMap.advance;
    const amount = Math.round(totalBudget * ms.pct);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const invoiceDate = new Date().toLocaleDateString('en-IN');
    const dueDate = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-IN');

    // ── 3. LLM — Professional invoice text ───────────────────────────────────
    const systemPrompt = `You are Mickii Billing Specialist. Generate a professional invoice summary.
Return valid JSON only:
{ "invoiceNote": "Professional note to client about this payment (2-3 sentences)", "paymentTerms": "Payment terms text", "reminderSchedule": [{"day":0,"message":"..."},{"day":3,"message":"..."},{"day":6,"message":"..."}] }`;

    const userPrompt = `Invoice for ${clientName}, project ${projectName}, amount ₹${amount.toLocaleString('en-IN')} (${ms.label}). Invoice #${invoiceNumber}.`;

    let responseText;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        responseText = await executeLlmWithFallback(userPrompt, systemPrompt);
        break;
      } catch (err) {
        lastError = err;
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
    if (!responseText) throw lastError || new Error('LLM failed after 3 retries');

    let clean = responseText.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let llmData;
    try { llmData = JSON.parse(clean); } catch {
      llmData = {
        invoiceNote: `Please find attached invoice #${invoiceNumber} for ${ms.label} on project ${projectName}. Kindly process payment by ${dueDate}.`,
        paymentTerms: 'Payment due within 7 days of invoice date. Accepted: UPI, Bank Transfer, Stripe.',
        reminderSchedule: [
          { day: 0, message: `Invoice #${invoiceNumber} sent to ${clientName}. Amount: ₹${amount.toLocaleString('en-IN')}` },
          { day: 3, message: `Friendly reminder: Invoice #${invoiceNumber} due in 4 days.` },
          { day: 6, message: `Final reminder: Invoice #${invoiceNumber} due tomorrow. Please pay to avoid delay.` },
        ]
      };
    }

    // ── 4. Generate PDF invoice ───────────────────────────────────────────────
    let pdfBase64 = null;
    try {
      const doc = new jsPDF();

      // Header bar
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('MABISHION AI', 15, 18);
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.text('Private Digital Factory & Revenue Engine', 15, 26);
      doc.setFontSize(18);
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE', 155, 22);

      // Invoice meta
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Invoice #: ${invoiceNumber}`,   130, 55);
      doc.text(`Date: ${invoiceDate}`,           130, 63);
      doc.text(`Due Date: ${dueDate}`,           130, 71);

      // Bill To
      doc.setFont('Helvetica', 'bold');
      doc.text('Bill To:', 15, 55);
      doc.setFont('Helvetica', 'normal');
      doc.text(clientName, 15, 63);
      doc.text(`Project: ${projectName}`, 15, 71);

      // Line separator
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.8);
      doc.line(15, 85, 195, 85);

      // Table header
      doc.setFillColor(240, 241, 255);
      doc.rect(15, 88, 180, 10, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Description', 18, 95);
      doc.text('Milestone', 110, 95);
      doc.text('Amount', 165, 95);

      // Table row
      doc.setFont('Helvetica', 'normal');
      doc.text(projectName.slice(0, 50), 18, 108);
      doc.text(ms.label.slice(0, 35),    110, 108);
      doc.text(`Rs. ${amount.toLocaleString('en-IN')}`, 165, 108);

      // Total
      doc.line(15, 118, 195, 118);
      doc.setFont('Helvetica', 'bold');
      doc.text('TOTAL DUE:', 130, 128);
      doc.setTextColor(99, 102, 241);
      doc.setFontSize(14);
      doc.text(`Rs. ${amount.toLocaleString('en-IN')}`, 160, 128);

      // Payment details
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'bold');
      doc.text('Payment Methods:', 15, 145);
      doc.setFont('Helvetica', 'normal');
      doc.text('UPI: mabishion@upi  |  Bank Transfer: On request  |  Stripe: Link sent separately', 15, 153);

      // UPI QR placeholder
      doc.setFillColor(245, 247, 255);
      doc.roundedRect(15, 160, 50, 50, 3, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(99, 102, 241);
      doc.text('UPI QR CODE', 22, 185);
      doc.text('mabishion@upi', 22, 193);

      // Payment stripe link placeholder
      doc.setTextColor(30, 30, 30);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Stripe Payment Link:', 75, 168);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(99, 102, 241);
      doc.text(`https://pay.mabishion.ai/${invoiceNumber}`, 75, 176);

      // Note
      doc.setTextColor(100, 100, 100);
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      const noteLines = doc.splitTextToSize(llmData.invoiceNote, 180);
      doc.text(noteLines, 15, 220);

      // Terms
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      const termLines = doc.splitTextToSize(llmData.paymentTerms, 180);
      doc.text(termLines, 15, 240);

      // Footer
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 268, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('Mabishion AI — Private Digital Factory', 15, 280);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 130, 280);

      pdfBase64 = doc.output('datauristring');
    } catch (pdfErr) {
      console.warn('[PaymentHandlerWorker] PDF generation failed (non-fatal):', pdfErr.message);
    }

    // ── 5. Ensure payments + revenue_log tables ───────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        client_name TEXT,
        invoice_number TEXT,
        milestone TEXT,
        amount REAL,
        status TEXT DEFAULT 'pending',
        invoice_pdf TEXT,
        payment_link TEXT,
        reminder_schedule TEXT,
        invoice_date TEXT,
        due_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await db.execute(`
      CREATE TABLE IF NOT EXISTS revenue_log (
        id TEXT PRIMARY KEY,
        payment_id TEXT,
        project_id TEXT,
        client_name TEXT,
        amount REAL,
        milestone TEXT,
        type TEXT DEFAULT 'invoice',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const paymentId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO payments (id, project_id, client_name, invoice_number, milestone, amount, status, invoice_pdf, payment_link, reminder_schedule, invoice_date, due_date, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)`,
      [
        paymentId, projectId, clientName, invoiceNumber, milestone, amount,
        'pending',
        pdfBase64 ? 'generated' : 'failed',
        `https://pay.mabishion.ai/${invoiceNumber}`,
        JSON.stringify(llmData.reminderSchedule || []),
        invoiceDate, dueDate
      ]
    );

    const revenueId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO revenue_log (id, payment_id, project_id, client_name, amount, milestone, type, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
      [revenueId, paymentId, projectId, clientName, amount, milestone, 'invoice']
    );

    return {
      paymentId,
      invoiceNumber,
      clientName,
      projectName,
      milestone:         ms.label,
      amount,
      totalBudget,
      invoiceDate,
      dueDate,
      pdfGenerated:      !!pdfBase64,
      pdfBase64,
      paymentLink:       `https://pay.mabishion.ai/${invoiceNumber}`,
      upiId:             'mabishion@upi',
      reminderSchedule:  llmData.reminderSchedule,
      paymentTerms:      llmData.paymentTerms,
      invoiceNote:       llmData.invoiceNote,
      summary: `Invoice #${invoiceNumber} | ${clientName} | Rs.${amount.toLocaleString('en-IN')} | Due: ${dueDate}`
    };
  }
}
