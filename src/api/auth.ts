import type { AuthUser } from '../types';

const API_BASE = '/economy-api';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
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

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE}/me`, { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('无法连接主页账号服务');
  return ((await response.json()) as AuthResponse).user;
}

async function register(email: string, password: string): Promise<AuthUser> {
  const payload = await request<AuthResponse>('/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return payload.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  try {
    return await register(email, password);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 409) {
      throw error;
    }
  }

  const payload = await request<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return payload.user;
}

export async function logout(): Promise<void> {
  await request<{ message: string }>('/logout', { method: 'POST' });
}
