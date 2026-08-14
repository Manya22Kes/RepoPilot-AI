const { getRunStatsSince } = require('../db/triageRuns');
const { countPendingActions } = require('../db/pendingActions');
const { countDeadLettersSince } = require('../db/deadLetterJobs');
const { getCostSummary } = require('../db/llmCalls');

async function buildDigestData(days = 7) {
  const [runStats, pendingApprovals, deadLetters, costs] = await Promise.all([
    getRunStatsSince(days),
    countPendingActions('pending_approval'),
    countDeadLettersSince(days),
    getCostSummary({ days }),
  ]);

  return { days, runStats, pendingApprovals, deadLetters, costs };
}

function formatDigestText(data) {
  const { days, runStats, pendingApprovals, deadLetters, costs } = data;

  const lines = [
    `*Weekly digest — last ${days} days*`,
    '',
    `Triage runs: ${runStats.total} total (${runStats.success} succeeded, ${runStats.failed} failed)`,
    `Estimated LLM cost: ${costs.totalCostUsd !== null ? `$${costs.totalCostUsd.toFixed(4)}` : 'unknown'} across ${costs.totalCalls} call(s)`,
    `Pending approvals waiting right now: ${pendingApprovals}`,
    `Permanently failed jobs this period: ${deadLetters}`,
  ];

  if (runStats.topRepos.length > 0) {
    lines.push('', 'Most active repos:');
    for (const r of runStats.topRepos) lines.push(`  • ${r.repo}: ${r.count} run(s)`);
  }

  return lines.join('\n');
}

module.exports = { buildDigestData, formatDigestText };
