import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class ClientIntakeWorker extends BaseWorker {
  constructor() {
    super('Client Intake', 'sales', true, 'standard');
  }

  async execute(leadId, params = {}) {
    const db = await getDb();

    const leadRows = await db.select('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (!leadRows || leadRows.length === 0) {
      throw new Error(`Lead/Client ID "${leadId}" not found in leads table.`);
    }
    const lead = leadRows[0];

    let project = null;
    if (params.project_id) {
      const projRows = await db.select('SELECT * FROM projects WHERE id = $1', [params.project_id]);
      if (projRows && projRows.length > 0) project = projRows[0];
    }

    const clientName  = lead.name     || 'Valued Client';
    const projectName = project?.name || params.project_name || 'Custom AI Project';
    const projectType = project?.type || 'Digital Product';
    const budget      = lead.budget   || 'As discussed';

    const systemPrompt = `You are Mickii Client Success Manager — expert in client onboarding for premium digital agencies.
Return a valid JSON object ONLY with keys: welcomeEmail, questionnaire (10 items), projectTimeline (5 weeks), communicationPlan. No markdown.`;

    const userPrompt = `Client: ${clientName} | Project: ${projectName} | Type: ${projectType} | Budget: ${budget} | Notes: ${lead.notes || 'None'}`;

    let responseText;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        responseText = await executeLlmWithFallback(userPrompt, systemPrompt);
        break;
      } catch (err) {
        lastError = err;
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
    if (!responseText) throw lastError || new Error('LLM failed after 3 retries');

    let clean = responseText.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let parsed;
    try { parsed = JSON.parse(clean); } catch {
      parsed = {
        welcomeEmail: {
          subject: `Welcome to Mabishion, ${clientName}! Your ${projectName} journey starts now`,
          body: `Dear ${clientName},\n\nWelcome aboard! We're thrilled to partner with you on ${projectName}.\n\nNext steps:\n1. Complete the questionnaire\n2. Schedule your kickoff call\n3. Review the project timeline\n\nWarm regards,\nThe Mabishion Team`
        },
        questionnaire: [
          { id: 1,  question: 'What is the primary goal you want to achieve?', type: 'text', options: [] },
          { id: 2,  question: 'Who is your target audience?', type: 'text', options: [] },
          { id: 3,  question: 'What platforms do you currently use for marketing?', type: 'text', options: [] },
          { id: 4,  question: 'Do you have existing branding guidelines?', type: 'choice', options: ['Yes — will share', 'Yes — verbal only', 'No — needs creation'] },
          { id: 5,  question: 'What is your preferred communication style?', type: 'choice', options: ['Daily updates', 'Weekly summary', 'Milestones only', 'As needed'] },
          { id: 6,  question: 'What is your expected launch deadline?', type: 'text', options: [] },
          { id: 7,  question: 'Are there competitors or examples you admire?', type: 'text', options: [] },
          { id: 8,  question: 'How tech-savvy are you (1-10)?', type: 'scale', options: ['1','2','3','4','5','6','7','8','9','10'] },
          { id: 9,  question: 'What does success look like 90 days after delivery?', type: 'text', options: [] },
          { id: 10, question: 'Anything specific we should know or avoid?', type: 'text', options: [] },
        ],
        projectTimeline: [
          { week: 1, phase: 'Discovery & Planning',  deliverables: ['Requirements sign-off', 'Tech stack', 'Kickoff call'], milestone: 'Blueprint Approved' },
          { week: 2, phase: 'Design & Architecture', deliverables: ['UI wireframes', 'Database schema'],                   milestone: 'Design Sign-off' },
          { week: 3, phase: 'Core Build',            deliverables: ['Frontend components', 'Backend integrations'],        milestone: '50% Build Complete' },
          { week: 4, phase: 'Testing & QA',          deliverables: ['Bug fixes', 'Client UAT'],                           milestone: 'QA Cleared' },
          { week: 5, phase: 'Launch & Handover',     deliverables: ['Live deployment', 'User manual', 'Training call'],   milestone: 'Project Delivered' },
        ],
        communicationPlan: {
          primaryChannel: 'WhatsApp + Email',
          meetingCadence: 'Weekly 30-min check-in every Monday at 11 AM IST',
          responseTime:   'Within 4 business hours',
          updates:        'Progress report every Friday via email',
          escalation:     'Direct WhatsApp for urgent issues'
        }
      };
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        lead_id TEXT,
        project_id TEXT,
        client_name TEXT,
        welcome_email TEXT,
        questionnaire TEXT,
        project_timeline TEXT,
        communication_plan TEXT,
        onboarding_status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const clientId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO clients (id, lead_id, project_id, client_name, welcome_email, questionnaire, project_timeline, communication_plan, onboarding_status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)`,
      [
        clientId, leadId, params.project_id || '', clientName,
        JSON.stringify(parsed.welcomeEmail || {}),
        JSON.stringify(parsed.questionnaire || []),
        JSON.stringify(parsed.projectTimeline || []),
        JSON.stringify(parsed.communicationPlan || {}),
        'pending'
      ]
    );

    if (params.project_id && parsed.projectTimeline) {
      await db.execute('ALTER TABLE projects ADD COLUMN timeline_json TEXT;').catch(() => {});
      await db.execute(
        'UPDATE projects SET timeline_json = $1 WHERE id = $2',
        [JSON.stringify(parsed.projectTimeline), params.project_id]
      ).catch(() => {});
    }

    return {
      clientId, leadId, clientName, projectName,
      welcomeEmail:      parsed.welcomeEmail,
      questionnaire:     parsed.questionnaire,
      projectTimeline:   parsed.projectTimeline,
      communicationPlan: parsed.communicationPlan,
      summary: `Onboarding kit ready for ${clientName} | ${parsed.questionnaire?.length || 0} questions | ${parsed.projectTimeline?.length || 0}-week timeline`
    };
  }
}
