import React, { useState, useEffect, useMemo } from 'react';
import { C, glassStyle } from '../components/consts';
import AppShell from '../components/AppShell';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import MickiiOrb from '../components/MickiiOrb';
import ProgressBar from '../components/ProgressBar';
import QuickCommandBar from '../components/QuickCommandBar';
import { KANBAN_COLS } from '../data/mockData.jsx';
import { getProjects, addProject, updateProjectStage, updateProjectProgress } from '../data/db.js';
import { generatePdfInvoice, generateProposalPdf, generateZipDeliverable, saveFileToUserDirectory } from '../services/fileOperationService';
import { runWorker } from '../engine/workers/index.js';

export default function ProjectsScreen({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // New Project Form state
  const [newProjName, setNewProjName] = useState('');
  const [newProjType, setNewProjType] = useState('Website');
  const [newProjClient, setNewProjClient] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Selected Project Details Edit state
  const [editProgress, setEditProgress] = useState(0);
  const [editHealth, setEditHealth] = useState('Stable');
  const [isSimulatingWorker, setIsSimulatingWorker] = useState(false);
  const [simulationLog, setSimulationLog] = useState('');

  const loadProjects = async () => {
    try {
      const rows = await getProjects();
      setProjects(rows);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.client_name && p.client_name.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.stage !== 'Delivered / Archived').length;
    const blocked = projects.filter((p) => p.health === 'Blocked').length;
    const pendingReview = projects.filter((p) => p.health === 'Needs Review' || p.health === 'At Risk').length;
    const ready = projects.filter((p) => p.stage === 'Ready').length;

    return { total, active, blocked, pendingReview, ready };
  }, [projects]);

  // Handle New Project submission
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjName.trim() || isSaving) return;

    try {
      setIsSaving(true);
      await addProject(newProjName, newProjType, newProjClient);
      setNewProjName('');
      setNewProjType('Website');
      setNewProjClient('');
      setIsNewModalOpen(false);
      await loadProjects();
    } catch (err) {
      console.error('Failed to create new project:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = async (e, col) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    try {
      await updateProjectStage(id, col);
      await loadProjects();

      // If the currently highlighted project is the one dropped, update its stage too
      if (selectedProject && selectedProject.id === id) {
        setSelectedProject((prev) => ({ ...prev, stage: col }));
      }
    } catch (err) {
      console.error('Failed to update stage on drop:', err);
    }
  };

  // Save progress & health updates to SQLite
  const handleSaveProgress = async () => {
    if (!selectedProject) return;
    try {
      await updateProjectProgress(selectedProject.id, editProgress, editHealth);
      await loadProjects();
      setSelectedProject((prev) => ({ ...prev, progress: editProgress, health: editHealth }));
    } catch (err) {
      console.error('Failed to update project status:', err);
    }
  };

  // Generate and save beautiful PDF proposals natively
  const handleExportPdf = async () => {
    if (!selectedProject) return;
    try {
      setSimulationLog((prev) => prev + `\n[File Operation] Generating professional Proposal PDF...`);
      const dateString = new Date().toISOString().split('T')[0];
      const blob = await generateProposalPdf({
        name: selectedProject.name,
        clientName: selectedProject.client_name || 'Valued Client',
        budget: selectedProject.budget || `$${(selectedProject.progress * 150 + 5000).toLocaleString()}`,
        description: selectedProject.description || selectedProject.notes || 'Premium custom digital application build, layout design, responsive frontend architecture, SQLite local database sync, and multi-LLM worker intelligence loops.',
        stage: selectedProject.stage || 'Research'
      });
      
      const fileName = `${selectedProject.name.replace(/\s+/g, '_')}_proposal_${dateString}.pdf`;
      const savedPath = await saveFileToUserDirectory(fileName, blob);
      if (savedPath) {
        setSimulationLog((prev) => prev + `\n[File Operation] PDF Proposal exported successfully to local file system!`);
      }
    } catch (e) {
      console.error(e);
      setSimulationLog((prev) => prev + `\n[File Operation Error] PDF Proposal generation failed: ${e.message}`);
    }
  };

  // Generate and save packed ZIP deliverables natively
  const handleExportZip = async () => {
    if (!selectedProject) return;
    try {
      setSimulationLog((prev) => prev + `\n[File Operation] Generating compressed JSZip client deliverable archive...`);
      
      // Let's create dummy content files representing a beautiful built package!
      const files = [
        { name: 'MABISHION_BLUEPRINT.md', content: `# MABISHION PIPELINE BLUEPRINT\\n\\nProject: ${selectedProject.name}\\nGenerated: ${new Date().toUTCString()}\\n\\nClient Name: ${selectedProject.client_name}\\nTarget Stage: ${selectedProject.stage}\\nBuild Health: ${selectedProject.health}\\n\\nGenerated with Mickii private digital packaging worker.` },
        { name: 'config.json', content: JSON.stringify(selectedProject, null, 2) },
        { name: 'client_instructions.txt', content: 'Extract the package files. Proceed to run npm install followed by npm run dev inside client workspaces.' }
      ];

      const blob = await generateZipDeliverable(files);
      const savedPath = await saveFileToUserDirectory(
        `Mabishion_Package_${selectedProject.name.replace(/\s+/g, '_')}.zip`,
        blob
      );
      if (savedPath) {
        setSimulationLog((prev) => prev + `\n[File Operation] ZIP deliverable packed & saved successfully!`);
      }
    } catch (e) {
      console.error(e);
      setSimulationLog((prev) => prev + `\n[File Operation Error] ZIP compression failed: ${e.message}`);
    }
  };

  // Trigger Autonomous Worker Pipeline (Real Cortex execution)
  const handleTriggerWorker = async () => {
    if (!selectedProject) return;
    setIsSimulatingWorker(true);
    setSimulationLog(`[Cortex Dispatcher] Initiating real autonomous worker pipeline for stage: ${selectedProject.stage}...`);

    try {
      const isResearchOrDesign = selectedProject.stage === 'Research' || selectedProject.stage === 'Design';
      const workerName = isResearchOrDesign ? 'business_analyst' : 'proposal_maker';

      setSimulationLog((prev) => prev + `\n[Cortex] Running "${workerName}" worker pipeline on SQLite database...`);

      const result = await runWorker(
        workerName,
        selectedProject.id,
        {},
        {
          onStatus: (msg) => {
            setSimulationLog((prev) => prev + `\n[Status] ${msg}`);
          }
        }
      );

      if (result.success) {
        setSimulationLog((prev) => 
          prev + 
          `\n[Success] Autonomous execution completed!` +
          `\n[Database] Output indexed securely in SQLite table.` +
          `\n[Approval Engine] Standard/Critical approval generated. Please check the Approval Center!`
        );

        // Auto upgrade progress slightly!
        const nextProgress = Math.min(100, (selectedProject.progress || 0) + 15);
        setEditProgress(nextProgress);
        await updateProjectProgress(selectedProject.id, nextProgress, 'Strong');
        await loadProjects();
        setSelectedProject((prev) => ({ ...prev, progress: nextProgress, health: 'Strong' }));
      } else {
        setSimulationLog((prev) => prev + `\n[Failed] Worker run failed: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      setSimulationLog((prev) => prev + `\n[Error] System error: ${err.message}`);
    } finally {
      setIsSimulatingWorker(false);
    }
  };

  // Pre-fill fields for a clicked project card
  const selectProjectForDetails = (p) => {
    setSelectedProject(p);
    setEditProgress(p.progress || 0);
    setEditHealth(p.health || 'Stable');
    setSimulationLog('');
  };

  return (
    <AppShell activeNavId="projects" onNavigate={onNavigate}
      commandBar={<QuickCommandBar contextLabel="Projects Context" placeholder="Ask Mickii: create project, drag to Ready, check blockers, run research worker..." />}>
      
      <ScreenHeader 
        title="Projects / Production Floor" 
        index="03"
        subtitle="Main manufacturing hall where websites, apps, AI agents, automations, products, and client delivery packs are built."
        badgeLabel="Manufacturing Hall · Builder Launcher"
        primaryAction="New Project" 
        primaryIcon="plus"
        secondaryAction="Refresh Live" 
        secondaryIcon="filter"
        onPrimaryClick={() => setIsNewModalOpen(true)}
        onSecondaryClick={loadProjects}
        extraBadges={<><Badge tone="gold">Factory Mode</Badge><Badge tone="success">Local SQLite Live</Badge><Badge tone="violet">Approval Gates On</Badge></>}
      />

      <section className="grid grid-cols-12 gap-5">
        
        {/* Kanban Board */}
        <div className="col-span-12 p-5 transition-all duration-300" style={glassStyle()}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-white flex items-center gap-2">
                <Icon name="kanban" className="text-indigo-400" size={18} />
                Interactive Kanban Board (Live SQLite)
              </h3>
              <p className="mt-1 text-xs" style={{ color: C.mutedLow }}>
                Drag any project card to shift stages. Click a card to open detailed control dashboard.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="text" 
                placeholder="Search projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
              />
              <Badge tone="gold">7 Stages</Badge>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {KANBAN_COLS.map((col) => {
                const cards = filteredProjects.filter((p) => p.stage === col);
                let tone = 'muted';
                if (col === 'Build') tone = 'gold';
                if (col === 'Test') tone = 'cyan';
                if (col === 'Ready') tone = 'success';
                if (col === 'Delivered / Archived') tone = 'muted';

                return (
                  <div 
                    key={col} 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, col)}
                    className="w-[250px] rounded-[22px] p-4 transition-all duration-200" 
                    style={{ 
                      border: `1px solid ${C.glassBorder}`, 
                      backgroundColor: 'rgba(255,255,255,.025)',
                    }}
                  >
                    <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-2">
                      <p className="font-black text-sm text-white/90">{col}</p>
                      <Badge tone={tone}>{cards.length}</Badge>
                    </div>

                    <div className="space-y-3 min-h-[300px]">
                      {cards.map((p) => {
                        let ht = 'gold';
                        if (p.health === 'Blocked') ht = 'danger';
                        if (p.health === 'Strong') ht = 'success';
                        if (p.health === 'Needs Review' || p.health === 'At Risk') ht = 'violet';

                        const isCurrentlySelected = selectedProject && selectedProject.id === p.id;

                        return (
                          <div 
                            key={p.id} 
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, p.id)}
                            onClick={() => selectProjectForDetails(p)}
                            className={`rounded-[18px] p-3 cursor-grab active:cursor-grabbing transition-all duration-300 hover:scale-[1.02] border ${
                              isCurrentlySelected 
                                ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                                : 'border-white/5 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/10'
                            }`}
                          >
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-black text-white">{p.name}</p>
                              <Badge tone={ht}>{p.health}</Badge>
                            </div>
                            <p className="text-[10px] text-gray-500 mb-2 truncate">{p.type || 'Digital Product'}</p>
                            
                            <div className="mb-1 flex justify-between text-[11px]" style={{ color: C.mutedLow }}>
                              <span>{p.progress || 0}% Complete</span>
                              {p.client_name && <span className="max-w-[80px] truncate">{p.client_name}</span>}
                            </div>
                            <ProgressBar value={p.progress || 0} tone={ht} />
                          </div>
                        );
                      })}
                      {cards.length === 0 && (
                        <div className="h-[120px] rounded-[18px] border border-dashed border-white/5 flex items-center justify-center text-[10px] text-gray-600">
                          Empty Stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Project Control Center (Side Panel / Drawer layout) */}
        {selectedProject && (
          <div className="col-span-12 p-5 animate-in slide-in-from-bottom duration-300" style={glassStyle({ glow: 'indigo' })}>
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4 pb-4 border-b border-white/10">
              <div>
                <Badge tone="indigo">Active Selection Control</Badge>
                <h3 className="text-2xl font-black text-white mt-1">{selectedProject.name}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Type: <span className="text-indigo-300 font-bold">{selectedProject.type || 'Digital Product'}</span> · Client: <span className="text-indigo-300 font-bold">{selectedProject.client_name || 'Mabishion'}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="soft" onClick={() => setSelectedProject(null)} icon="conflict">Deselect</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left Column: Progress & Health Status Edit */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Icon name="wrench" size={16} className="text-yellow-400" />
                  Manual Status Adjuster
                </h4>

                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-bold uppercase tracking-wider">
                    Build Progress: {editProgress}%
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={editProgress}
                    onChange={(e) => setEditProgress(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-bold uppercase tracking-wider">
                    Project Health Tone
                  </label>
                  <select 
                    value={editHealth}
                    onChange={(e) => setEditHealth(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Stable">Stable (Success Green)</option>
                    <option value="Strong">Strong (Gold Glow)</option>
                    <option value="Needs Review">Needs Review (Violet Alert)</option>
                    <option value="At Risk">At Risk (Orange Tone)</option>
                    <option value="Blocked">Blocked (Danger Red)</option>
                  </select>
                </div>

                <Button className="w-full" variant="glow" onClick={handleSaveProgress}>
                  Save Settings to SQLite
                </Button>
              </div>

              {/* Middle Column: Cortex Worker Automation Panel */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Icon name="sparkles" size={16} className="text-indigo-400" />
                  Local Cortex Trigger
                </h4>
                <p className="text-xs text-gray-400">
                  Execute the local automated JavaScript worker for this stage.
                </p>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-xs font-bold text-white flex items-center justify-between">
                    <span>Target Worker:</span>
                    <Badge tone="gold">
                      {selectedProject.stage === 'Research' ? 'Business Analyst' : 
                       selectedProject.stage === 'Design' ? 'Blueprint Maker' : 
                       selectedProject.stage === 'Build' ? 'Developer' : 
                       selectedProject.stage === 'Ready' ? 'Packager' : 'QA compliance'}
                    </Badge>
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleTriggerWorker}
                  disabled={isSimulatingWorker}
                >
                  {isSimulatingWorker ? 'Cortex Processing...' : 'Simulate Worker Sequence'}
                </Button>

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block">Document Generation</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleExportPdf}
                      className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] py-2 rounded-xl transition-all border border-white/10 hover:scale-[1.02] active:scale-95"
                    >
                      📄 Generate Proposal
                    </button>
                    <button
                      onClick={handleExportZip}
                      className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] py-2 rounded-xl transition-all border border-white/10 hover:scale-[1.02] active:scale-95"
                    >
                      <span className="material-icons text-[14px] text-yellow-400">folder_zip</span>
                      Download ZIP
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Simulated Output Log Console */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col min-h-[180px]">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Simulated Cortex Console</p>
                <div className="flex-1 overflow-y-auto p-2 bg-black/40 rounded-xl font-mono text-[10px] text-green-400/90 whitespace-pre-wrap leading-relaxed">
                  {simulationLog || '> Awaiting worker activation signal...'}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Build types launcher cards */}
        <div className="col-span-8 p-5" style={glassStyle({ glow: 'gold' })}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-black text-white">Production Build Types</h3>
            <p className="text-xs" style={{ color: C.mutedLow }}>Website Builder & all builders open here as child workspaces</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { t: 'Website', icon: 'screen' },
              { t: 'Landing page', icon: 'screen' },
              { t: 'App', icon: 'sparkles' },
              { t: 'Software', icon: 'wrench' },
              { t: 'AI agent', icon: 'sparkles' },
              { t: 'Browser extension', icon: 'wrench' },
              { t: 'Automation tool', icon: 'workflow' },
              { t: 'Digital product', icon: 'archive' },
              { t: 'Client delivery pack', icon: 'archive' }
            ].map((item) => (
              <button 
                key={item.t} 
                onClick={() => {
                  setNewProjType(item.t);
                  setIsNewModalOpen(true);
                }}
                className="rounded-[18px] p-3 text-left text-xs font-bold transition-all duration-300 hover:scale-105 active:scale-95 border border-white/5 bg-white/[0.03] hover:bg-white/[0.08]"
                style={{ color: C.muted }}
              >
                <Icon name={item.icon} size={17} style={{ color: C.softGold }} />
                <p className="mt-2 text-white/80">{item.t}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Production health summary */}
        <div className="col-span-4 p-5" style={glassStyle({ glow: 'cyan' })}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-black text-white">Live Operations Health</h3>
            <Badge tone="success">Live</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Active Builds', value: stats.active, tone: 'gold' },
              { label: 'Blocked Items', value: stats.blocked, tone: 'danger' },
              { label: 'Pending Review', value: stats.pendingReview, tone: 'violet' },
              { label: 'Ready to Pack', value: stats.ready, tone: 'success' }
            ].map((m) => (
              <div key={m.label} className="rounded-2xl p-4 border border-white/5 bg-white/[0.03]">
                <p className="text-3xl font-black" style={{ color: m.tone === 'danger' ? C.danger : m.tone === 'success' ? C.success : m.tone === 'violet' ? C.violetBright : C.softGold }}>
                  {m.value}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: C.mutedLow }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* New Project Creator Overlay Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <form 
            onSubmit={handleCreateProject}
            className="w-full max-w-md p-6 rounded-[28px] border border-white/10 shadow-2xl relative overflow-hidden space-y-4" 
            style={glassStyle({ glow: 'gold' })}
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-xl font-black text-white">Launch New Build</h3>
              <button 
                type="button"
                onClick={() => setIsNewModalOpen(false)} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Icon name="conflict" size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">Project Name</label>
              <input 
                type="text" 
                placeholder="e.g. StyloCo Landing Page"
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">Product Type</label>
              <select 
                value={newProjType}
                onChange={(e) => setNewProjType(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Website">Website</option>
                <option value="Landing page">Landing page</option>
                <option value="App">App</option>
                <option value="Software">Software</option>
                <option value="AI agent">AI agent</option>
                <option value="Browser extension">Browser extension</option>
                <option value="Automation tool">Automation tool</option>
                <option value="Digital product">Digital product</option>
                <option value="Client delivery pack">Client delivery pack</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">Client Name (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Priya Sharma"
                value={newProjClient}
                onChange={(e) => setNewProjClient(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button type="button" variant="soft" className="flex-1" onClick={() => setIsNewModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow" className="flex-1" disabled={isSaving}>
                {isSaving ? 'Launching...' : 'Launch Build'}
              </Button>
            </div>
          </form>
        </div>
      )}

    </AppShell>
  );
}

