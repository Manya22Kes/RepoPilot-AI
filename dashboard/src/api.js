const TOKEN_KEY = 'repopilot_dashboard_token';
const USER_KEY = 'repopilot_dashboard_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setCurrentUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  listUsers: () => request('/users'),
  createUser: (email, password, role) =>
    request('/users', { method: 'POST', body: JSON.stringify({ email, password, role }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  listRepos: () => request('/repos'),
  getRepoSettings: (owner, repo) => request(`/repos/${owner}/${repo}/settings`),
  updateRepoSettings: (owner, repo, installationId, updates) =>
    request(`/repos/${owner}/${repo}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ installationId, ...updates }),
    }),

  listRuns: ({ repo, status, search, limit = 50, offset = 0 } = {}) => {
    const params = new URLSearchParams();
    if (repo) params.set('repo', repo);
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    params.set('limit', limit);
    params.set('offset', offset);
    return request(`/runs?${params.toString()}`);
  },
  getRun: (id) => request(`/runs/${id}`),
  deleteRun: (id) => request(`/runs/${id}`, { method: 'DELETE' }),

  listPendingActions: (status = 'pending_approval') => request(`/pending-actions?status=${status}`),
  approvePendingAction: (id) => request(`/pending-actions/${id}/approve`, { method: 'POST' }),
  rejectPendingAction: (id) => request(`/pending-actions/${id}/reject`, { method: 'POST' }),

  getCostSummary: (days = 30) => request(`/costs/summary?days=${days}`),
};

export { ApiError };
