/**
 * Worker Registry — Central dispatcher for all Mickii workers.
 * Each worker is a specialized autonomous agent that performs a specific business function.
 */

import { LeadGenWorker } from './leadGenWorker.js';
import { BusinessAnalystWorker } from './businessAnalystWorker.js';
import { ProposalMakerWorker } from './proposalMakerWorker.js';
import { SelfPromoWorker } from './selfPromoWorker.js';
import { ServicePromoWorker } from './servicePromoWorker.js';
import { SocialSchedulerWorker } from './socialSchedulerWorker.js';
import { ShowcaserWorker } from './showcaserWorker.js';
import { LeadManagerWorker } from './leadManagerWorker.js';
import { ClientIntakeWorker } from './clientIntakeWorker.js';
import { PaymentHandlerWorker } from './paymentHandlerWorker.js';
import { BlueprintMakerWorker } from './blueprintMakerWorker.js';
import { DocumentorWorker } from './documentorWorker.js';
import { DeveloperWorker } from './developerWorker.js';
import { WebsiteBuilderWorker } from './websiteBuilderWorker.js';
import { PackagerWorker } from './packagerWorker.js';
import { ComplianceWorker } from './complianceWorker.js';
import { AiCallProductWorker } from './aiCallProductWorker.js';
import { LlmManagerWorker } from './llmManagerWorker.js';
import { McpHubWorker } from './mcpHubWorker.js';
import { NotificationWorker } from './notificationWorker.js';
import { WriterWorker } from './writerWorker.js';
import { ImageGenWorker } from './imageGenWorker.js';
import { QualityAssuranceWorker } from './qualityAssuranceWorker.js';

const WORKER_REGISTRY = {
  lead_gen: {
    name: 'Lead Copysmith',
    description: 'Autonomous lead magnet writer & acquisition strategist',
    workerClass: LeadGenWorker,
    defaultConfig: {}
  },
  business_analyst: {
    name: 'Business Analyst',
    description: 'Market research, SWOT analysis, competitor intelligence',
    workerClass: BusinessAnalystWorker,
    defaultConfig: {}
  },
  proposal_maker: {
    name: 'Proposal Maker',
    description: 'Tailored commercial agreement & pricing models compiler',
    workerClass: ProposalMakerWorker,
    defaultConfig: {}
  },
  self_promo: {
    name: 'Self Promo',
    description: 'Personal branding posts for LinkedIn, X, Instagram',
    workerClass: SelfPromoWorker,
    defaultConfig: {}
  },
  service_promo: {
    name: 'Service Promo',
    description: 'Ad copy, landing page text & email sequences for services',
    workerClass: ServicePromoWorker,
    defaultConfig: {}
  },
  social_scheduler: {
    name: 'Social Scheduler',
    description: 'Content calendar builder with best-time optimization (auto-run)',
    workerClass: SocialSchedulerWorker,
    defaultConfig: {}
  },
  showcaser: {
    name: 'Showcaser',
    description: 'Portfolio case study writer from project results',
    workerClass: ShowcaserWorker,
    defaultConfig: {}
  },
  lead_manager: {
    name: 'Lead Manager',
    description: 'Lead scoring engine, 5-email nurturing sequence & follow-up reminders',
    workerClass: LeadManagerWorker,
    defaultConfig: {}
  },
  client_intake: {
    name: 'Client Intake',
    description: 'Client onboarding kit — welcome email, questionnaire, timeline & communication plan',
    workerClass: ClientIntakeWorker,
    defaultConfig: {}
  },
  payment_handler: {
    name: 'Payment Handler',
    description: 'CRITICAL — Invoice PDF generation, Stripe/UPI links, payment reminders',
    workerClass: PaymentHandlerWorker,
    defaultConfig: {}
  },
  blueprint_maker: {
    name: 'Blueprint Maker',
    description: 'PRD, TRD, architecture diagram, DB schema & API endpoint generator',
    workerClass: BlueprintMakerWorker,
    defaultConfig: {}
  },
  documentor: {
    name: 'Documentor',
    description: 'User manual, admin guide, API docs & README generator (Markdown)',
    workerClass: DocumentorWorker,
    defaultConfig: {}
  },
  developer: {
    name: 'Developer',
    description: 'Code generation — React components, utilities, unit tests, folder structure',
    workerClass: DeveloperWorker,
    defaultConfig: {}
  },
  website_builder: {
    name: 'Website Builder',
    description: 'CRITICAL — Full responsive website (HTML/CSS/JS) + Netlify deploy config',
    workerClass: WebsiteBuilderWorker,
    defaultConfig: {}
  },
  packager: {
    name: 'Packager',
    description: 'CRITICAL — ZIP deliverable bundle (website + docs + code + invoices + README)',
    workerClass: PackagerWorker,
    defaultConfig: {}
  },
  compliance: {
    name: 'Compliance',
    description: 'Legal docs — T&C, Privacy Policy, Cookie Policy, GDPR, Disclaimer (jurisdiction-aware)',
    workerClass: ComplianceWorker,
    defaultConfig: {}
  },
  ai_call_product: {
    name: 'AI Call Product',
    description: 'Packaged AI product listing — pricing tiers, sales page, launch checklist',
    workerClass: AiCallProductWorker,
    defaultConfig: {}
  },
  llm_manager: {
    name: 'LLM Manager',
    description: 'SYSTEM — Quota tracking, key rotation, provider health (no approval)',
    workerClass: LlmManagerWorker,
    defaultConfig: {}
  },
  mcp_hub: {
    name: 'MCP Hub',
    description: 'SYSTEM — MCP server registry, health checks, tool management (no approval)',
    workerClass: McpHubWorker,
    defaultConfig: {}
  },
  qa_worker: {
    name: 'QA Validator',
    description: 'SYSTEM — LLM output validation and self-correction loop (no approval)',
    workerClass: QualityAssuranceWorker,
    defaultConfig: {}
  },
  notification: {
    name: 'Notification',
    description: 'SYSTEM — WhatsApp alerts, in-app toasts, email summaries (no approval)',
    workerClass: NotificationWorker,
    defaultConfig: {}
  },
  writer: {
    name: 'Content Writer',
    description: 'Blog posts, email sequences, social captions, landing copy, case studies, ad copy',
    workerClass: WriterWorker,
    defaultConfig: {}
  },
  image_gen: {
    name: 'Image Generator',
    description: 'AI image generation via Pollinations.AI (free) → Hugging Face → fallback',
    workerClass: ImageGenWorker,
    defaultConfig: {}
  }
};

export async function runWorker(workerName, input, config = {}, hooks = {}) {
  // Safe mapping of UI Skill IDs to active backend worker names
  let actualWorkerName = workerName;
  if (workerName === 'skill-code') actualWorkerName = 'developer';
  else if (workerName === 'skill-design') actualWorkerName = 'website_builder';
  else if (workerName === 'skill-plan') actualWorkerName = 'blueprint_maker';
  else if (workerName === 'skill-research') actualWorkerName = 'business_analyst';
  else if (workerName === 'skill-write') actualWorkerName = 'writer';

  const registry = WORKER_REGISTRY[actualWorkerName];
  if (!registry) {
    throw new Error(`Unknown worker: ${workerName}. Available: ${Object.keys(WORKER_REGISTRY).join(', ')}`);
  }

  const mergedConfig = { ...registry.defaultConfig, ...config };
  const worker = new registry.workerClass(mergedConfig);

  // Merge context config parameters (such as requirements_override) with hooks so they reach worker.run()
  const runParams = { ...config, ...hooks };

  if (hooks.onStatus) hooks.onStatus(`Starting ${registry.name}...`);

  const result = await worker.run(input, runParams);

  if (hooks.onStatus) hooks.onStatus(`${registry.name} complete!`);

  return result;
}

export function listWorkers() {
  return Object.entries(WORKER_REGISTRY).map(([id, meta]) => ({
    id,
    name: meta.name,
    description: meta.description
  }));
}
