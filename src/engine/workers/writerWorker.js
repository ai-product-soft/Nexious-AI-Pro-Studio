/**
 * writerWorker.js — Content Writer Worker
 * Queue: marketing | Approval: STANDARD
 * 
 * Generates: Blog posts, email copy, social captions,
 * landing page copy, case studies, newsletter editions.
 */

import { BaseWorker } from './baseWorker.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';
import { getDb } from '../../data/db.js';

export class WriterWorker extends BaseWorker {
  constructor(config = {}) {
    super({
      name: 'Writer',
      queue: 'marketing',
      requires_approval: true,
      approval_severity: 'standard',
      ...config
    });
  }

  /**
   * Content types supported:
   * blog_post | email_sequence | social_caption | landing_copy |
   * newsletter | case_study | ad_copy | whatsapp_message
   */
  async execute(input, hooks) {
    const {
      content_type = 'blog_post',
      topic = '',
      target_audience = 'small business owners',
      tone = 'professional',        // professional | casual | persuasive | urgent
      word_count = 500,
      project_id = null,
      keywords = [],
      brand_voice = 'Mabishion AI — Premium Digital Services'
    } = input;

    if (hooks?.onStatus) hooks.onStatus(`Writer: Generating ${content_type}...`);

    const db = await getDb();

    // Fetch project context if available
    let projectContext = '';
    if (project_id) {
      try {
        const projects = await db.select('SELECT name, description, stage FROM projects WHERE id = $1', [project_id]);
        if (projects.length > 0) {
          projectContext = `Project: ${projects[0].name} | Stage: ${projects[0].stage} | ${projects[0].description || ''}`;
        }
      } catch (e) {
        console.warn('[WriterWorker] Could not fetch project context:', e);
      }
    }

    const systemInstruction = `You are Mabishion AI's elite content writer. 
Brand Voice: ${brand_voice}
Style: Write in ${tone} tone for ${target_audience}.
Always produce ready-to-publish, high-quality content.
${keywords.length > 0 ? `Weave in these keywords naturally: ${keywords.join(', ')}` : ''}`;

    const contentPrompts = {
      blog_post: `Write a complete, SEO-optimized blog post about: "${topic}".
Structure: H1 Title > Hook intro (2-3 sentences) > 3-5 H2 sections with body text > Key Takeaways > CTA.
Target: ~${word_count} words. ${projectContext}`,

      email_sequence: `Write a 3-email nurture sequence for: "${topic}".
Email 1 (Day 0): Welcome + value delivery.
Email 2 (Day 3): Problem + solution story.
Email 3 (Day 7): Social proof + CTA.
Each email: Subject line + Preview text + Body + PS. ${projectContext}`,

      social_caption: `Write 5 social media captions for: "${topic}".
Platforms: LinkedIn, Instagram, X (Twitter), Facebook, WhatsApp Status.
Each: Platform-specific tone, hook first line, relevant hashtags, CTA.
Keep Instagram under 150 words, LinkedIn professional, X under 280 chars. ${projectContext}`,

      landing_copy: `Write complete landing page copy for: "${topic}".
Sections: Hero headline + subheadline + hero CTA | 3 key benefits with icons | 
How It Works (3 steps) | Social proof section placeholder | FAQ (5 Q&As) | Final CTA.
Tone: Persuasive + professional. ~${word_count} words. ${projectContext}`,

      newsletter: `Write a weekly newsletter edition about: "${topic}".
Structure: Subject line + Preview | Greeting | Main story (300w) | 
3 Quick Tips | Tool/Resource spotlight | This Week's Win | Sign-off.
Tone: ${tone}. ${projectContext}`,

      case_study: `Write a detailed case study for: "${topic}".
Structure: Executive Summary | Client Background | Challenge/Problem | 
Our Solution (step by step) | Results & Metrics (use placeholder numbers) | 
Client Quote (placeholder) | Key Learnings | CTA.
~${word_count} words. ${projectContext}`,

      ad_copy: `Write 5 ad variations for: "${topic}".
Each variation: Headline (30 chars) + Description (90 chars) + CTA button text.
Platforms: Google Search, Facebook/Instagram Feed, LinkedIn, YouTube pre-roll.
Focus on pain points → solution → benefit. ${projectContext}`,

      whatsapp_message: `Write 3 WhatsApp business message templates for: "${topic}".
Each: Opening line | Value/offer | Personalization placeholder {{name}} | CTA | 
Emoji usage (tasteful). Keep under 200 chars each. ${projectContext}`
    };

    const prompt = contentPrompts[content_type] || contentPrompts.blog_post;

    let generatedContent = null;
    try {
      if (hooks?.onStatus) hooks.onStatus('Writer: Calling LLM brain...');
      generatedContent = await executeLlmWithFallback(prompt, systemInstruction);
    } catch (e) {
      console.warn('[WriterWorker] LLM failed, using fallback template:', e);
      generatedContent = this._fallbackContent(content_type, topic, tone, word_count);
    }

    // Save to written_content table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS written_content (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        content_type TEXT NOT NULL,
        topic TEXT,
        tone TEXT,
        target_audience TEXT,
        keywords TEXT,
        content TEXT NOT NULL,
        word_count INTEGER,
        approval_status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const contentId = crypto.randomUUID();
    const actualWordCount = generatedContent.split(/\s+/).length;

    await db.execute(
      `INSERT INTO written_content (id, project_id, content_type, topic, tone, target_audience, keywords, content, word_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [contentId, project_id, content_type, topic, tone, target_audience, JSON.stringify(keywords), generatedContent, actualWordCount]
    );

    if (hooks?.onStatus) hooks.onStatus(`Writer: ${content_type} saved (${actualWordCount} words). Approval needed.`);

    return {
      content_id: contentId,
      content_type,
      topic,
      tone,
      word_count: actualWordCount,
      content: generatedContent,
      approval_status: 'pending',
      requires_approval: true,
      approval_severity: 'standard'
    };
  }

  _fallbackContent(type, topic, tone, wordCount) {
    const templates = {
      blog_post: `# ${topic || 'The Complete Guide to Digital Success'}

## Introduction
In today's competitive digital landscape, success requires the right strategy, tools, and execution. This guide covers everything you need to know.

## Why This Matters
Understanding ${topic || 'digital strategy'} is essential for any business looking to grow online. The businesses that master this will outcompete those that don't.

## Key Strategies That Work
1. **Research First** — Always start with deep market understanding
2. **Build Systems** — Create repeatable processes, not one-off efforts  
3. **Measure Everything** — Track KPIs weekly and adjust accordingly
4. **Automate Smartly** — Use AI tools to scale without burning out

## Common Mistakes to Avoid
- Skipping the planning phase
- Ignoring customer feedback
- Underestimating competition
- Not investing in quality

## Key Takeaways
- Start with a clear goal and timeline
- Use data to make decisions, not guesswork
- Consistency beats perfection every time

## Next Steps
Ready to take action? Let's build something remarkable together. [Contact Mabishion AI]`,

      email_sequence: `**Email 1 — Day 0: Welcome**
Subject: You made the right choice 🎯
Preview: Here's what happens next...

Hi {{name}},

Welcome! You've just taken the first step toward transforming your digital presence.

Over the next few days, I'll share exactly how we help businesses like yours grow faster with less effort.

See you tomorrow,
[Your Name]

---

**Email 2 — Day 3: The Problem**
Subject: Why most businesses struggle online
Preview: It's not what you think...

Hi {{name}},

Most businesses struggle online for one reason: they're using tactics from 5 years ago.

The game has changed. Here's what's working now...
[Content continues]

---

**Email 3 — Day 7: The Solution**
Subject: Here's proof it works [Case Study]
Preview: Real results, real clients...

Hi {{name}},

[Client Name] came to us with [Problem]. In 90 days, we delivered [Result].

Ready to see similar results? Let's talk.

[Book a Free Strategy Call]`,

      social_caption: `**LinkedIn:**
Most businesses are leaving money on the table with ${topic || 'their digital strategy'}.

Here's what the top 1% do differently:
→ They systemize before they scale
→ They automate the repetitive
→ They focus on high-value activities only

Are you working smarter or just harder?

#BusinessGrowth #DigitalStrategy #Productivity #MabishionAI

---

**Instagram:**
The secret to scaling? Systems, not hustle. 🚀
${topic || 'Build smarter, earn more.'}

Save this for later! 💾
#GrowthMindset #BusinessTips #Entrepreneur

---

**X (Twitter):**
Hot take: Most "hustle culture" advice is keeping you broke.
${topic || 'Here\'s what actually works:'} 🧵

---

**WhatsApp Status:**
💡 Today's insight: ${topic || 'Smart systems beat hard work every time.'}
Contact us to learn how 👉`,

      landing_copy: `# Transform Your Business With ${topic || 'AI-Powered Digital Solutions'}

### Stop Losing Clients to Competitors Who Move Faster

**[Get Started Free →]**

---

## Why Mabishion AI?

✅ **Speed** — Deliver client projects 3x faster
✅ **Quality** — Premium outputs every time  
✅ **Automation** — Let AI handle the repetitive work

---

## How It Works

1. **Tell us your goal** — 15-min strategy call
2. **We build your system** — Custom AI workflow
3. **You scale** — More clients, less stress

---

## Frequently Asked Questions

**Q: How quickly will I see results?**
A: Most clients see measurable improvement within 30 days.

**Q: Do I need technical knowledge?**
A: No. We handle everything for you.

**Q: What's the investment?**
A: Packages start from ₹25,000/month.

---

## Ready to Start?

**[Book Your Free Strategy Call →]**

*Limited spots available this month.*`
    };

    return templates[type] || templates.blog_post;
  }
}
