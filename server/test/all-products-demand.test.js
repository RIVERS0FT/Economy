import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorld,
  ensurePlayer,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
  migrateWorld,
  processWorld,
  PRODUCT_CATALOG,
} from '../src/domain.js';

const now = 1_700_000_000_000;
const cycleMs = 5 * 60 * 1000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

test('market demand model 10 gives every product direct terminal demand', () => {
  assert.equal(MARKET_DEMAND_MODEL_VERSION, 10);
  assert.equal(MARKET_DEMAND_GROUP_CATALOG.reduce((sum, group) => sum + group.baseBudget, 0), 5_700);
  assert.equal(MARKET_DEMAND_GROUP_CATALOG.find((group) => group.id === 'household')?.name, '社会消费市场');

  const catalogIds = PRODUCT_CATALOG.map((product) => product.id).sort();
  const directIds = [...MARKET_DEMAND_PRODUCT_IDS].sort();
  assert.deepEqual(directIds, catalogIds);

  const groupsByProduct = new Map();
  for (const group of MARKET_DEMAND_GROUP_CATALOG) {
    for (const demandClass of group.classes) {
      const minimumTotal = demandClass.products.reduce((sum, option) => sum + Number(option.minShare || 0), 0);
      assert.ok(minimumTotal > 0 && minimumTotal <= 1, `${group.id}/${demandClass.id} 最低份额必须有效`);
      for (const option of demandClass.products) {
        assert.ok(Number(option.minShare || 0) > 0, `${option.productId} 必须有最低直接需求份额`);
        const groups = groupsByProduct.get(option.productId) || new Set();
        groups.add(group.id);
        groupsByProduct.set(option.productId, groups);
      }
    }
  }

  for (const product of PRODUCT_CATALOG) {
    assert.equal(product.marketDemandRole, 'direct', product.id);
    assert.equal(groupsByProduct.get(product.id)?.size, 1, `${product.id} 必须且只能属于一个直接需求市场`);
    assert.equal(product.marketDemandGroupId, [...groupsByProduct.get(product.id)][0], product.id);
  }
});

test('model 9 migration refunds population escrow before model 10 rebuild', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  for (const state of Object.values(world.demandGroups)) {
    state.nextDemandAt = now;
    state.lastCycleId = Math.floor(now / cycleMs) - 1;
  }
  processWorld(world, now + 1);

  const openConsumptionOrders = world.orders.filter((order) => (
    order.ownerType === 'population'
    && (order.demandTier === 'direct' || order.demandTier === 'derived-liquidity')
    && order.remaining > 0
    && (order.status === 'open' || order.status === 'partial')
  ));
  assert.ok(openConsumptionOrders.length > 0);
  const oldOrderIds = new Set(openConsumptionOrders.map((order) => order.id));
  const totalsBefore = Object.fromEntries(Object.entries(world.populationEconomy.models).map(([id, model]) => [
    id,
    model.credits + model.frozenCredits,
  ]));

  const wheatReference = world.marketDemand.priceTransmission.products.wheat.referencePrice;
  world.marketDemand.groups.food.directQuoteAnchors.wheat = wheatReference * 2;
  world.marketDemand.groups.food.directOversupplyCycles.wheat = 4;
  world.marketDemand.modelVersion = 9;
  migrateWorld(world, now + 2);

  assert.equal(world.marketDemand.modelVersion, 10);
  assert.equal(world.marketDemand.groups.food.directQuoteAnchors.wheat, wheatReference);
  assert.equal(world.marketDemand.groups.food.directOversupplyCycles.wheat, 0);
  assert.equal(world.orders.some((order) => oldOrderIds.has(order.id)), false);
  for (const [id, model] of Object.entries(world.populationEconomy.models)) {
    assert.equal(model.frozenCredits, 0, id);
    assert.equal(model.credits, totalsBefore[id], id);
  }
});
