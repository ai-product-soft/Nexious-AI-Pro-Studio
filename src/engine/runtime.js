// ──────────────────────────────────────────────────────────────
// MICKII RUNTIME — Tool Registry & Dispatcher
// ──────────────────────────────────────────────────────────────
import { OS } from './bridge.js';
import { getSetting, addApproval, getDb, logSearchFailure } from '../data/db.js';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { SearchService } from '../services/searchService.js';
import { runWorker } from './workers/index.js';
import { WhatsAppService } from '../services/whatsappService.js';

export const SystemTools = [
  {
    name: 'mickii_fs_create',
    description: 'Create file or directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        kind: { type: 'string', enum: ['file', 'dir'] },
        content: { type: 'string' }
      },
      required: ['path']
    }
  },
  {
    name: 'mickii_fs_read',
    description: 'Read file contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },
  {
    name: 'mickii_fs_write',
    description: 'Overwrite file content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'mickii_fs_delete',
    description: 'Delete file or directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        recursive: { type: 'boolean' }
      },
      required: ['path']
    }
  },
  {
    name: 'mickii_shell_run',
    description: 'Execute shell command.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        args: { type: 'array', items: { type: 'string' } },
        cwd: { type: 'string' }
      },
      required: ['command', 'args']
    }
  },
  {
    name: 'mickii_web_search',
    description: 'Search web for live data.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'mickii_deep_research',
    description: 'Exa neural search for complex analysis.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'mickii_cpanel_deploy',
    description: 'Deploy a local directory to a C-Panel via FTP.',
    parameters: {
      type: 'object',
      properties: {
        localDir: { type: 'string' },
        remoteDir: { type: 'string' }
      },
      required: ['localDir', 'remoteDir']
    }
  },
  {
    name: 'mickii_trigger_worker',
    description: 'Dynamically trigger a specialized worker (e.g. developer, blueprint_maker, website_builder).',
    parameters: {
      type: 'object',
      properties: {
        workerName: { type: 'string' },
        input: { type: 'string' },
        config: { type: 'object' }
      },
      required: ['workerName', 'input']
    }
  },
  {
    name: 'mickii_search_past_blueprints',
    description: 'Search the database for past project blueprints to reuse logic.',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string' }
      },
      required: ['keyword']
    }
  },
  {
    name: 'mickii_get_client_memory',
    description: 'Retrieve brand preferences and past context for a specific client to inject into tasks.',
    parameters: {
      type: 'object',
      properties: {
        client_name: { type: 'string' }
      },
      required: ['client_name']
    }
  },
  {
    name: 'mickii_request_boss_approval',
    description: 'Pause execution and request explicit approval from the Boss for a strategic decision, architecture, or pricing.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['title', 'description']
    }
  },
  {
    name: 'mickii_update_worker_prompt',
    description: 'Update the permanent system prompt or rules of a specific worker if it repeatedly fails QA. This allows the worker to learn from its mistakes (Self-Evolution).',
    parameters: {
      type: 'object',
      properties: {
        worker_name: { type: 'string' },
        new_prompt_rules: { type: 'string' }
      },
      required: ['worker_name', 'new_prompt_rules']
    }
  },
  {
    name: 'mickii_prune_memory',
    description: 'Compress a completed project into a short vector summary and delete raw logs to optimize local SQLite storage.',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        summary_text: { type: 'string' }
      },
      required: ['project_id', 'summary_text']
    }
  }
];

let keyCache = {};

export class AgentRuntime {
  constructor(tools = []) {
    this.tools = tools;
  }

  schemas() {
    return this.tools;
  }

  async getCachedKey(name, defaultValue) {
    if (keyCache[name]) return keyCache[name];
    const key = await getSetting(name) || defaultValue;
    keyCache[name] = key;
    return key;
  }

  async dispatch(toolName, args) {
    console.log(`[Runtime] Dispatching ${toolName}...`, args);
    
    if (toolName.startsWith('mickii_fs_')) {
      const primitive = toolName.replace('mickii_fs_', '');
      if (primitive === 'create') {
        console.log(`[Runtime] Pushing mickii_fs_create to approvals queue for path: ${args.path}`);
        
        const previewContent = args.content ? args.content.substring(0, 150) + (args.content.length > 150 ? '...' : '') : 'Empty or Directory';
        const preview = `CREATE ${args.kind || 'file'}: ${args.path}\n\nPreview:\n${previewContent}`;
        const approvalId = await addApproval(preview, 'File Creation', '{}', 'Cortex', 'High Risk');
        
        // Notify UI that an approval is pending
        console.log('[Runtime] Emitting approval_requested event:', { approvalId, path: args.path });
        await emit('approval_requested', { approvalId, path: args.path });
        
        // Block execution using Tauri events instead of DB polling
        await new Promise(async (resolve, reject) => {
          const unlisten = await listen('approval_granted', (event) => {
            const { approvalId: receivedId, decision } = event.payload;
            if (receivedId === approvalId) {
              clearTimeout(timeout);
              unlisten();
              if (decision === 'Approved') {
                resolve(true);
              } else {
                reject(new Error('User rejected the file creation.'));
              }
            }
          });

          const timeout = setTimeout(() => {
            unlisten();
            reject(new Error('Approval timeout — user did not respond within 60s'));
          }, 60000);
        });

        const result = await OS.create(args.path, args.kind, args.content);
        console.log(`[Runtime] mickii_fs_create success! Exact absolute path used: ${args.path}`);
        return result;
      }
      if (primitive === 'read') return await OS.read(args.path);
      if (primitive === 'write') return await OS.write(args.path, args.content);
      if (primitive === 'delete') return await OS.delete(args.path, args.recursive);
    }
    
    if (toolName === 'mickii_shell_run') {
      return await OS.shell(args.command, args.args, args.cwd);
    }

    if (toolName === 'mickii_web_search') {
      console.log(`[Runtime] 🌍 EXECUTING WEB SEARCH: "${args.query}"`);
      const searchResult = await SearchService.performSearch(args.query, false);
      console.log(`[Runtime] 🌍 SEARCH RESULT:`, searchResult);
      if (searchResult.results && searchResult.results.length > 0) {
        const warningSuffix = searchResult.warning ? `\n\n[WARNING]: ${searchResult.warning}` : '';
        return searchResult.results.map((r, i) => 
          `RESULT ${i+1}: ${r.title}\nURL: ${r.link}\nDATE: ${r.date || 'N/A'}\nSUMMARY: ${r.snippet || 'No content'}`
        ).join('\n\n') + warningSuffix;
      }
      return JSON.stringify({ error: "All search providers failed or returned empty results." });
    }

    if (toolName === 'mickii_deep_research') {
      const apiKey = await this.getCachedKey('exa_api_key', '');
      const raw = await invoke('exa_research', { query: args.query, apiKey });
      
      if (raw.results) {
        return raw.results.slice(0, 5).map((r, i) => 
          `RESULT ${i+1}: ${r.title}\nURL: ${r.url || 'No Link'}\nSUMMARY: ${r.text || 'No content'}`
        ).join('\n\n');
      }
      return raw;
    }

    if (toolName === 'mickii_cpanel_deploy') {
      const host = await this.getCachedKey('cpanel_host', '');
      const user = await this.getCachedKey('cpanel_user', '');
      const pass = await this.getCachedKey('cpanel_pass', '');
      
      if (!host || !user || !pass) {
        throw new Error('C-Panel credentials (host, user, pass) are missing in settings.');
      }
      
      console.log(`[Runtime] Pushing mickii_cpanel_deploy to approvals queue for: ${args.localDir}`);
      const preview = `DEPLOY TO C-PANEL\n\nLocal Dir: ${args.localDir}\nRemote Dir: ${args.remoteDir}\nHost: ${host}`;
      const approvalId = await addApproval(preview, 'C-Panel Deployment', '{}', 'Packager Worker', 'Critical');
      await emit('approval_requested', { approvalId, path: args.localDir });
      
      await new Promise(async (resolve, reject) => {
        const unlisten = await listen('approval_granted', (event) => {
          const { approvalId: receivedId, decision } = event.payload;
          if (receivedId === approvalId) {
            clearTimeout(timeout);
            unlisten();
            if (decision === 'Approved') {
              resolve(true);
            } else {
              reject(new Error('User rejected deployment.'));
            }
          }
        });

        const timeout = setTimeout(() => {
          unlisten();
          reject(new Error('Approval timeout.'));
        }, 60000);
      });

      console.log('[Runtime] Deployment approved, triggering Rust FTP client...');
      return await invoke('deploy_to_cpanel', { 
        host, user, pass, 
        localDir: args.localDir, 
        remoteDir: args.remoteDir 
      });
    }

    if (toolName === 'mickii_trigger_worker') {
      try {
        console.log(`[Runtime] Orchestrator triggering worker: ${args.workerName}`);
        const result = await runWorker(args.workerName, args.input, args.config || {});
        return JSON.stringify(result);
      } catch (err) {
        return JSON.stringify({ error: `Failed to trigger worker ${args.workerName}: ${err.message}` });
      }
    }

    if (toolName === 'mickii_search_past_blueprints') {
      try {
        const db = await getDb();
        const results = await db.select('SELECT project_id, prd_text, architecture_diagram FROM blueprints WHERE prd_text LIKE $1 LIMIT 5', [`%${args.keyword}%`]);
        if (!results || results.length === 0) return JSON.stringify({ message: 'No past blueprints found.' });
        return JSON.stringify(results);
      } catch (err) {
        return JSON.stringify({ error: err.message });
      }
    }

    if (toolName === 'mickii_get_client_memory') {
      try {
        const db = await getDb();
        const results = await db.select('SELECT preferences, brand_tone FROM clients WHERE name LIKE $1 LIMIT 1', [`%${args.client_name}%`]);
        if (!results || results.length === 0) return JSON.stringify({ message: 'No past memory found for this client.' });
        return JSON.stringify(results[0]);
      } catch (err) {
        // Fallback if table doesn't exist yet
        return JSON.stringify({ message: 'No past memory found for this client.' });
      }
    }

    if (toolName === 'mickii_request_boss_approval') {
      try {
        console.log(`[Runtime] Mickii requesting boss approval: ${args.title}`);
        const approvalId = await addApproval(args.description, args.title, '{}', 'Mickii (Cortex)', 'High Risk');
        await emit('approval_requested', { approvalId, path: 'Mickii Strategy' });
        
        // Phase 2: WhatsApp Remote Approval Trigger
        const bossPhone = await getSetting('boss_phone') || '+919999999999';
        await WhatsAppService.sendTemplate(bossPhone, 'CRITICAL', {
          worker_name: 'Mickii Cortex',
          project_name: args.title,
          amount: '0',
          id: approvalId,
          minutes: '120'
        }).catch(err => console.log('[Runtime] WhatsApp failed:', err));

        
        const decision = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Approval timeout — user did not respond within 120s')), 120000);
          listen('approval_granted', (event) => {
            const { approvalId: receivedId, decision: uidecision } = event.payload;
            if (receivedId === approvalId) {
              clearTimeout(timeout);
              resolve(uidecision);
            }
          }).then(unlisten => {
            // Keep reference to unlisten if needed, but Tauri usually manages it.
          });
        });
        
        return JSON.stringify({ status: decision });
      } catch (err) {
        return JSON.stringify({ error: err.message });
      }
    }

    if (toolName === 'mickii_update_worker_prompt') {
      try {
        const db = await getDb();
        await db.execute(
          `CREATE TABLE IF NOT EXISTS dynamic_worker_prompts (
            worker_name TEXT PRIMARY KEY,
            prompt_rules TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        );
        await db.execute(
          `INSERT INTO dynamic_worker_prompts (worker_name, prompt_rules) 
           VALUES ($1, $2)
           ON CONFLICT(worker_name) DO UPDATE SET prompt_rules = $2, updated_at = CURRENT_TIMESTAMP`,
          [args.worker_name, args.new_prompt_rules]
        );
        console.log(`[Self-Evolution] Updated prompt for ${args.worker_name}`);
        return JSON.stringify({ success: true, message: `Successfully updated ${args.worker_name} with new rules.` });
      } catch (err) {
        return JSON.stringify({ error: err.message });
      }
    }

    if (toolName === 'mickii_prune_memory') {
      try {
        const db = await getDb();
        await db.execute(
          `CREATE TABLE IF NOT EXISTS memory_archives (
            project_id TEXT PRIMARY KEY,
            vector_summary TEXT,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        );
        await db.execute(
          `INSERT INTO memory_archives (project_id, vector_summary) VALUES ($1, $2)
           ON CONFLICT(project_id) DO UPDATE SET vector_summary = $2`,
          [args.project_id, args.summary_text]
        );
        // Prune raw logs for this project (assuming target_id maps to project_id)
        await db.execute(`DELETE FROM worker_logs WHERE input_data LIKE $1`, [`%${args.project_id}%`]);
        console.log(`[Memory Pruned] Compressed project ${args.project_id}`);
        return JSON.stringify({ success: true, message: 'Logs pruned and summary archived.' });
      } catch (err) {
        return JSON.stringify({ error: err.message });
      }
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }
}
