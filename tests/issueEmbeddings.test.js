const { upsertIssueEmbedding, findSimilarIssues } = require('../src/db/issueEmbeddings');
const pool = require('../src/db/pool');

const TEST_REPO = 'test/issue-embeddings-integration';
const MODEL = 'text-embedding-004';
const DIM = 768;

function unitVector(activeIndex) {
  const v = new Array(DIM).fill(0);
  v[activeIndex] = 1;
  return v;
}

function nearParallel(activeIndex, noise) {
  const v = unitVector(activeIndex);
  v[(activeIndex + 1) % DIM] = noise;
  return v;
}

describe('issue_embeddings (integration, real Postgres + pgvector)', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM issue_embeddings WHERE repo_full_name = $1', [TEST_REPO]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('orders results by cosine distance: exact match, then near match, then unrelated', async () => {
    await upsertIssueEmbedding({
      repoFullName: TEST_REPO,
      issueNumber: 1,
      title: 'Nearly identical issue',
      embedding: nearParallel(0, 0.05),
      model: MODEL,
    });
    await upsertIssueEmbedding({
      repoFullName: TEST_REPO,
      issueNumber: 2,
      title: 'Completely unrelated issue',
      embedding: unitVector(500),
      model: MODEL,
    });
    await upsertIssueEmbedding({
      repoFullName: TEST_REPO,
      issueNumber: 3,
      title: 'Exact duplicate',
      embedding: unitVector(0),
      model: MODEL,
    });

    const results = await findSimilarIssues({
      repoFullName: TEST_REPO,
      embeddingModel: MODEL,
      embedding: unitVector(0),
      excludeIssueNumber: 999,
      limit: 5,
    });

    expect(results.map((r) => r.issueNumber)).toEqual([3, 1, 2]);
    expect(results[0].distance).toBeCloseTo(0, 5);
    expect(results[1].distance).toBeGreaterThan(0);
    expect(results[2].distance).toBeCloseTo(1, 5);
  });

  it('excludes the given issue number from results even if it has a stored embedding', async () => {
    await upsertIssueEmbedding({
      repoFullName: TEST_REPO,
      issueNumber: 42,
      title: 'Self',
      embedding: unitVector(0),
      model: MODEL,
    });

    const results = await findSimilarIssues({
      repoFullName: TEST_REPO,
      embeddingModel: MODEL,
      embedding: unitVector(0),
      excludeIssueNumber: 42,
      limit: 5,
    });

    expect(results.some((r) => r.issueNumber === 42)).toBe(false);
  });

  it('does not compare across different embedding models', async () => {
    await upsertIssueEmbedding({
      repoFullName: TEST_REPO,
      issueNumber: 1,
      title: 'Under model A',
      embedding: unitVector(0),
      model: 'model-a',
    });

    const results = await findSimilarIssues({
      repoFullName: TEST_REPO,
      embeddingModel: 'model-b', // different model — should not match issue 1
      embedding: unitVector(0),
      excludeIssueNumber: 999,
      limit: 5,
    });

    expect(results).toEqual([]);
  });

  it('upsert replaces the embedding for the same (repo, issue, model) instead of duplicating', async () => {
    await upsertIssueEmbedding({
      repoFullName: TEST_REPO,
      issueNumber: 7,
      title: 'Original title',
      embedding: unitVector(0),
      model: MODEL,
    });
    await upsertIssueEmbedding({
      repoFullName: TEST_REPO,
      issueNumber: 7,
      title: 'Updated title',
      embedding: unitVector(600), // now points somewhere completely different
      model: MODEL,
    });

    const { rows } = await pool.query(
      'SELECT title FROM issue_embeddings WHERE repo_full_name = $1 AND issue_number = 7 AND embedding_model = $2',
      [TEST_REPO, MODEL]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Updated title');
  });
});
