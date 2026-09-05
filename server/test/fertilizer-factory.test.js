import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FACILITY_TYPE_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  PRODUCT_CATALOG,
  createWorld,
  ensurePlayer,
  migrateWorld,
} from '../src/domain.js';

function standardRecipe(facility) {
  const defaultMethodId = facility.productionMethodGroups[0].defaultMethodId;
  return facility.recipes.find((recipe) => (
    recipe.id === facility.defaultRecipeId
    && recipe.productionMethodId === defaultMethodId
  ));
}

test('化肥与化肥厂进入正式目录并保持 C4 参考利润', () => {
  assert.equal(PRODUCT_CATALOG.length, 38);
  assert.equal(FACILITY_TYPE_CATALOG.length, 26);
  const product = PRODUCT_CATALOG.find((item) => item.id === 'fertilizer');
  const facility = FACILITY_TYPE_CATALOG.find((item) => item.id === 'fertilizer-factory');
  assert.deepEqual(product, {
    id: 'fertilizer',
    name: '化肥',
    category: 'intermediate',
    basePrice: 6.76,
    marketDemandGroupId: 'household',
    marketDemandRole: 'direct',
    marketDemandTier: 'intermediate',
    populationDemandGroupId: 'household',
    populationDemandTier: 'intermediate',
  });
  assert.ok(facility);
  assert.equal(facility.complexity, 'C4');
  assert.equal(facility.buildCost, 134);
  assert.deepEqual(facility.buildInputs, [
    { productId: 'lumber', quantity: 3 },
    { productId: 'steel', quantity: 4 },
    { productId: 'copper', quantity: 1 },
  ]);
  assert.equal(facility.systemValue, 430);
  const recipe = standardRecipe(facility);
  assert.ok(recipe);
  assert.deepEqual(recipe.inputs, [{ productId: 'crude-oil', quantity: 2 }]);
  assert.deepEqual(recipe.output, { productId: 'fertilizer', quantity: 6 });
  assert.equal(recipe.cycleMs, 60_000);
  assert.equal(recipe.operatingCost, 16.56);
  const inputValue = recipe.inputs.reduce((sum, input) => (
    sum + PRODUCT_CATALOG.find((item) => item.id === input.productId).basePrice * input.quantity
  ), 0);
  const profitPerMinute = (
    product.basePrice * recipe.output.quantity - inputValue - recipe.operatingCost
  ) * 60_000 / recipe.cycleMs;
  assert.ok(Math.abs(profitPerMinute - 6) < 1e-9);
  assert.equal(facility.recipes.length, 4);
  assert.equal(MARKET_DEMAND_MODEL_VERSION, 20);
});

test('世界版本 25 迁移仍补齐化肥库存与市场且保留既有资产', () => {
  const now = 1_786_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, { id: 7, name: '迁移玩家' }, now);
  player.credits = 12_345;
  player.inventories.wheat.available = 77;
  delete player.inventories.fertilizer;
  delete world.markets.fertilizer;
  world.version = 24;

  const migrated = migrateWorld(world, now + 1_000);
  assert.equal(migrated.version, 33);
  assert.equal(migrated.players['7'].credits, 12_345);
  assert.equal(migrated.players['7'].inventories.wheat.available, 77);
  assert.deepEqual(migrated.players['7'].inventories.fertilizer, { available: 0, frozen: 0, inTransit: 0 });
  assert.equal(migrated.markets.fertilizer.productId, 'fertilizer');
  assert.equal(migrated.markets.fertilizer.lastPrice, 6.76);
});
