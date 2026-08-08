import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login.jsx';
import { getToken, clearToken } from '../api.js';

describe('Login page', () => {
  beforeEach(() => {
    clearToken();
    global.fetch = vi.fn();
  });

  it('renders a password field and a sign-in button', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/admin password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('stores the token and shows no error on a successful login', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'a-real-looking-token', expiresIn: '12h' }),
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/admin password/i), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(getToken()).toBe('a-real-looking-token'));
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });

  it('shows an error message and does not store a token on failed login', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid password' }),
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/admin password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid password/i)).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });
});
