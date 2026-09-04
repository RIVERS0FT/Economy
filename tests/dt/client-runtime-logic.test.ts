import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BACKGROUND_POLLING_RATE,
  DEFAULT_CONFIGURED_POLLING_RATE,
  IDLE_POLLING_RATE,
  effectivePollingRate,
  isConfiguredPollingRate,
  normalizeConfiguredPollingRate,
} from '../../src/app/adaptivePolling.js';
import {
  acknowledgeFacilityEnabledIntent,
  getFacilityEnabledIntent,
  reconcileFacilityEnabledIntent,
  rejectFacilityEnabledIntent,
  setFacilityEnabledIntent,
  subscribeFacilityEnabledIntent,
} from '../../src/app/immediateCommandIntent.ts';
import { canAcceptRevision } from '../../src/app/revisionGate.js';
import { buildAssetAllocation } from '../../src/utils/assetAllocation.ts';
import { findVisibleRange } from '../../src/utils/virtualListRange.ts';

test('asset allocation normalizes invalid values and preserves a 100 percent integer total', () => {
  assert.deepEqual(buildAssetAllocation(50.5, 49.5, 0), {
    cashShare: 51,
    commodityShare: 49,
    facilityShare: 0,
  });
  assert.deepEqual(buildAssetAllocation(1, 1, 1), {
    cashShare: 34,
    commodityShare: 33,
    facilityShare: 33,
  });
  assert.deepEqual(buildAssetAllocation(Number.NaN, 25, 75), {
    cashShare: 0,
    commodityShare: 25,
    facilityShare: 75,
  });
  assert.deepEqual(buildAssetAllocation(-1, 0, Number.POSITIVE_INFINITY), {
    cashShare: 0,
    commodityShare: 0,
    facilityShare: 0,
  });
});

test('virtual list range handles empty, clipped and boundary-aligned viewports', () => {
  assert.deepEqual(findVisibleRange([], 0, 100), { startIndex: 0, endIndex: 0 });
  const items = Array.from({ length: 10_000 }, (_, index) => ({ start: index * 20, size: 20 }));
  assert.deepEqual(findVisibleRange(items, 100_000, 100), { startIndex: 4_999, endIndex: 5_005 });
  assert.deepEqual(findVisibleRange(items, -1, 20), { startIndex: 0, endIndex: 1 });
  assert.deepEqual(findVisibleRange(items, 40, 0), { startIndex: 1, endIndex: 2 });
  assert.deepEqual(findVisibleRange(items, 200_000, 100), { startIndex: 9_999, endIndex: 10_000 });
});

test('revision gate accepts only monotonic integer authority revisions', () => {
  assert.equal(canAcceptRevision(null, 0), true);
  assert.equal(canAcceptRevision(7, 7), true);
  assert.equal(canAcceptRevision(7, 8), true);
  assert.equal(canAcceptRevision(7, 6), false);
  assert.equal(canAcceptRevision(7, 7.5), false);
  assert.equal(canAcceptRevision(7, undefined), false);
  assert.equal(canAcceptRevision(7, '8'), false);
});

test('adaptive polling normalizes configured values and prioritizes background and idle modes', () => {
  assert.equal(isConfiguredPollingRate('3'), true);
  assert.equal(isConfiguredPollingRate(10), true);
  assert.equal(isConfiguredPollingRate('15'), false);
  assert.equal(normalizeConfiguredPollingRate('3'), '3');
  assert.equal(normalizeConfiguredPollingRate('bad', '10'), '10');
  assert.equal(normalizeConfiguredPollingRate('bad', 'bad'), DEFAULT_CONFIGURED_POLLING_RATE);
  assert.equal(effectivePollingRate({ configuredRate: '3' }), '3');
  assert.equal(effectivePollingRate({ configuredRate: '3', idle: true }), IDLE_POLLING_RATE);
  assert.equal(effectivePollingRate({ configuredRate: '3', idle: true, hidden: true }), BACKGROUND_POLLING_RATE);
  assert.equal(effectivePollingRate(), DEFAULT_CONFIGURED_POLLING_RATE);
});

test('immediate facility intent lifecycle handles acknowledgement, reconciliation, rejection and subscriptions', () => {
  const provinceId = 'dt-province';
  const facilityTypeId = 'dt-facility';
  let notifications = 0;
  let secondaryNotifications = 0;

  const noListenerSequence = setFacilityEnabledIntent(provinceId, `${facilityTypeId}-no-listener`, true);
  rejectFacilityEnabledIntent(provinceId, `${facilityTypeId}-no-listener`, noListenerSequence);

  const unsubscribe = subscribeFacilityEnabledIntent(provinceId, facilityTypeId, () => {
    notifications += 1;
  });
  const unsubscribeSecondary = subscribeFacilityEnabledIntent(provinceId, facilityTypeId, () => {
    secondaryNotifications += 1;
  });

  const first = setFacilityEnabledIntent(provinceId, facilityTypeId, true);
  assert.equal(getFacilityEnabledIntent(provinceId, facilityTypeId), true);
  assert.equal(notifications, 1);
  assert.equal(secondaryNotifications, 1);

  reconcileFacilityEnabledIntent(provinceId, facilityTypeId, true);
  assert.equal(getFacilityEnabledIntent(provinceId, facilityTypeId), true);

  acknowledgeFacilityEnabledIntent(provinceId, facilityTypeId, first + 1, false);
  assert.equal(notifications, 1);
  acknowledgeFacilityEnabledIntent(provinceId, facilityTypeId, first, false);
  assert.equal(notifications, 2);
  reconcileFacilityEnabledIntent(provinceId, facilityTypeId, false);
  assert.equal(getFacilityEnabledIntent(provinceId, facilityTypeId), true);
  reconcileFacilityEnabledIntent(provinceId, facilityTypeId, true);
  assert.equal(getFacilityEnabledIntent(provinceId, facilityTypeId), null);
  assert.equal(notifications, 3);

  const second = setFacilityEnabledIntent(provinceId, facilityTypeId, false);
  const third = setFacilityEnabledIntent(provinceId, facilityTypeId, true);
  rejectFacilityEnabledIntent(provinceId, facilityTypeId, second);
  assert.equal(getFacilityEnabledIntent(provinceId, facilityTypeId), true);
  rejectFacilityEnabledIntent(provinceId, facilityTypeId, third);
  assert.equal(getFacilityEnabledIntent(provinceId, facilityTypeId), null);

  const fourth = setFacilityEnabledIntent(provinceId, facilityTypeId, false);
  acknowledgeFacilityEnabledIntent(provinceId, facilityTypeId, fourth, true);
  assert.equal(getFacilityEnabledIntent(provinceId, facilityTypeId), null);

  acknowledgeFacilityEnabledIntent(provinceId, facilityTypeId, fourth, true);
  reconcileFacilityEnabledIntent(provinceId, facilityTypeId, true);

  unsubscribeSecondary();
  const beforePrimaryOnly = notifications;
  const primaryOnly = setFacilityEnabledIntent(provinceId, facilityTypeId, true);
  assert.equal(notifications, beforePrimaryOnly + 1);
  assert.equal(secondaryNotifications, 7);
  rejectFacilityEnabledIntent(provinceId, facilityTypeId, primaryOnly);

  unsubscribe();
  unsubscribe();
  unsubscribeSecondary();
  const beforeDetachedMutation = notifications;
  const detached = setFacilityEnabledIntent(provinceId, facilityTypeId, true);
  rejectFacilityEnabledIntent(provinceId, facilityTypeId, detached);
  assert.equal(notifications, beforeDetachedMutation);
});
