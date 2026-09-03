import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  migrateWorld,
} from '../src/domain.js';
import { isProvinceUnlocked, provinceUnlockError } from '../src/province-access.js';
import { inventoryForProvince, PROVINCE_CATALOG } from '../src/provinces.js';
import { stateEconomicLevelFor } from '../src/state-economic-baselines.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const now = 1_700_000_000_000;

function deferDemand(world, at = now + 5 * 60 * 1000) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = at;
}

function assertAllProvincesAccessible(player) {
  assert.equal(player.startingProvinceChosen, true);
  assert.equal(new Set(player.unlockedProvinces).size, PROVINCE_CATALOG.length);
  assert.deepEqual(new Set(player.unlockedProvinces), new Set(PROVINCE_CATALOG.map((province) => province.id)));
  for (const province of PROVINCE_CATALOG) {
    assert.equal(isProvinceUnlocked(player, province.id), true, `${province.id} 应直接可经营`);
    assert.equal(provinceUnlockError(player, province.id), null, `${province.id} 不应存在解锁门禁`);
  }
}

test('new player can operate every province without choosing a starting province', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  assertAllProvincesAccessible(player);

  const result = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: 1, provinceId: '130000',
  }, now + 1);
  assert.equal(result.ok, true);
});

test('economic levels remain five-tier information and no longer control access', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.startingProvinceChosen = false;
  player.unlockedProvinces = ['110000'];
  const levels = PROVINCE_CATALOG.map((province) => stateEconomicLevelFor(province.id));
  assert.deepEqual([...new Set(levels)].sort((left, right) => left - right), [1, 2, 3, 4, 5]);
  for (const province of PROVINCE_CATALOG) assert.equal(isProvinceUnlocked(player, province.id), true);
});

test('retired starting and unlock actions never spend funds or change access eligibility', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 50_000;
  const before = player.credits;

  const choose = applyAction(world, alice, 'chooseStartingProvince', { provinceId: '130000' }, now + 1);
  assert.equal(choose.ok, false);
  assert.match(choose.message, /已取消/);
  assert.equal(player.credits, before);

  const unlock = applyAction(world, alice, 'unlockProvince', { provinceId: '310000' }, now + 2);
  assert.equal(unlock.ok, false);
  assert.match(unlock.message, /已取消/);
  assert.equal(player.credits, before);
  assertAllProvincesAccessible(player);
});

test('legacy access fields cannot block province economic writes', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.startingProvinceChosen = false;
  player.startingProvinceId = '110000';
  player.unlockedProvinces = ['110000'];

  const result = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: 1, provinceId: '130000',
  }, now + 1);
  assert.equal(result.ok, true);
});

test('world migration normalizes legacy province access fields to all 48 states and preserves assets', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 5_000;
  inventoryForProvince(player, 'wheat', '120000').available = 3;
  inventoryForProvince(player, 'ore', '310000').available = 2;
  world.version = 31;
  delete player.startingProvinceId;
  player.startingProvinceChosen = false;
  player.unlockedProvinces = ['110000'];

  migrateWorld(world, now + 1);

  assert.equal(world.version, 32);
  assert.equal(player.startingProvinceId, '110000');
  assertAllProvincesAccessible(player);
  assert.equal(player.inventories['120000:wheat'].available, 3);
  assert.equal(player.inventories['310000:ore'].available, 2);
});
