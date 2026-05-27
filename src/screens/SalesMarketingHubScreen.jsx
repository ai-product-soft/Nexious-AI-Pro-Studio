import React, { useState, useEffect } from 'react';
import { C, glassStyle } from '../components/consts';
import AppShell from '../components/AppShell';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import MickiiOrb from '../components/MickiiOrb';
import CampaignTracker from '../components/marketing/CampaignTracker';
import { getLeads } from '../data/db.js';
import { useBuild } from '../context/BuildContext';

export default function SalesMarketingHubScreen({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [leads, setLeads] = useState([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const { currentBuild, isProcessing } = useBuild();

  // Social / Promo scheduling simulation
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPromoDone, setIsPromoDone] = useState(false);

  // Sales checkout link simulation
  const [isGeneratingStripe, setIsGeneratingStripe] = useState(false);
  const [isStripeDone, setIsStripeDone] = useState(false);

  const fetchLeads = async () => {
    setIsLoadingLeads(true);
    try {
      const data = await getLeads();
      setLeads(data || []);
    } catch (e) {
      console.error('[SalesMarketingHub] Error loading leads:', e);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handlePublishPromos = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setIsPromoDone(true);
    }, 2000);
  };

  const handleGenerateStripe = () => {
    setIsGeneratingStripe(true);
    setTimeout(() => {
      setIsGeneratingStripe(false);
      setIsStripeDone(true);
    }, 1800);
  };

  const defaultPromotionAssets = [
    {
      platform: 'Google Ads Search',
      copy: "Headline 1: Autonomize Your Agency Operations\nHeadline 2: Mabishion AI Digital Factory\nDescription: Run customized AI workflows for $99/mo. Mickii schedules, coordinates, and executes lead gen and products autonomously.",
      status: 'Ready',
      tone: 'emerald',
      icon: 'ads_click'
    },
    {
      platform: 'LinkedIn Campaign',
      copy: "We replaced traditional lead generators with a private worker node.\n\nResult? 10x lower customer acquisition cost and fully autonomous proposal drafting. 🚀\n\nCheckout our digital studio here:",
      status: 'Ready',
      tone: 'blue',
      icon: 'work'
    },
    {
      platform: 'Targeted Email Blast',
      copy: "Subject: Your dedicated digital builder is waiting.\n\nHello, you are spending hours drafting agreements. Meet Mickii, your direct AI agency operator. Click to configure now.",
      status: 'Ready',
      tone: 'violet',
      icon: 'mail'
    }
  ];

  const assets = currentBuild?.promotionAssets || defaultPromotionAssets;
  const productName = currentBuild?.brief || 'Premium Custom Software Package';

  return (
    <AppShell activeNavId="sales-marketing" onNavigate={onNavigate}>
      <div className="space-y-6 max-w-7xl mx-auto p-4 select-none pb-24">
        
        {/* Header Section */}
        <ScreenHeader 
          title="Sales & Marketing Hub" 
          subtitle="Acquisition Campaigns, Outbound Promotion Assets, and Stripe Checkouts System"
          index="04"
          badgeLabel="Growth & Conversion Engine"
          primaryAction="Refresh Data"
          primaryIcon="refresh"
          onActionClick={fetchLeads}
        />

        {/* Dynamic Glassmorphic Sub-Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl bg-black/40 border border-white/5 max-w-lg">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'campaigns' 
                ? 'bg-gradient-to-r from-violet-600/50 to-indigo-600/50 text-white border border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon name="campaign" size={16} />
            Campaigns & CRM
          </button>
          
          <button
            onClick={() => setActiveTab('promo')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'promo' 
                ? 'bg-gradient-to-r from-violet-600/50 to-indigo-600/50 text-white border border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon name="ads_click" size={16} />
            Promos Copy
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'sales' 
                ? 'bg-gradient-to-r from-violet-600/50 to-indigo-600/50 text-white border border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon name="point_of_sale" size={16} />
            Sales Checkouts
          </button>
        </div>

        {/* Tab 1: Acquisition & Campaigns */}
        {activeTab === 'campaigns' && (
          <div className="animate-in fade-in duration-300">
            {isLoadingLeads ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-bold">Aggregating Cross-Channel Campaign Analytics...</span>
              </div>
            ) : (
              <CampaignTracker leads={leads} />
            )}
          </div>
        )}

        {/* Tab 2: Promotion Console */}
        {activeTab === 'promo' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {isPromoDone ? (
              <div className="p-8 rounded-3xl text-center flex flex-col items-center max-w-2xl mx-auto" style={glassStyle({ glow: 'success' })}>
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-emerald-500/30 mb-6">
                  <Icon name="check" size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight mb-2">Promotions Scheduled Successfully!</h3>
                <p className="text-sm text-gray-400 mb-6">Mickii has launched search ads copy and scheduled targeted social campaigns.</p>
                <Button onClick={() => setIsPromoDone(false)} variant="soft">Schedule More Assets</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <MickiiOrb isThinking={isProcessing} />
                    <div>
                      <p className="text-sm font-bold text-white">Social Promotion Assets Status</p>
                      <p className="text-xs text-gray-400">Copywriting templates generated by the Outbound Scheduler Worker.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handlePublishPromos} 
                    disabled={isPublishing}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    {isPublishing ? 'Publishing Ads...' : 'Approve & Publish Promos'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {assets.map((asset, i) => (
                    <div key={i} className="p-6 rounded-3xl" style={glassStyle({ glow: asset.tone })}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Icon name={asset.icon || 'ads_click'} size={18} className="text-indigo-400" />
                          <h4 className="text-sm font-black text-white uppercase">{asset.platform}</h4>
                        </div>
                        <Badge tone="success">{asset.status}</Badge>
                      </div>
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 min-h-[140px]">
                        <pre className="text-xs text-gray-300 font-sans whitespace-pre-wrap leading-relaxed">
                          {asset.copy}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Sales Checkouts */}
        {activeTab === 'sales' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="p-8 rounded-3xl" style={glassStyle({ glow: 'success' })}>
              <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                <Icon name="receipt_long" size={20} className="text-emerald-400" />
                Active Invoice Specification
              </h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Target Offer</span>
                  <span className="text-white font-bold text-sm">{productName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Recurring Setup</span>
                  <Badge tone="success">Monthly Contract</Badge>
                </div>
                <div className="py-2">
                  <span className="text-gray-400 text-sm block mb-2">Automated Execution Details</span>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2 text-gray-300 text-xs">
                      <Icon name="check" size={12} className="text-emerald-400" /> Private multi-LLM worker nodes
                    </li>
                    <li className="flex items-center gap-2 text-gray-300 text-xs">
                      <Icon name="check" size={12} className="text-emerald-400" /> WhatsApp live secure verification alerts
                    </li>
                    <li className="flex items-center gap-2 text-gray-300 text-xs">
                      <Icon name="check" size={12} className="text-emerald-400" /> Continuous SQLite ledger synchronization
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-black/40 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                <span className="text-sm text-gray-300 font-bold">Estimated Cost</span>
                <span className="text-3xl font-black text-emerald-400">$99.00</span>
              </div>
            </div>

            <div className="p-8 rounded-3xl flex flex-col items-center justify-center text-center" style={glassStyle({ glow: 'violet' })}>
              {isStripeDone ? (
                <div className="animate-in zoom-in duration-500 space-y-4">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                    <Icon name="link" size={24} />
                  </div>
                  <h4 className="text-lg font-black text-white">Stripe Session Live!</h4>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">This checkout has been automatically attached to outbound campaigns.</p>
                  <div className="bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 text-xs text-emerald-400 select-all font-mono">
                    https://buy.stripe.com/test_mabishion_studio_99
                  </div>
                  <Button onClick={() => setIsStripeDone(false)} variant="soft" className="text-xs">Generate New Checkout</Button>
                </div>
              ) : (
                <>
                  <div className="h-16 w-16 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400">
                    <Icon name="point_of_sale" size={32} />
                  </div>
                  <h4 className="text-lg font-black text-white mb-2">Configure Checkout Gateway</h4>
                  <p className="text-xs text-gray-400 mb-6 max-w-xs">Mickii will register a secure checkout hook with Stripe sandbox API.</p>
                  <Button 
                    onClick={handleGenerateStripe}
                    disabled={isGeneratingStripe}
                    className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    {isGeneratingStripe ? 'Creating Checkout Link...' : 'Create Stripe Payment Link'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
