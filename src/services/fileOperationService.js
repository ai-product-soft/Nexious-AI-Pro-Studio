import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

/**
 * Triggers file saving to user selected directory (Tauri shell or Browser fallback)
 * @param {string} filename Name of the file
 * @param {Blob} blob File Blob content
 */
export async function saveFileToUserDirectory(filename, blob) {
  try {
    // If running in Tauri Native Shell
    if (window.__TAURI_INTERNALS__) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      console.log(`[File Operation] Opening native save dialog for ${filename}...`);
      
      const filePath = await save({
        defaultPath: filename,
        filters: [{
          name: filename.endsWith('.zip') ? 'ZIP Archive' : 'PDF Document',
          extensions: [filename.split('.').pop()]
        }]
      });

      if (filePath) {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        await writeFile(filePath, uint8Array);
        console.log(`[File Operation] Successfully saved file natively to: ${filePath}`);
        alert(`File saved successfully to:\n${filePath}`);
        return filePath;
      } else {
        console.log(`[File Operation] Native save canceled by user.`);
        return null;
      }
    }
  } catch (error) {
    console.error('[File Operation] Tauri native save failed. Falling back to browser trigger:', error);
  }

  // Browser Fallback Download
  console.log(`[File Operation] Triggering browser download trigger for ${filename}...`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}

/**
 * Generates a beautiful professional PDF estimate/invoice
 * @param {Object} data Invoice content
 * @returns {Promise<Blob>} The generated PDF Blob
 */
export async function generatePdfInvoice(data) {
  const doc = new jsPDF();
  const title = data.title || 'Mabishion AI Proposal Summary';
  const client = data.clientName || 'Valued Client';
  const amount = data.amount || '$0.00';
  const date = data.date || new Date().toLocaleDateString();
  const items = data.items || [];

  // Draw elegant Glassmorphism-style design tokens on the PDF!
  // Header Glow banner
  doc.setFillColor(15, 23, 42); // Slate-900 background tint
  doc.rect(0, 0, 210, 45, 'F');

  // Title text with Inter-like spacing
  doc.setTextColor(99, 102, 241); // Indigo-500
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('MABISHION AI', 20, 20);

  doc.setTextColor(248, 250, 252); // Text White
  doc.setFontSize(11);
  doc.setFont('Helvetica', 'normal');
  doc.text('The Premium Digital Factory & Revenue Engine', 20, 28);
  doc.text(`DATE: ${date}`, 150, 20);

  // Client Details
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.text('CLIENT SPECIFICATIONS:', 20, 60);

  doc.setFont('Helvetica', 'normal');
  doc.text(`Client Name: ${client}`, 20, 68);
  doc.text(`Project Target: ${title}`, 20, 76);
  doc.text(`Total Value: ${amount}`, 20, 84);

  // Divider Line
  doc.setDrawColor(99, 102, 241); // Indigo border
  doc.setLineWidth(0.5);
  doc.line(20, 92, 190, 92);

  // Deliverable Line Items
  doc.setFont('Helvetica', 'bold');
  doc.text('ESTIMATED DELIVERABLES & PHASES:', 20, 102);

  doc.setFont('Helvetica', 'normal');
  let yPosition = 112;
  if (items.length === 0) {
    doc.text('- Core Custom Web Application Build & API Engine Integration', 20, yPosition);
    doc.text('- Business Intelligence Analysis & System Blueprint documentation', 20, yPosition + 8);
    doc.text('- 24/7 Automated Lead Pipeline Routing with WhatsApp Alerts', 20, yPosition + 16);
  } else {
    items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item}`, 20, yPosition);
      yPosition += 8;
    });
  }

  // Footer Disclaimer block
  doc.setFillColor(241, 245, 249); // light surface tint
  doc.rect(20, 240, 170, 25, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.setFont('Helvetica', 'oblique');
  doc.text('Mabishion AI operates as the private, high-fidelity EARNING ENGINE of the owner.', 25, 247);
  doc.text('This document serves as an operational blueprint and commercial estimate draft.', 25, 252);
  doc.text('All specifications are subject to owner authorization.', 25, 257);

  return doc.output('blob');
}

/**
 * Generates a premium multi-section professional business proposal
 * @param {Object} data Proposal content
 * @returns {Promise<Blob>} The generated PDF Blob
 */
export async function generateProposalPdf(data) {
  const doc = new jsPDF();
  const name = data.name || 'Mabishion Project';
  const client = data.clientName || 'Valued Client';
  const budget = data.budget || '$5,000.00';
  const description = data.description || 'Custom digital platform deployment.';
  const stage = data.stage || 'Discovery';
  const date = new Date().toLocaleDateString();
  const proposalId = `PROP-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Premium Header
  doc.setFillColor(15, 23, 42); // Deep Slate background banner
  doc.rect(0, 0, 210, 45, 'F');

  // Logo Placeholder
  doc.setFillColor(99, 102, 241); // Indigo-500 logo square
  doc.rect(20, 10, 12, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('M', 24, 19);

  doc.setTextColor(248, 250, 252);
  doc.setFontSize(16);
  doc.text('MABISHION AI', 38, 19);
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text('PREMIUM COMMERCIAL PROPOSAL', 38, 26);

  // Metadata block
  doc.setTextColor(148, 163, 184);
  doc.text(`ID: ${proposalId}`, 150, 19);
  doc.text(`DATE: ${date}`, 150, 26);

  // Divider Line
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.8);
  doc.line(20, 45, 190, 45);

  let y = 60;

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`PROJECT: ${name.toUpperCase()}`, 20, y);
  y += 8;
  doc.setFontSize(11);
  doc.text(`Client: ${client}  |  Current Stage: ${stage}`, 20, y);
  y += 12;

  // Executive Summary Section
  doc.setFillColor(248, 250, 252); // Soft background card
  doc.rect(20, y, 170, 22, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.text('1. EXECUTIVE SUMMARY', 24, y + 6);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const descText = doc.splitTextToSize(description, 162);
  doc.text(descText, 24, y + 13);
  y += 28;

  // Scope of Work Section
  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. SCOPE OF WORK', 20, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`- Fully tailored deployment of the customized ${name} platform.`, 20, y);
  y += 6;
  doc.text('- Premium Responsive Glassmorphic User Interface design framework.', 20, y);
  y += 6;
  doc.text('- Integrations with secure SQLite database schema & Multi-LLM fallbacks.', 20, y);
  y += 6;
  doc.text('- Strict automated human-in-the-loop validation safegates and logging panels.', 20, y);
  y += 12;

  // Timeline Section
  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3. TIMELINE & ESTIMATED DELIVERABLES', 20, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('• Phase 1 (Discovery & Setup): Core architecture mapping (1-2 Days)', 20, y);
  y += 6;
  doc.text('• Phase 2 (Development & Test): Full component build & sandbox logic (3-5 Days)', 20, y);
  y += 6;
  doc.text('• Phase 3 (Delivery): Automated packaging, compliance check, and handoff (1 Day)', 20, y);
  y += 12;

  // Pricing Section
  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('4. ESTIMATED PRICING STRUCTURE', 20, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`- Total Commercial Budget (Flat Rate): ${budget}`, 20, y);
  y += 6;
  doc.text('- Maintenance & Optimization (Optional): Included for first 90 days', 20, y);
  y += 12;

  // Terms Section
  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('5. BUSINESS TERMS & CONDITIONS', 20, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('• Payments terms: 50% upfront initial deposit, 50% upon successful delivery.', 20, y);
  y += 6;
  doc.text('• Intellectual Property: Full ownership transfers to client upon final payment clearance.', 20, y);

  // Footer
  doc.setFillColor(241, 245, 249);
  doc.rect(20, 245, 170, 22, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('Helvetica', 'oblique');
  doc.text('Mabishion AI Operations Engine. This proposal represents a binding commercial quote.', 24, 252);
  doc.text('Unauthorized distribution of this blueprint document is strictly prohibited.', 24, 257);
  doc.text('Subject to Owner Digital Signature and Client Intake authorization.', 24, 262);

  return doc.output('blob');
}

/**
 * Creates a packed ZIP bundle comprising proposals, deliverables, and blueprints
 * @param {Array} filesList Array of { name: string, content: Blob|string } files
 * @returns {Promise<Blob>} The generated ZIP Blob
 */
export async function generateZipDeliverable(filesList = []) {
  const zip = new JSZip();

  if (filesList.length === 0) {
    // Add default template files if list is empty
    zip.file('MABISHION_BLUEPRINT.md', '# MABISHION PIPELINE BLUEPRINT\nCreated by Mickii AI Worker.');
    zip.file('CLIENT_INSTRUCTIONS.txt', 'Review invoice PDF and trigger payments to initialize code deployment.');
  } else {
    filesList.forEach(file => {
      zip.file(file.name, file.content);
    });
  }

  return await zip.generateAsync({ type: 'blob' });
}
