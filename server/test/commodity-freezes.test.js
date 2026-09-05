import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adoptLegacyCommodityFreeze, assertCommodityFreezeInvariant, consumeBuildingCommodity,
  consumeCommodityFreeze, freezeCommodity, frozenForSource, releaseCommodityFreeze, transferCommodityFreeze,
} from '../src/commodity-freezes.js';

test('typed freezes conserve stock and can only be consumed by their owner', () => {
  const inventory = { available: 100, frozen: 0 };
  freezeCommodity(inventory, 'production', '110000:mill', 20);
  freezeCommodity(inventory, 'commercial', '110000:store', 10);
  freezeCommodity(inventory, 'contract', 'contract-1', 30);
  freezeCommodity(inventory, 'auction', 'auction-1', 5);
  assert.equal(inventory.available, 35);
  assert.equal(inventory.frozen, 65);
  assert.throws(() => consumeCommodityFreeze(inventory, 'production', '110000:mill', 21));
  consumeBuildingCommodity(inventory, 'production', '110000:mill', 25);
  assert.equal(inventory.available, 30);
  assert.equal(inventory.frozen, 45);
  assert.equal(frozenForSource(inventory, 'contract', 'contract-1'), 30);
  releaseCommodityFreeze(inventory, 'commercial', '110000:store', 10);
  assert.equal(inventory.available, 40);
  assertCommodityFreezeInvariant(inventory);
});

test('legacy classification does not manufacture, discard, or steal frozen goods', () => {
  const inventory = { available: 11, frozen: 40 };
  adoptLegacyCommodityFreeze(inventory, 'contract', 'c1', 20);
  adoptLegacyCommodityFreeze(inventory, 'contract', 'c1', 20);
  adoptLegacyCommodityFreeze(inventory, 'auction', 'a1', 10);
  assert.equal(inventory.frozen, 40);
  assert.equal(inventory.available, 11);
  assert.equal(frozenForSource(inventory, 'legacy', 'unattributed'), 10);
  assert.throws(() => adoptLegacyCommodityFreeze(inventory, 'contract', 'c2', 11));
  transferCommodityFreeze(inventory, 'contract', 'c1', 'c1-renewed', 20);
  assert.equal(frozenForSource(inventory, 'contract', 'c1-renewed'), 20);
  assertCommodityFreezeInvariant(inventory);
});

test('invalid ranges and shortages do not change balances', () => {
  const inventory = { available: 1, frozen: 0 };
  for (const n of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => freezeCommodity(inventory, 'production', 'g', n));
  }
  assert.throws(() => freezeCommodity(inventory, 'production', 'g', 2));
  assert.equal(inventory.available, 1);
  assert.equal(inventory.frozen, 0);
  freezeCommodity(inventory, 'production', 'g', 1);
  inventory.frozen = 2;
  assert.throws(() => assertCommodityFreezeInvariant(inventory));
});
