import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TOGGLES = [
  { key: 'triageEnabled', label: 'Triage' },
  { key: 'prSummaryEnabled', label: 'PR summaries' },
  { key: 'stalePrScanEnabled', label: 'Stale-PR scan' },
  { key: 'docsSyncEnabled', label: 'Docs-sync' },
  { key: 'releaseNotesEnabled', label: 'Release notes' },
];

function LabelsCell({ repo, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((repo.settings.customLabels || []).join(', '));
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 12.5,
            color: repo.settings.customLabels ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          {repo.settings.customLabels ? repo.settings.customLabels.join(', ') : 'Default (bug, feature, docs, question)'}
        </span>
        <button className="btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    const labels = value.split(',').map((s) => s.trim()).filter(Boolean);
    await onSave(labels.length > 0 ? labels : null);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        className="input"
        style={{ fontSize: 12.5, padding: '4px 8px', width: 220 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. bug, feature, security"
      />
      <button className="btn btn-primary" style={{ padding: '3px 9px', fontSize: 12 }} disabled={saving} onClick={handleSave}>
        Save
      </button>
      <button className="btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => setEditing(false)} disabled={saving}>
        Cancel
      </button>
    </div>
  );
}

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

  async function handleLabelsChange(repo, customLabels) {
    const [owner, name] = repo.repoFullName.split('/');
    try {
      const { settings } = await api.updateRepoSettings(owner, name, repo.installationId, { customLabels });
      setRepos((prev) => prev.map((r) => (r.repoFullName === repo.repoFullName ? { ...r, settings } : r)));
    } catch (err) {
      setError(err.message);
    }
  }

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
                <th>Labels</th>
                {TOGGLES.map((t) => (
                  <th key={t.key}>{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repos === null && (
                <tr>
                  <td colSpan={TOGGLES.length + 2} style={{ color: 'var(--text-tertiary)' }}>
                    Loading…
                  </td>
                </tr>
              )}
              {repos?.length === 0 && (
                <tr>
                  <td colSpan={TOGGLES.length + 2} style={{ color: 'var(--text-tertiary)' }}>
                    No repos found. Install the GitHub App on a repository to see it here.
                  </td>
                </tr>
              )}
              {repos?.map((repo) => (
                <tr key={repo.repoFullName}>
                  <td className="mono">{repo.repoFullName}</td>
                  <td>
                    <LabelsCell repo={repo} onSave={(labels) => handleLabelsChange(repo, labels)} />
                  </td>
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
