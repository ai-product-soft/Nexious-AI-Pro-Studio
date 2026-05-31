import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class DocumentorWorker extends BaseWorker {
  constructor() {
    super('Documentor', 'planning', true, 'standard');
  }

  /**
   * Generates documentation in Markdown format
   * @param {string} projectId  SQLite project ID
   * @param {object} params     { doc_type: 'user_manual'|'admin_guide'|'api_docs'|'readme' }
   */
  async execute(projectId, params = {}) {
    const db = await getDb();
    const docType = params.doc_type || 'user_manual';

    // ── 1. Fetch project ──────────────────────────────────────────────────────
    const projRows = await db.select('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRows || projRows.length === 0) {
      throw new Error(`Project "${projectId}" not found in SQLite projects table.`);
    }
    const project = projRows[0];

    const projectName = project.name        || 'AI Project';
    const clientName  = project.client_name || 'Client';
    const projectType = project.type        || 'Web Application';

    // ── 2. Fetch blueprint context if available ────────────────────────────────
    let blueprintContext = '';
    try {
      const bpRows = await db.select(
        'SELECT prd_text, tech_stack_json FROM blueprints WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
        [projectId]
      );
      if (bpRows && bpRows.length > 0) {
        blueprintContext = (bpRows[0].prd_text || '').slice(0, 600);
      }
    } catch { /* non-fatal */ }

    // ── 3. Build doc-type specific prompt ─────────────────────────────────────
    const docConfig = {
      user_manual: {
        label:    'User Manual',
        audience: 'non-technical end user (business owner with marketing background)',
        level:    'beginner-friendly',
        sections: 'Introduction, Getting Started, Main Features (with step-by-step instructions), FAQ (10 questions), Troubleshooting, Support Contact'
      },
      admin_guide: {
        label:    'Administrator Guide',
        audience: 'technical administrator or developer',
        level:    'intermediate-technical',
        sections: 'System Overview, Installation & Setup, Configuration (API keys, database, cron jobs), Backup & Restore, Monitoring & Logs, Performance Tuning, Security Hardening, Common Errors & Fixes'
      },
      api_docs: {
        label:    'API Documentation',
        audience: 'developer or integration partner',
        level:    'technical',
        sections: 'Overview & Base URL, Authentication, Rate Limits, Endpoints (with request/response examples for each), Error Codes, SDKs & Libraries, Changelog'
      },
      readme: {
        label:    'README',
        audience: 'developer or technical evaluator',
        level:    'technical',
        sections: 'Project Banner, Description, Features List, Tech Stack, Prerequisites, Installation Steps, Usage Examples, Screenshots Placeholder, Contributing, License, Contact'
      }
    };

    const cfg = docConfig[docType] || docConfig.user_manual;

    const systemPrompt = `You are Mickii Technical Writer — an expert documentation specialist for premium AI software products.
Write a comprehensive ${cfg.label} in Markdown format.
Target audience: ${cfg.audience}.
Technical level: ${cfg.level}.
Required sections: ${cfg.sections}.

Rules:
- Use proper Markdown (##, ###, bullet points, code blocks, tables where useful)
- Write in clear, professional English
- Be specific to the project context provided
- Include placeholder notes for screenshots: [SCREENSHOT: description]
- Minimum 800 words
- Output ONLY the Markdown document, no JSON wrapper`;

    const userPrompt = `
Project Name: ${projectName}
Client: ${clientName}
Project Type: ${projectType}
Document Type: ${cfg.label}
${blueprintContext ? 'Context from PRD:\n' + blueprintContext : ''}

Write the complete ${cfg.label} for this project.
`;

    let docContent = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        docContent = await executeLlmWithFallback(userPrompt, systemPrompt);
        break;
      } catch (err) {
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    // Fallback content if all LLM attempts fail
    if (!docContent) {
      const fallbacks = {
        user_manual: `# ${projectName} — User Manual\n\n## Introduction\nWelcome to ${projectName}! This guide will help you get started with your new AI-powered system.\n\n## Getting Started\n1. Launch the application from your desktop\n2. Navigate to the Dashboard to see your overview\n3. Add your first lead via the Lead CRM screen\n\n## Main Features\n\n### Dashboard\nYour command center showing active projects, lead counts, and pending approvals.\n\n### Lead CRM\nManage all your prospects in one place. Add leads, track status, and trigger AI workers.\n\n### Build New\nDeep work cockpit for triggering AI workers to research, build, and generate assets.\n\n### Approval Center\nReview and approve all AI-generated actions before they execute.\n\n## FAQ\n**Q: How do I add a new lead?**\nA: Go to Lead CRM → click "Add Lead" → fill the form → Submit.\n\n**Q: How do I run the Business Analyst worker?**\nA: Go to Build New → select your project → click "Run Worker" on Business Analyst card.\n\n## Support\nContact: support@mabishion.ai`,

        admin_guide: `# ${projectName} — Administrator Guide\n\n## System Overview\n${projectName} runs as a native Tauri v2 desktop application with SQLite local database.\n\n## Installation\n1. Download the .deb or .AppImage bundle\n2. Install: \`sudo dpkg -i mabishion-ai.deb\`\n3. Launch from Applications menu\n\n## Configuration\n\n### API Keys Setup\nNavigate to Settings → LLM Configuration and add your API keys:\n- Google Gemini API Key\n- Groq API Key  \n- Cerebras API Key (optional)\n- NVIDIA NIM API Key (optional)\n\n### Database Location\nSQLite database stored at: \`~/.local/share/mabishion-ai/mabishion.db\`\n\n## Backup & Restore\nGo to Settings → Maintenance → Export Database to save a JSON backup.\n\n## Monitoring\nCheck System Monitor screen for worker status, LLM health, and database stats.\n\n## Common Errors\n- **Database init failed**: Check @tauri-apps/plugin-sql is configured correctly\n- **LLM call failed**: Verify API keys in Settings screen\n- **Worker stuck at running**: Restart the app; cron will re-trigger`,

        api_docs: `# ${projectName} — API Documentation\n\n## Base URL\n\`http://localhost:8000/api\`\n\n## Authentication\nAll endpoints require Bearer token in Authorization header:\n\`\`\`\nAuthorization: Bearer <your_token>\n\`\`\`\n\n## Endpoints\n\n### GET /projects\nReturns list of all projects.\n\`\`\`json\n{ "data": [{ "id": "uuid", "name": "Project Name", "stage": "Planning" }] }\n\`\`\`\n\n### POST /leads\nCreate a new lead.\n\`\`\`json\n{ "name": "John", "email": "john@co.com", "source": "LinkedIn", "budget": "5000" }\n\`\`\`\n\n### POST /workers/run\nTrigger a worker.\n\`\`\`json\n{ "worker": "business_analyst", "target_id": "project-uuid" }\n\`\`\`\n\n## Error Codes\n- 400: Bad Request\n- 401: Unauthorized\n- 404: Not Found\n- 500: Internal Server Error`,

        readme: `# ${projectName}\n\n> AI-Powered Private Digital Factory & Revenue Engine\n\n[SCREENSHOT: Dashboard overview]\n\n## Description\n${projectName} is a premium desktop application that automates the entire client project lifecycle — from lead capture to delivery — using AI workers and a multi-LLM fallback engine.\n\n## Features\n- 🤖 20 Autonomous AI Workers\n- 📊 Live Lead CRM & Scoring\n- ✅ Human-in-the-Loop Approval Gates\n- 💰 Invoice & Payment Generation\n- 🔄 Content Calendar & Marketing Automation\n- 📄 Document & Blueprint Generator\n\n## Tech Stack\n- **Desktop Shell**: Tauri v2 (Rust)\n- **Frontend**: React 18 + Vite + Tailwind CSS\n- **Database**: SQLite (local)\n- **AI**: Gemini 2.5 → Groq → Cerebras → NVIDIA NIM → Ollama\n\n## Installation\n\`\`\`bash\ngit clone <repo>\ncd mabishion-ai\nnpm install\nnpm run dev\n\`\`\`\n\n## License\nPrivate — Owner use only. Not for distribution.\n\n## Contact\nmabishion.ai`
      };
      docContent = fallbacks[docType] || fallbacks.user_manual;
    }

    // ── 4. Ensure documents table ─────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        doc_type TEXT,
        label TEXT,
        content TEXT,
        word_count INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const docId = crypto.randomUUID();
    const wordCount = docContent.split(/\s+/).length;

    await db.execute(
      `INSERT INTO documents (id, project_id, doc_type, label, content, word_count, version, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
      [docId, projectId, docType, cfg.label, docContent, wordCount, 1]
    );

    return {
      docId,
      projectName,
      docType,
      label:      cfg.label,
      content:    docContent,
      wordCount,
      audience:   cfg.audience,
      level:      cfg.level,
      summary:    `${cfg.label} generated for ${projectName} | ${wordCount} words | Version 1`
    };
  }
}
