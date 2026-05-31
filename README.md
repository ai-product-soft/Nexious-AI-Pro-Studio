<p align="center">
  <img src="assets/nex-banner.png?v=2" alt="Mabishion AI Studio Banner" width="100%">
</p>

<h1 align="center">Mabishion AI Studio v4.0</h1>

<p align="center">
  <strong>The First Fully Autonomous AI Agency Operating System</strong><br>
  Built for Digital Marketing Agencies, Freelancers, and AI-Native Service Businesses.
</p>

---

## 🎯 Vision

**Mabishion AI Studio** was born from a single belief: *A solo operator should be able to run a full-service digital agency without hiring a team.*

In 2025, digital marketing agencies spend 60-70% of revenue on payroll, project management overhead, and coordination chaos. **Mabishion eliminates that.** It is not just a CRM, not just a project tracker, and not just an AI chatbot. It is a **complete operating system** where 22 specialized AI workers handle everything from lead generation to website delivery — under one local-first, privacy-focused desktop application.

**Why it was built:**
- To remove dependency on 10+ SaaS subscriptions (Zapier, Notion, HubSpot, Figma, Canva, Buffer, etc.)
- To keep client data **local and encrypted** (SQLite + Tauri), not on someone else's cloud
- To let a single person execute like a 20-person agency
- To prove that **open-weight models + API orchestration** can outperform expensive enterprise stacks

---

## 🚀 What Makes It Different

| Traditional Stack | Mabishion AI Studio |
|-------------------|-------------------|
| 10+ SaaS tools ($500+/mo) | **One desktop app (FREE)** |
| 5-10 employees | **22 AI Workers** |
| Cloud data risk | **Local SQLite + Tauri binary** |
| Manual copy-paste between apps | **Autonomous pipeline: Lead → Project → Delivery** |
| Generic AI (ChatGPT web) | **Specialized workers with memory + context** |

---

## ✨ Core Features

### 🏢 Digital Marketing Command Center
- **Lead CRM** with pipeline stages, budget tracking (₹ support), and approval workflows
- **Campaign Tracker** for multi-channel marketing execution
- **Social Scheduler** with auto-content generation
- **SEO & Research** engine with SERP + deep research APIs
- **Finance Dashboard** with proposal → invoice → payment tracking

### 🤖 22 Autonomous AI Workers
Every worker is a specialized LLM agent with:
- **Role-specific system prompts**
- **SQLite memory** (context persists across sessions)
- **Approval gates** (critical actions need human sign-off)
- **Fallback chains** (Gemini → Groq → OpenRouter)

### 🖥️ Native Desktop App
- **Tauri v2** — Rust backend, React frontend
- **Cross-platform**: Linux `.deb`/`.AppImage`, Windows `.msi`, macOS `.dmg`
- **Lightweight** — <100MB install, runs on 8GB RAM laptops
- **Offline-first** — SQLite runs locally; only LLM calls need internet

---

## 🏗️ Architecture


---

## 🎯 Vision

**Mabishion AI Studio** was born from a single belief: *A solo operator should be able to run a full-service digital agency without hiring a team.*

In 2025, digital marketing agencies spend 60-70% of revenue on payroll, project management overhead, and coordination chaos. **Mabishion eliminates that.** It is not just a CRM, not just a project tracker, and not just an AI chatbot. It is a **complete operating system** where 22 specialized AI workers handle everything from lead generation to website delivery — under one local-first, privacy-focused desktop application.

**Why it was built:**
- To remove dependency on 10+ SaaS subscriptions (Zapier, Notion, HubSpot, Figma, Canva, Buffer, etc.)
- To keep client data **local and encrypted** (SQLite + Tauri), not on someone else's cloud
- To let a single person execute like a 20-person agency
- To prove that **open-weight models + API orchestration** can outperform expensive enterprise stacks

---

## 🚀 What Makes It Different

| Traditional Stack | Mabishion AI Studio |
|-------------------|-------------------|
| 10+ SaaS tools ($500+/mo) | **One desktop app (FREE)** |
| 5-10 employees | **22 AI Workers** |
| Cloud data risk | **Local SQLite + Tauri binary** |
| Manual copy-paste between apps | **Autonomous pipeline: Lead → Project → Delivery** |
| Generic AI (ChatGPT web) | **Specialized workers with memory + context** |

---

## ✨ Core Features

### 🏢 Digital Marketing Command Center
- **Lead CRM** with pipeline stages, budget tracking (₹ support), and approval workflows
- **Campaign Tracker** for multi-channel marketing execution
- **Social Scheduler** with auto-content generation
- **SEO & Research** engine with SERP + deep research APIs
- **Finance Dashboard** with proposal → invoice → payment tracking

### 🤖 22 Autonomous AI Workers
Every worker is a specialized LLM agent with:
- **Role-specific system prompts**
- **SQLite memory** (context persists across sessions)
- **Approval gates** (critical actions need human sign-off)
- **Fallback chains** (Gemini → Groq → OpenRouter)

### 🖥️ Native Desktop App
- **Tauri v2** — Rust backend, React frontend
- **Cross-platform**: Linux `.deb`/`.AppImage`, Windows `.msi`, macOS `.dmg`
- **Lightweight** — &lt;100MB install, runs on 8GB RAM laptops
- **Offline-first** — SQLite runs locally; only LLM calls need internet

---

## 🏗️ Architecture

┌─────────────────────────────────────────────┐
│           Tauri Desktop App                 │
│  (React 18 + Tailwind + Vite + Glassmorphism)│
├─────────────────────────────────────────────┤
│              Bridge Layer                     │
│     (Rust ↔ JavaScript via Tauri Commands)   │
├─────────────────────────────────────────────┤
│              Mickii Core                      │
│  • Intent Router  • Decision Engine           │
│  • Workflow Engine • Response Engine          │
├─────────────────────────────────────────────┤
│              22 AI Workers                    │
│  LeadGen → Writer → ImageGen → WebsiteBuilder │
│  SEO → Social → Ads → Finance → Legal         │
├─────────────────────────────────────────────┤
│              Cortex Engine                  │
│  LLM Router: Gemini → Groq → OpenRouter      │
├─────────────────────────────────────────────┤
│              SQLite Database                │
│  30+ Tables • 44KB • Backup/Restore         │
└─────────────────────────────────────────────┘

✨ Core Features
🏢 Digital Marketing Command Center

    Lead CRM with pipeline stages, budget tracking (₹ support), and approval workflows
    Campaign Tracker for multi-channel marketing execution
    Social Scheduler with auto-content generation
    SEO & Research engine with SERP + deep research APIs
    Finance Dashboard with proposal → invoice → payment tracking

## 📋 22 AI Workers Detail

| # | Worker | Role | Digital Marketing Relevance |
|---|--------|------|----------------------------|
| 1 | **leadGenWorker** | Ad copy, headlines, lead magnets | 🔥 Core — generates FB/Google ad copy |
| 2 | **leadManagerWorker** | Lead scoring & CRM updates | 🔥 Core — manages pipeline |
| 3 | **writerWorker** | Blogs, emails, landing pages, WhatsApp copy | 🔥 Core — all content generation |
| 4 | **imageGenWorker** | AI image generation (Pollinations.AI → SDXL) | 🔥 Core — creatives, banners, social posts |
| 5 | **websiteBuilderWorker** | Full website code (HTML/CSS/JS) | 🔥 Core — client delivery |
| 6 | **socialSchedulerWorker** | Social media calendar & posting | 🔥 Core — automation |
| 7 | **selfPromoWorker** | Social media posts for agency brand | 🔥 Core — agency marketing |
| 8 | **servicePromoWorker** | Service descriptions & marketing copy | 🔥 Core — package sales |
| 9 | **showcaserWorker** | Portfolio & case study generation | 🔥 Core — social proof |
| 10 | **documentorWorker** | User manuals, API docs, SOPs | Support — client handoff |
| 11 | **proposalMakerWorker** | Client proposals & contracts | Support — sales docs |
| 12 | **blueprintMakerWorker** | Technical architecture docs | Support — project planning |
| 13 | **businessAnalystWorker** | Requirements & gap analysis | Support — discovery |
| 14 | **clientIntakeWorker** | Onboarding forms & welcome kits | Support — client experience |
| 15 | **developerWorker** | Code generation & debugging | Support — custom dev |
| 16 | **packagerWorker** | ZIP bundling & delivery prep | Support — final delivery |
| 17 | **paymentHandlerWorker** | Invoice & payment tracking | Support — finance |
| 18 | **complianceWorker** | T&C, privacy policy, legal checks | Support — risk management |
| 19 | **notificationWorker** | Alerts, emails, WhatsApp alerts | Support — communication |
| 20 | **approvalEngine** | Human-in-the-loop gates | Governance — nothing ships without sign-off |
| 21 | **llmManagerWorker** | API key rotation & fallback | Infrastructure — keeps AI running |
| 22 | **mcpHubWorker** | External tool integration | Infrastructure — connects to 3rd party APIs |

---

## 🖥️ Screens (17 Active)

| Screen | Purpose |
|--------|---------|
| **DashboardScreen** | Agency overview, KPIs, quick actions |
| **LeadsScreen** | Full CRM — table, form, pipeline, detail drawer |
| **ProjectsScreen** | Project management with worker assignment |
| **ApprovalCenterScreen** | Human approval queue for critical actions |
| **SalesMarketingHubScreen** | Campaigns, ads, promotions unified view |
| **FinanceScreen** | Proposals, invoices, payments, P&L |
| **ReportsScreen** | Analytics, worker performance, revenue |
| **ResearchScreen** | SERP, deep web, competitor analysis |
| **AutomationsScreen** | Workflow builder, cron jobs, triggers |
| **SkillLibraryScreen** | Worker registry, skill cards, status |
| **SettingsScreen** | LLM keys, theme, database backup/restore |
| **WebsiteBuilderScreen** | Visual site builder (Phase 4) |
| **ClientPortalScreen** | Client-facing project view |
| **SEOConsoleScreen** | Rank tracking, audit, keyword research |
| **ContentStudioScreen** | Blog, email, social content calendar |
| **AdManagerScreen** | Meta/Google ad campaign manager |
| **WhatsAppHubScreen** | W Business API integration, broadcasts |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Tailwind CSS, Vite, Framer Motion |
| **Backend** | Tauri v2 (Rust), SQLite via `tauri-plugin-sql` |
| **AI Engine** | Cortex.js — Multi-provider router |
| **LLM Providers** | Google Gemini, Groq (Llama3), OpenRouter |
| **Image Gen** | Pollinations.AI (free) → Hugging Face SDXL |
| **Build Tool** | Vite + Rollup |
| **Package** | Tauri Bundler → `.deb`, `.msi`, `.dmg`, `.AppImage` |

---

## ⚡ Installation

### Linux (Ubuntu/Debian)
```bash
sudo dpkg -i mabishion-ai_0.1.0_amd64.deb
# Or portable:
chmod +x mabishion-ai_0.1.0_amd64.AppImage
./mabishion-ai_0.1.0_amd64.AppImage

Windows
Download .msi from Releases → Double click → Install
macOS
Download .dmg → Drag to Applications
🎮 Usage Flow
plain
Copy

1. Open App → Dashboard loads
2. Add Lead → LeadForm (₹ budget input, debounced save)
3. Approve Lead → ApprovalCenter → Status: Approved
4. Build Project → Auto-assign workers (Writer + ImageGen + WebsiteBuilder)
5. Generate Content → Writer creates copy → ImageGen creates banners
6. Build Website → WebsiteBuilder generates HTML/CSS/JS
7. Review & Approve → ApprovalCenter → Client preview
8. Package & Deliver → PackagerWorker → ZIP → Email/CPanel deploy
9. Invoice → PaymentHandler → Stripe integration

🗄️ Database Schema (SQLite)
30+ tables including:

    leads — Full CRM with custom fields
    projects — Project lifecycle tracking
    workers — 22 worker registry with status
    documents — Generated content storage
    approvals — Human-in-the-loop audit trail
    campaigns — Marketing campaign data
    invoices — Finance tracking
    settings — App configuration & API keys

Features:

    Auto-backup on every major action
    JSON export/import for migration
    Encrypted at rest (Tauri secure storage for keys)

🧠 The Effort Behind This

    This project represents 6+ months of iterative development across 4 major versions.

    v1.0 — Concept & SQLite schema design
    v2.0 — Tauri integration + first 10 workers
    v3.0 — CRM, Approval Engine, Finance module
    v4.0 — 22 workers, ImageGen, Writer, full pipeline

What went into v4.0 alone:

    20,000+ lines of JavaScript/React code
    3,000+ lines of Rust (Tauri backend)
    22 specialized LLM prompt systems
    30+ SQLite table designs
    17 screen components with glassmorphism UI
    6 critical bug fixes (column mapping, debounce, budget input, Ollama removal, dead imports)
    Cross-platform build pipeline (Linux .deb confirmed, Windows & macOS via CI/CD)
    Complete uninstall of legacy dependencies (Antigravity 2.0 removed due to instability)

Philosophy: Build once, own forever. No SaaS rent. No vendor lock-in. Your data, your workers, your agency.
🚧 Roadmap
Table
Phase	Feature	Status
✅ v4.0	22 Workers, SQLite, Tauri, CRM	COMPLETE
✅ v4.1	Visual Workflow Editor (React Flow)	COMPLETE
⏳ v4.2	WhatsApp Business API Integration	Pending Meta verification
⏳ v4.3	Stripe Live + Invoice Automation	Pending
⏳ v4.4	CPanel/FTP Auto-Deploy Tool	Pending
⏳ v4.5	Cloud Backend (Vercel/Render)	Future — reduce local load
⏳ v5.0	Multi-tenant Client Portal	Future
🎨 Branding
<p align="center">
  <img src="assets/mabishion-ai-banner.png?v=2" alt="Mabishion AI Logo" width="60%">
</p>
🤝 Contributing
This is a private project currently. For access or collaboration inquiries:

    Contact: adii.webg@gmail.com
    GitHub: @adiiweb

📜 License
Private / Proprietary — All rights reserved.
This software is not open-source. The codebase, worker prompts, and architecture are proprietary intellectual property of the author.
🙏 Acknowledgments

    Google Gemini — Primary reasoning engine
    Groq — Ultra-fast Llama3 inference
    Tauri — The framework that made desktop possible
    React + Tailwind — UI velocity
    SQLite — Zero-config local database

    "One human. Twenty-two workers. Infinite scale."
    — Mabishion AI Studio

Built with 🔥 in India. Powered by AI. Owned by you.
