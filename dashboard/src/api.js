const TOKEN_KEY = 'repopilot_dashboard_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const token = getToken();

  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && token) {
    clearToken();
    window.location.href = '/dashboard/login';
    throw new ApiError('Session expired', 401);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(body.error || `Request failed (HTTP ${response.status})`, response.status);
  }

  return body;
}

export const api = {
  login: (password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),

  listRepos: () => request('/repos'),
  getRepoSettings: (owner, repo) => request(`/repos/${owner}/${repo}/settings`),
  updateRepoSettings: (owner, repo, installationId, updates) =>
    request(`/repos/${owner}/${repo}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ installationId, ...updates }),
    }),

  listRuns: ({ repo, status, limit = 50, offset = 0 } = {}) => {
    const params = new URLSearchParams();
    if (repo) params.set('repo', repo);
    if (status) params.set('status', status);
    params.set('limit', limit);
    params.set('offset', offset);
    return request(`/runs?${params.toString()}`);
  },
  getRun: (id) => request(`/runs/${id}`),

  listPendingActions: (status = 'pending_approval') => request(`/pending-actions?status=${status}`),
  approvePendingAction: (id) => request(`/pending-actions/${id}/approve`, { method: 'POST' }),
  rejectPendingAction: (id) => request(`/pending-actions/${id}/reject`, { method: 'POST' }),

  getCostSummary: (days = 30) => request(`/costs/summary?days=${days}`),
};

export { ApiError };
