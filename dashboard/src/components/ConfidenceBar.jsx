export default function ConfidenceBar({ value, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--text-tertiary)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right' }}>
        {pct}%
      </span>
      {label && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>}
    </div>
  );
}
