import assert from 'node:assert/strict';
import test from 'node:test';
import { applySettledCommodityOrder, createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld, productionReservedQuantitiesForPlayer } from '../src/facility-groups.js';
import { applyOnlineAutoSell, contractAvailableHoldForAutoSell } from '../src/online-auto-sell.js';
import { isOpenOrder } from '../src/order-identity.js';
import { countOpenOrdersForOwner } from '../src/order-book-runtime.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

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

function roundedPrice(value) {
  return Math.max(0.01, Math.round(value * 100) / 100);
}

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
  return {
    productId: linked.productId,
    price: roundedPrice(fixtureProduct.basePrice * (mode === 'profit' ? 1.1 : mode === 'supply' ? 0.95 : 1)),
  };
}

function addBuyOrder(world, buyer, productId, quantity, price, id = `buy-${productId}`) {
  const total = quantity * price;
  buyer.credits -= total;
  buyer.frozenCredits += total;
  world.orders.push({
    id,
    provinceId: DEFAULT_PROVINCE_ID,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    side: 'buy',
    ownerType: 'player',
    ownerId: buyer.userId,
    ownerName: buyer.playerName,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    fills: [],
    createdAt: now + 1,
  });
}

function ownSellOrders(world, productId) {
  return world.orders.filter((order) => (
    Number(order.ownerId) === alice.id && order.productId === productId && order.side === 'sell'
  ));
}

test('factory automatic selling leaves real standing supply outside the manual quota', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = 10;

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  const order = ownSellOrders(world, fixture.productId).at(-1);
  assert.ok(order && isOpenOrder(order));
  assert.equal(order.remaining, 10);
  assert.equal(order.price, fixture.price);
  assert.equal(seller.inventories[fixture.productId].available, 0);
  assert.equal(seller.inventories[fixture.productId].frozen, 10);
  assert.equal(countOpenOrdersForOwner(world, alice.id), 0);
});

test('factory automatic selling fills qualifying demand through the unified order book', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = 8;
  buyer.credits = 100_000;
  addBuyOrder(world, buyer, fixture.productId, 3, fixture.price + 1);

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 2);

  assert.equal(result.ok, true, result.message);
  const order = ownSellOrders(world, fixture.productId).at(-1);
  assert.ok(order);
  assert.equal(order.status, 'partial');
  assert.equal(order.remaining, 5);
  assert.equal(seller.inventories[fixture.productId].frozen, 5);
});

test('factory automatic selling protects downstream production cycles and contract holds', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { consumerCount: 2, consumerCoverage: 3 });
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = 50;
  seller.inventories[fixture.productId].frozen = 1;
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

  const production = productionReservedQuantitiesForPlayer(world, alice.id, DEFAULT_PROVINCE_ID)[fixture.productId];
  const contract = contractAvailableHoldForAutoSell(world, alice.id, fixture.productId, DEFAULT_PROVINCE_ID);
  assert.equal(production, linked.consumerInput.quantity * 2);
  assert.equal(contract, 3);

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 2);
  assert.equal(result.ok, true, result.message);
  const order = ownSellOrders(world, fixture.productId).at(-1);
  assert.ok(order && isOpenOrder(order));
  const extraCoverage = linked.consumerInput.quantity * 2 * 2;
  assert.equal(order.remaining, 50 - production - contract - extraCoverage);
});

test('a keep producer disables automatic selling for the shared product', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { outputMode: 'keep' });
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = 10;

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, false);
  assert.match(result.message, /工厂策略无需自动出售/);
  assert.equal(ownSellOrders(world, fixture.productId).length, 0);
  assert.equal(seller.inventories[fixture.productId].available, 10);
});

test('switching a producer to keep cancels a stale managed sell so the runtime transaction can commit cleanup', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = 10;
  const first = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);
  assert.equal(first.ok, true, first.message);
  const managed = ownSellOrders(world, fixture.productId).at(-1);
  assert.ok(managed && isOpenOrder(managed));
  assert.equal(seller.inventories[fixture.productId].frozen, 10);

  seller.factoryAutoOperationPolicies[provinceScopedKey(DEFAULT_PROVINCE_ID, linked.producer.id)].outputMode = 'keep';
  const cleanup = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 2);

  assert.equal(cleanup.ok, true, cleanup.message);
  assert.match(cleanup.message, /撤销旧托管卖单/);
  assert.equal(managed.status, 'cancelled');
  assert.equal(seller.inventories[fixture.productId].available, 10);
  assert.equal(seller.inventories[fixture.productId].frozen, 0);
});

test('own crossing buy blocks factory automatic selling', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller);
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = 10;
  seller.credits = 100_000;
  addBuyOrder(world, seller, fixture.productId, 1, fixture.price, 'own-buy');

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 2);

  assert.equal(result.ok, false);
  assert.match(result.message, /自己的买单/);
  assert.equal(seller.inventories[fixture.productId].available, 10);
  assert.equal(ownSellOrders(world, fixture.productId).length, 0);
});

test('server ignores client product thresholds and uses the factory selling mode', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = 8;

  const result = applyOnlineAutoSell(world, alice, {
    productId: fixture.productId,
    price: 0.01,
    minimumFreeInventory: 7,
  }, now + 2);

  assert.equal(result.ok, true, result.message);
  const order = ownSellOrders(world, fixture.productId).at(-1);
  assert.ok(order && isOpenOrder(order));
  assert.equal(order.price, fixture.price);
  assert.equal(order.remaining, 8);
});

test('manual market orders still match against a standing factory auto sell order', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = 6;
  buyer.credits = 100_000;
  const standing = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);
  assert.equal(standing.ok, true, standing.message);
  const order = ownSellOrders(world, fixture.productId).at(-1);
  assert.ok(order && isOpenOrder(order));

  const buy = applySettledCommodityOrder(world, bob, {
    provinceId: DEFAULT_PROVINCE_ID,
    assetKind: 'commodity',
    assetId: fixture.productId,
    side: 'buy',
    quantity: 2,
    price: roundedPrice(fixture.price + 1),
  }, now + 2);

  assert.equal(buy.ok, true, buy.message);
  assert.equal(order.status, 'partial');
  assert.equal(order.remaining, 4);
  assert.equal(seller.inventories[fixture.productId].frozen, 4);
});
