const logger = require('../utils/logger');
const config = require('../config');
const {
  listAppInstallations,
  listInstallationRepositories,
  listOpenPullRequests,
  createComment,
} = require('../services/githubApi');
const { getLastNudgedAt, recordNudge } = require('../db/stalePrNudges');
const { getRepoSettings } = require('../db/repoSettings');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isStale(updatedAt, now, thresholdDays = config.stalePrScan.thresholdDays) {
  const daysSinceUpdate = (now.getTime() - new Date(updatedAt).getTime()) / MS_PER_DAY;
  return daysSinceUpdate >= thresholdDays;
}

function shouldRenudge(lastNudgedAt, now, renudgeDays = config.stalePrScan.renudgeDays) {
  if (!lastNudgedAt) return true;
  const daysSinceNudge = (now.getTime() - new Date(lastNudgedAt).getTime()) / MS_PER_DAY;
  return daysSinceNudge >= renudgeDays;
}

function buildNudgeComment(daysSinceUpdate) {
  return (
    `This PR has had no activity for ${Math.floor(daysSinceUpdate)} day(s). ` +
    `If it's still active, a rebase or status update would help; if it's abandoned, consider closing it.\n\n` +
    `_Automated nudge from the triage bot — re-sent no more than once every ${config.stalePrScan.renudgeDays} day(s)._`
  );
}

async function runStalePrScan({ now = new Date() } = {}) {
  const installations = await listAppInstallations();
  const summary = {
    installationsScanned: 0,
    reposScanned: 0,
    reposSkippedDisabled: 0,
    prsChecked: 0,
    prsNudged: [],
  };

  for (const installation of installations) {
    summary.installationsScanned += 1;
    const repos = await listInstallationRepositories(installation.id);

    for (const repoFullName of repos) {
      const settings = await getRepoSettings(repoFullName);
      if (!settings.stalePrScanEnabled) {
        summary.reposSkippedDisabled += 1;
        continue;
      }

      summary.reposScanned += 1;
      const openPRs = await listOpenPullRequests(installation.id, repoFullName);

      for (const pr of openPRs) {
        summary.prsChecked += 1;
        if (pr.draft) continue;
        if (!isStale(pr.updatedAt, now)) continue;

        const lastNudgedAt = await getLastNudgedAt(repoFullName, pr.number);
        if (!shouldRenudge(lastNudgedAt, now)) continue;

        const daysSinceUpdate = (now.getTime() - new Date(pr.updatedAt).getTime()) / MS_PER_DAY;
        await createComment(installation.id, repoFullName, pr.number, buildNudgeComment(daysSinceUpdate));
        await recordNudge(repoFullName, pr.number);

        summary.prsNudged.push({ repoFullName, number: pr.number });
        logger.info('Nudged stale PR', { repoFullName, number: pr.number, daysSinceUpdate: Math.floor(daysSinceUpdate) });
      }
    }
  }

  return summary;
}

module.exports = { runStalePrScan, isStale, shouldRenudge, buildNudgeComment };
