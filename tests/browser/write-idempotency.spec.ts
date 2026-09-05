import { expect, test, type Page } from '@playwright/test';

const TEST_PATH = '/economy-api/game/idempotency-runtime-test';
const SESSION_PATH = '/economy-api/game/session';
const HISTORY_KEY = 'economy-write-idempotency-test-history';
const MODE_KEY = 'economy-write-idempotency-test-mode';
const TIMEOUT_HISTORY_KEY = 'economy-write-timeout-test-history';

type MockMode = 'abort-first' | 'network-error' | 'rate-limited' | 'success';

async function initializeWriteSession(page: Page) {
  await page.evaluate(async () => {
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const coordinatorUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const { beginGameWriteSession } = await import(sessionUrl);
    const { installIdempotentGameWriteFetch } = await import(coordinatorUrl);
    beginGameWriteSession(805);
    installIdempotentGameWriteFetch();
  });
}

async function openWriteHarness(page: Page) {
  // These are authenticated transport tests, not an unauthenticated App bootstrap.
  // Keep the real coordinator while giving reloads the same explicit account identity.
  await page.route('**/write-idempotency-harness', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Write idempotency harness</title>',
  }));
  await page.goto('write-idempotency-harness');
  await initializeWriteSession(page);
}

async function installNativeWriteMock(page: Page, initialMode: MockMode) {
  await page.addInitScript(({ historyKey, modeKey, initialModeValue, testPath }) => {
    const nativeFetch = window.fetch.bind(window);
    try {
      if (!window.sessionStorage.getItem(modeKey)) {
        window.sessionStorage.setItem(modeKey, initialModeValue);
      }
    } catch {
      // The production coordinator has the same in-memory fallback when storage is unavailable.
    }

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const url = new URL(rawUrl, window.location.origin);
      if (url.pathname !== testPath) return nativeFetch(input, init);

      const key = new Headers(init?.headers).get('Idempotency-Key') || '';
      const history = JSON.parse(window.sessionStorage.getItem(historyKey) || '[]') as string[];
      history.push(key);
      window.sessionStorage.setItem(historyKey, JSON.stringify(history));
      const mode = (window.sessionStorage.getItem(modeKey) || initialModeValue) as MockMode;

      if (mode === 'abort-first' && history.length === 1) {
        return await new Promise<Response>((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (init?.signal?.aborted) {
            abort();
            return;
          }
          init?.signal?.addEventListener('abort', abort, { once: true });
        });
      }
      if (mode === 'network-error') {
        throw new TypeError('Failed to fetch');
      }
      if (mode === 'rate-limited') {
        return new Response(JSON.stringify({ message: '操作过于频繁，请稍后重试' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '1',
          },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof window.fetch;
  }, {
    historyKey: HISTORY_KEY,
    modeKey: MODE_KEY,
    initialModeValue: initialMode,
    testPath: TEST_PATH,
  });
  await openWriteHarness(page);
}

async function installWriteTimeoutObservationMock(page: Page) {
  await page.addInitScript(({ historyKey, testPath, sessionPath }) => {
    const nativeFetch = window.fetch.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 12_000) {
        const history = JSON.parse(window.sessionStorage.getItem(historyKey) || '[]') as number[];
        history.push(timeout);
        window.sessionStorage.setItem(historyKey, JSON.stringify(history));
      }
      return nativeSetTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const url = new URL(rawUrl, window.location.origin);
      if (url.pathname === testPath || url.pathname === sessionPath) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return nativeFetch(input, init);
    }) as typeof window.fetch;
  }, {
    historyKey: TIMEOUT_HISTORY_KEY,
    testPath: TEST_PATH,
    sessionPath: SESSION_PATH,
  });
  await openWriteHarness(page);
}

async function submitTestWrite(page: Page, key: string, body: string, abortImmediately = false) {
  return page.evaluate(async ({ path, requestKey, requestBody, shouldAbort, historyKey }) => {
    const controller = new AbortController();
    const pending = window.fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': requestKey,
      },
      body: requestBody,
      signal: controller.signal,
    });
    if (shouldAbort) window.setTimeout(() => controller.abort(), 10);
    try {
      const response = await pending;
      return {
        status: response.status,
        errorName: '',
        history: JSON.parse(window.sessionStorage.getItem(historyKey) || '[]') as string[],
      };
    } catch (reason) {
      return {
        status: 0,
        errorName: reason && typeof reason === 'object' && 'name' in reason
          ? String((reason as { name?: unknown }).name || '')
          : '',
        history: JSON.parse(window.sessionStorage.getItem(historyKey) || '[]') as string[],
      };
    }
  }, {
    path: TEST_PATH,
    requestKey: key,
    requestBody: body,
    shouldAbort: abortImmediately,
    historyKey: HISTORY_KEY,
  });
}

test('ambiguous abort retries once with the original idempotency key', async ({ page }) => {
  await installNativeWriteMock(page, 'abort-first');

  const result = await submitTestWrite(page, 'logical-action-key-1', '{"quantity":1}', true);

  expect(result.status).toBe(200);
  expect(result.errorName).toBe('');
  expect(result.history).toEqual(['logical-action-key-1', 'logical-action-key-1']);
});

test('unconfirmed write survives reload and rate limiting until a definitive response', async ({ page }) => {
  await installNativeWriteMock(page, 'network-error');

  const unresolved = await submitTestWrite(page, 'original-action-key', '{"quantity":2}');
  expect(unresolved.status).toBe(0);
  expect(unresolved.errorName).toBe('TypeError');
  expect(unresolved.history).toEqual(['original-action-key', 'original-action-key']);

  await page.evaluate(({ modeKey }) => window.sessionStorage.setItem(modeKey, 'rate-limited'), { modeKey: MODE_KEY });
  await page.reload();
  await initializeWriteSession(page);

  const rateLimited = await submitTestWrite(page, 'new-key-that-must-not-be-used', '{"quantity":2}');
  expect(rateLimited.status).toBe(429);
  expect(rateLimited.history).toEqual([
    'original-action-key',
    'original-action-key',
    'original-action-key',
  ]);

  await page.evaluate(({ modeKey }) => window.sessionStorage.setItem(modeKey, 'success'), { modeKey: MODE_KEY });

  const confirmed = await submitTestWrite(page, 'second-new-key-that-must-not-be-used', '{"quantity":2}');
  expect(confirmed.status).toBe(200);
  expect(confirmed.history).toEqual([
    'original-action-key',
    'original-action-key',
    'original-action-key',
    'original-action-key',
  ]);

  const newLogicalAction = await submitTestWrite(page, 'fresh-key-after-confirmation', '{"quantity":2}');
  expect(newLogicalAction.status).toBe(200);
  expect(newLogicalAction.history).toEqual([
    'original-action-key',
    'original-action-key',
    'original-action-key',
    'original-action-key',
    'fresh-key-after-confirmation',
  ]);
});

test('session bootstrap keeps idempotency coordination without the ordinary 12 second client abort', async ({ page }) => {
  await installWriteTimeoutObservationMock(page);

  const result = await page.evaluate(async ({ sessionPath, testPath, historyKey }) => {
    async function attempt(path: string, key: string) {
      window.sessionStorage.setItem(historyKey, '[]');
      const response = await window.fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: '{}',
      });
      return {
        status: response.status,
        timeouts: JSON.parse(window.sessionStorage.getItem(historyKey) || '[]') as number[],
      };
    }

    return {
      session: await attempt(sessionPath, 'session-bootstrap-key'),
      ordinary: await attempt(testPath, 'ordinary-write-key'),
    };
  }, {
    sessionPath: SESSION_PATH,
    testPath: TEST_PATH,
    historyKey: TIMEOUT_HISTORY_KEY,
  });

  expect(result.session.status).toBe(200);
  expect(result.session.timeouts).toEqual([]);
  expect(result.ordinary.status).toBe(200);
  expect(result.ordinary.timeouts).toEqual([12_000]);
});
