import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class SocialSchedulerWorker extends BaseWorker {
  constructor() {
    // No approval required — auto-run system worker
    super('Social Scheduler', 'marketing', false, 'standard');
  }

  /**
   * Best posting times per platform (IST)
   */
  _bestTimes(platform) {
    const map = {
      LinkedIn:  { days: ['Tuesday', 'Wednesday', 'Thursday'], times: ['08:00', '10:30', '17:00'] },
      Instagram: { days: ['Monday', 'Wednesday', 'Friday'],    times: ['07:00', '11:00', '19:00'] },
      X:         { days: ['Monday', 'Tuesday', 'Thursday'],    times: ['09:00', '12:00', '18:00'] },
      Facebook:  { days: ['Wednesday', 'Thursday', 'Friday'],  times: ['09:00', '13:00', '16:00'] }
    };
    return map[platform] || map['LinkedIn'];
  }

  /**
   * Frequency optimizer: returns recommended post frequency
   */
  _frequencyFor(platform) {
    const freq = {
      LinkedIn: '3-4 posts/week',
      Instagram: '5-6 posts/week',
      X: '7-10 posts/day',
      Facebook: '3-5 posts/week'
    };
    return freq[platform] || '4 posts/week';
  }

  /**
   * Builds a content calendar for provided posts
   * @param {string} targetId   Owner or project reference ID
   * @param {object} params     { posts: [{text, platform}], startDate }
   */
  async execute(targetId, params = {}) {
    const db = await getDb();

    const rawPosts  = params.posts     || [];
    const startDate = params.startDate || new Date().toISOString().split('T')[0];

    // If no posts provided, generate sample topics via LLM
    let postsToSchedule = rawPosts;

    if (!postsToSchedule || postsToSchedule.length === 0) {
      const systemPrompt = `You are a content strategist. Generate a 5-post content calendar for a digital agency owner for the upcoming week.
Return a valid JSON array of 5 objects, each with: { "text": "post content", "platform": "LinkedIn|Instagram|X", "topic": "topic tag" }
No markdown. Only valid JSON array.`;

      let responseText;
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          responseText = await executeLlmWithFallback(
            `Create a content calendar starting from ${startDate} for a digital marketing agency owner using AI tools.`,
            systemPrompt
          );
          break;
        } catch (err) {
          lastError = err;
          console.warn(`[SocialSchedulerWorker] LLM attempt ${attempt}/3 failed:`, err.message);
          if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }

      if (!responseText) throw lastError || new Error('LLM call failed after 3 retries');

      let clean = responseText.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      try {
        postsToSchedule = JSON.parse(clean);
      } catch {
        // Fallback hardcoded posts if parsing fails
        postsToSchedule = [
          { text: 'AI is reshaping how agencies deliver results. Here\'s what we\'re doing differently at Mabishion.', platform: 'LinkedIn', topic: 'AI Thought Leadership' },
          { text: '5 signs your business needs an AI upgrade NOW. Thread 🧵', platform: 'X', topic: 'Viral Thread' },
          { text: 'Behind the scenes: How we built a full AI client system in 7 days.', platform: 'Instagram', topic: 'Behind The Scenes' },
          { text: 'The biggest mistake agencies make with their client pipeline (and how we fixed it)', platform: 'LinkedIn', topic: 'Agency Tips' },
          { text: 'Your next client is already searching for you. Are you showing up?', platform: 'LinkedIn', topic: 'Lead Gen' }
        ];
      }
    }

    // Ensure content_calendar table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS content_calendar (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        platform TEXT,
        post_text TEXT,
        topic TEXT,
        scheduled_date TEXT,
        scheduled_time TEXT,
        best_day TEXT,
        frequency TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const scheduled = [];
    const baseDate = new Date(startDate);

    for (let i = 0; i < postsToSchedule.length; i++) {
      const post = postsToSchedule[i];
      const platform = post.platform || 'LinkedIn';
      const timing = this._bestTimes(platform);
      const frequency = this._frequencyFor(platform);

      // Spread posts across days starting from startDate
      const postDate = new Date(baseDate);
      postDate.setDate(baseDate.getDate() + Math.floor(i * 1.5)); // ~every 1.5 days

      const dayName = timing.days[i % timing.days.length];
      const timeSlot = timing.times[i % timing.times.length];
      const dateStr = postDate.toISOString().split('T')[0];

      const calId = crypto.randomUUID();

      await db.execute(
        `INSERT INTO content_calendar (id, owner_id, platform, post_text, topic, scheduled_date, scheduled_time, best_day, frequency, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
        [
          calId,
          targetId || 'owner',
          platform,
          post.text || '',
          post.topic || 'General',
          dateStr,
          timeSlot,
          dayName,
          frequency,
          'scheduled'
        ]
      );

      scheduled.push({ calId, platform, date: dateStr, time: timeSlot, day: dayName, frequency, text: post.text, topic: post.topic });
    }

    return {
      scheduledCount: scheduled.length,
      startDate,
      calendar: scheduled,
      summary: `${scheduled.length} posts scheduled across ${[...new Set(scheduled.map(s => s.platform))].join(', ')}`
    };
  }
}
