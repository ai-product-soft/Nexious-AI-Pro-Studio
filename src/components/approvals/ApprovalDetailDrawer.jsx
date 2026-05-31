import React, { useState, useEffect } from 'react';
import Icon from '../Icon';
import Badge from '../Badge';
import Button from '../Button';
import { glassStyle } from '../consts';
import { formatLocalTime, formatLocalDate } from '../../utils/dateFormatter.js';

export default function ApprovalDetailDrawer({ approval, onClose, onResolve }) {
  const [ownerNotes, setOwnerNotes] = useState('');
  const [blueprintData, setBlueprintData] = useState(null);
  const [websiteData, setWebsiteData] = useState(null);
  const [codeData, setCodeData] = useState(null);
  const [showFullDocModal, setShowFullDocModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');

  // Version History states (Problem 2)
  const [activeTab, setActiveTab] = useState('doc'); // 'doc' or 'versions'
  const [versionsList, setVersionsList] = useState([]);
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [diffResult, setDiffResult] = useState(null);

  const loadVersions = async () => {
    if (!approval?.project_id) return;
    try {
      const { getBlueprintVersions } = await import('../../data/db.js');
      const list = await getBlueprintVersions(approval.project_id);
      setVersionsList(list);
      if (list && list.length > 0) {
        setV1(list[list.length - 1]?.version || '1.0');
        setV2(list[0]?.version || '1.0');
      }
    } catch (err) {
      console.warn("Failed to load blueprint versions:", err);
    }
  };

  const handleCompare = async () => {
    if (!approval?.project_id || !v1 || !v2) return;
    try {
      const { getBlueprintDiff } = await import('../../data/db.js');
      const diff = await getBlueprintDiff(approval.project_id, v1, v2);
      setDiffResult(diff);
    } catch (err) {
      alert("Failed to compute diff: " + err.message);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchContextData = async () => {
      if (!approval?.project_id) return;
      try {
        const { getDb } = await import('../../data/db.js');
        const db = await getDb();
        const worker = (approval.worker_name || '').toLowerCase();
        
        if (worker.includes('blueprint') || worker.includes('plan')) {
          const rows = await db.select('SELECT * FROM blueprints WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [approval.project_id]);
          if (active && rows && rows.length > 0) {
            setBlueprintData(rows[0]);
          }
        } else if (worker.includes('website') || worker.includes('design') || worker.includes('builder')) {
          const rows = await db.select('SELECT * FROM websites WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [approval.project_id]);
          if (active && rows && rows.length > 0) {
            setWebsiteData(rows[0]);
          }
        } else if (worker.includes('developer') || worker.includes('code')) {
          const rows = await db.select('SELECT * FROM code_modules WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [approval.project_id]);
          if (active && rows && rows.length > 0) {
            setCodeData(rows[0]);
          }
        }
      } catch (err) {
        console.warn("[ApprovalDetailDrawer] Error fetching context data:", err);
      }
    };
    
    fetchContextData();
    return () => { active = false; };
  }, [approval]);

  if (!approval) return null;

  const isCritical = (approval.type || 'standard').toLowerCase() === 'critical';
  const isPending = (approval.status || 'pending').toLowerCase() === 'pending';

  // Parse JSON data requested
  let requestObj = {};
  try {
    requestObj = typeof approval.request_data === 'string' 
      ? JSON.parse(approval.request_data) 
      : approval.request_data || {};
  } catch (e) {
    requestObj = { raw: approval.request_data };
  }

  // Detect context type to render customized visual previews
  const isPaymentAction = approval.title?.toLowerCase().includes('payment') || approval.worker_name?.toLowerCase().includes('payment') || requestObj.amount;
  const isProposalAction = approval.title?.toLowerCase().includes('proposal') || approval.worker_name?.toLowerCase().includes('proposal');
  const isBlueprintAction = approval.worker_name?.toLowerCase().includes('blueprint') || approval.worker_name?.toLowerCase().includes('plan');
  const isWebsiteAction = approval.worker_name?.toLowerCase().includes('website') || approval.worker_name?.toLowerCase().includes('design') || approval.worker_name?.toLowerCase().includes('builder');
  const isCodeAction = approval.worker_name?.toLowerCase().includes('developer') || approval.worker_name?.toLowerCase().includes('code');

  return (
    <div 
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-slate-950/95 border-l border-white/10 shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right duration-300"
      onClick={(e) => e.stopPropagation()}
    >
      
      {/* Header and Close Action */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Badge tone={isCritical ? 'danger' : 'info'}>
              {isCritical ? '🚨 CRITICAL GATES' : '⚙️ STANDARD GATES'}
            </Badge>
            <Badge tone={isPending ? 'gold' : 'success'}>
              {approval.status || 'Pending'}
            </Badge>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Action Title and Worker Queue info */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Task Request</span>
          <h3 className="text-lg font-black text-white leading-snug">{approval.title || 'Safety Gate Action Request'}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Worker Queue: {approval.worker_name || 'System Worker'}</span>
            <span>·</span>
            <span>Requested: {formatLocalTime(approval.created_at || new Date().toISOString())}</span>
          </div>
        </div>

        {/* Main Details and Render Previews */}
        <div className="space-y-5 overflow-y-auto max-h-[60vh] pr-1 scrollbar-thin">
          
          {/* JSON raw requests fields (Expandable Accordion - Advanced View) */}
          <details className="group border border-white/5 rounded-2xl overflow-hidden bg-black/20">
            <summary className="flex items-center justify-between p-3 text-[10px] uppercase font-black text-slate-400 cursor-pointer hover:bg-white/5 transition-all outline-none select-none">
              <span>Technical Parameters (Advanced)</span>
              <Icon name="keyboard_arrow_down" size={14} className="transform group-open:rotate-180 transition-transform duration-200" />
            </summary>
            <div className="p-4 border-t border-white/5 font-mono text-[10px] text-slate-300 overflow-x-auto space-y-1">
              {Object.entries(requestObj).map(([key, val]) => (
                <div key={key} className="flex justify-between gap-4 py-1 border-b border-white/5 last:border-0">
                  <span className="text-slate-500 font-semibold">{key}:</span>
                  <span className="text-violet-400 font-bold text-right truncate max-w-[180px]" title={String(val)}>
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </details>

          {/* Visual Deliverable Previews (Stripe Mock / Proposal PDF Mock / PRD Summary / Web / Code) */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Visual Deliverable Preview</span>
            
            {isPaymentAction && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-teal-950/10 border border-emerald-500/20 text-slate-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Stripe Checkout Link Mockup</span>
                  <Icon name="link" size={16} className="text-emerald-400" />
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">Total Charged:</span>
                  <span className="text-base font-black text-emerald-400">{requestObj.amount || requestObj.budget || '₹9,999'}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  This is an automated payment session. Approving will generate a test checkout checkout flow link.
                </p>
              </div>
            )}

            {isProposalAction && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-950/20 to-indigo-950/10 border border-violet-500/20 text-slate-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Mabishion Agency PDF Estimate</span>
                  <Icon name="picture_as_pdf" size={16} className="text-violet-400" />
                </div>
                <div className="space-y-1 text-[10px] text-slate-400">
                  <p><strong className="text-slate-300">Client:</strong> {requestObj.client || requestObj.clientName || 'Mock Intake Client'}</p>
                  <p><strong className="text-slate-300">Project Type:</strong> {requestObj.type || 'AI Automation Solution'}</p>
                </div>
                <div className="border-t border-white/5 pt-2">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Draft Pitch Brief</span>
                  <p className="text-[10px] text-slate-300 italic mt-1 leading-relaxed">
                    "Autonomous AI product builder and lead scraper setup for direct outbound local business intake..."
                  </p>
                </div>
              </div>
            )}

            {isBlueprintAction && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-950/20 to-indigo-950/10 border border-violet-500/20 text-slate-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">📋 Executive Product Plan (PRD)</span>
                  <Icon name="assignment" size={16} className="text-violet-400" />
                </div>
                
                <div className="space-y-2 text-[11px] text-slate-400">
                  <p><strong className="text-slate-300">Project Type:</strong> {requestObj.projectName || 'AI Solution'}</p>
                  <p><strong className="text-slate-300">Client Partner:</strong> {requestObj.clientName || 'Priya Sharma'}</p>
                </div>

                {requestObj.validationIssues && requestObj.validationIssues.length > 0 && (
                  <div className="p-3 rounded-xl border border-red-500/30 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.15)] space-y-2 animate-pulse">
                    <div className="flex items-center gap-1.5 text-red-400 text-[10px] uppercase font-black">
                      <span className="material-icons text-xs text-red-500">warning</span>
                      <span>Mickii Scanner Warnings ({requestObj.validationIssues.length})</span>
                    </div>
                    <ul className="list-disc pl-3.5 text-[9px] text-slate-300 space-y-1">
                      {requestObj.validationIssues.map((issue, idx) => (
                        <li key={idx} className="leading-snug">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Plain Hinglish Explainer for Non-Technical Owner */}
                <details className="group border border-violet-500/30 rounded-xl overflow-hidden bg-violet-950/40" open>
                  <summary className="flex items-center justify-between p-2.5 text-[10px] uppercase font-black text-violet-300 cursor-pointer hover:bg-violet-500/10 transition-all outline-none select-none">
                    <span className="flex items-center gap-1.5">
                      <span className="material-icons text-xs text-violet-400">lightbulb</span>
                      Mickii's Hinglish Explainer
                    </span>
                    <Icon name="keyboard_arrow_down" size={12} className="transform group-open:rotate-180 transition-transform duration-200" />
                  </summary>
                  <div className="p-3 border-t border-violet-500/20 text-[10px] text-slate-300 leading-relaxed space-y-2">
                    <p>💡 <strong className="text-white">Boss, simple shabdo me samjhe to:</strong></p>
                    <ul className="list-disc pl-3.5 space-y-1 text-slate-300">
                      <li><strong className="text-violet-300">Aim:</strong> Client <strong className="text-white">{requestObj.clientName || 'Priya Sharma'}</strong> ke liye ek premium <strong className="text-white">{requestObj.projectName || 'AI Website Builder'}</strong> taiyar karna.</li>
                      <li><strong className="text-violet-300">Features:</strong> Glassmorphic premium website theme aur admission capture system jo client ko wow karegi.</li>
                      <li><strong className="text-violet-300">Action:</strong> Approve karte hi background worker actual landing page and dashboard files banana shuru kar dega.</li>
                    </ul>
                  </div>
                </details>
                
                {blueprintData && (
                  <Button 
                    variant="soft" 
                    className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-400 hover:bg-violet-500 hover:text-white"
                    onClick={() => {
                      setModalTitle(`📄 PRD & Tech Spec: ${requestObj.projectName || 'Mabishion Blueprint'}`);
                      setModalContent(blueprintData.prd_text || 'No PRD document text generated.');
                      setShowFullDocModal(true);
                    }}
                  >
                    <Icon name="visibility" size={12} className="inline mr-1" />
                    Read Full Tech Spec / PRD
                  </Button>
                )}
              </div>
            )}

            {isWebsiteAction && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-teal-950/10 border border-emerald-500/20 text-slate-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">🎨 Responsive Landing Page Preview</span>
                  <Icon name="web" size={16} className="text-emerald-400" />
                </div>
                
                <div className="space-y-2 text-[11px] text-slate-400">
                  <p><strong className="text-slate-300">Layout Style:</strong> Premium Glassmorphic Dark Design</p>
                </div>

                {/* Plain Hinglish Explainer for Non-Technical Owner */}
                <details className="group border border-emerald-500/30 rounded-xl overflow-hidden bg-emerald-950/40" open>
                  <summary className="flex items-center justify-between p-2.5 text-[10px] uppercase font-black text-emerald-300 cursor-pointer hover:bg-emerald-500/10 transition-all outline-none select-none">
                    <span className="flex items-center gap-1.5">
                      <span className="material-icons text-xs text-emerald-400">lightbulb</span>
                      Mickii's Hinglish Explainer
                    </span>
                    <Icon name="keyboard_arrow_down" size={12} className="transform group-open:rotate-180 transition-transform duration-200" />
                  </summary>
                  <div className="p-3 border-t border-emerald-500/20 text-[10px] text-slate-300 leading-relaxed space-y-2">
                    <p>💡 <strong className="text-white">Boss, simple shabdo me samjhe to:</strong></p>
                    <ul className="list-disc pl-3.5 space-y-1 text-slate-300">
                      <li><strong className="text-emerald-300">Design:</strong> High-end layouts aur responsive mobile grids.</li>
                      <li><strong className="text-emerald-300">Controls:</strong> Form data connect, animations aur optimized styles layout.</li>
                      <li><strong className="text-emerald-300">Action:</strong> Approve karte hi design package structure ready hokar final delivery folder me chala jayega.</li>
                    </ul>
                  </div>
                </details>
                
                {websiteData && (
                  <Button 
                    variant="soft" 
                    className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                    onClick={() => {
                      setModalTitle(`🎨 HTML & Frontend Layout Code`);
                      setModalContent(websiteData.html_content || 'No HTML layout found.');
                      setShowFullDocModal(true);
                    }}
                  >
                    <Icon name="code" size={12} className="inline mr-1" />
                    Inspect Layout Code
                  </Button>
                )}
              </div>
            )}

            {isCodeAction && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/20 to-indigo-950/10 border border-blue-500/20 text-slate-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">⚙️ React Component Module</span>
                  <Icon name="code" size={16} className="text-blue-400" />
                </div>
                
                <div className="space-y-2 text-[11px] text-slate-400">
                  <p><strong className="text-slate-300">Module Name:</strong> {requestObj.moduleName || 'Dashboard'}</p>
                </div>

                {/* Plain Hinglish Explainer for Non-Technical Owner */}
                <details className="group border border-blue-500/30 rounded-xl overflow-hidden bg-blue-950/40" open>
                  <summary className="flex items-center justify-between p-2.5 text-[10px] uppercase font-black text-blue-300 cursor-pointer hover:bg-blue-500/10 transition-all outline-none select-none">
                    <span className="flex items-center gap-1.5">
                      <span className="material-icons text-xs text-blue-400">lightbulb</span>
                      Mickii's Hinglish Explainer
                    </span>
                    <Icon name="keyboard_arrow_down" size={12} className="transform group-open:rotate-180 transition-transform duration-200" />
                  </summary>
                  <div className="p-3 border-t border-blue-500/20 text-[10px] text-slate-300 leading-relaxed space-y-2">
                    <p>💡 <strong className="text-white">Boss, simple shabdo me samjhe to:</strong></p>
                    <ul className="list-disc pl-3.5 space-y-1 text-slate-300">
                      <li><strong className="text-blue-300">React Core:</strong> Dynamic lead filters aur offline state management logic.</li>
                      <li><strong className="text-blue-300">Tests:</strong> Component modularity aur automatic testing code integration.</li>
                      <li><strong className="text-blue-300">Action:</strong> Approve karte hi final clean files direct app workspace me incorporate ho jayenge.</li>
                    </ul>
                  </div>
                </details>
                
                {codeData && (
                  <Button 
                    variant="soft" 
                    className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white"
                    onClick={() => {
                      setModalTitle(`⚙️ React Code Component: ${requestObj.moduleName}`);
                      setModalContent(codeData.code_text || 'No React source code found.');
                      setShowFullDocModal(true);
                    }}
                  >
                    <Icon name="terminal" size={12} className="inline mr-1" />
                    Review React Source Code
                  </Button>
                )}
              </div>
            )}

          </div>

          {/* Expiration warning tags */}
          <div className="p-3 bg-black/20 border border-white/5 rounded-xl flex items-center gap-2.5">
            <span className="material-icons text-amber-500 text-sm">hourglass_empty</span>
            <div className="text-[10px] leading-snug">
              <span className="text-slate-400 font-bold block">Safety Expiration Protocol</span>
              <span className="text-slate-300 font-medium">Expires: {approval.expires_at ? `${formatLocalDate(approval.expires_at)} ${formatLocalTime(approval.expires_at)}` : 'No Expiry Set'}</span>
            </div>
          </div>

          {/* Previous Notes/History Logs */}
          {approval.owner_notes && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Owner Resolution Notes</span>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-slate-300 text-xs italic leading-relaxed">
                "{approval.owner_notes}"
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Action Decision buttons (Rendered only if Pending) */}
      {isPending ? (
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] uppercase font-bold text-slate-400 block">Resolution Feedback Notes</label>
            <textarea
              value={ownerNotes}
              onChange={(e) => setOwnerNotes(e.target.value)}
              placeholder="Enter feedback notes or request changes here..."
              className="w-full h-16 px-4 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-violet-500 text-white outline-none placeholder-slate-600 resize-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={() => onResolve(approval.id, 'rejected', ownerNotes)}
              variant="soft"
              className="py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-white border border-red-500/20 hover:bg-red-500"
            >
              ❌ Reject
            </Button>
            <Button 
              onClick={() => onResolve(approval.id, 'approved', ownerNotes)}
              className="py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-xl"
            >
              ✅ Approve Action
            </Button>
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-white/5 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          Closed Safety Record
        </div>
      )}

      {/* Document Viewer Modal Overlay */}
      {showFullDocModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 text-left select-text"
          onClick={() => setShowFullDocModal(false)}
        >
          <div 
            className="w-full max-w-4xl max-h-[85vh] p-8 rounded-3xl border border-white/10 flex flex-col relative text-left select-text animate-in zoom-in duration-300 overflow-hidden"
            style={glassStyle({ glow: 'violet', strong: true })}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5 flex-shrink-0">
              <h2 className="text-xl font-black text-white">{modalTitle}</h2>
              <button 
                onClick={() => {
                  setShowFullDocModal(false);
                  setActiveTab('doc');
                  setDiffResult(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {/* Tabs for Blueprint Maker Version Control (Problem 2) */}
            {isBlueprintAction && (
              <div className="flex gap-2.5 mb-5 border-b border-white/10 pb-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('doc')}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'doc' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  📄 Document Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('versions');
                    loadVersions();
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'versions' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  🕒 Version History & Diff Compare
                </button>
              </div>
            )}
            
            {activeTab === 'doc' ? (
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap bg-black/40 p-5 rounded-2xl border border-white/5 select-text selection:bg-violet-500/30">
                {modalContent}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin flex flex-col gap-5">
                
                {/* Selector Row */}
                <div className="grid grid-cols-3 gap-4 items-end bg-white/5 p-4 rounded-2xl border border-white/10 flex-shrink-0">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] uppercase font-black text-slate-400 block">Version 1 (Old)</label>
                    <select
                      value={v1}
                      onChange={(e) => setV1(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
                    >
                      <option value="">Select version</option>
                      {versionsList.map(v => (
                        <option key={v.version} value={v.version}>v{v.version} ({v.changes || 'No changes noted'})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] uppercase font-black text-slate-400 block">Version 2 (New)</label>
                    <select
                      value={v2}
                      onChange={(e) => setV2(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-violet-500"
                    >
                      <option value="">Select version</option>
                      {versionsList.map(v => (
                        <option key={v.version} value={v.version}>v{v.version} ({v.changes || 'No changes noted'})</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleCompare}
                    disabled={!v1 || !v2}
                    className="py-2.5 rounded-xl text-xs font-black uppercase bg-violet-600 hover:bg-violet-500 w-full"
                  >
                    Compare with Previous
                  </Button>
                </div>

                {/* Diff Output Box */}
                {diffResult && (
                  <div className="flex-1 flex flex-col gap-4 min-h-[300px]">
                    
                    {/* Auto-Message Notification Bar */}
                    <div className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs rounded-xl flex items-center gap-2 font-black">
                      <span className="material-icons text-sm">info</span>
                      <span>{diffResult.diff_summary || `v${v2} vs v${v1} Comparison Report`}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 flex-1">
                      
                      {/* Added Lines (Green) */}
                      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 flex flex-col text-left">
                        <span className="text-[10px] uppercase font-black text-emerald-400 block mb-2 flex items-center gap-1.5">
                          <span className="material-icons text-sm text-emerald-400">add_circle</span> Added Requirements / Scope
                        </span>
                        <div className="flex-1 overflow-y-auto pr-1 text-slate-300 font-mono text-[10px] space-y-1.5 leading-relaxed max-h-[220px]">
                          {diffResult.added && diffResult.added.length > 0 ? (
                            diffResult.added.map((item, idx) => (
                              <div key={idx} className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-emerald-300">
                                {item}
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-500 italic block mt-2">No additions detected.</span>
                          )}
                        </div>
                      </div>

                      {/* Removed Lines (Red) */}
                      <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-4 flex flex-col text-left">
                        <span className="text-[10px] uppercase font-black text-rose-400 block mb-2 flex items-center gap-1.5">
                          <span className="material-icons text-sm text-rose-400">remove_circle</span> Removed Requirements / Scope
                        </span>
                        <div className="flex-1 overflow-y-auto pr-1 text-slate-300 font-mono text-[10px] space-y-1.5 leading-relaxed max-h-[220px]">
                          {diffResult.removed && diffResult.removed.length > 0 ? (
                            diffResult.removed.map((item, idx) => (
                              <div key={idx} className="p-2 bg-rose-500/5 border border-rose-500/10 rounded-lg text-rose-300">
                                {item}
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-500 italic block mt-2">No removals detected.</span>
                          )}
                        </div>
                      </div>

                    </div>

                  </div>
                )}

                {/* Versions Checklist / History Ledger */}
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex-shrink-0 text-left">
                  <span className="text-[10px] uppercase font-black text-slate-400 block mb-3">Version Changelog Ledger</span>
                  <div className="space-y-2">
                    {versionsList.map(v => (
                      <div key={v.version} className="flex justify-between items-center p-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-xs">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded-md bg-violet-600/30 text-violet-300 font-black text-[10px]">v{v.version}</span>
                          <span className="text-slate-300 font-bold">{v.changes || 'Initial Blueprint Specification'}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(v.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
