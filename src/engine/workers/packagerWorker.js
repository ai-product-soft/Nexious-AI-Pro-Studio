import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';
import JSZip from 'jszip';

export class PackagerWorker extends BaseWorker {
  constructor() {
    // CRITICAL — final client deliverable
    super('Packager', 'delivery', true, 'critical');
  }

  async execute(projectId, params = {}) {
    const db = await getDb();

    // ── 1. Fetch project ──────────────────────────────────────────────────────
    const projRows = await db.select('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRows || projRows.length === 0) throw new Error(`Project "${projectId}" not found.`);
    const project = projRows[0];

    const projectName = project.name        || 'AI Project';
    const clientName  = project.client_name || 'Client';
    const deliveryDate = new Date().toLocaleDateString('en-IN');

    // ── 2. Determine version number ────────────────────────────────────────────
    let version = 1;
    try {
      const existingRows = await db.select(
        'SELECT version FROM deliverables WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
        [projectId]
      );
      if (existingRows && existingRows.length > 0) version = (existingRows[0].version || 0) + 1;
    } catch { }
    const versionTag = `v${version}.0`;

    // ── 3. Gather all project assets from SQLite ──────────────────────────────
    const assets = { website: null, docs: [], codeModules: [], payments: [], blueprints: [] };

    try {
      const ws = await db.select('SELECT * FROM websites WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [projectId]);
      if (ws && ws.length > 0) assets.website = ws[0];
    } catch { }

    try {
      const docs = await db.select('SELECT * FROM documents WHERE project_id = $1', [projectId]);
      if (docs) assets.docs = docs;
    } catch { }

    try {
      const mods = await db.select('SELECT * FROM code_modules WHERE project_id = $1', [projectId]);
      if (mods) assets.codeModules = mods;
    } catch { }

    try {
      const pays = await db.select('SELECT * FROM payments WHERE project_id = $1', [projectId]);
      if (pays) assets.payments = pays;
    } catch { }

    try {
      const bps = await db.select('SELECT * FROM blueprints WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [projectId]);
      if (bps && bps.length > 0) assets.blueprints = bps;
    } catch { }

    // ── 4. LLM — Delivery README ──────────────────────────────────────────────
    const sysPrompt = `You are Mickii Delivery Specialist. Write a professional client delivery README in Markdown.
Include: Project Overview, What Was Delivered (bullet list), How To Use Each File, Support Information, Next Steps, Warranty/Maintenance.
Output ONLY the Markdown text. No JSON wrapper.`;

    const userPrompt = `Project: ${projectName} | Client: ${clientName} | Delivered: ${deliveryDate} | Version: ${versionTag}
Assets: Website=${!!assets.website}, Docs=${assets.docs.length}, Code Modules=${assets.codeModules.length}, Payments=${assets.payments.length}`;

    let deliveryReadme = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        deliveryReadme = await executeLlmWithFallback(userPrompt, sysPrompt);
        break;
      } catch (err) {
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    if (!deliveryReadme) {
      deliveryReadme = `# ${projectName} — Delivery Package ${versionTag}

**Client:** ${clientName}
**Delivered:** ${deliveryDate}
**Version:** ${versionTag}

---

## 📦 What's Included

${assets.website ? '- ✅ **Website Files** — `website/` folder — Complete HTML, CSS, JS files ready to deploy' : ''}
${assets.docs.length > 0 ? `- ✅ **Documentation** — \`docs/\` folder — ${assets.docs.length} document(s) including User Manual, Admin Guide` : ''}
${assets.codeModules.length > 0 ? `- ✅ **Source Code** — \`source/\` folder — ${assets.codeModules.length} module(s)` : ''}
${assets.payments.length > 0 ? `- ✅ **Invoices** — \`invoices/\` folder — ${assets.payments.length} payment record(s)` : ''}
- ✅ **README** — This file — Project overview and instructions

---

## 🚀 How To Use

### Website Deployment
1. Open the \`website/\` folder
2. Upload all files to your hosting provider (Netlify recommended — free tier)
3. Set your form action URL in \`index.html\` (search for "YOUR_FORM_ID")
4. Go live!

### Source Code
- Open any file in VS Code
- All components are in \`source/\` folder
- Run \`npm install\` then \`npm run dev\` to start locally

### Documents
- Open \`docs/\` folder
- PDF versions available on request

---

## 🆘 Support

| Contact | Details |
|---------|---------|
| WhatsApp | Available in your contract |
| Email | support@mabishion.ai |
| Response Time | Within 4 business hours |

---

## 🔄 Next Steps

1. Review all delivered files
2. Test the website in your browser
3. Share feedback via WhatsApp
4. Schedule handover call if needed

---

## ⚖️ Warranty

- **Bug fixes:** 30 days post-delivery (free)
- **Revisions:** As per contract
- **Maintenance:** Available on request

---

*Generated by Mabishion AI — ${new Date().toISOString()}*`;
    }

    // ── 5. Build ZIP using JSZip ──────────────────────────────────────────────
    let zipBase64 = null;
    let contentsJson = {};

    try {
      const zip = new JSZip();

      // Root README
      zip.file('README.md', deliveryReadme);

      // Support card
      const supportCard = `MABISHION AI — SUPPORT CARD
=====================================
Project : ${projectName}
Client  : ${clientName}
Delivery: ${deliveryDate}
Version : ${versionTag}

SUPPORT CONTACTS
-----------------
WhatsApp : Contact via project agreement
Email    : support@mabishion.ai
Response : Within 4 business hours (Mon-Sat)

WARRANTY
--------
- Bug fixes: 30 days post-delivery (free)
- Feature additions: Quoted separately
- Emergency support: WhatsApp priority

IMPORTANT NOTES
---------------
- Keep your login credentials safe
- Do not share source code publicly
- Contact us before making major changes

Generated by Mabishion AI`;
      zip.file('SUPPORT_CARD.txt', supportCard);

      // Website folder
      if (assets.website) {
        const webFolder = zip.folder('website');
        webFolder.file('index.html',  assets.website.html_content  || '<!-- Website content -->');
        webFolder.file('styles.css',  assets.website.css_content   || '/* Styles */');
        webFolder.file('script.js',   assets.website.js_content    || '// JavaScript');
        webFolder.file('DEPLOY.md',   `# Deployment Guide\n\n## Netlify (Recommended — Free)\n1. Go to netlify.com → New Site from Git\n2. Or drag & drop this folder\n3. Done! Your site is live.\n\n## Vercel (Alternative)\n1. Go to vercel.com → Import Project\n2. Upload this folder\n3. Deploy.\n\n## Manual Hosting\n- Upload all files in this folder to your web host via FTP\n- Point your domain to the hosting server`);
        contentsJson.website = { files: ['index.html', 'styles.css', 'script.js', 'DEPLOY.md'], size: (assets.website.html_content || '').length };
      }

      // Docs folder
      if (assets.docs.length > 0) {
        const docsFolder = zip.folder('docs');
        contentsJson.docs = [];
        assets.docs.forEach(doc => {
          const filename = `${doc.doc_type || 'document'}_${doc.label || 'doc'}.md`.replace(/\s+/g, '_').toLowerCase();
          docsFolder.file(filename, doc.content || '');
          contentsJson.docs.push({ filename, doc_type: doc.doc_type, word_count: doc.word_count || 0 });
        });
      }

      // Source code folder
      if (assets.codeModules.length > 0) {
        const srcFolder = zip.folder('source');
        contentsJson.codeModules = [];
        assets.codeModules.forEach(mod => {
          const modFolder = srcFolder.folder(mod.module_name?.replace(/\s+/g, '_') || 'module');
          modFolder.file(mod.main_filename || 'Component.jsx', mod.code_text || '');
          if (mod.style_code)  modFolder.file('styles.module.css', mod.style_code);
          if (mod.util_code)   modFolder.file('utils.js',          mod.util_code);
          if (mod.test_text)   modFolder.file('component.test.jsx', mod.test_text);
          if (mod.module_readme) modFolder.file('README.md',        mod.module_readme);
          contentsJson.codeModules.push({ module: mod.module_name, filename: mod.main_filename });
        });
      }

      // Blueprints folder
      if (assets.blueprints.length > 0) {
        const bpFolder = zip.folder('blueprints');
        const bp = assets.blueprints[0];
        if (bp.prd_text) bpFolder.file('PRD.md',          bp.prd_text);
        if (bp.trd_text) bpFolder.file('TRD.md',          bp.trd_text);
        if (bp.architecture_diagram) bpFolder.file('ARCHITECTURE.txt', bp.architecture_diagram);
        if (bp.database_schema)      bpFolder.file('database_schema.sql', bp.database_schema);
        contentsJson.blueprints = ['PRD.md', 'TRD.md', 'ARCHITECTURE.txt', 'database_schema.sql'].filter(Boolean);
      }

      // Invoices folder
      if (assets.payments.length > 0) {
        const invFolder = zip.folder('invoices');
        contentsJson.invoices = [];
        assets.payments.forEach(pay => {
          const invText = `INVOICE\n=======\nInvoice #: ${pay.invoice_number}\nClient   : ${pay.client_name}\nMilestone: ${pay.milestone}\nAmount   : Rs. ${Number(pay.amount || 0).toLocaleString('en-IN')}\nDate     : ${pay.invoice_date || pay.created_at}\nStatus   : ${pay.status || 'pending'}`;
          invFolder.file(`invoice_${pay.invoice_number || pay.id}.txt`, invText);
          contentsJson.invoices.push({ invoice_number: pay.invoice_number, amount: pay.amount, status: pay.status });
        });
      }

      // Delivery checklist
      const checklist = `DELIVERY CHECKLIST — ${projectName} ${versionTag}
=============================================
Date: ${deliveryDate}
Client: ${clientName}

INCLUDED FILES
--------------
[${assets.website     ? 'X' : ' '}] Website files (HTML/CSS/JS)
[${assets.docs.length > 0 ? 'X' : ' '}] Documentation (${assets.docs.length} docs)
[${assets.codeModules.length > 0 ? 'X' : ' '}] Source code modules (${assets.codeModules.length} modules)
[${assets.blueprints.length > 0 ? 'X' : ' '}] Technical blueprints (PRD, TRD, Architecture)
[${assets.payments.length > 0 ? 'X' : ' '}] Invoices (${assets.payments.length} records)
[X] README (delivery summary)
[X] Support card

QUALITY CHECKS
--------------
[ ] Client reviewed README
[ ] Website tested in browser
[ ] Forms tested (submit works)
[ ] Mobile responsive checked
[ ] Links all working
[ ] Invoice amounts verified

HANDOVER SIGN-OFF
-----------------
Delivered by : Mabishion AI
Delivered on : ${deliveryDate}
Client sign  : _______________________
Date         : _______________________`;

      zip.file('DELIVERY_CHECKLIST.txt', checklist);

      // Generate ZIP as base64
      zipBase64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    } catch (zipErr) {
      console.warn('[PackagerWorker] ZIP generation failed (non-fatal):', zipErr.message);
    }

    // ── 6. Ensure deliverables table ──────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS deliverables (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        zip_data TEXT,
        zip_size INTEGER DEFAULT 0,
        contents_json TEXT,
        delivery_readme TEXT,
        version INTEGER DEFAULT 1,
        version_tag TEXT,
        delivery_date TEXT,
        status TEXT DEFAULT 'ready',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const deliverableId = crypto.randomUUID();
    const zipSize = zipBase64 ? Math.round((zipBase64.length * 3) / 4) : 0;

    await db.execute(
      `INSERT INTO deliverables (id, project_id, zip_data, zip_size, contents_json, delivery_readme, version, version_tag, delivery_date, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)`,
      [
        deliverableId, projectId,
        zipBase64 || '',
        zipSize,
        JSON.stringify(contentsJson),
        deliveryReadme,
        version,
        versionTag,
        deliveryDate,
        'ready'
      ]
    );

    await db.execute("UPDATE projects SET stage = 'Delivered' WHERE id = $1", [projectId]).catch(() => {});

    return {
      deliverableId,
      projectName,
      clientName,
      versionTag,
      deliveryDate,
      zipGenerated:  !!zipBase64,
      zipSizeKB:     Math.round(zipSize / 1024),
      zipBase64,
      contentsJson,
      deliveryReadme,
      fileCount: [
        assets.website     ? 3 : 0,
        assets.docs.length,
        assets.codeModules.length * 4,
        assets.payments.length,
        assets.blueprints.length > 0 ? 4 : 0,
        2 // README + Support card
      ].reduce((a, b) => a + b, 0),
      summary: `Delivery package ${versionTag} for ${projectName} | ${zipBase64 ? Math.round(zipSize / 1024) + 'KB ZIP' : 'ZIP failed'} | ${Object.keys(contentsJson).length} asset categories`
    };
  }
}
