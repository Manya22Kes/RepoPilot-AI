-- Phase 3: embedding-based duplicate detection.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS issue_embeddings (
  id BIGSERIAL PRIMARY KEY,
  repo_full_name TEXT NOT NULL,
  issue_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  -- Every vector is tagged with the model that produced it. Similarity
  -- search always filters on this column too — see
  -- src/embeddings/EmbeddingClient.js for why comparing vectors across
  -- different embedding models would be meaningless, not just imprecise.
  embedding_model TEXT NOT NULL,
  -- 768 = Gemini's text-embedding-004 (the default configured provider).
  -- Switching to a model with a different dimensionality requires a new
  -- migration to alter this column — a deliberate, explicit step, not
  -- something the app tries to paper over at runtime.
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_full_name, issue_number, embedding_model)
);

-- Narrows the candidate set before the vector distance operator does its
-- (exact, not approximate) nearest-neighbor scan. Deliberately no
-- ivfflat/hnsw index for now: those need a meaningful amount of data
-- before they're worth the tuning/rebuild overhead, and a single repo's
-- issue count is typically small enough that an exact scan over the
-- pre-filtered rows is plenty fast. Revisit if a repo's issue volume ever
-- makes that untrue (see PROJECT_BRIEF.md Section 7).
CREATE INDEX IF NOT EXISTS idx_issue_embeddings_repo_model
  ON issue_embeddings (repo_full_name, embedding_model);
