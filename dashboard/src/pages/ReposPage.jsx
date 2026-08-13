import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TOGGLES = [
  { key: 'triageEnabled', label: 'Triage' },
  { key: 'prSummaryEnabled', label: 'PR summaries' },
  { key: 'stalePrScanEnabled', label: 'Stale-PR scan' },
  { key: 'docsSyncEnabled', label: 'Docs-sync' },
  { key: 'releaseNotesEnabled', label: 'Release notes' },
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        border: 'none',
        padding: 2,
        background: checked ? 'var(--accent)' : 'var(--border-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background-color 0.15s ease',
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
    </button>
  );
}

export default function ReposPage() {
  const [repos, setRepos] = useState(null);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    api
      .listRepos()
      .then((data) => setRepos(data.repos))
      .catch((err) => setError(err.message));
  }, []);

  async function handleToggle(repo, toggleKey, value) {
    const savingId = `${repo.repoFullName}:${toggleKey}`;
    setSavingKey(savingId);
    const [owner, name] = repo.repoFullName.split('/');

    try {
      const { settings } = await api.updateRepoSettings(owner, name, repo.installationId, {
        [toggleKey]: value,
      });
      setRepos((prev) =>
        prev.map((r) => (r.repoFullName === repo.repoFullName ? { ...r, settings } : r))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Repos</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', fontSize: 13.5 }}>
        Installed repositories and which features are active for each.
      </p>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Repository</th>
                {TOGGLES.map((t) => (
                  <th key={t.key}>{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repos === null && (
                <tr>
                  <td colSpan={TOGGLES.length + 1} style={{ color: 'var(--text-tertiary)' }}>
                    Loading…
                  </td>
                </tr>
              )}
              {repos?.length === 0 && (
                <tr>
                  <td colSpan={TOGGLES.length + 1} style={{ color: 'var(--text-tertiary)' }}>
                    No repos found. Install the GitHub App on a repository to see it here.
                  </td>
                </tr>
              )}
              {repos?.map((repo) => (
                <tr key={repo.repoFullName}>
                  <td className="mono">{repo.repoFullName}</td>
                  {TOGGLES.map((t) => (
                    <td key={t.key}>
                      <Toggle
                        checked={repo.settings[t.key]}
                        disabled={savingKey === `${repo.repoFullName}:${t.key}`}
                        onChange={(value) => handleToggle(repo, t.key, value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
