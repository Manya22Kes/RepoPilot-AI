const VARIANTS = {
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', label: 'Success' },
  running: { bg: 'var(--accent-soft)', fg: 'var(--accent)', label: 'Running' },
  failed: { bg: 'var(--danger-soft)', fg: 'var(--danger)', label: 'Failed' },
  pending_approval: { bg: 'var(--warning-soft)', fg: 'var(--warning)', label: 'Pending approval' },
  approved: { bg: 'var(--success-soft)', fg: 'var(--success)', label: 'Approved' },
  rejected: { bg: 'var(--border)', fg: 'var(--text-secondary)', label: 'Rejected' },
};

export default function StatusBadge({ status }) {
  const variant = VARIANTS[status] || { bg: 'var(--border)', fg: 'var(--text-secondary)', label: status };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: variant.bg,
        color: variant.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {variant.label}
    </span>
  );
}
