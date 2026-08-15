import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setCurrentUser } from '../api.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      setCurrentUser(user);
      navigate('/repos');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <form onSubmit={handleSubmit} className="card page-enter" style={{ padding: 32, width: 340 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>RepoPilot AI</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Sign in to the ops dashboard</div>
        </div>

        <label htmlFor="email" style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          style={{ marginBottom: 14 }}
        />

        <label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Password
        </label>
        <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
