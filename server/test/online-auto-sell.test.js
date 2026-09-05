import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { runCycleAutoOperation } from '../src/cycle-auto-operation.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { applyOnlineAutoSell, contractAvailableHoldForAutoSell } from '../src/online-auto-sell.js';
import { inventoryForProvince, DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const fixtureType = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => (recipe.inputs?.length ?? 0) === 0));
const fixtureRecipe = fixtureType?.recipes?.find((recipe) => (recipe.inputs?.length ?? 0) === 0);
if (!fixtureType || !fixtureRecipe) throw new Error('catalog needs an input-free facility');

function configureProducer(world, player) {
  player.credits = 0;
  player.facilityGroups = [{
    facilityTypeId: fixtureType.id,
    provinceId: DEFAULT_PROVINCE_ID,
    count: 1,
    participatingCount: 1,
    productionAvailableCount: 1,
    enabled: true,
    status: 'running',
    activeRecipeId: fixtureRecipe.id,
    cycleStartedAt: now,
    lifetimeOutput: 0,
  }];
  player.factoryAutoOperationPolicies = {
    [provinceScopedKey(DEFAULT_PROVINCE_ID, fixtureType.id)]: {
      enabled: true,
      inputCoverageCycles: 2,
      mode: 'balanced',
      outputMode: 'surplus',
    },
  };
  world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, fixtureRecipe.output.productId)].officialPrice = 10_000;
}

test('legacy online auto-sell entry no longer trades outside a completed building cycle', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  const inventory = inventoryForProvince(player, fixtureRecipe.output.productId, DEFAULT_PROVINCE_ID);
  inventory.available = 10;
  const before = structuredClone(inventory);
  const beforeCredits = player.credits;

  const result = applyOnlineAutoSell(world, alice, {
    productId: fixtureRecipe.output.productId,
    provinceId: DEFAULT_PROVINCE_ID,
  }, now + 1);

  assert.equal(result.ok, true);
  assert.match(result.message, /周期完成时/);
  assert.deepEqual(inventory, before);
  assert.equal(player.credits, beforeCredits);
});

test('completed profitable cycle sells every available item while leaving frozen goods untouched', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  configureProducer(world, player);
  const productId = fixtureRecipe.output.productId;
  const inventory = inventoryForProvince(player, productId, DEFAULT_PROVINCE_ID);
  inventory.available = 10;
  inventory.frozen = 4;

  const outcome = runCycleAutoOperation(world, alice.id, DEFAULT_PROVINCE_ID, [
    { kind: 'production', sourceId: fixtureType.id },
  ], now + 1);

  assert.equal(outcome.sold, 10);
  assert.equal(inventory.available, 0);
  assert.equal(inventory.frozen, 4);
  assert.ok(player.credits > 0);
  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);
});

test('contract hold compatibility helper remains available for contract settlement code', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  assert.equal(contractAvailableHoldForAutoSell(world, alice.id, fixtureRecipe.output.productId, DEFAULT_PROVINCE_ID), 0);
});
