import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class SelfPromoWorker extends BaseWorker {
  constructor() {
    super('Self Promo', 'marketing', true, 'standard');
  }

  /**
   * Generates a personal branding post for the owner
   * @param {string} targetId  Unused (owner-level worker, no specific entity)
   * @param {object} params    { topic, platform }
   */
  async execute(targetId, params = {}) {
    const db = await getDb();

    const topic    = params.topic    || 'AI-powered digital services';
    const platform = params.platform || 'LinkedIn';

    const systemPrompt = `You are Mickii Personal Brand Strategist — an expert social media copywriter for high-ticket digital agencies.
You craft viral, authentic personal branding posts that position the owner as the go-to expert.
Return a valid JSON object with these keys ONLY:
- "postText": "Full post text optimized for ${platform} (max 300 words, conversational yet authoritative)",
- "hashtags": ["array", "of", "5", "relevant", "hashtags"],
- "bestTimeToPost": "Best day and time window to publish on ${platform} for maximum reach",
- "engagementHook": "A question or CTA at the end of the post to drive comments"

Your output MUST be valid JSON. No markdown codeblocks.`;

    const userPrompt = `
Topic: ${topic}
Platform: ${platform}
Owner Context: Digital agency owner who delivers AI-powered services. Non-coder, marketing background.

Write a compelling personal branding post that positions this owner as a thought leader.
`;

    let responseText;
    let lastError;

    // 3x retry loop
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        responseText = await executeLlmWithFallback(userPrompt, systemPrompt);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`[SelfPromoWorker] LLM attempt ${attempt}/3 failed:`, err.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    if (!responseText) throw lastError || new Error('LLM call failed after 3 retries');

    // Strip markdown wrapper if present
    let clean = responseText.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        postText: clean.slice(0, 600),
        hashtags: ['#AIAgency', '#DigitalMarketing', '#PersonalBrand', '#Mabishion', '#GrowthHacking'],
        bestTimeToPost: 'Tuesday–Thursday, 9–11 AM IST',
        engagementHook: 'What tool or process has changed your business the most? Comment below! 👇'
      };
    }

    // Ensure table exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS marketing_posts (
        id TEXT PRIMARY KEY,
        topic TEXT,
        platform TEXT,
        post_text TEXT,
        hashtags TEXT,
        best_time TEXT,
        engagement_hook TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const postId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO marketing_posts (id, topic, platform, post_text, hashtags, best_time, engagement_hook, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        postId,
        topic,
        platform,
        parsed.postText || '',
        JSON.stringify(parsed.hashtags || []),
        parsed.bestTimeToPost || '',
        parsed.engagementHook || ''
      ]
    );

    return { ...parsed, postId, topic, platform };
  }
}
