
const LABEL_RULES = [
  {
    label: 'bug',
    patterns: [
      /\bbugs?\b/i,
      /\bcrash(e[sd])?\b/i,
      /\bbroken\b/i,
      /doesn'?t work/i,
      /not working/i,
      /\berrors?\b/i,
      /\bexception\b/i,
      /\bregression\b/i,
    ],
  },
  {
    label: 'feature',
    patterns: [
      /feature request/i,
      /\benhancement\b/i,
      /would be (nice|great)/i,
      /please add/i,
      /support for/i,
      /\bfeature\b/i,
    ],
  },
  {
    label: 'docs',
    patterns: [/\bdocs?\b/i, /\bdocumentation\b/i, /\breadme\b/i, /\btypo\b/i],
  },
  {
    label: 'question',
    patterns: [/^how (do|to|can|does)\b/i, /\?\s*$/, /\bquestion\b/i, /\bhelp\b/i],
  },
];

const FALLBACK_LABEL = 'needs-triage';

function classifyIssue({ title = '', body = '' }) {
  const text = `${title}\n${body}`;
  const matched = LABEL_RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text)));

  if (matched.length === 0) {
    return { labels: [FALLBACK_LABEL] };
  }

  return { labels: matched.map((rule) => rule.label) };
}

const PRIORITY_RULES = [
  {
    priority: 'high',
    patterns: [
      /\bcritical\b/i,
      /\burgent\b/i,
      /production (is )?down/i,
      /\bsecurity\b/i,
      /\bdata loss\b/i,
      /\bvulnerability\b/i,
    ],
  },
  {
    priority: 'low',
    patterns: [/\btypo\b/i, /\bcosmetic\b/i, /\bminor\b/i, /\bnitpick\b/i],
  },
];

const DEFAULT_PRIORITY = 'medium';

function estimatePriority({ title = '', body = '' }) {
  const text = `${title}\n${body}`;

  for (const rule of PRIORITY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.priority;
    }
  }

  return DEFAULT_PRIORITY;
}

const DEFAULT_LABELS = LABEL_RULES.map((rule) => rule.label);

module.exports = { classifyIssue, estimatePriority, FALLBACK_LABEL, DEFAULT_PRIORITY, DEFAULT_LABELS };
