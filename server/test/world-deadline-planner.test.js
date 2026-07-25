import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';
import {
  createWorldDeadlinePlan,
  nextConstructionEmploymentAt,
} from '../src/world-deadline-planner.js';

class FakeClock {
  constructor(now) {
    this.now = now;
    this.nextId = 1;
    this.timers = new Map();
    this.setTimeout = (callback, delay) => {
      const timer = {
        id: this.nextId++,
        dueAt: this.now + Math.max(0, Number(delay) || 0),
        callback,
        unref() {},
      };
      this.timers.set(timer.id, timer);
      return timer;
    };
    this.clearTimeout = (timer) => {
      if (timer?.id) this.timers.delete(timer.id);
    };
  }

  advance(milliseconds) {
    const target = this.now + milliseconds;
    let processed = 0;
    while (true) {
      const timer = [...this.timers.values()]
        .filter((entry) => entry.dueAt <= target)
        .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id)[0];
      if (!timer) break;
      this.timers.delete(timer.id);
      this.now = timer.dueAt;
      timer.callback();
      processed += 1;
      if (processed > 100) throw new Error('fake scheduler entered an immediate loop');
    }
    this.now = target;
  }
}

test('construction employment deadline is the next integer release boundary', () => {
  assert.equal(nextConstructionEmploymentAt({
    startedAt: 1_000,
    completesAt: 11_000,
    buildCost: 4,
    employmentReleased: 0,
  }), 3_500);
  assert.equal(nextConstructionEmploymentAt({
    startedAt: 1_000,
    completesAt: 11_000,
    buildCost: 4,
    employmentReleased: 3,
  }), 11_000);
});

test('world deadline planner selects the earliest authoritative event', () => {
  const now = 1_800_000_000_000;
  const world = createWorld(now);
  world.leaderboardState = {
    version: 1,
    periodKey: 'test',
    startsAt: now,
    endsAt: now + 60_000,
  };
  world.assetAuctions = [{ status: 'open', endsAt: now + 8_000 }];
  world.productionContracts = [{
    id: 'contract-test',
    publisherId: 1,
    buyerId: 1,
    supplierId: 2,
    status: 'active',
    quantityPerDelivery: 1,
    completedDeliveries: 0,
    totalDeliveries: 2,
    nextDueAt: now + 5_000,
  }];
  world.marketDemand.priceTransmission.lastCycleId = Math.floor(now / world.marketDemand.priceTransmission.cycleMs);
  for (const group of Object.values(world.marketDemand.groups)) group.nextDemandAt = now + 30_000;
  const plan = createWorldDeadlinePlan(world, now);
  assert.equal(plan.nextDueAt, now + 5_000);
  assert.equal(plan.deadlines.contract, now + 5_000);
});

test('deadline scheduler performs zero world transactions during a 60 second idle window', () => {
  const clock = new FakeClock(1_800_000_000_000);
  const store = new EconomyStore(':memory:', {
    scheduledProcessing: true,
    nowProvider: () => clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
  });
  try {
    clock.advance(0);
    store.resetSchedulerDiagnostics();
    const before = store.getSchedulerDiagnostics();
    assert.ok(before.nextDueAt > clock.now);
    clock.advance(60_000);
    const after = store.getSchedulerDiagnostics();
    assert.equal(after.transactions, 0);
    assert.equal(after.processedWakeups, 0);
  } finally {
    store.close();
  }
});

test('deadline scheduler wakes at the planned event and processes one world transaction', () => {
  const clock = new FakeClock(1_800_000_000_000);
  const store = new EconomyStore(':memory:', {
    scheduledProcessing: true,
    nowProvider: () => clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
  });
  try {
    clock.advance(0);
    store.resetSchedulerDiagnostics();
    const dueAt = store.getSchedulerDiagnostics().nextDueAt;
    assert.ok(Number.isFinite(dueAt));
    clock.advance(dueAt - clock.now);
    const diagnostics = store.getSchedulerDiagnostics();
    assert.equal(diagnostics.transactions, 1);
    assert.equal(diagnostics.processedWakeups, 1);
    assert.ok(diagnostics.lastLagMs >= 0);
  } finally {
    store.close();
  }
});
