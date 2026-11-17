import type { AuthUser } from '@/lib/types';

/**
 * Small client for the Django REST API.
 *
 * In development Vite proxies /api to Django (see vite.config.ts), so the base
 * URL is empty. Set VITE_API_URL when the API is hosted on another origin.
 */
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'ria.authToken';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function readToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable: session lasts until reload */ }
  memoryToken = token;
}

let memoryToken: string | null = readToken();

/** Fired when the server rejects the token, so the app can return to the login page. */
export const UNAUTHORIZED_EVENT = 'ria:unauthorized';

/** Turn a DRF error body ({detail}, {field: [msg]}, or [msg]) into one readable message. */
function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  if ('detail' in body && typeof (body as { detail: unknown }).detail === 'string') {
    return (body as { detail: string }).detail;
  }
  const messages = Object.values(body as Record<string, unknown>)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is string => typeof v === 'string');
  return messages.length ? messages.join(' ') : fallback;
}

export async function apiRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (memoryToken) headers.Authorization = `Token ${memoryToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check that the backend is running.', 0);
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && memoryToken) {
      writeToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(errorMessage(body, `Request failed (${res.status})`), res.status);
  }
  return body as T;
}

interface AuthResponse { token: string; user: AuthUser }

export const auth = {
  hasToken: () => Boolean(memoryToken),

  async login(username: string, password: string): Promise<AuthUser> {
    const data = await apiRequest<AuthResponse>('/auth/login/', { method: 'POST', body: { username, password } });
    writeToken(data.token);
    return data.user;
  },

  async register(email: string, password: string): Promise<AuthUser> {
    const data = await apiRequest<AuthResponse>('/auth/register/', { method: 'POST', body: { email, password } });
    writeToken(data.token);
    return data.user;
  },

  async me(): Promise<AuthUser | null> {
    if (!memoryToken) return null;
    try {
      return await apiRequest<AuthUser>('/auth/me/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  async logout(): Promise<void> {
    try { await apiRequest('/auth/logout/', { method: 'POST' }); } catch { /* token may already be invalid */ }
    writeToken(null);
  },
};
