import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overviewOperations } from '../../src/utils/overviewOperations.ts';
import { tutorialFacility, tutorialTargetLocation } from '../../src/game-guide/tutorialContext.ts';
import { transportRecovery } from '../../src/transport/transportRecovery.ts';
import { playerPageLocationKey, tabForPlayerPageLocation } from '../../src/navigation/playerPageStack.ts';
import type { EconomyState, FacilityGroup } from '../../src/types.ts';

const group = (provinceId: string, status: FacilityGroup['status'], count: number, lifetimeOutput = 0) => ({
  provinceId, facilityTypeId: 'farm', status, count, lifetimeOutput, participatingCount: status === 'running' ? count : 0,
}) as FacilityGroup;
const ca = group('CA', 'running', 2, 12);
const tx = group('TX', 'error', 3, 25);
const game = {
  provinces: [{ id: 'CA' }, { id: 'TX' }], facilityGroups: [ca],
  provinceFacilityGroups: { CA: [ca], TX: [tx] },
  commercialBuildingGroups: [{ provinceId: 'CA', count: 4 }, { provinceId: 'ZZ', count: 99 }],
  transportRoutes: [{ id: 'route-1' }], productionContractSummary: { active: 2 },
} as unknown as EconomyState;

test('overview counts all regions once and keeps different business units separate', () => {
  assert.deepEqual(overviewOperations(game), {
    facilities: { total: 5, running: 2, error: 3, stopped: 0 }, commercialCount: 4, routeCount: 1, activeContracts: 2,
  });
  assert.equal(overviewOperations({ ...game, facilityGroups: [tx] }).facilities.total, 5);
  assert.equal(overviewOperations({ ...game, provinceFacilityGroups: { CA: [], TX: [tx] } }).facilities.total, 3);
  assert.equal(tutorialFacility({ ...game, provinceFacilityGroups: { CA: [], TX: [tx] } }, { provinceId: 'CA', facilityTypeId: 'farm' }), undefined);
});
test('tutorial resolves the exact region even when another region has more output', () => {
  assert.equal(tutorialFacility(game, { provinceId: 'CA', facilityTypeId: 'farm' }), ca);
  assert.equal(tutorialFacility(game, { provinceId: 'TX', facilityTypeId: 'farm' }), tx);
  assert.equal(tutorialFacility(game, { provinceId: 'ZZ', facilityTypeId: 'farm' }), undefined);
});
test('legacy ambiguous contexts never select an arbitrary same-type group', () => {
  assert.equal(tutorialFacility(game, { facilityTypeId: 'farm' }), undefined);
  assert.equal(tutorialFacility({ ...game, provinceFacilityGroups: { CA: [ca] } }, { facilityTypeId: 'farm' }), ca);
  assert.deepEqual(tutorialTargetLocation('start-facility', { facilityTypeId: 'farm' }, 'TX'), { type: 'global-building', facilityTypeId: 'farm' });
});
test('tutorial routes use the original operation region, not the current selection', () => {
  const context = { provinceId: 'CA', facilityTypeId: 'farm', productId: 'wheat' };
  assert.deepEqual(tutorialTargetLocation('build-facility', {}, 'TX'), { type: 'province', provinceId: 'TX', section: 'buildings' });
  for (const step of ['start-facility', 'complete-production', 'set-auto-sell'] as const) {
    assert.deepEqual(tutorialTargetLocation(step, context, 'TX'), { type: 'regional-facility', host: 'buildings', provinceId: 'CA', facilityTypeId: 'farm' });
  }
  assert.deepEqual(tutorialTargetLocation('complete-sale', context, 'TX'), { type: 'regional-product', host: 'market', provinceId: 'CA', productId: 'wheat' });
  assert.equal(tutorialTargetLocation('review-contracts', context, 'TX'), undefined);
});
test('status-scoped locations keep distinct keys and the existing buildings tab', () => {
  const a = { type: 'tab', tab: 'buildings', buildingKind: 'industrial', facilityStatus: 'error' } as const;
  assert.equal(tabForPlayerPageLocation(a), 'buildings');
  assert.notEqual(playerPageLocationKey(a), playerPageLocationKey({ type: 'tab', tab: 'buildings' }));
  assert.equal(playerPageLocationKey({ type: 'tab', tab: 'market' }), 'tab:market');
});
test('transport recovery navigates to the origin fuel market or bank without planning a purchase', () => {
  assert.deepEqual(transportRecovery('insufficient-fuel', 'TX'), { label: '前往采购燃料', location: { type: 'regional-product', host: 'market', provinceId: 'TX', productId: 'industrial-fuel' } });
  assert.deepEqual(transportRecovery('insufficient-funds', 'CA')?.location, { type: 'tab', tab: 'bank' });
  for (const reason of ['ready', 'price-boundary', 'quotes-not-ready', 'insufficient-profit']) assert.equal(transportRecovery(reason, 'CA'), null);
});

test('legacy tutorial context never redirects non-factory steps back to a factory', () => {
  for (const step of ['start-research', 'review-contracts', 'make-bank-deposit', 'review-leaderboard'] as const) {
    assert.equal(tutorialTargetLocation(step, { facilityTypeId: 'farm' }, '110000'), undefined);
  }
});
