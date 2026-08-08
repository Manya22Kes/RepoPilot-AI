-- Phase 5: durable record of jobs that exhausted all retry attempts.
-- BullMQ's own Redis-side failed-job storage has a TTL
-- (removeOnFail.age in queue/triageQueue.js) — this table is the actual
-- permanent, queryable record referenced by the "dead-letter queue"
-- requirement, independent of Redis retention.
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id BIGSERIAL PRIMARY KEY,
  queue_name TEXT NOT NULL,
  job_name TEXT NOT NULL,
  job_id TEXT NOT NULL,
  data JSONB,
  failed_reason TEXT,
  attempts_made INTEGER,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_jobs_job_name ON dead_letter_jobs (job_name);
CREATE INDEX IF NOT EXISTS idx_dead_letter_jobs_job_id ON dead_letter_jobs (job_id);
