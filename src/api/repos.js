const express = require('express');
const { listAppInstallations, listInstallationRepositories } = require('../services/githubApi');
const { getRepoSettings, upsertRepoSettings } = require('../db/repoSettings');

const router = express.Router();

router.get('/repos', async (req, res, next) => {
  try {
    const installations = await listAppInstallations();
    const repos = [];

    for (const installation of installations) {
      const repoNames = await listInstallationRepositories(installation.id);
      for (const repoFullName of repoNames) {
        const settings = await getRepoSettings(repoFullName);
        repos.push({ repoFullName, installationId: installation.id, settings });
      }
    }

    res.json({ repos });
  } catch (err) {
    next(err);
  }
});

router.get('/repos/:owner/:repo/settings', async (req, res, next) => {
  try {
    const repoFullName = `${req.params.owner}/${req.params.repo}`;
    const settings = await getRepoSettings(repoFullName);
    res.json({ repoFullName, settings });
  } catch (err) {
    next(err);
  }
});

const TOGGLE_KEYS = [
  'triageEnabled',
  'prSummaryEnabled',
  'stalePrScanEnabled',
  'docsSyncEnabled',
  'releaseNotesEnabled',
];

router.put('/repos/:owner/:repo/settings', async (req, res, next) => {
  try {
    const repoFullName = `${req.params.owner}/${req.params.repo}`;
    const { installationId, ...body } = req.body || {};

    if (!installationId) {
      return res.status(400).json({ error: 'installationId is required' });
    }

    const updates = {};
    for (const key of TOGGLE_KEYS) {
      if (typeof body[key] === 'boolean') updates[key] = body[key];
    }

    const settings = await upsertRepoSettings(repoFullName, installationId, updates);
    return res.json({ repoFullName, settings });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
