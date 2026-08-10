import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { resolveAction } from '../src/game-routes.js';
import { applyOnlineAutoSellPolicyAction } from '../src/online-auto-sell-policy.js';
import { EconomyStore } from '../src/storage.js';
import { createWarehouseSummary, ensureWarehouse } from '../src/warehouse.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const now = 1_700_000_000_000;

test('warehouse state is inventory-only and uses current client version', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, CURRENT_CLIENT_STATE_VERSION);
    assert.equal(state.version, 33);
    assert.equal(state.warehouseStoredQuantity, 0);
    assert.deepEqual(state.onlineAutoSellPolicies, {});
    for (const field of [
      'inventoryCapacity', 'warehouseLevel', 'warehouseUpgradeCost', 'warehouseNextCapacity',
      'warehouseNextCapacityIncrease', 'warehouseOrderReservedQuantity', 'warehouseContractReservedQuantity',
      'warehouseAuctionReservedQuantity', 'warehouseReservedQuantity', 'warehouseUsedCapacity', 'warehouseAvailableCapacity',
    ]) assert.equal(Object.hasOwn(state, field), false, field);
  } finally { store.close(); }
});

test('warehouse summary counts goods and exposes normalized auto-sell settings without capacity state', () => {
  const player = {
    userId: 1,
    inventoryCapacity: 999,
    warehouseLevel: 8,
    inventories: {
      wheat: { available: 25, frozen: 5 },
      steel: { available: 7, frozen: 3 },
    },
    onlineAutoSellPolicies: {
      wheat: { enabled: true, price: 8.25, minimumFreeInventory: 4 },
      unknown: { enabled: true, price: 1, minimumFreeInventory: 0 },
    },
  };
  const summary = createWarehouseSummary(player);
  assert.deepEqual(summary, {
    warehouseStoredQuantity: 40,
    onlineAutoSellPolicies: {
      wheat: { enabled: true, price: 8.25, minimumFreeInventory: 4 },
    },
  });
  assert.equal(Object.hasOwn(player, 'inventoryCapacity'), false);
  assert.equal(Object.hasOwn(player, 'warehouseLevel'), false);
});

test('saved auto-sell policy is included in formal client state', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.transaction(() => {
      const loaded = store.loadWorld(now);
      const player = ensurePlayer(loaded.world, alice, now);
      const result = applyOnlineAutoSellPolicyAction(loaded.world, alice, {
        productId: 'wheat',
        enabled: true,
        price: 7.5,
        minimumFreeInventory: 3,
      });
      assert.equal(result.ok, true);
      store.saveWorld(loaded.revision, loaded.world, now + 1);
      assert.equal(player.onlineAutoSellPolicies.wheat.price, 7.5);
    });

    const state = store.getState(alice, now + 2);
    assert.deepEqual(state.onlineAutoSellPolicies.wheat, {
      enabled: true,
      price: 7.5,
      minimumFreeInventory: 3,
    });
  } finally { store.close(); }
});

test('legacy capacity fields are removed when players are normalized', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.inventoryCapacity = 12_345;
  player.warehouseLevel = 99;
  ensureWarehouse(player);
  assert.equal(Object.hasOwn(player, 'inventoryCapacity'), false);
  assert.equal(Object.hasOwn(player, 'warehouseLevel'), false);
});

test('warehouse upgrade API is retired', () => {
  assert.equal(resolveAction('POST', '/api/game/warehouse/upgrade'), null);
});
