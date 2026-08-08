import { useEffect, useState } from 'react';
import { api } from '../api.js';

function formatUsd(value) {
  if (value === null || value === undefined) return '—';
  return `$${value.toFixed(value < 0.01 ? 6 : 2)}`;
}

function BreakdownBar({ label, costUsd, calls, maxCost }) {
  const pct = maxCost > 0 ? Math.max(2, (costUsd / maxCost) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span className="mono" style={{ color: 'var(--text-secondary)' }}>
          {formatUsd(costUsd)} · {calls} call{calls === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
      </div>
    </div>
  );
}

export default function CostsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setSummary(null);
    api
      .getCostSummary(days)
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, [days]);

  const maxPurposeCost = summary ? Math.max(0, ...summary.byPurpose.map((p) => p.costUsd || 0)) : 0;
  const maxProviderCost = summary ? Math.max(0, ...summary.byProvider.map((p) => p.costUsd || 0)) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Costs</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13.5 }}>
            Estimated LLM spend — approximate; see the pricing table for what's tracked.
          </p>
        </div>
        <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 140 }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error && <div style={{ color: 'var(--danger)', margin: '16px 0' }}>{error}</div>}
      {!summary && !error && <div style={{ color: 'var(--text-tertiary)', marginTop: 20 }}>Loading…</div>}

      {summary && (
        <>
          <div style={{ display: 'flex', gap: 16, margin: '24px 0' }}>
            <div className="card" style={{ padding: 20, flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total estimated cost
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{formatUsd(summary.totalCostUsd)}</div>
            </div>
            <div className="card" style={{ padding: 20, flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total LLM calls
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{summary.totalCalls}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div className="card" style={{ padding: 20, flex: 1 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>By purpose</h2>
              {summary.byPurpose.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No calls in this window.</p>
              ) : (
                summary.byPurpose.map((p) => (
                  <BreakdownBar key={p.purpose} label={p.purpose} costUsd={p.costUsd || 0} calls={p.calls} maxCost={maxPurposeCost} />
                ))
              )}
            </div>

            <div className="card" style={{ padding: 20, flex: 1 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>By provider</h2>
              {summary.byProvider.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No calls in this window.</p>
              ) : (
                summary.byProvider.map((p) => (
                  <BreakdownBar key={p.provider} label={p.provider} costUsd={p.costUsd || 0} calls={p.calls} maxCost={maxProviderCost} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
