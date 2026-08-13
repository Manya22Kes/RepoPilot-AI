import { useEffect, useState } from 'react';
import { LogoBadge, PlaneMark } from './Logo.jsx';

export default function SplashScreen({ onComplete }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), 1700);
    const doneTimer = setTimeout(onComplete, 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div className={`splash${fadingOut ? ' splash-out' : ''}`}>
      <div className="splash-glow" />
      <div className="splash-badge">
        <LogoBadge size={64} />
        <PlaneMark size={64} className="plane-fly" />
      </div>
      <div className="splash-title">RepoPilot AI</div>
    </div>
  );
}
