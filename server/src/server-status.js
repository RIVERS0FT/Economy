import { statSync, statfsSync } from 'node:fs';
import { cpus, freemem, loadavg, platform, totalmem } from 'node:os';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  createLatencyHistogram,
  getRequestMetricsSnapshot,
  latencyHistogramPercentile,
  mergeLatencyHistograms,
} from './request-metrics.js';

const INSTALLATION_KEY = Symbol.for('riversoft.economy.serverRuntimeMetrics');
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const DEFAULT_SAMPLE_MS = 5_000;
const DEFAULT_HISTORY_MINUTES = 360;
const MINUTE_TREND_LIMIT = 60;
const HOUR_TREND_LIMIT = 24;
const DAY_TREND_LIMIT = 30;
const REQUEST_CAPTURE_RANGE_MS = 2 * HOUR_MS;

export const SERVER_STATUS_RANGES = Object.freeze({
  '1h': Object.freeze({ milliseconds: HOUR_MS, bucketMilliseconds: MINUTE_MS, granularity: 'minute' }),
  '1d': Object.freeze({ milliseconds: DAY_MS, bucketMilliseconds: HOUR_MS, granularity: 'hour' }),
  '30d': Object.freeze({ milliseconds: MONTH_MS, bucketMilliseconds: DAY_MS, granularity: 'day' }),
});

export const SERVER_STATUS_THRESHOLDS = Object.freeze({
  cpuWarningPercent: 70,
  cpuCriticalPercent: 90,
  heapWarningBps: 7_500,
  heapCriticalBps: 9_000,
  eventLoopWarningMs: 50,
  eventLoopCriticalMs: 200,
  apiP95WarningMs: 500,
  apiP95CriticalMs: 1_500,
  serverErrorWarningBps: 100,
  serverErrorCriticalBps: 500,
  schedulerLagWarningMs: 1_000,
  schedulerLagCriticalMs: 5_000,
  diskFreeWarningBps: 2_000,
  diskFreeCriticalBps: 1_000,
  diskFreeWarningBytes: 2 * 1024 ** 3,
  diskFreeCriticalBytes: 1 * 1024 ** 3,
  walWarningBytes: 128 * 1024 ** 2,
  walCriticalBytes: 256 * 1024 ** 2,
});

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function round(value) {
  return Math.round(finiteNonNegative(value) * 100) / 100;
}

function bucketStart(value, bucketMs) {
  return Math.floor(finiteNonNegative(value) / bucketMs) * bucketMs;
}

function minuteStart(value) {
  return bucketStart(value, MINUTE_MS);
}

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function safeStatFs(path) {
  try {
    return statfsSync(path);
  } catch {
    return null;
  }
}

function runtimeBucketSnapshot(bucket) {
  const divisor = Math.max(1, bucket.samples);
  return {
    startsAt: bucket.startsAt,
    endsAt: bucket.endsAt,
    samples: bucket.samples,
    cpuAveragePercent: round(bucket.cpuTotalPercent / divisor),
    cpuMaxPercent: round(bucket.cpuMaxPercent),
    rssAverageBytes: Math.round(bucket.rssTotalBytes / divisor),
    rssMaxBytes: Math.round(bucket.rssMaxBytes),
    heapUsedAverageBytes: Math.round(bucket.heapUsedTotalBytes / divisor),
    heapUsedMaxBytes: Math.round(bucket.heapUsedMaxBytes),
    heapTotalMaxBytes: Math.round(bucket.heapTotalMaxBytes),
  };
}

function createRouteAccumulator(entry) {
  return {
    method: String(entry?.method || 'GET'),
    route: String(entry?.route || '/api/other'),
    count: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    weightedDuration: 0,
    p95DurationMs: 0,
    maxDurationMs: 0,
    weightedResponseBytes: 0,
    maxResponseBytes: 0,
    phases: Object.create(null),
  };
}

function mergeRouteEntry(target, entry) {
  const count = finiteNonNegative(entry?.count);
  target.count += count;
  target.clientErrorCount += finiteNonNegative(entry?.clientErrorCount);
  target.serverErrorCount += finiteNonNegative(entry?.serverErrorCount ?? entry?.errorCount);
  target.weightedDuration += finiteNonNegative(entry?.averageDurationMs) * count;
  target.p95DurationMs = Math.max(target.p95DurationMs, finiteNonNegative(entry?.p95DurationMs));
  target.maxDurationMs = Math.max(target.maxDurationMs, finiteNonNegative(entry?.maxDurationMs));
  target.weightedResponseBytes += finiteNonNegative(entry?.averageResponseBytes) * count;
  target.maxResponseBytes = Math.max(target.maxResponseBytes, finiteNonNegative(entry?.maxResponseBytes));
  for (const [name, phase] of Object.entries(entry?.phases || {})) {
    const p95Ms = typeof phase === 'number' ? phase : phase?.p95Ms;
    target.phases[name] = Math.max(finiteNonNegative(target.phases[name]), finiteNonNegative(p95Ms));
  }
}

function routeSnapshot(entry) {
  return {
    method: entry.method,
    route: entry.route,
    count: entry.count,
    clientErrorCount: entry.clientErrorCount,
    serverErrorCount: entry.serverErrorCount,
    averageDurationMs: entry.count > 0 ? round(entry.weightedDuration / entry.count) : 0,
    p95DurationMs: round(entry.p95DurationMs),
    maxDurationMs: round(entry.maxDurationMs),
    averageResponseBytes: entry.count > 0 ? Math.round(entry.weightedResponseBytes / entry.count) : 0,
    maxResponseBytes: Math.round(entry.maxResponseBytes),
    phases: Object.fromEntries(Object.entries(entry.phases)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([name, p95Ms]) => [name, round(p95Ms)])),
  };
}

function createTrendAccumulator(startsAt, bucketMs) {
  return {
    startsAt,
    endsAt: startsAt + bucketMs,
    windowMs: 0,
    requestCount: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    weightedDuration: 0,
    durationHistogram: createLatencyHistogram(),
    p50FallbackMs: 0,
    p95FallbackMs: 0,
    p99FallbackMs: 0,
    maxDurationMs: 0,
    weightedResponseBytes: 0,
    maxResponseBytes: 0,
    eventLoopP50Ms: 0,
    eventLoopP95Ms: 0,
    eventLoopP99Ms: 0,
    eventLoopMaxMs: 0,
    runtimeSamples: 0,
    cpuTotalPercent: 0,
    cpuMaxPercent: 0,
    rssMaxBytes: null,
    heapUsedMaxBytes: null,
    heapTotalMaxBytes: null,
    routes: new Map(),
  };
}

function cloneTrendAccumulator(source) {
  const clone = createTrendAccumulator(source.startsAt, source.endsAt - source.startsAt);
  clone.windowMs = source.windowMs;
  clone.requestCount = source.requestCount;
  clone.clientErrorCount = source.clientErrorCount;
  clone.serverErrorCount = source.serverErrorCount;
  clone.weightedDuration = source.weightedDuration;
  mergeLatencyHistograms(clone.durationHistogram, source.durationHistogram);
  clone.p50FallbackMs = source.p50FallbackMs;
  clone.p95FallbackMs = source.p95FallbackMs;
  clone.p99FallbackMs = source.p99FallbackMs;
  clone.maxDurationMs = source.maxDurationMs;
  clone.weightedResponseBytes = source.weightedResponseBytes;
  clone.maxResponseBytes = source.maxResponseBytes;
  clone.eventLoopP50Ms = source.eventLoopP50Ms;
  clone.eventLoopP95Ms = source.eventLoopP95Ms;
  clone.eventLoopP99Ms = source.eventLoopP99Ms;
  clone.eventLoopMaxMs = source.eventLoopMaxMs;
  clone.runtimeSamples = source.runtimeSamples;
  clone.cpuTotalPercent = source.cpuTotalPercent;
  clone.cpuMaxPercent = source.cpuMaxPercent;
  clone.rssMaxBytes = source.rssMaxBytes;
  clone.heapUsedMaxBytes = source.heapUsedMaxBytes;
  clone.heapTotalMaxBytes = source.heapTotalMaxBytes;
  for (const [key, route] of source.routes) clone.routes.set(key, { ...route, phases: { ...route.phases } });
  return clone;
}

function mergeRequestWindow(target, window) {
  const count = finiteNonNegative(window?.requestCount);
  target.windowMs += finiteNonNegative(window?.windowMs);
  target.requestCount += count;
  target.clientErrorCount += finiteNonNegative(window?.clientErrorCount);
  target.serverErrorCount += finiteNonNegative(window?.serverErrorCount);
  target.weightedDuration += finiteNonNegative(window?.averageDurationMs) * count;
  mergeLatencyHistograms(target.durationHistogram, window?.durationHistogram);
  target.p50FallbackMs = Math.max(target.p50FallbackMs, finiteNonNegative(window?.p50DurationMs));
  target.p95FallbackMs = Math.max(target.p95FallbackMs, finiteNonNegative(window?.p95DurationMs));
  target.p99FallbackMs = Math.max(target.p99FallbackMs, finiteNonNegative(window?.p99DurationMs));
  target.maxDurationMs = Math.max(target.maxDurationMs, finiteNonNegative(window?.maxDurationMs));
  target.weightedResponseBytes += finiteNonNegative(window?.averageResponseBytes) * count;
  target.maxResponseBytes = Math.max(target.maxResponseBytes, finiteNonNegative(window?.maxResponseBytes));
  target.eventLoopP50Ms = Math.max(target.eventLoopP50Ms, finiteNonNegative(window?.eventLoopDelay?.p50Ms));
  target.eventLoopP95Ms = Math.max(target.eventLoopP95Ms, finiteNonNegative(window?.eventLoopDelay?.p95Ms));
  target.eventLoopP99Ms = Math.max(target.eventLoopP99Ms, finiteNonNegative(window?.eventLoopDelay?.p99Ms));
  target.eventLoopMaxMs = Math.max(target.eventLoopMaxMs, finiteNonNegative(window?.eventLoopDelay?.maxMs));
  for (const entry of window?.routes || []) {
    const key = `${entry.method} ${entry.route}`;
    const route = target.routes.get(key) || createRouteAccumulator(entry);
    mergeRouteEntry(route, entry);
    target.routes.set(key, route);
  }
}

function mergeRuntimeBucket(target, runtime) {
  const samples = Math.max(0, Math.floor(Number(runtime?.samples) || 0));
  if (samples <= 0) return;
  target.runtimeSamples += samples;
  target.cpuTotalPercent += finiteNonNegative(runtime?.cpuAveragePercent) * samples;
  target.cpuMaxPercent = Math.max(target.cpuMaxPercent, finiteNonNegative(runtime?.cpuMaxPercent));
  target.rssMaxBytes = Math.max(finiteNonNegative(target.rssMaxBytes), finiteNonNegative(runtime?.rssMaxBytes));
  target.heapUsedMaxBytes = Math.max(finiteNonNegative(target.heapUsedMaxBytes), finiteNonNegative(runtime?.heapUsedMaxBytes));
  target.heapTotalMaxBytes = Math.max(finiteNonNegative(target.heapTotalMaxBytes), finiteNonNegative(runtime?.heapTotalMaxBytes));
}

function mergeTrendAccumulator(target, source) {
  target.windowMs += source.windowMs;
  target.requestCount += source.requestCount;
  target.clientErrorCount += source.clientErrorCount;
  target.serverErrorCount += source.serverErrorCount;
  target.weightedDuration += source.weightedDuration;
  mergeLatencyHistograms(target.durationHistogram, source.durationHistogram);
  target.p50FallbackMs = Math.max(target.p50FallbackMs, source.p50FallbackMs);
  target.p95FallbackMs = Math.max(target.p95FallbackMs, source.p95FallbackMs);
  target.p99FallbackMs = Math.max(target.p99FallbackMs, source.p99FallbackMs);
  target.maxDurationMs = Math.max(target.maxDurationMs, source.maxDurationMs);
  target.weightedResponseBytes += source.weightedResponseBytes;
  target.maxResponseBytes = Math.max(target.maxResponseBytes, source.maxResponseBytes);
  target.eventLoopP50Ms = Math.max(target.eventLoopP50Ms, source.eventLoopP50Ms);
  target.eventLoopP95Ms = Math.max(target.eventLoopP95Ms, source.eventLoopP95Ms);
  target.eventLoopP99Ms = Math.max(target.eventLoopP99Ms, source.eventLoopP99Ms);
  target.eventLoopMaxMs = Math.max(target.eventLoopMaxMs, source.eventLoopMaxMs);
  target.runtimeSamples += source.runtimeSamples;
  target.cpuTotalPercent += source.cpuTotalPercent;
  target.cpuMaxPercent = Math.max(target.cpuMaxPercent, source.cpuMaxPercent);
  target.rssMaxBytes = Math.max(finiteNonNegative(target.rssMaxBytes), finiteNonNegative(source.rssMaxBytes));
  target.heapUsedMaxBytes = Math.max(finiteNonNegative(target.heapUsedMaxBytes), finiteNonNegative(source.heapUsedMaxBytes));
  target.heapTotalMaxBytes = Math.max(finiteNonNegative(target.heapTotalMaxBytes), finiteNonNegative(source.heapTotalMaxBytes));
  for (const [key, sourceRoute] of source.routes) {
    const route = target.routes.get(key) || createRouteAccumulator(sourceRoute);
    mergeRouteEntry(route, routeSnapshot(sourceRoute));
    target.routes.set(key, route);
  }
}

function trendPercentile(bucket, ratio, fallback) {
  const percentile = latencyHistogramPercentile(bucket.durationHistogram, ratio);
  return percentile > 0 ? percentile : round(fallback);
}

function publicTrendBucket(bucket) {
  return {
    startsAt: bucket.startsAt,
    endsAt: bucket.endsAt,
    requestCount: bucket.requestCount,
    serverErrorCount: bucket.serverErrorCount,
    p50DurationMs: trendPercentile(bucket, 0.5, bucket.p50FallbackMs),
    p95DurationMs: trendPercentile(bucket, 0.95, bucket.p95FallbackMs),
    p99DurationMs: trendPercentile(bucket, 0.99, bucket.p99FallbackMs),
    eventLoopP50Ms: round(bucket.eventLoopP50Ms),
    eventLoopP95Ms: round(bucket.eventLoopP95Ms),
    eventLoopP99Ms: round(bucket.eventLoopP99Ms),
    eventLoopMaxMs: round(bucket.eventLoopMaxMs),
    cpuAveragePercent: bucket.runtimeSamples > 0 ? round(bucket.cpuTotalPercent / bucket.runtimeSamples) : null,
    cpuMaxPercent: bucket.runtimeSamples > 0 ? round(bucket.cpuMaxPercent) : null,
    rssMaxBytes: bucket.runtimeSamples > 0 ? Math.round(bucket.rssMaxBytes) : null,
    heapUsedMaxBytes: bucket.runtimeSamples > 0 ? Math.round(bucket.heapUsedMaxBytes) : null,
    heapTotalMaxBytes: bucket.runtimeSamples > 0 ? Math.round(bucket.heapTotalMaxBytes) : null,
  };
}

function appendBounded(history, value, limit) {
  history.push(value);
  if (history.length > limit) history.splice(0, history.length - limit);
}

function mergeIntoRollup(history, limit, bucketMs, source) {
  const startsAt = bucketStart(source.startsAt, bucketMs);
  let target = history.at(-1);
  if (!target || target.startsAt !== startsAt) {
    target = createTrendAccumulator(startsAt, bucketMs);
    appendBounded(history, target, limit);
  }
  mergeTrendAccumulator(target, source);
}

function requestWindowMinuteStart(window) {
  const endedAt = finiteNonNegative(window?.windowEndedAt);
  const startedAt = finiteNonNegative(window?.windowStartedAt);
  return minuteStart(Math.max(startedAt, endedAt > 0 ? endedAt - 1 : startedAt));
}

export function installServerRuntimeMetrics({
  sampleMs = DEFAULT_SAMPLE_MS,
  historyMinutes = DEFAULT_HISTORY_MINUTES,
  now = Date.now,
  performanceNow = performance.now.bind(performance),
  cpuUsage = process.cpuUsage.bind(process),
  memoryUsage = process.memoryUsage.bind(process),
  requestSnapshot = getRequestMetricsSnapshot,
} = {}) {
  if (globalThis[INSTALLATION_KEY]) return globalThis[INSTALLATION_KEY];

  const startedAt = now();
  const historyLimit = Math.max(1, Math.floor(Number(historyMinutes) || DEFAULT_HISTORY_MINUTES));
  const runtimeBuckets = [];
  const minuteTrendHistory = [];
  const hourTrendHistory = [];
  const dayTrendHistory = [];
  const capturedRequestWindows = new Set();
  let previousCpu = cpuUsage();
  let previousPerformanceAt = performanceNow();
  let lastSampleAt = 0;

  function runtimeForMinute(startsAt) {
    const exact = runtimeBuckets.find((bucket) => bucket.startsAt === startsAt);
    return exact ? runtimeBucketSnapshot(exact) : null;
  }

  function captureCompletedRequestWindows() {
    const snapshot = requestSnapshot(REQUEST_CAPTURE_RANGE_MS);
    for (const window of snapshot.history || []) {
      const key = `${window.windowStartedAt}:${window.windowEndedAt}`;
      if (capturedRequestWindows.has(key)) continue;
      capturedRequestWindows.add(key);
      if (capturedRequestWindows.size > 512) capturedRequestWindows.delete(capturedRequestWindows.values().next().value);
      const startsAt = requestWindowMinuteStart(window);
      const minute = createTrendAccumulator(startsAt, MINUTE_MS);
      mergeRequestWindow(minute, window);
      mergeRuntimeBucket(minute, runtimeForMinute(startsAt));
      appendBounded(minuteTrendHistory, minute, MINUTE_TREND_LIMIT);
      mergeIntoRollup(hourTrendHistory, HOUR_TREND_LIMIT, HOUR_MS, minute);
      mergeIntoRollup(dayTrendHistory, DAY_TREND_LIMIT, DAY_MS, minute);
    }
  }

  function sample() {
    const sampledAt = now();
    const performanceAt = performanceNow();
    const nextCpu = cpuUsage();
    const elapsedMs = Math.max(1, performanceAt - previousPerformanceAt);
    const cpuMicros = Math.max(0, nextCpu.user - previousCpu.user) + Math.max(0, nextCpu.system - previousCpu.system);
    const cpuPercent = Math.min(100, round((cpuMicros / 1_000 / elapsedMs) * 100));
    previousCpu = nextCpu;
    previousPerformanceAt = performanceAt;
    lastSampleAt = sampledAt;

    const memory = memoryUsage();
    const startsAt = minuteStart(sampledAt);
    let bucket = runtimeBuckets.at(-1);
    if (!bucket || bucket.startsAt !== startsAt) {
      bucket = {
        startsAt,
        endsAt: sampledAt,
        samples: 0,
        cpuTotalPercent: 0,
        cpuMaxPercent: 0,
        rssTotalBytes: 0,
        rssMaxBytes: 0,
        heapUsedTotalBytes: 0,
        heapUsedMaxBytes: 0,
        heapTotalMaxBytes: 0,
      };
      runtimeBuckets.push(bucket);
      if (runtimeBuckets.length > historyLimit) runtimeBuckets.splice(0, runtimeBuckets.length - historyLimit);
    }
    bucket.endsAt = sampledAt;
    bucket.samples += 1;
    bucket.cpuTotalPercent += cpuPercent;
    bucket.cpuMaxPercent = Math.max(bucket.cpuMaxPercent, cpuPercent);
    bucket.rssTotalBytes += finiteNonNegative(memory.rss);
    bucket.rssMaxBytes = Math.max(bucket.rssMaxBytes, finiteNonNegative(memory.rss));
    bucket.heapUsedTotalBytes += finiteNonNegative(memory.heapUsed);
    bucket.heapUsedMaxBytes = Math.max(bucket.heapUsedMaxBytes, finiteNonNegative(memory.heapUsed));
    bucket.heapTotalMaxBytes = Math.max(bucket.heapTotalMaxBytes, finiteNonNegative(memory.heapTotal));
    captureCompletedRequestWindows();
    return runtimeBucketSnapshot(bucket);
  }

  sample();
  const timer = setInterval(sample, Math.max(1_000, Number(sampleMs) || DEFAULT_SAMPLE_MS));
  timer.unref();

  const installation = {
    startedAt,
    sample,
    snapshot({ rangeKey = '1h', requestMetricsSnapshot } = {}) {
      const generatedAt = now();
      if (generatedAt - lastSampleAt >= 1_000) sample();
      captureCompletedRequestWindows();
      const normalizedRange = normalizeServerStatusRange(rangeKey);
      const range = SERVER_STATUS_RANGES[normalizedRange];
      const requestMetrics = requestMetricsSnapshot || requestSnapshot(range.milliseconds);
      const source = normalizedRange === '1h'
        ? minuteTrendHistory
        : normalizedRange === '1d' ? hourTrendHistory : dayTrendHistory;
      const trendBuckets = source.map(cloneTrendAccumulator);
      if (requestMetrics.current) {
        const liveStart = bucketStart(generatedAt, range.bucketMilliseconds);
        const live = createTrendAccumulator(liveStart, range.bucketMilliseconds);
        mergeRequestWindow(live, requestMetrics.current);
        mergeRuntimeBucket(live, runtimeForMinute(minuteStart(generatedAt)));
        const existing = trendBuckets.at(-1);
        if (existing?.startsAt === live.startsAt) mergeTrendAccumulator(existing, live);
        else trendBuckets.push(live);
      }
      const cutoff = generatedAt - range.milliseconds;
      const filteredTrendBuckets = trendBuckets
        .filter((bucket) => bucket.endsAt > cutoff)
        .sort((left, right) => left.startsAt - right.startsAt);
      const runtimeHistory = runtimeBuckets
        .filter((bucket) => bucket.endsAt >= generatedAt - Math.max(3 * MINUTE_MS, range.milliseconds))
        .map(runtimeBucketSnapshot);
      const memory = memoryUsage();
      return {
        generatedAt,
        startedAt,
        uptimeSeconds: Math.max(0, Math.floor((generatedAt - startedAt) / 1_000)),
        current: {
          cpuPercent: runtimeHistory.at(-1)?.cpuAveragePercent ?? 0,
          rssBytes: finiteNonNegative(memory.rss),
          heapUsedBytes: finiteNonNegative(memory.heapUsed),
          heapTotalBytes: finiteNonNegative(memory.heapTotal),
          externalBytes: finiteNonNegative(memory.external),
          arrayBuffersBytes: finiteNonNegative(memory.arrayBuffers),
          loadAverage1m: finiteNonNegative(loadavg()[0]),
          totalMemoryBytes: finiteNonNegative(totalmem()),
          freeMemoryBytes: finiteNonNegative(freemem()),
        },
        history: runtimeHistory,
        trendBuckets: filteredTrendBuckets,
        trendHistory: filteredTrendBuckets.map(publicTrendBucket),
      };
    },
    uninstall() {
      clearInterval(timer);
      delete globalThis[INSTALLATION_KEY];
    },
  };
  globalThis[INSTALLATION_KEY] = installation;
  return installation;
}

export function getServerRuntimeMetricsSnapshot(rangeKey, requestMetricsSnapshot) {
  const installation = globalThis[INSTALLATION_KEY] || installServerRuntimeMetrics();
  return installation.snapshot({ rangeKey, requestMetricsSnapshot });
}

function aggregateRequestAccumulators(buckets, generatedAt) {
  const total = createTrendAccumulator(buckets[0]?.startsAt ?? generatedAt, Math.max(MINUTE_MS, generatedAt - (buckets[0]?.startsAt ?? generatedAt)));
  for (const bucket of buckets) mergeTrendAccumulator(total, bucket);
  const routes = [...total.routes.values()].map(routeSnapshot).sort((left, right) => (
    (right.averageDurationMs * right.count) - (left.averageDurationMs * left.count)
    || right.p95DurationMs - left.p95DurationMs
    || right.serverErrorCount - left.serverErrorCount
  ));
  const requestCount = total.requestCount;
  return {
    windowStartedAt: buckets[0]?.startsAt ?? generatedAt,
    windowEndedAt: buckets.at(-1)?.endsAt ?? generatedAt,
    requestCount,
    requestsPerSecond: total.windowMs > 0 ? round(requestCount / (total.windowMs / 1_000)) : 0,
    clientErrorCount: total.clientErrorCount,
    serverErrorCount: total.serverErrorCount,
    serverErrorRateBps: requestCount > 0 ? Math.round((total.serverErrorCount / requestCount) * 10_000) : 0,
    averageDurationMs: requestCount > 0 ? round(total.weightedDuration / requestCount) : 0,
    p50DurationMs: trendPercentile(total, 0.5, total.p50FallbackMs),
    p95DurationMs: trendPercentile(total, 0.95, total.p95FallbackMs),
    p99DurationMs: trendPercentile(total, 0.99, total.p99FallbackMs),
    maxDurationMs: round(total.maxDurationMs),
    averageResponseBytes: requestCount > 0 ? Math.round(total.weightedResponseBytes / requestCount) : 0,
    maxResponseBytes: Math.round(total.maxResponseBytes),
    eventLoop: {
      p50Ms: round(total.eventLoopP50Ms),
      p95Ms: round(total.eventLoopP95Ms),
      p99Ms: round(total.eventLoopP99Ms),
      maxMs: round(total.eventLoopMaxMs),
    },
    routes,
  };
}

function aggregateRequestWindows(snapshot) {
  const windows = [...(snapshot.history || []), ...(snapshot.current ? [snapshot.current] : [])];
  const accumulators = windows.map((window) => {
    const startsAt = requestWindowMinuteStart(window);
    const accumulator = createTrendAccumulator(startsAt, MINUTE_MS);
    mergeRequestWindow(accumulator, window);
    return accumulator;
  });
  return aggregateRequestAccumulators(accumulators, snapshot.generatedAt || Date.now());
}

function readDatabaseStatus(store, databasePath, statFileSystem = safeStatFs) {
  const databaseStat = safeStat(databasePath);
  const walStat = safeStat(`${databasePath}-wal`);
  const shmStat = safeStat(`${databasePath}-shm`);
  const fileSystem = statFileSystem(dirname(databasePath));
  const pageCount = Number(store.database.prepare('PRAGMA page_count').get()?.page_count || 0);
  const freelistCount = Number(store.database.prepare('PRAGMA freelist_count').get()?.freelist_count || 0);
  const pageSize = Number(store.database.prepare('PRAGMA page_size').get()?.page_size || 0);
  const journalMode = String(store.database.prepare('PRAGMA journal_mode').get()?.journal_mode || 'unknown');
  const synchronous = Number(store.database.prepare('PRAGMA synchronous').get()?.synchronous ?? -1);
  const world = store.database.prepare(`
    SELECT revision, updated_at, length(CAST(state_json AS BLOB)) AS world_json_bytes
    FROM economy_world WHERE id = 1
  `).get() || {};
  const diskBlockSize = Number(fileSystem?.bsize || 0);
  const diskTotalBytes = diskBlockSize * Number(fileSystem?.blocks || 0);
  const diskFreeBytes = diskBlockSize * Number(fileSystem?.bavail || fileSystem?.bfree || 0);
  const reclaimableBytes = Math.max(0, freelistCount * pageSize);
  return {
    databaseBytes: finiteNonNegative(databaseStat?.size),
    walBytes: finiteNonNegative(walStat?.size),
    shmBytes: finiteNonNegative(shmStat?.size),
    pageCount: finiteNonNegative(pageCount),
    pageSize: finiteNonNegative(pageSize),
    freelistCount: finiteNonNegative(freelistCount),
    reclaimableBytes,
    reclaimableRatioBps: pageCount > 0 ? Math.round((freelistCount / pageCount) * 10_000) : 0,
    journalMode,
    synchronous,
    lockTimeoutMs: 5_000,
    worldRevision: finiteNonNegative(world.revision),
    worldUpdatedAt: finiteNonNegative(world.updated_at),
    worldJsonBytes: finiteNonNegative(world.world_json_bytes),
    diskTotalBytes: finiteNonNegative(diskTotalBytes),
    diskFreeBytes: finiteNonNegative(diskFreeBytes),
    diskFreeRatioBps: diskTotalBytes > 0 ? Math.round((diskFreeBytes / diskTotalBytes) * 10_000) : 0,
  };
}

function healthStatus({ requests, runtime, scheduler, database }) {
  const critical = [];
  const warnings = [];
  const thresholds = SERVER_STATUS_THRESHOLDS;
  const heapBps = runtime.current.heapTotalBytes > 0
    ? Math.round((runtime.current.heapUsedBytes / runtime.current.heapTotalBytes) * 10_000)
    : 0;
  const recentCpu = runtime.history.slice(-3);
  const sustainedCpu = recentCpu.length >= 3
    ? Math.min(...recentCpu.map((bucket) => bucket.cpuAveragePercent))
    : runtime.current.cpuPercent;

  if (recentCpu.length >= 3 && sustainedCpu >= thresholds.cpuCriticalPercent) critical.push('进程 CPU 连续三分钟超过 90%');
  else if (recentCpu.length >= 3 && sustainedCpu >= thresholds.cpuWarningPercent) warnings.push('进程 CPU 连续三分钟超过 70%');

  if (heapBps >= thresholds.heapCriticalBps) critical.push('Node Heap 使用率超过 90%');
  else if (heapBps >= thresholds.heapWarningBps) warnings.push('Node Heap 使用率超过 75%');

  if (requests.eventLoop.p95Ms >= thresholds.eventLoopCriticalMs) critical.push('事件循环 P95 延迟超过 200ms');
  else if (requests.eventLoop.p95Ms >= thresholds.eventLoopWarningMs) warnings.push('事件循环 P95 延迟超过 50ms');

  if (requests.p95DurationMs >= thresholds.apiP95CriticalMs) critical.push('API P95 延迟超过 1500ms');
  else if (requests.p95DurationMs >= thresholds.apiP95WarningMs) warnings.push('API P95 延迟超过 500ms');

  if (requests.serverErrorRateBps >= thresholds.serverErrorCriticalBps) critical.push('API 5xx 比例超过 5%');
  else if (requests.serverErrorRateBps >= thresholds.serverErrorWarningBps) warnings.push('API 5xx 比例超过 1%');

  if (scheduler.lastLagMs >= thresholds.schedulerLagCriticalMs) critical.push('世界调度延迟超过 5 秒');
  else if (scheduler.lastLagMs >= thresholds.schedulerLagWarningMs) warnings.push('世界调度延迟超过 1 秒');

  if (
    database.diskFreeBytes > 0
    && (database.diskFreeBytes <= thresholds.diskFreeCriticalBytes || database.diskFreeRatioBps <= thresholds.diskFreeCriticalBps)
  ) critical.push('数据库磁盘剩余空间低于严重阈值');
  else if (
    database.diskFreeBytes > 0
    && (database.diskFreeBytes <= thresholds.diskFreeWarningBytes || database.diskFreeRatioBps <= thresholds.diskFreeWarningBps)
  ) warnings.push('数据库磁盘剩余空间低于警告阈值');

  if (database.walBytes >= thresholds.walCriticalBytes) critical.push('SQLite WAL 超过 256MiB');
  else if (database.walBytes >= thresholds.walWarningBytes) warnings.push('SQLite WAL 超过 128MiB');

  if (critical.length > 0) return { level: 'critical', reasons: [...critical, ...warnings] };
  if (warnings.length > 0) return { level: 'warning', reasons: warnings };
  if (runtime.history.length < 3 || requests.windowEndedAt <= requests.windowStartedAt) {
    return { level: 'collecting', reasons: ['运行指标仍在积累，暂不判定为正常'] };
  }
  return { level: 'healthy', reasons: ['当前指标未达到警告阈值'] };
}

export function normalizeServerStatusRange(value) {
  const key = String(value || '1h');
  return Object.hasOwn(SERVER_STATUS_RANGES, key) ? key : '1h';
}

function buildFallbackTrendHistory(requestSnapshot, runtimeSnapshot, generatedAt, range) {
  const buckets = new Map();
  const ensureBucket = (timestamp) => {
    const startsAt = bucketStart(timestamp, range.bucketMilliseconds);
    if (!buckets.has(startsAt)) buckets.set(startsAt, createTrendAccumulator(startsAt, range.bucketMilliseconds));
    return buckets.get(startsAt);
  };
  for (const window of [...(requestSnapshot.history || []), ...(requestSnapshot.current ? [requestSnapshot.current] : [])]) {
    mergeRequestWindow(ensureBucket(window.windowEndedAt || window.windowStartedAt), window);
  }
  for (const runtime of runtimeSnapshot.history || []) mergeRuntimeBucket(ensureBucket(runtime.startsAt), runtime);
  const cutoff = generatedAt - range.milliseconds;
  const trendBuckets = [...buckets.values()]
    .filter((bucket) => bucket.endsAt > cutoff)
    .sort((left, right) => left.startsAt - right.startsAt);
  return { trendBuckets, trendHistory: trendBuckets.map(publicTrendBucket) };
}

export function createAdminServerStatus({
  store,
  databasePath,
  range,
  now = Date.now,
  requestMetricsSnapshot,
  runtimeMetricsSnapshot,
  statFileSystem = safeStatFs,
} = {}) {
  const rangeKey = normalizeServerStatusRange(range);
  const rangeConfig = SERVER_STATUS_RANGES[rangeKey];
  const generatedAt = now();
  const requestSnapshot = requestMetricsSnapshot || getRequestMetricsSnapshot(rangeConfig.milliseconds);
  const runtime = runtimeMetricsSnapshot || getServerRuntimeMetricsSnapshot(rangeKey, requestSnapshot);
  const fallback = runtime.trendBuckets
    ? null
    : buildFallbackTrendHistory(requestSnapshot, runtime, generatedAt, rangeConfig);
  const trendBuckets = runtime.trendBuckets || fallback.trendBuckets;
  const history = runtime.trendHistory || fallback.trendHistory;
  const requests = trendBuckets.length > 0
    ? aggregateRequestAccumulators(trendBuckets, generatedAt)
    : aggregateRequestWindows(requestSnapshot);
  const healthRequests = requestMetricsSnapshot
    ? aggregateRequestWindows(requestSnapshot)
    : aggregateRequestWindows(getRequestMetricsSnapshot(3 * MINUTE_MS));
  const database = readDatabaseStatus(store, databasePath, statFileSystem);
  const scheduler = {
    schedules: 0,
    wakeups: 0,
    processedWakeups: 0,
    staleWakeups: 0,
    transactions: 0,
    lastLagMs: 0,
    nextDueAt: null,
    ...(store.getSchedulerDiagnostics?.() || {}),
  };
  const releaseCandidate = String(process.env.ECONOMY_RELEASE_SHA || process.env.GITHUB_SHA || '');
  const releaseSha = /^[0-9a-f]{7,40}$/i.test(releaseCandidate) ? releaseCandidate.slice(0, 12) : null;
  const processStatus = {
    startedAt: runtime.startedAt,
    uptimeSeconds: runtime.uptimeSeconds,
    cpuPercent: runtime.current.cpuPercent,
    rssBytes: runtime.current.rssBytes,
    heapUsedBytes: runtime.current.heapUsedBytes,
    heapTotalBytes: runtime.current.heapTotalBytes,
    externalBytes: runtime.current.externalBytes,
    arrayBuffersBytes: runtime.current.arrayBuffersBytes,
    nodeVersion: process.version,
    releaseSha,
  };
  const system = {
    platform: platform(),
    cpuCount: cpus().length,
    loadAverage1m: runtime.current.loadAverage1m,
    totalMemoryBytes: runtime.current.totalMemoryBytes,
    freeMemoryBytes: runtime.current.freeMemoryBytes,
    diskTotalBytes: database.diskTotalBytes,
    diskFreeBytes: database.diskFreeBytes,
    diskFreeRatioBps: database.diskFreeRatioBps,
  };
  const health = healthStatus({ requests: healthRequests, runtime, scheduler, database });
  return {
    generatedAt,
    range: {
      key: rangeKey,
      milliseconds: rangeConfig.milliseconds,
      startsAt: generatedAt - rangeConfig.milliseconds,
      bucketMilliseconds: rangeConfig.bucketMilliseconds,
      granularity: rangeConfig.granularity,
    },
    health,
    thresholds: SERVER_STATUS_THRESHOLDS,
    process: processStatus,
    system,
    requests: { ...requests, routes: requests.routes.slice(0, 20) },
    scheduler,
    database,
    history,
  };
}
