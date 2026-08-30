import { Server } from 'node:http';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { createRequestPerformanceContext, runWithRequestPerformance, snapshotRequestPerformance } from './request-performance.js';

const INSTALLATION_KEY = Symbol.for('riversoft.economy.requestMetrics');
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_SLOW_REQUEST_MS = 1_000;
const DEFAULT_LARGE_RESPONSE_BYTES = 200 * 1024;
const DEFAULT_MAX_ROUTE_KEYS = 256;
const DEFAULT_HISTORY_WINDOWS = 360;
const OVERFLOW_METHOD = 'OTHER';
const OVERFLOW_ROUTE = '/api/other';
const MAX_SAMPLES_PER_ROUTE = 4_096;
const MAX_GLOBAL_SAMPLES = 16_384;
const LATENCY_HISTOGRAM_BINS = 256;
const LATENCY_HISTOGRAM_SCALE = 8;
const DYNAMIC_ROUTE_PATTERNS = [
  [/^(\/api\/game\/(?:orders|auctions|facility-listings))\/[^/]+(\/(?:bids|cancel|buy))$/, '$1/:id$2'],
  [/^(\/api\/game\/admin\/gift-codes)\/[^/]+(\/(?:disable|redemptions))$/, '$1/:id$2'],
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

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return round(sorted[index]);
}

function appendSample(samples, value, limit = MAX_SAMPLES_PER_ROUTE) {
  if (samples.length < limit) samples.push(finiteNonNegative(value));
}


export function createLatencyHistogram() {
  return Array.from({ length: LATENCY_HISTOGRAM_BINS }, () => 0);
}

export function addLatencyHistogramSample(histogram, value, count = 1) {
  if (!Array.isArray(histogram) || histogram.length !== LATENCY_HISTOGRAM_BINS) return histogram;
  const duration = finiteNonNegative(value);
  const index = Math.min(
    LATENCY_HISTOGRAM_BINS - 1,
    Math.max(0, Math.floor(Math.log2(duration + 1) * LATENCY_HISTOGRAM_SCALE)),
  );
  histogram[index] += Math.max(0, Math.floor(Number(count) || 0));
  return histogram;
}

export function mergeLatencyHistograms(target, source) {
  if (!Array.isArray(target) || target.length !== LATENCY_HISTOGRAM_BINS) return target;
  if (!Array.isArray(source)) return target;
  for (let index = 0; index < LATENCY_HISTOGRAM_BINS; index += 1) {
    target[index] += Math.max(0, Math.floor(Number(source[index]) || 0));
  }
  return target;
}

export function latencyHistogramPercentile(histogram, ratio) {
  if (!Array.isArray(histogram) || histogram.length === 0) return 0;
  const total = histogram.reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  if (total <= 0) return 0;
  const target = Math.max(1, Math.ceil(total * Math.min(1, Math.max(0, Number(ratio) || 0))));
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += Math.max(0, Number(histogram[index]) || 0);
    if (cumulative >= target) {
      return round((2 ** ((index + 1) / LATENCY_HISTOGRAM_SCALE)) - 1);
    }
  }
  return round((2 ** (histogram.length / LATENCY_HISTOGRAM_SCALE)) - 1);
}

function eventLoopDelaySnapshot(eventLoopDelay) {
  return {
    p50Ms: round(eventLoopDelay.percentile(50) / 1_000_000),
    p95Ms: round(eventLoopDelay.percentile(95) / 1_000_000),
    p99Ms: round(eventLoopDelay.percentile(99) / 1_000_000),
    maxMs: round(eventLoopDelay.max / 1_000_000),
  };
}

function emptyRequestSummary() {
  return {
    requestCount: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    averageDurationMs: 0,
    p50DurationMs: 0,
    p95DurationMs: 0,
    p99DurationMs: 0,
    maxDurationMs: 0,
    averageResponseBytes: 0,
    maxResponseBytes: 0,
  };
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
  maxRouteKeys = DEFAULT_MAX_ROUTE_KEYS,
} = {}) {
  let windowStartedAt = now();
  const routes = new Map();
  const routeKeyLimit = Math.max(1, Math.floor(Number(maxRouteKeys) || DEFAULT_MAX_ROUTE_KEYS));
  let overflowedRequestCount = 0;
  let requestCount = 0;
  let clientErrorCount = 0;
  let serverErrorCount = 0;
  let totalDurationMs = 0;
  let maxDurationMs = 0;
  let totalResponseBytes = 0;
  let maxResponseBytes = 0;
  const durationSamples = [];
  const durationHistogram = createLatencyHistogram();

  function record({ method, url, statusCode, durationMs, responseBytes, phases = {}, gauges = {} }) {
    let route = normalizeMetricRoute(url);
    if (route !== '/health' && !route.startsWith('/api/')) return;
    let metricMethod = String(method || 'GET').toUpperCase();
    let key = `${metricMethod} ${route}`;
    if (!routes.has(key) && routes.size >= Math.max(0, routeKeyLimit - 1)) {
      metricMethod = OVERFLOW_METHOD;
      route = OVERFLOW_ROUTE;
      key = `${metricMethod} ${route}`;
      overflowedRequestCount += 1;
    }
    const duration = finiteNonNegative(durationMs);
    const bytes = finiteNonNegative(gauges?.responseJsonBytes ?? responseBytes);
    const status = Number(statusCode) || 0;
    requestCount += 1;
    if (status >= 400 && status < 500) clientErrorCount += 1;
    if (status >= 500) serverErrorCount += 1;
    totalDurationMs += duration;
    maxDurationMs = Math.max(maxDurationMs, duration);
    totalResponseBytes += bytes;
    maxResponseBytes = Math.max(maxResponseBytes, bytes);
    appendSample(durationSamples, duration, MAX_GLOBAL_SAMPLES);
    addLatencyHistogramSample(durationHistogram, duration);

    const current = routes.get(key) || {
      method: metricMethod,
      route,
      count: 0,
      errorCount: 0,
      clientErrorCount: 0,
      serverErrorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      totalResponseBytes: 0,
      maxResponseBytes: 0,
      durationSamples: [],
      phaseSamples: new Map(),
      gauges: Object.create(null),
    };
    current.count += 1;
    if (status >= 400 && status < 500) current.clientErrorCount += 1;
    if (status >= 500) {
      current.errorCount += 1;
      current.serverErrorCount += 1;
    }
    current.totalDurationMs += duration;
    current.maxDurationMs = Math.max(current.maxDurationMs, duration);
    current.totalResponseBytes += bytes;
    current.maxResponseBytes = Math.max(current.maxResponseBytes, bytes);
    appendSample(current.durationSamples, duration);
    for (const [phase, phaseDuration] of Object.entries(phases || {})) {
      if (!current.phaseSamples.has(phase)) current.phaseSamples.set(phase, []);
      appendSample(current.phaseSamples.get(phase), phaseDuration);
    }
    for (const [name, value] of Object.entries(gauges || {})) {
      const number = Number(value);
      if (!Number.isFinite(number)) continue;
      current.gauges[name] = Math.max(Number(current.gauges[name] ?? number), number);
    }
    routes.set(key, current);

    const interactiveBudgetMs = finiteNonNegative(gauges?.interactiveActionBudgetMs);
    const slowThresholdMs = interactiveBudgetMs > 0
      ? Math.min(slowRequestMs, interactiveBudgetMs)
      : slowRequestMs;
    const unexpectedFullWorldAction = Number(gauges?.unexpectedFullWorldAction || 0) > 0;
    if (status >= 500 || duration >= slowThresholdMs || bytes >= largeResponseBytes || unexpectedFullWorldAction) {
      warn('Economy request outlier', JSON.stringify({
        method: current.method,
        route,
        statusCode: status,
        durationMs: round(duration),
        responseBytes: bytes,
        phases,
        gauges,
      }));
    }
  }

  function createSummary(extraSummary = {}, endedAt = now()) {
    const summaries = [...routes.values()]
      .sort((left, right) => `${left.method} ${left.route}`.localeCompare(`${right.method} ${right.route}`))
      .map((entry) => ({
        method: entry.method,
        route: entry.route,
        count: entry.count,
        errorCount: entry.errorCount,
        clientErrorCount: entry.clientErrorCount,
        serverErrorCount: entry.serverErrorCount,
        averageDurationMs: round(entry.totalDurationMs / entry.count),
        p50DurationMs: percentile(entry.durationSamples, 0.5),
        p95DurationMs: percentile(entry.durationSamples, 0.95),
        p99DurationMs: percentile(entry.durationSamples, 0.99),
        maxDurationMs: round(entry.maxDurationMs),
        averageResponseBytes: Math.round(entry.totalResponseBytes / entry.count),
        maxResponseBytes: Math.round(entry.maxResponseBytes),
        phases: Object.fromEntries([...entry.phaseSamples.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, samples]) => [name, {
            p50Ms: percentile(samples, 0.5),
            p95Ms: percentile(samples, 0.95),
            p99Ms: percentile(samples, 0.99),
            maxMs: percentile(samples, 1),
          }])),
        gauges: { ...entry.gauges },
      }));
    const requestSummary = requestCount > 0 ? {
      requestCount,
      clientErrorCount,
      serverErrorCount,
      averageDurationMs: round(totalDurationMs / requestCount),
      p50DurationMs: percentile(durationSamples, 0.5),
      p95DurationMs: percentile(durationSamples, 0.95),
      p99DurationMs: percentile(durationSamples, 0.99),
      maxDurationMs: round(maxDurationMs),
      averageResponseBytes: Math.round(totalResponseBytes / requestCount),
      maxResponseBytes: Math.round(maxResponseBytes),
    } : emptyRequestSummary();
    return {
      windowStartedAt,
      windowEndedAt: endedAt,
      windowMs: Math.max(0, endedAt - windowStartedAt),
      overflowedRequestCount,
      ...requestSummary,
      durationHistogram: [...durationHistogram],
      routes: summaries,
      ...extraSummary,
    };
  }

  function reset(endedAt) {
    routes.clear();
    overflowedRequestCount = 0;
    requestCount = 0;
    clientErrorCount = 0;
    serverErrorCount = 0;
    totalDurationMs = 0;
    maxDurationMs = 0;
    totalResponseBytes = 0;
    maxResponseBytes = 0;
    durationSamples.length = 0;
    durationHistogram.fill(0);
    windowStartedAt = endedAt;
  }

  function snapshot(extraSummary = {}) {
    return createSummary(extraSummary, now());
  }

  function flush(extraSummary = {}) {
    const endedAt = now();
    const summary = createSummary(extraSummary, endedAt);
    reset(endedAt);
    if (summary.routes.length > 0) {
      const { durationHistogram: _durationHistogram, ...logSummary } = summary;
      log('Economy request metrics', JSON.stringify(logSummary));
    }
    return summary;
  }

  return { record, snapshot, flush };
}

export function installRequestMetrics({
  windowMs = DEFAULT_WINDOW_MS,
  historyWindows = DEFAULT_HISTORY_WINDOWS,
} = {}) {
  if (globalThis[INSTALLATION_KEY]) return globalThis[INSTALLATION_KEY];

  const collector = createRequestMetricsCollector();
  const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  eventLoopDelay.enable();
  const history = [];
  const historyLimit = Math.max(1, Math.floor(Number(historyWindows) || DEFAULT_HISTORY_WINDOWS));
  const originalEmit = Server.prototype.emit;

  function appendHistory(summary) {
    history.push(summary);
    if (history.length > historyLimit) history.splice(0, history.length - historyLimit);
  }

  function instrumentedEmit(event, ...args) {
    if (event !== 'request') return Reflect.apply(originalEmit, this, [event, ...args]);
    const [request, response] = args;
    const startedAt = performance.now();
    const performanceContext = createRequestPerformanceContext();
    response.once('finish', () => {
      const details = snapshotRequestPerformance(performanceContext);
      collector.record({
        method: request.method,
        url: request.url,
        statusCode: response.statusCode,
        durationMs: performance.now() - startedAt,
        responseBytes: response.getHeader('Content-Length'),
        phases: details.phases,
        gauges: details.gauges,
      });
    });
    return runWithRequestPerformance(performanceContext, () => (
      Reflect.apply(originalEmit, this, [event, ...args])
    ));
  }
  Server.prototype.emit = instrumentedEmit;

  const timer = setInterval(() => {
    const summary = collector.flush({ eventLoopDelay: eventLoopDelaySnapshot(eventLoopDelay) });
    appendHistory(summary);
    eventLoopDelay.reset();
  }, Math.max(1_000, Number(windowMs) || DEFAULT_WINDOW_MS));
  timer.unref();

  const installation = {
    collector,
    snapshot({ rangeMs = DEFAULT_WINDOW_MS * DEFAULT_HISTORY_WINDOWS } = {}) {
      const generatedAt = Date.now();
      const cutoff = generatedAt - Math.max(DEFAULT_WINDOW_MS, Number(rangeMs) || DEFAULT_WINDOW_MS);
      return {
        generatedAt,
        current: collector.snapshot({ eventLoopDelay: eventLoopDelaySnapshot(eventLoopDelay) }),
        history: history.filter((summary) => summary.windowEndedAt >= cutoff).map((summary) => ({ ...summary })),
      };
    },
    flush() {
      const summary = collector.flush({ eventLoopDelay: eventLoopDelaySnapshot(eventLoopDelay) });
      appendHistory(summary);
      eventLoopDelay.reset();
      return summary;
    },
    uninstall() {
      clearInterval(timer);
      eventLoopDelay.disable();
      if (Server.prototype.emit === instrumentedEmit) Server.prototype.emit = originalEmit;
      delete globalThis[INSTALLATION_KEY];
    },
  };
  globalThis[INSTALLATION_KEY] = installation;
  return installation;
}

export function getRequestMetricsSnapshot(rangeMs) {
  const installation = globalThis[INSTALLATION_KEY];
  if (!installation) {
    return {
      generatedAt: Date.now(),
      current: null,
      history: [],
    };
  }
  return installation.snapshot({ rangeMs });
}
