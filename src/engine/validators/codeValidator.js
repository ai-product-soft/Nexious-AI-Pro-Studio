/**
 * Code Validator
 * Security scanner for generated code.
 * Detects SQL injection, XSS, hardcoded secrets, insecure eval, and path traversal.
 */

const SECURITY_PATTERNS = [
  {
    id: 'sql_injection',
    name: 'SQL Injection Risk',
    severity: 'critical',
    patterns: [
      /String\.concat\s*\(\s*.*\+.*\)/,
      /\.exec\s*\(\s*["'].*\$\{.*\}/,
      /query\s*\(\s*["'].*\+.*\)/,
      /execute\s*\(\s*["'].*\$\{.*\}/,
      /raw\s*\(\s*["'].*\$\{.*\}/
    ],
    languages: ['javascript', 'typescript', 'python', 'java', 'csharp']
  },
  {
    id: 'xss_risk',
    name: 'XSS Vulnerability',
    severity: 'critical',
    patterns: [
      /innerHTML\s*=\s*.*\+.*\$\{/,
      /dangerouslySetInnerHTML.*__html.*\$\{/,
      /document\.write\s*\(.*\$\{/,
      /eval\s*\(.*\$\{/,
      /new\s+Function\s*\(.*\$\{/
    ],
    languages: ['javascript', 'typescript', 'html']
  },
  {
    id: 'hardcoded_secret',
    name: 'Hardcoded Secret',
    severity: 'high',
    patterns: [
      /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9]{16,}["']/i,
      /password\s*[:=]\s*["'][^"']{4,}["']/i,
      /secret\s*[:=]\s*["'][a-zA-Z0-9]{8,}["']/i,
      /token\s*[:=]\s*["'][a-zA-Z0-9]{16,}["']/i,
      /AWS_ACCESS_KEY_ID\s*[:=]\s*["'][A-Z0-9]{16,}["']/,
      /PRIVATE_KEY\s*[:=]\s*["']-----BEGIN/
    ],
    languages: ['all']
  },
  {
    id: 'insecure_eval',
    name: 'Insecure Eval Usage',
    severity: 'high',
    patterns: [
      /eval\s*\(/,
      /new\s+Function\s*\(/,
      /setTimeout\s*\(\s*["']/,
      /setInterval\s*\(\s*["']/
    ],
    languages: ['javascript', 'typescript']
  },
  {
    id: 'path_traversal',
    name: 'Path Traversal Risk',
    severity: 'medium',
    patterns: [
      /fs\.readFile\s*\(.*\+.*\)/,
      /fs\.writeFile\s*\(.*\+.*\)/,
      /path\.join\s*\(.*req\./,
      /\.\.\//
    ],
    languages: ['javascript', 'typescript', 'python']
  }
];

const SYNTAX_PATTERNS = [
  {
    id: 'unclosed_brace',
    name: 'Unclosed Brace',
    pattern: /\{[^}]*$/
  },
  {
    id: 'unclosed_paren',
    name: 'Unclosed Parenthesis',
    pattern: /\([^)]*$/
  },
  {
    id: 'unclosed_bracket',
    name: 'Unclosed Bracket',
    pattern: /\[[^\]]*$/
  },
  {
    id: 'trailing_comma',
    name: 'Trailing Comma in Object',
    pattern: /,\s*\}/g
  }
];

export class CodeValidator {
  constructor(options = {}) {
    this.severityThreshold = options.severityThreshold || 'medium';
    this.customRules = options.customRules || [];
  }

  validate(code, language = 'javascript') {
    const findings = [];
    const syntaxErrors = [];

    // Security scan
    SECURITY_PATTERNS.forEach(rule => {
      if (rule.languages.includes('all') || rule.languages.includes(language.toLowerCase())) {
        rule.patterns.forEach(pattern => {
          const matches = code.match(pattern);
          if (matches) {
            findings.push({
              id: rule.id,
              name: rule.name,
              severity: rule.severity,
              matches: matches.map(m => m.trim().substring(0, 100)),
              line: this.findLineNumber(code, matches[0]),
              recommendation: this.getRecommendation(rule.id)
            });
          }
        });
      }
    });

    // Syntax check (lightweight regex-based)
    SYNTAX_PATTERNS.forEach(({ id, name, pattern }) => {
      if (pattern.test(code)) {
        syntaxErrors.push({ id, name });
      }
    });

    // Custom rules
    this.customRules.forEach(rule => {
      const regex = typeof rule.pattern === 'string'
        ? new RegExp(rule.pattern, 'gi')
        : rule.pattern;
      const matches = code.match(regex);
      if (matches) {
        findings.push({
          id: rule.id || 'custom',
          name: rule.name || 'Custom Rule',
          severity: rule.severity || 'medium',
          matches: matches.map(m => m.trim().substring(0, 100)),
          line: this.findLineNumber(code, matches[0]),
          recommendation: rule.recommendation || 'Review manually'
        });
      }
    });

    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;

    return {
      valid: criticalCount === 0 && highCount === 0,
      safe: findings.length === 0,
      findings,
      syntaxErrors,
      summary: {
        critical: criticalCount,
        high: highCount,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length,
        syntax: syntaxErrors.length
      },
      score: Math.max(0, 100 - (criticalCount * 25) - (highCount * 15) - (syntaxErrors.length * 5))
    };
  }

  findLineNumber(code, snippet) {
    const index = code.indexOf(snippet);
    if (index === -1) return null;
    return code.substring(0, index).split('\n').length;
  }

  getRecommendation(issueId) {
    const recommendations = {
      sql_injection: 'Use parameterized queries or ORM. Never concatenate user input into SQL.',
      xss_risk: 'Use textContent instead of innerHTML. Sanitize all user input with DOMPurify.',
      hardcoded_secret: 'Move secrets to environment variables or secure vault. Use .env files.',
      insecure_eval: 'Avoid eval(). Use JSON.parse for JSON, or structured parsing for other formats.',
      path_traversal: 'Validate and sanitize all file paths. Use allowlists for directories.'
    };
    return recommendations[issueId] || 'Review and fix manually.';
  }
}

export default CodeValidator;
