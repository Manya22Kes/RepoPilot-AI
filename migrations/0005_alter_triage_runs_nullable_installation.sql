-- Phase 4: the scheduled stale-PR scan enumerates every installation the
-- app has, rather than being triggered by (and scoped to) a single one —
-- so unlike every other event type, it has no single installation_id to
-- record.
ALTER TABLE triage_runs ALTER COLUMN installation_id DROP NOT NULL;
