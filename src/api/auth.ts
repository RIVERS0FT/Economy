import type { AuthUser } from '../types';

const API_BASE = '/economy-api';
const HOMEPAGE_ACCOUNT_API_BASE = 'https://riversoft.top/api';

interface AuthResponse {
  user: AuthUser;
}

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = '请求失败';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // Keep the generic message when the upstream response is not JSON.
    }
    throw new ApiRequestError(response.status, message);
  }

  return response.json() as Promise<T>;
}

async function requestGameApi<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(API_BASE, path, init);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE}/me`, { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('无法连接主页账号服务');
  return ((await response.json()) as AuthResponse).user;
}

async function loginExisting(email: string, password: string): Promise<AuthUser> {
  const payload = await requestGameApi<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return payload.user;
}

async function registerAtHomepage(email: string, password: string): Promise<void> {
  await request<AuthResponse>(HOMEPAGE_ACCOUNT_API_BASE, '/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthUser> {
  try {
    return await loginExisting(email, password);
  } catch (loginError) {
    if (!(loginError instanceof ApiRequestError) || loginError.status !== 401) {
      throw loginError;
    }

    try {
      await registerAtHomepage(email, password);
    } catch (registerError) {
      if (registerError instanceof ApiRequestError && registerError.status === 409) {
        throw loginError;
      }
      throw registerError;
    }

    return loginExisting(email, password);
  }
}

export async function logout(): Promise<void> {
  await requestGameApi<{ message: string }>('/logout', { method: 'POST' });
}
