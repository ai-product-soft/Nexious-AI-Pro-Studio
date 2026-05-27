import { emit } from '@tauri-apps/api/event';

let dbInstance = null;

// Persistent localStorage database simulation to avoid temporary in-memory fallback outside Tauri shell
const savedState = localStorage.getItem('mabishion_local_db');
const developmentPreviewStore = savedState ? JSON.parse(savedState) : {
  projects: [],
  leads: [],
  approvals: [],
  skills: [],
  revenue: [],
  workflows: [],
  workflow_nodes: [],
  workflow_connections: [],
  knowledge_sources: [],
  analyst_reports: [],
  settings: [], // Saved as serializable list of [key, value]
  whatsapp_logs: [],
  action_ledger: [],
  llm_usage: [],
  cron_logs: [],
  worker_logs: []
};

// Map interface for settings
const settingsMap = new Map(
  Array.isArray(developmentPreviewStore.settings)
    ? developmentPreviewStore.settings
    : Object.entries(developmentPreviewStore.settings || {})
);

function saveDevelopmentPreviewDb() {
  developmentPreviewStore.settings = Array.from(settingsMap.entries());
  localStorage.setItem('mabishion_local_db', JSON.stringify(developmentPreviewStore));
}

function createDevelopmentPreviewDb() {
  return {
    execute: async (query, params = []) => {
      const normalized = query.trim().toLowerCase();

      // settings
      if (normalized.startsWith('insert or ignore into settings') || normalized.startsWith('insert or replace into settings')) {
        settingsMap.set(params[0], params[1]);
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Projects
      if (normalized.startsWith('insert into projects')) {
        const [id, name, clientNameOrType, typeOrClient, stage, progress, health] = params;
        const isSeedInsert = params.length >= 7;
        developmentPreviewStore.projects.unshift({
          id,
          name,
          client_name: isSeedInsert ? clientNameOrType : typeOrClient,
          type: isSeedInsert ? typeOrClient : clientNameOrType,
          stage: isSeedInsert ? stage : 'Research',
          progress: isSeedInsert ? progress : 0,
          health: isSeedInsert ? health : 'Stable',
          created_at: new Date().toISOString()
        });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Workflows
      if (normalized.startsWith('insert into workflows')) {
        const [id, name, status, risk, trigger, description] = params;
        developmentPreviewStore.workflows.push({ id, name, status, risk, trigger, description, last_run: 'Never', created_at: new Date().toISOString() });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      if (normalized.startsWith('insert into workflow_nodes')) {
        const [id, workflow_id, label, node_type, worker_name, x_pct, y_pct, config_json] = params;
        developmentPreviewStore.workflow_nodes.push({ id, workflow_id, label, node_type, worker_name, x_pct, y_pct, config_json });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      if (normalized.startsWith('insert into workflow_connections')) {
        const [id, workflow_id, from_node_id, to_node_id, condition_label] = params;
        developmentPreviewStore.workflow_connections.push({ id, workflow_id, from_node_id, to_node_id, condition_label });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Knowledge Base
      if (normalized.startsWith('insert into knowledge_sources')) {
        const [id, title, source_type, source_url, status, notes] = params;
        developmentPreviewStore.knowledge_sources.push({ id, title, source_type, source_url, status, notes, created_at: new Date().toISOString() });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Business analyst
      if (normalized.startsWith('insert into analyst_reports')) {
        const [id, project_id, brief, report_data, risk_score, go_no_go] = params;
        developmentPreviewStore.analyst_reports.push({ id, project_id, brief, report_data, risk_score, go_no_go, created_at: new Date().toISOString() });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Skills
      if (normalized.startsWith('insert into skills')) {
        const [id, name, category, description] = params;
        developmentPreviewStore.skills.push({ id, name, category, description, source: 'System' });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Leads
      if (normalized.startsWith('insert into leads')) {
        let leadObj = {};
        if (params.length === 12) {
          const [id, name, email, phone, source, status, score, budget, notes, created_at, last_contacted] = params;
          leadObj = { id, name, email, phone, source, status, score: Number(score || 0), budget, notes, created_at, last_contacted };
        } else if (params.length === 11) {
          const [id, name, source, value, score, heat, mood, stage, requirement, next_action, ghosting] = params;
          leadObj = { id, name, email: '', phone: '', source, status: stage, score: Number(score || 0), budget: value, notes: requirement, created_at: new Date().toISOString(), last_contacted: new Date().toISOString() };
        } else {
          const [id, name, email, phone, source, status, score, budget, notes, created_at, last_contacted] = params;
          leadObj = { id, name, email, phone, source, status, score: Number(score || 0), budget, notes, created_at, last_contacted };
        }
        developmentPreviewStore.leads.unshift(leadObj);
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Approvals
      if (normalized.startsWith('insert into approvals')) {
        const [id, title, type, project_id, worker_name, request_data, status, created_at, expires_at, owner_notified, whatsapp_sent, owner_notes] = params;
        developmentPreviewStore.approvals.unshift({ id, title, type, project_id, worker_name, request_data, status, created_at, expires_at, owner_notified, whatsapp_sent, owner_notes });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // WhatsApp Logs
      if (normalized.startsWith('insert into whatsapp_logs')) {
        const [id, phone, message, status, attempt, timestamp] = params;
        developmentPreviewStore.whatsapp_logs.push({ id, phone, message, status, attempt, timestamp });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // LLM Usage
      if (normalized.startsWith('insert into llm_usage')) {
        const [id, provider, model, prompt_tokens, completion_tokens, total_tokens, status, timestamp] = params;
        developmentPreviewStore.llm_usage.push({ id, provider, model, prompt_tokens, completion_tokens, total_tokens, status, timestamp });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Cron Logs
      if (normalized.startsWith('insert into cron_logs')) {
        const [id, task_name, status, message, timestamp] = params;
        developmentPreviewStore.cron_logs.push({ id, task_name, status, message, timestamp });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Worker Logs
      if (normalized.startsWith('insert into worker_logs')) {
        const [id, worker_name, status, input_data] = params;
        if (!developmentPreviewStore.worker_logs) {
          developmentPreviewStore.worker_logs = [];
        }
        developmentPreviewStore.worker_logs.unshift({ id, worker_name, status, input_data, timestamp: new Date().toISOString() });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Revenue
      if (normalized.startsWith('insert into revenue')) {
        const [id, project_id, amount, source] = params;
        developmentPreviewStore.revenue.push({ id, project_id, amount, source });
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Updates
      if (normalized.startsWith('update projects')) {
        if (normalized.includes('stage = $1')) {
          const [stage, id] = params;
          const proj = developmentPreviewStore.projects.find(p => p.id === id);
          if (proj) proj.stage = stage;
        } else if (normalized.includes('progress = $1')) {
          const [progress, health, id] = params;
          const proj = developmentPreviewStore.projects.find(p => p.id === id);
          if (proj) {
            proj.progress = progress;
            proj.health = health;
          }
        }
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      if (normalized.startsWith('update leads')) {
        if (normalized.includes('status = $1')) {
          const [status, now, id] = params;
          const lead = developmentPreviewStore.leads.find(l => l.id === id);
          if (lead) {
            lead.status = status;
            lead.last_contacted = now;
          }
        } else if (normalized.includes('score = $1')) {
          const [score, id] = params;
          const lead = developmentPreviewStore.leads.find(l => l.id === id);
          if (lead) lead.score = Number(score || 0);
        } else if (normalized.includes('notes = $1')) {
          const [notes, id] = params;
          const lead = developmentPreviewStore.leads.find(l => l.id === id);
          if (lead) lead.notes = notes;
        }
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      if (normalized.startsWith('update approvals')) {
        if (normalized.includes('status = $1')) {
          const [status, notes, id] = params;
          const app = developmentPreviewStore.approvals.find(a => a.id === id);
          if (app) {
            app.status = status;
            app.owner_notes = notes;
          }
        }
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      if (normalized.startsWith('update worker_logs')) {
        const logId = params[params.length - 1];
        if (!developmentPreviewStore.worker_logs) {
          developmentPreviewStore.worker_logs = [];
        }
        const log = developmentPreviewStore.worker_logs.find(l => l.id === logId);
        if (log) {
          log.status = params[0];
          if (normalized.includes('output_data = $2')) {
            log.output_data = params[1];
          } else if (normalized.includes('error_message = $2')) {
            log.error_message = params[1];
          }
          log.timestamp = new Date().toISOString();
        }
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      // Deletes
      if (normalized.startsWith('delete from leads')) {
        const [id] = params;
        developmentPreviewStore.leads = developmentPreviewStore.leads.filter(l => l.id !== id);
        saveDevelopmentPreviewDb();
        return { rowsAffected: 1 };
      }

      return { rowsAffected: 0 };
    },
    select: async (query, params = []) => {
      const normalized = query.trim().toLowerCase();

      if (normalized.includes('count(*) as count from projects')) return [{ count: developmentPreviewStore.projects.length }];
      if (normalized.includes('count(*) as count from leads')) return [{ count: developmentPreviewStore.leads.length }];
      if (normalized.includes('count(*) as count from skills')) return [{ count: developmentPreviewStore.skills.length }];
      if (normalized.includes('count(*) as count from revenue')) return [{ count: developmentPreviewStore.revenue.length }];
      if (normalized.includes('count(*) as count from workflows')) return [{ count: developmentPreviewStore.workflows.length }];
      if (normalized.includes('count(*) as count from knowledge_sources')) return [{ count: developmentPreviewStore.knowledge_sources.length }];
      if (normalized.startsWith('select * from projects')) return [...developmentPreviewStore.projects];
      if (normalized.startsWith('select * from leads where id =')) {
        const lead = developmentPreviewStore.leads.find(l => l.id === params[0]);
        return lead ? [lead] : [];
      }
      if (normalized.startsWith('select * from leads')) return [...developmentPreviewStore.leads].sort((a, b) => (b.score || 0) - (a.score || 0));
      if (normalized.startsWith('select * from skills')) return [...developmentPreviewStore.skills].sort((a, b) => a.name.localeCompare(b.name));
      if (normalized.startsWith('select * from workflows')) return [...developmentPreviewStore.workflows];
      if (normalized.startsWith('select * from workflow_nodes')) {
        return developmentPreviewStore.workflow_nodes.filter((row) => row.workflow_id === params[0]);
      }
      if (normalized.startsWith('select * from workflow_connections')) {
        return developmentPreviewStore.workflow_connections.filter((row) => row.workflow_id === params[0]);
      }
      if (normalized.startsWith('select * from knowledge_sources')) return [...developmentPreviewStore.knowledge_sources];
      if (normalized.startsWith('select * from analyst_reports')) return [...developmentPreviewStore.analyst_reports];
      if (normalized.startsWith('select * from approvals')) return [...developmentPreviewStore.approvals];
      if (normalized.startsWith('select * from llm_usage')) return [...developmentPreviewStore.llm_usage].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      if (normalized.startsWith('select * from cron_logs')) return [...developmentPreviewStore.cron_logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      if (normalized.startsWith('select * from worker_logs')) {
        if (!developmentPreviewStore.worker_logs) {
          developmentPreviewStore.worker_logs = [];
        }
        return [...developmentPreviewStore.worker_logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      }
      if (normalized.startsWith('select sum(amount) as total from revenue')) {
        return [{ total: developmentPreviewStore.revenue.reduce((sum, row) => sum + Number(row.amount || 0), 0) }];
      }
      if (normalized.startsWith('select value from settings')) {
        const value = settingsMap.get(params[0]);
        return value ? [{ value }] : [];
      }
      if (normalized.startsWith('select key, substr(value')) {
        return [...settingsMap.entries()].map(([key, value]) => ({ key, preview: String(value).slice(0, 8) }));
      }
      if (normalized.includes('count(*)')) return [{ count: 0 }];
      return [];
    },
    close: async () => true
  };
}

export async function getDb() {
  if (!dbInstance) {
    if (window.__TAURI_INTERNALS__) {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      dbInstance = await Database.load('sqlite:mabishion.db');
    } else {
      console.warn("Running outside the desktop shell: using temporary development preview storage.");
      dbInstance = createDevelopmentPreviewDb();
    }
  }
  return dbInstance;
}

export async function initDb() {
  const db = await getDb();
  
  // 1. Projects Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      client_name TEXT,
      type TEXT,
      stage TEXT DEFAULT 'Research',
      progress INTEGER DEFAULT 0,
      health TEXT DEFAULT 'Stable',
      due_date TEXT,
      data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Leads Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      source TEXT,
      status TEXT DEFAULT 'New',
      score INTEGER DEFAULT 0,
      budget TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_contacted TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe migration checks for columns in case table was created previously with older schema
  try {
    await db.execute(`ALTER TABLE leads ADD COLUMN email TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE leads ADD COLUMN phone TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE leads ADD COLUMN status TEXT DEFAULT 'New';`).catch(() => {});
    await db.execute(`ALTER TABLE leads ADD COLUMN budget TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE leads ADD COLUMN notes TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE leads ADD COLUMN last_contacted TEXT DEFAULT CURRENT_TIMESTAMP;`).catch(() => {});
  } catch (err) {
    console.warn("[Mickii DB] Leads table schema migration handled:", err);
  }

  // 3. Approvals Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      title TEXT,
      type TEXT DEFAULT 'standard',
      project_id TEXT,
      worker_name TEXT,
      request_data TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      owner_notified INTEGER DEFAULT 0,
      whatsapp_sent INTEGER DEFAULT 0,
      owner_notes TEXT
    );
  `);

  // Safe migration checks for approvals table
  try {
    await db.execute(`ALTER TABLE approvals ADD COLUMN title TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN type TEXT DEFAULT 'standard';`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN project_id TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN worker_name TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN request_data TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN expires_at TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN owner_notified INTEGER DEFAULT 0;`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN whatsapp_sent INTEGER DEFAULT 0;`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN owner_notes TEXT;`).catch(() => {});
    await db.execute(`ALTER TABLE approvals ADD COLUMN created_at TEXT;`).catch(() => {});
  } catch (err) {
    console.warn("[Mickii DB] Approvals table column migrations handled:", err);
  }

  // 3.5. WhatsApp Outbound Logs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id TEXT PRIMARY KEY,
      phone TEXT,
      message TEXT,
      status TEXT DEFAULT 'sent',
      attempt INTEGER DEFAULT 1,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Action Ledger
  await db.execute(`
    CREATE TABLE IF NOT EXISTS action_ledger (
      id TEXT PRIMARY KEY,
      action_type TEXT,
      decision TEXT,
      risk_level TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      rollback_data TEXT
    );
  `);

  // 5. Skills Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      description TEXT,
      source TEXT DEFAULT 'System',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Knowledge Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      topic TEXT,
      content TEXT,
      confidence INTEGER DEFAULT 100,
      last_verified TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default skills if empty
  const skillCount = await db.select('SELECT count(*) as count FROM skills');
  if (skillCount && skillCount[0] && skillCount[0].count === 0) {
    const defaultSkills = [
      ['skill-code', 'Code Tool', 'Tools', 'Writes and executes code snippets.'],
      ['skill-design', 'Design Tool', 'Tools', 'Generates UI/UX components.'],
      ['skill-plan', 'Plan Tool', 'Workflow', 'Creates step-by-step project plans.'],
      ['skill-research', 'Research Tool', 'Tools', 'Scrapes web and searches documents.'],
      ['skill-write', 'Write Tool', 'Tools', 'Drafts emails, proposals, and content.']
    ];
    
    for (const [id, name, cat, desc] of defaultSkills) {
      await db.execute(
        'INSERT INTO skills (id, name, category, description) VALUES ($1, $2, $3, $4)',
        [id, name, cat, desc]
      );
    }
  }

  // Seed default projects if empty
  const projectCount = await db.select('SELECT count(*) as count FROM projects');
  if (projectCount && projectCount[0] && projectCount[0].count === 0) {
    const testProjects = [
      ['p1', 'AI Crypto Bot', 'Nexus Ventures', 'Landing Page', 'Research', 25, 'Stable'],
      ['p2', 'SaaS Lead Scraper', 'Growth Labs', 'Dashboard', 'Design', 45, 'At Risk'],
      ['p3', 'AI Voice Assistant', 'Echo Media', 'Marketing Portfolio', 'Build', 80, 'Stable']
    ];
    for (const [id, name, client, type, stage, prog, health] of testProjects) {
      await db.execute(
        'INSERT INTO projects (id, name, client_name, type, stage, progress, health) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, name, client, type, stage, prog, health]
      );
    }
  }

  // Seed default lead if empty
  const leadCount = await db.select('SELECT count(*) as count FROM leads');
  if (leadCount && leadCount[0] && leadCount[0].count === 0) {
    await db.execute(
      "INSERT INTO leads (id, name, email, phone, source, status, score, budget, notes, created_at, last_contacted) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
      ['l1', 'Sam Altman (Demo)', 'sam@openai.com', '+1-555-0100', 'LinkedIn', 'Negotiating', 95, '$10,000+', JSON.stringify([{id: crypto.randomUUID(), text: 'Custom AI Studio for internal tools', timestamp: new Date().toISOString(), type: 'system'}]), new Date().toISOString(), new Date().toISOString()]
    );
  }

  // 7. Settings Table (For API Keys)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed API Keys (Placeholders ONLY)
  await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES ($1, $2)', ['openrouter_api_key', 'PASTE_YOUR_OPENROUTER_KEY_HERE']);
  await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES ($1, $2)', ['serper_api_key', 'PASTE_YOUR_SERPER_KEY_HERE']);
  await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES ($1, $2)', ['exa_api_key', 'PASTE_YOUR_EXA_KEY_HERE']);
  await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES ($1, $2)', ['groq_api_key', 'PASTE_YOUR_GROQ_KEY_HERE']);
  await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES ($1, $2)', ['cerebras_api_key', 'PASTE_YOUR_CEREBRAS_KEY_HERE']);

  // 8. Revenue Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS revenue (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      amount REAL,
      source TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed Revenue if empty
  const revCount = await db.select('SELECT count(*) as count FROM revenue');
  if (revCount && revCount[0] && revCount[0].count === 0) {
    await db.execute(
      'INSERT INTO revenue (id, project_id, amount, source) VALUES ($1, $2, $3, $4)',
      ['rev1', 'p1', 500.0, 'Subscription']
    );
  }

  // 9. Project Memory Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS project_memory (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      observation TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10. Search Failures Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS search_failures (
      id TEXT PRIMARY KEY,
      query TEXT,
      error TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10.5. LLM Usage Tracker Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS llm_usage (
      id TEXT PRIMARY KEY,
      provider TEXT,
      model TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      status TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10.6. Cron Log Tracker Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cron_logs (
      id TEXT PRIMARY KEY,
      task_name TEXT,
      status TEXT,
      message TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Workflow Builder Tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT,
      status TEXT DEFAULT 'Draft',
      risk TEXT DEFAULT 'Medium',
      trigger TEXT,
      description TEXT,
      last_run TEXT DEFAULT 'Never',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS workflow_nodes (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      label TEXT,
      node_type TEXT,
      worker_name TEXT,
      x_pct REAL,
      y_pct REAL,
      config_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS workflow_connections (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      from_node_id TEXT,
      to_node_id TEXT,
      condition_label TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 12. Knowledge Base / Context Connector
  await db.execute(`
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      title TEXT,
      source_type TEXT,
      source_url TEXT,
      status TEXT DEFAULT 'Queued',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 13. Analyst Reports (Business Analyst Worker Output)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS analyst_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      brief TEXT,
      report_data TEXT,
      risk_score INTEGER DEFAULT 5,
      go_no_go TEXT DEFAULT 'Caution',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add mega_link to projects safely
  try {
    await db.execute("ALTER TABLE projects ADD COLUMN mega_link TEXT");
  } catch (e) {
    // Column already exists
  }

  // Seed the owner-facing v4 workflow once.
  const workflowCount = await db.select('SELECT count(*) as count FROM workflows');
  if (workflowCount && workflowCount[0] && workflowCount[0].count === 0) {
    const workflowId = 'wf-agency-v4';
    await db.execute(
      'INSERT INTO workflows (id, name, status, risk, trigger, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [workflowId, 'Agency Product Pipeline v4', 'Draft', 'High', 'New client intake form', 'Intake -> Analyze -> Build -> Deliver with approval gates.']
    );

    const nodes = [
      ['node-intake', 'Client Intake', 'Trigger', 'client_intake', 12, 46, '{"stage":"Intake"}'],
      ['node-analyze', 'Business Analysis', 'Worker', 'business_analyst', 30, 46, '{"stage":"Analyze","uses_knowledge_base":true}'],
      ['node-approval-analysis', 'Approve Analysis', 'Approval', 'approval_queue', 45, 28, '{"severity":"standard"}'],
      ['node-docs', 'Docs + Blueprint', 'Worker', 'documentor', 58, 46, '{"stage":"Build Planning","internal_only":true}'],
      ['node-dev', 'Developer Worker', 'Worker', 'developer', 72, 46, '{"stage":"Build"}'],
      ['node-deliver-approval', 'Approve Delivery', 'Approval', 'approval_queue', 86, 28, '{"severity":"critical"}'],
      ['node-deliver', 'Package + Deliver', 'Worker', 'packager', 88, 66, '{"stage":"Deliver"}']
    ];

    for (const node of nodes) {
      await db.execute(
        'INSERT INTO workflow_nodes (id, workflow_id, label, node_type, worker_name, x_pct, y_pct, config_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [node[0], workflowId, node[1], node[2], node[3], node[4], node[5], node[6]]
      );
    }

    const connections = [
      ['conn-1', 'node-intake', 'node-analyze', 'form submitted'],
      ['conn-2', 'node-analyze', 'node-approval-analysis', 'report ready'],
      ['conn-3', 'node-approval-analysis', 'node-docs', 'approved'],
      ['conn-4', 'node-docs', 'node-dev', 'internal blueprint ready'],
      ['conn-5', 'node-dev', 'node-deliver-approval', 'tests pass'],
      ['conn-6', 'node-deliver-approval', 'node-deliver', 'payment confirmed']
    ];

    for (const connection of connections) {
      await db.execute(
        'INSERT INTO workflow_connections (id, workflow_id, from_node_id, to_node_id, condition_label) VALUES ($1, $2, $3, $4, $5)',
        [connection[0], workflowId, connection[1], connection[2], connection[3]]
      );
    }
  }

  const knowledgeCount = await db.select('SELECT count(*) as count FROM knowledge_sources');
  if (knowledgeCount && knowledgeCount[0] && knowledgeCount[0].count === 0) {
    await db.execute(
      'INSERT INTO knowledge_sources (id, title, source_type, source_url, status, notes) VALUES ($1, $2, $3, $4, $5, $6)',
      ['kb-client-website', 'Client Website URL', 'URL', '', 'Template', 'Business analyst will scrape and summarize client website context here.']
    );
  }

  console.log("Database initialized successfully!");
}

export async function addRevenue(projectId, amount, source) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    'INSERT INTO revenue (id, project_id, amount, source) VALUES ($1, $2, $3, $4)',
    [id, projectId, amount, source]
  );
  return id;
}

export async function getTotalRevenue() {
  const db = await getDb();
  const res = await db.select('SELECT SUM(amount) as total FROM revenue');
  return res[0]?.total || 0;
}

// Settings Helpers
export async function getSetting(key) {
  const db = await getDb();
  const res = await db.select('SELECT value FROM settings WHERE key = $1', [key]);
  return res.length > 0 ? res[0].value : null;
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.execute(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
    [key, value]
  );
}

// Debug helper — dumps every key in the settings table (values truncated to 8 chars for safety)
export async function getAllSettings() {
  const db = await getDb();
  const rows = await db.select('SELECT key, substr(value, 1, 8) as preview FROM settings');
  return rows; // [{key, preview}, ...]
}

// Data Fetching Functions
export async function getProjects() {
  const db = await getDb();
  return await db.select('SELECT * FROM projects ORDER BY created_at DESC');
}

export async function getLeads() {
  const db = await getDb();
  return await db.select('SELECT * FROM leads ORDER BY score DESC');
}

export async function getSkills() {
  const db = await getDb();
  return await db.select('SELECT * FROM skills ORDER BY name ASC');
}

export async function getPendingApprovals() {
  const db = await getDb();
  return await db.select("SELECT * FROM approvals WHERE status = 'pending' OR status = 'Pending' ORDER BY created_at DESC");
}

export async function addApproval(preview, action_type, context, source, risk_level) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // Safe backward compatibility mapping
  await db.execute(
    `INSERT INTO approvals (id, title, type, project_id, worker_name, request_data, status, expires_at, owner_notified, whatsapp_sent, owner_notes) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, preview, risk_level === 'High' ? 'critical' : 'standard', '', action_type, JSON.stringify({ context, source }), 'pending', now, 0, 0, '']
  );
  return id;
}

export async function approveAction(id) {
  const db = await getDb();
  await db.execute("UPDATE approvals SET status = 'approved', owner_notes = 'Approved via Legacy API' WHERE id = $1", [id]);
  const rows = await db.select("SELECT * FROM approvals WHERE id = $1", [id]);
  if (rows[0]) {
    await db.execute(
      'INSERT INTO action_ledger (id, action_type, decision, risk_level) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), rows[0].title || rows[0].worker_name, 'YES', rows[0].type === 'critical' ? 'High' : 'Standard']
    );
  }
  await emit('approval_granted', { approvalId: id, decision: 'Approved' });
}

export async function rejectAction(id) {
  const db = await getDb();
  await db.execute("UPDATE approvals SET status = 'rejected', owner_notes = 'Rejected via Legacy API' WHERE id = $1", [id]);
  await emit('approval_granted', { approvalId: id, decision: 'Rejected' });
}

export async function getApprovals() {
  const db = await getDb();
  return await db.select("SELECT * FROM approvals ORDER BY created_at DESC");
}

export async function getApprovalById(id) {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM approvals WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function addApprovalExtended(title, type, projectId, workerName, requestData, expiresAt) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO approvals (id, title, type, project_id, worker_name, request_data, status, expires_at, owner_notified, whatsapp_sent, owner_notes) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, title, type, projectId, workerName, JSON.stringify(requestData), 'pending', expiresAt, 0, 0, '']
  );
  return id;
}

export async function updateApprovalStatus(id, status, notes = '') {
  const db = await getDb();
  await db.execute(
    "UPDATE approvals SET status = $1, owner_notes = $2 WHERE id = $3",
    [status, notes, id]
  );
  
  // If approved or rejected, log in action ledger
  if (status === 'approved' || status === 'rejected' || status === 'Approved' || status === 'Rejected') {
    const rows = await db.select("SELECT * FROM approvals WHERE id = $1", [id]);
    if (rows[0]) {
      await db.execute(
        'INSERT INTO action_ledger (id, action_type, decision, risk_level) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), rows[0].title || rows[0].worker_name, (status.toLowerCase() === 'approved') ? 'YES' : 'NO', rows[0].type === 'critical' ? 'High' : 'Standard']
      );
    }
    await emit('approval_granted', { approvalId: id, decision: status });
  }
}

export async function setApprovalWhatsAppSent(id) {
  const db = await getDb();
  await db.execute("UPDATE approvals SET whatsapp_sent = 1 WHERE id = $1", [id]);
}

export async function getWhatsAppLogs() {
  const db = await getDb();
  return await db.select("SELECT * FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 50");
}

export async function logWhatsAppAttempt(phone, message, status, attempt = 1) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO whatsapp_logs (id, phone, message, status, attempt, timestamp) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, phone, message, status, attempt, now]
  );
  return id;
}

export async function addProject(name, type, clientName) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO projects (id, name, type, client_name, stage, progress, health) VALUES ($1, $2, $3, $4, 'Research', 0, 'Stable')",
    [id, name, type || 'Internal Product', clientName || 'Internal']
  );
  return id;
}

export async function addLead(name, emailOrSource, phoneOrValue, sourceOrRequirement, status, score, budget, notes) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  let finalName = name;
  let finalEmail = '';
  let finalPhone = '';
  let finalSource = 'Manual';
  let finalStatus = 'New';
  let finalScore = 50;
  let finalBudget = '$1,000 - $5,000';
  let finalNotes = '';

  if (arguments.length <= 4) {
    // Old signature fallback: addLead(name, source, value, requirement)
    finalSource = emailOrSource || 'Manual';
    finalBudget = phoneOrValue || 'Flexible';
    finalNotes = JSON.stringify([{ id: crypto.randomUUID(), text: sourceOrRequirement || 'Captured manually.', timestamp: now, type: 'system' }]);
  } else {
    // New signature
    finalEmail = emailOrSource || '';
    finalPhone = phoneOrValue || '';
    finalSource = sourceOrRequirement || 'Manual';
    finalStatus = status || 'New';
    finalScore = Number(score || 50);
    finalBudget = budget || 'Flexible';
    finalNotes = notes || '';
  }

  await db.execute(
    `INSERT INTO leads (id, name, email, phone, source, status, score, budget, notes, created_at, last_contacted) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, finalName, finalEmail, finalPhone, finalSource, finalStatus, finalScore, finalBudget, finalNotes, now, now]
  );
  return id;
}

export async function addProjectMemory(projectId, observation) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    'INSERT INTO project_memory (id, project_id, observation) VALUES ($1, $2, $3)',
    [id, projectId, observation]
  );
  return id;
}

export async function getProjectMemory(projectId, limit = 5) {
  const db = await getDb();
  // We order by timestamp DESC to get the latest, then reverse so they are chronological
  const rows = await db.select(
    'SELECT observation FROM project_memory WHERE project_id = $1 ORDER BY timestamp DESC LIMIT $2',
    [projectId, limit]
  );
  return rows.reverse();
}

export async function logSearchFailure(query, error) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    'INSERT INTO search_failures (id, query, error) VALUES ($1, $2, $3)',
    [id, query, error]
  );
  return id;
}

export async function updateProjectMegaLink(projectId, link) {
  const db = await getDb();
  await db.execute('UPDATE projects SET mega_link = $1 WHERE id = $2', [link, projectId]);
}

export async function getWorkflows() {
  const db = await getDb();
  return await db.select('SELECT * FROM workflows ORDER BY created_at DESC');
}

export async function getWorkflowGraph(workflowId) {
  const db = await getDb();
  const nodes = await db.select('SELECT * FROM workflow_nodes WHERE workflow_id = $1 ORDER BY created_at ASC', [workflowId]);
  const connections = await db.select('SELECT * FROM workflow_connections WHERE workflow_id = $1 ORDER BY created_at ASC', [workflowId]);
  return { nodes, connections };
}

export async function getKnowledgeSources() {
  const db = await getDb();
  return await db.select('SELECT * FROM knowledge_sources ORDER BY created_at DESC');
}

export async function addKnowledgeSource(title, sourceType, sourceUrl, notes = '') {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    'INSERT INTO knowledge_sources (id, title, source_type, source_url, status, notes) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, title, sourceType, sourceUrl, 'Queued', notes]
  );
  return id;
}

export async function getAnalystReports(projectId = null) {
  const db = await getDb();
  if (projectId) {
    return await db.select('SELECT * FROM analyst_reports WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
  }
  return await db.select('SELECT * FROM analyst_reports ORDER BY created_at DESC');
}

export async function getAnalystReport(id) {
  const db = await getDb();
  const rows = await db.select('SELECT * FROM analyst_reports WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateProjectStage(id, stage) {
  const db = await getDb();
  await db.execute('UPDATE projects SET stage = $1 WHERE id = $2', [stage, id]);
}

export async function updateProjectProgress(id, progress, health) {
  const db = await getDb();
  await db.execute('UPDATE projects SET progress = $1, health = $2 WHERE id = $3', [progress, health, id]);
}

export async function getLeadById(id) {
  const db = await getDb();
  const rows = await db.select('SELECT * FROM leads WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateLeadStatus(id, status) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute('UPDATE leads SET status = $1, last_contacted = $2 WHERE id = $3', [status, now, id]);
}

export async function updateLeadScore(id, score) {
  const db = await getDb();
  await db.execute('UPDATE leads SET score = $1 WHERE id = $2', [Number(score || 0), id]);
}

export async function updateLeadNotes(id, notes) {
  const db = await getDb();
  await db.execute('UPDATE leads SET notes = $1 WHERE id = $2', [notes, id]);
}

export async function deleteLead(id) {
  const db = await getDb();
  await db.execute('DELETE FROM leads WHERE id = $1', [id]);
}

export async function executeTransaction(queries) {
  const db = await getDb();
  if (!window.__TAURI_INTERNALS__) {
    // In local storage preview we copy state, execute queries, and restore state upon failure
    const backup = JSON.stringify(developmentPreviewStore);
    try {
      for (const q of queries) {
        await db.execute(q.query, q.params || []);
      }
      return { success: true };
    } catch (e) {
      const parsed = JSON.parse(backup);
      Object.assign(developmentPreviewStore, parsed);
      saveDevelopmentPreviewDb();
      throw e;
    }
  }

  try {
    await db.execute('BEGIN TRANSACTION');
    for (const q of queries) {
      await db.execute(q.query, q.params || []);
    }
    await db.execute('COMMIT');
    return { success: true };
  } catch (e) {
    try {
      await db.execute('ROLLBACK');
    } catch (_) {}
    throw e;
  }
}

export async function backupDatabase() {
  const db = await getDb();
  const tables = [
    'projects', 'leads', 'approvals', 'skills', 'revenue',
    'workflows', 'workflow_nodes', 'workflow_connections',
    'knowledge_sources', 'analyst_reports', 'settings',
    'whatsapp_logs', 'action_ledger', 'llm_usage', 'cron_logs'
  ];
  
  const backupData = {};
  for (const table of tables) {
    try {
      backupData[table] = await db.select(`SELECT * FROM ${table}`);
    } catch (e) {
      backupData[table] = [];
    }
  }
  return JSON.stringify(backupData, null, 2);
}

export async function restoreDatabase(jsonString) {
  const db = await getDb();
  const backupData = JSON.parse(jsonString);
  const tables = Object.keys(backupData);

  const txQueries = [];
  for (const table of tables) {
    txQueries.push({ query: `DELETE FROM ${table}`, params: [] });
    const rows = backupData[table] || [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const cols = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const vals = keys.map(k => row[k]);
      txQueries.push({
        query: `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
        params: vals
      });
    }
  }
  
  await executeTransaction(txQueries);
  
  if (!window.__TAURI_INTERNALS__) {
    // Re-seed settings Map in non-Tauri mode
    const settingsList = backupData.settings || [];
    settingsMap.clear();
    for (const item of settingsList) {
      // item might be of form [key, value] or {key, value}
      if (Array.isArray(item)) {
        settingsMap.set(item[0], item[1]);
      } else if (item && typeof item === 'object') {
        settingsMap.set(item.key, item.value);
      }
    }
    saveDevelopmentPreviewDb();
  }
  return true;
}

export async function logLlmUsage(provider, model, promptTokens, completionTokens, totalTokens, status) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  await db.execute(
    'INSERT INTO llm_usage (id, provider, model, prompt_tokens, completion_tokens, total_tokens, status, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, provider, model, Number(promptTokens || 0), Number(completionTokens || 0), Number(totalTokens || 0), status, timestamp]
  );
  return id;
}

export async function getLlmUsage() {
  const db = await getDb();
  return await db.select('SELECT * FROM llm_usage ORDER BY timestamp DESC');
}

export async function logCronExecution(taskName, status, message) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  await db.execute(
    'INSERT INTO cron_logs (id, task_name, status, message, timestamp) VALUES ($1, $2, $3, $4, $5)',
    [id, taskName, status, message, timestamp]
  );
  return id;
}

export async function getCronLogs() {
  const db = await getDb();
  return await db.select('SELECT * FROM cron_logs ORDER BY timestamp DESC');
}

export async function getWorkerLogs() {
  const db = await getDb();
  return await db.select('SELECT * FROM worker_logs ORDER BY timestamp DESC');
}
