import type { AuthUser } from '../types';

const API_BASE = '/economy-api';

interface AuthResponse {
  user: AuthUser;
}

interface EmailCodeResponse {
  message: string;
  expiresAt: number;
  resendAfterSeconds: number;
}

export interface EconomySessionResponse {
  playerCreated: boolean;
  banned: boolean;
  incidentId?: number;
  invitationBound: boolean;
  invalidInvite: boolean;
}

class ApiRequestError extends Error {
  status: number;
  code?: string;
  incidentId?: number;

  constructor(status: number, message: string, details: { code?: string; incidentId?: number } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = details.code;
    this.incidentId = details.incidentId;
  }
}

function createIdempotencyKey(prefix: string) {
  const token = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${token}`;
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
    let code: string | undefined;
    let incidentId: number | undefined;
    try {
      const payload = (await response.json()) as { message?: string; code?: string; incidentId?: number };
      if (payload.message) message = payload.message;
      code = payload.code;
      incidentId = payload.incidentId;
    } catch {
      // Keep the generic message when the upstream response is not JSON.
    }
    throw new ApiRequestError(response.status, message, { code, incidentId });
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

export async function login(email: string, password: string): Promise<AuthUser> {
  const payload = await requestGameApi<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return payload.user;
}

export async function sendRegistrationEmailCode(email: string): Promise<EmailCodeResponse> {
  return requestGameApi<EmailCodeResponse>('/registration/email-code', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('registration-email') },
    body: JSON.stringify({ email }),
  });
}

export async function completeRegistration(
  email: string,
  password: string,
  code: string,
  inviteCode?: string,
): Promise<AuthUser> {
  const payload = await requestGameApi<AuthResponse>('/registration/complete', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('registration-complete') },
    body: JSON.stringify({ email, password, code, inviteCode }),
  });
  return payload.user;
}

export async function initializeEconomySession(inviteCode?: string): Promise<EconomySessionResponse> {
  return requestGameApi<EconomySessionResponse>('/game/session', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('economy-session') },
    body: JSON.stringify({ inviteCode }),
  });
}

export async function logout(): Promise<void> {
  await requestGameApi<{ message: string }>('/logout', { method: 'POST' });
}
