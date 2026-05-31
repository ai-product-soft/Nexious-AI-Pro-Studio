/**
 * Complexity Analyzer
 * Analyzes task complexity and recommends LLM model selection.
 * Factors: integrations, custom logic, novelty, scale, security, data complexity.
 */

const MODEL_THRESHOLDS = {
  flash: { max: 4, label: 'flash' },
  pro: { max: 7, label: 'pro' },
  claude: { max: 10, label: 'claude' }
};

const COMPLEXITY_FACTORS = [
  {
    name: 'integration_count',
    weight: 1.5,
    extract: (ctx) => (ctx.integrations || []).length
  },
  {
    name: 'custom_logic',
    weight: 2.0,
    extract: (ctx) => ctx.customAlgorithms ? 3 : ctx.customWorkflows ? 2 : 0
  },
  {
    name: 'novelty',
    weight: 1.8,
    extract: (ctx) => ctx.isNovel ? 3 : ctx.hasTemplate ? 1 : 2
  },
  {
    name: 'scale',
    weight: 1.2,
    extract: (ctx) => {
      const users = ctx.estimatedUsers || 0;
      if (users > 100000) return 3;
      if (users > 10000) return 2;
      if (users > 1000) return 1;
      return 0;
    }
  },
  {
    name: 'security_level',
    weight: 1.5,
    extract: (ctx) => {
      const level = ctx.securityLevel || 'standard';
      return { low: 0, standard: 1, high: 2, critical: 3 }[level] || 1;
    }
  },
  {
    name: 'data_complexity',
    weight: 1.3,
    extract: (ctx) => {
      const entities = (ctx.dataEntities || []).length;
      if (entities > 20) return 3;
      if (entities > 10) return 2;
      if (entities > 5) return 1;
      return 0;
    }
  }
];

export class ComplexityAnalyzer {
  analyze(context) {
    let rawScore = 0;
    const breakdown = [];

    COMPLEXITY_FACTORS.forEach(factor => {
      const value = factor.extract(context);
      const contribution = value * factor.weight;
      rawScore += contribution;
      breakdown.push({
        factor: factor.name,
        value,
        weight: factor.weight,
        contribution: Math.round(contribution * 100) / 100
      });
    });

    // Normalize to 1-10 scale
    const normalizedScore = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));

    // Select model
    let recommendedModel = 'flash';
    if (normalizedScore > MODEL_THRESHOLDS.pro.max) {
      recommendedModel = MODEL_THRESHOLDS.claude.label;
    } else if (normalizedScore > MODEL_THRESHOLDS.flash.max) {
      recommendedModel = MODEL_THRESHOLDS.pro.label;
    }

    return {
      score: normalizedScore,
      model: recommendedModel,
      breakdown,
      estimatedTokens: this.estimateTokens(context, normalizedScore),
      estimatedDuration: this.estimateDuration(normalizedScore)
    };
  }

  estimateTokens(context, score) {
    const base = 2000;
    const complexityMultiplier = score * 500;
    const contentSize = (context.description || '').length * 0.5;
    return Math.round(base + complexityMultiplier + contentSize);
  }

  estimateDuration(score) {
    // Estimated AI generation time in seconds
    const base = 5;
    return Math.round(base + score * 3);
  }
}

export default ComplexityAnalyzer;
