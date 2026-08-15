CREATE TABLE IF NOT EXISTS digest_snapshots (
  id BIGSERIAL PRIMARY KEY,
  days INTEGER NOT NULL,
  run_stats JSONB NOT NULL,
  pending_approvals INTEGER NOT NULL,
  dead_letters INTEGER NOT NULL,
  costs JSONB NOT NULL,
  posted_to_slack BOOLEAN NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_snapshots_sent_at ON digest_snapshots (sent_at DESC);
