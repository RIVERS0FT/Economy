import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld, productionReservedQuantitiesForPlayer } from '../src/facility-groups.js';
import { factoryAutoTradeExecutionPolicyFor } from '../src/factory-auto-operation.js';
import { applyOnlineAutoSell, contractAvailableHoldForAutoSell } from '../src/online-auto-sell.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

function findLinkedFacilities() {
  for (const producer of FACILITY_TYPE_CATALOG) {
    for (const producerRecipe of producer.recipes || []) {
      const productId = producerRecipe.output?.productId;
      if (!productId) continue;
      for (const consumer of FACILITY_TYPE_CATALOG) {
        for (const consumerRecipe of consumer.recipes || []) {
          const input = consumerRecipe.inputs?.find((candidate) => candidate.productId === productId);
          if (input) return { producer, producerRecipe, consumer, consumerRecipe, productId, consumerInput: input };
        }
      }
    }
  }
  throw new Error('catalog needs at least one producer -> consumer link');
}

const linked = findLinkedFacilities();
const fixtureProduct = PRODUCT_CATALOG.find((product) => product.id === linked.productId);
if (!fixtureProduct) throw new Error('linked product missing');

function createGroup(type, recipe, count, enabled = true) {
  return {
    facilityTypeId: type.id,
    provinceId: DEFAULT_PROVINCE_ID,
    count,
    participatingCount: enabled ? count : 0,
    productionAvailableCount: count,
    enabled,
    status: enabled ? 'running' : 'stopped',
    statusReason: enabled ? '' : 'manual',
    activeRecipeId: recipe.id,
    cycleStartedAt: enabled ? now : null,
    lifetimeOutput: 0,
  };
}

function configureProducer(world, seller, {
  producerCount = 1,
  mode = 'balanced',
  outputMode = 'surplus',
  consumerCount = 0,
  consumerCoverage = 2,
} = {}) {
  seller.facilityGroups = [createGroup(linked.producer, linked.producerRecipe, producerCount)];
  seller.factoryAutoOperationPolicies = {
    [provinceScopedKey(DEFAULT_PROVINCE_ID, linked.producer.id)]: {
      enabled: true,
      inputCoverageCycles: 2,
      mode,
      outputMode,
    },
  };
  if (consumerCount > 0) {
    seller.facilityGroups.push(createGroup(linked.consumer, linked.consumerRecipe, consumerCount));
    seller.factoryAutoOperationPolicies[provinceScopedKey(DEFAULT_PROVINCE_ID, linked.consumer.id)] = {
      enabled: true,
      inputCoverageCycles: consumerCoverage,
      mode: 'balanced',
      outputMode: 'surplus',
    };
  }
  migrateFacilityGroupWorld(world, now);
  const policy = factoryAutoTradeExecutionPolicyFor(seller, linked.productId, DEFAULT_PROVINCE_ID)?.sell;
  if (!policy) throw new Error('auto-sell policy missing');
  return { productId: linked.productId, policy };
}

function marketFor(world, productId) {
  return world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, productId)];
}

function openPlayerOrders(world) {
  return world.orders.filter((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status));
}

test('factory automatic selling immediately sells eligible inventory without freezing goods', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  seller.credits = 0;
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  seller.inventories[fixture.productId].available = 10;
  marketFor(world, fixture.productId).officialPrice = fixture.policy.price;

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /已按今日系统价/);
  assert.equal(seller.inventories[fixture.productId].available, 0);
  assert.equal(seller.inventories[fixture.productId].frozen, 0);
  assert.equal(seller.credits, Math.round(fixture.policy.price * 10 * 0.99 * 1_000_000) / 1_000_000);
  assert.equal(openPlayerOrders(world).length, 0);
  const completed = world.orders.filter((order) => order.ownerType === 'player' && order.productId === fixture.productId);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].status, 'filled');
  assert.equal(completed[0].remaining, 0);
  assert.equal(completed[0].price, fixture.policy.price);
});

test('factory automatic selling protects production, contract and extra-cycle inventory', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  seller.credits = 0;
  const fixture = configureProducer(world, seller, { consumerCount: 2, consumerCoverage: 3 });
  seller.inventories[fixture.productId].available = 50;
  seller.inventories[fixture.productId].frozen = 0;
  world.productionContracts = [{
    id: 'linked-output-contract',
    kind: 'supply',
    status: 'active',
    supplierId: alice.id,
    provinceId: DEFAULT_PROVINCE_ID,
    productId: fixture.productId,
    quantityPerDelivery: 4,
    supplierReservedQuantity: 1,
    supplierAutoReserve: true,
    completedDeliveries: 0,
    totalDeliveries: null,
  }];
  marketFor(world, fixture.productId).officialPrice = fixture.policy.price;

  const production = productionReservedQuantitiesForPlayer(world, alice.id, DEFAULT_PROVINCE_ID)[fixture.productId];
  const contract = contractAvailableHoldForAutoSell(world, alice.id, fixture.productId, DEFAULT_PROVINCE_ID);
  const extraCoverage = linked.consumerInput.quantity * 2 * 2;
  const expectedSold = 50 - production - contract - extraCoverage;
  assert.equal(production, linked.consumerInput.quantity * 2);
  assert.equal(contract, 3);

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 2);
  assert.equal(result.ok, true, result.message);
  assert.equal(seller.inventories[fixture.productId].available, 50 - expectedSold);
  assert.equal(seller.inventories[fixture.productId].frozen, 0);
  assert.equal(openPlayerOrders(world).length, 0);
});

test('a keep producer disables automatic selling and creates no managed order', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { outputMode: 'keep' });
  seller.inventories[fixture.productId].available = 10;

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, false);
  assert.match(result.message, /建筑策略无需自动出售/);
  assert.equal(seller.inventories[fixture.productId].available, 10);
  assert.equal(seller.inventories[fixture.productId].frozen, 0);
  assert.equal(openPlayerOrders(world).length, 0);
});

test('automatic selling waits when the daily official price is below the factory threshold', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  seller.credits = 0;
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  seller.inventories[fixture.productId].available = 8;
  marketFor(world, fixture.productId).officialPrice = Math.max(0.01, Math.floor((fixture.policy.price - 0.01) * 100) / 100);

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 2);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /低于自动出售最低价/);
  assert.equal(seller.inventories[fixture.productId].available, 8);
  assert.equal(seller.inventories[fixture.productId].frozen, 0);
  assert.equal(world.orders.filter((order) => order.ownerType === 'player').length, 0);
});

test('server ignores client thresholds and executes only the derived factory sell policy', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  seller.credits = 0;
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  seller.inventories[fixture.productId].available = 8;
  marketFor(world, fixture.productId).officialPrice = fixture.policy.price;

  const result = applyOnlineAutoSell(world, alice, {
    productId: fixture.productId,
    price: 999_999,
    minimumFreeInventory: 7,
  }, now + 2);

  assert.equal(result.ok, true, result.message);
  assert.equal(seller.inventories[fixture.productId].available, 0);
  const completed = world.orders.find((order) => order.ownerType === 'player' && order.productId === fixture.productId);
  assert.equal(completed?.price, fixture.policy.price);
  assert.equal(openPlayerOrders(world).length, 0);
});
