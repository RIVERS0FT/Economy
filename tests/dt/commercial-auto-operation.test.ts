import assert from 'node:assert/strict';
import test from 'node:test';
import { commercialAutoOperationPolicyFor, normalizeCommercialAutoOperationPolicy } from '../../shared/commercial-auto-operation.js';
import { commercialSettlementPresentation } from '../../src/utils/commercialSettlement.ts';
import { playerPageLocationKey, tabForPlayerPageLocation } from '../../src/navigation/playerPageStack.ts';
import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../../src/types/commercial';

const type: CommercialBuildingTypeDefinition = { id: 'convenience-store', name: '便利店', description: '', buildCost: 120,
  cycleMs: 300_000, operatingCost: 1.5, profitPerCycle: 2.5, systemValue: 120,
  consumptionInputs: [{ productId: 'food', quantity: 1 }, { productId: 'beverage', quantity: 1 }] };
const group: CommercialBuildingGroup = { commercialTypeId: type.id, provinceId: '110000', count: 3, participatingCount: 2,
  enabled: true, status: 'running', pendingRevenue: 101.25, pendingProfit: 5, pendingOperatingCost: 3,
  pendingInputValue: 93.25, pendingInputs: [{ productId: 'food', quantity: 2 }, { productId: 'beverage', quantity: 2 }],
  lifetimeRevenue: 200, lifetimeProfit: 25, lifetimeGoodsConsumed: 40 };

test('commercial policies reject coercion and invalid coverage', () => {
  for (const inputCoverageCycles of [1, 2, 3, 5]) assert.deepEqual(normalizeCommercialAutoOperationPolicy({ enabled: true, inputCoverageCycles }), { enabled: true, inputCoverageCycles });
  for (const value of [null, [], {}, { enabled: 1, inputCoverageCycles: 2 }, { enabled: true, inputCoverageCycles: '2' },
    ...[0, -1, 4, 6, 1.5, Infinity, NaN].map((inputCoverageCycles) => ({ enabled: true, inputCoverageCycles }))]) {
    assert.equal(normalizeCommercialAutoOperationPolicy(value), null);
  }
});

test('default commercial policy does not mutate a legacy group', () => {
  const legacy = {};
  assert.deepEqual(commercialAutoOperationPolicyFor(legacy), { enabled: true, inputCoverageCycles: 2 });
  assert.deepEqual(legacy, {});
  assert.ok(Object.isFrozen(commercialAutoOperationPolicyFor(legacy)));
});

test('running settlement ignores current price, count and catalog changes', () => {
  const before = structuredClone(group);
  const result = commercialSettlementPresentation({ ...group, count: 100 }, { ...type, operatingCost: 999 }, { food: { officialPrice: 999 }, beverage: { officialPrice: 999 } });
  assert.equal(result.revenue, 101.25); assert.equal(result.profit, 5);
  assert.equal(result.inputValue, 93.25); assert.equal(result.operatingCost, 3); assert.equal(result.count, 2);
  assert.deepEqual(result.inputs, group.pendingInputs);
  assert.deepEqual(group, before);
});

test('legacy invested cycle cannot fabricate missing locked detail', () => {
  const result = commercialSettlementPresentation({ ...group, pendingInputs: undefined, pendingOperatingCost: undefined, pendingInputValue: undefined }, type,
    { food: { officialPrice: 10 }, beverage: { officialPrice: 20 } });
  assert.equal(result.inputs, null); assert.equal(result.operatingCost, null); assert.equal(result.inputValue, null);
  assert.equal(result.revenue, group.pendingRevenue);
});

test('stopped preview uses full count and only real official prices', () => {
  const result = commercialSettlementPresentation({ ...group, status: 'stopped' }, type, { food: { officialPrice: 15 }, beverage: { officialPrice: 18 } });
  assert.equal(result.locked, false); assert.equal(result.count, 3); assert.equal(result.profit, 7.5);
  assert.equal(result.revenue, 111);
  assert.equal(commercialSettlementPresentation({ ...group, status: 'error' }, type, {}).revenue, null);
});

test('commercial page locations retain distinct hosts and identities', () => {
  const global = { type: 'global-commercial' as const, commercialTypeId: type.id };
  const region = { type: 'regional-commercial' as const, host: 'buildings' as const, commercialTypeId: type.id, provinceId: group.provinceId };
  assert.equal(tabForPlayerPageLocation(global), 'buildings');
  assert.equal(tabForPlayerPageLocation(region), 'buildings');
  assert.equal(tabForPlayerPageLocation({ ...region, host: 'province' }), 'province');
  assert.notEqual(playerPageLocationKey(global), playerPageLocationKey(region));
  assert.notEqual(playerPageLocationKey(region), playerPageLocationKey({ ...region, host: 'province' }));
});
