import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { factoryAutoTradeExecutionPolicyFor } from '../src/factory-auto-operation.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld, productionReservedQuantitiesForPlayer } from '../src/facility-groups.js';
import { applyOnlineAutoSell, contractAvailableHoldForAutoSell } from '../src/online-auto-sell.js';
import { DEFAULT_PROVINCE_ID, inventoryForProvince, provinceScopedKey } from '../src/provinces.js';

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
  return { productId: linked.productId };
}

function currentSellPolicy(player, productId) {
  return factoryAutoTradeExecutionPolicyFor(player, productId, DEFAULT_PROVINCE_ID)?.sell;
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

function completedPlayerSells(world, productId) {
  return (world.orders || []).filter((order) => (
    order?.ownerType === 'player'
    && order?.assetKind === 'commodity'
    && order?.productId === productId
    && order?.side === 'sell'
    && order?.status === 'filled'
  ));
}

test('factory automatic selling immediately sells eligible surplus at today official price without freezing inventory', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  const policy = currentSellPolicy(seller, fixture.productId);
  assert.equal(policy?.enabled, true);
  setOfficialPrice(world, fixture.productId, policy.price);
  const inventory = inventoryForProvince(seller, fixture.productId, DEFAULT_PROVINCE_ID);
  inventory.available = 10;
  const creditsBefore = seller.credits;

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /自动出售 10 个/);
  assert.equal(inventory.available, 0);
  assert.equal(inventory.frozen, 0);
  assert.ok(seller.credits > creditsBefore);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
  const trade = completedPlayerSells(world, fixture.productId).at(-1);
  assert.ok(trade);
  assert.equal(trade.price, policy.price);
  assert.equal(trade.quantity, 10);
  assert.equal(trade.remaining, 0);
});

test('factory automatic selling waits when today official price is below the derived minimum and creates no order', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  const policy = currentSellPolicy(seller, fixture.productId);
  assert.equal(policy?.enabled, true);
  setOfficialPrice(world, fixture.productId, Math.max(0.01, Math.round((policy.price - 0.01) * 100) / 100));
  const inventory = inventoryForProvince(seller, fixture.productId, DEFAULT_PROVINCE_ID);
  inventory.available = 8;

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /低于自动出售最低价/);
  assert.equal(inventory.available, 8);
  assert.equal(inventory.frozen, 0);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
  assert.equal(completedPlayerSells(world, fixture.productId).length, 0);
});

test('factory automatic selling protects production cycles, contract holds, and extra coverage before instant sale', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { consumerCount: 2, consumerCoverage: 3 });
  const policy = currentSellPolicy(seller, fixture.productId);
  assert.equal(policy?.enabled, true);
  setOfficialPrice(world, fixture.productId, policy.price);
  const inventory = inventoryForProvince(seller, fixture.productId, DEFAULT_PROVINCE_ID);
  inventory.available = 50;
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
  const extraCoverage = policy.minimumFreeInventory;
  const expectedSale = 50 - production - contract - extraCoverage;
  assert.equal(production, linked.consumerInput.quantity * 2);
  assert.equal(contract, 3);

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 2);

  assert.equal(result.ok, true, result.message);
  assert.equal(inventory.available, production + contract + extraCoverage);
  assert.equal(inventory.frozen, 0);
  assert.equal(completedPlayerSells(world, fixture.productId).at(-1)?.quantity, expectedSale);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
});

test('a keep producer disables automatic selling without requiring managed-order cleanup', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { outputMode: 'keep' });
  const inventory = inventoryForProvince(seller, fixture.productId, DEFAULT_PROVINCE_ID);
  inventory.available = 10;

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, false);
  assert.match(result.message, /无需自动出售/);
  assert.equal(inventory.available, 10);
  assert.equal(inventory.frozen, 0);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
});

test('no surplus after reservations produces no trade and no frozen inventory', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { consumerCount: 2, consumerCoverage: 3 });
  const policy = currentSellPolicy(seller, fixture.productId);
  assert.equal(policy?.enabled, true);
  setOfficialPrice(world, fixture.productId, policy.price);
  const inventory = inventoryForProvince(seller, fixture.productId, DEFAULT_PROVINCE_ID);
  const production = productionReservedQuantitiesForPlayer(world, alice.id, DEFAULT_PROVINCE_ID)[fixture.productId];
  inventory.available = production + policy.minimumFreeInventory;

  const result = applyOnlineAutoSell(world, alice, { productId: fixture.productId }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /当前没有/);
  assert.equal(inventory.frozen, 0);
  assert.equal(completedPlayerSells(world, fixture.productId).length, 0);
});

test('server ignores client thresholds and uses the factory-derived immediate selling policy', () => {
  const world = createWorld(now);
  world.orders = [];
  const seller = ensurePlayer(world, alice, now);
  const fixture = configureProducer(world, seller, { mode: 'profit' });
  const policy = currentSellPolicy(seller, fixture.productId);
  assert.equal(policy?.enabled, true);
  setOfficialPrice(world, fixture.productId, policy.price);
  const inventory = inventoryForProvince(seller, fixture.productId, DEFAULT_PROVINCE_ID);
  inventory.available = 8;

  const result = applyOnlineAutoSell(world, alice, {
    productId: fixture.productId,
    price: 999_999,
    minimumFreeInventory: 7,
  }, now + 2);

  assert.equal(result.ok, true, result.message);
  assert.equal(inventory.available, 0);
  assert.equal(inventory.frozen, 0);
  assert.equal(completedPlayerSells(world, fixture.productId).at(-1)?.price, policy.price);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
});
