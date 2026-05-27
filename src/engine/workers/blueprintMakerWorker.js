import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class BlueprintMakerWorker extends BaseWorker {
  constructor() {
    super('Blueprint Maker', 'planning', true, 'standard');
  }

  /**
   * Generates full technical blueprint: PRD, TRD, architecture, schema, API list
   * @param {string} projectId  SQLite project ID
   * @param {object} params     { requirements_override }
   */
  async execute(projectId, params = {}) {
    const db = await getDb();

    // ── 1. Fetch project ──────────────────────────────────────────────────────
    const projRows = await db.select('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRows || projRows.length === 0) {
      throw new Error(`Project "${projectId}" not found in SQLite projects table.`);
    }
    const project = projRows[0];

    const projectName  = project.name        || 'AI Project';
    const clientName   = project.client_name || 'Client';
    const projectType  = project.type        || 'Web Application';
    const stage        = project.stage       || 'Planning';
    const requirements = params.requirements_override || project.notes || 'AI-powered business automation system with dashboard, lead management, and automated workflows.';

    // ── 2. Fetch analyst report if available ──────────────────────────────────
    let analystContext = '';
    try {
      const analysisRows = await db.select(
        "SELECT output_data FROM worker_logs WHERE worker_name = 'Business Analyst' ORDER BY timestamp DESC LIMIT 1"
      );
      if (analysisRows && analysisRows.length > 0) {
        const parsed = JSON.parse(analysisRows[0].output_data || '{}');
        const rawContext = parsed.summary || parsed.report || parsed || '';
        analystContext = typeof rawContext === 'string' ? rawContext : JSON.stringify(rawContext);
      }
    } catch { /* non-fatal */ }

    // ── 3. LLM CALL 1 — PRD ──────────────────────────────────────────────────
    const prdPrompt = `You are a Senior Product Manager at a premium AI agency.
Write a detailed PRD (Product Requirements Document) in Markdown format for the following project.
Include: Overview, Problem Statement, Goals & Success Metrics, User Stories (at least 8), 
Functional Requirements, Non-Functional Requirements, Out of Scope items, and Acceptance Criteria.
Output ONLY the Markdown document, no JSON wrappers.`;

    const prdUser = `Project: ${projectName}\nClient: ${clientName}\nType: ${projectType}\nRequirements: ${requirements}\n${analystContext ? 'Market Context: ' + analystContext.slice(0, 400) : ''}`;

    let prdText = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        prdText = await executeLlmWithFallback(prdUser, prdPrompt);
        break;
      } catch (err) {
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
        else prdText = `# PRD — ${projectName}\n\n## Overview\n${projectName} is a ${projectType} for ${clientName}.\n\n## Goals\n- Automate lead management\n- Increase operational efficiency by 40%\n- Reduce manual work by 60%\n\n## User Stories\n- As an owner, I want to see all leads in one place\n- As an owner, I want AI to score leads automatically\n- As an owner, I want to receive approval alerts on WhatsApp\n\n## Functional Requirements\n- Lead CRM with auto-scoring\n- Multi-LLM AI pipeline\n- Approval gate system\n- Payment invoice generation\n\n## Non-Functional Requirements\n- Response time < 2 seconds\n- 99.5% uptime\n- Offline-capable (SQLite local DB)\n\n## Out of Scope\n- Mobile native app\n- Third-party CRM integrations (Phase 2)\n\n## Acceptance Criteria\n- All 4 pipeline stages working end-to-end\n- Build passes with zero errors\n- Owner can approve/reject from dashboard`;
      }
    }

    // ── 4. LLM CALL 2 — TRD + Architecture + Schema + APIs ───────────────────
    const trdPrompt = `You are a Senior Solutions Architect at a premium AI agency.
Return a valid JSON object with these keys ONLY:
{
  "trdMarkdown": "Full TRD in Markdown (system design, data flows, security, deployment)",
  "architectureDiagram": "ASCII text-based architecture diagram showing component relationships",
  "techStack": {
    "frontend": ["..."],
    "backend": ["..."],
    "database": ["..."],
    "devops": ["..."],
    "ai": ["..."]
  },
  "databaseSchema": "SQL CREATE TABLE statements for all required tables",
  "apiEndpoints": [
    { "method": "GET", "path": "/api/...", "description": "...", "auth": true }
  ],
  "securityChecklist": ["item1", "item2"],
  "deploymentSteps": ["step1", "step2"]
}
No markdown wrappers. Only valid JSON.`;

    const trdUser = `Project: ${projectName}\nType: ${projectType}\nRequirements: ${requirements}\nStack Context: Tauri v2 desktop app, React 18 + Vite, SQLite local DB, Multi-LLM fallback chain (Gemini → Groq → Cerebras → OpenRouter → Ollama)`;

    let techData = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await executeLlmWithFallback(trdUser, trdPrompt);
        let clean = raw.trim();
        if (clean.startsWith('```')) clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        techData = JSON.parse(clean);
        break;
      } catch (err) {
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    // Fallback tech data if LLM fails
    if (!techData) {
      techData = {
        trdMarkdown: `# TRD — ${projectName}\n\n## System Architecture\nTauri v2 (Rust shell) wrapping React 18 + Vite SPA. SQLite via @tauri-apps/plugin-sql for local persistence. Multi-LLM fallback for AI tasks.\n\n## Data Flow\nUI → Worker → LLM → SQLite → Approval Gate → Owner\n\n## Security\n- API keys stored in SQLite (encrypted at app level)\n- No external data transmission without owner consent\n- Tauri IPC for native file operations\n\n## Deployment\nLocal desktop install via Tauri .deb/.AppImage bundle.`,
        architectureDiagram: `
┌─────────────────────────────────────────────────┐
│                 MABISHION AI                     │
│           (Tauri v2 Desktop Shell)               │
├───────────────────┬─────────────────────────────┤
│   React 18 + Vite │    SQLite (mabishion.db)     │
│   Tailwind CSS    │  projects | leads | approvals│
│   Zustand State   │  payments | workers | logs   │
├───────────────────┴─────────────────────────────┤
│              Worker Pipeline Engine              │
│  lead_gen → analyst → proposal → payment        │
│  self_promo → social → showcase → blueprint     │
├─────────────────────────────────────────────────┤
│           Multi-LLM Fallback Chain               │
│  Gemini 2.5 → Groq → Cerebras → OpenRouter      │
│                    → Ollama (offline)            │
└─────────────────────────────────────────────────┘`,
        techStack: {
          frontend: ['React 18', 'Vite 5', 'Tailwind CSS 3', 'Zustand', 'React Router 6', 'Recharts', 'React Flow'],
          backend:  ['Tauri v2 (Rust)', '@tauri-apps/plugin-sql', 'node-cron (JS cron)', 'jsPDF', 'JSZip'],
          database: ['SQLite (mabishion.db)', 'tauri-plugin-sql v2'],
          devops:   ['Tauri build system', '.deb/.AppImage packaging', 'Vite production build'],
          ai:       ['Google Gemini 2.5 Flash', 'Groq Llama 3.3 70B', 'Cerebras Llama 3.3', 'OpenRouter', 'Ollama Gemma 3 4B']
        },
        databaseSchema: `-- Core Tables\nCREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, client_name TEXT, type TEXT, stage TEXT, progress INTEGER DEFAULT 0, health TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, source TEXT, status TEXT, score INTEGER DEFAULT 0, budget TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, title TEXT, type TEXT, project_id TEXT, worker_name TEXT, request_data TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP, expires_at TEXT);\nCREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, project_id TEXT, client_name TEXT, invoice_number TEXT, milestone TEXT, amount REAL, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS worker_logs (id TEXT PRIMARY KEY, worker_name TEXT, status TEXT, input_data TEXT, output_data TEXT, error_message TEXT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);`,
        apiEndpoints: [
          { method: 'GET',    path: '/api/projects',         description: 'List all projects',            auth: true  },
          { method: 'POST',   path: '/api/projects',         description: 'Create new project',           auth: true  },
          { method: 'GET',    path: '/api/leads',            description: 'List all leads with filters',  auth: true  },
          { method: 'POST',   path: '/api/leads',            description: 'Create new lead',              auth: true  },
          { method: 'GET',    path: '/api/approvals',        description: 'Get pending approvals',        auth: true  },
          { method: 'POST',   path: '/api/approvals/:id',    description: 'Approve/reject/change',        auth: true  },
          { method: 'POST',   path: '/api/workers/run',      description: 'Trigger worker execution',     auth: true  },
          { method: 'GET',    path: '/api/payments',         description: 'List payment records',         auth: true  },
          { method: 'GET',    path: '/api/dashboard/stats',  description: 'Dashboard KPI metrics',        auth: true  },
          { method: 'POST',   path: '/api/settings/llm',     description: 'Save LLM API keys',            auth: true  },
        ],
        securityChecklist: [
          'API keys stored only in SQLite — never in frontend JS',
          'Tauri IPC used for all native file operations',
          'No external API calls without owner-set keys',
          'All payment actions require CRITICAL approval gate',
          'Worker logs track all LLM calls with timestamps',
          'No client data transmitted without explicit owner action',
          'SQLite backup/restore available from Settings screen',
        ],
        deploymentSteps: [
          'Run: npm run build (Vite production bundle)',
          'Run: npx tauri build (native binary compilation)',
          'Output: src-tauri/target/release/bundle/deb/mabishion-ai.deb',
          'Install: sudo dpkg -i mabishion-ai.deb',
          'Launch: mabishion-ai from Applications or terminal',
          'First Run: App auto-creates mabishion.db in app data directory',
          'Configure: Add LLM API keys in Settings screen',
        ]
      };
    }

    // ── 5. Ensure blueprints table ────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS blueprints (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        prd_text TEXT,
        trd_text TEXT,
        architecture_diagram TEXT,
        tech_stack_json TEXT,
        database_schema TEXT,
        api_endpoints_json TEXT,
        security_checklist TEXT,
        deployment_steps TEXT,
        version INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const blueprintId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO blueprints (id, project_id, prd_text, trd_text, architecture_diagram, tech_stack_json, database_schema, api_endpoints_json, security_checklist, deployment_steps, version, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP)`,
      [
        blueprintId,
        projectId,
        prdText,
        techData.trdMarkdown         || '',
        techData.architectureDiagram || '',
        JSON.stringify(techData.techStack        || {}),
        techData.databaseSchema      || '',
        JSON.stringify(techData.apiEndpoints     || []),
        JSON.stringify(techData.securityChecklist|| []),
        JSON.stringify(techData.deploymentSteps  || []),
        1
      ]
    );

    // Update project stage to Planning
    await db.execute(
      "UPDATE projects SET stage = 'Planning' WHERE id = $1",
      [projectId]
    ).catch(() => {});

    // Create 24h STANDARD approval gate request
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const approvalId = crypto.randomUUID();
    
    await db.execute(
      `INSERT INTO approvals (id, title, type, project_id, worker_name, request_data, status, expires_at, created_at, owner_notified, whatsapp_sent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 0, 0)`,
      [
        approvalId,
        `Technical Architecture Blueprint for "${projectName}"`,
        'standard',
        projectId,
        'Blueprint Maker',
        JSON.stringify({
          blueprintId,
          projectName,
          clientName,
          summary: `PRD: ${prdText.split('\n').length} lines | TRD: ${(techData.trdMarkdown || '').split('\n').length} lines | Schema: ${(techData.databaseSchema || '').split('\n').length} lines`
        }),
        'pending',
        expiresAt
      ]
    ).catch(err => console.error('[BlueprintWorker Approval Insert Err]', err));

    return {
      blueprintId,
      projectName,
      clientName,
      prdText,
      trdMarkdown:         techData.trdMarkdown,
      architectureDiagram: techData.architectureDiagram,
      techStack:           techData.techStack,
      databaseSchema:      techData.databaseSchema,
      apiEndpoints:        techData.apiEndpoints,
      securityChecklist:   techData.securityChecklist,
      deploymentSteps:     techData.deploymentSteps,
      summary: `Blueprint created for ${projectName} | PRD: ${prdText.split('\n').length} lines | ${(techData.apiEndpoints || []).length} API endpoints | ${(techData.securityChecklist || []).length} security checks`,
      approvalId
    };
  }
}
