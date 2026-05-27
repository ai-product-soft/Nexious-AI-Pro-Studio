// Mabishion AI — All mock data constants
// Auto-generated from NexiousApp_Fixed.jsx

export const DASHBOARD_PROJECTS = [
  { name: "AI Website Builder", type: "Internal Product", phase: "Design", progress: 72, health: "Stable", tone: "gold", approvals: 1, last: "12 min ago" },
  { name: "Lead Engine", type: "Automation Tool", phase: "Build", progress: 54, health: "Needs Review", tone: "danger", approvals: 2, last: "38 min ago" },
  { name: "Agency Kit", type: "Digital Product", phase: "Testing", progress: 86, health: "Strong", tone: "success", approvals: 0, last: "1 hr ago" },
  { name: "Proposal OS", type: "Client Asset", phase: "Research", progress: 38, health: "Blocked", tone: "violet", approvals: 1, last: "2 hr ago" },
];

export const DASHBOARD_APPROVALS = [
  { title: "Send James proposal", source: "Leads", risk: "Client Message" },
  { title: "Activate lead reply workflow", source: "Automations", risk: "External Action" },
  { title: "Change product price", source: "Products", risk: "Revenue Impact" },
];

export const CMD_MEMORY = [
  { label: "Project", value: "AI Website Builder", status: "Loaded" },
  { label: "Lead", value: "Priya Sharma", status: "Warm" },
  { label: "Product", value: "Agency Kit", status: "Draft" },
  { label: "Research", value: "Landing page proof angles", status: "3 sources" },
];

export const CMD_CHAT = [
  { role: "mickii", text: "Adii, current context AI Website Builder pe loaded hai. Main hero copy, section order, aur preview canvas update kar sakta hoon.", meta: "Context loaded · Hinglish" },
  { role: "adii", text: "Hero section ko more premium bana, but client-facing copy proper English me rakhna.", meta: "User command" },
  { role: "mickii", text: "Done. Professional English copy draft ready hai. Source check clean hai, confidence 91%. Draft only — no external action.", meta: "Draft only · No external action" },
];

export const PROJ_PROJECTS = [
  { id: 1, name: "AI Website Builder", client: "Internal", phase: "Design", health: "Stable", progress: 72, tone: "gold", tasks: 14, blocking: 1, due: "May 20" },
  { id: 2, name: "Lead Engine", client: "Internal", phase: "Build", health: "Needs Review", progress: 54, tone: "danger", tasks: 22, blocking: 3, due: "May 15" },
  { id: 3, name: "Agency Kit", client: "Internal", phase: "Testing", health: "Strong", progress: 86, tone: "success", tasks: 8, blocking: 0, due: "May 12" },
  { id: 4, name: "Proposal OS", client: "Mabishion Internal", phase: "Research", health: "Blocked", progress: 38, tone: "violet", tasks: 10, blocking: 2, due: "May 28" },
  { id: 5, name: "Client Dashboard v2", client: "Rahul Enterprises", phase: "Design", health: "Stable", progress: 61, tone: "cyan", tasks: 18, blocking: 0, due: "Jun 3" },
  { id: 6, name: "Content Calendar Bot", client: "Internal", phase: "Sandbox", health: "Strong", progress: 90, tone: "success", tasks: 6, blocking: 0, due: "May 10" },
];

export const KANBAN_COLS = ["Research", "Design", "Build", "Sandbox", "Test", "Ready", "Delivered / Archived"];

export const LEADS_DATA = [
  { id: 1, name: "Priya Sharma", company: "StyleCo", heat: "Hot", stage: "Negotiating", value: 45000, source: "LinkedIn", lastContact: "2h ago", nextAction: "Send proposal" },
  { id: 2, name: "James Okafor", company: "TechVentures", heat: "Hot", stage: "Contacted", value: 32000, source: "Referral", lastContact: "5h ago", nextAction: "Follow-up call" },
  { id: 3, name: "Riya Patel", company: "StartupHub", heat: "Warm", stage: "New", value: 18000, source: "Instagram", lastContact: "1d ago", nextAction: "Send intro message" },
  { id: 4, name: "Ananya Krishnan", company: "GrowthLab", heat: "Warm", stage: "Contacted", value: 27500, source: "WhatsApp", lastContact: "2d ago", nextAction: "Share case study" },
  { id: 5, name: "Dev Mehra", company: "SoloFounder", heat: "Cold", stage: "New", value: 9000, source: "Cold Email", lastContact: "5d ago", nextAction: "Re-engage" },
  { id: 6, name: "Sneha Nair", company: "MediaCo", heat: "Warm", stage: "Negotiating", value: 38000, source: "LinkedIn", lastContact: "3h ago", nextAction: "Send revised offer" },
];

export const PIPELINE_COLS = ["New", "Contacted", "Negotiating", "Closed Won", "Closed Lost"];

export const THREADS = [
  { id: 1, name: "Priya Sharma", platform: "WhatsApp", preview: "Thanks for the proposal, I'll review and get back", time: "2h ago", heat: "Hot", unread: 2, status: "awaiting-reply" },
  { id: 2, name: "James Okafor", platform: "LinkedIn", preview: "Can we schedule a quick 15 min call?", time: "5h ago", heat: "Hot", unread: 1, status: "schedule-call" },
  { id: 3, name: "Riya Patel", platform: "Instagram", preview: "Loved your recent post about AI agents!", time: "1d ago", heat: "Warm", unread: 0, status: "nurture" },
  { id: 4, name: "Ananya Krishnan", platform: "Email", preview: "Interested in the automation package, what are the next steps?", time: "2d ago", heat: "Warm", unread: 3, status: "awaiting-reply" },
  { id: 5, name: "TechVentures Team", platform: "Email", preview: "Following up on our previous conversation about the dashboard", time: "3d ago", heat: "Cold", unread: 0, status: "follow-up" },
];

export const PRODUCTS_DATA = [
  { id: 1, name: "Agency Kit", category: "Digital Product", status: "Active", priceInr: "₹2,999", priceUsd: "$39", orders: 14, health: 92, showroom: "Synced to Web", issue: "None" },
  { id: 2, name: "Proposal OS", category: "Template Pack", status: "Draft", priceInr: "₹999", priceUsd: "$12", orders: 0, health: 70, showroom: "Paused", issue: "Missing Cover Image" },
  { id: 3, name: "AI Website Builder", category: "SaaS Tool", status: "Active", priceInr: "₹4,999", priceUsd: "$59", orders: 2, health: 85, showroom: "Synced to Web", issue: "None" },
  { id: 4, name: "Lead Engine", category: "Automation", status: "Needs Fix", priceInr: "₹7,999", priceUsd: "$99", orders: 0, health: 45, showroom: "Not Synced", issue: "Integration broken" },
  { id: 5, name: "Content Calendar Bot", category: "Automation", status: "Active", priceInr: "₹1,499", priceUsd: "$19", orders: 3, health: 88, showroom: "Synced to Web", issue: "None" },
];

export const WORKFLOWS = [
  { id: 1, name: "Lead Follow-up Sequence", trigger: "New Lead Added", steps: 5, status: "Active", lastRun: "2h ago", runs: 47 },
  { id: 2, name: "Proposal Auto-Draft", trigger: "Lead Stage: Negotiating", steps: 3, status: "Active", lastRun: "5h ago", runs: 12 },
  { id: 3, name: "Weekly Report Generator", trigger: "Every Monday 9AM", steps: 4, status: "Active", lastRun: "3d ago", runs: 8 },
  { id: 4, name: "Client Onboarding", trigger: "Deal Closed Won", steps: 7, status: "Draft", lastRun: "Never", runs: 0 },
  { id: 5, name: "Content Repurpose Bot", trigger: "New Content Published", steps: 6, status: "Paused", lastRun: "1w ago", runs: 23 },
];

export const CANVAS_NODES = [
  { id: "trigger", label: "New Lead", x: 60, y: 120, type: "trigger" },
  { id: "score", label: "Score Lead", x: 220, y: 120, type: "action" },
  { id: "branch", label: "Hot / Warm?", x: 380, y: 120, type: "condition" },
  { id: "draft", label: "Draft Message", x: 540, y: 80, type: "action" },
  { id: "approve", label: "Adii YES?", x: 700, y: 80, type: "approval" },
  { id: "send", label: "Queue Send", x: 860, y: 80, type: "action" },
  { id: "nurture", label: "Nurture Seq", x: 540, y: 170, type: "action" },
];

export const CANVAS_CONNECTIONS = [
  { from: "trigger", to: "score" },
  { from: "score", to: "branch" },
  { from: "branch", to: "draft" },
  { from: "branch", to: "nurture" },
  { from: "draft", to: "approve" },
  { from: "approve", to: "send" },
];

export const CAMPAIGNS = [
  { id: 1, name: "Agency Kit Launch", channel: "LinkedIn + Email", status: "Active", reach: 1240, leads: 18, conversions: 3, budget: 0, roi: "High" },
  { id: 2, name: "Showroom Proof Series", channel: "Instagram", status: "Active", reach: 3800, leads: 24, conversions: 5, budget: 0, roi: "High" },
  { id: 3, name: "Cold Email Blitz", channel: "Email", status: "Paused", reach: 450, leads: 6, conversions: 1, budget: 0, roi: "Low" },
  { id: 4, name: "AI Thought Leadership", channel: "LinkedIn", status: "Draft", reach: 0, leads: 0, conversions: 0, budget: 0, roi: "TBD" },
];

export const KPI_CARDS = [
  { label: "Revenue MTD", value: "₹18.4K", change: "+12%", tone: "gold", icon: "currency" },
  { label: "Active Leads", value: "24", change: "+5", tone: "cyan", icon: "users" },
  { label: "Projects Live", value: "6", change: "Stable", tone: "success", icon: "factory" },
  { label: "Pending Tasks", value: "11", change: "High", tone: "danger", icon: "tasks" },
];

export const FINANCE_METRICS = [
  { label: "Revenue MTD", value: "₹18,400", change: "+12%", tone: "gold", icon: "currency" },
  { label: "Pipeline Value", value: "₹45,000", change: "+8%", tone: "cyan", icon: "chart" },
  { label: "Pending Invoices", value: "₹7,200", change: "3 open", tone: "gold", icon: "orders" },
  { label: "Monthly Burn", value: "₹2,100", change: "-5%", tone: "success", icon: "health" },
];

export const INCOME_ROWS = [
  { date: "May 3", client: "Priya Sharma", product: "Agency Kit", amount: 2999, status: "Paid" },
  { date: "May 1", client: "James Okafor", product: "Consultation", amount: 5000, status: "Paid" },
  { date: "Apr 28", client: "Riya Patel", product: "Agency Kit", amount: 2999, status: "Paid" },
  { date: "Apr 25", client: "Ananya Krishnan", product: "Content Calendar Bot", amount: 1499, status: "Paid" },
  { date: "Apr 22", client: "TechVentures", product: "Custom Project", amount: 15000, status: "Partial" },
];

export const IDEA_INBOX = [
  { id: 1, title: "Proposal OS v2 — AI-generated proposals", score: 91, tags: ["Product", "High-value"], status: "Validate" },
  { id: 2, title: "Micro SaaS: Lead Scoring Tool", score: 84, tags: ["SaaS", "Automation"], status: "Research" },
  { id: 3, title: "Mabishion AI Membership Community", score: 72, tags: ["Community", "Recurring"], status: "Backlog" },
  { id: 4, title: "LinkedIn Content Engine (Done-for-you)", score: 88, tags: ["Service", "High-ticket"], status: "Validate" },
  { id: 5, title: "AI Business Audit — Group Workshop", score: 65, tags: ["Workshop", "Mid-ticket"], status: "Backlog" },
];

export const VALIDATION_CHECKLIST = [
  { item: "Is there a clear, painful problem?", checked: true },
  { item: "Can I deliver this in under 2 weeks?", checked: true },
  { item: "Will someone pay ₹999+ for this?", checked: true },
  { item: "Do I have at least 3 warm leads who need this?", checked: false },
  { item: "Can this become a recurring product?", checked: false },
];
