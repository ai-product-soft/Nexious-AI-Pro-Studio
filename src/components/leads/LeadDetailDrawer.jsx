import React, { useState, useEffect } from 'react';
import { updateLeadNotes, updateLeadStatus, deleteLead } from '../../data/db';
import { C, glassStyle } from '../consts';
import Icon from '../Icon';
import Button from '../Button';
import Badge from '../Badge';
import { runWorker } from '../../engine/workers/index.js';
import { formatLocalTime, formatLocalDate } from '../../utils/dateFormatter.js';

export default function LeadDetailDrawer({ lead, onClose, onUpdate }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [activeTab, setActiveTab] = useState('notes'); // notes, communication, whatsapp
  const [whatsappTemplate, setWhatsappTemplate] = useState('Introduction');
  const [whatsappLogs, setWhatsappLogs] = useState([]);
  const [isGeneratingMagnet, setIsGeneratingMagnet] = useState(false);
  const [magnetResult, setMagnetResult] = useState(null);

  // Load notes on open
  useEffect(() => {
    if (lead && lead.notes) {
      try {
        setNotes(JSON.parse(lead.notes));
      } catch (e) {
        // Fallback for plain text notes
        setNotes([{ id: 'init', text: lead.notes, timestamp: lead.created_at || new Date().toISOString(), type: 'system' }]);
      }
    } else {
      setNotes([]);
    }

    if (lead && lead.lead_magnet) {
      try {
        setMagnetResult(JSON.parse(lead.lead_magnet));
      } catch (e) {
        setMagnetResult({ headline: 'Custom Lead Magnet Blueprint', magnetText: lead.lead_magnet, adScript: '' });
      }
    } else {
      setMagnetResult(null);
    }

    // Mock some whatsapp logs for premium aesthetics
    setWhatsappLogs([
      { id: 1, template: 'Introduction', status: 'Read', time: '1 day ago' },
      { id: 2, template: 'Follow-up', status: 'Delivered', time: '5 hrs ago' }
    ]);
  }, [lead]);

  const handleGenerateLeadMagnet = async () => {
    setIsGeneratingMagnet(true);
    try {
      const result = await runWorker('lead_gen', lead.id);
      if (result.success) {
        setMagnetResult(result.output);
        if (onUpdate) onUpdate();
      } else {
        alert(`Lead magnet worker failed: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error generating lead magnet: ${err.message}`);
    } finally {
      setIsGeneratingMagnet(false);
    }
  };

  if (!lead) return null;

  const handleSaveNotesArray = async (updatedArray) => {
    try {
      const stringified = JSON.stringify(updatedArray);
      await updateLeadNotes(lead.id, stringified);
      setNotes(updatedArray);
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('[LeadDrawer] Error updating notes:', e);
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const added = [
      ...notes,
      {
        id: crypto.randomUUID(),
        text: newNote.trim(),
        timestamp: new Date().toISOString(),
        type: 'user'
      }
    ];
    setNewNote('');
    handleSaveNotesArray(added);
  };

  const handleStartEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const handleSaveEditNote = () => {
    if (!editingNoteText.trim()) return;
    const updated = notes.map(n => n.id === editingNoteId ? { ...n, text: editingNoteText.trim() } : n);
    setEditingNoteId(null);
    setEditingNoteText('');
    handleSaveNotesArray(updated);
  };

  const handleDeleteNote = (noteId) => {
    const updated = notes.filter(n => n.id !== noteId);
    handleSaveNotesArray(updated);
  };

  const handleStatusChange = async (newStatus) => {
    await updateLeadStatus(lead.id, newStatus);
    if (onUpdate) onUpdate();
  };

  const handleDeleteLead = async () => {
    if (window.confirm(`Are you sure you want to delete lead "${lead.name}"?`)) {
      await deleteLead(lead.id);
      if (onUpdate) onUpdate();
      onClose();
    }
  };

  // WhatsApp template triggers
  const getTemplateBody = (name) => {
    const templates = {
      'Introduction': `Hello ${name}, thanks for reaching out to Mabishion AI. We have analyzed your project context and generated a customized blueprint! Let's connect.`,
      'Follow-up': `Hi ${name}, just checking in on the proposed strategy blueprint. Do you have any questions or feedback for us?`,
      'Proposal': `Hi ${name}, your customized AI product development proposal is ready for review! Let us know when is a good time to run through it.`,
      'Reminder': `Hi ${name}, this is a gentle reminder regarding our scheduled strategy call. Looking forward to discussing the revenue scaling blueprint!`
    };
    return templates[whatsappTemplate] || '';
  };

  const handleSendWhatsApp = () => {
    const body = getTemplateBody(lead.name);
    // Add to timeline
    const updatedNotes = [
      ...notes,
      {
        id: crypto.randomUUID(),
        text: `WhatsApp Template Sent (${whatsappTemplate}): "${body}"`,
        timestamp: new Date().toISOString(),
        type: 'whatsapp'
      }
    ];
    handleSaveNotesArray(updatedNotes);

    // Add to WhatsApp status logs
    const newLog = {
      id: Date.now(),
      template: whatsappTemplate,
      status: 'Sent',
      time: 'Just now'
    };
    setWhatsappLogs(prev => [newLog, ...prev]);

    // Simulate status transition for read receipts (Sent -> Delivered -> Read)
    setTimeout(() => {
      setWhatsappLogs(prev => prev.map(l => l.id === newLog.id ? { ...l, status: 'Delivered' } : l));
    }, 1500);

    setTimeout(() => {
      setWhatsappLogs(prev => prev.map(l => l.id === newLog.id ? { ...l, status: 'Read' } : l));
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Background click close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Body */}
      <div className="w-full max-w-lg h-full bg-[#0F172A] border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div>
            <h2 className="text-xl font-black text-white">{lead.name}</h2>
            <p className="text-xs text-slate-400 font-mono tracking-wider">{lead.email}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-105"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Lead Summary Info */}
        <div className="p-6 bg-white/5 border-b border-white/5 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-2xl bg-black/20 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</span>
            <select
              className="bg-transparent text-xs text-violet-400 font-bold border-none outline-none cursor-pointer"
              value={lead.status || 'New'}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal Sent">Proposal Sent</option>
              <option value="Negotiating">Negotiating</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>
          <div className="p-3 rounded-2xl bg-black/20 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Budget</span>
            <span className="text-xs text-emerald-400 font-bold font-mono">{lead.budget || '$1k - $5k'}</span>
          </div>
          <div className="p-3 rounded-2xl bg-black/20 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Score</span>
            <span className="text-xs text-amber-400 font-black">{lead.score || 0}/100</span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/5 text-xs font-bold text-slate-400 bg-black/10">
          <button 
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${activeTab === 'notes' ? 'text-violet-400 border-violet-500 bg-white/5' : 'border-transparent'}`}
          >
            Notes & Timeline
          </button>
          <button 
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${activeTab === 'whatsapp' ? 'text-violet-400 border-violet-500 bg-white/5' : 'border-transparent'}`}
          >
            WhatsApp Gate
          </button>
          <button 
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${activeTab === 'details' ? 'text-violet-400 border-violet-500 bg-white/5' : 'border-transparent'}`}
          >
            Communication Log
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
          
          {/* TAB 1: Notes timeline */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              
              {/* Lead Magnet Copysmith Builder */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="material-icons text-amber-400 text-sm">bolt</span>
                    Lead Magnet Copysmith
                  </h4>
                  {magnetResult && <Badge tone="gold">Generated</Badge>}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Analyze this lead's acquisition source & budget to craft highly personalized landing page copy & ad headlines.
                </p>

                {magnetResult ? (
                  <div className="space-y-3 pt-1">
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                      <span className="text-[9px] uppercase font-bold text-amber-300 block font-mono">Headline Hook</span>
                      <p className="text-xs text-white font-bold leading-relaxed">{magnetResult.headline}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                      <span className="text-[9px] uppercase font-bold text-violet-300 block font-mono">Magnet Blueprint Outline</span>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{magnetResult.magnetText}</p>
                    </div>
                    {magnetResult.adScript && (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[9px] uppercase font-bold text-cyan-300 block font-mono">Tailored Social/Search Ad</span>
                        <p className="text-xs text-slate-300 leading-relaxed font-mono select-all bg-black/20 p-1.5 rounded">{magnetResult.adScript}</p>
                      </div>
                    )}
                    <Button 
                      variant="soft" 
                      onClick={handleGenerateLeadMagnet}
                      disabled={isGeneratingMagnet}
                      className="w-full text-[10px] py-1.5"
                    >
                      {isGeneratingMagnet ? 'Regenerating...' : 'Regenerate Content'}
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full text-xs font-black" 
                    onClick={handleGenerateLeadMagnet}
                    disabled={isGeneratingMagnet}
                  >
                    {isGeneratingMagnet ? 'Processing Prospect Profile...' : '⚡ Generate Lead Magnet'}
                  </Button>
                )}
              </div>

              {/* Add Note */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a quick timeline update note..."
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-violet-500 text-xs"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <Button variant="solid" onClick={handleAddNote} className="px-3">
                  <Icon name="add" size={15} />
                </Button>
              </div>

              {/* Timeline list */}
              <div className="relative border-l border-white/10 pl-5 ml-2 space-y-4 pt-2">
                {notes.map((note) => (
                  <div key={note.id} className="relative group">
                    {/* Circle icon */}
                    <span className="absolute -left-[26px] top-0 w-3 h-3 rounded-full border-2 bg-[#0F172A] border-violet-400" />
                    
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-mono">{formatLocalDate(note.timestamp)} {formatLocalTime(note.timestamp, { hour: '2-digit', minute: '2-digit' })}</span>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleStartEditNote(note)} className="hover:text-blue-400">
                            <Icon name="edit" size={12} />
                          </button>
                          <button onClick={() => handleDeleteNote(note.id)} className="hover:text-red-400">
                            <Icon name="delete" size={12} />
                          </button>
                        </div>
                      </div>

                      {editingNoteId === note.id ? (
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            className="flex-1 bg-black/40 border border-white/15 rounded px-2 py-1 text-xs text-white outline-none"
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                          />
                          <button onClick={handleSaveEditNote} className="text-emerald-400 text-xs font-bold">Save</button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-200 leading-relaxed">{note.text}</p>
                      )}
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-xs text-slate-500 italic pl-2">No timeline entries yet. Add one above!</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WhatsApp Gate */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Icon name="chat" />
                  WhatsApp Personal Marketing Templates
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Template</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white outline-none text-xs"
                    value={whatsappTemplate}
                    onChange={(e) => setWhatsappTemplate(e.target.value)}
                  >
                    <option value="Introduction">Introduction Template</option>
                    <option value="Follow-up">Follow-up Template</option>
                    <option value="Proposal">Proposal Template</option>
                    <option value="Reminder">Reminder Template</option>
                  </select>
                </div>

                <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-gray-300 font-mono leading-relaxed select-all">
                  {getTemplateBody(lead.name)}
                </div>

                <Button 
                  onClick={handleSendWhatsApp}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  <Icon name="send" size={14} /> Send WhatsApp Message
                </Button>
              </div>

              {/* Status Receipts logs */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-white">Outbound Message Status Receipts</h4>
                <div className="space-y-2">
                  {whatsappLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-white">{log.template} Template</p>
                        <p className="text-[10px] text-slate-500">{log.time}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${
                          log.status === 'Read' ? 'bg-cyan-400' :
                          log.status === 'Delivered' ? 'bg-emerald-400' :
                          'bg-amber-400'
                        }`} />
                        <span className="font-bold font-mono text-[10px] uppercase text-slate-400">{log.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Details & Communication Logs */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3 text-xs">
                <h4 className="font-black text-white uppercase text-[10px] tracking-wider mb-2">Lead Demographics</h4>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-slate-400">Phone Number</span>
                  <span className="text-white font-mono">{lead.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-slate-400">Traffic Source</span>
                  <Badge tone="info">{lead.source}</Badge>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-slate-400">Created At</span>
                  <span className="text-white font-mono">{new Date(lead.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Last Contacted</span>
                  <span className="text-white font-mono">{new Date(lead.last_contacted).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Quick Channels Outreach */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-white">Outbound Communications</h4>
                <div className="grid grid-cols-2 gap-2">
                  <a 
                    href={`mailto:${lead.email}`}
                    className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center justify-center gap-2 hover:bg-blue-500/20 text-xs font-bold transition-all"
                  >
                    <Icon name="mail" size={14} /> Send Email
                  </a>
                  <button 
                    onClick={() => {
                      alert(`Dialing phone channel: ${lead.phone || 'N/A'}`);
                    }}
                    className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center gap-2 hover:bg-violet-500/20 text-xs font-bold transition-all"
                  >
                    <Icon name="call" size={14} /> Dial Phone
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Delete Trigger */}
        <div className="p-6 border-t border-white/5 bg-black/20 flex gap-2">
          <Button 
            variant="danger" 
            onClick={handleDeleteLead}
            className="w-full text-xs font-bold"
          >
            <Icon name="delete_forever" size={15} /> Delete Lead Permanent
          </Button>
        </div>
      </div>
    </div>
  );
}
