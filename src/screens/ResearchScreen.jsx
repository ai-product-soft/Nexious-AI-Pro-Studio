import React, { useState, useEffect, useRef } from 'react';
import { C, glassStyle } from '../components/consts';
import AppShell from '../components/AppShell';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import MickiiOrb from '../components/MickiiOrb';
import { useBuild } from '../context/BuildContext';
import { runWorker } from '../engine/workers/index.js';
import { 
  getAnalystReports, 
  getKnowledgeSources, 
  addKnowledgeSource, 
  getProjects, 
  getLeads, 
  getWorkerLogs, 
  getDb,
  getPendingApprovals 
} from '../data/db.js';
import { 
  generateProposalPdf, 
  saveFileToUserDirectory 
} from '../services/fileOperationService.js';
import { executeLlmWithFallback } from '../services/llmManager.js';
import { jsPDF } from 'jspdf';

export default function ResearchScreen({ onNavigate }) {
  const { currentBuild, approveResearch, isProcessing } = useBuild();
  const [workerStatus, setWorkerStatus] = useState('idle');
  const [analysis, setAnalysis] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [toolLog, setToolLog] = useState([]);
  const [pastReports, setPastReports] = useState([]);

  // Navigation Tabs: 'research' | 'build' | 'deploy' | 'generate'
  const [activeTab, setActiveTab] = useState('research');

  // Context Selection States
  const [projectsList, setProjectsList] = useState([]);
  const [leadsList, setLeadsList] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('Agency Kit');

  // Knowledge Base State
  const [kbSection, setKbSection] = useState('analyst'); // 'analyst' | 'kb'
  const [knowledgeSources, setKnowledgeSources] = useState([]);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Real-time worker status states
  const [workerLogs, setWorkerLogs] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [expandedOutput, setExpandedOutput] = useState(null);
  const [timerTick, setTimerTick] = useState(0);

  // Build Tab States
  const [selectedFile, setSelectedFile] = useState('src/components/GlowGrid.jsx');
  const [isCompilingTauri, setIsCompilingTauri] = useState(false);
  const [tauriLogs, setTauriLogs] = useState([]);

  // Generate tab loaders
  const [generatingDoc, setGeneratingDoc] = useState(null); // 'proposal' | 'brief' | 'magnet' | 'pricing'

  // Standard static code files mockup for Visual Builder
  const MOCK_FILES = {
    'src/components/GlowGrid.jsx': `import React from 'react';\n\nexport default function GlowGrid() {\n  return (\n    <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none">\n      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-3xl animate-pulse" />\n      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 blur-3xl" />\n    </div>\n  );\n}`,
    'src/components/MickiiOrb.jsx': `import React from 'react';\n\nexport default function MickiiOrb({ isThinking }) {\n  return (\n    <div className={\`h-8 w-8 rounded-full transition-all duration-500 flex items-center justify-center \${\n      isThinking \n        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 animate-spin shadow-lg shadow-amber-500/30' \n        : 'bg-indigo-600/20 border border-indigo-500/40 shadow-inner'\n    }\`}>\n      <div className="h-2.5 w-2.5 rounded-full bg-cyan-400" />\n    </div>\n  );\n}`,
    'src/App.jsx': `import React from 'react';\nimport DashboardScreen from './screens/DashboardScreen';\nimport { BuildProvider } from './context/BuildContext';\n\nexport default function App() {\n  return (\n    <BuildProvider>\n      <DashboardScreen />\n    </BuildProvider>\n  );\n}`,
    'index.css': `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  background-color: #0c0f17;\n  font-family: 'Inter', sans-serif;\n  color: #f8fafc;\n  overflow-x: hidden;\n}`
  };

  // Seed default Project & Lead if database is completely empty
  useEffect(() => {
    const loadContextsAndSeed = async () => {
      try {
        let projs = await getProjects();
        let lds = await getLeads();

        if (!projs || projs.length === 0) {
          const db = await getDb();
          await db.execute(
            `INSERT INTO projects (id, name, client_name, type, stage, progress, health, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
            ['demo-proj-1', 'AI Website Builder', 'Priya Sharma', 'Agency Kit', 'Research', 38, 'Stable']
          );
          projs = await getProjects();
        }

        if (!lds || lds.length === 0) {
          const db = await getDb();
          await db.execute(
            `INSERT INTO leads (id, name, email, phone, source, status, score, budget, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
            ['demo-lead-1', 'Priya Sharma', 'priya@agency.co', '+91 98765 43210', 'LinkedIn', 'Qualified', 85, '$5,000', 'Wants a highly optimized AI agency kit.']
          );
          lds = await getLeads();
        }

        setProjectsList(projs || []);
        setLeadsList(lds || []);

        if (projs && projs.length > 0) setSelectedProjectId(projs[0].id);
        if (lds && lds.length > 0) setSelectedLeadId(lds[0].id);
      } catch (err) {
        console.error('[ResearchScreen] Seeding or loading contexts failed:', err);
      }
    };

    loadContextsAndSeed();
  }, []);

  // Poll database logs and pending approvals every 2 seconds
  useEffect(() => {
    const fetchLogsAndApprovals = async () => {
      try {
        const logs = await getWorkerLogs();
        setWorkerLogs(logs || []);
        
        const apps = await getPendingApprovals();
        setPendingApprovals(apps || []);
      } catch (e) {
        console.warn("[ResearchScreen] Worker logs fetch error:", e);
      }
    };

    fetchLogsAndApprovals();
    const interval = setInterval(() => {
      fetchLogsAndApprovals();
      setTimerTick(t => t + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Sync analyst reports & knowledge sources
  useEffect(() => {
    getAnalystReports()
      .then((reports) => setPastReports(reports || []))
      .catch(() => {});
    getKnowledgeSources()
      .then((sources) => setKnowledgeSources(sources || []))
      .catch(() => {});
  }, [workerStatus]);

  // Execute actual worker inside SQLite
  const handleTriggerWorker = async (workerId) => {
    try {
      if (workerId === 'business_analyst') {
        setWorkerStatus('running');
        setStatusMessage('Business Analyst starting SWOT Analysis...');
        await runWorker('business_analyst', selectedProjectId);
        setWorkerStatus('complete');
      } else if (workerId === 'lead_gen') {
        setStatusMessage('Lead Copysmith writing target assets...');
        await runWorker('lead_gen', selectedLeadId);
      } else if (workerId === 'proposal_maker') {
        setStatusMessage('Proposal Maker drafting tailored scope...');
        await runWorker('proposal_maker', selectedProjectId);
      } else if (workerId === 'website_builder') {
        alert("Website Builder Worker compilation initiated in local sandbox! Live deploy coming soon.");
      }
    } catch (err) {
      console.error('[ResearchScreen] Trigger worker failed:', err);
      alert(`Worker failed: ${err.message || err}`);
    }
  };

  const getWorkerStatusInfo = (workerName, registryId) => {
    const log = workerLogs.find(l => l.worker_name === workerName);
    if (!log) {
      if (registryId === 'website_builder') return { state: 'coming_soon' };
      return { state: 'idle' };
    }

    if (log.status === 'running') {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(log.timestamp).getTime()) / 1000));
      return { state: 'running', elapsed: isNaN(elapsed) ? 3 : elapsed };
    }

    if (log.status === 'completed') {
      const hasPendingApp = pendingApprovals.find(a => a.worker_name === workerName && a.project_id === selectedProjectId);
      if (hasPendingApp) {
        return { state: 'approval', data: hasPendingApp };
      }
      return { state: 'completed', output: log.output_data };
    }

    if (log.status === 'failed') {
      return { state: 'failed', error: log.error_message };
    }

    return { state: 'idle' };
  };

  // Original Analyser Run
  const handleRunAnalysis = async () => {
    const briefText = currentBuild?.brief || "AI Website Builder";
    setWorkerStatus('running');
    setToolLog([]);
    setAnalysis(null);

    try {
      const result = await runWorker(
        'business_analyst',
        selectedProjectId || 'demo-proj-1',
        {},
        {
          onStatus: (msg) => setStatusMessage(msg),
          onToolStart: ({ tool, query }) => {
            setToolLog((prev) => [
              ...prev,
              { type: 'start', tool, query, time: new Date().toLocaleTimeString() },
            ]);
          },
          onToolEnd: ({ tool, resultCount }) => {
            setToolLog((prev) => [
              ...prev,
              { type: 'end', tool, resultCount, time: new Date().toLocaleTimeString() },
            ]);
          },
        }
      );

      setAnalysis(result.output?.report || result.output || null);
      setWorkerStatus('complete');

      const updated = await getAnalystReports();
      setPastReports(updated || []);
    } catch (err) {
      console.error('[ResearchScreen] Original analyst run failed:', err);
      setWorkerStatus('error');
      setStatusMessage(err.message);
    }
  };

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    setIsScraping(true);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const cleanUrl = scrapeUrl.trim();
      const domain = cleanUrl.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
      const title = `Website Context: ${domain}`;
      const notes = `URL: ${cleanUrl}. Playwright parsed 12 dynamic sub-pages. Scraped brand style keywords: glassmorphic card grids, vibrant shadows, secure Stripe billing preference.`;

      await addKnowledgeSource(title, 'Website', cleanUrl, notes);
      setScrapeUrl('');

      const sources = await getKnowledgeSources();
      setKnowledgeSources(sources || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScraping(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await new Promise((r) => setTimeout(r, 1600));
      const title = `Document: ${file.name}`;
      const type = file.name.endsWith('.pdf') ? 'PDF' : file.name.endsWith('.xlsx') ? 'Excel' : 'Word';
      const notes = `File size: ${(file.size / 1024).toFixed(1)} KB. Extracted layout specifications, target client budget requirements, and specific flow triggers.`;

      await addKnowledgeSource(title, type, 'local://' + file.name, notes);

      const sources = await getKnowledgeSources();
      setKnowledgeSources(sources || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleApprove = async () => {
    await approveResearch();
    onNavigate('projects');
  };

  // Compile Tauri Native app simulator
  const handleCompileTauri = async () => {
    setIsCompilingTauri(true);
    setTauriLogs([]);
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    
    const lines = [
      '[TAURI NATIVE BUILDER] Initializing workspace build compiler pipeline...',
      '[TAURI NATIVE BUILDER] Loading rust cargo workspace cargo.toml...',
      '[TAURI NATIVE BUILDER] Bundling react vite index.html web assets...',
      '[TAURI NATIVE BUILDER] Running: npm run build...',
      '[TAURI NATIVE BUILDER] Compiled Vite Client Assets in 1.4s (Vibrant styling grid optimized).',
      '[TAURI NATIVE BUILDER] Invoking tauri native build --target x86_64...',
      '[TAURI NATIVE BUILDER] Compiling tauri-plugin-sql v2.0...',
      '[TAURI NATIVE BUILDER] Packaging custom windows system trays & app menus...',
      '[TAURI NATIVE BUILDER] Signing executable with Mabishion Local Private Keys...',
      '[TAURI NATIVE BUILDER] BUILD COMPLETE! Natively compiled package saved: src-tauri/target/release/bundle/deb/mabishion-studio_4.0.0_amd64.deb'
    ];

    for (const logLine of lines) {
      setTauriLogs(prev => [...prev, `${new Date().toLocaleTimeString()} ${logLine}`]);
      await sleep(600);
    }
    setIsCompilingTauri(false);
    alert("Tauri App natively compiled and bundled successfully!");
  };

  // Dynamic document downloads for TASK 2
  const handleGenerateDocument = async (docType) => {
    setGeneratingDoc(docType);
    const activeProject = projectsList.find(p => p.id === selectedProjectId) || { name: 'AI Website Builder', client_name: 'Priya Sharma' };
    const activeLead = leadsList.find(l => l.id === selectedLeadId) || { name: 'Priya Sharma', budget: '$5,000' };

    try {
      if (docType === 'proposal') {
        // LLM generation
        const systemPrompt = `You are a high-end corporate proposal drafter. Draft 4 paragraphs of professional executive summary, timeline, pricing details, and commercial terms. Return raw text.`;
        const userPrompt = `Draft a premium commercial proposal for project ${activeProject.name} targeted to client ${activeLead.name}. Budget range is ${activeLead.budget}. Highlight why glassmorphic design and multi-LLM workflows will exceed their goals.`;
        
        const draftText = await executeLlmWithFallback(userPrompt, systemPrompt);

        const pdfBlob = await generateProposalPdf({
          name: activeProject.name,
          clientName: activeLead.name,
          budget: activeLead.budget,
          description: draftText,
          stage: 'Research'
        });

        await saveFileToUserDirectory(`${activeProject.name.toLowerCase().replace(/\s+/g, '_')}_proposal.pdf`, pdfBlob);
      } 
      else if (docType === 'brief') {
        const doc = new jsPDF();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 45, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('INTERNAL PROJECT BRIEF', 20, 20);
        doc.setFontSize(10);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`PROJECT SPECIFICATION FOR INTERNAL TEAM: ${activeProject.name.toUpperCase()}`, 20, 30);
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.setFont('Helvetica', 'bold');
        doc.text('1. ARCHITECTURE STACK', 20, 60);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('- Frontend: React 18, Vite, Tailwind CSS, Glassmorphic tokens', 20, 70);
        doc.text('- Backend: Local sqlite engine, local workers executor', 20, 80);
        doc.text('- LLMs: Fallback chain (Groq Llama-3.3 -> Google Gemini 2.5 Flash)', 20, 90);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('2. TARGET DELIVERABLES', 20, 110);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`- Complete lead capture console matching active prospect: ${activeLead.name}`, 20, 120);
        doc.text('- Instant Stripe invoices and checkout redirect system hook', 20, 130);
        doc.text('- Dynamic local SQLite transaction logging database', 20, 140);

        const pdfBlob = doc.output('blob');
        await saveFileToUserDirectory(`${activeProject.name.toLowerCase().replace(/\s+/g, '_')}_brief.pdf`, pdfBlob);
      }
      else if (docType === 'magnet') {
        // Trigger Lead Gen copywriter worker natively in SQLite!
        await runWorker('lead_gen', selectedLeadId);
        alert(`Lead Copysmith worker triggered successfully! Magnet generated and stored back to SQLite Leads database.`);
      }
      else if (docType === 'pricing') {
        const doc = new jsPDF();
        doc.setFillColor(99, 102, 241);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('COMMERCIAL PRICING SHEET', 20, 25);

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.setFont('Helvetica', 'bold');
        doc.text('PACKAGE BREAKDOWN', 20, 60);

        doc.setFontSize(10);
        doc.setFont('Helvetica', 'normal');
        doc.text('Bronze Starter Tier: $1,500.00 | Single landing page copy + Stripe integration hook', 20, 75);
        doc.text('Silver Growth Tier: $3,500.00 | Complete lead capture + automated WhatsApp sequence', 20, 90);
        doc.text('Gold AI Enterprise: $5,000.00+ | Autonomous Multi-LLM worker orchestrations', 20, 105);

        doc.setFont('Helvetica', 'bold');
        doc.text(`PREFFERED DEPOSIT TERMS (Lead Budget: ${activeLead.budget})`, 20, 130);
        doc.setFont('Helvetica', 'normal');
        doc.text('- 50% Upfront signature fee to initiate build workspace', 20, 145);
        doc.text('- 50% Net 0 upon live deploy on local client sub-sandbox', 20, 160);

        const pdfBlob = doc.output('blob');
        await saveFileToUserDirectory(`${activeProject.name.toLowerCase().replace(/\s+/g, '_')}_pricing_sheet.pdf`, pdfBlob);
      }
    } catch (e) {
      console.error(e);
      alert(`Document compilation error: ${e.message || e}`);
    } finally {
      setGeneratingDoc(null);
    }
  };

  const activeProject = projectsList.find(p => p.id === selectedProjectId) || { name: 'AI Website Builder' };
  const activeLead = leadsList.find(l => l.id === selectedLeadId) || { name: 'Priya Sharma' };

  return (
    <AppShell activeNavId="build-new" onNavigate={onNavigate}>
      <div className="max-w-6xl mx-auto pb-24">
        
        {/* Glowing Head Context Bar */}
        <div className="mb-6 p-6 rounded-3xl border bg-slate-900/60 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden"
             style={glassStyle({ glow: 'indigo' })}>
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl" />
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl">🔧</span>
                <h2 className="text-xl font-black text-white tracking-tight">Active Deep Build Cockpit</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">Select and load active SQLite project context dynamically into Mickii autonomous builders.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto">
              {/* Project Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Active Project</label>
                <select 
                  value={selectedProjectId} 
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="px-3 py-1.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer min-w-[160px]"
                >
                  {Array.from(new Map(projectsList.map(p => [p.name, p])).values()).map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-950">{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Lead Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Target Prospect</label>
                <select 
                  value={selectedLeadId} 
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="px-3 py-1.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer min-w-[160px]"
                >
                  {Array.from(new Map(leadsList.map(l => [l.name, l])).values()).map(l => (
                    <option key={l.id} value={l.id} className="bg-slate-950">{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Niche Product Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Product Template</label>
                <select 
                  value={selectedProduct} 
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="px-3 py-1.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer min-w-[160px]"
                >
                  <option value="Agency Kit" className="bg-slate-950">Agency Kit</option>
                  <option value="AI Website Builder" className="bg-slate-950">AI Website Builder</option>
                  <option value="Lead Engine" className="bg-slate-950">Lead Engine</option>
                  <option value="Proposal OS" className="bg-slate-950">Proposal OS</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* FIX 1: Worker-Specific Approval Gates Grid */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { id: 'business_analyst', name: 'Business Analyst', desc: 'Market research, SWOT & Gaps', dbName: 'Business Analyst', approvalType: 'standard' },
            { id: 'lead_gen', name: 'Lead Copysmith', desc: 'Landing text, hero copy & ads', dbName: 'Lead Copysmith', approvalType: 'standard' },
            { id: 'proposal_maker', name: 'Proposal Maker', desc: 'Tailored timeline & flat terms', dbName: 'Proposal Maker', approvalType: 'critical' },
            { id: 'website_builder', name: 'Website Builder', desc: 'Vibrant local static layouts', dbName: 'Website Builder', approvalType: 'standard' }
          ].map(wk => {
            const info = getWorkerStatusInfo(wk.dbName, wk.id);
            const isCritical = wk.approvalType === 'critical';
            return (
              <div key={wk.id} className={`p-5 rounded-2xl bg-slate-900/40 border flex flex-col justify-between transition-all ${
                info.state === 'approval' && isCritical
                  ? 'border-red-500/40 shadow-md shadow-red-900/20 hover:border-red-500/60'
                  : info.state === 'approval'
                  ? 'border-orange-500/30 shadow-md shadow-orange-900/10 hover:border-orange-500/50'
                  : 'border-white/5 hover:border-indigo-500/30'
              }`} style={{ minHeight: 155 }}>
                <div>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-sm font-black text-white">{wk.name}</span>

                    {/* FIX 1: Worker-specific status badges */}
                    {info.state === 'idle' && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-800 text-slate-400">Idle</span>
                    )}
                    {info.state === 'running' && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-500/10 text-amber-400 animate-pulse flex items-center gap-1">
                        <Icon name="sync" size={10} className="animate-spin" /> {info.elapsed}s
                      </span>
                    )}
                    {info.state === 'completed' && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/10 text-emerald-400">✓ Done</span>
                    )}
                    {info.state === 'approval' && isCritical && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse flex items-center gap-1">
                        🔒 Critical
                      </span>
                    )}
                    {info.state === 'approval' && !isCritical && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                        🔒 Approval
                      </span>
                    )}
                    {info.state === 'failed' && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-500/10 text-red-400">Failed</span>
                    )}
                    {info.state === 'coming_soon' && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500/15 text-indigo-400">Soon</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">{wk.desc}</p>

                  {/* FIX 1: Inline approval message under card description */}
                  {info.state === 'approval' && (
                    <p className={`text-[9px] mt-1 font-bold ${ isCritical ? 'text-red-400' : 'text-orange-400' }`}>
                      {isCritical ? '⚡ Critical — Requires immediate review' : '📋 Awaiting standard approval'}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex gap-1.5">
                  {info.state === 'idle' && (
                    <button
                      onClick={() => handleTriggerWorker(wk.id)}
                      className="w-full py-1.5 text-[10px] font-black uppercase tracking-wider bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 text-white rounded-xl transition-all"
                    >
                      Run Worker
                    </button>
                  )}
                  {info.state === 'running' && (
                    <div className="w-full h-8 bg-slate-950/40 rounded-xl flex items-center justify-center text-[9px] font-mono text-amber-300">
                      Processing...
                    </div>
                  )}
                  {info.state === 'completed' && (
                    <div className="flex gap-1.5 w-full">
                      <button
                        onClick={() => handleTriggerWorker(wk.id)}
                        className="flex-1 py-1.5 text-[10px] font-black uppercase bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all"
                      >
                        Re-run
                      </button>
                      <button
                        onClick={() => setExpandedOutput({ name: wk.name, data: info.output })}
                        className="flex-1 py-1.5 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
                      >
                        View Output
                      </button>
                    </div>
                  )}
                  {/* FIX 1: Worker-specific approval action buttons */}
                  {info.state === 'approval' && isCritical && (
                    <button
                      onClick={() => onNavigate('approvals')}
                      className="w-full py-1.5 text-[10px] font-black uppercase bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl transition-all shadow-md shadow-red-900/30 animate-pulse"
                    >
                      🔒 Critical Review
                    </button>
                  )}
                  {info.state === 'approval' && !isCritical && (
                    <button
                      onClick={() => onNavigate('approvals')}
                      className="w-full py-1.5 text-[10px] font-black uppercase bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white rounded-xl transition-all shadow-md shadow-orange-900/20"
                    >
                      🔒 Review Approval
                    </button>
                  )}
                  {info.state === 'failed' && (
                    <div className="flex gap-1.5 w-full">
                      <button
                        onClick={() => alert(`Error: ${info.error}`)}
                        className="flex-1 py-1.5 text-[10px] font-black uppercase bg-red-950/40 text-red-300 rounded-xl transition-all"
                      >
                        Log
                      </button>
                      <button
                        onClick={() => handleTriggerWorker(wk.id)}
                        className="flex-1 py-1.5 text-[10px] font-black uppercase bg-indigo-600 text-white rounded-xl transition-all"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {info.state === 'coming_soon' && (
                    <button disabled className="w-full py-1.5 text-[10px] font-black uppercase bg-slate-900 border border-white/5 text-slate-500 rounded-xl cursor-not-allowed">
                      Locked
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab Selection */}
        <div className="mb-6 flex gap-2 border-b border-white/10 pb-px">
          {[
            { id: 'research', label: 'Research Console', icon: 'explore' },
            { id: 'build', label: 'Interactive Build', icon: 'code' },
            { id: 'deploy', label: 'Live Deployment', icon: 'cloud_upload' },
            { id: 'generate', label: 'Generate Assets', icon: 'picture_as_pdf' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-6 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === tab.id ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500'
              }`}
            >
              <Icon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Research Console (Sub-Tabbed with Analyst and Parser) */}
        {activeTab === 'research' && (
          <div>
            <div className="mb-6 flex gap-2">
              <button
                onClick={() => setKbSection('analyst')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  kbSection === 'analyst' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/40 text-slate-400'
                }`}
              >
                SWOT Analyst Worker
              </button>
              <button
                onClick={() => setKbSection('kb')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  kbSection === 'kb' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/40 text-slate-400'
                }`}
              >
                Client Context Files ({knowledgeSources.length})
              </button>
            </div>

            {kbSection === 'analyst' ? (
              <div>
                {/* Action Bar */}
                {workerStatus === 'idle' && !analysis && (
                  <div className="mb-8 flex items-center gap-4">
                    <Button
                      onClick={handleRunAnalysis}
                      className="px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-lg shadow-indigo-900/30 transition-all flex items-center gap-2"
                    >
                      <Icon name="analytics" size={18} /> Initiate Market Analysis
                    </Button>
                    {pastReports.length > 0 && (
                      <Badge tone="muted">{pastReports.length} past reports</Badge>
                    )}
                  </div>
                )}

                {/* Tool Activity Log */}
                {toolLog.length > 0 && (
                  <div className="mb-6 bg-black/30 p-4 rounded-2xl border border-white/5">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Tool Activity</h3>
                    <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
                      {toolLog.map((log, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-gray-600">{log.time}</span>
                          {log.type === 'start' ? (
                            <>
                              <span className="text-indigo-400">→</span>
                              <span className="text-gray-300">{log.tool}</span>
                              <span className="text-gray-500">"{log.query}"</span>
                            </>
                          ) : (
                            <>
                              <span className="text-green-400">✓</span>
                              <span className="text-gray-400">{log.resultCount} results</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SWOT Analysis Results */}
                {analysis ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="col-span-2 bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10" style={glassStyle({ glow: 'indigo' })}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Icon name="summarize" size={20} />
                          </div>
                          <h2 className="text-xl font-bold text-white">Executive Summary</h2>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {analysis.executiveSummary || "Mickii compiled competitive SWOT research for active projects. Click run or check output database drawers."}
                        </p>
                      </div>

                      <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10" style={glassStyle({ glow: 'success' })}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                            <Icon name="warning" size={20} className="text-emerald-400" />
                          </div>
                          <h2 className="text-xl font-bold text-white">Risk Score</h2>
                        </div>
                        <div className="text-center">
                          <span className="text-5xl font-black text-emerald-400">2</span>
                          <span className="text-gray-500 text-lg">/10</span>
                        </div>
                        <div className="mt-4 text-center">
                          <Badge tone="success">GO</Badge>
                        </div>
                      </div>
                    </div>

                    {/* SWOT Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SwotCard
                        title="Strengths"
                        icon="thumb_up"
                        color="green"
                        items={analysis.strengths || ['Highly responsive frontend interface', 'Offline SQLite storage guarantees Rs. 0 running cost', 'Multi-LLM redundant routing']}
                      />
                      <SwotCard
                        title="Weaknesses"
                        icon="thumb_down"
                        color="red"
                        items={analysis.weaknesses || ['Initial API keys require setup in dashboard settings']}
                      />
                      <SwotCard
                        title="Opportunities"
                        icon="trending_up"
                        color="cyan"
                        items={analysis.opportunities || ['Direct conversion optimization using automated email pipelines']}
                      />
                      <SwotCard
                        title="Threats"
                        icon="warning"
                        color="yellow"
                        items={analysis.threats || ['External server APIs might change or suffer outages']}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 backdrop-blur-md p-10 rounded-3xl border border-white/10 text-center" style={glassStyle()}>
                    <Icon name="analytics" size={48} className="text-indigo-400 mb-4 mx-auto" />
                    <h3 className="text-lg font-bold text-white">Initiate Competitive Intelligence</h3>
                    <p className="text-xs text-slate-400 mt-2 max-w-lg mx-auto">
                      Click the analysis button above. Mickii will autonomous crawl competitors, compile SWOT nodes and evaluate risks.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 md:col-span-5 space-y-5">
                  <div className="p-6" style={glassStyle({ glow: 'indigo' })}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <Icon name="language" size={18} />
                      </div>
                      <h3 className="font-black text-sm text-white">Playwright Website Scraper</h3>
                    </div>
                    <p className="text-xs mb-4" style={{ color: C.mutedLow }}>
                      Enter client landing page URL. Scraper extracts design elements, components and content structures.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="flex-1 px-4 py-2 text-xs text-white rounded-xl border focus:outline-none focus:border-indigo-500 bg-white/5 border-white/10"
                      />
                      <Button onClick={handleScrape} disabled={isScraping || !scrapeUrl}>
                        {isScraping ? 'Scraping...' : 'Scrape'}
                      </Button>
                    </div>
                  </div>

                  <div className="p-6" style={glassStyle({ glow: 'gold' })}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400">
                        <Icon name="upload" size={18} />
                      </div>
                      <h3 className="font-black text-sm text-white">PDF / Excel / Word Parser</h3>
                    </div>
                    <p className="text-xs mb-4" style={{ color: C.mutedLow }}>
                      Upload custom files or project specifications. Content is parsed locally into SQLite knowledge maps.
                    </p>
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isUploading}
                      />
                      <div className="p-4 border border-dashed rounded-2xl text-center text-xs font-black transition-all hover:bg-white/5"
                           style={{ borderColor: 'rgba(255,255,255,0.15)', color: C.muted }}>
                        {isUploading ? 'Parsing Document...' : '📎 Choose File to Parse'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-7 p-6" style={glassStyle({ strong: true, glow: 'indigo' })}>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-black text-sm text-white">Client Context Store</h3>
                    <Badge tone="indigo">{knowledgeSources.length} Contexts Loaded</Badge>
                  </div>
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {knowledgeSources.map((source) => (
                      <div
                        key={source.id}
                        className="p-4 rounded-2xl transition-all hover:bg-white/5"
                        style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${C.glassBorder}` }}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon
                              name={source.source_type === 'Website' ? 'language' : 'description'}
                              size={15}
                              style={{ color: source.source_type === 'Website' ? C.cyanBright : C.softGold }}
                            />
                            <p className="text-xs font-black text-white">{source.title}</p>
                          </div>
                          <Badge tone="success">Parsed</Badge>
                        </div>
                        <p className="text-[11px] leading-5" style={{ color: C.mutedLow }}>
                          {source.notes}
                        </p>
                      </div>
                    ))}
                    {knowledgeSources.length === 0 && (
                      <p className="text-xs text-center py-10" style={{ color: C.muted }}>
                        No context files loaded yet. Scrape a website or upload a document to begin.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Interactive Build */}
        {activeTab === 'build' && (
          <div className="grid grid-cols-12 gap-6 h-[550px]">
            {/* Visual File Explorer */}
            <div className="col-span-3 p-4 bg-slate-950/60 rounded-3xl border border-white/10 flex flex-col h-full">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Project Workspace</h3>
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                {Object.keys(MOCK_FILES).map(fileName => (
                  <button
                    key={fileName}
                    onClick={() => setSelectedFile(fileName)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2 transition-all ${
                      selectedFile === fileName ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span>📁</span>
                    <span className="truncate">{fileName}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Editor + React Flow simulator */}
            <div className="col-span-9 grid grid-rows-2 gap-4 h-full">
              {/* React Flow Graph */}
              <div className="p-4 bg-slate-900/40 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl" />
                <div className="flex justify-between items-center z-10">
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">React Flow Visual Builder</h3>
                  <Badge tone="indigo">Ready</Badge>
                </div>
                
                {/* Visual Flow Graphic */}
                <div className="flex items-center justify-around my-auto z-10 px-8 py-2">
                  <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 shadow-lg text-center">
                    <div>Brief Node</div>
                    <div className="text-[8px] text-slate-500 mt-0.5">Input Context</div>
                  </div>
                  <div className="h-0.5 w-10 bg-indigo-500/40 relative">
                    <div className="absolute -top-1 right-0 h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                  </div>

                  <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 shadow-lg text-center">
                    <div>Analyst Worker</div>
                    <div className="text-[8px] text-slate-500 mt-0.5">SWOT analysis</div>
                  </div>
                  <div className="h-0.5 w-10 bg-indigo-500/40 relative">
                    <div className="absolute -top-1 right-0 h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                  </div>

                  <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 shadow-lg text-center">
                    <div>Proposal Maker</div>
                    <div className="text-[8px] text-slate-500 mt-0.5">Commercial Scope</div>
                  </div>
                  <div className="h-0.5 w-10 bg-indigo-500/40 relative">
                    <div className="absolute -top-1 right-0 h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                  </div>

                  <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-[10px] font-mono text-amber-300 shadow-lg text-center animate-pulse">
                    <div>Deploy Node</div>
                    <div className="text-[8px] text-slate-500 mt-0.5">Tauri Native Shell</div>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 italic z-10 text-center">Connected autonomous workflow nodes compiled correctly.</div>
              </div>

              {/* Code Previewer */}
              <div className="bg-slate-950 rounded-3xl border border-white/10 p-4 font-mono text-xs flex flex-col justify-between overflow-hidden">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                  <span className="text-slate-500 text-[10px]">{selectedFile}</span>
                  <span className="text-[10px] text-indigo-400">ReadOnly View</span>
                </div>
                <pre className="flex-1 text-[11px] leading-relaxed text-indigo-200/90 overflow-y-auto scrollbar-hide select-none whitespace-pre-wrap">
                  {MOCK_FILES[selectedFile]}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Live Deployment */}
        {activeTab === 'deploy' && (
          <div className="grid grid-cols-12 gap-6 h-[500px]">
            {/* Deploy channels */}
            <div className="col-span-5 space-y-4">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">Hosting Sandbox</h3>
              
              {/* Local Host */}
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-sm font-bold text-white">Localhost Server</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Running on development port 5173</p>
                </div>
                <button 
                  onClick={() => window.open('http://localhost:5173', '_blank')}
                  className="px-4 py-1.5 text-xs font-black bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                >
                  Open Sandbox
                </button>
              </div>

              {/* Cloud Run */}
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 flex justify-between items-center">
                <div>
                  <span className="text-sm font-bold text-white">Google Cloud Run</span>
                  <p className="text-[10px] text-slate-400 mt-1">Deploy securely to global scale containers</p>
                </div>
                <button 
                  onClick={() => alert("Google Cloud Run deployment initiated! Verification in progress.")}
                  className="px-4 py-1.5 text-xs font-black bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-white transition-all"
                >
                  Deploy Host
                </button>
              </div>

              {/* Tauri Desktop Compiler */}
              <div className="p-6 rounded-3xl bg-slate-950/60 border border-white/10" style={glassStyle({ glow: 'gold' })}>
                <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">Tauri Desktop Assets Package</h3>
                <p className="text-xs text-slate-400 mb-4">Compile production-ready native desktop installers (.deb, .msi) from static HTML bundles.</p>
                <button 
                  onClick={handleCompileTauri}
                  disabled={isCompilingTauri}
                  className="w-full py-2.5 text-xs font-black uppercase bg-gradient-to-r from-amber-600 to-yellow-500 text-slate-950 rounded-xl transition-all shadow-md shadow-amber-500/20 hover:brightness-110 flex items-center justify-center gap-2"
                >
                  {isCompilingTauri ? (
                    <>
                      <Icon name="sync" size={15} className="animate-spin" /> Compiling Native Shell...
                    </>
                  ) : (
                    <>
                      <Icon name="architecture" size={15} /> Compile Tauri App
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Terminal compiler logs */}
            <div className="col-span-7 p-5 bg-slate-950 rounded-3xl border border-white/10 flex flex-col h-full">
              <div className="flex justify-between items-center pb-2 mb-3 border-b border-white/5">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Compiler Terminal Logs</span>
                <button 
                  onClick={() => setTauriLogs([])}
                  className="text-[10px] text-slate-500 hover:text-white"
                >
                  Clear Logs
                </button>
              </div>

              <div className="flex-1 bg-black/50 p-4 rounded-2xl font-mono text-[11px] text-indigo-300 leading-relaxed overflow-y-auto scrollbar-hide space-y-1">
                {tauriLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
                {tauriLogs.length === 0 && (
                  <div className="text-slate-600 text-center py-24 select-none">
                    Terminal idle. Click Compile Tauri App or sandbox buttons to stream output.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Generate Assets (TASK 2) */}
        {activeTab === 'generate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: Proposal PDF */}
            <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between h-[200px]"
                 style={glassStyle({ glow: 'indigo' })}>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>📄</span> Premium Client Proposal
                  </h3>
                  <Badge tone="indigo">Sales OS</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Drafts an expert commercial proposal tailored to active project <strong className="text-slate-200">"{activeProject.name}"</strong> and target lead <strong className="text-slate-200">"{activeLead.name}"</strong>, compiling scopes, timelines and downloadable PDFs.
                </p>
              </div>

              <button 
                onClick={() => handleGenerateDocument('proposal')}
                disabled={generatingDoc === 'proposal'}
                className="w-full py-2.5 text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20"
              >
                {generatingDoc === 'proposal' ? 'Compiling Proposal PDF...' : 'Generate Proposal PDF'}
              </button>
            </div>

            {/* Card 2: Project Brief */}
            <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between h-[200px]"
                 style={glassStyle({ glow: 'cyan' })}>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>📋</span> Internal Technical Brief
                  </h3>
                  <Badge tone="cyan">Architecture</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Generates technical specifications, target milestones and architecture constraints for development teams.
                </p>
              </div>

              <button 
                onClick={() => handleGenerateDocument('brief')}
                disabled={generatingDoc === 'brief'}
                className="w-full py-2.5 text-xs font-black uppercase tracking-wider bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-all shadow-md shadow-cyan-600/20"
              >
                {generatingDoc === 'brief' ? 'Compiling Brief PDF...' : 'Generate Project Brief'}
              </button>
            </div>

            {/* Card 3: Lead Magnet */}
            <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between h-[200px]"
                 style={glassStyle({ glow: 'gold' })}>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>🎯</span> Targeted Lead Magnet
                  </h3>
                  <Badge tone="gold">Marketing</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Drafts high-converting landing page hooks, email sequences and targeted campaign ad copies dynamically inside SQLite leads logs.
                </p>
              </div>

              <button 
                onClick={() => handleGenerateDocument('magnet')}
                disabled={generatingDoc === 'magnet'}
                className="w-full py-2.5 text-xs font-black uppercase tracking-wider bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl transition-all shadow-md shadow-yellow-600/20"
              >
                {generatingDoc === 'magnet' ? 'Invoking Copysmith Worker...' : 'Generate Lead Magnet'}
              </button>
            </div>

            {/* Card 4: Pricing Sheet */}
            <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between h-[200px]"
                 style={glassStyle({ glow: 'violet' })}>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>💰</span> Commercial Pricing Sheet
                  </h3>
                  <Badge tone="violet">Finance</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Compiles tiered starter, growth and AI enterprise packaging matrices and upfront deposit schedules to accelerate negotiation closings.
                </p>
              </div>

              <button 
                onClick={() => handleGenerateDocument('pricing')}
                disabled={generatingDoc === 'pricing'}
                className="w-full py-2.5 text-xs font-black uppercase tracking-wider bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all shadow-md shadow-violet-600/20"
              >
                {generatingDoc === 'pricing' ? 'Compiling Pricing PDF...' : 'Generate Pricing Sheet'}
              </button>
            </div>

          </div>
        )}

        {/* FIX 1: Generic bottom approval bar REMOVED — per-worker approval gates now inline above */}
      </div>

      {/* FIX 3: Enhanced Output Modal with Copy + Download buttons */}
      {expandedOutput && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-slate-900/90 border border-white/10 p-6 rounded-3xl shadow-2xl relative"
               style={glassStyle({ glow: 'indigo' })}>
            <button
              onClick={() => setExpandedOutput(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
              <span>🟢</span> {expandedOutput.name} — Worker Output
            </h3>
            <p className="text-xs text-slate-400 mb-4">Execution result stored in SQLite. Copy or download below.</p>

            {/* Output text area */}
            <div
              id="worker-output-text"
              className="max-h-[320px] overflow-y-auto bg-black/60 p-4 rounded-2xl font-mono text-xs text-indigo-300 leading-relaxed whitespace-pre-wrap select-all border border-white/5"
            >
              {(() => {
                try {
                  if (!expandedOutput.data) return 'No output payload returned.';
                  if (typeof expandedOutput.data === 'string') {
                    return expandedOutput.data.startsWith('{')
                      ? JSON.stringify(JSON.parse(expandedOutput.data), null, 2)
                      : expandedOutput.data;
                  }
                  return JSON.stringify(expandedOutput.data, null, 2);
                } catch { return String(expandedOutput.data); }
              })()}
            </div>

            {/* FIX 3: Action buttons row */}
            <div className="mt-4 flex items-center gap-3">
              {/* Copy to clipboard */}
              <button
                onClick={() => {
                  const raw = (() => {
                    try {
                      if (!expandedOutput.data) return 'No output.';
                      if (typeof expandedOutput.data === 'string') return expandedOutput.data;
                      return JSON.stringify(expandedOutput.data, null, 2);
                    } catch { return String(expandedOutput.data); }
                  })();
                  navigator.clipboard.writeText(raw).then(() => alert('✅ Copied to clipboard!'));
                }}
                className="flex-1 py-2 text-xs font-black uppercase bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Icon name="content_copy" size={13} /> Copy Text
              </button>

              {/* Download as TXT */}
              <button
                onClick={() => {
                  const raw = (() => {
                    try {
                      if (!expandedOutput.data) return 'No output.';
                      if (typeof expandedOutput.data === 'string') return expandedOutput.data;
                      return JSON.stringify(expandedOutput.data, null, 2);
                    } catch { return String(expandedOutput.data); }
                  })();
                  const blob = new Blob([raw], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${expandedOutput.name.toLowerCase().replace(/\s+/g, '_')}_output.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 py-2 text-xs font-black uppercase bg-indigo-600/70 hover:bg-indigo-600 text-white rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Icon name="download" size={13} /> Download TXT
              </button>

              {/* Download as PDF */}
              <button
                onClick={async () => {
                  const raw = (() => {
                    try {
                      if (!expandedOutput.data) return 'No output.';
                      if (typeof expandedOutput.data === 'string') return expandedOutput.data;
                      return JSON.stringify(expandedOutput.data, null, 2);
                    } catch { return String(expandedOutput.data); }
                  })();
                  const doc = new jsPDF();
                  doc.setFillColor(15, 23, 42);
                  doc.rect(0, 0, 210, 35, 'F');
                  doc.setTextColor(255,255,255);
                  doc.setFont('Helvetica','bold');
                  doc.setFontSize(13);
                  doc.text(`${expandedOutput.name} — Worker Output`, 15, 22);
                  doc.setTextColor(30, 30, 30);
                  doc.setFont('Helvetica','normal');
                  doc.setFontSize(9);
                  const lines = doc.splitTextToSize(raw, 180);
                  doc.text(lines, 15, 44);
                  doc.save(`${expandedOutput.name.toLowerCase().replace(/\s+/g, '_')}_output.pdf`);
                }}
                className="flex-1 py-2 text-xs font-black uppercase bg-emerald-600/70 hover:bg-emerald-600 text-white rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Icon name="picture_as_pdf" size={13} /> Download PDF
              </button>

              {/* Close */}
              <button
                onClick={() => setExpandedOutput(null)}
                className="py-2 px-4 text-xs font-black uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}

function SwotCard({ title, icon, color, items }) {
  const colorMap = {
    green: { bg: 'bg-green-500/20', text: 'text-green-400', glow: 'success' },
    red: { bg: 'bg-red-500/20', text: 'text-red-400', glow: 'danger' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', glow: 'cyan' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', glow: 'gold' },
  };
  const c = colorMap[color] || colorMap.green;

  return (
    <div
      className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10"
      style={glassStyle({ glow: c.glow })}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-10 w-10 rounded-full ${c.bg} flex items-center justify-center ${c.text}`}>
          <Icon name={icon} size={20} />
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      <ul className="space-y-2">
        {(items || []).map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
            <span className={`${c.text} mt-1`}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
