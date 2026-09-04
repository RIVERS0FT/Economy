import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/industry-catalog.js';
import {
  migrateFacilityGroupWorld,
  productionReservedQuantitiesForPlayer,
} from '../src/facility-groups.js';
import { factoryAutoTradeExecutionPolicyFor } from '../src/factory-auto-operation.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { contractAvailableHoldForOnlineTrade } from '../src/online-auto-trade-reservations.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const fixtureType = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => recipe.inputs?.length));
const fixtureRecipe = fixtureType?.recipes?.find((recipe) => recipe.inputs?.length);
const fixtureInput = fixtureRecipe?.inputs?.[0];
if (!fixtureType || !fixtureRecipe || !fixtureInput) throw new Error('catalog needs an input-consuming facility');
const fixtureProduct = PRODUCT_CATALOG.find((product) => product.id === fixtureInput.productId);
if (!fixtureProduct) throw new Error('catalog input product missing');

function configureConsumer(world, buyer, {
  count = 2,
  coverage = 2,
  mode = 'balanced',
  enabled = true,
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
      enabled,
      inputCoverageCycles: coverage,
      mode,
      outputMode: 'surplus',
    },
  };
  migrateFacilityGroupWorld(world, now);
  const productId = fixtureInput.productId;
  const policy = factoryAutoTradeExecutionPolicyFor(buyer, productId, DEFAULT_PROVINCE_ID)?.buy;
  if (!policy) throw new Error('auto-buy policy missing');
  return {
    productId,
    policy,
    perCycle: fixtureInput.quantity * count,
  };
}

function marketFor(world, productId) {
  return world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, productId)];
}

function openPlayerOrders(world) {
  return world.orders.filter((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status));
}

test('factory automatic purchasing immediately fills its factory-derived target without freezing funds', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer);
  marketFor(world, fixture.productId).officialPrice = fixture.policy.maxPrice;

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /已按今日系统价/);
  assert.equal(buyer.inventories[fixture.productId].available, fixture.perCycle * 2);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerOrders(world).length, 0);
  const completed = world.orders.filter((order) => order.ownerType === 'player' && order.productId === fixture.productId);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].status, 'filled');
  assert.equal(completed[0].remaining, 0);
  assert.equal(completed[0].price, fixture.policy.maxPrice);
});

test('factory automatic purchasing includes production protection, extra coverage and contract holds', () => {
  const world = createWorld(now);
  world.orders = [];
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
  marketFor(world, fixture.productId).officialPrice = fixture.policy.maxPrice;

  const production = productionReservedQuantitiesForPlayer(world, alice.id, DEFAULT_PROVINCE_ID)[fixture.productId];
  const contract = contractAvailableHoldForOnlineTrade(world, alice.id, fixture.productId, DEFAULT_PROVINCE_ID);
  assert.equal(production, fixture.perCycle);
  assert.equal(contract, 3);
  const expectedPurchase = fixture.perCycle * 3 + contract - 1;

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 2);
  assert.equal(result.ok, true, result.message);
  assert.equal(buyer.inventories[fixture.productId].available, 1 + expectedPurchase);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerOrders(world).length, 0);
});

test('available funds cap immediate automatic purchasing without leaving a remainder order', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  const fixture = configureConsumer(world, buyer, { count: 10, coverage: 5 });
  marketFor(world, fixture.productId).officialPrice = fixture.policy.maxPrice;
  buyer.credits = fixture.policy.maxPrice * 3;

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /可用资金限制/);
  assert.equal(buyer.inventories[fixture.productId].available, 3);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerOrders(world).length, 0);
});

test('automatic purchasing waits when the daily official price exceeds the factory threshold', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer, { mode: 'profit' });
  marketFor(world, fixture.productId).officialPrice = Math.round(fixture.policy.maxPrice * 1.05 * 100) / 100;

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /高于自动采购最高价/);
  assert.equal(buyer.inventories[fixture.productId].available, 0);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(world.orders.filter((order) => order.ownerType === 'player').length, 0);
});

test('disabled factory strategy creates no managed order and freezes nothing', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer, { enabled: false });

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, false);
  assert.match(result.message, /无需自动采购/);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerOrders(world).length, 0);
});

test('server ignores client thresholds and executes only the derived factory buy policy', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer, { count: 1, coverage: 2, mode: 'supply' });
  marketFor(world, fixture.productId).officialPrice = fixture.policy.maxPrice;

  const result = applyOnlineAutoBuy(world, alice, {
    productId: fixture.productId,
    maxPrice: 0.01,
    targetFreeInventory: 1,
  }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.equal(buyer.inventories[fixture.productId].available, fixture.perCycle * 2);
  const completed = world.orders.find((order) => order.ownerType === 'player' && order.productId === fixture.productId);
  assert.equal(completed?.price, fixture.policy.maxPrice);
  assert.equal(openPlayerOrders(world).length, 0);
});
