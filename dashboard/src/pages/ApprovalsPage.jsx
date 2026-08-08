import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ConfidenceBar from '../components/ConfidenceBar.jsx';

const ACTION_LABELS = {
  close_as_duplicate: 'Close as duplicate',
  docs_update_suggestion: 'Docs update suggestion',
};

export default function ApprovalsPage() {
  const [actions, setActions] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setActions(null);
    api
      .listPendingActions()
      .then((data) => setActions(data.actions))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleDecision(id, decision) {
    setBusyId(id);
    setError(null);
    try {
      if (decision === 'approve') {
        await api.approvePendingAction(id);
      } else {
        await api.rejectPendingAction(id);
      }
      setActions((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Approvals</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', fontSize: 13.5 }}>
        Higher-consequence actions the bot flagged but never applies automatically — review and decide.
      </p>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      {actions === null && <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}

      {actions?.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          Nothing waiting on you right now.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {actions?.map((action) => (
          <div key={action.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {ACTION_LABELS[action.action_type] || action.action_type}
                </div>
                <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {action.repo_full_name} · issue #{action.issue_number}
                </div>

                {action.payload?.reasoning && (
                  <p style={{ fontSize: 13, margin: '10px 0 0', color: 'var(--text-primary)' }}>
                    {action.payload.reasoning}
                  </p>
                )}

                {typeof action.payload?.confidence === 'number' && (
                  <div style={{ marginTop: 10 }}>
                    <ConfidenceBar value={action.payload.confidence} label="AI confidence" />
                  </div>
                )}

                {action.payload?.matchedIssueNumber && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                    Matched issue: #{action.payload.matchedIssueNumber}
                  </div>
                )}

                {Array.isArray(action.payload?.suggestedUpdates) && action.payload.suggestedUpdates.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {action.payload.suggestedUpdates.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-danger"
                  disabled={busyId === action.id}
                  onClick={() => handleDecision(action.id, 'reject')}
                >
                  Reject
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busyId === action.id}
                  onClick={() => handleDecision(action.id, 'approve')}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
