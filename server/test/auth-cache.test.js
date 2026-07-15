import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { AuthenticationCache } from '../src/auth-cache.js';
import {
  AUTHENTICATION_CACHE_POLICY,
  authenticateRequest,
  authenticationCacheMaxAgeForRequest,
  clearAuthenticationCache,
} from '../src/auth.js';

const requestWithCookie = (cookie) => ({ headers: { cookie } });

test('authentication cache enforces TTL, LRU order, and request coalescing', async () => {
  let now = 1_000;
  const cache = new AuthenticationCache({ maxEntries: 2, now: () => now });
  const user = { id: 1, email: 'cache@example.com' };

  cache.set('a', user, 100);
  cache.set('b', user, 100);
  assert.equal(cache.get('a', 100).hit, true);
  cache.set('c', user, 100);
  assert.equal(cache.get('b', 100).hit, false);
  assert.equal(cache.size, 2);

  now += 100;
  assert.equal(cache.get('a', 100).hit, false);

  let calls = 0;
  const first = cache.coalesce('pending', async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return 'verified';
  });
  const second = cache.coalesce('pending', async () => {
    calls += 1;
    return 'duplicate';
  });
  assert.equal(cache.pendingSize, 1);
  assert.deepEqual(await Promise.all([first, second]), ['verified', 'verified']);
  assert.equal(calls, 1);
  assert.equal(cache.pendingSize, 0);
});

test('authentication policy separates state, write, and administrator requests', () => {
  assert.equal(
    authenticationCacheMaxAgeForRequest('GET', '/api/game/state'),
    AUTHENTICATION_CACHE_POLICY.stateMaxAgeMs,
  );
  assert.equal(
    authenticationCacheMaxAgeForRequest('POST', '/api/game/work'),
    AUTHENTICATION_CACHE_POLICY.writeMaxAgeMs,
  );
  assert.equal(authenticationCacheMaxAgeForRequest('GET', '/api/game/admin/summary'), 0);
  assert.equal(AUTHENTICATION_CACHE_POLICY.stateMaxAgeMs, 10_000);
  assert.equal(AUTHENTICATION_CACHE_POLICY.writeMaxAgeMs, 2_000);
  assert.equal(AUTHENTICATION_CACHE_POLICY.maxEntries, 5_000);
});

test('authentication caches valid state reads, coalesces misses, and never caches upstream failures', async () => {
  const hits = new Map();
  const accountServer = createServer((request, response) => {
    const cookie = String(request.headers.cookie || '');
    hits.set(cookie, (hits.get(cookie) || 0) + 1);
    const send = () => {
      if (cookie === 'session=missing') {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ message: 'unauthorized' }));
        return;
      }
      if (cookie === 'session=error') {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ message: 'failed' }));
        return;
      }
      if (cookie === 'session=invalid-json') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{invalid');
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        user: { id: 7, email: `${cookie.slice(8)}@example.com`, name: 'Cached Player' },
      }));
    };
    if (cookie === 'session=slow') setTimeout(send, 30);
    else send();
  });
  await new Promise((resolve) => accountServer.listen(0, '127.0.0.1', resolve));
  const address = accountServer.address();
  const originalUrl = process.env.ACCOUNT_SERVICE_URL;
  process.env.ACCOUNT_SERVICE_URL = `http://127.0.0.1:${address.port}`;

  try {
    clearAuthenticationCache();
    const cachedRequest = requestWithCookie('session=ok');
    const first = await authenticateRequest(cachedRequest, { maxCacheAgeMs: 10_000 });
    const second = await authenticateRequest(cachedRequest, { maxCacheAgeMs: 10_000 });
    assert.equal(first.id, 7);
    assert.deepEqual(second, first);
    assert.equal(hits.get('session=ok'), 1);

    await authenticateRequest(cachedRequest, { maxCacheAgeMs: 0 });
    await authenticateRequest(cachedRequest, { maxCacheAgeMs: 0 });
    assert.equal(hits.get('session=ok'), 3);

    clearAuthenticationCache();
    const slowRequest = requestWithCookie('session=slow');
    const concurrent = await Promise.all([
      authenticateRequest(slowRequest, { maxCacheAgeMs: 0 }),
      authenticateRequest(slowRequest, { maxCacheAgeMs: 0 }),
      authenticateRequest(slowRequest, { maxCacheAgeMs: 0 }),
    ]);
    assert.equal(concurrent.every((item) => item.id === 7), true);
    assert.equal(hits.get('session=slow'), 1);

    clearAuthenticationCache();
    const missingRequest = requestWithCookie('session=missing');
    assert.equal(await authenticateRequest(missingRequest, { maxCacheAgeMs: 10_000 }), null);
    assert.equal(await authenticateRequest(missingRequest, { maxCacheAgeMs: 10_000 }), null);
    assert.equal(hits.get('session=missing'), 1);

    clearAuthenticationCache();
    const errorRequest = requestWithCookie('session=error');
    await assert.rejects(
      authenticateRequest(errorRequest, { maxCacheAgeMs: 10_000 }),
      (error) => error.statusCode === 503,
    );
    await assert.rejects(
      authenticateRequest(errorRequest, { maxCacheAgeMs: 10_000 }),
      (error) => error.statusCode === 503,
    );
    assert.equal(hits.get('session=error'), 2);

    clearAuthenticationCache();
    const invalidRequest = requestWithCookie('session=invalid-json');
    await assert.rejects(
      authenticateRequest(invalidRequest, { maxCacheAgeMs: 10_000 }),
      (error) => error.statusCode === 502,
    );
    await assert.rejects(
      authenticateRequest(invalidRequest, { maxCacheAgeMs: 10_000 }),
      (error) => error.statusCode === 502,
    );
    assert.equal(hits.get('session=invalid-json'), 2);
  } finally {
    clearAuthenticationCache();
    if (originalUrl === undefined) delete process.env.ACCOUNT_SERVICE_URL;
    else process.env.ACCOUNT_SERVICE_URL = originalUrl;
    await new Promise((resolve) => accountServer.close(resolve));
  }
});
