import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { clearToken } from '../api.js';

const NAV_ITEMS = [
  { to: '/repos', label: 'Repos' },
  { to: '/runs', label: 'Runs' },
  { to: '/approvals', label: 'Approvals' },
  { to: '/costs', label: 'Costs' },
];

export default function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 8px', marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>RepoPilot AI</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Ops dashboard</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13.5,
                fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                textDecoration: 'none',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <button className="btn" onClick={handleLogout} style={{ fontSize: 13 }}>
          Log out
        </button>
      </aside>

      <main style={{ flex: 1, padding: '32px 40px', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
