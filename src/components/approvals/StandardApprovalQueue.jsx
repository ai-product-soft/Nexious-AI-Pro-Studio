import React, { useState } from 'react';
import Icon from '../Icon';
import Badge from '../Badge';
import Button from '../Button';
import { C } from '../consts';
import { formatLocalTime } from '../../utils/dateFormatter.js';

export default function StandardApprovalQueue({ approvals, onSelectApproval, onResolveFast }) {
  const [filterTab, setFilterTab] = useState('pending'); // pending | approved | rejected | all
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all | critical | standard

  // Filtering Logic
  const filteredApprovals = approvals.filter(app => {
    // 1. Tab Status Filter
    const appStatus = (app.status || 'pending').toLowerCase();
    if (filterTab !== 'all' && appStatus !== filterTab) return false;

    // 2. Type Filter
    const appType = (app.type || 'standard').toLowerCase();
    if (filterType !== 'all' && appType !== filterType) return false;

    // 3. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (app.title || '').toLowerCase().includes(q);
      const workerMatch = (app.worker_name || '').toLowerCase().includes(q);
      return titleMatch || workerMatch;
    }

    return true;
  });

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 flex flex-col h-full animate-in fade-in duration-300">
      
      {/* Header and Counters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span className="material-icons text-violet-400">queue</span>
            Action Safegates Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">Select any item to trigger the detailed visual inspector slide-in.</p>
        </div>
        
        {/* Count indicators */}
        <div className="flex gap-2">
          <Badge tone="violet">{approvals.filter(a => (a.status || '').toLowerCase() === 'pending').length} Pending</Badge>
          <Badge tone="success">{approvals.filter(a => (a.status || '').toLowerCase() === 'approved').length} Approved</Badge>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 material-icons text-sm">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by worker name or request title..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-black/40 border border-white/10 rounded-xl focus:border-violet-500 text-white outline-none placeholder-slate-500 transition-all"
          />
        </div>

        {/* Type select */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-xl focus:border-violet-500 text-slate-300 outline-none transition-all"
        >
          <option value="all">Type: All Gates</option>
          <option value="critical">🚨 Critical Only</option>
          <option value="standard">⚙️ Standard Only</option>
        </select>
      </div>

      {/* Status Tab selectors */}
      <div className="flex mb-6 p-0.5 rounded-xl bg-black/40 border border-white/10 self-start">
        {['pending', 'approved', 'rejected', 'all'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              filterTab === tab 
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List Queue Area */}
      <div className="flex-1 overflow-y-auto min-h-[360px] max-h-[500px] pr-1 space-y-3 scrollbar-thin">
        {filteredApprovals.map(app => {
          const isCritical = (app.type || 'standard').toLowerCase() === 'critical';
          const isPending = (app.status || 'pending').toLowerCase() === 'pending';
          
          return (
            <div 
              key={app.id}
              onClick={() => onSelectApproval(app)}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left ${
                isCritical 
                  ? 'bg-red-500/5 hover:bg-red-500/10 border-red-500/20 hover:border-red-500/40' 
                  : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/15'
              }`}
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <Badge tone={isCritical ? 'danger' : 'info'}>
                    {isCritical ? '🚨 CRITICAL' : '⚙️ STANDARD'}
                  </Badge>
                  <Badge tone={(app.status || 'pending').toLowerCase() === 'approved' ? 'success' : (app.status || 'pending').toLowerCase() === 'rejected' ? 'danger' : 'gold'}>
                    {app.status || 'Pending'}
                  </Badge>
                  {app.whatsapp_sent === 1 && (
                    <span className="text-[10px] text-green-400 flex items-center gap-0.5" title="WhatsApp Outbound Sent">
                      <Icon name="check_circle" size={10} /> WA Sent
                    </span>
                  )}
                </div>
                
                <h4 className="font-bold text-white text-sm truncate">{app.title || 'Execute safety command'}</h4>
                
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">Worker: {app.worker_name || 'System'}</span>
                  <span>·</span>
                  <span>Requested: {formatLocalTime(app.created_at)}</span>
                </div>
              </div>

              {/* Quick Actions Inline (For pending items) */}
              {isPending && (
                <div className="flex items-center gap-2 self-end sm:self-center" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onResolveFast(app.id, 'rejected')}
                    className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all duration-300"
                    title="Reject Fast"
                  >
                    <Icon name="close" size={14} />
                  </button>
                  <button
                    onClick={() => onResolveFast(app.id, 'approved')}
                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all duration-300"
                    title="Approve Fast"
                  >
                    <Icon name="check" size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredApprovals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 space-y-2">
            <span className="material-icons text-3xl">inbox</span>
            <p className="text-xs font-semibold">No approvals found matching the search criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
