export function LogoBadge({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5fb0f0" />
          <stop offset="100%" stopColor="#d1548f" />
        </linearGradient>
        <radialGradient id="gloss" cx="32%" cy="18%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#3b4856" floodOpacity="0.35" />
        </filter>
      </defs>

      <rect x="6" y="6" width="88" height="88" rx="22" fill="url(#badgeGradient)" filter="url(#badgeShadow)" />
      <rect x="6" y="6" width="88" height="88" rx="22" fill="url(#gloss)" />
    </svg>
  );
}

export function PlaneMark({ size = 40, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      {/* paper airplane, ascending — top facet (lit) */}
      <path d="M 85 22 L 15 50 L 46 58 Z" fill="#ffffff" />
      {/* underside facet (shaded, gives it a folded/3D read) */}
      <path d="M 46 58 L 15 50 L 36 78 Z" fill="#ff9fc7" />
    </svg>
  );
}

export default function Logo({ size = 40 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, lineHeight: 0 }}>
      <LogoBadge size={size} />
      <div style={{ position: 'absolute', inset: 0 }}>
        <PlaneMark size={size} />
      </div>
    </div>
  );
}
