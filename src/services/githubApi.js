const { getInstallationAccessToken, generateAppJwt } = require('./githubAuth');
const { withRetry } = require('../utils/retry');
const { parseRetryAfterMs } = require('../utils/rateLimitHeaders');
const logger = require('../utils/logger');

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

async function githubRequest(installationId, path, options = {}) {
  return withRetry(
    async () => {
      const token = await getInstallationAccessToken(installationId);

      const response = await fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        const bodyText = await response.text();
        const error = new Error(
          `GitHub API ${options.method || 'GET'} ${path} failed (HTTP ${response.status}): ${bodyText}`
        );
        error.status = response.status;
        error.retryAfterMs = parseRetryAfterMs(response);
        throw error;
      }

      if (response.status === 204) return null;
      return response.json();
    },
    {
      attempts: 3,
      baseDelayMs: 300,
      isRetryable: (err) => RETRYABLE_STATUS_CODES.has(err.status),
    }
  );
}

async function githubAppRequest(path, options = {}) {
  return withRetry(
    async () => {
      const jwt = generateAppJwt();

      const response = await fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        const bodyText = await response.text();
        const error = new Error(
          `GitHub App API ${options.method || 'GET'} ${path} failed (HTTP ${response.status}): ${bodyText}`
        );
        error.status = response.status;
        error.retryAfterMs = parseRetryAfterMs(response);
        throw error;
      }

      if (response.status === 204) return null;
      return response.json();
    },
    {
      attempts: 3,
      baseDelayMs: 300,
      isRetryable: (err) => RETRYABLE_STATUS_CODES.has(err.status),
    }
  );
}

async function getIssue(installationId, repoFullName, issueNumber) {
  return githubRequest(installationId, `/repos/${repoFullName}/issues/${issueNumber}`);
}

async function getPullRequest(installationId, repoFullName, pullNumber) {
  return githubRequest(installationId, `/repos/${repoFullName}/pulls/${pullNumber}`);
}

async function closeIssue(installationId, repoFullName, issueNumber, { stateReason } = {}) {
  await githubRequest(installationId, `/repos/${repoFullName}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed', state_reason: stateReason }),
  });

  logger.info('Closed issue', { repo: repoFullName, issueNumber, stateReason });
}

async function addLabels(installationId, repoFullName, issueNumber, labels) {
  if (labels.length === 0) return;

  await githubRequest(installationId, `/repos/${repoFullName}/issues/${issueNumber}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels }),
  });

  logger.info('Applied labels', { repo: repoFullName, issueNumber, labels });
}

async function createComment(installationId, repoFullName, issueNumber, body) {
  await githubRequest(installationId, `/repos/${repoFullName}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

  logger.info('Posted comment', { repo: repoFullName, issueNumber });
}

async function getPullRequestFiles(installationId, repoFullName, pullNumber, { perPage = 100 } = {}) {
  const files = await githubRequest(
    installationId,
    `/repos/${repoFullName}/pulls/${pullNumber}/files?per_page=${perPage}`
  );

  return files.map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch || null,
  }));
}

async function listOpenIssues(installationId, repoFullName, { excludeNumber, perPage = 30 } = {}) {
  const issues = await githubRequest(
    installationId,
    `/repos/${repoFullName}/issues?state=open&per_page=${perPage}`
  );

  return issues
    .filter((issue) => !issue.pull_request && issue.number !== excludeNumber)
    .map((issue) => ({ number: issue.number, title: issue.title }));
}

async function listAppInstallations() {
  return githubAppRequest('/app/installations?per_page=100');
}

async function listInstallationRepositories(installationId) {
  const token = await getInstallationAccessToken(installationId);
  const data = await withRetry(
    async () => {
      const response = await fetch('https://api.github.com/installation/repositories?per_page=100', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!response.ok) {
        const bodyText = await response.text();
        const error = new Error(`GitHub API GET /installation/repositories failed (HTTP ${response.status}): ${bodyText}`);
        error.status = response.status;
        error.retryAfterMs = parseRetryAfterMs(response);
        throw error;
      }
      return response.json();
    },
    { attempts: 3, baseDelayMs: 300, isRetryable: (err) => RETRYABLE_STATUS_CODES.has(err.status) }
  );

  return data.repositories.map((repo) => repo.full_name);
}

async function listOpenPullRequests(installationId, repoFullName, { perPage = 100 } = {}) {
  const prs = await githubRequest(
    installationId,
    `/repos/${repoFullName}/pulls?state=open&per_page=${perPage}`
  );

  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    updatedAt: pr.updated_at,
    draft: pr.draft,
  }));
}

async function listReleases(installationId, repoFullName, { perPage = 10 } = {}) {
  const releases = await githubRequest(installationId, `/repos/${repoFullName}/releases?per_page=${perPage}`);
  return releases
    .filter((release) => !release.draft)
    .map((release) => ({ tagName: release.tag_name, publishedAt: release.published_at }));
}

async function compareCommits(installationId, repoFullName, base, head) {
  const data = await githubRequest(installationId, `/repos/${repoFullName}/compare/${base}...${head}`);
  return (data.commits || []).map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name || commit.author?.login || 'unknown',
  }));
}

async function listCommits(installationId, repoFullName, { sha, perPage = 50 } = {}) {
  const commits = await githubRequest(
    installationId,
    `/repos/${repoFullName}/commits?sha=${encodeURIComponent(sha)}&per_page=${perPage}`
  );
  return commits.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name || commit.author?.login || 'unknown',
  }));
}

async function createDraftRelease(installationId, repoFullName, { tagName, name, body }) {
  await githubRequest(installationId, `/repos/${repoFullName}/releases`, {
    method: 'POST',
    body: JSON.stringify({ tag_name: tagName, name, body, draft: true }),
  });

  logger.info('Created draft release', { repo: repoFullName, tagName });
}

module.exports = {
  githubRequest,
  githubAppRequest,
  getIssue,
  getPullRequest,
  closeIssue,
  addLabels,
  listOpenIssues,
  createComment,
  getPullRequestFiles,
  listAppInstallations,
  listInstallationRepositories,
  listOpenPullRequests,
  listReleases,
  compareCommits,
  listCommits,
  createDraftRelease,
};
