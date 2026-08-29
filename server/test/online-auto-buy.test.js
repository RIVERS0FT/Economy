import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/industry-catalog.js';
import {
  migrateFacilityGroupWorld,
  productionReservedQuantitiesForPlayer,
} from '../src/facility-groups.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { isOpenOrder } from '../src/order-identity.js';
import { countOpenOrdersForOwner } from '../src/order-book-runtime.js';
import { contractAvailableHoldForOnlineTrade } from '../src/online-auto-trade-reservations.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const fixtureType = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => recipe.inputs?.length));
const fixtureRecipe = fixtureType?.recipes?.find((recipe) => recipe.inputs?.length);
const fixtureInput = fixtureRecipe?.inputs?.[0];
if (!fixtureType || !fixtureRecipe || !fixtureInput) throw new Error('catalog needs an input-consuming facility');
const fixtureProduct = PRODUCT_CATALOG.find((product) => product.id === fixtureInput.productId);
if (!fixtureProduct) throw new Error('catalog input product missing');

function clearOrders(world) {
  world.orders = [];
}

function roundedPrice(value) {
  return Math.max(0.01, Math.round(value * 100) / 100);
}

function configureConsumer(world, buyer, {
  count = 2,
  coverage = 2,
  mode = 'balanced',
} = {}) {
  buyer.facilityGroups = [{
    facilityTypeId: fixtureType.id,
    provinceId: DEFAULT_PROVINCE_ID,
    count,
    participatingCount: count,
    productionAvailableCount: count,
    enabled: true,
    status: 'running',
    statusReason: '',
    activeRecipeId: fixtureRecipe.id,
    cycleStartedAt: now,
    lifetimeOutput: 0,
  }];
  buyer.factoryAutoOperationPolicies = {
    [provinceScopedKey(DEFAULT_PROVINCE_ID, fixtureType.id)]: {
      enabled: true,
      inputCoverageCycles: coverage,
      mode,
      outputMode: 'surplus',
    },
  };
  migrateFacilityGroupWorld(world, now);
  return {
    productId: fixtureInput.productId,
    price: roundedPrice(fixtureProduct.basePrice * (mode === 'profit' ? 0.95 : mode === 'supply' ? 1.15 : 1.05)),
    perCycle: fixtureInput.quantity * count,
  };
}

function addSellOrder(world, seller, productId, quantity, price, id = `sell-${productId}`) {
  const inventory = seller.inventories[productId] ||= { available: 0, frozen: 0 };
  assert.ok(inventory.available >= quantity);
  inventory.available -= quantity;
  inventory.frozen += quantity;
  world.orders.push({
    id,
    provinceId: DEFAULT_PROVINCE_ID,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    side: 'sell',
    ownerType: 'player',
    ownerId: seller.userId,
    ownerName: seller.playerName,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    fills: [],
    createdAt: now + 1,
  });
}

function ownBuyOrders(world, productId) {
  return world.orders.filter((order) => (
    Number(order.ownerId) === alice.id && order.productId === productId && order.side === 'buy'
  ));
}

test('factory automatic purchasing leaves a real standing buy order outside the manual quota', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer);

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  const order = ownBuyOrders(world, fixture.productId).at(-1);
  assert.ok(order && isOpenOrder(order));
  assert.equal(order.price, fixture.price);
  assert.equal(order.remaining, fixture.perCycle * 2);
  assert.equal(countOpenOrdersForOwner(world, alice.id), 0);
});

test('factory automatic purchasing fills qualifying supply and keeps the rest standing', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  const seller = ensurePlayer(world, bob, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer);
  const fillQuantity = Math.max(1, Math.min(fixture.perCycle, fixture.perCycle * 2 - 1));
  seller.inventories[fixture.productId] ||= { available: 0, frozen: 0 };
  seller.inventories[fixture.productId].available = fillQuantity;
  addSellOrder(world, seller, fixture.productId, fillQuantity, Math.max(0.01, fixture.price - 0.01));

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 2);

  assert.equal(result.ok, true, result.message);
  const order = ownBuyOrders(world, fixture.productId).at(-1);
  assert.ok(order);
  assert.equal(order.status, 'partial');
  assert.equal(order.remaining, fixture.perCycle * 2 - fillQuantity);
  assert.equal(buyer.inventories[fixture.productId].available, fillQuantity);
});

test('factory automatic purchasing includes contract holds after production and extra cycle protection', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer, { count: 1, coverage: 3 });
  buyer.inventories[fixture.productId].available = 1;
  world.productionContracts = [{
    id: 'factory-auto-operation-supply',
    kind: 'supply',
    status: 'active',
    supplierId: alice.id,
    provinceId: DEFAULT_PROVINCE_ID,
    productId: fixture.productId,
    quantityPerDelivery: 4,
    supplierReservedQuantity: 1,
    supplierAutoReserve: true,
    completedDeliveries: 0,
    totalDeliveries: 10,
  }];

  const production = productionReservedQuantitiesForPlayer(world, alice.id, DEFAULT_PROVINCE_ID)[fixture.productId];
  const contract = contractAvailableHoldForOnlineTrade(world, alice.id, fixture.productId, DEFAULT_PROVINCE_ID);
  assert.equal(production, fixture.perCycle);
  assert.equal(contract, 3);

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 2);
  assert.equal(result.ok, true, result.message);
  const order = ownBuyOrders(world, fixture.productId).at(-1);
  assert.ok(order && isOpenOrder(order));
  assert.equal(order.remaining, fixture.perCycle * 3 + contract - 1);
});

test('available funds cap the same factory-derived target without refreshing time priority', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  const fixture = configureConsumer(world, buyer, { count: 10, coverage: 5 });
  buyer.credits = fixture.price * 3;

  const first = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);
  assert.equal(first.ok, true, first.message);
  const order = ownBuyOrders(world, fixture.productId).at(-1);
  assert.ok(order && isOpenOrder(order));
  assert.equal(order.remaining, 3);
  const createdAt = order.createdAt;

  const second = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 2);
  assert.equal(second.ok, true, second.message);
  assert.match(second.message, /可用资金限制/);
  assert.equal(ownBuyOrders(world, fixture.productId).filter(isOpenOrder).length, 1);
  assert.equal(order.createdAt, createdAt);
});

test('own crossing sell cancels the managed factory auto buy and releases frozen credits', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer);
  buyer.inventories[fixture.productId].available = 1;
  const first = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);
  assert.equal(first.ok, true, first.message);
  const managed = ownBuyOrders(world, fixture.productId).at(-1);
  assert.ok(managed && isOpenOrder(managed));
  assert.ok(buyer.frozenCredits > 0);

  addSellOrder(world, buyer, fixture.productId, 1, fixture.price, 'own-crossing-sell');
  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 2);

  assert.equal(result.ok, false);
  assert.match(result.message, /自己的卖单/);
  assert.equal(managed.status, 'cancelled');
  assert.equal(buyer.frozenCredits, 0);
});

test('server ignores client product thresholds and executes the factory operating mode', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer, { count: 1, coverage: 2, mode: 'supply' });

  const result = applyOnlineAutoBuy(world, alice, {
    productId: fixture.productId,
    maxPrice: 0.01,
    targetFreeInventory: 1,
  }, now + 1);

  assert.equal(result.ok, true, result.message);
  const order = ownBuyOrders(world, fixture.productId).at(-1);
  assert.ok(order);
  assert.equal(order.price, fixture.price);
  assert.equal(order.remaining, fixture.perCycle * 2);
});
