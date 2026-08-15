export function LogoBadge({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <clipPath id="badgeClip">
          <rect x="6" y="6" width="88" height="88" rx="22" />
        </clipPath>
        <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#3b4856" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Flat two-tone split, no gradient — hard diagonal edge for a sharper read */}
      <rect x="6" y="6" width="88" height="88" rx="22" fill="#5e94c2" filter="url(#badgeShadow)" />
      <polygon points="94,6 94,94 6,94" fill="#864a65" clipPath="url(#badgeClip)" />
    </svg>
  );
}

export function PlaneMark({ size = 40, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      {/* paper airplane, ascending — top facet (lit) */}
      <path d="M 88 18 L 10 50 L 45 59 Z" fill="#ffffff" />
      {/* underside facet (shaded, gives it a folded/3D read) */}
      <path d="M 45 59 L 10 50 L 33 82 Z" fill="#bd7c98" />
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
