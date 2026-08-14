import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { AuthenticationCache } from './auth-cache.js';

const DEFAULT_ACCOUNT_SERVICE_URL = 'http://127.0.0.1:3001';

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

export const AUTHENTICATION_CACHE_POLICY = Object.freeze({
  stateMaxAgeMs: boundedInteger(process.env.ACCOUNT_AUTH_STATE_CACHE_TTL_MS, 10_000, 0, 10_000),
  writeMaxAgeMs: boundedInteger(process.env.ACCOUNT_AUTH_WRITE_CACHE_TTL_MS, 2_000, 0, 2_000),
  negativeTtlMs: boundedInteger(process.env.ACCOUNT_AUTH_NEGATIVE_CACHE_TTL_MS, 1_000, 0, 1_000),
  maxEntries: boundedInteger(process.env.ACCOUNT_AUTH_CACHE_MAX_ENTRIES, 5_000, 100, 5_000),
});

const authenticationCache = new AuthenticationCache({
  maxEntries: AUTHENTICATION_CACHE_POLICY.maxEntries,
});

function authenticationCacheKey(cookie) {
  return createHash('sha256').update(cookie).digest('base64url');
}

export function authenticationCacheMaxAgeForRequest(method, path) {
  if (String(path).startsWith('/api/game/admin/')) return 0;
  if (method === 'GET' && path === '/api/game/state') {
    return AUTHENTICATION_CACHE_POLICY.stateMaxAgeMs;
  }
  return AUTHENTICATION_CACHE_POLICY.writeMaxAgeMs;
}

function fetchCurrentUser(cookie) {
  const base = process.env.ACCOUNT_SERVICE_URL || DEFAULT_ACCOUNT_SERVICE_URL;
  const target = new URL('/api/me', base.endsWith('/') ? base : `${base}/`);
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const upstream = transport(target, {
      method: 'GET',
      timeout: 5_000,
      headers: {
        Cookie: cookie,
        Host: process.env.ACCOUNT_SERVICE_HOST || 'riversoft.top',
        'X-Forwarded-Host': process.env.ACCOUNT_SERVICE_HOST || 'riversoft.top',
        'X-Forwarded-Proto': 'https',
      },
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 65_536) {
          upstream.destroy(new Error('Account response too large'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode || 500,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Account service timeout')));
    upstream.on('error', reject);
    upstream.end();
  });
}

export async function authenticateRequest(request, { maxCacheAgeMs = 0 } = {}) {
  const cookie = String(request.headers.cookie || '');
  if (!cookie || cookie.length > 8_192) return null;

  const cacheKey = authenticationCacheKey(cookie);
  const cached = authenticationCache.get(cacheKey, maxCacheAgeMs);
  if (cached.hit) return cached.user;

  const user = await authenticationCache.coalesce(cacheKey, async () => {
    let upstream;
    try {
      upstream = await fetchCurrentUser(cookie);
    } catch {
      const error = new Error('统一账号服务暂时不可用');
      error.statusCode = 503;
      throw error;
    }

    if (upstream.status === 401) {
      authenticationCache.set(cacheKey, null, AUTHENTICATION_CACHE_POLICY.negativeTtlMs);
      return null;
    }
    if (upstream.status < 200 || upstream.status >= 300) {
      const error = new Error('统一账号服务暂时不可用');
      error.statusCode = 503;
      throw error;
    }

    let payload;
    try {
      payload = JSON.parse(upstream.body);
    } catch {
      const error = new Error('统一账号服务返回了无效数据');
      error.statusCode = 502;
      throw error;
    }

    const upstreamUser = payload?.user;
    if (!upstreamUser || !Number.isInteger(Number(upstreamUser.id)) || typeof upstreamUser.email !== 'string') {
      const error = new Error('统一账号服务返回了无效用户信息');
      error.statusCode = 502;
      throw error;
    }
    const normalizedUser = { ...upstreamUser, id: Number(upstreamUser.id) };
    authenticationCache.set(cacheKey, normalizedUser, AUTHENTICATION_CACHE_POLICY.stateMaxAgeMs);
    return normalizedUser;
  });

  return user ? { ...user } : null;
}

export function clearAuthenticationCache() {
  authenticationCache.clear();
}
