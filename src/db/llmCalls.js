const pool = require('./pool');

async function recordLlmCall({
  triageRunId,
  purpose,
  provider,
  model,
  promptTokens,
  completionTokens,
  estimatedCostUsd,
}) {
  await pool.query(
    `INSERT INTO llm_calls
       (triage_run_id, purpose, provider, model, prompt_tokens, completion_tokens, estimated_cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [triageRunId, purpose, provider, model, promptTokens ?? null, completionTokens ?? null, estimatedCostUsd ?? null]
  );
}

async function listLlmCallsForRun(triageRunId) {
  const { rows } = await pool.query('SELECT * FROM llm_calls WHERE triage_run_id = $1 ORDER BY id', [
    triageRunId,
  ]);
  return rows;
}

async function getCostSummary({ days = 30 } = {}) {
  const [totalResult, byPurposeResult, byProviderResult, byDayResult, callCountResult] = await Promise.all([
    pool.query(`SELECT sum(estimated_cost_usd) AS total FROM llm_calls WHERE created_at > now() - ($1 || ' days')::interval`, [days]),
    pool.query(
      `SELECT purpose, sum(estimated_cost_usd) AS cost, count(*) AS calls
       FROM llm_calls WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY purpose ORDER BY cost DESC NULLS LAST`,
      [days]
    ),
    pool.query(
      `SELECT provider, sum(estimated_cost_usd) AS cost, count(*) AS calls
       FROM llm_calls WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY provider ORDER BY cost DESC NULLS LAST`,
      [days]
    ),
    pool.query(
      `SELECT date_trunc('day', created_at) AS day, sum(estimated_cost_usd) AS cost
       FROM llm_calls WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY day ORDER BY day`,
      [days]
    ),
    pool.query(`SELECT count(*) FROM llm_calls WHERE created_at > now() - ($1 || ' days')::interval`, [days]),
  ]);

  return {
    totalCostUsd: totalResult.rows[0].total !== null ? Number(totalResult.rows[0].total) : null,
    totalCalls: Number(callCountResult.rows[0].count),
    byPurpose: byPurposeResult.rows.map((row) => ({
      purpose: row.purpose,
      costUsd: row.cost !== null ? Number(row.cost) : null,
      calls: Number(row.calls),
    })),
    byProvider: byProviderResult.rows.map((row) => ({
      provider: row.provider,
      costUsd: row.cost !== null ? Number(row.cost) : null,
      calls: Number(row.calls),
    })),
    byDay: byDayResult.rows.map((row) => ({
      day: row.day,
      costUsd: row.cost !== null ? Number(row.cost) : null,
    })),
  };
}

module.exports = { recordLlmCall, listLlmCallsForRun, getCostSummary };
