import type { AuthUser } from '../types';
import { beginGameWriteSession, endGameWriteSession } from './gameWriteSession';

const API_BASE = '/economy-api';
const NETWORK_ERROR_MESSAGE = '无法连接服务器，客户端或服务器可能已经更新，请刷新页面后重试';
const REQUEST_ABORTED_MESSAGE = '连接已中断，请刷新页面后重试';

interface AuthResponse {
  user: AuthUser;
}

interface EmailCodeResponse {
  message: string;
  expiresAt: number;
  resendAfterSeconds: number;
}

interface PasswordResetResponse {
  message: string;
  repeated?: boolean;
}

export interface EconomySessionResponse {
  playerCreated: boolean;
  banned: boolean;
  incidentId?: number;
  anomalyIncidentId?: number;
  invitationBound: boolean;
  invalidInvite: boolean;
}

export class ApiRequestError extends Error {
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

export function isUnauthorizedApiError(reason: unknown) {
  return reason instanceof ApiRequestError && reason.status === 401;
}

function createIdempotencyKey(prefix: string) {
  const token = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${token}`;
}

function isBrowserAbortError(reason: unknown) {
  if (!reason || typeof reason !== 'object' || !('name' in reason)) return false;
  return String((reason as { name?: unknown }).name || '') === 'AbortError';
}

function isBrowserNetworkError(reason: unknown) {
  if (reason instanceof TypeError) return true;
  if (!(reason instanceof Error)) return false;
  return /failed to fetch|load failed|networkerror|network request failed/i.test(reason.message);
}

async function fetchApi(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (reason) {
    if (isBrowserAbortError(reason)) {
      throw new ApiRequestError(408, REQUEST_ABORTED_MESSAGE, { code: 'CLIENT_REQUEST_ABORTED' });
    }
    if (isBrowserNetworkError(reason)) {
      throw new ApiRequestError(0, NETWORK_ERROR_MESSAGE, { code: 'CLIENT_NETWORK_ERROR' });
    }
    throw reason;
  }
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(`${base}${path}`, {
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
  const response = await fetchApi(`${API_BASE}/me`, { credentials: 'include' });
  if (response.status === 401) { endGameWriteSession(); return null; }
  if (!response.ok) throw new Error('无法连接主页账号服务');
  const user = ((await response.json()) as AuthResponse).user;
  if (user) beginGameWriteSession(user.id);
  else endGameWriteSession();
  return user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  endGameWriteSession();
  const payload = await requestGameApi<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  beginGameWriteSession(payload.user.id);
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
  invitationSource?: 'share_link' | 'manual_code',
): Promise<AuthUser> {
  const payload = await requestGameApi<AuthResponse>('/registration/complete', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('registration-complete') },
    body: JSON.stringify({ email, password, code, inviteCode, invitationSource }),
  });
  return payload.user;
}

export async function sendPasswordResetEmailCode(email: string): Promise<EmailCodeResponse> {
  return requestGameApi<EmailCodeResponse>('/password-reset/email-code', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('password-reset-email') },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(email: string, password: string, code: string): Promise<PasswordResetResponse> {
  return requestGameApi<PasswordResetResponse>('/password-reset/complete', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('password-reset-complete') },
    body: JSON.stringify({ email, password, code }),
  });
}

export async function initializeEconomySession(inviteCode?: string): Promise<EconomySessionResponse> {
  return requestGameApi<EconomySessionResponse>('/game/session', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('economy-session') },
    body: JSON.stringify({ inviteCode }),
  });
}

export async function logout(): Promise<void> {
  endGameWriteSession();
  await requestGameApi<{ message: string }>('/logout', { method: 'POST' });
}
