const { upsertIssueEmbedding, findSimilarIssues } = require('../db/issueEmbeddings');

const DEFAULT_CANDIDATE_LIMIT = 5;

const CANDIDATE_DISTANCE_THRESHOLD = 0.3;

async function findEmbeddingDuplicateCandidates({
  embeddingClient,
  repoFullName,
  issueNumber,
  title,
  body,
  limit = DEFAULT_CANDIDATE_LIMIT,
  distanceThreshold = CANDIDATE_DISTANCE_THRESHOLD,
}) {
  const { embedding, model } = await embeddingClient.embed(`${title}\n${body || ''}`);

  await upsertIssueEmbedding({ repoFullName, issueNumber, title, embedding, model });

  const candidates = await findSimilarIssues({
    repoFullName,
    embeddingModel: model,
    embedding,
    excludeIssueNumber: issueNumber,
    limit,
  });

  return candidates.filter((c) => c.distance <= distanceThreshold);
}

module.exports = { findEmbeddingDuplicateCandidates, DEFAULT_CANDIDATE_LIMIT, CANDIDATE_DISTANCE_THRESHOLD };
