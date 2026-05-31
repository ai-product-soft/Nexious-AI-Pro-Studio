import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, glassStyle } from './consts';
import MickiiOrb from './MickiiOrb';
import Badge from './Badge';
import Button from './Button';
import Icon from './Icon';
import { getWorkerLogs } from '../data/db.js';
import { formatLocalTime } from '../utils/dateFormatter.js';
import { listen } from '@tauri-apps/api/event';

export default function ScreenHeader({ title, pageTitle, subtitle, index, badgeLabel, primaryAction, primaryIcon, secondaryAction, secondaryIcon, extraBadges, onPrimaryClick, onSecondaryClick }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    let unlistenLogs = null;

    const fetchLogs = async () => {
      try {
        const data = await getWorkerLogs();
        if (active) {
          const fetchedLogs = data ? data.slice(0, 5) : [];
          setLogs(fetchedLogs);
          if (fetchedLogs.length > 0) {
            const newest = fetchedLogs[0];
            const storedLastSeen = localStorage.getItem('mabishion_last_seen_notification_time') || '';
            if (newest.timestamp !== storedLastSeen) {
              setHasNewNotifications(true);
            }
          }
        }
      } catch (err) {
        console.warn("[ScreenHeader] Worker logs fetch error:", err);
      }
    };

    fetchLogs();

    // Listen to worker log updates in real-time
    listen('worker_log_updated', () => {
      fetchLogs();
    }).then((unsub) => {
      unlistenLogs = unsub;
      if (!active) unsub();
    });

    const interval = setInterval(fetchLogs, 5000);
    return () => {
      active = false;
      clearInterval(interval);
      if (unlistenLogs) unlistenLogs();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const handleSearchClick = () => {
    const inputEl = document.querySelector('input[placeholder*="Ask"], input[placeholder*="anything"]');
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
      const bar = inputEl.closest('div');
      if (bar) {
        bar.classList.add('scale-105', 'shadow-2xl');
        setTimeout(() => bar.classList.remove('scale-105', 'shadow-2xl'), 300);
      }
    }
  };

  const handleToggleNotifications = () => {
    const nextShow = !showNotifications;
    setShowNotifications(nextShow);
    if (nextShow && logs.length > 0) {
      // Mark as seen when opening the drawer
      const newest = logs[0];
      localStorage.setItem('mabishion_last_seen_notification_time', newest.timestamp);
      setHasNewNotifications(false);
    }
  };

  const handleLogClick = (log) => {
    setShowNotifications(false);
    const worker = log.worker_name ? log.worker_name.toLowerCase() : '';
    const msg = log.message ? log.message.toLowerCase() : '';
    
    // Marketing Queue Workers
    if (worker.includes('self_promo') || worker.includes('service_promo') || worker.includes('social') || worker.includes('scheduler') || worker.includes('showcaser') || worker.includes('marketing')) {
      navigate('/marketing');
    }
    // Sales & CRM Queue Workers
    else if (worker.includes('lead') || worker.includes('intake') || worker.includes('client') || msg.includes('lead')) {
      navigate('/leads');
    }
    // Development, Packaging & Product Queue Workers
    else if (worker.includes('developer') || worker.includes('website') || worker.includes('code') || worker.includes('packager') || worker.includes('product') || msg.includes('project') || msg.includes('build')) {
      navigate('/projects');
    }
    // Planning, Blueprint & Approvals Queue Workers
    else if (worker.includes('proposal') || worker.includes('compliance') || worker.includes('blueprint') || worker.includes('plan') || worker.includes('document') || msg.includes('approval') || msg.includes('blueprint')) {
      navigate('/approvals');
    }
    // Research Queue Workers (Business Analyst)
    else if (worker.includes('analyst') || worker.includes('research') || worker.includes('business')) {
      navigate('/build-new');
    }
    // Payment Queue Workers
    else if (worker.includes('payment') || worker.includes('invoice') || msg.includes('payment') || msg.includes('finance') || msg.includes('revenue')) {
      navigate('/finance');
    }
    // System Queue Workers
    else if (worker.includes('llm') || worker.includes('mcp') || worker.includes('notification') || worker.includes('system') || worker.includes('monitor')) {
      navigate('/system-monitor');
    }
    // Fallback
    else {
      navigate('/');
    }
  };

  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-4 px-5 py-3 relative z-50" style={glassStyle()}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black tracking-wider uppercase text-white/80">{title}</h2>
          </div>
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          {extraBadges}
          <Button variant="soft" className="px-3" onClick={handleSearchClick} title="Search Cockpit">
            <Icon name="search" size={17} />
          </Button>
          
          <div className="relative" ref={containerRef}>
            <Button 
              variant={hasNewNotifications ? 'glow' : 'soft'} 
              className={`px-3 relative transition-all duration-300 ${
                hasNewNotifications 
                  ? 'animate-pulse border-red-500/50 bg-red-950/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] border' 
                  : ''
              }`}
              onClick={handleToggleNotifications} 
              title="System Log alerts"
            >
              <Icon name="bell" size={17} />
              {logs.length > 0 && (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </Button>
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl p-4 text-xs z-50 transition-all animate-in fade-in duration-200 text-left"
                style={{ ...glassStyle({ strong: true, glow: 'violet' }), backgroundColor: 'rgba(2, 4, 10, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <h4 className="font-bold text-white uppercase tracking-wider">System Operations Log</h4>
                  <span className="text-[10px] text-slate-400">Live Logs</span>
                </div>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                  {logs.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">No recent worker operations.</p>
                  ) : (
                    logs.map((log) => (
                      <div 
                        key={log.id} 
                        onClick={() => handleLogClick(log)}
                        className="border-b border-white/5 pb-2 last:border-0 last:pb-2 text-left cursor-pointer hover:bg-white/[0.04] p-1.5 rounded-xl transition-all duration-150"
                        title="Click to view related console screen"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-extrabold uppercase text-[9px] tracking-wider" style={{ color: log.status === 'failed' ? C.danger : C.success }}>
                            {log.worker_name} · {log.status}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {formatLocalTime(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[10px]">{log.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <section className="mb-5 flex min-w-0 items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/10 backdrop-blur-sm text-white border border-white/10">
              {index === '01' ? 'Home Screen' : `${index} Main Screen`}
            </span>
            {badgeLabel && <Badge tone="muted">{badgeLabel}</Badge>}
          </div>
          <h1 className="text-4xl font-black tracking-tight" style={{ color: C.text }}>{pageTitle || title}</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6" style={{ color: C.mutedLow }}>{subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {secondaryAction && <Button variant="soft" icon={secondaryIcon || 'filter'} onClick={onSecondaryClick}>{secondaryAction}</Button>}
          {primaryAction && <Button icon={primaryIcon || 'plus'} onClick={onPrimaryClick}>{primaryAction}</Button>}
        </div>
      </section>
    </>
  );
}
