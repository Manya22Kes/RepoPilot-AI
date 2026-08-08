-- Phase 6: per-repo feature toggles, surfaced and editable from the
-- dashboard. Absence of a row means "not yet configured" — every toggle
-- defaults to enabled (see src/db/repoSettings.js), so a freshly
-- installed repo with no row yet behaves exactly as it did before this
-- table existed, rather than silently doing nothing until someone visits
-- the dashboard.
CREATE TABLE IF NOT EXISTS repo_settings (
  repo_full_name TEXT PRIMARY KEY,
  installation_id BIGINT NOT NULL,
  triage_enabled BOOLEAN NOT NULL DEFAULT true,
  pr_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  stale_pr_scan_enabled BOOLEAN NOT NULL DEFAULT true,
  docs_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  release_notes_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
