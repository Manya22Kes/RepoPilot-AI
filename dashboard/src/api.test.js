import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, getToken, setToken, clearToken } from './api.js';

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('token storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(getToken()).toBeNull();
  });

  it('round-trips a token through set/get', () => {
    setToken('abc.def.ghi');
    expect(getToken()).toBe('abc.def.ghi');
  });

  it('clears a stored token', () => {
    setToken('abc.def.ghi');
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe('api request wrapper', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
  });

  it('does not send an Authorization header when no token is stored', async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true }));

    await api.listRepos();

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('sends a Bearer Authorization header when a token is stored', async () => {
    setToken('my-token');
    global.fetch.mockResolvedValue(fakeResponse({ repos: [] }));

    await api.listRepos();

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/repos');
    expect(options.headers.Authorization).toBe('Bearer my-token');
  });

  it('throws with the server error message on a non-ok response', async () => {
    global.fetch.mockResolvedValue(fakeResponse({ error: 'Invalid password' }, 400));
    await expect(api.getCostSummary()).rejects.toThrow('Invalid password');
  });

  it('builds query params correctly for listRuns', async () => {
    global.fetch.mockResolvedValue(fakeResponse({ runs: [], total: 0 }));

    await api.listRuns({ repo: 'acme/widgets', status: 'failed', limit: 10, offset: 20 });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/runs?repo=acme%2Fwidgets&status=failed&limit=10&offset=20');
  });

  it('clears the token on a 401 response', async () => {
    setToken('stale-token');
    global.fetch.mockResolvedValue(fakeResponse({}, 401));

    // jsdom doesn't implement real navigation, so window.location.href
    // assignment logs a virtual-console error rather than throwing —
    // irrelevant to what this test verifies (the token gets cleared).
    await api.listRepos().catch(() => {});

    expect(getToken()).toBeNull();
  });

  it('login posts the password and returns the parsed body', async () => {
    global.fetch.mockResolvedValue(fakeResponse({ token: 'new-token', expiresIn: '12h' }));

    const result = await api.login('secret');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(options.body)).toEqual({ password: 'secret' });
    expect(result).toEqual({ token: 'new-token', expiresIn: '12h' });
  });
});
