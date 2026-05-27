import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class LeadManagerWorker extends BaseWorker {
  constructor() {
    // Score update = auto-run (no approval); nurturing sequence = STANDARD
    super('Lead Manager', 'sales', true, 'standard');
  }

  /**
   * Auto-calculates lead score, generates 5-email nurturing sequence,
   * sets follow-up reminder dates, and estimates conversion probability.
   * @param {string} leadId   SQLite lead ID
   * @param {object} params   { force_rescore }
   */
  async execute(leadId, params = {}) {
    const db = await getDb();

    // ── 1. Fetch lead ──────────────────────────────────────────────────────────
    const rows = await db.select('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (!rows || rows.length === 0) {
      throw new Error(`Lead ID "${leadId}" not found in SQLite leads table.`);
    }
    const lead = rows[0];

    // ── 2. Auto-calculate score (deterministic, no LLM needed) ────────────────
    let score = Number(lead.score) || 0;

    const scoreFactors = {
      hasEmail:    lead.email  ? 10 : 0,
      hasPhone:    lead.phone  ? 10 : 0,
      hasNotes:    lead.notes  ? 5  : 0,
      budgetScore: (() => {
        const b = String(lead.budget || '').replace(/[^0-9]/g, '');
        const n = parseInt(b, 10);
        if (n >= 10000) return 30;
        if (n >= 5000)  return 20;
        if (n >= 2000)  return 10;
        return 5;
      })(),
      sourceScore: {
        'LinkedIn':       15,
        'Referral':       20,
        'Google Ads':     12,
        'Meta Ads':       10,
        'Cold Outreach':  8,
        'Website':        10,
      }[lead.source] || 5,
      statusScore: {
        'Qualified':       15,
        'Contacted':       8,
        'New':             3,
        'Proposal Sent':   18,
        'Negotiating':     22,
        'Won':             30,
        'Lost':            0,
      }[lead.status] || 3,
    };

    score = Math.min(100, Object.values(scoreFactors).reduce((a, b) => a + b, 0));

    const conversionProbability = (() => {
      if (score >= 80) return '78-92%';
      if (score >= 60) return '45-65%';
      if (score >= 40) return '20-38%';
      return '5-18%';
    })();

    // ── 3. Follow-up reminder dates ───────────────────────────────────────────
    const today = new Date();
    const addDays = (d) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() + d);
      return dt.toISOString().split('T')[0];
    };

    const followUpReminders = [
      { day: 1,  label: 'Initial follow-up call',           date: addDays(1)  },
      { day: 3,  label: 'Send value-add content email',     date: addDays(3)  },
      { day: 7,  label: 'Proposal check-in',                date: addDays(7)  },
      { day: 14, label: 'Final decision nudge',             date: addDays(14) },
      { day: 21, label: 'Last-chance re-engagement',        date: addDays(21) },
    ];

    // ── 4. LLM — 5-email nurturing sequence ──────────────────────────────────
    const systemPrompt = `You are Mickii Lead Nurturing Specialist — an expert in high-ticket B2B sales sequences.
Create a 5-email nurturing sequence to convert a digital services prospect into a paying client.
Return a valid JSON array of 5 objects, each with:
{ "day": <number>, "subject": "<email subject>", "body": "<email body, 150-200 words, warm and professional>", "ctaText": "<call to action>", "ctaLink": "https://mabishion.ai/book" }
Day values: 0, 3, 7, 14, 21.
Only output the JSON array. No markdown, no backticks.`;

    const userPrompt = `
Lead Profile:
- Name: ${lead.name}
- Source: ${lead.source || 'Unknown'}
- Status: ${lead.status || 'New'}
- Budget: ${lead.budget || 'Not specified'}
- Score: ${score}/100
- Conversion Probability: ${conversionProbability}
- Notes: ${lead.notes || 'No additional notes'}

Write a warm, expert 5-email nurturing sequence that builds trust and pushes toward booking a call.
`;

    let responseText;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        responseText = await executeLlmWithFallback(userPrompt, systemPrompt);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`[LeadManagerWorker] LLM attempt ${attempt}/3 failed:`, err.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
    if (!responseText) throw lastError || new Error('LLM call failed after 3 retries');

    let clean = responseText.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let nurturingSequence;
    try {
      nurturingSequence = JSON.parse(clean);
      if (!Array.isArray(nurturingSequence)) throw new Error('Not an array');
    } catch {
      nurturingSequence = [
        { day: 0,  subject: `Welcome, ${lead.name}! Let's talk about your goals`,             body: `Hi ${lead.name}, thanks for connecting! I'd love to learn more about what you're looking to achieve. Our AI-powered services have helped agencies like yours grow significantly. Can we hop on a quick 15-min call?`, ctaText: 'Book a Call', ctaLink: 'https://mabishion.ai/book' },
        { day: 3,  subject: 'Here\'s how we helped a similar client',                          body: `${lead.name}, I wanted to share a quick win. A client in a similar situation to yours went from struggling with leads to closing 3 new deals in 60 days using our system. Want to see exactly what we did?`, ctaText: 'See Case Study', ctaLink: 'https://mabishion.ai/results' },
        { day: 7,  subject: 'Your free audit is ready',                                        body: `${lead.name}, I put together a quick audit of what's likely holding your growth back. Based on your profile, I see 3 specific opportunities. When's a good time to walk you through it?`, ctaText: 'Get My Audit', ctaLink: 'https://mabishion.ai/audit' },
        { day: 14, subject: 'Quick question, ${lead.name}',                                    body: `${lead.name}, I wanted to check in. Are you still looking to solve [challenge]? We have a spot opening up next week and I thought of you. No pressure — just want to make sure I don't lose touch.`, ctaText: 'Let\'s Connect', ctaLink: 'https://mabishion.ai/book' },
        { day: 21, subject: 'Last note from me, ${lead.name}',                                 body: `${lead.name}, I don't want to keep pinging you if now isn't the right time. But I'm reaching out one last time because I genuinely believe we can help. If you ever want to revisit this, I'm here.`, ctaText: 'Reply Anytime', ctaLink: 'https://mabishion.ai/contact' },
      ];
    }

    // ── 5. SQLite: ensure columns + update lead ──────────────────────────────
    await db.execute('ALTER TABLE leads ADD COLUMN nurturing_json TEXT;').catch(() => {});
    await db.execute('ALTER TABLE leads ADD COLUMN follow_up_dates TEXT;').catch(() => {});
    await db.execute('ALTER TABLE leads ADD COLUMN conversion_probability TEXT;').catch(() => {});

    await db.execute(
      `UPDATE leads SET score = $1, nurturing_json = $2, follow_up_dates = $3, conversion_probability = $4, last_contacted = CURRENT_TIMESTAMP WHERE id = $5`,
      [score, JSON.stringify(nurturingSequence), JSON.stringify(followUpReminders), conversionProbability, leadId]
    );

    return {
      leadId,
      leadName:             lead.name,
      updatedScore:         score,
      scoreFactors,
      conversionProbability,
      nurturingSequence,
      followUpReminders,
      summary: `Score: ${score}/100 | Conversion: ${conversionProbability} | ${nurturingSequence.length} nurturing emails scheduled`
    };
  }
}
