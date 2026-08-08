const logger = require('../utils/logger');
const { safeParseJSON } = require('../llm/jsonUtils');
const { classifyIssue: classifyIssueByRules, estimatePriority: estimatePriorityByRules } = require('./rules');

const VALID_LABELS = ['bug', 'feature', 'docs', 'question'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

function buildClassificationPrompt({ title, body }) {
  return [
    'You are an issue triage assistant for a software project.',
    'Given the issue title and body below, respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:',
    '{"labels": string[], "priority": "high"|"medium"|"low", "reasoning": string}',
    '',
    '- "labels" must be a subset of ["bug","feature","docs","question"]. Use an empty array if none clearly apply.',
    '- "priority" reflects urgency/impact: "high" for things like security issues, data loss, or production outages; "low" for cosmetic/minor issues; "medium" otherwise.',
    '- "reasoning" is one short sentence explaining the classification.',
    '',
    `Title: ${title}`,
    `Body: ${body || '(no description provided)'}`,
  ].join('\n');
}

function isValidClassification(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!Array.isArray(parsed.labels)) return false;
  if (!parsed.labels.every((label) => VALID_LABELS.includes(label))) return false;
  if (!VALID_PRIORITIES.includes(parsed.priority)) return false;
  return true;
}

async function classifyIssueWithAI(llmClient, { title, body }) {
  try {
    const response = await llmClient.complete({
      prompt: buildClassificationPrompt({ title, body }),
      responseFormat: 'json',
      purpose: 'issue_classification',
    });

    const parsed = safeParseJSON(response.content);

    if (!isValidClassification(parsed)) {
      logger.warn('AI classification response was invalid, falling back to rule-based engine', {
        rawContent: response.content?.slice(0, 200),
      });
      return ruleBasedFallback({ title, body });
    }

    return {
      labels: parsed.labels.length > 0 ? parsed.labels : ['needs-triage'],
      priority: parsed.priority,
      reasoning: parsed.reasoning,
      source: 'ai',
      provider: response.provider,
    };
  } catch (err) {
    logger.warn('AI classification failed (all providers), falling back to rule-based engine', {
      error: err.message,
    });
    return ruleBasedFallback({ title, body });
  }
}

function ruleBasedFallback({ title, body }) {
  const { labels } = classifyIssueByRules({ title, body });
  const priority = estimatePriorityByRules({ title, body });
  return { labels, priority, reasoning: null, source: 'rule-based-fallback' };
}

module.exports = { classifyIssueWithAI, buildClassificationPrompt, isValidClassification };
