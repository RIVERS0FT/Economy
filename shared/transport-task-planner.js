/** Bounded, deterministic task allocation. This module never mutates inventory. */
export const TRANSPORT_TASK_LIMIT = 100;
export const TRANSPORT_TASK_ROUTE_LIMIT = 12;
export const TRANSPORT_TASK_HISTORY_LIMIT = 30;
export const TRANSPORT_FREIGHT_DAILY_BUDGET = 10000;
export const TRANSPORT_TASK_BUDGET_LIMIT = 1000000000;
export const TRANSPORT_TASK_QUANTITY_LIMIT = 1000000000;
export const TRANSPORT_TASK_DAY_MS = 86400000;

export function taskStockKey(provinceId, productId) {
  return JSON.stringify([provinceId, productId]);
}

export function transportTaskSpan(traversal, sourceProvinceId, destinationProvinceId) {
  if (!Array.isArray(traversal) || sourceProvinceId === destinationProvinceId) return null;
  const sourceVisitIndex = traversal.indexOf(sourceProvinceId);
  if (sourceVisitIndex < 0 || sourceVisitIndex >= traversal.length - 1) return null;
  const destinationVisitIndex = traversal.indexOf(destinationProvinceId, sourceVisitIndex + 1);
  return destinationVisitIndex > sourceVisitIndex ? { sourceVisitIndex, destinationVisitIndex } : null;
}

function safeQuantity(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** Reserved stock is usable by its own task only. Shared stock is consumed once. */
export function allocateTransportTasks({ traversal, capacity, requests, stock = {} }) {
  if (!Array.isArray(traversal) || traversal.length < 2 || traversal.length > 95
    || !Number.isSafeInteger(capacity) || capacity < 1 || !Array.isArray(requests)
    || requests.length > TRANSPORT_TASK_ROUTE_LIMIT) {
    return { allocations: [], peakLoad: 0, transportedQuantity: 0 };
  }
  const legLoads = Array(traversal.length - 1).fill(0);
  const pools = new Map(Object.entries(stock).map(([key, value]) => [key, safeQuantity(value)]));
  const ordered = [...requests].sort((a, b) =>
    (a.priority ?? 1) - (b.priority ?? 1)
    || (a.deadlineAt ?? Number.MAX_SAFE_INTEGER) - (b.deadlineAt ?? Number.MAX_SAFE_INTEGER)
    || String(a.id).localeCompare(String(b.id)));
  const seen = new Set();
  const allocations = [];
  let transportedQuantity = 0;
  for (const request of ordered) {
    if (!request?.id || seen.has(request.id)) continue;
    seen.add(request.id);
    const span = transportTaskSpan(traversal, request.sourceProvinceId, request.destinationProvinceId);
    if (!span) continue;
    const key = taskStockKey(request.sourceProvinceId, request.productId);
    const own = safeQuantity(request.reservedQuantity);
    const common = pools.get(key) ?? 0;
    const remaining = safeQuantity(request.remainingQuantity);
    const available = request.kind === 'freight'
      ? safeQuantity(request.escrowQuantity)
      : own + common;
    let free = capacity;
    for (let leg = span.sourceVisitIndex; leg < span.destinationVisitIndex; leg += 1) {
      free = Math.min(free, capacity - legLoads[leg]);
    }
    const quantity = Math.min(remaining, available, free);
    if (!Number.isSafeInteger(quantity) || quantity < 1) continue;
    if (request.kind !== 'freight') pools.set(key, common - Math.max(0, quantity - own));
    for (let leg = span.sourceVisitIndex; leg < span.destinationVisitIndex; leg += 1) legLoads[leg] += quantity;
    allocations.push({
      taskId: request.id, kind: request.kind, productId: request.productId,
      sourceProvinceId: request.sourceProvinceId, destinationProvinceId: request.destinationProvinceId,
      ...span, quantity,
    });
    transportedQuantity += quantity;
  }
  return { allocations, peakLoad: Math.max(0, ...legLoads), transportedQuantity };
}

/** Split an already determined cash cost exactly once, including empty return legs. */
export function allocateTransportTaskCost(allocations, legDistances, totalCost) {
  if (!Array.isArray(allocations) || allocations.length === 0) return [];
  const micros = Math.round(totalCost * 1000000);
  if (!Number.isSafeInteger(micros) || micros < 0) throw new RangeError('运输费用超出安全范围');
  const weights = allocations.map((entry) => {
    let distance = 0;
    for (let index = entry.sourceVisitIndex; index < entry.destinationVisitIndex; index += 1) {
      const leg = legDistances[index];
      if (!Number.isFinite(leg) || leg < 0) throw new RangeError('运输距离无效');
      distance += leg;
    }
    return Math.max(1, distance * entry.quantity);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;
  return allocations.map((entry, index) => {
    const share = index === allocations.length - 1
      ? micros - assigned : Math.floor(micros * (weights[index] / totalWeight));
    assigned += share;
    return { taskId: entry.taskId, cost: share / 1000000 };
  });
}

export function transportTaskGap(targetQuantity, localQuantity, incomingQuantity) {
  if (![targetQuantity, localQuantity, incomingQuantity].every((value) =>
    Number.isSafeInteger(value) && value >= 0)) return 0;
  return Math.max(0, targetQuantity - localQuantity - incomingQuantity);
}
