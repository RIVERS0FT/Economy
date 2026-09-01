import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  migrateWorld,
} from '../src/domain.js';
import {
  provinceDistanceKm,
  provinceUnlockBaseCostForLevel,
  provinceUnlockCost,
  provinceUnlockCostBreakdown,
} from '../src/province-access.js';
import { inventoryForProvince, PROVINCE_CATALOG } from '../src/provinces.js';
import { stateEconomicLevelFor } from '../src/state-economic-baselines.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const now = 1_700_000_000_000;

function deferDemand(world, at = now + 5 * 60 * 1000) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = at;
}

test('new player chooses a permanent starting province before economic writes', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  assert.equal(player.startingProvinceChosen, false);
  assert.equal(player.unlockedProvinces.length, 1);

  const chosen = applyAction(world, alice, 'chooseStartingProvince', { provinceId: '130000' }, now + 1);
  assert.equal(chosen.ok, true);
  assert.equal(player.startingProvinceId, '130000');
  assert.equal(player.startingProvinceChosen, true);
  assert.deepEqual(player.unlockedProvinces, ['130000']);

  const second = applyAction(world, alice, 'chooseStartingProvince', { provinceId: '140000' }, now + 2);
  assert.equal(second.ok, false);
  assert.equal(player.startingProvinceId, '130000');
});

test('economic levels cover five tiers with monotonic base costs', () => {
  const levels = PROVINCE_CATALOG.map((province) => stateEconomicLevelFor(province.id));
  assert.deepEqual([...new Set(levels)].sort((left, right) => left - right), [1, 2, 3, 4, 5]);
  assert.deepEqual([1, 2, 3, 4, 5].map(provinceUnlockBaseCostForLevel), [1_500, 2_500, 4_000, 6_000, 9_000]);
});

test('unlock cost follows economic level and distance and is deducted atomically', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, bob, now);
  player.credits = 50_000;
  player.startingProvinceChosen = true;
  player.startingProvinceId = '110000';
  player.unlockedProvinces = ['110000'];

  const breakdown = provinceUnlockCostBreakdown('130000', '110000');
  const distanceKm = provinceDistanceKm('110000', '130000');
  assert.equal(breakdown.economicLevel, stateEconomicLevelFor('130000'));
  assert.equal(breakdown.distanceKm, distanceKm);
  assert.equal(breakdown.distanceCost, 300 * Math.floor(distanceKm / 500));
  assert.equal(breakdown.totalCost, Math.min(20_000, breakdown.baseCost + breakdown.distanceCost));
  assert.equal(provinceUnlockCost('130000', '110000'), breakdown.totalCost);

  const before = player.credits;
  const result = applyAction(world, bob, 'unlockProvince', { provinceId: '130000' }, now + 1);
  assert.equal(result.ok, true);
  assert.equal(player.credits, before - breakdown.totalCost);
  assert.equal(player.stats.systemSinks, breakdown.totalCost);
  assert.ok(player.unlockedProvinces.includes('130000'));

  const again = applyAction(world, bob, 'unlockProvince', { provinceId: '130000' }, now + 2);
  assert.equal(again.ok, false);
});

test('unlock rejects insufficient funds', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.startingProvinceChosen = true;
  player.startingProvinceId = '110000';
  player.unlockedProvinces = ['110000'];

  const result = applyAction(world, alice, 'unlockProvince', { provinceId: '310000' }, now + 1);
  assert.equal(result.ok, false);
  assert.match(result.message, /资金不足/);
  assert.ok(!player.unlockedProvinces.includes('310000'));
});

test('locked province rejects commodity orders while unlocked state works', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.startingProvinceChosen = true;
  player.startingProvinceId = '110000';
  player.unlockedProvinces = ['110000'];

  const locked = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: 1, provinceId: '130000',
  }, now + 1);
  assert.equal(locked.ok, false);
  assert.match(locked.message, /尚未解锁/);

  const unlocked = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: 1, provinceId: '110000',
  }, now + 2);
  assert.equal(unlocked.ok, true);
});

test('world migration unlocks every state with existing assets and preserves them', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 5_000;
  inventoryForProvince(player, 'wheat', '120000').available = 3;
  inventoryForProvince(player, 'ore', '310000').available = 2;
  world.version = 31;
  delete player.startingProvinceId;
  delete player.startingProvinceChosen;
  delete player.unlockedProvinces;

  migrateWorld(world, now + 1);

  assert.equal(world.version, 32);
  assert.equal(player.startingProvinceChosen, true);
  assert.equal(player.startingProvinceId, '110000');
  for (const provinceId of ['110000', '120000', '310000']) {
    assert.ok(player.unlockedProvinces.includes(provinceId), `应解锁 ${provinceId}`);
  }
  assert.equal(player.inventories['120000:wheat'].available, 3);
  assert.equal(player.inventories['310000:ore'].available, 2);
});
