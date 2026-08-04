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
  return facility.recipes.find((recipe) => (
    recipe.id === facility.defaultRecipeId
    && recipe.productionMethodId === 'standard'
  ));
}

test('化肥与化肥厂进入正式目录并保持 C4 参考利润', () => {
  const product = PRODUCT_CATALOG.find((item) => item.id === 'fertilizer');
  const facility = FACILITY_TYPE_CATALOG.find((item) => item.id === 'fertilizer-factory');
  assert.deepEqual(product, {
    id: 'fertilizer',
    name: '化肥',
    category: 'intermediate',
    basePrice: 34,
    marketDemandGroupId: 'household',
    marketDemandRole: 'direct',
    marketDemandTier: 'intermediate',
    populationDemandGroupId: 'household',
    populationDemandTier: 'intermediate',
  });
  assert.ok(facility);
  assert.equal(facility.complexity, 'C4');
  assert.equal(facility.buildCost, 330);
  assert.equal(facility.buildTimeMs, 85 * 60_000);
  assert.equal(facility.systemValue, 430);
  const recipe = standardRecipe(facility);
  assert.ok(recipe);
  assert.deepEqual(recipe.inputs, [{ productId: 'crude-oil', quantity: 2 }]);
  assert.deepEqual(recipe.output, { productId: 'fertilizer', quantity: 1 });
  assert.equal(recipe.cycleMs, 60_000);
  assert.equal(recipe.operatingCost, 10);
  assert.equal((34 - 2 * 9 - 10) * 60_000 / recipe.cycleMs, 6);
  assert.equal(facility.recipes.length, 4);
  assert.equal(MARKET_DEMAND_MODEL_VERSION, 14);
});

test('世界版本 24 迁移补齐化肥库存与市场且保留既有资产', () => {
  const now = 1_786_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, { id: 7, name: '迁移玩家' }, now);
  player.credits = 12_345;
  player.inventories.wheat.available = 77;
  delete player.inventories.fertilizer;
  delete world.markets.fertilizer;
  world.version = 23;

  const migrated = migrateWorld(world, now + 1_000);
  assert.equal(migrated.version, 24);
  assert.equal(migrated.players['7'].credits, 12_345);
  assert.equal(migrated.players['7'].inventories.wheat.available, 77);
  assert.deepEqual(migrated.players['7'].inventories.fertilizer, { available: 0, frozen: 0 });
  assert.equal(migrated.markets.fertilizer.productId, 'fertilizer');
  assert.equal(migrated.markets.fertilizer.lastPrice, 34);
});
