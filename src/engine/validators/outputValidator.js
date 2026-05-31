/**
 * Output Validator
 * Detects brand leaks, placeholders, and generic fluff in generated output.
 */

const PLACEHOLDER_PATTERNS = [
  { pattern: /lorem\s+ipsum/gi, name: 'lorem_ipsum', severity: 'high' },
  { pattern: /your\s+company\s+here/gi, name: 'company_placeholder', severity: 'high' },
  { pattern: /your\s+business/gi, name: 'business_placeholder', severity: 'medium' },
  { pattern: /sample\s+text/gi, name: 'sample_text', severity: 'medium' },
  { pattern: /xxx-xxx-xxxx/gi, name: 'phone_placeholder', severity: 'medium' },
  { pattern: /example\.com/gi, name: 'domain_placeholder', severity: 'medium' },
  { pattern: /name@example\.com/gi, name: 'email_placeholder', severity: 'medium' },
  { pattern: /\[insert\s+.+?\]/gi, name: 'insert_placeholder', severity: 'high' },
  { pattern: /\{\{.+?\}\}/g, name: 'template_placeholder', severity: 'high' },
  { pattern: /TODO|FIXME|HACK|XXX/g, name: 'dev_marker', severity: 'low' }
];

const GENERIC_FLUFF_PATTERNS = [
  { pattern: /we\s+are\s+a\s+leading/gi, name: 'leading_claim', severity: 'low' },
  { pattern: /best\s+in\s+class/gi, name: 'buzzword_best', severity: 'low' },
  { pattern: /synergy|paradigm|leverage|holistic/gi, name: 'corporate_buzzword', severity: 'low' },
  { pattern: /contact\s+us\s+today/gi, name: 'generic_cta', severity: 'low' }
];

export class OutputValidator {
  constructor(options = {}) {
    this.strictMode = options.strictMode || false;
    this.customPatterns = options.customPatterns || [];
  }

  validate(content, context = {}) {
    const errors = [];
    const warnings = [];

    // Check placeholders
    PLACEHOLDER_PATTERNS.forEach(({ pattern, name, severity }) => {
      const matches = content.match(pattern);
      if (matches) {
        const issue = {
          type: 'placeholder',
          name,
          severity,
          matches: matches.map(m => m.trim()),
          count: matches.length
        };
        if (severity === 'high' || this.strictMode) {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    });

    // Check generic fluff
    GENERIC_FLUFF_PATTERNS.forEach(({ pattern, name, severity }) => {
      const matches = content.match(pattern);
      if (matches) {
        warnings.push({
          type: 'fluff',
          name,
          severity,
          matches: matches.map(m => m.trim()),
          count: matches.length
        });
      }
    });

    // Check brand leaks (client name appearing in generic output)
    if (context.clientName && context.isGeneric) {
      const clientRegex = new RegExp(`\\b${this.escapeRegex(context.clientName)}\\b`, 'gi');
      if (content.match(clientRegex)) {
        errors.push({
          type: 'brand_leak',
          name: 'client_in_generic',
          severity: 'high',
          message: `Client name "${context.clientName}" found in generic template output`
        });
      }
    }

    // Check custom patterns
    this.customPatterns.forEach(({ pattern, name, severity = 'medium' }) => {
      const regex = typeof pattern === 'string' ? new RegExp(this.escapeRegex(pattern), 'gi') : pattern;
      const matches = content.match(regex);
      if (matches) {
        const issue = {
          type: 'custom',
          name,
          severity,
          matches: matches.map(m => m.trim()),
          count: matches.length
        };
        if (severity === 'high') errors.push(issue);
        else warnings.push(issue);
      }
    });

    const score = this.calculateScore(errors, warnings, content.length);

    return {
      valid: errors.length === 0,
      score,
      errors,
      warnings,
      summary: {
        errorCount: errors.length,
        warningCount: warnings.length,
        totalIssues: errors.length + warnings.length
      }
    };
  }

  calculateScore(errors, warnings, contentLength) {
    const errorWeight = 10;
    const warningWeight = 2;
    const baseScore = 100;
    const deduction = (errors.length * errorWeight) + (warnings.length * warningWeight);
    // Normalize by content length (longer content can have more minor issues)
    const lengthBonus = Math.min(10, Math.floor(contentLength / 1000));
    return Math.max(0, Math.min(100, baseScore - deduction + lengthBonus));
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  sanitize(content, fixes = []) {
    let sanitized = content;

    // Remove common placeholders
    PLACEHOLDER_PATTERNS.forEach(({ pattern }) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // Apply custom fixes
    fixes.forEach(fix => {
      if (fix.search && fix.replace) {
        const regex = typeof fix.search === 'string'
          ? new RegExp(this.escapeRegex(fix.search), 'gi')
          : fix.search;
        sanitized = sanitized.replace(regex, fix.replace);
      }
    });

    return sanitized;
  }
}

export default OutputValidator;
