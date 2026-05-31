/**
 * Phase Engine
 * Manages execution phases based on product type.
 * Each product type has a predefined sequence of phases with workers and dependencies.
 */

const PRODUCT_PHASES = {
  website: [
    { id: 'discovery', name: 'Discovery', duration: 1, worker: 'analyst', dependencies: [] },
    { id: 'wireframe', name: 'Wireframing', duration: 1, worker: 'designer', dependencies: ['discovery'] },
    { id: 'content', name: 'Content Planning', duration: 1, worker: 'writer', dependencies: ['discovery'] },
    { id: 'ui_design', name: 'UI Design', duration: 2, worker: 'designer', dependencies: ['wireframe'] },
    { id: 'frontend', name: 'Frontend Development', duration: 3, worker: 'dev_frontend', dependencies: ['ui_design', 'content'] },
    { id: 'backend', name: 'Backend Setup', duration: 2, worker: 'dev_backend', dependencies: ['discovery'] },
    { id: 'api', name: 'API Integration', duration: 2, worker: 'dev_backend', dependencies: ['backend', 'frontend'] },
    { id: 'database', name: 'Database Design', duration: 1, worker: 'architect', dependencies: ['backend'] },
    { id: 'auth', name: 'Authentication', duration: 1, worker: 'dev_security', dependencies: ['backend'] },
    { id: 'testing', name: 'Testing & QA', duration: 2, worker: 'qa', dependencies: ['api', 'auth', 'database'] },
    { id: 'deployment', name: 'Deployment', duration: 1, worker: 'devops', dependencies: ['testing'] },
    { id: 'handover', name: 'Client Handover', duration: 1, worker: 'manager', dependencies: ['deployment'] }
  ],
  ai_agent: [
    { id: 'discovery', name: 'Discovery', duration: 1, worker: 'analyst', dependencies: [] },
    { id: 'scope', name: 'AI Scope Definition', duration: 1, worker: 'ai_architect', dependencies: ['discovery'] },
    { id: 'data_audit', name: 'Data Audit', duration: 1, worker: 'data_engineer', dependencies: ['discovery'] },
    { id: 'model_select', name: 'Model Selection', duration: 1, worker: 'ai_architect', dependencies: ['scope', 'data_audit'] },
    { id: 'prompt_eng', name: 'Prompt Engineering', duration: 2, worker: 'ai_engineer', dependencies: ['model_select'] },
    { id: 'rag_setup', name: 'RAG Setup', duration: 2, worker: 'ai_engineer', dependencies: ['data_audit'] },
    { id: 'tool_design', name: 'Tool Design', duration: 2, worker: 'ai_architect', dependencies: ['scope'] },
    { id: 'workflow', name: 'Workflow Design', duration: 2, worker: 'ai_engineer', dependencies: ['tool_design', 'prompt_eng'] },
    { id: 'integration', name: 'Integration', duration: 2, worker: 'dev_backend', dependencies: ['workflow', 'rag_setup'] },
    { id: 'safety', name: 'Safety Guardrails', duration: 1, worker: 'ai_safety', dependencies: ['workflow'] },
    { id: 'eval', name: 'Evaluation', duration: 2, worker: 'ai_engineer', dependencies: ['integration', 'safety'] },
    { id: 'fine_tune', name: 'Fine Tuning', duration: 3, worker: 'ai_engineer', dependencies: ['eval'] },
    { id: 'ui_chat', name: 'Chat Interface', duration: 2, worker: 'dev_frontend', dependencies: ['integration'] },
    { id: 'testing', name: 'Testing', duration: 2, worker: 'qa', dependencies: ['ui_chat', 'fine_tune', 'eval'] },
    { id: 'deploy', name: 'Deployment', duration: 1, worker: 'devops', dependencies: ['testing'] },
    { id: 'monitor', name: 'Monitoring Setup', duration: 1, worker: 'ai_safety', dependencies: ['deploy'] },
    { id: 'docs', name: 'Documentation', duration: 1, worker: 'writer', dependencies: ['deploy'] },
    { id: 'train', name: 'Client Training', duration: 1, worker: 'manager', dependencies: ['docs', 'monitor'] },
    { id: 'feedback', name: 'Feedback Loop', duration: 1, worker: 'ai_engineer', dependencies: ['train'] }
  ],
  mobile_app: [
    { id: 'discovery', name: 'Discovery', duration: 1, worker: 'analyst', dependencies: [] },
    { id: 'ux', name: 'UX Research', duration: 1, worker: 'designer', dependencies: ['discovery'] },
    { id: 'prototype', name: 'Prototyping', duration: 2, worker: 'designer', dependencies: ['ux'] },
    { id: 'ui', name: 'UI Design', duration: 2, worker: 'designer', dependencies: ['prototype'] },
    { id: 'frontend', name: 'App Development', duration: 4, worker: 'dev_mobile', dependencies: ['ui'] },
    { id: 'backend', name: 'Backend & API', duration: 3, worker: 'dev_backend', dependencies: ['discovery'] },
    { id: 'integration', name: 'Integration', duration: 2, worker: 'dev_mobile', dependencies: ['frontend', 'backend'] },
    { id: 'testing', name: 'Testing', duration: 2, worker: 'qa', dependencies: ['integration'] },
    { id: 'store', name: 'Store Submission', duration: 1, worker: 'manager', dependencies: ['testing'] },
    { id: 'handover', name: 'Handover', duration: 1, worker: 'manager', dependencies: ['store'] }
  ]
};

export class PhaseEngine {
  constructor(productType = 'website') {
    this.productType = productType;
    this.phases = this.loadPhases(productType);
  }

  loadPhases(type) {
    this.productType = type;
    const normalized = type.toLowerCase().replace(/\s+/g, '_');
    this.phases = PRODUCT_PHASES[normalized] || PRODUCT_PHASES.website;
    return this.phases;
  }

  getPhases() {
    return this.phases.map(p => ({ ...p }));
  }

  getPhaseById(id) {
    return this.phases.find(p => p.id === id);
  }

  getTotalDuration() {
    return this.phases.reduce((sum, p) => sum + p.duration, 0);
  }

  getParallelGroups() {
    const groups = [];
    const phases = this.phases;

    function getDepth(phaseId) {
      const phase = phases.find(p => p.id === phaseId);
      if (!phase || phase.dependencies.length === 0) return 0;
      return 1 + Math.max(...phase.dependencies.map(getDepth));
    }

    const depthMap = new Map();
    phases.forEach(p => {
      depthMap.set(p.id, getDepth(p.id));
    });

    const maxDepth = Math.max(...depthMap.values());
    for (let d = 0; d <= maxDepth; d++) {
      const group = phases.filter(p => depthMap.get(p.id) === d);
      if (group.length > 0) groups.push(group.map(p => p.id));
    }
    return groups;
  }

  validateSequence() {
    const errors = [];
    const phaseIds = new Set(this.phases.map(p => p.id));

    this.phases.forEach(phase => {
      phase.dependencies.forEach(dep => {
        if (!phaseIds.has(dep)) {
          errors.push(`Phase "${phase.id}" has unknown dependency: "${dep}"`);
        }
      });
    });

    // Detect cycles using DFS on dependency graph
    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (id) => {
      visited.add(id);
      recStack.add(id);
      const phase = this.phases.find(p => p.id === id);
      if (phase) {
        for (const dep of phase.dependencies) {
          if (!visited.has(dep) && hasCycle(dep)) return true;
          if (recStack.has(dep)) return true;
        }
      }
      recStack.delete(id);
      return false;
    };

    for (const phase of this.phases) {
      if (!visited.has(phase.id)) {
        if (hasCycle(phase.id)) {
          errors.push('Circular dependency detected in phase sequence');
          break;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  estimateTimeline() {
    const groups = this.getParallelGroups();
    let totalDays = 0;
    const timeline = [];

    groups.forEach((group, index) => {
      const groupPhases = group.map(id => this.phases.find(p => p.id === id));
      const maxDuration = Math.max(...groupPhases.map(p => p.duration));
      totalDays += maxDuration;
      timeline.push({
        groupIndex: index,
        phases: group,
        duration: maxDuration,
        cumulativeDays: totalDays
      });
    });

    return { totalDays, timeline, groups };
  }
}

export function getAvailableProductTypes() {
  return Object.keys(PRODUCT_PHASES);
}

export default PhaseEngine;
