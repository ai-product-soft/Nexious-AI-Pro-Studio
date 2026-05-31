import React from 'react';
import { C } from './consts';
import mickiiAvatar from '../assets/mickii-avatar.png';

export default function MickiiOrb({ size = 'md', isThinking = false }) {
  const px = size === 'lg' ? 56 : 34;
  return (
    <div className="relative shrink-0 rounded-full" style={{ width: px, height: px }}>
      <style>{`
        @keyframes mOrb { 0%,100%{transform:scale(1);opacity:.52} 50%{transform:scale(1.32);opacity:.92} }
        @keyframes mGlow { 0%,100%{box-shadow:0 0 22px ${isThinking ? C.violetBright : C.violetBright}80} 50%{box-shadow:0 0 42px ${isThinking ? C.violetBright : C.gold}66} }
        @keyframes mThink { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>
      <div className="absolute inset-0 rounded-full blur-md" 
        style={{ 
          backgroundColor: isThinking ? `${C.violetBright}44` : `${C.gold}33`, 
          animation: `mOrb ${isThinking ? '0.8s' : '2.7s'} ease-in-out infinite` 
        }} />
      <div className="absolute inset-0 rounded-full overflow-hidden" 
        style={{ 
          background: isThinking 
            ? `conic-gradient(from 0deg, ${C.violetBright}, ${C.violet}, ${C.violetBright})`
            : `radial-gradient(circle at 33% 23%, ${C.softGold} 0%, ${C.gold} 30%, ${C.violet} 72%, ${C.bg} 100%)`, 
          animation: `${isThinking ? 'mThink 1s linear infinite,' : ''} mGlow ${isThinking ? '0.5s' : '3.4s'} ease-in-out infinite`,
          border: `1.5px solid ${C.gold}80`
        }}>
        <img src={mickiiAvatar} alt="Mickii" className="h-full w-full object-cover opacity-90" />
      </div>

      <div className="absolute rounded-full blur-[1px]" 
        style={{ inset: '22%', backgroundColor: 'rgba(255,255,255,.10)' }} />
    </div>
  );
}
