import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { runCycleAutoOperation } from '../src/cycle-auto-operation.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { inventoryForProvince, DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';
import { sourceFrozenQuantity } from '../src/inventory-freezes.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const fixtureType = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => recipe.inputs?.length));
const fixtureRecipe = fixtureType?.recipes?.find((recipe) => recipe.inputs?.length);
if (!fixtureType || !fixtureRecipe) throw new Error('catalog needs an input-consuming facility');

function configureProfitableConsumer(world, player, coverage = 2) {
  player.credits = 1_000_000;
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
      inputCoverageCycles: coverage,
      mode: 'balanced',
      outputMode: 'surplus',
    },
  };
  for (const input of fixtureRecipe.inputs) {
    world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, input.productId)].officialPrice = 0.01;
    inventoryForProvince(player, input.productId, DEFAULT_PROVINCE_ID).available = input.quantity;
  }
  world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, fixtureRecipe.output.productId)].officialPrice = 10_000;
}

test('legacy online auto-buy entry no longer trades outside a completed building cycle', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100_000;
  const input = fixtureRecipe.inputs[0];
  const inventory = inventoryForProvince(player, input.productId, DEFAULT_PROVINCE_ID);
  const beforeCredits = player.credits;
  const beforeInventory = structuredClone(inventory);

  const result = applyOnlineAutoBuy(world, alice, { productId: input.productId, provinceId: DEFAULT_PROVINCE_ID }, now + 1);

  assert.equal(result.ok, true);
  assert.match(result.message, /周期完成时/);
  assert.equal(player.credits, beforeCredits);
  assert.deepEqual(inventory, beforeInventory);
});

test('completed profitable production cycle purchases missing coverage and freezes it to production', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  configureProfitableConsumer(world, player, 2);
  const input = fixtureRecipe.inputs[0];
  const inventory = inventoryForProvince(player, input.productId, DEFAULT_PROVINCE_ID);

  const outcome = runCycleAutoOperation(world, alice.id, DEFAULT_PROVINCE_ID, [
    { kind: 'production', sourceId: fixtureType.id },
  ], now + 1);

  assert.equal(outcome.purchased, true);
  assert.equal(inventory.available, 0, 'all protected input must be frozen instead of left sellable');
  assert.equal(inventory.frozen, input.quantity * 2);
  assert.equal(sourceFrozenQuantity(player, {
    kind: 'production',
    provinceId: DEFAULT_PROVINCE_ID,
    productId: input.productId,
    sourceId: fixtureType.id,
  }), input.quantity * 2);
  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);
});
