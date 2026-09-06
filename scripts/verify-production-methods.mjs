import { auditRecipe } from './audit-economy-balance.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';
import { CURRENT_CLIENT_STATE_VERSION, MIN_COMPATIBLE_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';

const read = (path) => readFileSync(path, 'utf8');
const retiredIds = new Set([
  'standard', 'rapid', 'economical', 'high-yield', 'assisted', 'intensive', 'mechanized',
]);
const retiredNames = new Set(['标准生产', '高速生产', '节约生产', '高产生产']);
const prices = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));

function groupFor(facility) {
  return facility.productionMethodGroups.find((group) => group.id === 'operation');
}

const sharedDefinitions = new Map();
for (const facility of FACILITY_TYPE_CATALOG) {
  const group = groupFor(facility);
  assert.ok(group, `${facility.id} 缺少作业制度`);
  assert.equal(group.methods.length, 4, `${facility.id} 必须有四种具名制度`);
  assert.equal(group.defaultMethodId, group.methods[0].id, `${facility.id} 默认制度必须是目录第一项`);
  assert.equal(new Set(group.methods.map((method) => method.id)).size, 4, `${facility.id} 制度 ID 必须唯一`);

  for (const method of group.methods) {
    assert.equal(retiredIds.has(method.id), false, `${facility.id} 泄漏旧制度 ID ${method.id}`);
    assert.equal(retiredNames.has(method.name), false, `${facility.id} 泄漏旧制度名称 ${method.name}`);
    assert.match(method.iconId, /^[a-z][a-z0-9-]*$/, `${facility.id}/${method.id} 缺少 iconId`);
    assert.ok(Array.isArray(method.requiredTechnologyIds));
    const signature = [method.name, method.iconId, method.requiredTechnologyIds];
    if (sharedDefinitions.has(method.id)) {
      assert.deepEqual(signature, sharedDefinitions.get(method.id), `${method.id} 跨工厂定义漂移`);
    } else sharedDefinitions.set(method.id, signature);

    for (const plan of Object.values(method.plansByRecipeId)) {
      assert.equal(Number.isInteger(plan.cycleMs / 1_000), true, `${plan.recipeId} 周期必须为整秒`);
      assert.equal(Number.isSafeInteger(plan.output.quantity), true, `${plan.recipeId} 产出必须为安全整数`);
      assert.equal(plan.inputs.every((input) => Number.isSafeInteger(input.quantity)), true);
      assert.equal(Math.abs(plan.operatingCost - Math.round(plan.operatingCost * 100) / 100) < 1e-9, true);
      assert.ok(plan.operatingCost >= 0);
    }
  }

  const defaultRecipes = facility.recipes.filter((recipe) => recipe.productionMethodId === group.defaultMethodId);
  assert.ok(defaultRecipes.length > 0, `${facility.id} 缺少默认制度配方`);
  assert.equal(defaultRecipes.every((recipe) => recipe.id === recipe.baseRecipeId), true);
  for (const baseRecipe of defaultRecipes) {
    const variants = group.methods.map((method) => facility.recipes.find((recipe) => (
      recipe.baseRecipeId === baseRecipe.id && recipe.productionMethodId === method.id
    )));
    assert.equal(variants.every(Boolean), true, `${facility.id}/${baseRecipe.id} 制度变体不完整`);
    if (Number(facility.complexity.slice(1)) >= 3) {
      assert.equal(
        variants.every((recipe, index) => Math.abs(auditRecipe(facility, recipe).recoveryMinutes - ((facility.complexity === 'C3' ? 75 : 80) + [0, 5, -5, 0][index])) < 1),
        true,
        `${facility.id}/${baseRecipe.id} 占款回收目标漂移`,
      );
    }
  }
}

assert.ok(sharedDefinitions.has('precision-fertilization'), '跨工厂共享制度缺少农场／果园样本');
assert.ok(sharedDefinitions.has('automated-assembly'), '跨工厂共享制度缺少工业装配样本');
assert.equal(CURRENT_CLIENT_STATE_VERSION, 42);
assert.equal(MIN_COMPATIBLE_CLIENT_STATE_VERSION, 42);

const productionSource = read('server/src/production-methods.js');
const legacySource = read('server/src/legacy-production-methods.js');
const industrySource = read('server/src/industry-catalog.js');
const facilitySource = read('server/src/facility-groups.js');
const researchSource = read('server/src/research.js');
const typesSource = read('src/types.ts');
const controlsSource = read('src/components/facilities/FacilityProductionConfigControls.tsx');
const iconSource = read('src/components/icons/OperationMethodIcons.tsx');
const harnessSource = read('tests/browser/runtime-harness.tsx');
const browserSource = read('tests/browser/production-methods.spec.ts');

for (const forbidden of [
  "id: 'standard'", "id: 'rapid'", "id: 'economical'", "id: 'high-yield'",
  "id: 'assisted'", "id: 'intensive'", "id: 'mechanized'", 'METHOD_DEFINITIONS',
]) assert.equal(productionSource.includes(forbidden), false, `正式目录不得包含 ${forbidden}`);
for (const required of [
  'FACILITY_METHOD_BLUEPRINTS', 'iconId', 'planKind', 'defaultMethodId',
  'throw new Error(`${facility.id} 缺少工厂专属作业制度`)',
]) assert.ok(productionSource.includes(required), `正式目录缺少 ${required}`);
for (const required of [
  'CURRENT_METHOD_IDS_BY_FACILITY', 'migrateLegacyProductionMethodRecipeId',
  'isLegacyProductionMethodRecipeId', "'standard', 'rapid', 'economical', 'high-yield'",
]) assert.ok(legacySource.includes(required), `旧制度迁移缺少 ${required}`);
assert.equal(industrySource.includes('appendLegacyC2RecipeAliases'), false, '正式目录不得装配旧制度别名');
assert.ok(facilitySource.includes('migrateLegacyProductionMethodRecipeId(typeId, overrides.activeRecipeId)'));
assert.ok(researchSource.includes('isLegacyProductionMethodRecipeId(recipeId)'));
assert.ok(typesSource.includes('iconId: FacilityProductionMethodIconId'));
assert.ok(controlsSource.includes('iconId={method.iconId}'));
assert.ok(controlsSource.includes('data-production-method-icon={iconId}'));
assert.ok(iconSource.includes('export function OperationMethodIcon'));
assert.ok(iconSource.includes('aria-hidden="true"'));
assert.ok(harnessSource.includes("id: 'cellular-manufacturing'"));
assert.ok(browserSource.includes("getByRole('option', { name: '单元制造' })"));
assert.ok(browserSource.includes('data-production-method-icon="factory-cell"'));
assert.ok(browserSource.includes('for (const width of [320, 360, 390, 430, 720]) {'));
assert.ok(browserSource.includes('test(`keeps mobile production controls and settlement in one non-overlapping page detail flow at ${width}px`'));
assert.equal(
  browserSource.includes("test('keeps mobile production controls and settlement in one non-overlapping page detail flow'"),
  false,
  '移动生产详情五个完整视口不得共享同一个 Playwright 单测预算',
);

for (const [path, required] of [
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['26 类工厂全部使用正式目录声明的产业语义制度', '不同工厂允许复用同一制度 ID', '保留基础产物路线、`cycleStartedAt`、满员率和批次余数']],
]) {
  const content = read(path);
  for (const text of required) assert.ok(content.includes(text), `${path} 缺少 ${text}`);
}

console.log('生产方式验证通过：26 类工厂均使用四种具名制度与语义图标，旧制度只参与等参数存档迁移，共享制度定义、固定精度、研发校验、独立移动视口门禁与客户端版本 42 均已锁定。');
