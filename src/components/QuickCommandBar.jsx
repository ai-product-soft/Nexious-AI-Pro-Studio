import React, { useState } from 'react';
import { C, glassStyle } from './consts';
import MickiiOrb from './MickiiOrb';
import Badge from './Badge';
import Button from './Button';
import Icon from './Icon';
import { useMickiiAgent } from '../hooks/useMickiiAgent.js';
import { useMickiiEar } from '../hooks/useMickiiEar.js';

import SearchResult from './search/SearchResult';

export default function QuickCommandBar({ contextLabel, placeholder }) {
  const { messages, send, status, isProcessing } = useMickiiAgent({
    model: 'llama3.1:8b',
    baseURL: 'http://localhost:11434/v1'
  });

  const [input, setInput] = useState('');
  const lastMessage = messages[messages.length - 1];

  const { isListening, startListening, stopListening } = useMickiiEar((transcript) => {
    setInput(transcript);
  });

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const msg = input.trim();
    setInput('');
    await send(msg);
  };

  return (
    <div className="fixed bottom-5 right-6 z-40" style={{ left: `${C.sidebarW + 24}px` }}>
      {/* Reply Bubble / System Logs */}
      {lastMessage && (
        <div className="absolute bottom-full mb-3 ml-4 max-w-xl rounded-[22px] p-4 text-sm leading-6 transition-all animate-in slide-in-from-bottom-2 overflow-y-auto max-h-[480px] scrollbar-hide" 
          style={{ ...glassStyle({ glow: 'violet' }), backgroundColor: 'rgba(2,4,10,0.93)', color: C.text, border: `1px solid ${C.violetBright}40` }}>
          <p className="font-black text-[10px] uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: C.violetBright }}>
            {lastMessage.isSystem ? <span className="material-icons text-[12px]">settings</span> : <span className="material-icons text-[12px]">smart_toy</span>}
            {lastMessage.role === 'user' ? 'Mickii Input' : 'Mickii Output'}
          </p>
          <p className={lastMessage.isSystem ? 'text-blue-300 italic' : ''}>{lastMessage.content}</p>
          {lastMessage.searchTelemetry && (
            <div className="mt-3">
              <SearchResult 
                query={lastMessage.searchTelemetry.query}
                status={lastMessage.searchTelemetry.status}
                responseTime={lastMessage.searchTelemetry.responseTime}
                sourceUrl={lastMessage.searchTelemetry.sourceUrl}
                results={lastMessage.searchTelemetry.results}
                warning={lastMessage.searchTelemetry.warning}
                timestamp={lastMessage.searchTelemetry.timestamp}
                onVerify={async () => {
                  const { SearchService } = await import('../services/searchService.js');
                  const fresh = await SearchService.performSearch(lastMessage.searchTelemetry.query, true);
                  // Update searchTelemetry inside the active message object
                  lastMessage.searchTelemetry = fresh;
                  // Force a UI state change to render fresh metrics
                  setInput(prev => prev + ' ');
                  setTimeout(() => setInput(prev => prev.trim()), 30);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Bar */}
      <div className="flex h-[64px] items-center gap-4 px-4 rounded-[22px]"
        style={glassStyle({ strong: true, glow: 'violet' })}>
        <MickiiOrb isThinking={isProcessing} />
        <Badge tone="violet">{status.toUpperCase()}</Badge>
        <input 
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          style={{ color: C.text }}
          placeholder={isProcessing ? "Mickii is thinking..." : placeholder || "Ask Mickii anything..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isProcessing}
        />
        <Button 
          variant={isListening ? 'danger' : 'soft'} 
          className="px-3"
          onClick={isListening ? stopListening : startListening}
        >
          <Icon name={isListening ? 'stop' : 'mic'} size={17} className={isListening ? 'animate-pulse' : ''} />
        </Button>
        <Button onClick={handleSend} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-500 text-white border-0"><Icon name="send" size={17} /> Send</Button>
      </div>
    </div>
  );
}
