-- Phase 3: enforces the human-in-the-loop tiering decision. Low-risk
-- actions (labels, priority tags, informational comments) are applied
-- directly by the worker. Higher-consequence actions (closing an issue as
-- a duplicate, editing docs) are recorded here as pending instead of
-- executed — nothing in this codebase currently reads 'approved' rows and
-- acts on them yet, because the approval workflow itself (who can
-- approve, an actual UI) is Phase 6's dashboard. This table exists now so
-- that (a) the tiering rule has a real, checkable enforcement point
-- rather than being just a comment, and (b) Phase 6 has something to
-- build the approval queue view against.
CREATE TABLE IF NOT EXISTS pending_actions (
  id BIGSERIAL PRIMARY KEY,
  triage_run_id BIGINT REFERENCES triage_runs (id),
  installation_id BIGINT NOT NULL,
  repo_full_name TEXT NOT NULL,
  issue_number INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions (status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_repo ON pending_actions (repo_full_name);
