import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateCommodityFreezeSources, createCommodityFreezeClientState } from '../src/commodity-freeze-state.js';
import { assertCommodityFreezeInvariant, freezeCommodity, frozenForSource, mergeCommodityInventory, releaseLegacyOrderFreeze } from '../src/commodity-freezes.js';

const key = '110000:wheat';
function fixture() {
  return { players: { 1: { userId: 1, inventories: { [key]: { available: 7, frozen: 20, inTransit: 3 } } } },
    productionContracts: [{ id: 'c1', kind: 'supply', provinceId: '110000', productId: 'wheat', supplierId: 1,
      supplierReservedQuantity: 8, renewalProposal: { status: 'accepted', supplierReservedQuantity: 2 } }],
    assetAuctions: [{ id: 'a1', sellerId: 1, sellerType: 'player', escrowStatus: 'held',
      items: [{ provinceId: '110000', assetKind: 'commodity', assetId: 'wheat', quantity: 5 }] }] };
}

test('legacy source migration conserves assets, preserves unknown custody and is idempotent', () => {
  const world = fixture();
  migrateCommodityFreezeSources(world);
  const inv = world.players[1].inventories[key];
  assert.equal(inv.available, 7); assert.equal(inv.frozen, 20); assert.equal(inv.inTransit, 3);
  assert.equal(frozenForSource(inv, 'contract', 'c1'), 8);
  assert.equal(frozenForSource(inv, 'contract', 'c1:renewal'), 2);
  assert.equal(frozenForSource(inv, 'auction', 'a1'), 5);
  assert.equal(frozenForSource(inv, 'legacy', 'unattributed'), 5);
  const before = structuredClone(world);
  migrateCommodityFreezeSources(world);
  assert.deepEqual(world, before);
  const state = createCommodityFreezeClientState(world.players[1]);
  assert.equal(state.inventoryFreezeDetails[key].reduce((sum, e) => sum + e.quantity, 0), 20);
  assert.deepEqual(world, before, 'projection must not write ledger or assets');
});

test('overclaimed legacy amounts stay unknown instead of inventing source-owned goods', () => {
  const world = fixture(); world.players[1].inventories[key].frozen = 9;
  migrateCommodityFreezeSources(world);
  const inv = world.players[1].inventories[key];
  assert.equal(frozenForSource(inv, 'legacy', 'unattributed'), 9);
  assert.equal(frozenForSource(inv, 'contract', 'c1'), 0);
  assert.equal(inv.available, 7);
  assertCommodityFreezeInvariant(inv);
});

test('source maps survive regional alias merging and retired orders cannot release another business freeze', () => {
  const target = { available: 15, frozen: 0, inTransit: 2 };
  freezeCommodity(target, 'contract', 'c1', 10);
  mergeCommodityInventory(target, { available: 3, frozen: 4, inTransit: 1 });
  assert.equal(target.available, 8); assert.equal(target.frozen, 14); assert.equal(target.inTransit, 3);
  releaseLegacyOrderFreeze(target, 'removed-order', 100);
  assert.equal(target.available, 12); assert.equal(target.frozen, 10);
  assert.equal(frozenForSource(target, 'contract', 'c1'), 10);
  assertCommodityFreezeInvariant(target);
});

test('private projection refuses inconsistent totals and does not expose other players', () => {
  const world = fixture();
  const state = createCommodityFreezeClientState(world.players[1]);
  assert.equal(state.inventoryFreezeDetails[key][0].kind, 'legacy');
  assert.equal(Object.keys(state.inventoryFreezeDetails).length, 1);
  const inv = world.players[1].inventories[key];
  inv.freezes = { 'contract:c1': { kind: 'contract', sourceId: 'c1', quantity: 21 } };
  assert.throws(() => createCommodityFreezeClientState(world.players[1]));
});
