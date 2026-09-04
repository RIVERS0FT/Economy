import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/industry-catalog.js';
import {
  migrateFacilityGroupWorld,
  productionReservedQuantitiesForPlayer,
} from '../src/facility-groups.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { contractAvailableHoldForOnlineTrade } from '../src/online-auto-trade-reservations.js';
import { DEFAULT_PROVINCE_ID, inventoryForProvince, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const fixtureType = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => recipe.inputs?.length));
const fixtureRecipe = fixtureType?.recipes?.find((recipe) => recipe.inputs?.length);
const fixtureInput = fixtureRecipe?.inputs?.[0];
if (!fixtureType || !fixtureRecipe || !fixtureInput) throw new Error('catalog needs an input-consuming facility');
const fixtureProduct = PRODUCT_CATALOG.find((product) => product.id === fixtureInput.productId);
if (!fixtureProduct) throw new Error('catalog input product missing');

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
    maxPrice: roundedPrice(fixtureProduct.basePrice * (mode === 'profit' ? 0.95 : mode === 'supply' ? 1.15 : 1.05)),
    perCycle: fixtureInput.quantity * count,
  };
}

function setOfficialPrice(world, productId, price) {
  world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, productId)].officialPrice = price;
}

function openPlayerCommodityOrders(world) {
  return (world.orders || []).filter((order) => (
    order?.ownerType === 'player'
    && order?.assetKind === 'commodity'
    && ['open', 'partial'].includes(order?.status)
  ));
}

function completedPlayerBuys(world, productId) {
  return (world.orders || []).filter((order) => (
    order?.ownerType === 'player'
    && order?.assetKind === 'commodity'
    && order?.productId === productId
    && order?.side === 'buy'
    && order?.status === 'filled'
  ));
}

test('factory automatic purchasing immediately buys the full factory-derived target at today official price', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer);
  setOfficialPrice(world, fixture.productId, fixture.maxPrice);
  const inventory = inventoryForProvince(buyer, fixture.productId, DEFAULT_PROVINCE_ID);
  const expected = fixture.perCycle * 2;

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, new RegExp(`自动采购 ${expected} 个`));
  assert.equal(inventory.available, expected);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
  const trade = completedPlayerBuys(world, fixture.productId).at(-1);
  assert.ok(trade);
  assert.equal(trade.price, fixture.maxPrice);
  assert.equal(trade.quantity, expected);
  assert.equal(trade.remaining, 0);
});

test('factory automatic purchasing respects the derived maximum price without creating a waiting order', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer, { mode: 'profit' });
  setOfficialPrice(world, fixture.productId, roundedPrice(fixture.maxPrice + 0.01));
  const inventory = inventoryForProvince(buyer, fixture.productId, DEFAULT_PROVINCE_ID);

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /高于自动采购最高价/);
  assert.equal(inventory.available, 0);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
  assert.equal(completedPlayerBuys(world, fixture.productId).length, 0);
});

test('factory automatic purchasing includes contract holds and extra coverage in the immediate quantity', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer, { count: 1, coverage: 3 });
  setOfficialPrice(world, fixture.productId, fixture.maxPrice);
  const inventory = inventoryForProvince(buyer, fixture.productId, DEFAULT_PROVINCE_ID);
  inventory.available = 1;
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
  const requiredAvailable = fixture.perCycle * 3 + contract;
  assert.equal(production, fixture.perCycle);
  assert.equal(contract, 3);

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 2);

  assert.equal(result.ok, true, result.message);
  assert.equal(inventory.available, requiredAvailable);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
});

test('available funds cap the immediate factory purchase without freezing unused money', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  const fixture = configureConsumer(world, buyer, { count: 10, coverage: 5 });
  setOfficialPrice(world, fixture.productId, fixture.maxPrice);
  buyer.credits = fixture.maxPrice * 3;
  const inventory = inventoryForProvince(buyer, fixture.productId, DEFAULT_PROVINCE_ID);

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /受可用资金限制/);
  assert.equal(inventory.available, 3);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
});

test('disabled factory strategy performs no automatic purchase and leaves no managed-order cleanup state', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer);
  setOfficialPrice(world, fixture.productId, fixture.maxPrice);
  buyer.factoryAutoOperationPolicies[provinceScopedKey(DEFAULT_PROVINCE_ID, fixtureType.id)].enabled = false;

  const result = applyOnlineAutoBuy(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, false);
  assert.match(result.message, /无需自动采购/);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
});

test('server ignores client thresholds and uses the factory-derived immediate purchase policy', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100_000;
  const fixture = configureConsumer(world, buyer, { count: 1, coverage: 2, mode: 'supply' });
  setOfficialPrice(world, fixture.productId, fixture.maxPrice);
  const inventory = inventoryForProvince(buyer, fixture.productId, DEFAULT_PROVINCE_ID);

  const result = applyOnlineAutoBuy(world, alice, {
    productId: fixture.productId,
    maxPrice: 0.01,
    targetFreeInventory: 1,
  }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.equal(inventory.available, fixture.perCycle * 2);
  assert.equal(completedPlayerBuys(world, fixture.productId).at(-1)?.price, fixture.maxPrice);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
});
