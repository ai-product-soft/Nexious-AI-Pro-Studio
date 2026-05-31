import { BaseWorker } from './baseWorker.js';
import { getDb, getClientProfile, saveClientProfile } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';
import { scanOutputForIssues } from '../../utils/outputValidator.js';
import { ClientProfile } from '../memory/clientProfile.js';
import { SemanticSearch } from '../memory/semanticSearch.js';

// ── CONTEXT MAPPINGS (PROBLEM 1) ─────────────────────────────────────────────
const BUILD_TYPE_CONTEXT = {
  'website': {
    focusAreas: ['Responsive Design', 'SEO', 'CMS', 'Page Structure', 'Conversion Optimization', 'Core Web Vitals', 'Mobile-First', 'Hosting/Deploy'],
    techStack: ['React 18', 'Vite', 'Tailwind CSS', 'Netlify/Vercel', 'Google Analytics', 'Formspree'],
    deliverables: ['Homepage', 'About', 'Services', 'Contact', 'Blog (optional)', 'Admin Panel (optional)'],
    userStoryTemplate: 'As a visitor, I want to [action] so that [benefit]...',
    testingFocus: 'Cross-browser, Mobile responsive, Page speed < 2s, Lighthouse score > 90',
    deploymentSteps: ['Build optimization', 'SEO meta tags', 'Sitemap', 'Robots.txt', 'Google Search Console', 'Analytics setup']
  },
  'mobile_app': {
    focusAreas: ['iOS/Android Native', 'App Store Guidelines', 'Push Notifications', 'Offline Mode', 'Biometric Auth', 'API Integration', 'Deep Linking'],
    techStack: ['React Native', 'Expo', 'Firebase', 'Async Storage', 'React Navigation', 'Push Notifications'],
    deliverables: ['Onboarding Flow', 'Home Screen', 'Profile', 'Settings', 'Push Notifications', 'Offline Sync'],
    userStoryTemplate: 'As a user, I want to [action] on my phone so that [benefit]...',
    testingFocus: 'TestFlight, Play Console, Device testing, Battery optimization, Crash analytics',
    deploymentSteps: ['App Store Connect', 'Play Console', 'Beta testing', 'Review submission', 'ASO (App Store Optimization)']
  },
  'saas': {
    focusAreas: ['Multi-tenancy', 'Auth (OAuth/JWT)', 'Subscription Billing', 'API Design', 'Admin Dashboard', 'RBAC', 'Scalability', 'Webhooks'],
    techStack: ['Next.js 14', 'Prisma', 'PostgreSQL', 'Stripe', 'NextAuth', 'Vercel', 'Redis', 'Docker'],
    deliverables: ['Landing Page', 'Auth Flow', 'Dashboard', 'Settings', 'Billing Portal', 'API Docs', 'Admin Panel'],
    userStoryTemplate: 'As a [role: admin/user], I want to [action] so that [business outcome]...',
    testingFocus: 'Unit tests, Integration tests, Load testing, Security audit, Penetration testing',
    deploymentSteps: ['CI/CD pipeline', 'Staging environment', 'Production deploy', 'Monitoring (Sentry)', 'Backup strategy', 'SSL/Security headers']
  },
  'automation': {
    focusAreas: ['Trigger-Action Logic', 'Cron Scheduling', 'Error Handling', 'Retry Mechanisms', 'Webhook Integrations', 'Logging', 'Monitoring'],
    techStack: ['Node.js', 'BullMQ', 'Redis', 'PostgreSQL', 'Docker', 'PM2', 'Winston'],
    deliverables: ['Trigger Engine', 'Action Processor', 'Scheduler', 'Error Handler', 'Dashboard', 'Logs Viewer'],
    userStoryTemplate: 'As a business owner, I want [process] to run automatically when [trigger] so that [time saved]...',
    testingFocus: 'Edge cases, Timeout handling, Queue failure, Webhook retry, Data consistency',
    deploymentSteps: ['Docker containerize', 'Redis queue setup', 'Cron job config', 'Webhook endpoints', 'Monitoring alerts', 'Backup/Recovery']
  },
  'crm': {
    focusAreas: ['Data Models', 'Pipeline Views', 'Reporting', 'RBAC', 'Data Import/Export', 'Notifications', 'Mobile Responsive'],
    techStack: ['Next.js', 'Supabase', 'Prisma', 'Recharts', 'React Table', 'Zustand', 'Tailwind'],
    deliverables: ['Lead Dashboard', 'Contact Manager', 'Pipeline View', 'Task/Activity', 'Reports/Analytics', 'Settings/Admin'],
    userStoryTemplate: 'As a sales manager, I want to [track/manage] so that [revenue outcome]...',
    testingFocus: 'Data integrity, Role-based access, Bulk operations, CSV import/export, Search performance',
    deploymentSteps: ['Supabase project setup', 'RLS policies', 'Auth config', 'Database seeding', 'Admin roles', 'Production deploy']
  }
};

const DOMAIN_CONTEXT = {
  'ecommerce': { keywords: ['Product catalog', 'Cart', 'Checkout', 'Payment gateway', 'Inventory', 'Order tracking', 'Reviews'], competitors: ['Shopify', 'WooCommerce', 'BigCommerce'] },
  'real_estate': { keywords: ['Property listings', 'Search filters', 'Map integration', 'Virtual tour', 'Lead capture', 'Agent profiles', 'Mortgage calculator'], competitors: ['Zillow', 'Realtor.com', '99acres'] },
  'healthcare': { keywords: ['Patient records', 'Appointment booking', 'Prescription', 'Telemedicine', 'Insurance', 'HIPAA compliance'], competitors: ['Practo', 'Zocdoc', 'Teladoc'] },
  'education': { keywords: ['Course catalog', 'Video lessons', 'Quizzes', 'Progress tracking', 'Certificates', 'Student dashboard'], competitors: ['Udemy', 'Coursera', 'Teachable'] },
  'fintech': { keywords: ['KYC', 'Transactions', 'Wallet', 'Investments', 'Reports', 'Compliance', 'Security'], competitors: ['Paytm', 'PhonePe', 'Stripe'] },
  'gaming': { keywords: ['Leaderboard', 'Achievements', 'In-app purchases', 'Multiplayer', 'Matchmaking', 'Push notifications'], competitors: ['PUBG Mobile', 'Call of Duty Mobile', 'Free Fire'] }
};

// ── HELPERS FOR NORMALIZATION & TIMELINES ───────────────────────────────────
const normalizeType = (buildType) => {
  const type = (buildType || '').toLowerCase().trim();
  if (type.includes('website') || type.includes('landing')) return 'website';
  if (type.includes('mobile')) return 'mobile_app';
  if (type.includes('saas') || type.includes('dashboard')) return 'saas';
  if (type.includes('automation')) return 'automation';
  if (type.includes('crm') || type.includes('software')) return 'crm';
  return 'website';
};

const normalizeDomain = (businessDomain) => {
  const domain = (businessDomain || '').toLowerCase().trim();
  if (domain.includes('ecommerce') || domain.includes('retail') || domain.includes('commerce')) return 'ecommerce';
  if (domain.includes('estate') || domain.includes('property') || domain.includes('real')) return 'real_estate';
  if (domain.includes('healthcare') || domain.includes('medical') || domain.includes('biotech')) return 'healthcare';
  if (domain.includes('education') || domain.includes('learning') || domain.includes('edtech')) return 'education';
  if (domain.includes('fintech') || domain.includes('finance') || domain.includes('crypto')) return 'fintech';
  if (domain.includes('gaming') || domain.includes('game')) return 'gaming';
  return 'ecommerce';
};

// ── TIMELINE ESTIMATOR ENGINE (PROBLEM 3) ───────────────────────────────────
const calculateRealisticTimeline = (planType, approvalSeverity = 'standard') => {
  const AI_GENERATION_TIME = {
    'website': 2,      // minutes
    'mobile_app': 8,   // minutes
    'saas': 10,        // minutes
    'automation': 6,   // minutes
    'crm': 7           // minutes
  };
  
  const HUMAN_APPROVAL_WAIT = {
    'standard': 4,     // hours (owner reviews when free)
    'critical': 24,    // hours (owner careful review)
    'auto': 0          // no approval needed
  };
  
  const REVISION_CYCLES = 2.5; // Average client changes 2-3 times
  
  const aiTime = AI_GENERATION_TIME[planType] || 5;
  const approvalTime = HUMAN_APPROVAL_WAIT[approvalSeverity] || 4;
  const revisionTime = (aiTime + approvalTime) * REVISION_CYCLES;
  const totalHours = aiTime + approvalTime + revisionTime;
  
  return {
    ai_generation: `${aiTime} min`,
    approval_wait: `${approvalTime}h`,
    revision_cycles: REVISION_CYCLES,
    total_estimate: `${Math.ceil(totalHours)}h`,
    breakdown: `AI: ${aiTime}m + Approval: ${approvalTime}h + Revisions: ${Math.ceil(revisionTime)}h`,
    total_hours: Math.ceil(totalHours)
  };
};

// ── TYPE-SPECIFIC FALLBACK GENERATORS (PROBLEM 1) ───────────────────────────
const getFallbackPrd = (projectName, clientName, resolvedPlanType, resolvedPlanDomain, typeContext, domainContext) => {
  return `# PRD — ${projectName} (${resolvedPlanType} in ${resolvedPlanDomain})

## Overview
${projectName} is a high-performance ${resolvedPlanType} tailored for the ${resolvedPlanDomain} industry, built for ${clientName}. It focuses on: ${typeContext.focusAreas.join(', ')}.

## Goals & Success Metrics
- Seamlessly integrate ${domainContext.keywords.slice(0, 3).join(', ')} capabilities.
- Reduce manual friction and enhance customer trust.
- Achieve operational latency of under 2s for all core flows.

## User Stories
${typeContext.deliverables.map((del, i) => `- Story ${i+1} [${del}]: As a user, I want to interact with ${del} in my ${resolvedPlanDomain} application so that I get direct business value.`).join('\n')}
- As a visitor, I want search filters for ${domainContext.keywords.slice(0, 2).join(' and ')} so I find what I need quickly.

## Functional Requirements
${typeContext.deliverables.map(del => `- Complete implementation of the ${del} subsystem.`).join('\n')}
- Direct security auditing and logging for all compliance processes.

## Non-Functional Requirements
- ${typeContext.testingFocus}
- Local-first architecture using SQLite.
- Glassmorphic, highly responsive user interface.

## Out of Scope
- Fully custom VR/AR immersive environments (Phase 2).
- Legacy database integrations without direct REST/IPC capabilities.

## Acceptance Criteria
- End-to-end flow verified on target platforms.
- High visual aesthetics adhering to premium glassmorphism standards.`;
};

const getFallbackTechData = (projectName, resolvedPlanType, resolvedPlanDomain, typeContext, domainContext) => {
  // NOTE: All builds use SQLite local-first. PostgreSQL branch reserved for future cloud tier.
  const dbSchema = `-- SQLite Schema for ${projectName}\nCREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, stage TEXT);\nCREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, score INTEGER);\nCREATE TABLE IF NOT EXISTS blueprints (id TEXT PRIMARY KEY, version TEXT);`;

  return {
    trdMarkdown: `# TRD — ${projectName} (${resolvedPlanType})

## System Architecture
Modern distributed desktop shell or web system utilizing: ${typeContext.techStack.join(', ')}. Optimized for the ${resolvedPlanDomain} domain, analyzing competitors like ${domainContext.competitors.join(', ')}.

## Key Data Flows
1. User requests triggered via premium glassmorphic React frontend.
2. Local database queries resolved via SQLite or integrated state management.
3. Fallback worker orchestrations routed asynchronously through the master Cortex engine.

## Infrastructure & Hosting
- Local desktop application packaged via native compiler or deployed on cloud edge layers.`,
    architectureDiagram: `
┌────────────────────────────────────────────────────────┐
│                   ${projectName.toUpperCase()}
│         (${resolvedPlanType} — ${resolvedPlanDomain})
├────────────────────────────────────────────────────────┤
│  Frontend: ${typeContext.techStack.slice(0, 3).join(' + ')}
│  Backend: Tauri IPC / Node Core Services
│  Database: SQLite (mabishion.db) + local caches
├────────────────────────────────────────────────────────┤
│  Focus: ${typeContext.focusAreas.slice(0, 4).join(' ➔ ')}
└────────────────────────────────────────────────────────┘`,
    techStack: {
      frontend: typeContext.techStack.slice(0, 3),
      backend: ['Tauri v2 (Rust Core)', 'Node.js runtime'],
      database: ['SQLite (Local First)', 'Zustand Local Sync'],
      devops: typeContext.deploymentSteps.slice(0, 3),
      ai: ['Gemini 2.5 Flash', 'Llama 3.3 70B (fallback)']
    },
    databaseSchema: dbSchema,
    apiEndpoints: [
      { method: 'GET', path: '/api/v1/health', description: 'Get system status', auth: false },
      { method: 'POST', path: `/api/v1/${resolvedPlanDomain.toLowerCase()}/action`, description: 'Execute business process', auth: true }
    ],
    securityChecklist: [
      'Encrypted settings store and safe credential rotation',
      'Input sanitization to prevent SQL injection or CSRF',
      'Local-first data governance adhering to strict data isolation rules'
    ],
    deploymentSteps: typeContext.deploymentSteps
  };
};

export class BlueprintMakerWorker extends BaseWorker {
  constructor() {
    super('Blueprint Maker', 'planning', true, 'standard');
  }

  /**
   * Generates full context-aware technical blueprint
   * @param {string} projectId  SQLite project ID
   * @param {object} params     { requirements_override, buildType, businessDomain, changes }
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
    const projectType  = params.buildType    || project.type || 'Website';
    const stage        = project.stage       || 'Planning';
    const requirements = params.requirements_override || project.notes || 'AI-powered business automation system with dashboard, lead management, and automated workflows.';

    // ── Kimi Memory Integrations ─────────────────────────────────────────────
    const clientProfileHelper = new ClientProfile(db);
    const semanticSearchHelper = new SemanticSearch(db);

    let clientHistory = [];
    try {
      const clientRecord = await clientProfileHelper.getByName(clientName);
      if (clientRecord && clientRecord.length > 0) {
        clientHistory = await clientProfileHelper.getHistory(clientRecord[0].id);
      }
    } catch (err) {
      console.warn('[BlueprintWorker] Failed to load client history memory:', err);
    }

    let similarProjects = [];
    try {
      similarProjects = await semanticSearchHelper.search(`${projectType} ${projectName} ${requirements}`, { limit: 3 });
    } catch (err) {
      console.warn('[BlueprintWorker] Failed to perform semantic search memory:', err);
    }

    // ── 2. Normalize and retrieve Context (Problem 1) ──────────────────────
    const customDomain = params.customDomain || params.businessDomain || 'E-Commerce';
    const normalizedType = normalizeType(projectType);
    const normalizedDomain = normalizeDomain(customDomain);

    // ── 2.5. Fetch or seed Client Context (Context Memory) ───────────────────
    let clientContext = await getClientProfile(projectId).catch(() => null);
    if (!clientContext) {
      const defaultProfile = `${clientName} operating in the business domain of ${customDomain}. Focuses on professional operations and service delivery.`;
      const defaultConstraints = `Must focus on local-first SQLite database architecture, offline reliability, sequential workflow dependency structures, and maximum cost efficiency (₹0 LLM fallbacks).`;
      const defaultPreferences = `Premium glassmorphic user interface matching modern professional AI agency standards (bg-white/5, backdrop-blur-xl, border-white/10).`;
      
      await saveClientProfile(projectId, clientName, {
        profile: defaultProfile,
        constraints: defaultConstraints,
        preferences: defaultPreferences
      }).catch(err => console.error('[BlueprintWorker Context Seeding Err]', err));
      
      clientContext = await getClientProfile(projectId).catch(() => null);
    } else if (params.clientProfile || params.clientConstraints || params.clientPreferences) {
      // Dynamic updates to Client Context if passed via parameters
      const updatedProfile = params.clientProfile || clientContext.business_profile;
      const updatedConstraints = params.clientConstraints || clientContext.constraints;
      const updatedPreferences = params.clientPreferences || clientContext.custom_preferences;
      
      await saveClientProfile(projectId, clientName, {
        profile: updatedProfile,
        constraints: updatedConstraints,
        preferences: updatedPreferences
      }).catch(err => console.error('[BlueprintWorker Context Update Err]', err));
      
      clientContext = await getClientProfile(projectId).catch(() => null);
    }

    const typeContext = BUILD_TYPE_CONTEXT[normalizedType] || BUILD_TYPE_CONTEXT['website'];
    const domainContext = DOMAIN_CONTEXT[normalizedDomain] || DOMAIN_CONTEXT['ecommerce'];

    // ── 3. Fetch analyst report if available ──────────────────────────────────
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

    // ── 4. Dynamic Timeline and Cost Metrics (Problem 3, Bonus 6) ─────────────
    const timeline = calculateRealisticTimeline(normalizedType, 'standard');
    const totalHours = timeline.total_hours;
    const projectCost = 800 + totalHours * 500;

    // ── 5. Generate Risk Flags (Bonus 7) ──────────────────────────────────────
    const riskFlags = [];
    riskFlags.push("⚠️ LLM API quota threshold caution — offline backup Ollama Gemma active");
    if (customDomain === 'Other' || !DOMAIN_CONTEXT[normalizedDomain]) {
      riskFlags.push("⚠️ Client ne custom domain select kiya hai — extra research time +₹2000 scope impact");
    }
    if (requirements.includes('ATTACHED FILE DETECTED') || requirements.includes('Binary attachment')) {
      riskFlags.push("⚠️ Attached files context detected — structural API mapping check needed in build");
    }
    if (riskFlags.length === 1) {
      riskFlags.push("✅ No critical platform delivery blockers identified.");
    }

    // ── 6. LLM CALL 1 — Context-Aware PRD with Hinglish Summary ────────────────
    const prdPrompt = `You are a Senior Product Manager at a premium AI agency.
Write a detailed, premium, context-specific PRD (Product Requirements Document) in Markdown format for the following project.
PROJECT TYPE: ${projectType}
DOMAIN: ${customDomain}
FOCUS AREAS: ${typeContext.focusAreas.join(', ')}
TECH STACK CONTEXT: ${typeContext.techStack.join(', ')}
DELIVERABLES: ${typeContext.deliverables.join(', ')}
USER STORIES STYLE: ${typeContext.userStoryTemplate}
COMPETITORS: ${domainContext.competitors.join(', ')}
CORE KEYWORDS: ${domainContext.keywords.join(', ')}

CLIENT CONTEXT MEMORY:
- CLIENT NAME: ${clientName}
- BUSINESS PROFILE: ${clientContext ? clientContext.business_profile : 'Digital operations and presence.'}
- OPERATIONAL CONSTRAINTS: ${clientContext ? clientContext.constraints : 'No operational constraints specified.'}
- CLIENT PREFERENCES: ${clientContext ? clientContext.custom_preferences : 'Standard clean glassmorphic interface.'}
- CLIENT PAST PREFERENCES HISTORY: ${clientHistory && clientHistory.length > 0 ? JSON.stringify(clientHistory, null, 2) : 'None recorded yet.'}
- SIMILAR PAST COMPLETED PROJECTS FOR REFERENCE: ${similarProjects && similarProjects.length > 0 ? similarProjects.map(p => `Project ID: ${p.projectId}, Relevance: ${p.relevance}%`).join('; ') : 'None found.'}

Instructions:
1. Start the PRD document with a section titled '# Executive Summary (Mickii Explainer)' written in engaging, warm, professional Hinglish. Explain to the business owner what this build accomplishes, why it is highly profitable, and how it beats competitors like ${domainContext.competitors.join(', ')}. Use words like 'Boss', 'paisa', 'dhandha', etc.
2. Include these standard sections: Overview, Problem Statement, Goals & Success Metrics, User Stories (at least 8 detailed stories), Functional Requirements, Non-Functional Requirements, Out of Scope, and Acceptance Criteria.
3. Output ONLY valid Markdown. Avoid wrappers or preambles.
4. STEP-BY-STEP REASONING REQUIRED: You must reason deeply about what the selected BUILD TYPE and BUSINESS DOMAIN require. For example, if E-Commerce is selected, the application MUST include cart, checkout, return/refund policies, payment gateway integrations (Stripe/Razorpay), inventory syncs, and GST invoicing. These are 100% IN SCOPE. Do not label core features as out of scope.
5. DEEP DOMAIN KNOWLEDGE: Incorporate realistic, premium industry-specific modules. Never use generic outlines. Specify concrete data models, tax constraints (e.g. GST/VAT), secure checkout validations, and realistic user stories (at least 8 distinct, comprehensive user stories covering order tracking, inventory updates, and checkout flows).`;

    const prdUser = `Project: ${projectName}\nClient: ${clientName}\nType: ${projectType}\nRequirements: ${requirements}\n${analystContext ? 'Market Context: ' + analystContext.slice(0, 450) : ''}`;

    let prdText = '';
    let validationIssues = [];
    let strikes = 0;
    const maxStrikes = 3;
    let currentPrdPrompt = prdPrompt;

    while (strikes < maxStrikes) {
      let generatedText = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          generatedText = await executeLlmWithFallback(prdUser, currentPrdPrompt);
          break;
        } catch (err) {
          if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
          else generatedText = getFallbackPrd(projectName, clientName, projectType, customDomain, typeContext, domainContext);
        }
      }

      // Run strict validation scan
      validationIssues = scanOutputForIssues(generatedText, clientName);
      if (validationIssues.length === 0) {
        prdText = generatedText;
        break; // Passed validation!
      }

      strikes++;
      console.warn(`[Blueprint Maker] Strike ${strikes}/${maxStrikes} - Validation failed:`, validationIssues);

      // Mutate the prompt for the next strike to feed back the validation issues
      currentPrdPrompt = `${prdPrompt}

🚨 IMPORTANT REVISION FEEDBACK (STRIKE ${strikes}/${maxStrikes}):
Your previous generated PRD failed content validation checks with the following strict issues:
${validationIssues.map(issue => `- ${issue}`).join('\n')}

Please rewrite the entire PRD document.
Ensure you strictly adhere to these critical guidelines:
1. NEVER include the developer engine brand names ("Mabishion AI", "Mickii", "Nexious AI", "Mabishion", "Nexious") in the client-facing content.
2. DO NOT use generic placeholder text or template brackets (e.g. "[insert ...]", "lorem ipsum", "placeholder").
3. Avoid generic marketing fluff and instead provide specific, real client features and business specifics.
4. Make sure to clearly mention the client's name ("${clientName}") and their business domain ("${customDomain}").`;
    }

    if (validationIssues.length > 0) {
      console.error('[Blueprint Maker] Strict Validation Failed after 3 strikes!', validationIssues);
      throw new Error(`Strict Validation Failed after 3 strikes: ${validationIssues.join('; ')}`);
    }

    // ── 7. LLM CALL 2 — Context-Aware TRD + Architecture + Schema ──────────────
    const trdPrompt = `You are a Senior Solutions Architect at a premium AI agency.
Provide a highly detailed technical blueprint (TRD) JSON matching these keys ONLY:
{
  "trdMarkdown": "Detailed TRD in Markdown specifying system flow, Tauri IPC, and offline database operations.",
  "architectureDiagram": "ASCII text-based architecture diagram showing component relationships",
  "techStack": {
    "frontend": ["${typeContext.techStack.slice(0, 3).join('", "')}"],
    "backend": ["Tauri v2 (Rust Core)", "Node.js Core services"],
    "database": ["SQLite (Local First)"],
    "devops": ["Tauri compiler bundle (.deb/.AppImage)"],
    "ai": ["Google AI Studio Gemini 2.5", "Groq Llama 3.3"]
  },
  "databaseSchema": "SQL CREATE TABLE statements required for this build",
  "apiEndpoints": [
    { "method": "GET", "path": "/api/v1/projects", "description": "Fetch active projects", "auth": true }
  ],
  "securityChecklist": ["Verify safe Tauri IPC parameters", "Encrypt local sensitive settings"],
  "deploymentSteps": ["${typeContext.deploymentSteps.join('", "')}"]
}
No markdown wrappers. Only valid JSON.`;

    const trdUser = `Project: ${projectName}\nType: ${projectType}\nRequirements: ${requirements}\nStack Context: Tauri v2 desktop app, React 18, SQLite local first DB.`;

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

    if (!techData) {
      techData = getFallbackTechData(projectName, projectType, customDomain, typeContext, domainContext);
    }

    // ── 8. Compile Prepend Widgets (timeline, graph, cost, risks) ─────────────
    const prependMarkdown = `
# ⏱️ REALISTIC PRODUCTION TIMELINE
- **AI Core Generation Time:** ${timeline.ai_generation}
- **Human Approval Waiting Window:** ${timeline.approval_wait} (Standard Gate)
- **Estimated Revision Cycles:** ${timeline.revision_cycles} Client Review Rounds
- ───────────────────────────────────────
- **Total Duration Estimate:** **${timeline.total_estimate}**
- **Actual Product Launch Days:** **${Math.ceil(totalHours / 7)} days** (assuming 7h/day focused work)

## 💰 DYNAMIC COST ESTIMATOR
| Cost Component | Pricing (₹) | Details |
| :--- | :--- | :--- |
| LLM API Calls | ₹0 | Google AI Studio free tier fallback active |
| Hosting Configuration | ₹0 | Hobby-tier Vercel/Netlify hosting |
| Domain Registration | ₹800 / year | standard .com/.in domain reservation |
| Developer Resource Time | ₹${totalHours * 500} | ${totalHours} hours estimated effort at ₹500/h |
| **Total Project Cost** | **₹${projectCost}** | Core production execution baseline |
| **Suggested Client Charge** | **₹${Math.ceil(projectCost * 3)} - ₹${Math.ceil(projectCost * 5)}** | 220% - 410% profit margin recommendation |

## 📊 WORKER DEPENDENCY GRAPH
\`\`\`
┌────────────────────────────────────────────────────────────────────────┐
│                      WORKER DEPENDENCY GRAPH                           │
├────────────────────────────────────────────────────────────────────────┤
│  Parallel Discovery:                                                   │
│  [BA]  Business Analyst ───■ (Research completed)                     │
│  [LM]  Lead Manager    ───■ (Lead scoring sync)                       │
│                                                                        │
│  Sequential Pipeline:                                                  │
│  [BPM] Blueprint Maker ───➔ [DEV] Developer ───➔ [WB] Website Builder   │
│                                                     │                  │
│                                                     ▼                  │
│                                              [PKG] Packager (ZIP)      │
├────────────────────────────────────────────────────────────────────────┤
│  Legend: ───➔ Sequential Flow  |  ───■ Completion Barrier              │
└────────────────────────────────────────────────────────────────────────┘
\`\`\`

## ⚠️ PROJECT RISK AUDIT
${riskFlags.map(f => `- ${f}`).join('\n')}

---
\n`;

    // ── 7.5. Run Mickii Validation Scanner (validationIssues is already populated and verified in the strikes loop above) ──────

    // Incorporate the prepend widgets beautifully at the start of the PRD
    const prdTextWithWidgets = prependMarkdown + prdText;

    // ── 9. Fetch current version from SQLite and insert (Problem 2) ───────────
    const lastVersionRows = await db.select(
      'SELECT version FROM blueprints WHERE project_id = $1 ORDER BY version DESC LIMIT 1',
      [projectId]
    ).catch(() => []);

    let nextVersion = 1.0;
    if (lastVersionRows && lastVersionRows.length > 0) {
      nextVersion = parseFloat(lastVersionRows[0].version) + 0.1;
    }

    const blueprintId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO blueprints (id, project_id, prd_text, trd_text, architecture_diagram, tech_stack_json, database_schema, api_endpoints_json, security_checklist, deployment_steps, version, changes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)`,
      [
        blueprintId,
        projectId,
        prdTextWithWidgets,
        techData.trdMarkdown         || '',
        techData.architectureDiagram || '',
        JSON.stringify(techData.techStack        || {}),
        techData.databaseSchema      || '',
        JSON.stringify(techData.apiEndpoints     || []),
        JSON.stringify(techData.securityChecklist|| []),
        JSON.stringify(techData.deploymentSteps  || []),
        nextVersion.toFixed(1),
        params.changes || 'Initial technical blueprint'
      ]
    );

    // Update project stage to Planning
    await db.execute(
      "UPDATE projects SET stage = 'Planning', type = $1 WHERE id = $2",
      [projectType, projectId]
    ).catch(() => {});

    // Create 24h STANDARD approval gate request with version indicator
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const approvalId = crypto.randomUUID();
    
    await db.execute(
      `INSERT INTO approvals (id, title, type, project_id, worker_name, request_data, status, expires_at, created_at, owner_notified, whatsapp_sent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 0, 0)`,
      [
        approvalId,
        `Technical Architecture Blueprint for "${projectName}" (v${nextVersion.toFixed(1)})`,
        'standard',
        projectId,
        'Blueprint Maker',
        JSON.stringify({
          blueprintId,
          projectName,
          clientName,
          version: nextVersion.toFixed(1),
          summary: `PRD: ${prdTextWithWidgets.split('\n').length} lines | TRD: ${(techData.trdMarkdown || '').split('\n').length} lines | Schema: ${(techData.databaseSchema || '').split('\n').length} lines`,
          validationIssues
        }),
        'pending',
        expiresAt
      ]
    ).catch(err => console.error('[BlueprintWorker Approval Insert Err]', err));

    return {
      blueprintId,
      projectName,
      clientName,
      prdText: prdTextWithWidgets,
      trdMarkdown:         techData.trdMarkdown,
      architectureDiagram: techData.architectureDiagram,
      techStack:           techData.techStack,
      databaseSchema:      techData.databaseSchema,
      apiEndpoints:        techData.apiEndpoints,
      securityChecklist:   techData.securityChecklist,
      deploymentSteps:     techData.deploymentSteps,
      version: nextVersion.toFixed(1),
      summary: `Blueprint created for ${projectName} (v${nextVersion.toFixed(1)}) | PRD: ${prdTextWithWidgets.split('\n').length} lines | ${(techData.apiEndpoints || []).length} API endpoints | ${(techData.securityChecklist || []).length} security checks`,
      approvalId
    };
  }
}
