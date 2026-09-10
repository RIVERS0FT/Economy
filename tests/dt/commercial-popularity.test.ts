import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commercialCycleFootfall,
  commercialPopularityAfterCycle,
  commercialPopularityChange,
  commercialStarRating,
  normalizeCommercialPopularity,
} from '../../shared/commercial-popularity.js';

test('commercial popularity starts at one star through 20 and advances at each exact boundary', () => {
  for (const [popularity, star] of [[0, 1], [20, 1], [21, 2], [40, 2], [41, 3], [60, 3], [61, 4], [80, 4], [81, 5], [100, 5]]) {
    assert.equal(commercialStarRating(popularity), star);
  }
  assert.equal(normalizeCommercialPopularity(-1), 0);
  assert.equal(normalizeCommercialPopularity(101), 100);
  assert.equal(normalizeCommercialPopularity(20.9), 20);
});

test('footfall is driven by effective shops, service and purchased promotion coverage', () => {
  assert.deepEqual(commercialCycleFootfall({ count: 2, effectiveCount: 2, popularity: 0 }), {
    footfall: 200, targetFootfall: 200, starRating: 1,
  });
  assert.deepEqual(commercialCycleFootfall({ count: 2, effectiveCount: 2, popularity: 21, serviceLevel: 'premium' }), {
    footfall: 250, targetFootfall: 220, starRating: 2,
  });
  assert.deepEqual(commercialCycleFootfall({ count: 3, effectiveCount: 3, popularity: 41, promotionCoveredCount: 2 }), {
    footfall: 400, targetFootfall: 390, starRating: 3,
  });
});

test('footfall ratios determine bounded popularity changes', () => {
  for (const [footfall, target, change] of [[120, 100, 3], [100, 100, 2], [80, 100, 1], [50, 100, 0], [49, 100, -1], [0, 100, -2], [0, 0, 0]]) {
    assert.equal(commercialPopularityChange(footfall, target), change);
  }
  assert.equal(commercialPopularityAfterCycle(99, 3), 100);
  assert.equal(commercialPopularityAfterCycle(1, -2), 0);
});

test('commercial footfall rejects unsafe or contradictory counts', () => {
  for (const input of [
    { count: -1, effectiveCount: 0, popularity: 0 },
    { count: 1, effectiveCount: 2, popularity: 0 },
    { count: 1, effectiveCount: 1, popularity: 0, promotionCoveredCount: -1 },
    { count: Number.MAX_SAFE_INTEGER, effectiveCount: Number.MAX_SAFE_INTEGER, popularity: 0 },
  ]) assert.throws(() => commercialCycleFootfall(input), RangeError);
});
