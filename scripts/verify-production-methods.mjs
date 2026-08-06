import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const genericMethodIds = ['standard', 'rapid', 'economical', 'high-yield'];
const c1MethodIds = ['standard', 'assisted', 'intensive', 'mechanized'];
const expectedC1Plans = {
  farm: [[], [['tools', 1], 12], [['fertilizer', 2], 14], [['tractor', 1], 16]],
  orchard: [[], [['tools', 1], 11], [['fertilizer', 2], 13], [['tractor', 1], 15]],
  ranch: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]],
  fishery: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]],
};
const productPrices = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));
function hasAtMostTwoDecimals(value) {
  return Math.abs(Number(value) - Math.round(Number(value) * 100) / 100) < 1e-9;
}

for (const facility of FACILITY_TYPE_CATALOG) {
  const group = facility.productionMethodGroups?.find((candidate) => candidate.id === 'operation');
  assert.ok(group, `${facility.id} 缺少作业制度`);
  const methodIds = facility.complexity === 'C1' ? c1MethodIds : genericMethodIds;
  assert.deepEqual(group.methods.map((method) => method.id), methodIds);
  const baseRecipes = facility.recipes.filter((recipe) => recipe.productionMethodId === 'standard');
  assert.ok(baseRecipes.length > 0, `${facility.id} 缺少标准生产配方`);

  for (const baseRecipe of baseRecipes) {
    const baseInputValue = baseRecipe.inputs.reduce(
      (sum, input) => sum + productPrices.get(input.productId) * input.quantity,
      0,
    );
    const baseOutputValue = productPrices.get(baseRecipe.output.productId) * baseRecipe.output.quantity;
    const baseProfit = (baseOutputValue - baseInputValue - baseRecipe.operatingCost) * 60_000 / baseRecipe.cycleMs;
    const variants = methodIds.map((methodId) => facility.recipes.find((recipe) => (
      recipe.baseRecipeId === baseRecipe.id && recipe.productionMethodId === methodId
    )));
    assert.equal(variants.every(Boolean), true, `${facility.id}/${baseRecipe.id} 生产方式不完整`);
    if (facility.complexity === 'C1') {
      assert.equal(variants.every((recipe) => recipe.cycleMs === baseRecipe.cycleMs), true);
      assert.equal(variants.every((recipe) => recipe.operatingCost === baseRecipe.operatingCost), true);
      assert.deepEqual(variants[0].inputs, []);
      assert.equal(variants[0].output.quantity, 1);
      for (let index = 1; index < variants.length; index += 1) {
        const [expectedInput, expectedOutput] = expectedC1Plans[facility.id][index];
        assert.deepEqual(
          variants[index].inputs.map((input) => [input.productId, input.quantity]),
          [expectedInput],
        );
        assert.equal(variants[index].output.quantity, expectedOutput);
      }
      continue;
    }
    for (const recipe of variants) {
      const inputValue = recipe.inputs.reduce(
        (sum, input) => sum + productPrices.get(input.productId) * input.quantity,
        0,
      );
      const outputValue = productPrices.get(recipe.output.productId) * recipe.output.quantity;
      const profitPerMinute = (outputValue - inputValue - recipe.operatingCost) * 60_000 / recipe.cycleMs;
      assert.ok(Math.abs(profitPerMinute - baseProfit) < 1e-9, `${facility.id}/${recipe.id} 利润基线漂移`);
      assert.equal(hasAtMostTwoDecimals(recipe.operatingCost), true);
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
const stapleVerifierSource = readFileSync('scripts/verify-staple-crops-demand.mjs', 'utf8');
const typesSource = readFileSync('src/types.ts', 'utf8');
const detailSource = readFileSync('src/pages/production/ProductionFacilityDetail.tsx', 'utf8');
const pageSource = readFileSync('src/pages/ProductionPage.tsx', 'utf8');
const styleSource = readFileSync('src/styles/production-methods.css', 'utf8');
const browserHarnessSource = readFileSync('tests/browser/runtime-harness.tsx', 'utf8');
const browserSpecSource = readFileSync('tests/browser/production-methods.spec.ts', 'utf8');
const versionSource = readFileSync('server/shared/economy-state-version.js', 'utf8');

for (const text of [
  "id: 'standard'",
  "id: 'rapid'",
  "id: 'economical'",
  "id: 'high-yield'",
  "id: 'assisted'",
  "id: 'intensive'",
  "id: 'mechanized'",
  'C1_METHOD_BLUEPRINTS',
  'createProductionMethodRecipes',
  'alignedCycleMs',
  'id: plan.recipeId',
]) assert.ok(methodSource.includes(text), `生产方式计算缺少 ${text}`);
assert.ok(catalogSource.includes('productionMethodGroups'));
assert.ok(catalogSource.includes('createProductionMethodRecipes'));
assert.ok(runtimeSource.includes('group.activeRecipeId = recipe.id'));
assert.ok(runtimeSource.includes('applyConfigurationStaffingPenalty(group, now)'));
assert.equal(runtimeSource.includes('group.pendingRecipeId = recipe.id'), false);
for (const text of [
  'facilityTypes: FACILITY_TYPE_CATALOG.map',
  "(recipe.productionMethodId || 'standard') === 'standard'",
]) assert.ok(runtimeSource.includes(text), `公开工厂目录兼容缺少 ${text}`);
for (const text of [
  "String(recipe?.recipeId || '').split('--')[0]",
  'function baseProductionRecipes(outputProductId)',
  'const candidates = baseProductionRecipes(outputProductId)',
]) assert.ok(allocationSource.includes(text), `派生需求生产路线去重缺少 ${text}`);
assert.ok(
  readFileSync('server/src/market-demand.js', 'utf8').includes('for (const recipe of allRecipes)'),
  '派生需求必须在过滤无投入路线前先纳入标准配方，以免把 C1 投入型变体当成基础路线',
);
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
for (const text of [
  "const standardRecipes = (facility) => facility.recipes.filter(",
  "standardRecipes(facilities.get('beverage-factory'))",
]) assert.ok(stapleVerifierSource.includes(text), `主食需求验证未区分基础路线: ${text}`);
assert.ok(
  typesSource.includes('productionMethodGroups?: FacilityProductionMethodGroupDefinition[];'),
  '客户端生产方式目录元数据必须保持向后兼容可选',
);
for (const text of [
  'productionRecipeVariantId',
  'const methodGroup = productionMethodGroupForType(type);',
  'id: plan.recipeId',
  'aria-label={`${type.name}生产方式`}',
  'value={recipeState.selectedProductionMethodId}',
  'methodId as FacilityProductionMethodId',
  'RichSelectInput',
  'onValueChange={(methodId)',
]) assert.ok(detailSource.includes(text), `生产方式客户端合成缺少 ${text}`);
for (const forbidden of [
  'role="radiogroup"',
  'role="radio"',
  'facility-production-method-option',
  'selectedMethod.description',
]) {
  assert.equal(detailSource.includes(forbidden), false, `生产方式不得恢复旧展示: ${forbidden}`);
}
assert.ok(pageSource.includes("import '../styles/production-methods.css'"));
assert.equal(styleSource.includes('.facility-production-method-summary'), false, '生产方式规格摘要必须删除');
for (const forbidden of [
  '.facility-production-method-grid',
  '.facility-production-method-option',
  "[data-selected='true']",
  '.facility-production-method-summary small',
]) {
  assert.equal(styleSource.includes(forbidden), false, `生产方式样式不得恢复旧展示: ${forbidden}`);
}
for (const text of [
  "scenario === 'production-methods'",
  '__productionRecipeRequests',
  "activeRecipeId: `${baseRecipe.id}--rapid`",
]) assert.ok(browserHarnessSource.includes(text), `生产方式浏览器夹具缺少 ${text}`);
for (const text of [
  "not.toContainText('下一周期')",
  "'machine-factory:machinery-recipe--economical'",
  "getByRole('combobox', { name: '机械工厂生产方式' })",
  "getByRole('option', { name: '节约生产' })",
  "methodListbox.getByRole('option', { name: '节约生产' }).click()",
  "not.toContainText('缩短周期并提高成本')",
  "locator('.facility-production-method-summary')).toHaveCount(0)",
]) assert.ok(browserSpecSource.includes(text), `生产方式浏览器回归缺少 ${text}`);
assert.ok(versionSource.includes('CURRENT_CLIENT_STATE_VERSION = 30'));
assert.ok(versionSource.includes('MIN_COMPATIBLE_CLIENT_STATE_VERSION = 30'));

for (const [path, required] of [
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', [
    '标准生产、高速生产、节约生产和高产生产',
    '基础、工具／饲料、化肥／药剂、拖拉机／机械化',
    '每周期整件消耗',
    '不累计折旧',
    '生产方式与配方必须在同一次配置动作中原子切换',
    '不得新增单座工厂生产方式状态',
    '生产设置下方不得再显示“周期 · 产出 · 成本”摘要',
  ]],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
    '作业制度',
    '立即切换',
    '不显示作业制度说明',
  ]],
  ['docs/UI_DESIGN_SYSTEM.md', [
    '生产方式下拉选择',
    'combobox',
    '作业制度说明不得显示',
  ]],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
    '生产方式配方变体',
    'setFacilityRecipe',
    '普通玩家状态中的 `facilityTypes[].recipes` 继续只公开标准生产路线',
  ]],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of required) assert.ok(content.includes(text), `${path} 缺少 ${text}`);
}

console.log('生产方式验证通过：C1 固定时间与现金成本、整件投入和渐进产出，C2～C7 固定精度平衡、稳定变体 ID、配置立即切换、进度清零、满员率惩罚、需求图去重和浏览器交互均已锁定。');
