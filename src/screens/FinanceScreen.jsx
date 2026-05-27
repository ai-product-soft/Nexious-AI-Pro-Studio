import React, { useState } from 'react';
import { C, glassStyle } from '../components/consts';
import AppShell from '../components/AppShell';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import MickiiOrb from '../components/MickiiOrb';
import ProgressBar from '../components/ProgressBar';
import QuickCommandBar from '../components/QuickCommandBar';
import { FINANCE_METRICS, INCOME_ROWS } from '../data/mockData.jsx';

export default function FinanceScreen({ onNavigate }) {
  return (
    <AppShell activeNavId="finance" onNavigate={onNavigate}
      commandBar={<QuickCommandBar contextLabel="Finance Context" placeholder="Ask Mickii: draft invoice, check dead-weight expenses, estimate runway..." />}>
      <ScreenHeader title="Finance" index="10"
        subtitle="Money control room for income, expenses, invoices, payment status, runway, approximate tax, multi-currency tracking, and reinvestment suggestions."
        badgeLabel="Income · expenses · invoices · runway"
        primaryAction="Create Invoice Draft" primaryIcon="file"
        secondaryAction="Tax Estimate" secondaryIcon="calculator"
        extraBadges={<><Badge tone="gold">Money Control</Badge><Badge tone="success">Draft Safe</Badge><Badge tone="violet">Payment Needs YES</Badge></>}
      />
      <section className="grid grid-cols-12 gap-5">
        {/* Metrics */}
        {FINANCE_METRICS.map((m) => {
          const toneColor = m.tone === "success" ? C.success : m.tone === "danger" ? "#FFA0A0" : m.tone === "cyan" ? C.cyanBright : C.softGold;
          return (
            <div key={m.label} className="col-span-3 p-5" style={glassStyle({ glow: m.tone === "gold" ? "gold" : "none" })}>
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-2xl p-3" style={{ color: C.gold, background: "rgba(255,255,255,.055)", border: `1px solid ${C.glassBorder}` }}><Icon name={m.icon} size={20} /></div>
                <Badge tone={m.tone}>{m.delta}</Badge>
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: C.mutedLow }}>{m.label}</p>
              <p className="mt-2 text-2xl font-black tracking-tight" style={{ color: toneColor }}>{m.value}</p>
            </div>
          );
        })}

        {/* Live Invoice Preview */}
        <div className="col-span-8 p-5" style={glassStyle({ glow: "gold", borderColor: `${C.gold}55` })}>
          <div className="mb-5 flex items-center justify-between">
            <div><h3 className="font-black">Invoice Draft Preview</h3><p className="mt-1 text-xs" style={{ color: C.mutedLow }}>Draft only — sending requires manual YES</p></div>
            <div className="flex gap-2"><Button variant="soft" className="px-3 py-2 text-xs">Preview PDF</Button><Button variant="danger" className="px-3 py-2 text-xs">Send Disabled</Button></div>
          </div>
          <div className="rounded-[22px] p-5" style={{ background: `${C.navy2}73`, border: `1px solid ${C.glassBorder}` }}>
            <div className="mb-5 flex items-start justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: C.mutedLow }}>Invoice draft</p><h3 className="mt-2 text-2xl font-black">Mabishion AI Website Build</h3><p className="mt-1 text-sm" style={{ color: C.mutedLow }}>Client: James Carter</p></div>
              <Badge tone="gold">Draft</Badge>
            </div>
            {[["Strategy + page structure", "₹12,000"], ["Premium landing page UI", "₹18,000"], ["React export package", "₹10,000"], ["Delivery documentation", "₹5,000"]].map(([label, amount]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl p-3 mb-2" style={{ background: "rgba(255,255,255,.045)", border: `1px solid ${C.glassBorder}` }}>
                <p className="text-sm font-semibold" style={{ color: C.muted }}>{label}</p>
                <p className="text-sm font-black" style={{ color: C.softGold }}>{amount}</p>
              </div>
            ))}
            <div className="mt-4 flex items-center justify-between rounded-2xl p-4" style={{ background: `${C.gold}18`, border: `1px solid ${C.gold}40` }}>
              <p className="text-sm font-black">Total Due</p>
              <p className="text-2xl font-black" style={{ color: C.softGold }}>₹45,000</p>
            </div>
          </div>
        </div>

        {/* Payment Alerts */}
        <div className="col-span-4 p-5" style={glassStyle()}>
          <div className="mb-4"><h3 className="font-black">Invoice / Payment Alerts</h3><p className="mt-1 text-xs" style={{ color: C.mutedLow }}>External actions stay approval-gated.</p></div>
          <div className="space-y-3">
            {[{ title: "Invoice draft ready", sub: "₹45,000 · PDF preview prepared · manual YES needed before send", tone: "gold" }, { title: "Payment reminder blocked", sub: "₹35,000 pending · reminder draft only · sending disabled", tone: "danger" }, { title: "Paid income logged", sub: "₹20,995 digital product income recorded in tracker", tone: "success" }].map((alert) => (
              <div key={alert.title} className="rounded-[18px] p-4" style={{ background: "rgba(255,255,255,.045)", border: `1px solid ${C.glassBorder}` }}>
                <div className="mb-2 flex items-center justify-between"><p className="text-sm font-black">{alert.title}</p><Badge tone={alert.tone}>{alert.tone}</Badge></div>
                <p className="text-xs leading-5" style={{ color: C.mutedLow }}>{alert.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Income Tracker */}
        <div className="col-span-12 xl:col-span-6 p-5" style={glassStyle()}>
          <div className="mb-4"><h3 className="font-black">Income Tracker</h3><p className="mt-1 text-xs" style={{ color: C.mutedLow }}>Confirmed income, invoice drafts, and awaiting payments.</p></div>
          <div className="space-y-3">
            {INCOME_ROWS.map((row, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-3 rounded-[18px] p-4" style={{ background: "rgba(255,255,255,.045)", border: `1px solid ${C.glassBorder}` }}>
                <div className="col-span-5 min-w-0"><p className="truncate text-sm font-bold">{row.source}</p><p className="mt-1 truncate text-xs" style={{ color: C.mutedLow }}>{row.client}</p></div>
                <p className="col-span-2 text-sm font-black" style={{ color: C.softGold }}>{row.amount}</p>
                <p className="col-span-2 text-xs" style={{ color: C.mutedLow }}>{row.due}</p>
                <div className="col-span-3 flex justify-end"><Badge tone={row.status === "Paid" ? "success" : row.status === "Awaiting" ? "danger" : "gold"}>{row.status}</Badge></div>
              </div>
            ))}
          </div>
        </div>

        {/* Runway */}
        <div className="col-span-6 p-5" style={glassStyle({ glow: "cyan" })}>
          <div className="mb-4 flex items-center justify-between"><h3 className="font-black">Runway Calculator</h3><Badge tone="cyan">41 days</Badge></div>
          <div className="space-y-3">
            {[["Essential monthly burn", "₹24.8K"], ["Dead-weight tools", "₹2.1K"], ["Suggested reserve", "₹55K"], ["Reinvest cap", "₹12K"]].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-[18px] p-4" style={{ background: "rgba(255,255,255,.045)", border: `1px solid ${C.glassBorder}` }}>
                <p className="text-sm font-semibold" style={{ color: C.muted }}>{label}</p>
                <p className="text-sm font-black" style={{ color: C.cyanBright }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

// =============================================================================
