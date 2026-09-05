import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { resolveAction } from '../src/game-routes.js';
import { applyOnlineAutoTradePolicyAction } from '../src/online-auto-trade-policy.js';
import { EconomyStore } from '../src/storage.js';
import { createWarehouseSummary, ensureWarehouse } from '../src/warehouse.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const now = 1_700_000_000_000;

test('warehouse state is inventory-only and uses current client version', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, CURRENT_CLIENT_STATE_VERSION);
    assert.equal(state.warehouseStoredQuantity, 0);
    assert.deepEqual(state.onlineAutoBuyPolicies, {});
    assert.deepEqual(state.onlineAutoBuyManagedOrderIds, {});
    assert.deepEqual(state.onlineAutoSellPolicies, {});
    assert.deepEqual(state.onlineAutoSellManagedOrderIds, {});
    assert.deepEqual(state.factoryAutoOperationPolicies, {});
    for (const field of [
      'inventoryCapacity', 'warehouseLevel', 'warehouseUpgradeCost', 'warehouseNextCapacity',
      'warehouseNextCapacityIncrease', 'warehouseOrderReservedQuantity', 'warehouseContractReservedQuantity',
      'warehouseAuctionReservedQuantity', 'warehouseReservedQuantity', 'warehouseUsedCapacity', 'warehouseAvailableCapacity',
    ]) assert.equal(Object.hasOwn(state, field), false, field);
  } finally { store.close(); }
});

test('warehouse summary counts goods, keeps managed links, and derives no execution without factory intent', () => {
  const player = {
    userId: 1,
    inventoryCapacity: 999,
    warehouseLevel: 8,
    inventories: {
      wheat: { available: 25, frozen: 5 },
      steel: { available: 7, frozen: 3 },
    },
    onlineAutoBuyPolicies: {
      wheat: { enabled: true, maxPrice: 6.75, targetFreeInventory: 12 },
      unknown: { enabled: true, maxPrice: 1, targetFreeInventory: 1 },
    },
    onlineAutoBuyOrderIds: {
      wheat: 'order-auto-buy-wheat',
      unknown: 'order-auto-buy-unknown',
    },
    onlineAutoSellPolicies: {
      wheat: { enabled: true, price: 8.25, minimumFreeInventory: 20 },
      unknown: { enabled: true, price: 1, minimumFreeInventory: 0 },
    },
    onlineAutoSellOrderIds: {
      wheat: 'order-auto-sell-wheat',
      unknown: 'order-auto-sell-unknown',
    },
  };
  const summary = createWarehouseSummary(player);
  assert.deepEqual(summary, {
    warehouseStoredQuantity: 40,
    provinceAutoSaleEnabled: {},
    cycleAutoSaleCounts: {},
    inventoryFreezeDetails: {
      wheat: [{ kind: 'legacy', sourceId: 'unattributed', quantity: 5, label: '历史冻结（待核对来源）' }],
      steel: [{ kind: 'legacy', sourceId: 'unattributed', quantity: 3, label: '历史冻结（待核对来源）' }],
    },
    onlineAutoBuyPolicies: {},
    onlineAutoBuyManagedOrderIds: {
      '110000:wheat': 'order-auto-buy-wheat',
    },
    onlineAutoSellPolicies: {},
    onlineAutoSellManagedOrderIds: {
      '110000:wheat': 'order-auto-sell-wheat',
    },
    factoryAutoOperationPolicies: {},
  });
  assert.equal(Object.hasOwn(player, 'inventoryCapacity'), false);
  assert.equal(Object.hasOwn(player, 'warehouseLevel'), false);
});

test('legacy product auto-trade settings remain internal compatibility data rather than formal client authority', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.transaction(() => {
      const loaded = store.loadWorld(now);
      const player = ensurePlayer(loaded.world, alice, now);
      const result = applyOnlineAutoTradePolicyAction(loaded.world, alice, {
        productId: 'wheat',
        buy: {
          enabled: true,
          maxPrice: 6,
          targetFreeInventory: 10,
        },
        sell: {
          enabled: true,
          price: 7.5,
          minimumFreeInventory: 12,
        },
      });
      assert.equal(result.ok, true);
      store.saveWorld(loaded.revision, loaded.world, now + 1);
      assert.equal(player.onlineAutoBuyPolicies.wheat.maxPrice, 6);
      assert.equal(player.onlineAutoSellPolicies.wheat.price, 7.5);
    });

    const state = store.getState(alice, now + 2);
    assert.deepEqual(state.onlineAutoBuyPolicies, {});
    assert.deepEqual(state.onlineAutoBuyManagedOrderIds, {});
    assert.deepEqual(state.onlineAutoSellPolicies, {});
    assert.deepEqual(state.onlineAutoSellManagedOrderIds, {});
    assert.deepEqual(state.factoryAutoOperationPolicies, {});
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
