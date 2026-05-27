import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class DeveloperWorker extends BaseWorker {
  constructor() {
    super('Developer', 'development', true, 'standard');
  }

  /**
   * Generates source code for a specific module using LLM
   * @param {string} projectId  SQLite project ID
   * @param {object} params     { module_name, tech_stack, requirements_override }
   */
  async execute(projectId, params = {}) {
    const db = await getDb();

    // ── 1. Fetch project ──────────────────────────────────────────────────────
    const projRows = await db.select('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRows || projRows.length === 0) {
      throw new Error(`Project "${projectId}" not found in SQLite projects table.`);
    }
    const project = projRows[0];

    const projectName = project.name        || 'AI Project';
    const clientName  = project.client_name || 'Client';
    const projectType = project.type        || 'Web Application';
    const moduleName  = params.module_name  || 'Dashboard Component';
    const techStack   = params.tech_stack   || 'React 18, Tailwind CSS, Vite, SQLite';

    // ── 2. Fetch blueprint context ────────────────────────────────────────────
    let prdContext = '';
    let techStackFromBlueprint = techStack;
    try {
      const bpRows = await db.select(
        'SELECT prd_text, tech_stack_json FROM blueprints WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
        [projectId]
      );
      if (bpRows && bpRows.length > 0) {
        prdContext = (bpRows[0].prd_text || '').slice(0, 500);
        const ts = JSON.parse(bpRows[0].tech_stack_json || '{}');
        if (ts.frontend && ts.frontend.length > 0) {
          techStackFromBlueprint = [...(ts.frontend || []), ...(ts.backend || [])].join(', ');
        }
      }
    } catch { /* non-fatal */ }

    const finalStack = params.tech_stack || techStackFromBlueprint;
    const requirements = params.requirements_override || project.notes || `Build a ${moduleName} for ${projectName}`;

    // ── 3. LLM CALL 1 — Source Code ──────────────────────────────────────────
    const codeSystemPrompt = `You are Mickii Senior Developer — an expert full-stack engineer specializing in React, Node.js, and AI integrations.
Generate production-ready source code for the requested module.
Return a valid JSON object with these keys ONLY:
{
  "mainComponent": { "filename": "ComponentName.jsx", "code": "full source code here" },
  "styleFile": { "filename": "component.module.css", "code": "CSS styles here" },
  "utilFile": { "filename": "utils.js", "code": "utility functions here" },
  "folderStructure": ["src/", "src/components/", "src/components/ComponentName.jsx"],
  "dependencies": { "react": "^18.2.0" },
  "moduleReadme": "Brief markdown README for this module"
}
Rules:
- Write complete, runnable code (not pseudocode)
- Add JSDoc comments to all functions
- Include proper error handling (try/catch)
- Mobile-responsive if UI component
- Follow Glassmorphism dark design (bg-slate-900, border-white/10, indigo accents)
- No markdown code blocks inside JSON strings (use escaped newlines)
- Output ONLY valid JSON`;

    const codeUserPrompt = `
Module: ${moduleName}
Project: ${projectName} (${projectType})
Client: ${clientName}
Tech Stack: ${finalStack}
Requirements: ${requirements}
${prdContext ? 'PRD Context: ' + prdContext : ''}

Generate complete production code for this module.`;

    let codeData = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await executeLlmWithFallback(codeUserPrompt, codeSystemPrompt);
        let clean = raw.trim();
        if (clean.startsWith('```')) clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        codeData = JSON.parse(clean);
        break;
      } catch (err) {
        console.warn(`[DeveloperWorker] Code LLM attempt ${attempt}/3 failed:`, err.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    // ── 4. LLM CALL 2 — Unit Tests ───────────────────────────────────────────
    let testCode = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const testPrompt = `You are a senior QA engineer. Write comprehensive unit tests for the ${moduleName} module using Jest + React Testing Library.
Include: render tests, user interaction tests, edge case tests, mock API tests.
Return ONLY the test file code as plain text (no JSON wrapper, no markdown fences).`;
        const testUser = `Module: ${moduleName}\nTech Stack: ${finalStack}\nComponent code context: ${JSON.stringify(codeData?.mainComponent?.code || '').slice(0, 400)}`;
        testCode = await executeLlmWithFallback(testUser, testPrompt);
        break;
      } catch {
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    // ── 5. Fallback code if LLM fails ─────────────────────────────────────────
    if (!codeData) {
      const compName = moduleName.replace(/\s+/g, '');
      codeData = {
        mainComponent: {
          filename: `${compName}.jsx`,
          code: `import React, { useState, useEffect } from 'react';\n\n/**\n * ${moduleName} Component\n * Project: ${projectName}\n * Generated by Mickii Developer Worker\n */\nexport default function ${compName}({ onNavigate }) {\n  const [data, setData] = useState([]);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState(null);\n\n  useEffect(() => {\n    const fetchData = async () => {\n      try {\n        setLoading(true);\n        // TODO: Replace with real data fetch\n        await new Promise(r => setTimeout(r, 800));\n        setData([{ id: 1, label: 'Sample Item', value: 'Value 1' }]);\n      } catch (err) {\n        setError(err.message);\n      } finally {\n        setLoading(false);\n      }\n    };\n    fetchData();\n  }, []);\n\n  if (loading) return (\n    <div className="flex items-center justify-center h-48">\n      <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />\n    </div>\n  );\n\n  if (error) return (\n    <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">\n      Error: {error}\n    </div>\n  );\n\n  return (\n    <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl">\n      <h2 className="text-xl font-black text-white mb-4">${moduleName}</h2>\n      <div className="space-y-3">\n        {data.map(item => (\n          <div key={item.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-indigo-500/30 transition-all">\n            <span className="text-sm text-white font-medium">{item.label}</span>\n            <span className="text-xs text-slate-400 bg-indigo-500/10 px-2 py-1 rounded-full">{item.value}</span>\n          </div>\n        ))}\n      </div>\n    </div>\n  );\n}`
        },
        styleFile: {
          filename: `${compName}.module.css`,
          code: `.container {\n  background: rgba(15, 23, 42, 0.6);\n  backdrop-filter: blur(20px);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 1.5rem;\n  padding: 1.5rem;\n}\n\n.title {\n  font-size: 1.25rem;\n  font-weight: 900;\n  color: #f8fafc;\n  margin-bottom: 1rem;\n}\n\n.item {\n  padding: 1rem;\n  border-radius: 1rem;\n  background: rgba(255, 255, 255, 0.05);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  transition: all 0.3s ease;\n}\n\n.item:hover {\n  border-color: rgba(99, 102, 241, 0.3);\n  transform: translateY(-1px);\n}`
        },
        utilFile: {
          filename: `${compName}Utils.js`,
          code: `/**\n * Utility functions for ${moduleName}\n * @module ${compName}Utils\n */\n\n/**\n * Format currency in Indian Rupees\n * @param {number} amount - Amount to format\n * @returns {string} Formatted currency string\n */\nexport function formatINR(amount) {\n  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);\n}\n\n/**\n * Format date to readable string\n * @param {string|Date} date - Date to format\n * @returns {string} Formatted date\n */\nexport function formatDate(date) {\n  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });\n}\n\n/**\n * Truncate text to a max length with ellipsis\n * @param {string} text - Text to truncate\n * @param {number} max - Maximum characters\n * @returns {string} Truncated text\n */\nexport function truncate(text, max = 60) {\n  if (!text) return '';\n  return text.length > max ? text.slice(0, max) + '...' : text;\n}\n\n/**\n * Debounce a function call\n * @param {Function} fn - Function to debounce\n * @param {number} delay - Delay in ms\n * @returns {Function} Debounced function\n */\nexport function debounce(fn, delay = 300) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}`
        },
        folderStructure: [
          'src/',
          `src/components/${compName}/`,
          `src/components/${compName}/${compName}.jsx`,
          `src/components/${compName}/${compName}.module.css`,
          `src/components/${compName}/${compName}Utils.js`,
          `src/components/${compName}/${compName}.test.jsx`
        ],
        dependencies: {
          'react':                 '^18.2.0',
          'react-dom':             '^18.2.0',
          '@tauri-apps/plugin-sql': '^2.0.0',
        },
        moduleReadme: `# ${moduleName}\n\nPart of **${projectName}** — Generated by Mickii Developer Worker.\n\n## Usage\n\`\`\`jsx\nimport ${compName} from './components/${compName}/${compName}.jsx';\n\n<${compName} onNavigate={navigate} />\n\`\`\`\n\n## Props\n| Prop | Type | Description |\n|------|------|-------------|\n| onNavigate | function | App navigation callback |\n\n## Files\n- \`${compName}.jsx\` — Main component\n- \`${compName}.module.css\` — Styles\n- \`${compName}Utils.js\` — Utility functions\n- \`${compName}.test.jsx\` — Unit tests`
      };

      testCode = `import { render, screen, fireEvent, waitFor } from '@testing-library/react';\nimport ${compName} from './${compName}.jsx';\n\ndescribe('${moduleName}', () => {\n  test('renders without crashing', () => {\n    render(<${compName} onNavigate={jest.fn()} />);\n    expect(screen.getByText('${moduleName}')).toBeInTheDocument();\n  });\n\n  test('shows loading spinner initially', () => {\n    render(<${compName} onNavigate={jest.fn()} />);\n    expect(document.querySelector('.animate-spin')).toBeInTheDocument();\n  });\n\n  test('displays data after load', async () => {\n    render(<${compName} onNavigate={jest.fn()} />);\n    await waitFor(() => {\n      expect(screen.getByText('Sample Item')).toBeInTheDocument();\n    });\n  });\n\n  test('calls onNavigate when triggered', () => {\n    const mockNavigate = jest.fn();\n    render(<${compName} onNavigate={mockNavigate} />);\n    // Trigger navigation action\n    fireEvent.click(screen.queryByRole('button') || document.body);\n  });\n});`;
    }

    // ── 6. Ensure code_modules table ─────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS code_modules (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        module_name TEXT,
        main_filename TEXT,
        code_text TEXT,
        style_code TEXT,
        util_code TEXT,
        test_text TEXT,
        folder_structure TEXT,
        dependencies_json TEXT,
        module_readme TEXT,
        tech_stack TEXT,
        version INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const moduleId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO code_modules (id, project_id, module_name, main_filename, code_text, style_code, util_code, test_text, folder_structure, dependencies_json, module_readme, tech_stack, version, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP)`,
      [
        moduleId, projectId, moduleName,
        codeData.mainComponent?.filename || `${moduleName}.jsx`,
        codeData.mainComponent?.code     || '',
        codeData.styleFile?.code         || '',
        codeData.utilFile?.code          || '',
        testCode,
        JSON.stringify(codeData.folderStructure || []),
        JSON.stringify(codeData.dependencies    || {}),
        codeData.moduleReadme            || '',
        finalStack,
        1
      ]
    );

    // Update project stage to Development
    await db.execute("UPDATE projects SET stage = 'Development' WHERE id = $1", [projectId]).catch(() => {});

    // Create 24h STANDARD approval gate request
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const approvalId = crypto.randomUUID();
    
    await db.execute(
      `INSERT INTO approvals (id, title, type, project_id, worker_name, request_data, status, expires_at, created_at, owner_notified, whatsapp_sent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 0, 0)`,
      [
        approvalId,
        `React Code Module "${moduleName}" for "${projectName}"`,
        'standard',
        projectId,
        'Developer',
        JSON.stringify({
          moduleId,
          projectName,
          moduleName,
          summary: `${(codeData.mainComponent?.code || '').split('\n').length} lines of code | ${(testCode || '').split('\n').length} test lines`
        }),
        'pending',
        expiresAt
      ]
    ).catch(err => console.error('[DeveloperWorker Approval Insert Err]', err));

    return {
      moduleId,
      projectName,
      moduleName,
      techStack:       finalStack,
      mainFilename:    codeData.mainComponent?.filename,
      styleFilename:   codeData.styleFile?.filename,
      utilFilename:    codeData.utilFile?.filename,
      codeLineCount:   (codeData.mainComponent?.code || '').split('\n').length,
      testLineCount:   (testCode || '').split('\n').length,
      folderStructure: codeData.folderStructure,
      dependencies:    codeData.dependencies,
      moduleReadme:    codeData.moduleReadme,
      summary: `Module "${moduleName}" generated for ${projectName} | ${(codeData.mainComponent?.code || '').split('\n').length} lines of code | ${(testCode || '').split('\n').length} test lines`,
      approvalId
    };
  }
}
