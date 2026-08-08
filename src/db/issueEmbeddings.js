const pool = require('./pool');

function toVectorLiteral(embedding) {
  return `[${embedding.join(',')}]`;
}

async function upsertIssueEmbedding({ repoFullName, issueNumber, title, embedding, model }) {
  await pool.query(
    `INSERT INTO issue_embeddings (repo_full_name, issue_number, title, embedding_model, embedding)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (repo_full_name, issue_number, embedding_model)
     DO UPDATE SET title = EXCLUDED.title, embedding = EXCLUDED.embedding, created_at = now()`,
    [repoFullName, issueNumber, title, model, toVectorLiteral(embedding)]
  );
}

async function findSimilarIssues({ repoFullName, embeddingModel, embedding, excludeIssueNumber, limit = 5 }) {
  const { rows } = await pool.query(
    `SELECT issue_number, title, embedding <=> $1 AS distance
     FROM issue_embeddings
     WHERE repo_full_name = $2
       AND embedding_model = $3
       AND issue_number != $4
     ORDER BY embedding <=> $1
     LIMIT $5`,
    [toVectorLiteral(embedding), repoFullName, embeddingModel, excludeIssueNumber, limit]
  );

  return rows.map((row) => ({
    issueNumber: row.issue_number,
    title: row.title,
    distance: Number(row.distance),
  }));
}

module.exports = { upsertIssueEmbedding, findSimilarIssues, toVectorLiteral };
