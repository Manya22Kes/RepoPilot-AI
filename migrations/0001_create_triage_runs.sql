-- Phase 2: persistence for triage runs. Installation/Repo tables are an
-- open question noted in the project brief (Section 7) — deferred until
-- the dashboard (Phase 6) needs richer per-repo config, rather than
-- speculatively normalizing now.
CREATE TABLE IF NOT EXISTS triage_runs (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL,
  -- Nullable: installation events are account-scoped, not repo-scoped, so
  -- there's no single repo to attribute them to.
  repo_full_name TEXT,
  event_name TEXT NOT NULL,
  event_action TEXT,
  delivery_id TEXT,
  subject_type TEXT NOT NULL,
  subject_number INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_triage_runs_repo ON triage_runs (repo_full_name);
CREATE INDEX IF NOT EXISTS idx_triage_runs_status ON triage_runs (status);
-- Not unique yet — becomes the basis for a hard idempotency guarantee in
-- Phase 5 (reject/short-circuit a delivery_id already seen), once that
-- phase's reliability work is ready to handle the constraint violation
-- path deliberately rather than as an untested edge case here.
CREATE INDEX IF NOT EXISTS idx_triage_runs_delivery_id ON triage_runs (delivery_id);
