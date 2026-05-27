import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class ShowcaserWorker extends BaseWorker {
  constructor() {
    super('Showcaser', 'marketing', true, 'standard');
  }

  /**
   * Generates a polished portfolio case study from project data
   * @param {string} targetId   project_id from SQLite
   * @param {object} params     { client_name, results, testimonial_quote } (optional overrides)
   */
  async execute(targetId, params = {}) {
    const db = await getDb();

    // Fetch project from SQLite
    let project = null;
    try {
      const rows = await db.select('SELECT * FROM projects WHERE id = $1', [targetId]);
      if (rows && rows.length > 0) project = rows[0];
    } catch (e) {
      console.warn('[ShowcaserWorker] Project fetch failed, using params fallback:', e.message);
    }

    const projectName  = project?.name        || params.project_name  || 'AI Agency Kit';
    const clientName   = project?.client_name || params.client_name   || 'Valued Client';
    const projectType  = project?.type        || params.project_type  || 'Digital Product';
    const results      = params.results       || 'Increased lead conversion by 40%, saved 15h/week on manual work';
    const testimonial  = params.testimonial_quote || null;

    const systemPrompt = `You are Mickii Showcaser — an expert portfolio and case study writer for premium digital agencies.
You write compelling, results-driven case studies that build trust and attract high-ticket clients.
Return a valid JSON object with these keys ONLY:
- "caseStudyTitle": "Attention-grabbing case study headline",
- "executiveSummary": "2-3 sentence overview of the project and results",
- "challengeSection": "What problem was the client facing? (2 paragraphs)",
- "solutionSection": "How did we solve it? What was built? (2 paragraphs)",
- "resultsSection": "Specific measurable outcomes with numbers and percentages",
- "testimonialFormat": { "quote": "Realistic client quote", "author": "Name, Title, Company" },
- "keyMetrics": [{ "label": "metric name", "value": "metric value" }],
- "tags": ["tag1", "tag2", "tag3"]

Your output MUST be valid JSON. No markdown codeblocks.`;

    const userPrompt = `
Project Name: ${projectName}
Client Name: ${clientName}
Project Type: ${projectType}
Results Achieved: ${results}
${testimonial ? `Client Testimonial Quote: ${testimonial}` : ''}

Write a premium portfolio case study for this project.
`;

    let responseText;
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        responseText = await executeLlmWithFallback(userPrompt, systemPrompt);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`[ShowcaserWorker] LLM attempt ${attempt}/3 failed:`, err.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    if (!responseText) throw lastError || new Error('LLM call failed after 3 retries');

    let clean = responseText.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        caseStudyTitle: `How We Helped ${clientName} Achieve ${results.split(',')[0]}`,
        executiveSummary: `${clientName} partnered with us to build ${projectName}. The result: ${results}`,
        challengeSection: `${clientName} was struggling with inefficiencies in their workflow before our engagement.`,
        solutionSection: `We built ${projectName} — a custom AI-powered solution tailored to their exact needs.`,
        resultsSection: results,
        testimonialFormat: {
          quote: testimonial || `Working with Mabishion was a game-changer for our business. The results exceeded our expectations.`,
          author: `${clientName}, Owner`
        },
        keyMetrics: [{ label: 'Result', value: results.split(',')[0] }],
        tags: [projectType, 'AI', 'Digital Agency', clientName]
      };
    }

    // Ensure portfolio table exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS portfolio (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        client_name TEXT,
        case_study_title TEXT,
        executive_summary TEXT,
        challenge_section TEXT,
        solution_section TEXT,
        results_section TEXT,
        testimonial_format TEXT,
        key_metrics TEXT,
        tags TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const portfolioId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO portfolio (id, project_id, client_name, case_study_title, executive_summary, challenge_section, solution_section, results_section, testimonial_format, key_metrics, tags, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
      [
        portfolioId,
        targetId || '',
        clientName,
        parsed.caseStudyTitle || '',
        parsed.executiveSummary || '',
        parsed.challengeSection || '',
        parsed.solutionSection || '',
        parsed.resultsSection || '',
        JSON.stringify(parsed.testimonialFormat || {}),
        JSON.stringify(parsed.keyMetrics || []),
        JSON.stringify(parsed.tags || [])
      ]
    );

    return { ...parsed, portfolioId, projectName, clientName };
  }
}
