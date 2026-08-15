import { useEffect, useState } from 'react';
import { api, getCurrentUser } from '../api.js';

export default function UsersPage() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [creating, setCreating] = useState(false);
  const currentUser = getCurrentUser();

  function load() {
    setUsers(null);
    api.listUsers().then((data) => setUsers(data.users)).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.createUser(email, password, role);
      setEmail('');
      setPassword('');
      setRole('member');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    setError(null);
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Users</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', fontSize: 13.5 }}>
        Who can sign into this dashboard.
      </p>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Add a user</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: 220 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: 180 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 120 }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Adding…' : 'Add user'}
          </button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users === null && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--text-tertiary)' }}>Loading…</td>
              </tr>
            )}
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.email}</td>
                <td>{u.role}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  {u.id !== currentUser?.id && (
                    <button className="btn btn-danger" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => handleDelete(u.id)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
