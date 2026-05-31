import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { glassStyle } from '../components/consts';
import { 
  getApprovals, 
  updateApprovalStatus, 
  getWhatsAppLogs, 
  getSetting, 
  setSetting 
} from '../data/db.js';
import { WhatsAppService } from '../services/whatsappService.js';
import { ApprovalEngine } from '../services/approvalEngine.js';

import StandardApprovalQueue from '../components/approvals/StandardApprovalQueue';
import ApprovalDetailDrawer from '../components/approvals/ApprovalDetailDrawer';
import CriticalApprovalModal from '../components/approvals/CriticalApprovalModal';
import AppShell from '../components/AppShell';

export default function ApprovalCenterScreen({ onNavigate }) {
  const location = useLocation();
  const [approvals, setApprovals] = useState([]);
  const [whatsAppLogs, setWhatsAppLogs] = useState([]);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [ownerPhone, setOwnerPhone] = useState('919876543210');
  
  // Selection/Modals state
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [criticalApproval, setCriticalApproval] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simulated Webhook Commands
  const [commandInput, setCommandInput] = useState('');
  const [simulatedPhone, setSimulatedPhone] = useState('919876543210');
  const [webhookTerminalLogs, setWebhookTerminalLogs] = useState([
    { time: new Date().toLocaleTimeString(), text: 'System Webhook simulator initialized. Standby...' }
  ]);

  // Load approvals, WhatsApp status, and logs
  const loadData = async () => {
    try {
      // 1. Fetch approvals from SQLite
      const data = await getApprovals();
      setApprovals(data);

      // Check if there is a pending critical approval to show modal
      const criticalItem = data.find(a => 
        (a.type || '').toLowerCase() === 'critical' && 
        (a.status || '').toLowerCase() === 'pending'
      );
      if (criticalItem) {
        setCriticalApproval(criticalItem);
      } else {
        setCriticalApproval(null);
      }

      // 2. Fetch WhatsApp status
      const status = await WhatsAppService.getStatus();
      setWaStatus(status);

      // 3. Fetch WhatsApp logs from SQLite
      const logs = await getWhatsAppLogs();
      setWhatsAppLogs(logs);

      // 4. Fetch Owner Phone from SQLite settings
      const phone = await getSetting('whatsapp_owner_phone');
      if (phone) setOwnerPhone(phone);

    } catch (err) {
      console.error('[ApprovalCenterScreen] Load error:', err);
    }
  };

  // Initial Boot
  useEffect(() => {
    // Initialize engine & listeners
    ApprovalEngine.initialize();
    
    const initLoad = async () => {
      await loadData();
      // Check location state ONLY ONCE on mount
      if (location.state && location.state.selectedId) {
        const data = await getApprovals();
        const matchingApp = data.find(a => a.id === location.state.selectedId);
        if (matchingApp) {
          setSelectedApproval(matchingApp);
        }
      }
    };
    
    initLoad();

    // Auto-refresh interval every 5 seconds to capture background auto-approves or worker triggers
    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // WhatsApp connection managers
  const handleConnectWhatsApp = async () => {
    setIsScanning(true);
    await WhatsAppService.initialize();
    setWaStatus('qr_required');
    setIsScanning(false);
  };

  const handleSimulateQRScan = async () => {
    setIsScanning(true);
    // Latency simulation
    await new Promise(resolve => setTimeout(resolve, 1500));
    const nextStatus = await WhatsAppService.scanQRCode();
    setWaStatus(nextStatus);
    setIsScanning(false);
    
    // Add system log
    setWebhookTerminalLogs(prev => [
      { time: new Date().toLocaleTimeString(), text: '🟢 WhatsApp Session connected! Secure handshake verified.' },
      ...prev
    ]);
    
    loadData();
  };

  const handleDisconnectWhatsApp = async () => {
    const status = await WhatsAppService.disconnect();
    setWaStatus(status);
    setWebhookTerminalLogs(prev => [
      { time: new Date().toLocaleTimeString(), text: '🔴 WhatsApp Session disconnected.' },
      ...prev
    ]);
    loadData();
  };

  const handleSavePhone = async () => {
    await setSetting('whatsapp_owner_phone', ownerPhone);
    alert('Owner WhatsApp phone number updated successfully!');
  };

  // Resolve actions
  const handleResolveApproval = async (id, status, notes = '') => {
    setIsRefreshing(true);
    await updateApprovalStatus(id, status, notes);
    
    // Auto WhatsApp confirmation feedback
    try {
      const app = approvals.find(a => a.id === id);
      if (app && waStatus === 'connected') {
        if (status === 'approved') {
          await WhatsAppService.sendTemplate(ownerPhone, 'APPROVED', {
            project_name: app.title,
            worker_name: app.worker_name
          });
        } else {
          await WhatsAppService.sendTemplate(ownerPhone, 'REJECTED', {
            project_name: app.title,
            owner_notes: notes || 'Rejected by owner.'
          });
        }
      }
    } catch (e) {
      console.warn('[ApprovalCenterScreen] Resolving outbound feedback error:', e);
    }

    // Refresh UI
    setSelectedApproval(null);
    setCriticalApproval(null);
    await loadData();
    setIsRefreshing(false);
  };

  // Fast resolving from queue
  const handleResolveFast = async (id, status) => {
    await handleResolveApproval(id, status, `Approved quickly from dashboard panel.`);
  };

  // Simulated remote Webhook message sender
  const handleSimulateInboundCommand = async () => {
    if (!commandInput.trim()) return;

    const commandText = commandInput.trim();
    
    // Log the action locally
    setWebhookTerminalLogs(prev => [
      { time: new Date().toLocaleTimeString(), text: `💬 Incoming WA: "${commandText}" (From: ${simulatedPhone})` },
      ...prev
    ]);

    // Clear input
    setCommandInput('');

    // Trigger the registered handler in WhatsAppService
    await WhatsAppService.receiveSimulatedWebhook(simulatedPhone, commandText);

    // Refresh screen data after brief latency to capture updates
    setTimeout(async () => {
      await loadData();
    }, 1000);
  };

  // Helper template commands inserter
  const insertTemplateCommand = (cmd, id = '') => {
    setCommandInput(`${cmd} ${id || 'YOUR-APPROVAL-ID'}`);
  };

  return (
    <AppShell activeNavId="approvals" onNavigate={onNavigate}>
      <div className="space-y-8 max-w-7xl mx-auto p-4 select-text pb-20">
      
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wider flex items-center gap-3">
            <span className="material-icons text-red-500 animate-pulse text-4xl">gavel</span>
            Human-in-the-Loop SafeGates
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage real-time agent automation approvals, critical payment triggers, and WhatsApp Web remote dashboard channels.
          </p>
        </div>
        
        {/* Quick telemetry statistics indicators */}
        <div className="flex items-center gap-3">
          <Button 
            onClick={loadData} 
            variant="soft" 
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-300 border border-white/10"
          >
            <span className={`material-icons text-sm ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
            Sync SQLite
          </Button>
        </div>
      </div>

      {/* Grid Layout of components */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column (8 spans): Active Queue list */}
        <div className="lg:col-span-8 space-y-8">
          
          <StandardApprovalQueue 
            approvals={approvals}
            onSelectApproval={setSelectedApproval}
            onResolveFast={handleResolveFast}
          />

          {/* Incoming Simulated WhatsApp remote commands console */}
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 space-y-4 text-left">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span className="material-icons text-cyan-400">terminal</span>
                WhatsApp Webhook & Remote Controller Simulator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Simulate remote WhatsApp control. Paste a pending approval ID below and type commands to test offline pipeline triggers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Controller Input */}
              <div className="md:col-span-8 space-y-3">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Simulated Sender Phone</label>
                    <input 
                      type="text"
                      value={simulatedPhone}
                      onChange={(e) => setSimulatedPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/10 rounded-xl focus:border-violet-500 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Action Quick-Macros</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => insertTemplateCommand('APPROVE', approvals.find(a => (a.status||'').toLowerCase() === 'pending')?.id)}
                        className="px-2.5 py-1 text-[9px] font-black uppercase bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20"
                      >
                        + Approve
                      </button>
                      <button
                        onClick={() => insertTemplateCommand('REJECT', approvals.find(a => (a.status||'').toLowerCase() === 'pending')?.id)}
                        className="px-2.5 py-1 text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20"
                      >
                        + Reject
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    placeholder="Example command: APPROVE 248b-39a1-..."
                    className="w-full pl-4 pr-32 py-3 text-xs font-mono bg-black/60 border border-white/10 rounded-xl focus:border-cyan-500 text-cyan-400 outline-none"
                  />
                  <Button
                    onClick={handleSimulateInboundCommand}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-4 py-0 rounded-lg text-[10px] font-black uppercase bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1"
                  >
                    <span className="material-icons text-xs">send</span> Simulate Message
                  </Button>
                </div>
              </div>

              {/* Terminal Logs */}
              <div className="md:col-span-4 bg-black/60 border border-white/5 rounded-2xl p-4 font-mono text-[10px] text-slate-300 h-28 overflow-y-auto space-y-1.5 scrollbar-thin">
                {webhookTerminalLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-slate-500">[{log.time}]</span>
                    <span className="break-all">{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column (4 spans): Outbound settings and scanner */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Outbound WhatsApp Web Session Manager panel */}
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 space-y-6 text-left">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span className="material-icons text-green-400">chat</span>
                WhatsApp Web Session
              </h3>
              <p className="text-xs text-slate-400 mt-1">Configure physical mobile scanning and session handshake telemetry.</p>
            </div>

            {/* Simulated QR Element if qr_required */}
            {waStatus === 'qr_required' && (
              <div className="p-6 rounded-2xl bg-white border border-slate-300 flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in duration-300">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Scan with WhatsApp Mobile app</span>
                
                {/* Visual Premium Mock scan code layout */}
                <div className="h-40 w-40 bg-slate-100 border-4 border-slate-900 rounded-xl relative p-2 flex items-center justify-center cursor-pointer" onClick={handleSimulateQRScan}>
                  <div className="grid grid-cols-5 grid-rows-5 gap-1.5 w-full h-full opacity-90">
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-100 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-100 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-100 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-100 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-100 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-100 rounded"></div>
                    <div className="bg-slate-100 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-100 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                    <div className="bg-slate-900 rounded"></div>
                  </div>
                  {/* Holographic scanner laser hover line effect */}
                  <div className="absolute left-0 right-0 h-1 bg-green-500 animate-bounce top-1/2"></div>
                </div>

                <Button 
                  onClick={handleSimulateQRScan} 
                  className="py-1.5 w-full rounded-xl text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold"
                  disabled={isScanning}
                >
                  {isScanning ? 'Verifying QR Handshake...' : 'Simulate Scanner Capture'}
                </Button>
              </div>
            )}

            {/* Connected active state banner */}
            {waStatus === 'connected' && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-950/20 to-emerald-950/10 border border-green-500/20 text-slate-300 space-y-4 animate-in zoom-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 border border-green-500/30">
                    <Icon name="check_circle" size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Link Status</span>
                    <span className="text-xs font-black text-white uppercase tracking-widest">Handshake Verified</span>
                  </div>
                </div>

                <div className="text-[10px] space-y-1.5 text-slate-400 border-t border-white/5 pt-3">
                  <p>🟢 Active session initialized on local Chromium environment</p>
                  <p>🛡️ Cost limit safety: ₹0 Default outbound active</p>
                  <p>🔇 Quiet hours safety check: Enabled</p>
                </div>

                <Button 
                  onClick={handleDisconnectWhatsApp} 
                  variant="soft" 
                  className="w-full text-xs font-bold text-red-400 hover:text-white border border-red-500/20 hover:bg-red-500 py-2 rounded-xl"
                >
                  Disconnect Channel
                </Button>
              </div>
            )}

            {/* Disconnected state */}
            {waStatus === 'disconnected' && (
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 text-center space-y-4 animate-in zoom-in duration-300">
                <div className="material-icons text-4xl text-slate-600">phonelink_off</div>
                <p className="text-xs text-slate-400 leading-normal">
                  WhatsApp automation is currently inactive. Outbound critical beep alarms are strictly localized.
                </p>
                <Button 
                  onClick={handleConnectWhatsApp} 
                  className="py-2.5 w-full rounded-xl text-xs bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-wider shadow-lg"
                >
                  Connect WhatsApp
                </Button>
              </div>
            )}

            {/* Settings Parameter update block */}
            <div className="space-y-4 border-t border-white/5 pt-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-slate-400 block">Owner WhatsApp Mobile Number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="919876543210"
                    className="flex-1 px-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-xl focus:border-violet-500 text-white outline-none"
                  />
                  <Button 
                    onClick={handleSavePhone}
                    variant="soft"
                    className="px-3 py-1 rounded-xl text-[10px] font-bold border border-white/10 text-slate-300"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Outbound Telegram/WhatsApp Logs telemetry array */}
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 space-y-4 text-left">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span className="material-icons text-violet-400">history</span>
                Outbound Message Ledger
              </h3>
              <p className="text-xs text-slate-400 mt-1">Secure local logs of all attempted remote SMS triggers.</p>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
              {whatsAppLogs.map(log => (
                <div key={log.id} className="p-3 bg-black/30 border border-white/5 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-bold text-slate-400">To: {log.phone}</span>
                    <Badge tone={log.status === 'sent' ? 'success' : 'danger'}>
                      {log.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-mono truncate">{log.message}</p>
                  <span className="text-[8px] text-slate-500 block">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              ))}

              {whatsAppLogs.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">No SMS messages sent yet.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Slide-in Detail Drawer */}
      {selectedApproval && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedApproval(null)}>
          <ApprovalDetailDrawer 
            approval={selectedApproval}
            onClose={() => setSelectedApproval(null)}
            onResolve={handleResolveApproval}
          />
        </div>
      )}

      {/* Critical Override Alert Modal */}
      {criticalApproval && (
        <CriticalApprovalModal 
          approval={criticalApproval}
          onResolve={handleResolveApproval}
          onClose={() => setCriticalApproval(null)}
        />
      )}

      </div>
    </AppShell>
  );
}
