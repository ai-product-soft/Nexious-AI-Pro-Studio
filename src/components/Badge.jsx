import React from 'react';
import { C } from './consts';

const TONES = {
  gold: { color: C.softGold, bg: `${C.gold}1F`, border: `${C.gold}55` },
  success: { color: C.success, bg: `${C.success}18`, border: `${C.success}4D` },
  danger: { color: '#FFA0A0', bg: `${C.danger}1F`, border: `${C.danger}55` },
  cyan: { color: C.cyanBright, bg: `${C.cyanBright}18`, border: `${C.cyanBright}44` },
  violet: { color: C.violetBright, bg: `${C.violetBright}18`, border: `${C.violetBright}44` },
  muted: { color: C.mutedLow, bg: 'rgba(255,255,255,.045)', border: 'rgba(255,255,255,.10)' }
};

export default function Badge({ children, tone = 'gold' }) {
  const t = TONES[tone] || TONES.gold;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-5 py-1.5 text-xs font-bold"
      style={{ color: t.color, backgroundColor: t.bg, border: `1px solid ${t.border}` }}>
      {children}
    </span>
  );
}
