import { addApproval, addLead, getDb, getSetting } from '../data/db.js';
import { internalInvoke, OS } from './bridge.js';

// ============================================================================
// MICKII ENGINE — Frontend Agent Layer
// Brain + Tools + Workflow orchestrator
// ============================================================================

// ──────────────────────────────────────────────────────────────
// CORE ENGINE: Local Rules & Memory (No external LLM by default)
// ──────────────────────────────────────────────────────────────

let sessionContext = {
  lastIntent: null,
  pendingData: {}
};


import { Cortex } from './cortex.js';

let globalCortex = null;

export async function mickiiThink(prompt, context) {
  // Cortex handles multi-LLM fallback internally: Gemini → Groq → NVIDIA NIM
  // No Ollama config needed here — cortex.js manages all provider routing
  if (!globalCortex) {
    globalCortex = new Cortex();
  }

  console.log("[Mickii Engine] Thinking via Cortex (Gemini → Groq → NVIDIA NIM fallback)...");

  try {
    // 1. CALL THE BRAIN (Autonomous Cortex — multi-LLM)
    const result = await globalCortex.think(prompt);
    
    return {
      matched: true,
      match_type: "cortex_brain",
      confidence: 1.0,
      message: result.content,
      response: result.content,
      intent: "agent_action",
      action: "show_message",
      source: 'cortex'
    };

  } catch (e) {
    console.warn('[Mickii Engine] Cortex failed, falling back to deterministic...', e);
    
    // Last-resort deterministic fallback
    try {
      const response = await internalInvoke('ask_mickii', { input: prompt });
      if (response.matched) return response;
    } catch (inner) {}

    return { action: "error", message: "Mickii Brain error: " + e.message, intent: "error" };
  }
}


async function fillTemplateContext(template) {
  if (!template.includes('{')) return template;
  
  try {
    const db = await getDb();
    let result = template;
    
    // 1. Lead Data
    const hotLeads = await db.select("SELECT COUNT(*) as count FROM leads WHERE score >= 80");
    const totalLeads = await db.select("SELECT COUNT(*) as count FROM leads");
    result = result.replace(/{hot_leads}/g, hotLeads[0].count || 0);
    result = result.replace(/{total_leads}/g, totalLeads[0].count || 0);
    
    // 2. Project Data
    const activeProjects = await db.select("SELECT COUNT(*) as count FROM projects WHERE stage != 'Completed'");
    result = result.replace(/{active_projects}/g, activeProjects[0].count || 0);
    
    // 3. Approval Data
    const pendingApprovals = await db.select("SELECT COUNT(*) as count FROM approvals WHERE status = 'Pending'");
    result = result.replace(/{pending_approvals}/g, pendingApprovals[0].count || 0);
    result = result.replace(/{pending_count}/g, pendingApprovals[0].count || 0);
    
    // 4. Specific Lead/Project Placeholders (Look for the most recent or relevant)
    if (template.includes('{lead_name}')) {
      const recentLead = await db.select("SELECT name FROM leads ORDER BY created_at DESC LIMIT 1");
      if (recentLead.length > 0) {
        result = result.replace(/{lead_name}/g, recentLead[0].name);
        result = result.replace(/{lead_mood}/g, "Interested");
        result = result.replace(/{message_draft}/g, `Hi ${recentLead[0].name}, following up on our last talk regarding your project requirements.`);
      }
    }

    if (template.includes('{project_name}')) {
      const recentProject = await db.select("SELECT name FROM projects ORDER BY created_at DESC LIMIT 1");
      if (recentProject.length > 0) {
        result = result.replace(/{project_name}/g, recentProject[0].name);
      }
    }

    // 5. Default Placeholders (Fallback)
    result = result.replace(/{client_name}/g, "Client Name");
    result = result.replace(/{project_name}/g, "[Select Project]");
    result = result.replace(/{lead_name}/g, "[Select Lead]");
    result = result.replace(/{pipeline_value}/g, "₹0");
    result = result.replace(/{top_priority}/g, "Review Approvals");
    
    return result;

  } catch (err) {
    console.warn("Context fill failed:", err);
    return template;
  }
}


// ──────────────────────────────────────────────────────────────
// TOOLS: Execute individual tools
// ──────────────────────────────────────────────────────────────

export async function runTool(toolName, input) {
  try {
    // 1. Check for OS Primitives first
    if (toolName === 'file_write' || toolName === 'fs_write') {
      const { path, content } = typeof input === 'string' ? JSON.parse(input) : input;
      const output = await OS.write(path, content);
      return { success: true, output };
    }
    
    if (toolName === 'shell_run' || toolName === 'code_run') {
      const { command, args, cwd } = typeof input === 'string' ? { command: input, args: [] } : input;
      const output = await OS.shell(command, args, cwd);
      return { success: true, output };
    }

    if (toolName === 'file_read' || toolName === 'fs_read') {
      const path = typeof input === 'string' ? input : input.path;
      const output = await OS.read(path);
      return { success: true, output };
    }

    // 2. Fallback to consultation logic
    if (toolName === 'consult') {
      const responses = [
        `Boss, lead follow-up ka standard process ye hai: Pehle mood check karo, phir personalization add karo, aur follow-up message draft karo. Main isse automate kar sakta hoon!`,
        `Development process simple hai: Planning -> Design -> Build. Aapka kya requirement hai?`,
        `Ji Boss! Main deterministic engine hoon, lekin main seekh bhi sakta hoon. Aap batayein main kya naya seekhoon?`,
        `Business scaling ke liye automation zaroori hai. Mickii Factory ismein help karegi.`
      ];
      const output = responses[Math.floor(Math.random() * responses.length)];
      return { success: true, output };
    }
    const raw = await internalInvoke('mickii_tool', { toolName, input });
    return JSON.parse(raw);
  } catch (err) {
    return { success: false, output: err.toString() };
  }
}


export const TOOLS = {
  code_run:    { name: 'Code Tool',    icon: 'code',    desc: 'Code likhna + run karna' },
  file_read:   { name: 'File Reader',  icon: 'document',desc: 'Files padhna' },
  file_write:  { name: 'File Writer',  icon: 'file',    desc: 'Files likhna' },
  shell_run:    { name: 'Shell Tool',   icon: 'terminal',desc: 'Bash commands run karna' },
  web_search:  { name: 'Web Search',   icon: 'search',  desc: 'Internet pe research' },
  memory_query:{ name: 'Memory Tool',  icon: 'memory',  desc: 'Yaad rakhna + dhundhna' },
  consult:     { name: 'Expert Consult',icon: 'brain',  desc: 'External LLM se seekhna' },
  approval:    { name: 'Approval Gate', icon: 'shield',  desc: 'Boss se YES lena' },
  design_tool: { name: 'Design Tool',  icon: 'palette', desc: 'UI/UX banane ke liye' },
};

export async function saveOptimization(skillIntent, feedbackType, feedbackText) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    'INSERT INTO skills (id, name, category, description, source) VALUES ($1, $2, $3, $4, $5)',
    [id, `${skillIntent}_${feedbackType}`, 'Optimization', feedbackText, 'USER_FIX']
  );
  return { success: true, message: "Boss, improvement save ho gayi hai. Agli baar dhyan rakhunga!" };
}

// ──────────────────────────────────────────────────────────────
// WORKFLOW ENGINE: Multi-step task orchestration
// ──────────────────────────────────────────────────────────────

export async function startWorkflow(task) {
  const raw = await internalInvoke('mickii_workflow', { task });
  return JSON.parse(raw);
}

export async function executeWorkflowStep(step) {
  if (step.tool === 'approval') {
    const id = await addApproval(
      step.description,
      'workflow_step',
      { step: step.step },
      'Workflow Engine',
      'Medium'
    );
    return { ...step, status: 'needs_approval', output: `Approval created (${id}). Boss ka YES chahiye.` };
  }

  if (step.tool === 'memory_query') {
    const db = await getDb();
    
    if (step.input && step.input.startsWith('SAVE_KNOWLEDGE:')) {
      const fact = step.input.replace('SAVE_KNOWLEDGE:', '').trim();
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO skills (id, name, category, description, source) VALUES ($1, $2, $3, $4, $5)',
        [id, fact, 'General Knowledge', 'Automated learning from expert consult', 'AI_LEARNED']
      );
      return { ...step, status: 'done', output: 'Fact saved to local memory! Agli baar main bina Expert ke jawaab de paunga.' };
    }

    if (step.input && step.input.startsWith('CHECK_OPTIMIZATIONS:')) {
      const intent = step.input.replace('CHECK_OPTIMIZATIONS:', '').trim();
      const optims = await db.select(
        "SELECT description FROM skills WHERE category = 'Optimization' AND name LIKE $1",
        [`%${intent}%`]
      );
      const output = optims.length > 0 
        ? `Purane Fixes mile: ${optims.map(o => o.description).join(' | ')}`
        : "Koi purana fix nahi mila. Fresh start!";
      return { ...step, status: 'done', output };
    }

    // Query local DB
    const projects = await db.select('SELECT name, stage, health FROM projects LIMIT 5');
    const leads = await db.select('SELECT name, status, score FROM leads LIMIT 5');
    return { 
      ...step, 
      status: 'done', 
      output: `Memory loaded: ${projects.length} projects, ${leads.length} leads found.` 
    };
  }

  if (step.tool === 'preview') {
    return { ...step, status: 'done', output: 'Preview ready — Live Workspace mein dikhao.' };
  }

  // For code_run, shell_run, file_read, file_write, web_search → call Rust tool
  try {
    const input = step.input || step.description; 
    const result = await runTool(step.tool, input);
    return { ...step, status: result.success ? 'done' : 'failed', output: result.output };
  } catch (e) {
    return { ...step, status: 'failed', output: e.toString() };
  }
}

// ──────────────────────────────────────────────────────────────
// INTENT HANDLER: Process Mickii's response and take action
// ──────────────────────────────────────────────────────────────

export async function handleIntent(response, userMsg) {
  const intent = response.intent;

  if (intent === 'start_project') {
    await addApproval(
      'Create new project: ' + userMsg.slice(0, 30) + '...',
      'start_project', 
      { prompt: userMsg }, 
      'Project Builder', 
      'Medium'
    );
  }

  if (intent === 'capture_lead') {
    const words = userMsg.split(' ');
    const name = words.length > 3 ? words.slice(2).join(' ') : 'New Lead - ' + new Date().toLocaleDateString();
    await addLead(name, 'Manual', '0', userMsg);
  }

  return response;
}

// ──────────────────────────────────────────────────────────────
// SKILL SYSTEM: Learn and manage skills
// ──────────────────────────────────────────────────────────────

export async function addSkill(name, category, description) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    'INSERT INTO skills (id, name, category, description, source) VALUES ($1, $2, $3, $4, $5)',
    [id, name, category, description, 'Learned']
  );
  return id;
}

// ──────────────────────────────────────────────────────────────
// Mickii Engine — Ready to Work.
// ──────────────────────────────────────────────────────────────
