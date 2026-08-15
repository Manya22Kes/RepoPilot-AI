import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDateTime } from '../utils/formatDate.js';

function formatUsd(value) {
  return value !== null && value !== undefined ? `$${Number(value).toFixed(4)}` : '—';
}

export default function DigestsPage() {
  const [digests, setDigests] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listDigests().then((data) => setDigests(data.digests)).catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Digests</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', fontSize: 13.5 }}>
        A saved snapshot every time the weekly digest ran.
      </p>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {digests === null && !error && <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}

      {digests?.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          No digests have run yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {digests?.map((d) => (
          <div key={d.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{formatDateTime(d.sent_at)}</div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {d.posted_to_slack ? 'Sent to Slack' : 'Logged only'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, rowGap: 12, marginTop: 10, fontSize: 13 }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>Runs</div>
                <div>{d.run_stats.total} ({d.run_stats.success} ok, {d.run_stats.failed} failed)</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>Cost</div>
                <div>{formatUsd(d.costs.totalCostUsd)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>Pending approvals</div>
                <div>{d.pending_approvals}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>Dead letters</div>
                <div>{d.dead_letters}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
