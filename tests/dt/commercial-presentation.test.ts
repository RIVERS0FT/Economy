import assert from 'node:assert/strict';
import test from 'node:test';
import { commercialCycleProgress, commercialProfitPerMinute } from '../../src/utils/commercialPresentation.ts';

test('commercial per-building profit does not accidentally use group count', () => {
  const type = { cycleMs: 300_000, profitPerCycle: 2.5 };
  assert.equal(commercialProfitPerMinute(type), 0.5);
  assert.equal(commercialProfitPerMinute(type, 3), 1.5);
  for (const cycleMs of [0, -1, NaN, Infinity]) {
    assert.equal(commercialProfitPerMinute({ ...type, cycleMs }), 0);
  }
});

test('commercial progress uses locked server timestamps and waits at completion', () => {
  const group = { status: 'running' as const, cycleStartedAt: 0, cycleCompletesAt: 300_000 };
  assert.deepEqual(commercialCycleProgress(group, -100), { active: true, progress: 0, remaining: 300_100, waiting: false });
  assert.deepEqual(commercialCycleProgress(group, 150_000), { active: true, progress: 50, remaining: 150_000, waiting: false });
  for (const now of [300_000, 900_000]) {
    assert.deepEqual(commercialCycleProgress(group, now), { active: true, progress: 100, remaining: 0, waiting: true });
  }
  assert.deepEqual(group, { status: 'running', cycleStartedAt: 0, cycleCompletesAt: 300_000 });
});

test('stopped, invalid and missing commercial cycles never fabricate progress', () => {
  for (const group of [
    { status: 'stopped' as const, cycleStartedAt: 0, cycleCompletesAt: 300_000 },
    { status: 'error' as const },
    { status: 'running' as const },
    { status: 'running' as const, cycleStartedAt: 100, cycleCompletesAt: 100 },
    { status: 'running' as const, cycleStartedAt: NaN, cycleCompletesAt: Infinity },
  ]) assert.equal(commercialCycleProgress(group, 100).active, false);
});
