const pool = require('./pool');

const DEFAULT_SETTINGS = {
  triageEnabled: true,
  prSummaryEnabled: true,
  stalePrScanEnabled: true,
  docsSyncEnabled: true,
  releaseNotesEnabled: true,
};

function rowToSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    triageEnabled: row.triage_enabled,
    prSummaryEnabled: row.pr_summary_enabled,
    stalePrScanEnabled: row.stale_pr_scan_enabled,
    docsSyncEnabled: row.docs_sync_enabled,
    releaseNotesEnabled: row.release_notes_enabled,
  };
}

async function getRepoSettings(repoFullName) {
  const { rows } = await pool.query('SELECT * FROM repo_settings WHERE repo_full_name = $1', [repoFullName]);
  return rowToSettings(rows[0]);
}

async function upsertRepoSettings(repoFullName, installationId, updates = {}) {
  const current = await getRepoSettings(repoFullName);
  const merged = { ...current, ...updates };

  const { rows } = await pool.query(
    `INSERT INTO repo_settings
       (repo_full_name, installation_id, triage_enabled, pr_summary_enabled, stale_pr_scan_enabled, docs_sync_enabled, release_notes_enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (repo_full_name) DO UPDATE SET
       installation_id = EXCLUDED.installation_id,
       triage_enabled = EXCLUDED.triage_enabled,
       pr_summary_enabled = EXCLUDED.pr_summary_enabled,
       stale_pr_scan_enabled = EXCLUDED.stale_pr_scan_enabled,
       docs_sync_enabled = EXCLUDED.docs_sync_enabled,
       release_notes_enabled = EXCLUDED.release_notes_enabled,
       updated_at = now()
     RETURNING *`,
    [
      repoFullName,
      installationId,
      merged.triageEnabled,
      merged.prSummaryEnabled,
      merged.stalePrScanEnabled,
      merged.docsSyncEnabled,
      merged.releaseNotesEnabled,
    ]
  );

  return rowToSettings(rows[0]);
}

module.exports = { getRepoSettings, upsertRepoSettings, DEFAULT_SETTINGS };
