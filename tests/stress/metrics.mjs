function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].map(finiteNonNegative).sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Math.round(sorted[index] * 100) / 100;
}

function summarizeRecords(records) {
  const durations = records.map((record) => record.durationMs);
  const totalBytes = records.reduce((sum, record) => sum + record.responseBytes, 0);
  const unexpectedStatusCount = records.filter((record) => !record.expected).length;
  const timeoutCount = records.filter((record) => record.timeout).length;
  const serverErrorCount = records.filter((record) => record.statusCode >= 500).length;
  return {
    requests: records.length,
    successfulRequests: records.filter((record) => record.expected).length,
    unexpectedStatusCount,
    timeoutCount,
    serverErrorCount,
    averageMs: records.length === 0
      ? 0
      : Math.round(durations.reduce((sum, value) => sum + value, 0) / records.length * 100) / 100,
    p50Ms: percentile(durations, 0.5),
    p90Ms: percentile(durations, 0.9),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    maxMs: percentile(durations, 1),
    averageResponseBytes: records.length === 0 ? 0 : Math.round(totalBytes / records.length),
    maxResponseBytes: records.reduce((maximum, record) => Math.max(maximum, record.responseBytes), 0),
    statusCodes: Object.fromEntries([...new Set(records.map((record) => record.statusCode))]
      .sort((left, right) => left - right)
      .map((status) => [String(status), records.filter((record) => record.statusCode === status).length])),
  };
}

export class StressMetrics {
  constructor() {
    this.records = [];
  }

  record(entry) {
    this.records.push({
      method: String(entry.method || 'GET').toUpperCase(),
      route: String(entry.route || '/'),
      statusCode: Number(entry.statusCode) || 0,
      durationMs: finiteNonNegative(entry.durationMs),
      responseBytes: Math.floor(finiteNonNegative(entry.responseBytes)),
      expected: entry.expected === true,
      timeout: entry.timeout === true,
    });
  }

  summarize(durationMs) {
    const groups = new Map();
    for (const record of this.records) {
      const key = `${record.method} ${record.route}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    const durationSeconds = Math.max(0.001, finiteNonNegative(durationMs) / 1_000);
    const total = summarizeRecords(this.records);
    return {
      ...total,
      durationMs: finiteNonNegative(durationMs),
      requestsPerSecond: Math.round(total.requests / durationSeconds * 100) / 100,
      routes: Object.fromEntries([...groups.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, records]) => [key, summarizeRecords(records)])),
    };
  }
}

export function evaluateStressBudget(summary, budget) {
  const failures = [];
  if (summary.timeoutCount > Number(budget.maxTimeouts ?? 0)) {
    failures.push(`超时 ${summary.timeoutCount} 次，允许 ${budget.maxTimeouts ?? 0} 次`);
  }
  if (summary.serverErrorCount > Number(budget.maxServerErrors ?? 0)) {
    failures.push(`5xx ${summary.serverErrorCount} 次，允许 ${budget.maxServerErrors ?? 0} 次`);
  }
  if (summary.unexpectedStatusCount > Number(budget.maxUnexpectedStatuses ?? 0)) {
    failures.push(`非预期响应 ${summary.unexpectedStatusCount} 次，允许 ${budget.maxUnexpectedStatuses ?? 0} 次`);
  }
  if (summary.p95Ms > Number(budget.maxP95Ms)) {
    failures.push(`总 p95 ${summary.p95Ms}ms 超过 ${budget.maxP95Ms}ms`);
  }
  if (summary.p99Ms > Number(budget.maxP99Ms)) {
    failures.push(`总 p99 ${summary.p99Ms}ms 超过 ${budget.maxP99Ms}ms`);
  }
  for (const [route, routeBudget] of Object.entries(budget.routes || {})) {
    const routeSummary = summary.routes[route];
    if (!routeSummary) {
      failures.push(`缺少预算要求的路由指标 ${route}`);
      continue;
    }
    if (routeSummary.p95Ms > Number(routeBudget.maxP95Ms)) {
      failures.push(`${route} p95 ${routeSummary.p95Ms}ms 超过 ${routeBudget.maxP95Ms}ms`);
    }
    if (routeSummary.p99Ms > Number(routeBudget.maxP99Ms)) {
      failures.push(`${route} p99 ${routeSummary.p99Ms}ms 超过 ${routeBudget.maxP99Ms}ms`);
    }
  }
  return { passed: failures.length === 0, failures };
}
