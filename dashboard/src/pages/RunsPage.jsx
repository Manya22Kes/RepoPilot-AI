import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

const PAGE_SIZE = 25;

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

export default function RunsPage() {
  const [runs, setRuns] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [repoFilter, setRepoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setRuns(null);
    api
      .listRuns({
        repo: repoFilter || undefined,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((data) => {
        setRuns(data.runs);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  }, [repoFilter, statusFilter, searchTerm, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Runs</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px', fontSize: 13.5 }}>
        Every triage run, most recent first.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Filter by repo (owner/name)"
          value={repoFilter}
          onChange={(e) => {
            setPage(0);
            setRepoFilter(e.target.value);
          }}
          style={{ maxWidth: 280 }}
        />
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => {
            setPage(0);
            setStatusFilter(e.target.value);
          }}
          style={{ maxWidth: 180 }}
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
        <input
          className="input"
          placeholder="Search by run ID or delivery ID"
          value={searchTerm}
          onChange={(e) => {
            setPage(0);
            setSearchTerm(e.target.value);
          }}
          style={{ maxWidth: 260 }}
        />
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Repo</th>
                <th>Event</th>
                <th>Status</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {runs === null && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-tertiary)' }}>
                    Loading…
                  </td>
                </tr>
              )}
              {runs?.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-tertiary)' }}>
                    No runs match these filters.
                  </td>
                </tr>
              )}
              {runs?.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => navigate(`/runs/${run.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono" style={{ color: 'var(--accent)' }}>
                    #{run.id}
                  </td>
                  <td className="mono">{run.repo_full_name || '—'}</td>
                  <td>
                    {run.event_name}
                    {run.event_action ? ` · ${run.event_action}` : ''}
                  </td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{formatTime(run.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 13 }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {total} run{total === 1 ? '' : 's'} · page {page + 1} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button className="btn" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
