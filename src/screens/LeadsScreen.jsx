import React, { useState, useEffect } from 'react';
import { getLeads, updateLeadStatus, deleteLead } from '../data/db.js';
import AppShell from '../components/AppShell';
import ScreenHeader from '../components/ScreenHeader';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { C, glassStyle } from '../components/consts';

import LeadForm from '../components/leads/LeadForm';
import LeadTable from '../components/leads/LeadTable';
import LeadPipeline from '../components/leads/LeadPipeline';
import LeadDetailDrawer from '../components/leads/LeadDetailDrawer';

export default function LeadsScreen({ onNavigate }) {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [viewTab, setViewTab] = useState('table'); // table | pipeline
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const data = await getLeads();
      setLeads(data || []);
    } catch (e) {
      console.error('[CRM] Error loading leads:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleUpdateStatus = async (leadId, newStatus) => {
    await updateLeadStatus(leadId, newStatus);
    await fetchLeads();
    
    // Refresh selected lead if open
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead(prev => ({ ...prev, status: newStatus }));
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      for (const id of ids) {
        await deleteLead(id);
      }
      await fetchLeads();
    } catch (e) {
      console.error('[CRM] Bulk delete failed:', e);
    }
  };

  const handleBulkStatusChange = async (ids, newStatus) => {
    try {
      for (const id of ids) {
        await updateLeadStatus(id, newStatus);
      }
      await fetchLeads();
    } catch (e) {
      console.error('[CRM] Bulk status update failed:', e);
    }
  };

  // Summarize stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => (l.status || 'New') === 'New').length;
  const qualifiedLeads = leads.filter(l => l.status === 'Qualified').length;
  const wonLeads = leads.filter(l => l.status === 'Won').length;

  return (
    <AppShell activeNavId="leads" onNavigate={onNavigate}>
      <div className="space-y-6 max-w-7xl mx-auto p-4">
        {/* Header Section */}
        <ScreenHeader 
          title="Lead CRM Console" 
          subtitle="Mabishion AI Studio Private Client Intake Scorer & Pipeline"
          primaryAction={showAddForm ? "Close Form" : "Add New Lead"}
          primaryIcon={showAddForm ? "close" : "person_add"}
          onPrimaryClick={() => setShowAddForm(!showAddForm)}
        />

        {/* Lead Capture Form Section */}
        {showAddForm && (
          <div className="grid grid-cols-1 gap-6 max-w-3xl mx-auto animate-in slide-in-from-top duration-300">
            <LeadForm onSubmitSuccess={() => {
              fetchLeads();
              setShowAddForm(false);
            }} />
          </div>
        )}

        {/* Quick Metrics Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Pipeline</span>
              <span className="text-xl font-black text-white">{totalLeads} Leads</span>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
              <Icon name="groups" size={20} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">New Intake</span>
              <span className="text-xl font-black text-white">{newLeads} Fresh</span>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
              <Icon name="fiber_new" size={20} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Qualified</span>
              <span className="text-xl font-black text-white">{qualifiedLeads} Hot</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Icon name="verified" size={20} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Won / Closed</span>
              <span className="text-xl font-black text-white">{wonLeads} Conversions</span>
            </div>
            <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400">
              <Icon name="monetization_on" size={20} />
            </div>
          </div>
        </div>

        {/* View tab toggles */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex gap-2 p-0.5 rounded-xl bg-black/40 border border-white/10">
            <button
              onClick={() => setViewTab('table')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === 'table' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon name="table_chart" size={14} /> Table Index
            </button>
            <button
              onClick={() => setViewTab('pipeline')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === 'pipeline' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon name="view_week" size={14} /> Kanban Pipeline
            </button>
          </div>
          <Badge tone="violet">Intake Active</Badge>
        </div>

        {/* Main Content Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-bold">Querying SQLite Lead Registry...</span>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            {viewTab === 'table' ? (
              <LeadTable 
                leads={leads} 
                onSelectLead={setSelectedLead} 
                onBulkDelete={handleBulkDelete}
                onBulkStatusChange={handleBulkStatusChange}
              />
            ) : (
              <LeadPipeline 
                leads={leads} 
                onSelectLead={setSelectedLead} 
                onUpdateStatus={handleUpdateStatus}
              />
            )}
          </div>
        )}

        {/* Slide in details drawer */}
        {selectedLead && (
          <LeadDetailDrawer 
            lead={selectedLead} 
            onClose={() => setSelectedLead(null)} 
            onUpdate={fetchLeads}
          />
        )}
      </div>
    </AppShell>
  );
}
