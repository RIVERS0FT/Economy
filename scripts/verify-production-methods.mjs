import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const genericMethodIds = ['standard', 'rapid', 'economical', 'high-yield'];
const dedicatedMethodIds = ['standard', 'assisted', 'intensive', 'mechanized'];
const operationTechnologyIds = new Set([
  'tool-operation', 'feed-husbandry', 'fertilizer-application', 'veterinary-application',
  'industrial-fuel-operation', 'industrial-chemical-operation', 'machinery-operation', 'tractor-operation',
]);
const expectedC1Plans = {
  farm: [[], [['tools', 1], 12], [['fertilizer', 2], 14], [['tractor', 1], 16]],
  orchard: [[], [['tools', 1], 11], [['fertilizer', 2], 13], [['tractor', 1], 15]],
  ranch: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]],
  fishery: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]],
};
const c2ProfitByMethod = { standard: 3, assisted: 6, intensive: 9, mechanized: 10.5 };
const productPrices = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));
function hasAtMostTwoDecimals(value) {
  return Math.abs(Number(value) - Math.round(Number(value) * 100) / 100) < 1e-9;
}
function profitPerMinute(recipe) {
  const inputValue = recipe.inputs.reduce(
    (sum, input) => sum + productPrices.get(input.productId) * input.quantity,
    0,
  );
  const outputValue = productPrices.get(recipe.output.productId) * recipe.output.quantity;
  return (outputValue - inputValue - recipe.operatingCost) * 60_000 / recipe.cycleMs;
}

for (const facility of FACILITY_TYPE_CATALOG) {
  const group = facility.productionMethodGroups?.find((candidate) => candidate.id === 'operation');
  assert.ok(group, `${facility.id} 缺少作业制度`);
  const dedicated = facility.complexity === 'C1' || facility.complexity === 'C2';
  const methodIds = dedicated ? dedicatedMethodIds : genericMethodIds;
  assert.deepEqual(group.methods.map((method) => method.id), methodIds);
  for (const method of group.methods) {
    assert.ok(Array.isArray(method.requiredTechnologyIds), `${facility.id}/${method.id} 缺少研发依赖数组`);
    if (dedicated && method.id !== 'standard') {
      assert.ok(method.requiredTechnologyIds.length > 0);
      assert.equal(method.requiredTechnologyIds.every((technologyId) => operationTechnologyIds.has(technologyId)), true,
        `${facility.id}/${method.id} 高级制度只能依赖作业科技`);
    }
  }
  const baseRecipes = facility.recipes.filter((recipe) => (
    !recipe.legacyProductionMethod && recipe.productionMethodId === 'standard'
  ));
  assert.ok(baseRecipes.length > 0, `${facility.id} 缺少标准生产配方`);

  for (const baseRecipe of baseRecipes) {
    const baseProfit = profitPerMinute(baseRecipe);
    const variants = methodIds.map((methodId) => facility.recipes.find((recipe) => (
      !recipe.legacyProductionMethod
      && recipe.baseRecipeId === baseRecipe.id
      && recipe.productionMethodId === methodId
    )));
    assert.equal(variants.every(Boolean), true, `${facility.id}/${baseRecipe.id} 生产方式不完整`);
    for (const recipe of variants) {
      assert.equal(hasAtMostTwoDecimals(recipe.operatingCost), true);
      assert.equal(recipe.operatingCost >= 0, true);
    }
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
    if (facility.complexity === 'C2') {
      for (const recipe of variants) {
        assert.ok(
          Math.abs(profitPerMinute(recipe) - c2ProfitByMethod[recipe.productionMethodId]) < 1e-9,
          `${facility.id}/${recipe.id} C2 利润梯度漂移`,
        );
        assert.equal(recipe.cycleMs, baseRecipe.cycleMs, `${facility.id}/${recipe.id} C2 周期不得改变`);
      }
      continue;
    }
    for (const recipe of variants) {
      assert.ok(Math.abs(profitPerMinute(recipe) - baseProfit) < 1e-9, `${facility.id}/${recipe.id} 利润基线漂移`);
    }
  }
}

const methodSource = readFileSync('server/src/production-methods.js', 'utf8');
const legacyMethodSource = readFileSync('server/src/legacy-production-methods.js', 'utf8');
const catalogSource = readFileSync('server/src/industry-catalog.js', 'utf8');
const runtimeSource = readFileSync('server/src/facility-groups.js', 'utf8');
const researchSource = readFileSync('server/src/research.js', 'utf8');
const allocationSource = readFileSync('server/src/market-demand/allocation.js', 'utf8');
const transmissionSource = readFileSync('server/src/market-demand/price-transmission.js', 'utf8');
const domainTestSource = readFileSync('server/test/domain.test.js', 'utf8');
const stapleVerifierSource = readFileSync('scripts/verify-staple-crops-demand.mjs', 'utf8');
const typesSource = readFileSync('src/types.ts', 'utf8');
const detailSource = readFileSync('src/pages/production/ProductionFacilityDetail.tsx', 'utf8');
const configControlsSource = readFileSync('src/components/facilities/FacilityProductionConfigControls.tsx', 'utf8');
const richSelectSource = readFileSync('src/components/ui/RichSelectInput.tsx', 'utf8');
const pageSource = readFileSync('src/pages/ProductionPage.tsx', 'utf8');
const gameViewModelSource = readFileSync('src/app/gameViewModel.ts', 'utf8');
const styleSource = readFileSync('src/styles/production-methods.css', 'utf8');
const formControlStyleSource = readFileSync('src/styles/form-controls.css', 'utf8');
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
  'FACILITY_METHOD_BLUEPRINTS',
  'createDedicatedProductionMethodGroups',
  'createProductionMethodRecipes',
  'alignedCycleMs',
  'requiredTechnologyIds',
  "name: '基础采伐'",
  "name: '机械化采矿'",
  "name: '动力机械钻采'",
  "name: '连续化加工'",
  "name: '动力连续制材'",
  "name: '动力连续混配'",
]) assert.ok(methodSource.includes(text), `生产方式计算缺少 ${text}`);
for (const text of ['legacyProductionMethod', "['rapid', 'economical', 'high-yield']"]) {
  assert.ok(legacyMethodSource.includes(text), `旧 C2 迁移别名缺少 ${text}`);
}
for (const text of ["id: 'industrial-fuel'", "id: 'industrial-chemicals'", 'appendLegacyC2RecipeAliases']) {
  assert.ok(catalogSource.includes(text), `产业目录缺少 ${text}`);
}
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
  'productionMethodLockedResult',
  'requiredTechnologyIds',
  'normalizeProductionMethodAccess',
  '该旧作业制度已退役',
  'LEGACY_OPERATION_TECHNOLOGY_GRANTS',
]) assert.ok(researchSource.includes(text), `作业制度研发校验缺少 ${text}`);
for (const text of [
  "String(recipe?.recipeId || '').split('--')[0]",
  'function baseProductionRecipes(outputProductId)',
  'const candidates = baseProductionRecipes(outputProductId)',
]) assert.ok(allocationSource.includes(text), `派生需求生产路线去重缺少 ${text}`);
assert.ok(
  readFileSync('server/src/market-demand.js', 'utf8').includes('for (const recipe of allRecipes)'),
  '派生需求必须在过滤无投入路线前先纳入标准配方，以免把投入型变体当成基础路线',
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
  '<FacilityProductionConfigControls',
  'selectConfiguration(selectedBaseRecipeId, recipeState.selectedProductionMethodId);',
  'selectConfiguration(recipeState.selectedBaseRecipeId, methodId);',
]) assert.ok(detailSource.includes(text), `生产方式客户端合成缺少 ${text}`);
for (const text of [
  'export function FacilityProductionConfigControls',
  'variant="production-config"',
  'aria-label={`${typeName}生产产物`}',
  'aria-label={`${typeName}生产方式`}',
  'plansByRecipeId[baseRecipeId]',
  'triggerDetail:',
  '<ProductPlanDetail',
  '<MethodPlanDetail',
  'metricTone(',
  'ProductionMethodIcon',
  'ProductArtwork',
  'completedTechnologyIds',
  'researchTechnologies',
  'missingTechnologyNames',
  '需要完成「{missingTechnologyNames.join',
]) assert.ok(configControlsSource.includes(text), `生产配置方案菜单缺少 ${text}`);
for (const forbidden of [
  'method.description',
  'selectedMethod.description',
  'role="radiogroup"',
  'role="radio"',
  'facility-production-method-option',
]) {
  assert.equal(
    detailSource.includes(forbidden) || configControlsSource.includes(forbidden),
    false,
    `生产方式不得恢复旧展示: ${forbidden}`,
  );
}
for (const text of [
  "export type RichSelectVariant = 'default' | 'production-config';",
  "variant === 'production-config'",
  'PRODUCTION_CONFIG_MENU_WIDTH',
  'PRODUCTION_CONFIG_OPTION_HEIGHT',
  'triggerDetail?: ReactNode;',
  'className="ui-rich-select__selected-mark"',
  'data-variant={variant}',
]) assert.ok(richSelectSource.includes(text), `共享富下拉生产配置变体缺少 ${text}`);
assert.ok(pageSource.includes("import '../styles/production-methods.css'"));
for (const text of [
  'const [optimisticRecipeIds, setOptimisticRecipeIds]',
  'const recipeTargetByFacilityRef = useRef(new Map<string, string>());',
  'const recipeInFlightFacilitiesRef = useRef(new Set<string>());',
  'const lastConfirmedRecipeIdsRef = useRef(new Map<string, string>());',
  '{ ...group, activeRecipeId: optimisticRecipeId }',
  'const flushFacilityRecipeQueue = (facilityTypeId: string) => {',
  'recipeTargetByFacilityRef.current.set(facilityTypeId, recipeId);',
  'setOptimisticRecipeIds((current) => (',
]) assert.ok(pageSource.includes(text), `生产配置即时反馈缺少 ${text}`);
for (const text of [
  'const runAcknowledgedAction = useCallback(async (',
  'void syncConfirmedAction(response, action).finally(finish);',
  "setFacilityRecipe: (facilityTypeId, recipeId) => runAcknowledgedAction(",
]) assert.ok(gameViewModelSource.includes(text), `生产配置确认同步缺少 ${text}`);
assert.equal(styleSource.includes('.facility-production-method-summary'), false, '生产方式规格摘要必须删除');
for (const text of [
  '.production-config-detail',
  '.production-config-flow-row',
  '.production-config-material',
  '.production-config-metric.is-positive',
  '.production-config-metric.is-negative',
]) assert.ok(styleSource.includes(text), `生产配置业务摘要样式缺少 ${text}`);
for (const text of [
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger",
  ".ui-rich-select__listbox[data-variant='production-config']",
  '.ui-rich-select__selected-mark',
]) assert.ok(formControlStyleSource.includes(text), `统一生产配置下拉视觉缺少 ${text}`);
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
  "toHaveAttribute('data-variant', 'production-config')",
  "toContainText('周期 180s ↑')",
  "toContainText('成本 4 ↓')",
  "toContainText('产出 ×2 ↑')",
  "expect(recipeListboxBox.width).toBeGreaterThan(recipeTriggerBox.width + 80)",
  "not.toContainText('缩短周期并提高成本')",
  "locator('.facility-production-method-summary')).toHaveCount(0)",
  "toContainText('节约生产')",
  "toContainText('180s · 成本 4 · 产出 ×1')",
]) assert.ok(browserSpecSource.includes(text), `生产方式浏览器回归缺少 ${text}`);
assert.ok(versionSource.includes('CURRENT_CLIENT_STATE_VERSION = 33'));
assert.ok(versionSource.includes('MIN_COMPATIBLE_CLIENT_STATE_VERSION = 33'));

for (const [path, required] of [
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', [
    'C1 与 C2 使用工厂专属作业制度',
    'C3～C7 继续使用标准生产、高速生产、节约生产和高产生产',
    'C2 四级制度参考分钟利润固定为 3、6、9、10.5',
    '工业燃料 (`industrial-fuel`)',
    '工业化学品 (`industrial-chemicals`)',
    '每周期整件消耗',
    '不累计折旧',
    '非基础作业制度必须校验 `requiredTechnologyIds`',
    '生产方式与配方必须在同一次配置动作中原子切换',
    '不得新增单座工厂生产方式状态',
    '生产设置下方不得再显示“周期 · 产出 · 成本”摘要',
    '客户端选择生产产物或作业制度后必须先立即投影目标生产配置',
    '客户端最多保留一个正在提交的配置动作和一个最新待提交目标',
  ]],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
    '作业制度',
    '未解锁作业制度',
    '立即切换',
    '不显示作业制度说明',
  ]],
  ['docs/UI_DESIGN_SYSTEM.md', [
    '生产方式下拉选择',
    'combobox',
    '未解锁作业制度',
    '作业制度说明不得显示',
    '`production-config`',
    '生产方案槽',
    '菜单允许宽于触发器',
    '不得复制第二套 Popover、键盘导航或刷新状态',
  ]],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
    '生产方式配方变体',
    'setFacilityRecipe',
    '`requiredTechnologyIds`',
    '普通玩家状态中的 `facilityTypes[].recipes` 继续只公开标准生产路线',
    '旧 C2 作业制度',
  ]],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of required) assert.ok(content.includes(text), `${path} 缺少 ${text}`);
}

console.log('生产方式验证通过：C1/C2 工厂专属整件投入制度、C2 3/6/9/10.5 利润梯度、研发门槛与旧制度迁移，C3～C7 通用固定精度平衡、稳定变体 ID、生产方案菜单、即时反馈、最新目标合并与配置原子切换均已锁定。');