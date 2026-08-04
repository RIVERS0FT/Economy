import { statSync, statfsSync } from 'node:fs';
import { cpus, freemem, loadavg, platform, totalmem } from 'node:os';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { getRequestMetricsSnapshot } from './request-metrics.js';

const INSTALLATION_KEY = Symbol.for('riversoft.economy.serverRuntimeMetrics');
const MINUTE_MS = 60_000;
const DEFAULT_SAMPLE_MS = 5_000;
const DEFAULT_HISTORY_MINUTES = 360;

export const SERVER_STATUS_RANGES = Object.freeze({
  '15m': 15 * MINUTE_MS,
  '1h': 60 * MINUTE_MS,
  '6h': 360 * MINUTE_MS,
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

function minuteStart(value) {
  return Math.floor(finiteNonNegative(value) / MINUTE_MS) * MINUTE_MS;
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

export function installServerRuntimeMetrics({
  sampleMs = DEFAULT_SAMPLE_MS,
  historyMinutes = DEFAULT_HISTORY_MINUTES,
  now = Date.now,
  performanceNow = performance.now.bind(performance),
  cpuUsage = process.cpuUsage.bind(process),
  memoryUsage = process.memoryUsage.bind(process),
} = {}) {
  if (globalThis[INSTALLATION_KEY]) return globalThis[INSTALLATION_KEY];

  const startedAt = now();
  const historyLimit = Math.max(1, Math.floor(Number(historyMinutes) || DEFAULT_HISTORY_MINUTES));
  const buckets = [];
  let previousCpu = cpuUsage();
  let previousPerformanceAt = performanceNow();
  let lastSampleAt = 0;

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
    let bucket = buckets.at(-1);
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
      buckets.push(bucket);
      if (buckets.length > historyLimit) buckets.splice(0, buckets.length - historyLimit);
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
    return runtimeBucketSnapshot(bucket);
  }

  sample();
  const timer = setInterval(sample, Math.max(1_000, Number(sampleMs) || DEFAULT_SAMPLE_MS));
  timer.unref();

  const installation = {
    startedAt,
    sample,
    snapshot({ rangeMs = SERVER_STATUS_RANGES['6h'] } = {}) {
      const generatedAt = now();
      if (generatedAt - lastSampleAt >= 1_000) sample();
      const cutoff = generatedAt - Math.max(MINUTE_MS, Number(rangeMs) || MINUTE_MS);
      const history = buckets
        .filter((bucket) => bucket.endsAt >= cutoff)
        .map(runtimeBucketSnapshot);
      const memory = memoryUsage();
      return {
        generatedAt,
        startedAt,
        uptimeSeconds: Math.max(0, Math.floor((generatedAt - startedAt) / 1_000)),
        current: {
          cpuPercent: history.at(-1)?.cpuAveragePercent ?? 0,
          rssBytes: finiteNonNegative(memory.rss),
          heapUsedBytes: finiteNonNegative(memory.heapUsed),
          heapTotalBytes: finiteNonNegative(memory.heapTotal),
          externalBytes: finiteNonNegative(memory.external),
          arrayBuffersBytes: finiteNonNegative(memory.arrayBuffers),
          loadAverage1m: finiteNonNegative(loadavg()[0]),
          totalMemoryBytes: finiteNonNegative(totalmem()),
          freeMemoryBytes: finiteNonNegative(freemem()),
        },
        history,
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

export function getServerRuntimeMetricsSnapshot(rangeMs) {
  const installation = globalThis[INSTALLATION_KEY] || installServerRuntimeMetrics();
  return installation.snapshot({ rangeMs });
}

function aggregateRequestWindows(snapshot) {
  const windows = [...(snapshot.history || []), ...(snapshot.current ? [snapshot.current] : [])];
  const routes = new Map();
  let requestCount = 0;
  let clientErrorCount = 0;
  let serverErrorCount = 0;
  let weightedDuration = 0;
  let weightedResponseBytes = 0;
  let maxDurationMs = 0;
  let p50DurationMs = 0;
  let p95DurationMs = 0;
  let p99DurationMs = 0;
  let maxResponseBytes = 0;
  let eventLoopP50Ms = 0;
  let eventLoopP95Ms = 0;
  let eventLoopP99Ms = 0;
  let eventLoopMaxMs = 0;

  for (const window of windows) {
    const count = finiteNonNegative(window.requestCount);
    requestCount += count;
    clientErrorCount += finiteNonNegative(window.clientErrorCount);
    serverErrorCount += finiteNonNegative(window.serverErrorCount);
    weightedDuration += finiteNonNegative(window.averageDurationMs) * count;
    weightedResponseBytes += finiteNonNegative(window.averageResponseBytes) * count;
    maxDurationMs = Math.max(maxDurationMs, finiteNonNegative(window.maxDurationMs));
    p50DurationMs = Math.max(p50DurationMs, finiteNonNegative(window.p50DurationMs));
    p95DurationMs = Math.max(p95DurationMs, finiteNonNegative(window.p95DurationMs));
    p99DurationMs = Math.max(p99DurationMs, finiteNonNegative(window.p99DurationMs));
    maxResponseBytes = Math.max(maxResponseBytes, finiteNonNegative(window.maxResponseBytes));
    eventLoopP50Ms = Math.max(eventLoopP50Ms, finiteNonNegative(window.eventLoopDelay?.p50Ms));
    eventLoopP95Ms = Math.max(eventLoopP95Ms, finiteNonNegative(window.eventLoopDelay?.p95Ms));
    eventLoopP99Ms = Math.max(eventLoopP99Ms, finiteNonNegative(window.eventLoopDelay?.p99Ms));
    eventLoopMaxMs = Math.max(eventLoopMaxMs, finiteNonNegative(window.eventLoopDelay?.maxMs));

    for (const entry of window.routes || []) {
      const key = `${entry.method} ${entry.route}`;
      const current = routes.get(key) || {
        method: String(entry.method || 'GET'),
        route: String(entry.route || '/api/other'),
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
      const routeCount = finiteNonNegative(entry.count);
      current.count += routeCount;
      current.clientErrorCount += finiteNonNegative(entry.clientErrorCount);
      current.serverErrorCount += finiteNonNegative(entry.serverErrorCount ?? entry.errorCount);
      current.weightedDuration += finiteNonNegative(entry.averageDurationMs) * routeCount;
      current.p95DurationMs = Math.max(current.p95DurationMs, finiteNonNegative(entry.p95DurationMs));
      current.maxDurationMs = Math.max(current.maxDurationMs, finiteNonNegative(entry.maxDurationMs));
      current.weightedResponseBytes += finiteNonNegative(entry.averageResponseBytes) * routeCount;
      current.maxResponseBytes = Math.max(current.maxResponseBytes, finiteNonNegative(entry.maxResponseBytes));
      for (const [name, phase] of Object.entries(entry.phases || {})) {
        current.phases[name] = Math.max(finiteNonNegative(current.phases[name]), finiteNonNegative(phase?.p95Ms));
      }
      routes.set(key, current);
    }
  }

  const elapsedMs = windows.reduce((total, window) => total + finiteNonNegative(window.windowMs), 0);
  return {
    windowStartedAt: windows[0]?.windowStartedAt ?? snapshot.generatedAt,
    windowEndedAt: windows.at(-1)?.windowEndedAt ?? snapshot.generatedAt,
    requestCount,
    requestsPerSecond: elapsedMs > 0 ? round(requestCount / (elapsedMs / 1_000)) : 0,
    clientErrorCount,
    serverErrorCount,
    serverErrorRateBps: requestCount > 0 ? Math.round((serverErrorCount / requestCount) * 10_000) : 0,
    averageDurationMs: requestCount > 0 ? round(weightedDuration / requestCount) : 0,
    p50DurationMs: round(p50DurationMs),
    p95DurationMs: round(p95DurationMs),
    p99DurationMs: round(p99DurationMs),
    maxDurationMs: round(maxDurationMs),
    averageResponseBytes: requestCount > 0 ? Math.round(weightedResponseBytes / requestCount) : 0,
    maxResponseBytes: Math.round(maxResponseBytes),
    eventLoop: {
      p50Ms: round(eventLoopP50Ms),
      p95Ms: round(eventLoopP95Ms),
      p99Ms: round(eventLoopP99Ms),
      maxMs: round(eventLoopMaxMs),
    },
    routes: [...routes.values()].map((entry) => ({
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
    })).sort((left, right) => (
      (right.averageDurationMs * right.count) - (left.averageDurationMs * left.count)
      || right.p95DurationMs - left.p95DurationMs
      || right.serverErrorCount - left.serverErrorCount
    )),
  };
}

function readDatabaseStatus(store, databasePath) {
  const databaseStat = safeStat(databasePath);
  const walStat = safeStat(`${databasePath}-wal`);
  const shmStat = safeStat(`${databasePath}-shm`);
  const fileSystem = safeStatFs(dirname(databasePath));
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

function mergeHistory(requestSnapshot, runtimeSnapshot, generatedAt, rangeMs) {
  const buckets = new Map();
  const ensureBucket = (timestamp) => {
    const startsAt = minuteStart(timestamp);
    if (!buckets.has(startsAt)) {
      buckets.set(startsAt, {
        startsAt,
        requestCount: 0,
        serverErrorCount: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        eventLoopP95Ms: 0,
        eventLoopMaxMs: 0,
        cpuAveragePercent: null,
        cpuMaxPercent: null,
        rssMaxBytes: null,
        heapUsedMaxBytes: null,
        heapTotalMaxBytes: null,
      });
    }
    return buckets.get(startsAt);
  };

  for (const window of [...(requestSnapshot.history || []), ...(requestSnapshot.current ? [requestSnapshot.current] : [])]) {
    const bucket = ensureBucket(window.windowEndedAt || window.windowStartedAt);
    bucket.requestCount += finiteNonNegative(window.requestCount);
    bucket.serverErrorCount += finiteNonNegative(window.serverErrorCount);
    bucket.p50DurationMs = Math.max(bucket.p50DurationMs, finiteNonNegative(window.p50DurationMs));
    bucket.p95DurationMs = Math.max(bucket.p95DurationMs, finiteNonNegative(window.p95DurationMs));
    bucket.p99DurationMs = Math.max(bucket.p99DurationMs, finiteNonNegative(window.p99DurationMs));
    bucket.eventLoopP95Ms = Math.max(bucket.eventLoopP95Ms, finiteNonNegative(window.eventLoopDelay?.p95Ms));
    bucket.eventLoopMaxMs = Math.max(bucket.eventLoopMaxMs, finiteNonNegative(window.eventLoopDelay?.maxMs));
  }
  for (const runtime of runtimeSnapshot.history || []) {
    const bucket = ensureBucket(runtime.startsAt);
    bucket.cpuAveragePercent = runtime.cpuAveragePercent;
    bucket.cpuMaxPercent = runtime.cpuMaxPercent;
    bucket.rssMaxBytes = runtime.rssMaxBytes;
    bucket.heapUsedMaxBytes = runtime.heapUsedMaxBytes;
    bucket.heapTotalMaxBytes = runtime.heapTotalMaxBytes;
  }
  const cutoff = generatedAt - rangeMs;
  return [...buckets.values()]
    .filter((bucket) => bucket.startsAt >= minuteStart(cutoff))
    .sort((left, right) => left.startsAt - right.startsAt);
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
  const key = String(value || '15m');
  return Object.hasOwn(SERVER_STATUS_RANGES, key) ? key : '15m';
}

export function createAdminServerStatus({
  store,
  databasePath,
  range,
  now = Date.now,
  requestMetricsSnapshot,
  runtimeMetricsSnapshot,
} = {}) {
  const rangeKey = normalizeServerStatusRange(range);
  const rangeMs = SERVER_STATUS_RANGES[rangeKey];
  const generatedAt = now();
  const requestSnapshot = requestMetricsSnapshot || getRequestMetricsSnapshot(rangeMs);
  const runtime = runtimeMetricsSnapshot || getServerRuntimeMetricsSnapshot(rangeMs);
  const requests = aggregateRequestWindows(requestSnapshot);
  const database = readDatabaseStatus(store, databasePath);
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
  const history = mergeHistory(requestSnapshot, runtime, generatedAt, rangeMs);
  const health = healthStatus({ requests, runtime, scheduler, database });
  return {
    generatedAt,
    range: { key: rangeKey, milliseconds: rangeMs, startsAt: generatedAt - rangeMs },
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
