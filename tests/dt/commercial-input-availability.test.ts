import assert from 'node:assert/strict';
import test from 'node:test';
import { commercialNextCycleAvailability } from '../../src/utils/commercialInputAvailability.ts';
import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../../src/types/commercial.ts';
import type { CommodityFreezeDetail, ProductInventory } from '../../src/types.ts';
const now = 1_800_000_000_000;
const type = { consumptionInputs: [{ productId: 'food', quantity: 2 }] } as CommercialBuildingTypeDefinition;
function group(extra = {}) { return { provinceId: '110000', commercialTypeId: 'convenience-store', count: 10,
  status: 'stopped', enabled: false, staffingRateBps: 5000, staffingUpdatedAt: now, staffingBatchCarryBps: 0, ...extra } as CommercialBuildingGroup; }
function inventories(available: number, frozen = 0) { return { food: { available, frozen } } as Record<string, ProductInventory>; }
function entry(kind: CommodityFreezeDetail['kind'], sourceId: string, quantity: number): CommodityFreezeDetail { return { kind, sourceId, quantity, label: 'fixture' }; }
test('half staffed demand uses integer effective operation rather than the entire cluster', () => {
  const result = commercialNextCycleAvailability(group(), type, inventories(12), {}, now);
  assert.equal(result.required?.food, 10);
  assert.equal(result.usable.food, 12);
});
test('only this regional commercial source can satisfy next cycle demand', () => {
  const details = { food: [entry('commercial', '110000:convenience-store', 20),
    entry('commercial', '120000:convenience-store', 20), entry('commercial', '110000:restaurant', 20),
    entry('production', '110000:convenience-store', 20), entry('contract', 'contract-1', 20), entry('legacy', 'unattributed', 20)] };
  const result = commercialNextCycleAvailability(group({ staffingRateBps: 10000 }), type, inventories(0, 120), details, now);
  assert.equal(result.required?.food, 20);
  assert.equal(result.usable.food, 20);
  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 100), { food: details.food.slice(1) }, now).usable.food, 0);
});
test('next running cycle projects staffing at its deadline and preserves locked inputs', () => {
  const value = group({ enabled: true, status: 'running', cycleActive: true, cycleStartedAt: now,
    cycleCompletesAt: now + 300000, pendingInputs: [{ productId: 'food', quantity: 10 }], pendingRevenue: 100 });
  const before = JSON.stringify(value);
  const result = commercialNextCycleAvailability(value, type, inventories(20), {}, now);
  assert.equal(result.required?.food, 20);
  assert.equal(JSON.stringify(value), before);
  assert.equal(commercialNextCycleAvailability(group({ count: 3, staffingBatchCarryBps: 5000 }), type, inventories(4), {}, now).required?.food, 4);
});
test('missing staffing and missing frozen attribution remain unknown while zero demand stays zero', () => {
  assert.equal(commercialNextCycleAvailability(group({ staffingRateBps: undefined }), type, inventories(0), {}, now).required, undefined);
  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 20), undefined, now).usable.food, null);
  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 20), { food: [] }, now).usable.food, null);
  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 20), { food: [entry('commercial', '110000:convenience-store', 10)] }, now).usable.food, null);
  assert.equal(commercialNextCycleAvailability(group({ staffingRateBps: 0 }), type, inventories(0), {}, now).required?.food, 0);
});
