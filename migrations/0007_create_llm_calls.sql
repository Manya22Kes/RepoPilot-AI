-- Phase 5: per-call LLM token usage and estimated cost, tied back to the
-- triage run that made the call. Populated by src/llm/costTracking.js's
-- wrapper around LLMClient/EmbeddingClient — not by the clients
-- themselves, which stay decoupled from persistence concerns.
CREATE TABLE IF NOT EXISTS llm_calls (
  id BIGSERIAL PRIMARY KEY,
  triage_run_id BIGINT REFERENCES triage_runs (id),
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  -- NULL when the model isn't in the (necessarily approximate, needs
  -- periodic manual updates) pricing table in src/llm/pricing.js, rather
  -- than a guessed number.
  estimated_cost_usd NUMERIC(12, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_triage_run ON llm_calls (triage_run_id);
CREATE INDEX IF NOT EXISTS idx_llm_calls_purpose ON llm_calls (purpose);
