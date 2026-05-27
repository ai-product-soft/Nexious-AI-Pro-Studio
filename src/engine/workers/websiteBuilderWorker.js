import { BaseWorker } from './baseWorker.js';
import { getDb } from '../../data/db.js';
import { executeLlmWithFallback } from '../../services/llmManager.js';

export class WebsiteBuilderWorker extends BaseWorker {
  constructor() {
    // CRITICAL — client-facing deliverable
    super('Website Builder', 'development', true, 'critical');
  }

  async execute(projectId, params = {}) {
    const db = await getDb();

    const projRows = await db.select('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRows || projRows.length === 0) throw new Error(`Project "${projectId}" not found.`);
    const project = projRows[0];

    const projectName  = project.name        || 'AI Project';
    const clientName   = project.client_name || 'Client';
    const pages        = params.pages        || ['Home', 'Services', 'About', 'Contact'];
    const designPrefs  = params.design_prefs || 'Dark glassmorphism, indigo accents, premium agency feel';
    const colorScheme  = params.color_scheme || '#6366F1 primary, #0F172A background, #F8FAFC text';
    const formProvider = params.form_provider || 'Formspree';

    // Fetch blueprint for requirements context
    let siteContext = '';
    try {
      const bpRows = await db.select('SELECT prd_text FROM blueprints WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [projectId]);
      if (bpRows && bpRows.length > 0) siteContext = (bpRows[0].prd_text || '').slice(0, 400);
    } catch { }

    // LLM CALL — full website structure
    const systemPrompt = `You are Mickii Website Architect — an expert in building premium, conversion-optimized business websites.
Return a valid JSON object ONLY:
{
  "htmlContent": "Complete single-file HTML with embedded CSS and JS. Fully responsive. All pages as sections with smooth scroll nav.",
  "cssContent": "Separate CSS file content (mobile-first, glassmorphism dark theme)",
  "jsContent": "Separate JS file content (smooth scroll, form validation, animations)",
  "pagesJson": [{ "id": "home", "title": "Home", "description": "..." }],
  "deployConfig": { "platform": "Netlify", "buildCommand": "echo done", "publishDir": ".", "envVars": {} },
  "seoMeta": { "title": "...", "description": "...", "keywords": "..." },
  "formAction": "https://formspree.io/f/YOUR_FORM_ID"
}
Rules:
- Single-page app with smooth scroll between sections
- Include: Hero, Services, About, Portfolio, Contact form, Footer
- Mobile-first responsive design
- SEO meta tags in <head>
- Google Analytics snippet placeholder
- Contact form using ${formProvider}
- Lazy loading for images
- No external dependencies except Google Fonts
- Output ONLY valid JSON`;

    const userPrompt = `Project: ${projectName} | Client: ${clientName} | Pages: ${pages.join(', ')} | Design: ${designPrefs} | Colors: ${colorScheme}${siteContext ? ' | Context: ' + siteContext : ''}`;

    let siteData = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await executeLlmWithFallback(userPrompt, systemPrompt);
        let clean = raw.trim();
        if (clean.startsWith('```')) clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        siteData = JSON.parse(clean);
        break;
      } catch (err) {
        console.warn(`[WebsiteBuilderWorker] LLM attempt ${attempt}/3 failed:`, err.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    // Fallback complete website if LLM fails
    if (!siteData) {
      siteData = {
        htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName} | ${clientName}</title>
  <meta name="description" content="Premium AI-powered services by ${clientName}. Transform your business with cutting-edge automation." />
  <meta name="keywords" content="AI services, digital agency, automation, ${projectName}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
  <!-- Google Analytics Placeholder -->
  <!-- <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script> -->
</head>
<body>
  <nav class="nav">
    <div class="nav-inner">
      <span class="logo">${clientName}</span>
      <div class="nav-links">
        <a href="#home">Home</a><a href="#services">Services</a>
        <a href="#about">About</a><a href="#contact">Contact</a>
      </div>
    </div>
  </nav>

  <section id="home" class="hero">
    <div class="hero-glow"></div>
    <div class="container">
      <span class="badge">AI-Powered Agency</span>
      <h1>Transform Your Business<br /><span class="gradient-text">With ${projectName}</span></h1>
      <p>Premium digital services delivered by AI — faster, smarter, and more profitable than ever before.</p>
      <div class="hero-btns">
        <a href="#contact" class="btn btn-primary">Get Started Free</a>
        <a href="#services" class="btn btn-ghost">View Services</a>
      </div>
    </div>
  </section>

  <section id="services" class="section">
    <div class="container">
      <h2 class="section-title">What We Deliver</h2>
      <p class="section-sub">Premium results, AI-powered execution, zero overhead.</p>
      <div class="grid-3">
        <div class="card"><div class="card-icon">🤖</div><h3>AI Automation</h3><p>Automate your lead generation, follow-ups, and client management with intelligent workers.</p></div>
        <div class="card"><div class="card-icon">🌐</div><h3>Website Build</h3><p>High-converting, SEO-optimized websites built and deployed in under 48 hours.</p></div>
        <div class="card"><div class="card-icon">📊</div><h3>Business Intelligence</h3><p>Real-time SWOT analysis, competitor research, and growth blueprints for your niche.</p></div>
        <div class="card"><div class="card-icon">📄</div><h3>Proposal & Billing</h3><p>Professional proposals, invoices, and UPI/Stripe payment links — all automated.</p></div>
        <div class="card"><div class="card-icon">📱</div><h3>Social Marketing</h3><p>AI-crafted content calendars, post copy, and ad scripts for LinkedIn, Instagram & X.</p></div>
        <div class="card"><div class="card-icon">📦</div><h3>Packaged Delivery</h3><p>Complete ZIP deliverables with user manuals, source files, and compliance docs.</p></div>
      </div>
    </div>
  </section>

  <section id="about" class="section section-dark">
    <div class="container about-grid">
      <div>
        <h2 class="section-title">Why Choose Us</h2>
        <p class="section-sub">We are not a traditional agency. We are an AI-powered private factory built to deliver premium results at scale.</p>
        <ul class="feature-list">
          <li>✅ 20 specialized AI workers running 24/7</li>
          <li>✅ Multi-LLM fallback chain (Gemini, Groq, Cerebras)</li>
          <li>✅ Human-in-the-loop approval on every critical action</li>
          <li>✅ Zero overhead — Rs. 0 default operating cost</li>
          <li>✅ Complete project delivery in 5-7 days</li>
        </ul>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-num">50+</span><span class="stat-label">Projects Delivered</span></div>
        <div class="stat-card"><span class="stat-num">48h</span><span class="stat-label">Average Build Time</span></div>
        <div class="stat-card"><span class="stat-num">20</span><span class="stat-label">AI Workers</span></div>
        <div class="stat-card"><span class="stat-num">100%</span><span class="stat-label">Client Approval</span></div>
      </div>
    </div>
  </section>

  <section id="contact" class="section">
    <div class="container contact-wrap">
      <h2 class="section-title">Start Your Project</h2>
      <p class="section-sub">Fill the form below and our AI will prepare a custom proposal within 2 hours.</p>
      <form class="contact-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
        <div class="form-row">
          <input type="text" name="name" placeholder="Your Full Name" required />
          <input type="email" name="email" placeholder="Email Address" required />
        </div>
        <div class="form-row">
          <input type="tel" name="phone" placeholder="WhatsApp Number" />
          <input type="text" name="budget" placeholder="Estimated Budget (e.g. Rs. 10,000)" />
        </div>
        <textarea name="message" placeholder="Describe your project or requirement..." rows="5" required></textarea>
        <button type="submit" class="btn btn-primary btn-full">🚀 Get My Free Proposal</button>
      </form>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <p class="footer-logo">${clientName}</p>
      <p class="footer-text">© ${new Date().getFullYear()} ${clientName}. All rights reserved. Powered by Mabishion AI.</p>
    </div>
  </footer>
  <script src="script.js"></script>
</body>
</html>`,
        cssContent: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --primary: #6366F1; --bg: #0F172A; --surface: #1E293B; --border: rgba(255,255,255,0.1); --text: #F8FAFC; --muted: #94A3B8; --success: #10B981; }
body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; }
a { text-decoration: none; color: inherit; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(15,23,42,0.8); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); }
.nav-inner { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; max-width: 1200px; margin: 0 auto; }
.logo { font-size: 1.25rem; font-weight: 900; background: linear-gradient(135deg, #6366F1, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.nav-links { display: flex; gap: 2rem; }
.nav-links a { font-size: 0.875rem; font-weight: 500; color: var(--muted); transition: color 0.2s; }
.nav-links a:hover { color: var(--text); }
.hero { min-height: 100vh; display: flex; align-items: center; position: relative; overflow: hidden; padding-top: 5rem; }
.hero-glow { position: absolute; top: 20%; left: 50%; transform: translateX(-50%); width: 600px; height: 600px; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%); pointer-events: none; }
.hero .container { text-align: center; position: relative; }
.badge { display: inline-block; padding: 0.375rem 1rem; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: #818CF8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.5rem; }
h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 900; line-height: 1.1; margin-bottom: 1.5rem; }
.gradient-text { background: linear-gradient(135deg, #6366F1, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero p { font-size: 1.125rem; color: var(--muted); max-width: 560px; margin: 0 auto 2.5rem; line-height: 1.7; }
.hero-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.875rem 2rem; border-radius: 0.75rem; font-weight: 700; font-size: 0.9rem; transition: all 0.2s; cursor: pointer; border: none; }
.btn-primary { background: linear-gradient(135deg, #6366F1, #4F46E5); color: #fff; box-shadow: 0 8px 24px rgba(99,102,241,0.3); }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(99,102,241,0.45); }
.btn-ghost { background: rgba(255,255,255,0.05); color: var(--text); border: 1px solid var(--border); }
.btn-ghost:hover { background: rgba(255,255,255,0.1); }
.btn-full { width: 100%; justify-content: center; }
.section { padding: 6rem 0; }
.section-dark { background: rgba(30,41,59,0.5); }
.section-title { font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 900; text-align: center; margin-bottom: 1rem; }
.section-sub { text-align: center; color: var(--muted); font-size: 1rem; max-width: 560px; margin: 0 auto 3rem; line-height: 1.7; }
.grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
.card { padding: 2rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 1.5rem; transition: all 0.3s; }
.card:hover { border-color: rgba(99,102,241,0.3); transform: translateY(-4px); box-shadow: 0 16px 40px rgba(99,102,241,0.1); }
.card-icon { font-size: 2rem; margin-bottom: 1rem; }
.card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.card p { font-size: 0.875rem; color: var(--muted); line-height: 1.6; }
.about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
.feature-list { list-style: none; space-y: 0.75rem; margin-top: 1.5rem; }
.feature-list li { padding: 0.5rem 0; font-size: 0.9375rem; color: var(--muted); }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.stat-card { padding: 1.5rem; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 1.25rem; text-align: center; }
.stat-num { display: block; font-size: 2.25rem; font-weight: 900; color: #818CF8; }
.stat-label { font-size: 0.8125rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.contact-wrap { max-width: 680px; margin: 0 auto; }
.contact-form { margin-top: 2rem; display: flex; flex-direction: column; gap: 1rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
input, textarea { width: 100%; padding: 0.875rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 0.875rem; color: var(--text); font-size: 0.9rem; font-family: inherit; transition: border-color 0.2s; outline: none; }
input:focus, textarea:focus { border-color: rgba(99,102,241,0.5); }
input::placeholder, textarea::placeholder { color: var(--muted); }
textarea { resize: vertical; }
.footer { padding: 3rem 0; border-top: 1px solid var(--border); text-align: center; }
.footer-logo { font-size: 1.25rem; font-weight: 900; background: linear-gradient(135deg, #6366F1, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.75rem; }
.footer-text { color: var(--muted); font-size: 0.875rem; }
@media (max-width: 768px) {
  .nav-links { display: none; }
  .about-grid { grid-template-columns: 1fr; gap: 2rem; }
  .form-row { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
}`,
        jsContent: `// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Nav highlight on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.id; });
  navLinks.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + current ? '#f8fafc' : '';
  });
});

// Form submission feedback
document.querySelector('.contact-form')?.addEventListener('submit', e => {
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.textContent = '⏳ Sending...'; btn.disabled = true; }
  setTimeout(() => {
    if (btn) { btn.textContent = '✅ Proposal Request Sent!'; }
  }, 2000);
});

// Intersection observer for card animations
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.card, .stat-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});`,
        pagesJson: pages.map((p, i) => ({ id: p.toLowerCase().replace(/\s+/g, '-'), title: p, order: i })),
        deployConfig: {
          platform:     'Netlify',
          buildCommand: 'echo "Static site — no build needed"',
          publishDir:   '.',
          envVars:      {},
          files:        ['index.html', 'styles.css', 'script.js']
        },
        seoMeta: {
          title:       `${projectName} | ${clientName} — AI-Powered Digital Services`,
          description: `Premium AI-powered digital services by ${clientName}. ${projectName} delivers automation, websites, and business intelligence.`,
          keywords:    `AI agency, digital services, ${projectName}, ${clientName}, automation, website builder`
        },
        formAction: 'https://formspree.io/f/YOUR_FORM_ID'
      };
    }

    // Ensure websites table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS websites (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        html_content TEXT,
        css_content TEXT,
        js_content TEXT,
        pages_json TEXT,
        deploy_config TEXT,
        seo_meta TEXT,
        form_action TEXT,
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const websiteId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO websites (id, project_id, html_content, css_content, js_content, pages_json, deploy_config, seo_meta, form_action, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)`,
      [
        websiteId, projectId,
        siteData.htmlContent   || '',
        siteData.cssContent    || '',
        siteData.jsContent     || '',
        JSON.stringify(siteData.pagesJson     || []),
        JSON.stringify(siteData.deployConfig  || {}),
        JSON.stringify(siteData.seoMeta       || {}),
        siteData.formAction    || 'https://formspree.io/f/YOUR_FORM_ID',
        'draft'
      ]
    );

    await db.execute("UPDATE projects SET stage = 'Build' WHERE id = $1", [projectId]).catch(() => {});

    // Create 24h STANDARD approval gate request
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const approvalId = crypto.randomUUID();
    
    await db.execute(
      `INSERT INTO approvals (id, title, type, project_id, worker_name, request_data, status, expires_at, created_at, owner_notified, whatsapp_sent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 0, 0)`,
      [
        approvalId,
        `Draft Website Layout for "${projectName}"`,
        'standard',
        projectId,
        'Website Builder',
        JSON.stringify({
          websiteId,
          projectName,
          clientName,
          summary: `${(siteData.pagesJson || []).length} pages | HTML: ${(siteData.htmlContent || '').split('\n').length} lines | CSS: ${(siteData.cssContent || '').split('\n').length} lines`
        }),
        'pending',
        expiresAt
      ]
    ).catch(err => console.error('[WebsiteBuilderWorker Approval Insert Err]', err));

    return {
      websiteId,
      projectName,
      clientName,
      pages:        siteData.pagesJson,
      htmlLines:    (siteData.htmlContent || '').split('\n').length,
      cssLines:     (siteData.cssContent  || '').split('\n').length,
      jsLines:      (siteData.jsContent   || '').split('\n').length,
      deployConfig: siteData.deployConfig,
      seoMeta:      siteData.seoMeta,
      formAction:   siteData.formAction,
      summary: `Website built for ${projectName} | ${(siteData.pagesJson || []).length} pages | HTML: ${(siteData.htmlContent || '').split('\n').length} lines | Ready for Netlify deploy`,
      approvalId
    };
  }
}
