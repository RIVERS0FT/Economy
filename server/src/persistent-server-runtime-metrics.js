import { randomUUID } from 'node:crypto';
import {
  latencyHistogramPercentile,
  mergeLatencyHistograms,
} from './request-metrics.js';
import {
  installServerRuntimeMetrics,
  SERVER_STATUS_RANGES,
} from './server-status.js';
import {
  resolveServerMetricsDatabasePath,
  ServerMetricsStore,
  SERVER_METRICS_RETENTION,
} from './server-metrics-store.js';

const DEFAULT_PERSIST_INTERVAL_MS = 60_000;
const LATENCY_HISTOGRAM_BINS = 256;

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function round(value) {
  return Math.round(finiteNonNegative(value) * 100) / 100;
}

function emptyHistogram() {
  return Array.from({ length: LATENCY_HISTOGRAM_BINS }, () => 0);
}

function cloneHistogram(value) {
  const histogram = emptyHistogram();
  if (!Array.isArray(value)) return histogram;
  for (let index = 0; index < histogram.length; index += 1) {
    histogram[index] = Math.max(0, Math.floor(Number(value[index]) || 0));
  }
  return histogram;
}

function cloneRoute(route) {
  return {
    method: String(route?.method || 'GET'),
    route: String(route?.route || '/api/other'),
    count: finiteNonNegative(route?.count),
    clientErrorCount: finiteNonNegative(route?.clientErrorCount),
    serverErrorCount: finiteNonNegative(route?.serverErrorCount ?? route?.errorCount),
    weightedDuration: finiteNonNegative(route?.weightedDuration),
    p95DurationMs: finiteNonNegative(route?.p95DurationMs),
    maxDurationMs: finiteNonNegative(route?.maxDurationMs),
    weightedResponseBytes: finiteNonNegative(route?.weightedResponseBytes),
    maxResponseBytes: finiteNonNegative(route?.maxResponseBytes),
    phases: Object.fromEntries(Object.entries(route?.phases || {}).map(([name, duration]) => [
      String(name),
      finiteNonNegative(duration),
    ])),
  };
}

function routeEntries(routes) {
  if (routes instanceof Map) return [...routes.entries()];
  if (Array.isArray(routes)) {
    return routes.map((route) => [`${route?.method || 'GET'} ${route?.route || '/api/other'}`, route]);
  }
  return [];
}

export function serializeServerMetricBucket(bucket) {
  return {
    startsAt: finiteNonNegative(bucket?.startsAt),
    endsAt: finiteNonNegative(bucket?.endsAt),
    windowMs: finiteNonNegative(bucket?.windowMs),
    requestCount: finiteNonNegative(bucket?.requestCount),
    clientErrorCount: finiteNonNegative(bucket?.clientErrorCount),
    serverErrorCount: finiteNonNegative(bucket?.serverErrorCount),
    weightedDuration: finiteNonNegative(bucket?.weightedDuration),
    durationHistogram: cloneHistogram(bucket?.durationHistogram),
    p50FallbackMs: finiteNonNegative(bucket?.p50FallbackMs),
    p95FallbackMs: finiteNonNegative(bucket?.p95FallbackMs),
    p99FallbackMs: finiteNonNegative(bucket?.p99FallbackMs),
    maxDurationMs: finiteNonNegative(bucket?.maxDurationMs),
    weightedResponseBytes: finiteNonNegative(bucket?.weightedResponseBytes),
    maxResponseBytes: finiteNonNegative(bucket?.maxResponseBytes),
    eventLoopP50Ms: finiteNonNegative(bucket?.eventLoopP50Ms),
    eventLoopP95Ms: finiteNonNegative(bucket?.eventLoopP95Ms),
    eventLoopP99Ms: finiteNonNegative(bucket?.eventLoopP99Ms),
    eventLoopMaxMs: finiteNonNegative(bucket?.eventLoopMaxMs),
    runtimeSamples: finiteNonNegative(bucket?.runtimeSamples),
    cpuTotalPercent: finiteNonNegative(bucket?.cpuTotalPercent),
    cpuMaxPercent: finiteNonNegative(bucket?.cpuMaxPercent),
    rssMaxBytes: bucket?.rssMaxBytes == null ? null : finiteNonNegative(bucket.rssMaxBytes),
    heapUsedMaxBytes: bucket?.heapUsedMaxBytes == null ? null : finiteNonNegative(bucket.heapUsedMaxBytes),
    heapTotalMaxBytes: bucket?.heapTotalMaxBytes == null ? null : finiteNonNegative(bucket.heapTotalMaxBytes),
    routes: routeEntries(bucket?.routes).map(([, route]) => cloneRoute(route)),
  };
}

export function deserializeServerMetricBucket(payload) {
  const serialized = serializeServerMetricBucket(payload);
  return {
    ...serialized,
    routes: new Map(serialized.routes.map((route) => [`${route.method} ${route.route}`, route])),
  };
}

function mergeRoute(target, source) {
  target.count += finiteNonNegative(source?.count);
  target.clientErrorCount += finiteNonNegative(source?.clientErrorCount);
  target.serverErrorCount += finiteNonNegative(source?.serverErrorCount ?? source?.errorCount);
  target.weightedDuration += finiteNonNegative(source?.weightedDuration);
  target.p95DurationMs = Math.max(target.p95DurationMs, finiteNonNegative(source?.p95DurationMs));
  target.maxDurationMs = Math.max(target.maxDurationMs, finiteNonNegative(source?.maxDurationMs));
  target.weightedResponseBytes += finiteNonNegative(source?.weightedResponseBytes);
  target.maxResponseBytes = Math.max(target.maxResponseBytes, finiteNonNegative(source?.maxResponseBytes));
  for (const [name, duration] of Object.entries(source?.phases || {})) {
    target.phases[name] = Math.max(finiteNonNegative(target.phases[name]), finiteNonNegative(duration));
  }
}

export function mergeServerMetricBuckets(target, source) {
  const next = target || deserializeServerMetricBucket(source);
  if (!target) return next;
  next.startsAt = Math.min(finiteNonNegative(next.startsAt), finiteNonNegative(source?.startsAt));
  next.endsAt = Math.max(finiteNonNegative(next.endsAt), finiteNonNegative(source?.endsAt));
  next.windowMs += finiteNonNegative(source?.windowMs);
  next.requestCount += finiteNonNegative(source?.requestCount);
  next.clientErrorCount += finiteNonNegative(source?.clientErrorCount);
  next.serverErrorCount += finiteNonNegative(source?.serverErrorCount);
  next.weightedDuration += finiteNonNegative(source?.weightedDuration);
  mergeLatencyHistograms(next.durationHistogram, source?.durationHistogram);
  next.p50FallbackMs = Math.max(next.p50FallbackMs, finiteNonNegative(source?.p50FallbackMs));
  next.p95FallbackMs = Math.max(next.p95FallbackMs, finiteNonNegative(source?.p95FallbackMs));
  next.p99FallbackMs = Math.max(next.p99FallbackMs, finiteNonNegative(source?.p99FallbackMs));
  next.maxDurationMs = Math.max(next.maxDurationMs, finiteNonNegative(source?.maxDurationMs));
  next.weightedResponseBytes += finiteNonNegative(source?.weightedResponseBytes);
  next.maxResponseBytes = Math.max(next.maxResponseBytes, finiteNonNegative(source?.maxResponseBytes));
  next.eventLoopP50Ms = Math.max(next.eventLoopP50Ms, finiteNonNegative(source?.eventLoopP50Ms));
  next.eventLoopP95Ms = Math.max(next.eventLoopP95Ms, finiteNonNegative(source?.eventLoopP95Ms));
  next.eventLoopP99Ms = Math.max(next.eventLoopP99Ms, finiteNonNegative(source?.eventLoopP99Ms));
  next.eventLoopMaxMs = Math.max(next.eventLoopMaxMs, finiteNonNegative(source?.eventLoopMaxMs));
  next.runtimeSamples += finiteNonNegative(source?.runtimeSamples);
  next.cpuTotalPercent += finiteNonNegative(source?.cpuTotalPercent);
  next.cpuMaxPercent = Math.max(next.cpuMaxPercent, finiteNonNegative(source?.cpuMaxPercent));
  next.rssMaxBytes = Math.max(finiteNonNegative(next.rssMaxBytes), finiteNonNegative(source?.rssMaxBytes));
  next.heapUsedMaxBytes = Math.max(
    finiteNonNegative(next.heapUsedMaxBytes),
    finiteNonNegative(source?.heapUsedMaxBytes),
  );
  next.heapTotalMaxBytes = Math.max(
    finiteNonNegative(next.heapTotalMaxBytes),
    finiteNonNegative(source?.heapTotalMaxBytes),
  );
  for (const [key, sourceRoute] of routeEntries(source?.routes)) {
    const route = next.routes.get(key) || cloneRoute(sourceRoute);
    if (next.routes.has(key)) mergeRoute(route, sourceRoute);
    next.routes.set(key, route);
  }
  return next;
}

function trendPercentile(bucket, ratio, fallback) {
  const percentile = latencyHistogramPercentile(bucket.durationHistogram, ratio);
  return percentile > 0 ? percentile : round(fallback);
}

export function publicServerMetricBucket(bucket) {
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

function mergeBucketCollections(persistedRows, liveBuckets, cutoff) {
  const merged = new Map();
  const append = (bucket) => {
    const restored = deserializeServerMetricBucket(bucket);
    if (restored.endsAt <= cutoff) return;
    const existing = merged.get(restored.startsAt);
    merged.set(restored.startsAt, mergeServerMetricBuckets(existing, restored));
  };
  for (const row of persistedRows) append(row.payload);
  for (const bucket of liveBuckets || []) append(bucket);
  return [...merged.values()].sort((left, right) => left.startsAt - right.startsAt);
}

function releaseShaFromEnvironment(environment) {
  const candidate = String(environment.ECONOMY_RELEASE_SHA || environment.GITHUB_SHA || '').trim();
  return /^[0-9a-f]{7,40}$/i.test(candidate) ? candidate : null;
}

export function installPersistentServerRuntimeMetrics({
  installation = installServerRuntimeMetrics(),
  databasePath = resolveServerMetricsDatabasePath(),
  bootId = randomUUID(),
  now = Date.now,
  persistIntervalMs = DEFAULT_PERSIST_INTERVAL_MS,
  registerSignals = true,
  environment = process.env,
  warn = console.warn,
} = {}) {
  if (installation.persistence?.enabled) return installation;

  const store = new ServerMetricsStore(databasePath, { now });
  const startedAt = finiteNonNegative(installation.startedAt || now());
  const releaseSha = releaseShaFromEnvironment(environment);
  store.startBoot(bootId, startedAt, releaseSha);

  const originalSnapshot = installation.snapshot.bind(installation);
  const originalUninstall = installation.uninstall.bind(installation);
  let closed = false;

  function persist() {
    if (closed) return;
    const updatedAt = now();
    for (const [rangeKey, range] of Object.entries(SERVER_STATUS_RANGES)) {
      const snapshot = originalSnapshot({ rangeKey });
      const buckets = (snapshot.trendBuckets || []).map(serializeServerMetricBucket);
      store.upsertBuckets(bootId, range.granularity, buckets, updatedAt);
    }
    store.prune(updatedAt);
  }

  function persistSafely() {
    try {
      persist();
    } catch (error) {
      warn('Economy server metrics persistence failed', error);
    }
  }

  installation.snapshot = ({ rangeKey = '1h', ...options } = {}) => {
    const normalizedRangeKey = Object.hasOwn(SERVER_STATUS_RANGES, rangeKey) ? rangeKey : '1h';
    const range = SERVER_STATUS_RANGES[normalizedRangeKey];
    const live = originalSnapshot({ rangeKey: normalizedRangeKey, ...options });
    const generatedAt = finiteNonNegative(live.generatedAt || now());
    const cutoff = Math.max(0, generatedAt - range.milliseconds);
    const persistedRows = store.listBuckets(range.granularity, cutoff, { excludeBootId: bootId });
    const trendBuckets = mergeBucketCollections(persistedRows, live.trendBuckets, cutoff);
    return {
      ...live,
      trendBuckets,
      trendHistory: trendBuckets.map(publicServerMetricBucket),
      persistence: {
        enabled: true,
        historyStartedAt: trendBuckets[0]?.startsAt ?? generatedAt,
        retainedMilliseconds: SERVER_METRICS_RETENTION[range.granularity],
      },
    };
  };

  const timer = setInterval(persistSafely, Math.max(1_000, Number(persistIntervalMs) || DEFAULT_PERSIST_INTERVAL_MS));
  timer.unref();
  persistSafely();

  const beforeExitHandler = () => close();
  const signalHandler = () => {
    close();
    process.exit(0);
  };

  if (registerSignals) {
    process.once('beforeExit', beforeExitHandler);
    process.once('SIGTERM', signalHandler);
    process.once('SIGINT', signalHandler);
  }

  function close() {
    if (closed) return;
    persistSafely();
    closed = true;
    clearInterval(timer);
    if (registerSignals) {
      process.removeListener('beforeExit', beforeExitHandler);
      process.removeListener('SIGTERM', signalHandler);
      process.removeListener('SIGINT', signalHandler);
    }
    try {
      store.stopBoot(bootId, now());
    } finally {
      store.close();
      originalUninstall();
    }
  }

  installation.persist = persistSafely;
  installation.uninstall = close;
  installation.persistence = {
    enabled: true,
    bootId,
    databasePath,
    store,
  };
  return installation;
}
