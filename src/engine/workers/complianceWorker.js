import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';
import { jsPDF } from 'jspdf';

export class ComplianceWorker extends BaseWorker {
  constructor() {
    super('Compliance', 'delivery', true, 'standard');
  }

  _jurisdictionNote(jur) {
    const notes = {
      India: 'India IT Act 2000, IT Amendment Act 2008, Personal Data Protection Bill (PDPB) 2023, Consumer Protection Act 2019',
      US:    'US CCPA (California Consumer Privacy Act), COPPA, CAN-SPAM Act, FTC Guidelines',
      EU:    'EU GDPR (General Data Protection Regulation) Articles 13-14, ePrivacy Directive, Cookie Law',
      UK:    'UK GDPR, Data Protection Act 2018, Privacy and Electronic Communications Regulations (PECR)'
    };
    return notes[jur] || notes['India'];
  }

  async execute(projectId, params = {}) {
    const db = await getDb();

    const projRows = await db.select('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRows || projRows.length === 0) throw new Error(`Project "${projectId}" not found.`);
    const project = projRows[0];

    const projectName   = project.name        || 'AI Project';
    const clientName    = project.client_name || 'Client';
    const jurisdiction  = params.jurisdiction  || 'India';
    const businessType  = params.business_type || 'Digital Marketing & AI Services Agency';
    const docType       = params.doc_type      || 'all'; // 'all' | 'terms' | 'privacy' | 'cookies' | 'gdpr' | 'disclaimer'
    const dataCollected = params.data_collected || 'Name, Email, Phone, Payment Info, Usage Data, Cookies';
    const businessAddr  = params.business_address || 'India';
    const lawRef        = this._jurisdictionNote(jurisdiction);

    // Fetch client email from leads if possible
    let businessEmail = 'contact@mabishion.ai';
    try {
      const clientRows = await db.select("SELECT welcome_email FROM clients WHERE client_name LIKE $1 LIMIT 1", [`%${clientName}%`]);
      if (!clientRows || clientRows.length === 0) {
        const leadRows = await db.select("SELECT email FROM leads WHERE name LIKE $1 LIMIT 1", [`%${clientName}%`]);
        if (leadRows && leadRows.length > 0 && leadRows[0].email) businessEmail = leadRows[0].email;
      }
    } catch { }

    const docsToGenerate = docType === 'all'
      ? ['terms', 'privacy', 'cookies', 'disclaimer']
      : [docType];

    const docConfigs = {
      terms: {
        label: 'Terms & Conditions',
        prompt: `Write comprehensive Terms & Conditions for ${businessType} named "${projectName}" operating under ${jurisdiction} law (${lawRef}).
Include: Agreement to Terms, Services Description, User Obligations, Payment Terms & Refunds, Intellectual Property, Limitation of Liability, Governing Law, Dispute Resolution, Changes to Terms, Contact Info.
Use clear plain English. Add section numbers. Mention "Last Updated: ${new Date().toLocaleDateString('en-IN')}".`
      },
      privacy: {
        label: 'Privacy Policy',
        prompt: `Write a comprehensive Privacy Policy for "${projectName}" (${businessType}) under ${jurisdiction} law (${lawRef}).
Include: Data Controller Info, What Data We Collect (${dataCollected}), How We Use It, Legal Basis, Data Retention, Third Party Sharing, User Rights (access, delete, portability), Cookies, Security Measures, Contact Info, Last Updated date.
Compliant with ${lawRef}. Plain English. Section numbered.`
      },
      cookies: {
        label: 'Cookie Policy',
        prompt: `Write a Cookie Policy for "${projectName}" website under ${jurisdiction} law.
Include: What Are Cookies, Types of Cookies We Use (Essential, Analytics, Marketing), Cookie List (table format), How to Disable, Third-Party Cookies, Policy Updates.
Mention Google Analytics and Formspree cookies if applicable. Plain English.`
      },
      gdpr: {
        label: 'GDPR Compliance Notice',
        prompt: `Write a GDPR Compliance Notice for "${projectName}" (${businessType}) for EU users.
Include: Data Controller Details, Legal Basis for Processing (GDPR Art 6), Data Subject Rights (Art 15-22), International Transfers, DPA Contact, Right to Complain to Supervisory Authority, Data Retention Schedule, Privacy by Design statement.
Fully GDPR compliant, professional legal language.`
      },
      disclaimer: {
        label: 'Disclaimer',
        prompt: `Write a professional Disclaimer for "${projectName}" (${businessType}) under ${jurisdiction} law.
Include: General Disclaimer, Professional Advice Disclaimer (not legal/financial advice), AI-Generated Content Disclaimer, External Links Disclaimer, Results Disclaimer (individual results may vary), Limitation of Liability, Accuracy of Information.
Clear and enforceable language.`
      }
    };

    const results = {};

    // Ensure compliance_docs table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS compliance_docs (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        doc_type TEXT,
        label TEXT,
        content TEXT,
        jurisdiction TEXT,
        business_type TEXT,
        version INTEGER DEFAULT 1,
        pdf_data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    for (const dt of docsToGenerate) {
      const cfg = docConfigs[dt];
      if (!cfg) continue;

      // LLM call
      let content = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const sys = `You are a legal compliance specialist. Generate legally sound ${cfg.label} documents. Output only the document text in plain Markdown. No JSON wrappers.`;
          content = await executeLlmWithFallback(
            `Business: ${projectName}\nType: ${businessType}\nJurisdiction: ${jurisdiction}\nData collected: ${dataCollected}\nAddress: ${businessAddr}\nContact: ${businessEmail}\n\n${cfg.prompt}`,
            sys
          );
          break;
        } catch (err) {
          if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }

      // Fallback compliance docs
      if (!content) {
        const fallbacks = {
          terms: `# Terms & Conditions — ${projectName}\n\n**Last Updated:** ${new Date().toLocaleDateString('en-IN')}\n\n## 1. Agreement to Terms\nBy accessing or using ${projectName}, you agree to be bound by these Terms and Conditions.\n\n## 2. Services\n${projectName} provides ${businessType}. Services are delivered as described in the project agreement.\n\n## 3. Payment Terms\n- Advance payment required before project commencement\n- Refunds within 7 days if project not started\n- No refunds after delivery\n\n## 4. Intellectual Property\nAll deliverables become client property upon full payment. Source code and methodologies remain proprietary.\n\n## 5. Limitation of Liability\nOur liability is limited to the project fee paid.\n\n## 6. Governing Law\nThese terms are governed by the laws of ${jurisdiction}.\n\n## 7. Contact\nEmail: ${businessEmail}`,

          privacy: `# Privacy Policy — ${projectName}\n\n**Last Updated:** ${new Date().toLocaleDateString('en-IN')}\n\n## Data We Collect\nWe collect: ${dataCollected}\n\n## How We Use Your Data\n- Service delivery\n- Communication\n- Invoice generation\n- Legal compliance\n\n## Data Retention\nData retained for 3 years after project completion or as required by law.\n\n## Your Rights\nYou have the right to access, correct, or delete your personal data. Contact: ${businessEmail}\n\n## Security\nData encrypted in transit and at rest. Local SQLite storage only.\n\n## Governing Law\n${lawRef}\n\n## Contact\n${businessEmail}`,

          cookies: `# Cookie Policy — ${projectName}\n\n**Last Updated:** ${new Date().toLocaleDateString('en-IN')}\n\n## What Are Cookies\nCookies are small text files stored in your browser.\n\n## Cookies We Use\n| Cookie | Type | Purpose | Duration |\n|--------|------|---------|----------|\n| _ga | Analytics | Google Analytics tracking | 2 years |\n| session_id | Essential | User session | Session |\n| consent | Essential | Cookie consent record | 1 year |\n\n## How to Disable\nYou can disable cookies in your browser settings. Note: some features may not work.\n\n## Contact\n${businessEmail}`,

          gdpr: `# GDPR Compliance Notice — ${projectName}\n\n**Last Updated:** ${new Date().toLocaleDateString('en-IN')}\n\n## Data Controller\n${projectName} (${businessType})\nContact: ${businessEmail}\n\n## Legal Basis (GDPR Art 6)\n- Contract performance\n- Legal obligation\n- Legitimate interests\n\n## Your Rights (Art 15-22)\n- Right to access your data\n- Right to rectification\n- Right to erasure ("right to be forgotten")\n- Right to restrict processing\n- Right to data portability\n- Right to object\n\n## To Exercise Your Rights\nEmail: ${businessEmail}\n\n## Right to Complain\nYou may lodge a complaint with your local Data Protection Authority.`,

          disclaimer: `# Disclaimer — ${projectName}\n\n**Last Updated:** ${new Date().toLocaleDateString('en-IN')}\n\n## General Disclaimer\nThe information provided by ${projectName} is for general informational purposes only.\n\n## AI-Generated Content\nContent generated by AI workers may contain inaccuracies. Human review is recommended before publishing.\n\n## Results Disclaimer\nIndividual results may vary. Past performance does not guarantee future results.\n\n## No Professional Advice\nThis is not legal, financial, or professional advice. Consult qualified professionals for specific advice.\n\n## Limitation of Liability\n${projectName} is not liable for any indirect, incidental, or consequential damages.\n\n## Contact\n${businessEmail}`
        };
        content = fallbacks[dt] || `# ${cfg.label}\n\nContact ${businessEmail} for ${cfg.label} details.`;
      }

      // Generate PDF
      let pdfData = null;
      try {
        const doc = new jsPDF();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(cfg.label, 15, 12);
        doc.setFontSize(9);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${projectName} — ${jurisdiction} — ${new Date().toLocaleDateString('en-IN')}`, 15, 22);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(content.replace(/#{1,6}\s/g, '').replace(/\*\*/g, ''), 180);
        let y = 40;
        lines.forEach(line => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(line, 15, y);
          y += 5;
        });
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 278, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(`Generated by Mabishion AI — ${new Date().toISOString()}`, 15, 287);
        pdfData = doc.output('datauristring');
      } catch (pdfErr) {
        console.warn(`[ComplianceWorker] PDF gen failed for ${dt}:`, pdfErr.message);
      }

      // Save to SQLite
      const docId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO compliance_docs (id, project_id, doc_type, label, content, jurisdiction, business_type, version, pdf_data, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)`,
        [docId, projectId, dt, cfg.label, content, jurisdiction, businessType, 1, pdfData || '']
      );

      results[dt] = { docId, label: cfg.label, wordCount: content.split(/\s+/).length, pdfGenerated: !!pdfData };
    }

    const totalWords = Object.values(results).reduce((sum, r) => sum + (r.wordCount || 0), 0);

    return {
      projectName,
      clientName,
      jurisdiction,
      lawRef,
      businessType,
      docsGenerated: Object.keys(results),
      results,
      totalWords,
      summary: `${Object.keys(results).length} compliance docs generated for ${projectName} | ${jurisdiction} law | ${totalWords} total words | ${Object.values(results).filter(r => r.pdfGenerated).length} PDFs`
    };
  }
}
