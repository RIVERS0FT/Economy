import assert from 'node:assert/strict';
import test from 'node:test';
import { commercialExpansionStaffingRate, commercialStaffingCapacity, hasCommercialCycle, projectCommercialStaffingRate } from '../../shared/commercial-staffing.js';

const at = 1_800_000_000_000;
test('commercial staffing uses the authoritative baseline and remains read only', () => {
  const running = { staffingRateBps: 0, staffingUpdatedAt: at, enabled: true, status: 'running' };
  assert.equal(projectCommercialStaffingRate(running, at + 300_000), 5000);
  assert.equal(projectCommercialStaffingRate(running, at + 600_000), 10000);
  assert.equal(projectCommercialStaffingRate(running, at - 1), 0);
  for (const status of ['stopped', 'error']) {
    assert.equal(projectCommercialStaffingRate({ ...running, staffingRateBps: 10000, status }, at + 900_000), 5000);
  }
  assert.equal(projectCommercialStaffingRate({ ...running, staffingRateBps: 10000, enabled: false }, at + 1_800_000), 0);
  assert.equal(running.staffingRateBps, 0);
});

test('missing or invalid commercial authority never becomes a fabricated 100 percent', () => {
  for (const group of [{}, { staffingRateBps: NaN, staffingUpdatedAt: at }, { staffingRateBps: 10000 },
    { staffingRateBps: -1, staffingUpdatedAt: at }, { staffingRateBps: 10001, staffingUpdatedAt: at }]) {
    assert.equal(projectCommercialStaffingRate(group, at), null);
  }
});

test('integer commercial capacity retains fractional work and supports safe large counts', () => {
  assert.deepEqual(commercialStaffingCapacity(1, 5000), { effectiveCount: 0, carryBps: 5000 });
  assert.deepEqual(commercialStaffingCapacity(1, 5000, 5000), { effectiveCount: 1, carryBps: 0 });
  assert.deepEqual(commercialStaffingCapacity(Number.MAX_SAFE_INTEGER, 10000, 9999), { effectiveCount: Number.MAX_SAFE_INTEGER, carryBps: 9999 });
  assert.throws(() => commercialStaffingCapacity(1, -1));
  assert.throws(() => commercialStaffingCapacity(1, 10000, 10000));
  assert.equal(commercialExpansionStaffingRate(9000, 2, 6), 3000);
});

test('zero-revenue recovery cycles are active, while absent legacy cycles are not', () => {
  assert.equal(hasCommercialCycle({ cycleActive: true, pendingRevenue: 0 }), true);
  assert.equal(hasCommercialCycle({ pendingRevenue: 12 }), true);
  assert.equal(hasCommercialCycle({ pendingRevenue: 0 }), false);
  assert.equal(hasCommercialCycle({}), false);
});
