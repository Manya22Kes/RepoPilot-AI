import { useState } from 'react';
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { clearToken, getCurrentUser } from '../api.js';
import Logo from './Logo.jsx';

const BASE_NAV_ITEMS = [
  { to: '/repos', label: 'Repos' },
  { to: '/runs', label: 'Runs' },
  { to: '/approvals', label: 'Approvals' },
  { to: '/costs', label: 'Costs' },
  { to: '/digests', label: 'Digests' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentUser = getCurrentUser();
  const navItems = currentUser?.role === 'admin' ? [...BASE_NAV_ITEMS, { to: '/users', label: 'Users' }] : BASE_NAV_ITEMS;

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside
        className={`sidebar${menuOpen ? ' open' : ''}`}
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
        <div style={{ padding: '0 8px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={26} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>RepoPilot AI</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ops dashboard</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13.5,
                fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                textDecoration: 'none',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <button className="btn" onClick={handleLogout} style={{ fontSize: 13, alignSelf: 'flex-start' }}>
          Log out
        </button>
      </aside>

      <main style={{ flex: 1, padding: '32px 40px', minWidth: 0 }}>
        <button
          className="btn mobile-menu-btn"
          onClick={() => setMenuOpen(true)}
          style={{ marginBottom: 16 }}
          aria-label="Open menu"
        >
          ☰ Menu
        </button>

        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
