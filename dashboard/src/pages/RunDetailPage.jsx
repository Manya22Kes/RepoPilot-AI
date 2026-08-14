import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import CopyButton from '../components/CopyButton.jsx';

export default function RunDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api
      .getRun(id)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>;
  if (!data) return <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>;

  const { run, llmCalls, pendingActions } = data;
  const totalCost = llmCalls.reduce((sum, c) => sum + (c.estimated_cost_usd ? Number(c.estimated_cost_usd) : 0), 0);

  return (
    <div>
      <Link to="/runs" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
        ← All runs
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Run #{run.id}</h1>
        <CopyButton value={String(run.id)} label="Copy ID" />
        <StatusBadge status={run.status} />
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 10, margin: 0, fontSize: 13.5 }}>
          <dt style={{ color: 'var(--text-secondary)' }}>Repo</dt>
          <dd className="mono" style={{ margin: 0 }}>{run.repo_full_name || '—'}</dd>

          <dt style={{ color: 'var(--text-secondary)' }}>Event</dt>
          <dd style={{ margin: 0 }}>
            {run.event_name}
            {run.event_action ? ` · ${run.event_action}` : ''}
            {run.subject_number ? ` · #${run.subject_number}` : ''}
          </dd>

          <dt style={{ color: 'var(--text-secondary)' }}>Delivery ID</dt>
          <dd className="mono" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {run.delivery_id || '—'}
            {run.delivery_id && <CopyButton value={run.delivery_id} />}
          </dd>

          <dt style={{ color: 'var(--text-secondary)' }}>Started</dt>
          <dd style={{ margin: 0 }}>{new Date(run.started_at).toLocaleString()}</dd>

          <dt style={{ color: 'var(--text-secondary)' }}>Finished</dt>
          <dd style={{ margin: 0 }}>{run.finished_at ? new Date(run.finished_at).toLocaleString() : '—'}</dd>

          {run.error && (
            <>
              <dt style={{ color: 'var(--text-secondary)' }}>Error</dt>
              <dd style={{ margin: 0, color: 'var(--danger)' }}>{run.error}</dd>
            </>
          )}
        </dl>
      </div>

      {run.result && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Result</h2>
          <pre className="mono" style={{ margin: 0, fontSize: 12.5, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
            {JSON.stringify(run.result, null, 2)}
          </pre>
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
          LLM calls {llmCalls.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({llmCalls.length}, ${totalCost.toFixed(6)} total)</span>}
        </h2>
        {llmCalls.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: 13 }}>No LLM calls recorded for this run.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Provider / model</th>
                <th>Tokens</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {llmCalls.map((call) => (
                <tr key={call.id}>
                  <td>{call.purpose}</td>
                  <td className="mono">{call.provider} / {call.model}</td>
                  <td className="mono">
                    {call.prompt_tokens ?? '—'} / {call.completion_tokens ?? '—'}
                  </td>
                  <td className="mono">{call.estimated_cost_usd !== null ? `$${Number(call.estimated_cost_usd).toFixed(6)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Pending actions</h2>
        {pendingActions.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: 13 }}>None recorded for this run.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {pendingActions.map((action) => (
                <tr key={action.id}>
                  <td>{action.action_type}</td>
                  <td>
                    <StatusBadge status={action.status} />
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {JSON.stringify(action.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
