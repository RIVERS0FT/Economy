import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const methodIds = ['standard', 'rapid', 'economical', 'high-yield'];
const productPrices = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));
const expectedProfit = { C1: 1, C2: 3, C3: 6, C4: 6, C5: 8, C6: 10, C7: 12 };

for (const facility of FACILITY_TYPE_CATALOG) {
  const group = facility.productionMethodGroups?.find((candidate) => candidate.id === 'operation');
  assert.ok(group, `${facility.id} 缺少作业制度`);
  assert.deepEqual(group.methods.map((method) => method.id), methodIds);
  const baseRecipes = facility.recipes.filter((recipe) => recipe.productionMethodId === 'standard');
  assert.ok(baseRecipes.length > 0, `${facility.id} 缺少标准生产配方`);

  for (const baseRecipe of baseRecipes) {
    const variants = methodIds.map((methodId) => facility.recipes.find((recipe) => (
      recipe.baseRecipeId === baseRecipe.id && recipe.productionMethodId === methodId
    )));
    assert.equal(variants.every(Boolean), true, `${facility.id}/${baseRecipe.id} 生产方式不完整`);
    for (const recipe of variants) {
      const inputValue = recipe.inputs.reduce(
        (sum, input) => sum + productPrices.get(input.productId) * input.quantity,
        0,
      );
      const outputValue = productPrices.get(recipe.output.productId) * recipe.output.quantity;
      const profitPerMinute = (outputValue - inputValue - recipe.operatingCost) * 60_000 / recipe.cycleMs;
      assert.equal(profitPerMinute, expectedProfit[facility.complexity], `${facility.id}/${recipe.id} 利润基线漂移`);
      assert.equal(Number.isSafeInteger(recipe.operatingCost), true);
      assert.equal(recipe.operatingCost >= 0, true);
    }
  }
}

const methodSource = readFileSync('server/src/production-methods.js', 'utf8');
const catalogSource = readFileSync('server/src/industry-catalog.js', 'utf8');
const runtimeSource = readFileSync('server/src/facility-groups.js', 'utf8');
const allocationSource = readFileSync('server/src/market-demand/allocation.js', 'utf8');
const transmissionSource = readFileSync('server/src/market-demand/price-transmission.js', 'utf8');
const domainTestSource = readFileSync('server/test/domain.test.js', 'utf8');
const detailSource = readFileSync('src/pages/production/ProductionFacilityDetail.tsx', 'utf8');
const pageSource = readFileSync('src/pages/ProductionPage.tsx', 'utf8');
const styleSource = readFileSync('src/styles/production-methods.css', 'utf8');
const versionSource = readFileSync('server/shared/economy-state-version.js', 'utf8');

for (const text of [
  "id: 'standard'",
  "id: 'rapid'",
  "id: 'economical'",
  "id: 'high-yield'",
  'createProductionMethodRecipes',
  'alignedCycleMs',
  'id: plan.recipeId',
]) assert.ok(methodSource.includes(text), `生产方式计算缺少 ${text}`);
assert.ok(catalogSource.includes('productionMethodGroups'));
assert.ok(catalogSource.includes('createProductionMethodRecipes'));
assert.ok(runtimeSource.includes('group.pendingRecipeId = recipe.id'));
assert.ok(runtimeSource.includes('applyPendingRecipe(group)'));
for (const text of [
  "String(recipe?.recipeId || '').split('--')[0]",
  'function baseProductionRecipes(outputProductId)',
  'const candidates = baseProductionRecipes(outputProductId)',
]) assert.ok(allocationSource.includes(text), `派生需求生产路线去重缺少 ${text}`);
for (const text of [
  "const baseRecipes = recipes.filter((recipe) => !String(recipe.recipeId || '').includes('--'))",
  'const recipeCountByOutput = baseRecipes.reduce',
  'for (const recipe of baseRecipes)',
]) assert.ok(transmissionSource.includes(text), `价格传导生产路线去重缺少 ${text}`);
for (const text of [
  "const standardRecipes = (facility) => facility.recipes.filter(",
  "standardRecipes(facilities.get('farm'))",
  "standardRecipes(facilities.get('beverage-factory'))",
]) assert.ok(domainTestSource.includes(text), `领域目录测试未区分基础路线: ${text}`);
assert.ok(detailSource.includes('productionRecipeVariantId'));
assert.ok(detailSource.includes('role="radiogroup"'));
assert.ok(detailSource.includes('role="radio"'));
assert.ok(detailSource.includes('facility-production-method-option'));
assert.ok(pageSource.includes("import '../styles/production-methods.css'"));
assert.ok(styleSource.includes('.facility-production-method-grid'));
assert.ok(styleSource.includes("[data-selected='true']"));
assert.ok(versionSource.includes('CURRENT_CLIENT_STATE_VERSION = 24'));
assert.ok(versionSource.includes('MIN_COMPATIBLE_CLIENT_STATE_VERSION = 24'));

for (const [path, required] of [
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', [
    '标准生产、高速生产、节约生产和高产生产',
    '生产方式与配方必须在同一个周期边界原子切换',
    '不得新增单座工厂生产方式状态',
  ]],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['作业制度', '下一周期切换']],
  ['docs/UI_DESIGN_SYSTEM.md', ['生产方式选择卡', 'radiogroup']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['生产方式配方变体', 'setFacilityRecipe']],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of required) assert.ok(content.includes(text), `${path} 缺少 ${text}`);
}

console.log('生产方式验证通过：四种作业制度、整数平衡、稳定变体 ID、周期边界切换、需求图去重、领域目录断言、响应式选择卡和版本兼容均已锁定。');
