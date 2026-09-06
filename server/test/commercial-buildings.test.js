import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMMERCIAL_BUILDING_TYPE_CATALOG,
  applyCommercialBuildingAction,
  processCommercialWorld,
} from '../src/commercial-buildings.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';

const user = { id: 77101, email: 'commercial@example.com', name: 'Commercial' };
const now = 1_800_000_000_000;
const california = '110000';
const alabama = '120000';

function setup() {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 10_000;
  return { world, player };
}

function typeFor(id) {
  const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((candidate) => candidate.id === id);
  assert.ok(type);
  return type;
}

test('first commercial build starts immediately and keeps locked profit independent from later market prices', () => {
  const { world, player } = setup();
  const type = typeFor('convenience-store');
  inventoryForProvince(player, 'food', california).available = 2;
  inventoryForProvince(player, 'beverage', california).available = 2;
  const foodMarket = world.markets[provinceScopedKey(california, 'food')];
  const beverageMarket = world.markets[provinceScopedKey(california, 'beverage')];
  foodMarket.officialPrice = 15;
  beverageMarket.officialPrice = 18;
  const foodBuyBefore = Number(foodMarket.todayBuyQuantity || 0);
  const foodSellBefore = Number(foodMarket.todaySellQuantity || 0);

  const built = applyCommercialBuildingAction(world, user, {
    operation: 'build', provinceId: california, commercialTypeId: type.id, quantity: 1,
  }, now + 1);
  assert.equal(built.ok, true);
  const group = player.commercialBuildingGroups.find((candidate) => candidate.commercialTypeId === type.id);
  assert.ok(group);
  assert.equal(group.enabled, true);
  assert.equal(group.status, 'running');
  assert.equal(group.cycleActive, true);
  assert.equal(player.credits, 10_000 - type.buildCost - type.operatingCost);
  assert.equal(inventoryForProvince(player, 'food', california).available, 0);
  assert.equal(inventoryForProvince(player, 'beverage', california).available, 0);
  assert.equal(group.pendingProfit, type.profitPerCycle);
  const lockedRevenue = group.pendingRevenue;
  assert.equal(lockedRevenue, 15 + 18 + type.operatingCost + type.profitPerCycle);
  group.autoOperationPolicy = { enabled: false, inputCoverageCycles: 2 }; // Isolate locked settlement from completion-driven trading.

  // The cycle is locked at start. Later price changes cannot rewrite this cycle's stable margin.
  foodMarket.officialPrice = 30;
  beverageMarket.officialPrice = 36;
  processCommercialWorld(world, Number(group.cycleCompletesAt));

  assert.equal(group.lifetimeProfit, type.profitPerCycle);
  assert.equal(group.lifetimeRevenue, lockedRevenue);
  assert.equal(player.stats.commercialProfitIssued, type.profitPerCycle);
  assert.equal(player.stats.commercialGoodsConsumed, 2);
  assert.equal(foodMarket.todayBuyQuantity, foodBuyBefore);
  assert.equal(foodMarket.todaySellQuantity, foodSellBefore);
});

test('commercial first-cycle bootstrap retries after funds recover without another start click', () => {
  const { world, player } = setup();
  const type = typeFor('clothing-store');
  const clothingMarket = world.markets[provinceScopedKey(california, 'clothing')];
  const buyBefore = Number(clothingMarket.todayBuyQuantity || 0);
  player.credits = type.buildCost + type.operatingCost;

  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'build', provinceId: california, commercialTypeId: type.id, quantity: 1,
  }, now + 1).ok, true);
  const group = player.commercialBuildingGroups.find((candidate) => candidate.commercialTypeId === type.id);
  assert.equal(group.status, 'error');
  assert.equal(group.statusReason, 'insufficient_input');
  assert.equal(group.enabled, true);
  assert.equal(Number(clothingMarket.todayBuyQuantity || 0), buyBefore);

  player.credits += 1_000;
  processCommercialWorld(world, now + 3);
  assert.equal(group.status, 'running');
  assert.equal(group.participatingCount, 1);
  assert.ok(Number(clothingMarket.todayBuyQuantity || 0) > buyBefore);
  assert.equal(Object.keys(player.autoOperationCycleCursors || {}).length, 0, 'bootstrap must not fake a completed-cycle cursor');
});

test('commercial first-cycle bootstrap buys only in the building province', () => {
  const { world, player } = setup();
  const type = typeFor('restaurant');
  inventoryForProvince(player, 'prepared-meal', california).available = 100;
  inventoryForProvince(player, 'beverage', california).available = 100;
  const californiaMealMarket = world.markets[provinceScopedKey(california, 'prepared-meal')];
  const alabamaMealMarket = world.markets[provinceScopedKey(alabama, 'prepared-meal')];
  const californiaBuyBefore = Number(californiaMealMarket.todayBuyQuantity || 0);
  const alabamaBuyBefore = Number(alabamaMealMarket.todayBuyQuantity || 0);

  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'build', provinceId: alabama, commercialTypeId: type.id, quantity: 1,
  }, now + 1).ok, true);
  const group = player.commercialBuildingGroups.find((candidate) => (
    candidate.commercialTypeId === type.id && candidate.provinceId === alabama
  ));
  assert.equal(group.status, 'running');
  assert.equal(inventoryForProvince(player, 'prepared-meal', california).available, 100);
  assert.equal(Number(californiaMealMarket.todayBuyQuantity || 0), californiaBuyBefore);
  assert.ok(Number(alabamaMealMarket.todayBuyQuantity || 0) > alabamaBuyBefore);
});

test('stopping during an invested cycle keeps the locked settlement but prevents renewal', () => {
  const { world, player } = setup();
  const type = typeFor('clothing-store');
  inventoryForProvince(player, 'clothing', california).available = 2;
  applyCommercialBuildingAction(world, user, {
    operation: 'build', provinceId: california, commercialTypeId: type.id, quantity: 1,
  }, now + 1);
  const group = player.commercialBuildingGroups.find((candidate) => candidate.commercialTypeId === type.id);
  const lockedRevenue = group.pendingRevenue;
  const stockAfterStart = inventoryForProvince(player, 'clothing', california);
  const inventoryAfterStart = stockAfterStart.available + stockAfterStart.frozen;

  const stopped = applyCommercialBuildingAction(world, user, {
    operation: 'stop', provinceId: california, commercialTypeId: type.id,
  }, now + 3);
  assert.equal(stopped.ok, true);
  assert.equal(group.enabled, false);
  assert.equal(group.status, 'running');
  assert.equal(inventoryForProvince(player, 'clothing', california).available, inventoryAfterStart);

  processCommercialWorld(world, Number(group.cycleCompletesAt));
  assert.equal(group.lifetimeRevenue, lockedRevenue);
  assert.equal(group.lifetimeProfit, type.profitPerCycle);
  assert.equal(group.status, 'stopped');
  assert.equal(group.participatingCount, 0);
  assert.equal(inventoryForProvince(player, 'clothing', california).available, inventoryAfterStart);
});

test('expanding a manually stopped commercial group does not restart it', () => {
  const { world, player } = setup();
  const type = typeFor('clothing-store');
  inventoryForProvince(player, 'clothing', california).available = 2;
  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'build', provinceId: california, commercialTypeId: type.id, quantity: 1,
  }, now + 1).ok, true);
  const group = player.commercialBuildingGroups.find((candidate) => candidate.commercialTypeId === type.id);
  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'stop', provinceId: california, commercialTypeId: type.id,
  }, now + 2).ok, true);
  processCommercialWorld(world, Number(group.cycleCompletesAt));
  assert.equal(group.enabled, false);
  assert.equal(group.status, 'stopped');

  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'build', provinceId: california, commercialTypeId: type.id, quantity: 1,
  }, Number(group.staffingUpdatedAt || now) + 1).ok, true);
  assert.equal(group.count, 2);
  assert.equal(group.enabled, false);
  assert.equal(group.status, 'stopped');
});
