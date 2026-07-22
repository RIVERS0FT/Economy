import { Server } from 'node:http';
import { performance } from 'node:perf_hooks';

const INSTALLATION_KEY = Symbol.for('riversoft.economy.requestMetrics');
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_SLOW_REQUEST_MS = 1_000;
const DEFAULT_LARGE_RESPONSE_BYTES = 200 * 1024;
const DYNAMIC_ROUTE_PATTERNS = [
  [/^(\/api\/game\/(?:orders|auctions|collectible-auctions|facility-listings))\/[^/]+(\/(?:bids|cancel|buy))$/, '$1/:id$2'],
  [/^(\/api\/game\/admin\/gift-codes)\/[^/]+(\/(?:disable|redemptions))$/, '$1/:id$2'],
  [/^(\/api\/game\/admin\/collectibles)\/[^/]+(\/ownership)$/, '$1/:id$2'],
  [/^(\/api\/game\/admin\/bans\/users)\/[^/]+(\/(?:unban|reban))$/, '$1/:id$2'],
  [/^(\/api\/game\/admin\/bans)\/[^/]+(\/unban-all)?$/, '$1/:id$2'],
];

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function round(value) {
  return Math.round(finiteNonNegative(value) * 100) / 100;
}

export function normalizeMetricRoute(value) {
  let pathname = String(value || '/').split('?')[0] || '/';
  for (const [pattern, replacement] of DYNAMIC_ROUTE_PATTERNS) {
    if (pattern.test(pathname)) return pathname.replace(pattern, replacement);
  }
  pathname = pathname
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{8,}(?:-[0-9a-f-]+)?(?=\/|$)/gi, '/:id');
  return pathname;
}

export function createRequestMetricsCollector({
  now = Date.now,
  log = console.info,
  warn = console.warn,
  slowRequestMs = DEFAULT_SLOW_REQUEST_MS,
  largeResponseBytes = DEFAULT_LARGE_RESPONSE_BYTES,
} = {}) {
  let windowStartedAt = now();
  const routes = new Map();

  function record({ method, url, statusCode, durationMs, responseBytes }) {
    const route = normalizeMetricRoute(url);
    if (route !== '/health' && !route.startsWith('/api/')) return;
    const key = `${String(method || 'GET').toUpperCase()} ${route}`;
    const duration = finiteNonNegative(durationMs);
    const bytes = finiteNonNegative(responseBytes);
    const status = Number(statusCode) || 0;
    const current = routes.get(key) || {
      method: String(method || 'GET').toUpperCase(),
      route,
      count: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      totalResponseBytes: 0,
      maxResponseBytes: 0,
    };
    current.count += 1;
    if (status >= 500) current.errorCount += 1;
    current.totalDurationMs += duration;
    current.maxDurationMs = Math.max(current.maxDurationMs, duration);
    current.totalResponseBytes += bytes;
    current.maxResponseBytes = Math.max(current.maxResponseBytes, bytes);
    routes.set(key, current);

    if (status >= 500 || duration >= slowRequestMs || bytes >= largeResponseBytes) {
      warn('Economy request outlier', JSON.stringify({
        method: current.method,
        route,
        statusCode: status,
        durationMs: round(duration),
        responseBytes: bytes,
      }));
    }
  }

  function flush() {
    const endedAt = now();
    const summaries = [...routes.values()]
      .sort((left, right) => `${left.method} ${left.route}`.localeCompare(`${right.method} ${right.route}`))
      .map((entry) => ({
        method: entry.method,
        route: entry.route,
        count: entry.count,
        errorCount: entry.errorCount,
        averageDurationMs: round(entry.totalDurationMs / entry.count),
        maxDurationMs: round(entry.maxDurationMs),
        averageResponseBytes: Math.round(entry.totalResponseBytes / entry.count),
        maxResponseBytes: Math.round(entry.maxResponseBytes),
      }));
    const summary = {
      windowStartedAt,
      windowEndedAt: endedAt,
      windowMs: Math.max(0, endedAt - windowStartedAt),
      routes: summaries,
    };
    routes.clear();
    windowStartedAt = endedAt;
    if (summaries.length > 0) log('Economy request metrics', JSON.stringify(summary));
    return summary;
  }

  return { record, flush };
}

export function installRequestMetrics({ windowMs = DEFAULT_WINDOW_MS } = {}) {
  if (globalThis[INSTALLATION_KEY]) return globalThis[INSTALLATION_KEY];

  const collector = createRequestMetricsCollector();
  const originalEmit = Server.prototype.emit;
  function instrumentedEmit(event, ...args) {
    if (event === 'request') {
      const [request, response] = args;
      const startedAt = performance.now();
      response.once('finish', () => {
        collector.record({
          method: request.method,
          url: request.url,
          statusCode: response.statusCode,
          durationMs: performance.now() - startedAt,
          responseBytes: response.getHeader('Content-Length'),
        });
      });
    }
    return Reflect.apply(originalEmit, this, [event, ...args]);
  }
  Server.prototype.emit = instrumentedEmit;

  const timer = setInterval(() => collector.flush(), Math.max(1_000, Number(windowMs) || DEFAULT_WINDOW_MS));
  timer.unref();
  const installation = {
    collector,
    flush: () => collector.flush(),
    uninstall() {
      clearInterval(timer);
      if (Server.prototype.emit === instrumentedEmit) Server.prototype.emit = originalEmit;
      delete globalThis[INSTALLATION_KEY];
    },
  };
  globalThis[INSTALLATION_KEY] = installation;
  return installation;
}
