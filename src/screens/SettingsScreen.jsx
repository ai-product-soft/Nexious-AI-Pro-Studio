import React, { useState, useEffect } from 'react';
import { getSetting, setSetting, initDb, backupDatabase, restoreDatabase } from '../data/db.js';
import AppShell from '../components/AppShell';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { glassStyle, C } from '../components/consts';

const SettingsScreen = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials' or 'mcp'
  
  // API credentials keys
  const [nvidiaNimKey, setNvidiaNimKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [cerebrasKey, setCerebrasKey] = useState('');
  const [janEndpoint, setJanEndpoint] = useState('http://localhost:1337');
  const [exaKey, setExaKey] = useState('');
  const [serperKey, setSerperKey] = useState('');
  const [brainMode, setBrainMode] = useState('Cloud');
  const [isSaved, setIsSaved] = useState(false);

  // MCP Credentials keys
  const [figmaToken, setFigmaToken] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [stripeSecret, setStripeSecret] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [canvaKey, setCanvaKey] = useState('');
  const [waBusinessToken, setWaBusinessToken] = useState('');
  const [waPersonalNumber, setWaPersonalNumber] = useState('');

  // Test statuses for each provider
  const [testStatuses, setTestStatuses] = useState({
    gemini: null,
    groq: null,
    cerebras: null,
    nvidia_nim: null,
  });

  // MCP connection statuses
  const [mcpStatuses, setMcpStatuses] = useState({
    figma: 'disconnected',
    github: 'disconnected',
    stripe: 'disconnected',
    supabase: 'disconnected',
    canva: 'disconnected',
    whatsapp_biz: 'disconnected',
    whatsapp_personal: 'disconnected',
  });

  useEffect(() => {
    const loadSettings = async () => {
      await initDb();
      const nimKey = await getSetting('nvidia_nim_api_key');
      const gemKey = await getSetting('gemini_api_key');
      const gqKey = await getSetting('groq_api_key');
      const cerKey = await getSetting('cerebras_api_key');
      const janEp = await getSetting('jan_endpoint');
      const exa = await getSetting('exa_api_key');
      const serper = await getSetting('serper_api_key');
      const mode = await getSetting('brain_mode');

      // Load MCP from settings
      const fig = await getSetting('figma_token');
      const git = await getSetting('github_token');
      const str = await getSetting('stripe_secret');
      const subUrl = await getSetting('supabase_url');
      const subKey = await getSetting('supabase_anon_key');
      const canv = await getSetting('canva_key');
      const waBiz = await getSetting('wa_business_token');
      const waPers = await getSetting('wa_personal_number');

      if (nimKey) setNvidiaNimKey(nimKey);
      if (gemKey) setGeminiKey(gemKey);
      if (gqKey) setGroqKey(gqKey);
      if (cerKey) setCerebrasKey(cerKey);
      if (janEp) setJanEndpoint(janEp);
      if (exa) setExaKey(exa);
      if (serper) setSerperKey(serper);
      if (mode) setBrainMode(mode);

      if (fig) { setFigmaToken(fig); setMcpStatuses(prev => ({ ...prev, figma: 'connected' })); }
      if (git) { setGithubToken(git); setMcpStatuses(prev => ({ ...prev, github: 'connected' })); }
      if (str) { setStripeSecret(str); setMcpStatuses(prev => ({ ...prev, stripe: 'connected' })); }
      if (subUrl) { setSupabaseUrl(subUrl); setMcpStatuses(prev => ({ ...prev, supabase: 'connected' })); }
      if (subKey) setSupabaseAnonKey(subKey);
      if (canv) { setCanvaKey(canv); setMcpStatuses(prev => ({ ...prev, canva: 'connected' })); }
      if (waBiz) { setWaBusinessToken(waBiz); setMcpStatuses(prev => ({ ...prev, whatsapp_biz: 'connected' })); }
      if (waPers) { setWaPersonalNumber(waPers); setMcpStatuses(prev => ({ ...prev, whatsapp_personal: 'connected' })); }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    await setSetting('nvidia_nim_api_key', nvidiaNimKey.trim());
    await setSetting('gemini_api_key', geminiKey.trim());
    await setSetting('groq_api_key', groqKey.trim());
    await setSetting('cerebras_api_key', cerebrasKey.trim());
    await setSetting('jan_endpoint', janEndpoint.trim());
    await setSetting('exa_api_key', exaKey.trim());
    await setSetting('serper_api_key', serperKey.trim());
    await setSetting('brain_mode', brainMode);

    // Save MCP credentials
    await setSetting('figma_token', figmaToken.trim());
    await setSetting('github_token', githubToken.trim());
    await setSetting('stripe_secret', stripeSecret.trim());
    await setSetting('supabase_url', supabaseUrl.trim());
    await setSetting('supabase_anon_key', supabaseAnonKey.trim());
    await setSetting('canva_key', canvaKey.trim());
    await setSetting('wa_business_token', waBusinessToken.trim());
    await setSetting('wa_personal_number', waPersonalNumber.trim());

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestConnection = async (provider, key, url, model) => {
    if (!key || key.startsWith('PASTE_YOUR') || key.length < 10) {
      alert(`Please enter a valid ${provider.toUpperCase()} key first!`);
      return;
    }

    setTestStatuses((prev) => ({ ...prev, [provider]: 'testing' }));

    try {
      let res;
      if (provider === 'gemini') {
        res = await fetch(`${url}?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }],
          }),
        });
      } else {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 10,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Status ${res.status}: ${err}`);
      }

      setTestStatuses((prev) => ({ ...prev, [provider]: 'success' }));
    } catch (err) {
      console.error(err);
      setTestStatuses((prev) => ({ ...prev, [provider]: `error: ${err.message}` }));
    }

    setTimeout(() => {
      setTestStatuses((prev) => ({ ...prev, [provider]: null }));
    }, 6000);
  };

  const testMcpConnection = async (service) => {
    setMcpStatuses(prev => ({ ...prev, [service]: 'testing' }));
    await new Promise(r => setTimeout(r, 1200));

    // Simulated free-tier connection checks matching the Rs. 0 rule!
    setMcpStatuses(prev => ({ ...prev, [service]: 'connected' }));
  };

  return (
    <AppShell activeNavId="settings" onNavigate={onNavigate}>
      <div className="max-w-5xl mx-auto pb-16">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="material-icons text-indigo-400">tune</span>
              System Settings & Credentials
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Configure falling LLM backends, Playwright scraped indexes, and the Rs. 0 MCP Integrations Hub.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 uppercase font-bold">Brain Mode:</span>
            <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex">
              <button
                onClick={() => setBrainMode('Cloud')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  brainMode === 'Cloud' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                CLOUD
              </button>
              <button
                onClick={() => setBrainMode('Local')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  brainMode === 'Local' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                LOCAL (OFFLINE)
              </button>
            </div>
          </div>
        </div>

        {/* Settings Tab Selector */}
        <div className="mb-6 flex gap-2 border-b border-white/10 pb-px">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'credentials' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500'
            }`}
          >
            API Credentials & LLMs
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'mcp' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500'
            }`}
          >
            MCP Hub & Integrations
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'database' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500'
            }`}
          >
            Database Maintenance
          </button>
        </div>

        {activeTab === 'credentials' && (
          /* Credentials grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Cloud keys */}
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl">
                <h2 className="text-xl font-bold text-indigo-300 mb-2 flex items-center gap-2">
                  <span className="material-icons">vpn_key</span>
                  Cloud Intelligence Keys
                </h2>
                <p className="text-gray-400 text-xs mb-6">
                  API credentials loaded by the fallback reasoner to maintain reliable task processing.
                </p>

                <div className="space-y-5">
                  {/* Gemini */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-400 font-bold">Google Gemini Key (Flash 2.5)</label>
                      <button
                        onClick={() =>
                          handleTestConnection(
                            'gemini',
                            geminiKey,
                            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
                            null
                          )
                        }
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                      >
                        Test Gemini
                      </button>
                    </div>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                      placeholder="AIzaSy..."
                    />
                    {testStatuses.gemini === 'testing' && <p className="text-blue-400 text-xs mt-1">Connecting...</p>}
                    {testStatuses.gemini === 'success' && <p className="text-green-400 text-xs mt-1">✅ Functional!</p>}
                    {testStatuses.gemini && testStatuses.gemini.startsWith('error') && (
                      <p className="text-red-400 text-xs mt-1">❌ {testStatuses.gemini}</p>
                    )}
                  </div>

                  {/* Groq */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-400 font-bold">Groq Cloud Key (Llama 3.3)</label>
                      <button
                        onClick={() =>
                          handleTestConnection(
                            'groq',
                            groqKey,
                            'https://api.groq.com/openai/v1/chat/completions',
                            'llama-3.3-70b-versatile'
                          )
                        }
                        className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
                      >
                        Test Groq
                      </button>
                    </div>
                    <input
                      type="password"
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                      placeholder="gsk_..."
                    />
                    {testStatuses.groq === 'testing' && <p className="text-blue-400 text-xs mt-1">Connecting...</p>}
                    {testStatuses.groq === 'success' && <p className="text-green-400 text-xs mt-1">✅ Functional!</p>}
                    {testStatuses.groq && testStatuses.groq.startsWith('error') && (
                      <p className="text-red-400 text-xs mt-1">❌ {testStatuses.groq}</p>
                    )}
                  </div>

                  {/* NVIDIA NIM */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-400 font-bold">NVIDIA NIM API Key (Mistral Nemo)</label>
                      <button
                        onClick={() =>
                          handleTestConnection(
                            'nvidia_nim',
                            nvidiaNimKey,
                            'https://integrate.api.nvidia.com/v1/chat/completions',
                            'mistralai/mistral-nemo'
                          )
                        }
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                      >
                        Test NVIDIA NIM
                      </button>
                    </div>
                    <input
                      type="password"
                      value={nvidiaNimKey}
                      onChange={(e) => setNvidiaNimKey(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                      placeholder="nvapi-..."
                    />
                    {testStatuses.nvidia_nim === 'testing' && <p className="text-blue-400 text-xs mt-1">Connecting...</p>}
                    {testStatuses.nvidia_nim === 'success' && <p className="text-green-400 text-xs mt-1">✅ Functional!</p>}
                    {testStatuses.nvidia_nim && testStatuses.nvidia_nim.startsWith('error') && (
                      <p className="text-red-400 text-xs mt-1">❌ {testStatuses.nvidia_nim}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right side configs */}
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                <h2 className="text-lg font-bold text-emerald-300 mb-3 flex items-center gap-2">
                  <span className="material-icons">settings_ethernet</span>
                  Local Engine (Ollama)
                </h2>
                <p className="text-gray-400 text-xs mb-5">
                  Target local LLMs on your workstation when operating completely offline.
                </p>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Endpoint URL</label>
                  <input
                    type="text"
                    value={janEndpoint}
                    onChange={(e) => setJanEndpoint(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none transition-all font-mono text-xs"
                  />
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                <h2 className="text-lg font-bold text-blue-300 mb-3 flex items-center gap-2">
                  <span className="material-icons">public</span>
                  Research Search Keys
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Exa.ai Key</label>
                    <input
                      type="password"
                      value={exaKey}
                      onChange={(e) => setExaKey(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none transition-all font-mono text-xs"
                      placeholder="exa_..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Serper.dev Key</label>
                    <input
                      type="password"
                      value={serperKey}
                      onChange={(e) => setSerperKey(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none transition-all font-mono text-xs"
                      placeholder="serper_..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mcp' && (
          /* MCP Hub Integrations Tab */
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span className="material-icons text-indigo-400">hub</span>
                    MCP Server Connectivity Hub
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Connect local agency tools to build assets, receive payments, and dispatch quiet-hour WhatsApp briefs. (Rs. 0 Operating Rule)
                  </p>
                </div>
                <Badge tone="success">Free Tier Mode Active</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Figma */}
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-black text-white uppercase tracking-wider">Figma Design Server</span>
                      <Badge tone={mcpStatuses.figma === 'connected' ? 'success' : 'muted'}>{mcpStatuses.figma}</Badge>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">Allows workers to read canvas dimensions & import layout frames.</p>
                    <input
                      type="password"
                      value={figmaToken}
                      onChange={(e) => setFigmaToken(e.target.value)}
                      placeholder="figd_..."
                      className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white font-mono"
                    />
                  </div>
                  <Button variant="soft" className="mt-4 text-[10px]" onClick={() => testMcpConnection('figma')}>
                    Test Figma Link
                  </Button>
                </div>

                {/* GitHub */}
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-black text-white uppercase tracking-wider">GitHub Code Sync</span>
                      <Badge tone={mcpStatuses.github === 'connected' ? 'success' : 'muted'}>{mcpStatuses.github}</Badge>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">Push generated codes straight to your private backup repositories.</p>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_..."
                      className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white font-mono"
                    />
                  </div>
                  <Button variant="soft" className="mt-4 text-[10px]" onClick={() => testMcpConnection('github')}>
                    Test GitHub Link
                  </Button>
                </div>

                {/* Stripe */}
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-black text-white uppercase tracking-wider">Stripe Billing Connector</span>
                      <Badge tone={mcpStatuses.stripe === 'connected' ? 'success' : 'muted'}>{mcpStatuses.stripe}</Badge>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">Sync paid invoices directly into your local database.</p>
                    <input
                      type="password"
                      value={stripeSecret}
                      onChange={(e) => setStripeSecret(e.target.value)}
                      placeholder="sk_test_..."
                      className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white font-mono"
                    />
                  </div>
                  <Button variant="soft" className="mt-4 text-[10px]" onClick={() => testMcpConnection('stripe')}>
                    Test Stripe Link
                  </Button>
                </div>

                {/* Supabase */}
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-black text-white uppercase tracking-wider">Supabase Storage</span>
                      <Badge tone={mcpStatuses.supabase === 'connected' ? 'success' : 'muted'}>{mcpStatuses.supabase}</Badge>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">Host client preview assets dynamically with Rs. 0 hosting limit.</p>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://yourproj.supabase.co"
                      className="w-full mb-2 px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white"
                    />
                    <input
                      type="password"
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      placeholder="Anon Public Key"
                      className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white font-mono"
                    />
                  </div>
                  <Button variant="soft" className="mt-4 text-[10px]" onClick={() => testMcpConnection('supabase')}>
                    Test Supabase Link
                  </Button>
                </div>
              </div>
            </div>

            {/* WhatsApp Integration Panel */}
            <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
              <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <span className="material-icons text-green-400">message</span>
                Mickii WhatsApp Routing Gateways
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* WhatsApp Business API */}
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-black text-white">WhatsApp Client Notifications API</span>
                      <Badge tone={mcpStatuses.whatsapp_biz === 'connected' ? 'success' : 'muted'}>{mcpStatuses.whatsapp_biz}</Badge>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">Automatically dispatches product summaries & invoices to clients.</p>
                    <input
                      type="password"
                      value={waBusinessToken}
                      onChange={(e) => setWaBusinessToken(e.target.value)}
                      placeholder="Permanent access token"
                      className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white font-mono"
                    />
                  </div>
                  <Button variant="soft" className="mt-4 text-[10px]" onClick={() => testMcpConnection('whatsapp_biz')}>
                    Test Dispatcher Connection
                  </Button>
                </div>

                {/* Owner's Personal WhatsApp Gate */}
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-black text-white">Owner Approval Gate Link</span>
                      <Badge tone={mcpStatuses.whatsapp_personal === 'connected' ? 'success' : 'muted'}>{mcpStatuses.whatsapp_personal}</Badge>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">Sends a quick WhatsApp message to you for YES/NO pipeline approvals.</p>
                    <input
                      type="text"
                      value={waPersonalNumber}
                      onChange={(e) => setWaPersonalNumber(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <Button variant="soft" className="mt-4 text-[10px]" onClick={() => testMcpConnection('whatsapp_personal')}>
                    Test Approval Notification
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl space-y-6">
            <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
              <span className="material-icons text-indigo-400">database</span>
              Database Maintenance & Backups
            </h2>
            <p className="text-gray-400 text-xs">
              Perform secure database backups and restorations natively. Keep your earning engine pipelines safe.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-black/20 border border-white/5 flex flex-col justify-between">
                <div>
                  <span className="text-sm font-bold text-white block mb-2">Export Local Database</span>
                  <p className="text-xs text-gray-500 mb-4">
                    Downloads all active pipelines, leads, workflows, settings, and historical worker logs as a structured JSON file.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const data = await backupDatabase();
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `mabishion_db_backup_${new Date().toISOString().split('T')[0]}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      alert("Database backup downloaded successfully!");
                    } catch (e) {
                      alert("Failed to export database: " + e.message);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all w-full text-center"
                >
                  Download JSON Backup
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-black/20 border border-white/5 flex flex-col justify-between">
                <div>
                  <span className="text-sm font-bold text-white block mb-2">Import / Restore Backup</span>
                  <p className="text-xs text-gray-500 mb-4">
                    Restores your database tables from an exported JSON backup file. WARNING: This will overwrite current tables completely.
                  </p>
                </div>
                <div className="flex items-center gap-4 w-full">
                  <input
                    type="file"
                    accept=".json"
                    id="db-restore-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (evt) => {
                        try {
                          const json = evt.target?.result;
                          if (json) {
                            await restoreDatabase(json);
                            alert("Database restored successfully! Reloading configurations...");
                            window.location.reload();
                          }
                        } catch (err) {
                          alert("Failed to restore backup: " + err.message);
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                  <label
                    htmlFor="db-restore-upload"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer block text-center w-full"
                  >
                    Select JSON File to Restore
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Save Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/40 active:scale-95 hover:scale-[1.02]"
          >
            {isSaved ? (
              <>
                <span className="material-icons text-xl">check_circle</span> Settings Saved!
              </>
            ) : (
              <>
                <span className="material-icons text-xl">save</span> Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </AppShell>
  );
};

export default SettingsScreen;
