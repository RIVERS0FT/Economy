import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

const storage = new AsyncLocalStorage();

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function createRequestPerformanceContext() {
  return {
    startedAt: performance.now(),
    phases: Object.create(null),
    gauges: Object.create(null),
  };
}

export function runWithRequestPerformance(context, callback) {
  return storage.run(context, callback);
}

export function requestPerformanceContext() {
  return storage.getStore() || null;
}

export function requestElapsedMs(context = requestPerformanceContext()) {
  if (!context?.startedAt) return 0;
  return Math.max(0, performance.now() - context.startedAt);
}

export function addRequestPhase(name, durationMs) {
  const context = requestPerformanceContext();
  if (!context) return;
  const key = String(name || 'other');
  context.phases[key] = finiteNonNegative(context.phases[key]) + finiteNonNegative(durationMs);
}

export function setRequestGauge(name, value) {
  const context = requestPerformanceContext();
  if (!context) return;
  const number = Number(value);
  if (!Number.isFinite(number)) return;
  context.gauges[String(name || 'other')] = number;
}

export function measureRequestPhase(name, callback) {
  const startedAt = performance.now();
  try {
    const result = callback();
    if (result && typeof result.then === 'function') {
      return result.finally(() => addRequestPhase(name, performance.now() - startedAt));
    }
    addRequestPhase(name, performance.now() - startedAt);
    return result;
  } catch (error) {
    addRequestPhase(name, performance.now() - startedAt);
    throw error;
  }
}

export function snapshotRequestPerformance(context = requestPerformanceContext()) {
  if (!context) return { phases: {}, gauges: {} };
  return {
    phases: Object.fromEntries(Object.entries(context.phases).map(([key, value]) => [key, finiteNonNegative(value)])),
    gauges: { ...context.gauges },
  };
}
