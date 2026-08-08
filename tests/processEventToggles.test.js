jest.mock('../src/db/repoSettings');
jest.mock('../src/triage/aiClassifier');
jest.mock('../src/triage/embeddingDuplicateDetection');
jest.mock('../src/triage/duplicateVerification');
jest.mock('../src/triage/prSummary');
jest.mock('../src/triage/docsSync');
jest.mock('../src/triage/releaseNotes');
jest.mock('../src/triage/staleProcessing');
jest.mock('../src/services/githubApi');
jest.mock('../src/db/pendingActions');

const { getRepoSettings, DEFAULT_SETTINGS } = require('../src/db/repoSettings');
const { getIssue, getPullRequest, addLabels, getPullRequestFiles } = require('../src/services/githubApi');
const { classifyIssueWithAI } = require('../src/triage/aiClassifier');
const { findEmbeddingDuplicateCandidates } = require('../src/triage/embeddingDuplicateDetection');
const { verifyDuplicateWithAI } = require('../src/triage/duplicateVerification');
const { summarizePullRequest } = require('../src/triage/prSummary');
const { processPullRequestMerged } = require('../src/triage/docsSync');
const { processTagPush } = require('../src/triage/releaseNotes');
const { runStalePrScan } = require('../src/triage/staleProcessing');

const { processEvent } = require('../src/triage/processEvent');

const REPO = 'acme/widgets';

function enabled(overrides = {}) {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('processEvent feature-toggle gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIssue.mockResolvedValue({ title: 'x', body: '' });
    getPullRequest.mockResolvedValue({ title: 'x', body: '' });
    getPullRequestFiles.mockResolvedValue([]);
    addLabels.mockResolvedValue(undefined);
    classifyIssueWithAI.mockResolvedValue({ labels: ['bug'], priority: 'medium', source: 'ai' });
    findEmbeddingDuplicateCandidates.mockResolvedValue([]);
    verifyDuplicateWithAI.mockResolvedValue({ isDuplicate: false, confidence: 0 });
    summarizePullRequest.mockResolvedValue('a summary');
    processPullRequestMerged.mockResolvedValue({ docsChecked: true });
    processTagPush.mockResolvedValue({ draftCreated: true });
    runStalePrScan.mockResolvedValue({ prsNudged: [] });
  });

  it('processes a new issue normally when triage is enabled (the default)', async () => {
    getRepoSettings.mockResolvedValue(enabled());

    const result = await processEvent(
      { name: 'issues', data: { repoFullName: REPO, number: 1 } },
      {}
    );

    expect(result.skipped).toBeUndefined();
    expect(getIssue).toHaveBeenCalled();
  });

  it('skips issue processing when triageEnabled is false, without calling the GitHub API at all', async () => {
    getRepoSettings.mockResolvedValue(enabled({ triageEnabled: false }));

    const result = await processEvent(
      { name: 'issues', data: { repoFullName: REPO, number: 1 } },
      {}
    );

    expect(result).toEqual({ skipped: true, reason: 'triage_disabled_for_repo' });
    expect(getIssue).not.toHaveBeenCalled();
  });

  it('skips PR summarization when prSummaryEnabled is false', async () => {
    getRepoSettings.mockResolvedValue(enabled({ prSummaryEnabled: false }));

    const result = await processEvent(
      { name: 'pull_request', data: { repoFullName: REPO, number: 2, eventAction: 'opened' } },
      {}
    );

    expect(result).toEqual({ skipped: true, reason: 'pr_summary_disabled_for_repo' });
    expect(summarizePullRequest).not.toHaveBeenCalled();
  });

  it('still runs PR summarization when only docsSyncEnabled is false (independent toggles)', async () => {
    getRepoSettings.mockResolvedValue(enabled({ docsSyncEnabled: false }));

    const result = await processEvent(
      { name: 'pull_request', data: { repoFullName: REPO, number: 2, eventAction: 'opened' } },
      {}
    );

    expect(result.skipped).toBeUndefined();
    expect(summarizePullRequest).toHaveBeenCalled();
  });

  it('skips docs-sync on a merged PR when docsSyncEnabled is false', async () => {
    getRepoSettings.mockResolvedValue(enabled({ docsSyncEnabled: false }));

    const result = await processEvent(
      { name: 'pull_request', data: { repoFullName: REPO, number: 2, eventAction: 'closed' } },
      {}
    );

    expect(result).toEqual({ skipped: true, reason: 'docs_sync_disabled_for_repo' });
    expect(processPullRequestMerged).not.toHaveBeenCalled();
  });

  it('runs docs-sync on a merged PR when enabled', async () => {
    getRepoSettings.mockResolvedValue(enabled());

    const result = await processEvent(
      { name: 'pull_request', data: { repoFullName: REPO, number: 2, eventAction: 'closed' } },
      {}
    );

    expect(result).toEqual({ docsChecked: true });
    expect(processPullRequestMerged).toHaveBeenCalled();
  });

  it('skips release notes on a tag push when releaseNotesEnabled is false', async () => {
    getRepoSettings.mockResolvedValue(enabled({ releaseNotesEnabled: false }));

    const result = await processEvent(
      { name: 'push', data: { repoFullName: REPO, tagName: 'v1.0.0' } },
      {}
    );

    expect(result).toEqual({ skipped: true, reason: 'release_notes_disabled_for_repo' });
    expect(processTagPush).not.toHaveBeenCalled();
  });

  it('never checks repo settings at the dispatch level for stale-pr-scan (it is not repo-scoped)', async () => {
    const result = await processEvent({ name: 'stale-pr-scan', data: {} }, {});

    expect(result).toEqual({ prsNudged: [] });
    expect(getRepoSettings).not.toHaveBeenCalled();
    expect(runStalePrScan).toHaveBeenCalled();
  });

  it('never checks repo settings for installation events (not repo-scoped)', async () => {
    const result = await processEvent(
      { name: 'installation', data: { action: 'created', account: 'acme', installationId: 1 } },
      {}
    );

    expect(result).toEqual({ action: 'created', account: 'acme' });
    expect(getRepoSettings).not.toHaveBeenCalled();
  });
});
