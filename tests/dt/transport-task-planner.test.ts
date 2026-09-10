import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateTransportTasks, allocateTransportTaskCost, transportTaskGap, transportTaskSpan, taskStockKey } from '../../shared/transport-task-planner.js';

const supply = (id: string, source: string, destination: string, quantity: number, extra: Record<string, unknown> = {}) => ({
  id, kind: 'supply', productId: 'wheat', sourceProvinceId: source, destinationProvinceId: destination,
  remainingQuantity: quantity, reservedQuantity: 0, ...extra,
});

test('task cargo keeps its fixed destination through repeated visits', () => {
  assert.deepEqual(transportTaskSpan(['A', 'B', 'C', 'B', 'A'], 'C', 'A'), { sourceVisitIndex: 2, destinationVisitIndex: 4 });
  assert.equal(transportTaskSpan(['A', 'B'], 'B', 'A'), null);
  assert.equal(transportTaskSpan(['A', 'B', 'A'], 'A', 'A'), null);
});

test('two tasks cannot reserve the same available stock', () => {
  const result = allocateTransportTasks({ traversal: ['A', 'B', 'A'], capacity: 200,
    requests: [supply('one', 'A', 'B', 100), supply('two', 'A', 'B', 100)],
    stock: { [taskStockKey('A', 'wheat')]: 120 } });
  assert.equal(result.transportedQuantity, 120);
  assert.equal(result.peakLoad, 120);
});

test('one task cannot consume another task reservation', () => {
  const result = allocateTransportTasks({ traversal: ['A', 'B', 'A'], capacity: 200,
    requests: [supply('one', 'A', 'B', 100, { reservedQuantity: 60 }), supply('two', 'A', 'B', 100)], stock: {} });
  assert.deepEqual(result.allocations.map(({ taskId, quantity }: { taskId: string; quantity: number }) => [taskId, quantity]), [['one', 60]]);
});

test('freight uses external custody, competes for actual capacity and wins by deadline', () => {
  const result = allocateTransportTasks({ traversal: ['A', 'B', 'C', 'A'], capacity: 100,
    requests: [supply('supply', 'A', 'C', 100), supply('freight', 'A', 'B', 80,
      { kind: 'freight', priority: 0, deadlineAt: 1, escrowQuantity: 80 })],
    stock: { [taskStockKey('A', 'wheat')]: 100 } });
  assert.deepEqual(result.allocations.map(({ taskId, quantity }: { taskId: string; quantity: number }) => [taskId, quantity]), [['freight', 80], ['supply', 20]]);
  assert.equal(result.peakLoad, 100);
});

test('capacity is reusable after delivery, including the return journey', () => {
  const result = allocateTransportTasks({ traversal: ['A', 'B', 'C', 'B', 'A'], capacity: 100,
    requests: [supply('out', 'A', 'C', 100), supply('back', 'C', 'A', 100)],
    stock: { [taskStockKey('A', 'wheat')]: 100, [taskStockKey('C', 'wheat')]: 100 } });
  assert.equal(result.transportedQuantity, 200);
  assert.equal(result.peakLoad, 100);
});

test('cash allocation preserves every micro-unit without billing fuel twice', () => {
  const entries = [
    { taskId: 'a', sourceVisitIndex: 0, destinationVisitIndex: 1, quantity: 1 },
    { taskId: 'b', sourceVisitIndex: 0, destinationVisitIndex: 2, quantity: 1 },
    { taskId: 'c', sourceVisitIndex: 1, destinationVisitIndex: 2, quantity: 1 },
  ];
  const costs = allocateTransportTaskCost(entries, [100, 100], 1.000001);
  assert.equal(costs.reduce((sum: number, row: { cost: number }) => sum + Math.round(row.cost * 1e6), 0), 1000001);
  assert.throws(() => allocateTransportTaskCost(entries, [100, 100], Number.MAX_VALUE), RangeError);
});

test('existing stock and all incoming supply close the destination gap', () => {
  assert.equal(transportTaskGap(100, 30, 50), 20);
  assert.equal(transportTaskGap(100, 80, 50), 0);
  assert.equal(transportTaskGap(100, NaN, 0), 0);
});

test('duplicate identities, unsafe quantities and oversized routes never create cargo', () => {
  const request = supply('same', 'A', 'B', 100, { reservedQuantity: 50 });
  assert.equal(allocateTransportTasks({ traversal: ['A', 'B'], capacity: 100, requests: [request, request] }).transportedQuantity, 50);
  assert.equal(allocateTransportTasks({ traversal: ['A', 'B'], capacity: Infinity, requests: [request] }).transportedQuantity, 0);
  assert.equal(allocateTransportTasks({ traversal: Array(100).fill('A'), capacity: 100, requests: [request] }).transportedQuantity, 0);
});
