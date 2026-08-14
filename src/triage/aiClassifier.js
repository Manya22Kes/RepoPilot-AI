const logger = require('../utils/logger');
const { safeParseJSON } = require('../llm/jsonUtils');
const {
  classifyIssue: classifyIssueByRules,
  estimatePriority: estimatePriorityByRules,
  DEFAULT_LABELS,
} = require('./rules');

const VALID_PRIORITIES = ['high', 'medium', 'low'];

function buildClassificationPrompt({ title, body, labels }) {
  return [
    'You are an issue triage assistant for a software project.',
    'Given the issue title and body below, respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:',
    `{"labels": string[], "priority": "high"|"medium"|"low", "reasoning": string}`,
    '',
    `- "labels" must be a subset of ${JSON.stringify(labels)}. Use an empty array if none clearly apply.`,
    '- "priority" reflects urgency/impact: "high" for things like security issues, data loss, or production outages; "low" for cosmetic/minor issues; "medium" otherwise.',
    '- "reasoning" is one short sentence explaining the classification.',
    '',
    `Title: ${title}`,
    `Body: ${body || '(no description provided)'}`,
  ].join('\n');
}

function isValidClassification(parsed, labels) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!Array.isArray(parsed.labels)) return false;
  if (!parsed.labels.every((label) => labels.includes(label))) return false;
  if (!VALID_PRIORITIES.includes(parsed.priority)) return false;
  return true;
}

/**
 * `labels` defaults to the built-in four (bug/feature/docs/question) —
 * pass a repo's custom set to classify against those instead. The
 * rule-based fallback only understands the built-in four; for a custom
 * label set, an AI failure results in no category label at all rather
 * than a guess using rules that don't apply — see fallbackForLabels.
 */
async function classifyIssueWithAI(llmClient, { title, body }, { labels = DEFAULT_LABELS } = {}) {
  try {
    const response = await llmClient.complete({
      prompt: buildClassificationPrompt({ title, body, labels }),
      responseFormat: 'json',
      purpose: 'issue_classification',
    });

    const parsed = safeParseJSON(response.content);

    if (!isValidClassification(parsed, labels)) {
      logger.warn('AI classification response was invalid, falling back', {
        rawContent: response.content?.slice(0, 200),
      });
      return fallbackForLabels({ title, body, labels });
    }

    return {
      labels: parsed.labels.length > 0 ? parsed.labels : usesDefaultLabels(labels) ? ['needs-triage'] : [],
      priority: parsed.priority,
      reasoning: parsed.reasoning,
      source: 'ai',
      provider: response.provider,
    };
  } catch (err) {
    logger.warn('AI classification failed (all providers), falling back', { error: err.message });
    return fallbackForLabels({ title, body, labels });
  }
}

function usesDefaultLabels(labels) {
  return labels.length === DEFAULT_LABELS.length && labels.every((l) => DEFAULT_LABELS.includes(l));
}

function fallbackForLabels({ title, body, labels }) {
  const priority = estimatePriorityByRules({ title, body });

  if (usesDefaultLabels(labels)) {
    const { labels: ruleLabels } = classifyIssueByRules({ title, body });
    return { labels: ruleLabels, priority, reasoning: null, source: 'rule-based-fallback' };
  }

  // Custom label set — no rule engine exists for arbitrary categories, so
  // we deliberately don't guess. Priority estimation still works fine
  // since it's not tied to any particular label taxonomy.
  return { labels: [], priority, reasoning: null, source: 'rule-based-fallback-no-category' };
}

module.exports = { classifyIssueWithAI, buildClassificationPrompt, isValidClassification };
