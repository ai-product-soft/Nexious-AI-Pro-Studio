import React, { useState, useEffect } from "react";
import Icon from "../Icon";
import Button from "../Button";
import { glassStyle } from "../consts";
import { formatLocalTime } from "../../utils/dateFormatter.js";

export default function CriticalApprovalModal({
  approval,
  onResolve,
  onClose,
}) {
  const [ownerNotes, setOwnerNotes] = useState("");
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour = 3600 seconds
  const [isPulse, setIsPulse] = useState(false);

  // Compute time left on mount based on expires_at
  useEffect(() => {
    if (approval?.expires_at) {
      const difference = Math.floor(
        (new Date(approval.expires_at).getTime() - new Date().getTime()) / 1000,
      );
      setTimeLeft(difference > 0 ? difference : 0);
    }
  }, [approval]);

  // Expiry Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }

        // Trigger red pulse under 5 minutes (300 seconds)
        if (prev - 1 < 300) {
          setIsPulse(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!approval) return null;

  // Format countdown text: MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  // Prevent escape close by handling modal blur or absolute overlays
  const handleOverlayClick = (e) => {
    e.stopPropagation();
    // Do nothing: Auto-focus locked! Owner MUST act!
  };

  // Parse request_data preview
  let requestObj = {};
  try {
    requestObj =
      typeof approval.request_data === "string"
        ? JSON.parse(approval.request_data)
        : approval.request_data || {};
  } catch (e) {
    requestObj = { raw: approval.request_data };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-lg p-8 rounded-3xl border border-white/10 flex flex-col relative text-left select-none animate-in zoom-in duration-300"
        style={glassStyle({ glow: "red", strong: true })}
        onClick={handleOverlayClick}
      >
        {/* Glow Header Alert */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
            <Icon name="gavel" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-wider">
              🚨 Critical Gate
            </h2>
            <p className="text-xs text-red-400 font-bold uppercase tracking-widest">
              Immediate Owner Action Required
            </p>
          </div>
        </div>

        {/* Dynamic Countdown Timer Widget */}
        <div className="bg-red-950/20 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between mb-6">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Time Limit Remaining
          </span>
          <span
            className={`text-2xl font-black font-mono tracking-wider ${isPulse ? "text-red-500 animate-pulse scale-110 duration-500" : "text-yellow-500"}`}
          >
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Content details */}
        <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Requested Task
            </span>
            <p className="text-base font-bold text-white leading-snug">
              {approval.title || "Execute critical action"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Origin Worker
              </span>
              <p className="text-sm font-semibold text-slate-300">
                {approval.worker_name || "System Base"}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Requested At
              </span>
              <p className="text-sm font-semibold text-slate-300">
                {formatLocalTime(
                  approval.created_at || new Date().toISOString(),
                )}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/30 border border-white/5 font-mono text-xs text-slate-300 space-y-2">
            <span className="text-[10px] uppercase font-bold text-violet-400 block">
              Action Details Matrix
            </span>
            <div className="space-y-1">
              {Object.entries(requestObj).map(([key, val]) => (
                <div key={key} className="flex justify-between gap-4">
                  <span className="text-slate-500 font-medium">{key}:</span>
                  <span className="text-slate-300 font-bold text-right truncate max-w-[240px]">
                    {typeof val === "object"
                      ? JSON.stringify(val)
                      : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Owner Feedback Comment Textarea */}
        <div className="space-y-2 mb-6">
          <label className="text-[10px] uppercase font-bold text-slate-400 block">
            Feedback / Notes to Worker
          </label>
          <textarea
            value={ownerNotes}
            onChange={(e) => setOwnerNotes(e.target.value)}
            placeholder="Add specific instructions, target values, or rejection notes..."
            className="w-full h-20 px-4 py-3 text-xs bg-slate-900 border border-white/10 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-white outline-none placeholder-slate-600 resize-none transition-all"
          />
        </div>

        {/* Visual Button Action Grid */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={() => onResolve(approval.id, "rejected", ownerNotes)}
            variant="soft"
            className="py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
          >
            ❌ Reject
          </Button>
          <Button
            onClick={() =>
              onResolve(approval.id, "changes_requested", ownerNotes)
            }
            variant="soft"
            className="py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/10 hover:text-yellow-300"
          >
            📝 Changes
          </Button>
          <Button
            onClick={() => onResolve(approval.id, "approved", ownerNotes)}
            className="py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-900/20"
          >
            ✅ Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
