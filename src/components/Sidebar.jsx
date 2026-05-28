import React, { useState, useEffect } from 'react';
import { C, glassStyle } from './consts';
import MickiiOrb from './MickiiOrb';
import Icon from './Icon';
import nexiousLogo from '../assets/Mabishion-logo.png';
import nexiousIcon from '../assets/Mabishion-icon.png';
import Badge from './Badge';
import { getPendingApprovals } from '../data/db.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: 'dashboard' },
  { id: 'build-new', label: 'Build New', icon: 'rocket' },
  { id: 'projects', label: 'Projects', icon: 'project' },
  { id: 'leads', label: 'Lead CRM', icon: 'users' },
  { id: 'sales-marketing', label: 'Sales & Marketing Hub', icon: 'megaphone' },
  { id: 'approvals', label: 'Approval Center', icon: 'approval', badge: true },
  { id: 'finance', label: 'Finance Hub', icon: 'wallet' },
  { id: 'system-monitor', label: 'System Monitor', icon: 'brain' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar({ activeNavId, onNavigate }) {
  const [expanded] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Monitor pending approvals dynamically
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const list = await getPendingApprovals();
        setPendingCount(list.length);
      } catch (err) {
        console.warn("[Sidebar] Approvals count fetch error:", err);
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 4000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <aside
      className="fixed left-0 top-0 z-50 flex h-screen flex-col py-5 transition-all duration-300"
      style={{
        width: expanded ? C.sidebarExpand : C.sidebarW,
        paddingLeft: expanded ? 16 : 12,
        paddingRight: expanded ? 16 : 12,
        background: 'linear-gradient(180deg, rgba(7,11,22,.72), rgba(2,4,10,.90))',
        borderRight: `1px solid ${C.glassBorder}`,
        backdropFilter: 'blur(28px)',
        boxShadow: expanded ? '28px 0 70px rgba(0,0,0,.38)' : '10px 0 36px rgba(0,0,0,.18)'
      }}>
      
      <div className="mb-6 flex flex-col justify-center rounded-2xl cursor-pointer hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300"
        onClick={() => onNavigate('dashboard')}
        title="Go to Home Screen"
        style={{ 
          padding: expanded ? '12px 18px' : '10px 0', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          color: C.softGold,
          alignItems: expanded ? 'flex-start' : 'center'
        }}>
        {expanded ? (
          <div className="min-w-0">
            <img src={nexiousLogo} alt="Mabishion AI" className="h-12 w-auto object-contain" />
          </div>
        ) : (
          <img src={nexiousIcon} alt="Mabishion AI" className="h-8 w-auto object-contain rounded-lg" />
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeNavId;
          return (
            <button key={item.id}
              title={item.label}
              onClick={() => onNavigate(item.id)}
              className="relative flex h-10 items-center rounded-2xl text-xs transition-all duration-200"
              style={{
                justifyContent: expanded ? 'flex-start' : 'center',
                gap: expanded ? 12 : 0,
                padding: expanded ? '0 14px' : 0,
                color: active ? C.softGold : C.mutedLow,
                backgroundColor: active ? `${C.gold}1A` : 'transparent'
              }}>
              {active && <span className="absolute -left-3 h-7 w-1 rounded-full" style={{ backgroundColor: C.gold }} />}
              <Icon name={item.icon} size={18} />
              
              {expanded && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate font-semibold">{item.label}</span>
                  {item.badge && pendingCount > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-[9px] font-black rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 animate-pulse shadow-md shadow-amber-500/20">
                      {pendingCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-4 rounded-2xl" style={{ ...glassStyle(), padding: expanded ? 14 : 8 }}>
        {expanded ? (
          <div>
            <div className="mb-2 flex items-center gap-2" style={{ color: C.success }}>
              <Icon name="shield" size={16} /><span className="text-xs font-black">Approval Safe</span>
            </div>
            <p className="text-[11px] leading-5" style={{ color: C.mutedLow }}>No external action without manual YES. Mickii executes only stored skills.</p>
          </div>
        ) : <Icon name="shield" size={19} className="mx-auto" style={{ color: C.success }} />}
      </div>
    </aside>
  );
}
