-- Phase 4: the scheduled stale-PR scan needs to remember when it last
-- nudged a given PR so it doesn't post a fresh "this is stale" comment
-- every single day a PR remains stale — only re-nudge after a cooldown.
CREATE TABLE IF NOT EXISTS stale_pr_nudges (
  id BIGSERIAL PRIMARY KEY,
  repo_full_name TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  last_nudged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_full_name, pr_number)
);
