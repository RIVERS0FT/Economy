import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const expectedProducts = [
  'wheat', 'rice', 'cotton', 'sugarcane', 'fruit', 'timber', 'ore', 'copper-ore', 'crude-oil',
  'meat', 'eggs', 'milk', 'fish', 'wool', 'flour', 'sugar', 'lumber', 'steel', 'copper',
  'plastic', 'fertilizer', 'feed', 'veterinary-medicine', 'textile', 'pulp', 'food', 'beverage',
  'prepared-meal', 'paper', 'furniture', 'clothing', 'tools', 'machinery', 'tractor', 'electronics',
  'appliance',
];
const expectedFacilities = [
  'farm', 'orchard', 'ranch', 'fishery',
  'logging-camp', 'mine', 'oil-field', 'mill', 'sawmill', 'feed-factory',
  'pulp-mill', 'steelworks', 'textile-mill', 'food-factory', 'paper-mill',
  'refinery', 'fertilizer-factory', 'veterinary-medicine-factory', 'beverage-factory',
  'furniture-factory', 'garment-factory', 'tool-workshop', 'machine-factory', 'tractor-factory',
  'electronics-factory', 'appliance-factory',
];
const expectedPrices = {
  wheat: 1.2, rice: 1.2, cotton: 1.2, sugarcane: 1.2, fruit: 1.3, timber: 6, ore: 7,
  'copper-ore': 7, 'crude-oil': 9, meat: 2.4, eggs: 2.4, milk: 2.4, fish: 2.5, wool: 2.4,
  flour: 13, sugar: 13, lumber: 17, steel: 29, copper: 29, plastic: 30, fertilizer: 6.76, feed: 5.8,
  'veterinary-medicine': 14.1, textile: 20, pulp: 20, food: 15, beverage: 18,
  'prepared-meal': 18, paper: 15, furniture: 24, clothing: 55, tools: 12, machinery: 15.55,
  tractor: 15.35, electronics: 84, appliance: 92,
};
const expectedConstruction = {
  'farm': { complexity: 'C1', buildCost: 50, buildInputs: [], systemValue: 65 },
  'orchard': { complexity: 'C1', buildCost: 70, buildInputs: [], systemValue: 95 },
  'ranch': { complexity: 'C1', buildCost: 58, buildInputs: [{ productId: 'timber', quantity: 3 }, { productId: 'ore', quantity: 2 }], systemValue: 120 },
  'fishery': { complexity: 'C1', buildCost: 62, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 2 }], systemValue: 130 },
  'logging-camp': { complexity: 'C2', buildCost: 85, buildInputs: [{ productId: 'cotton', quantity: 6 }, { productId: 'ore', quantity: 4 }], systemValue: 160 },
  'mine': { complexity: 'C2', buildCost: 109, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'cotton', quantity: 6 }], systemValue: 185 },
  'oil-field': { complexity: 'C2', buildCost: 121, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 4 }, { productId: 'copper-ore', quantity: 1 }], systemValue: 235 },
  'mill': { complexity: 'C2', buildCost: 98, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }], systemValue: 195 },
  'sawmill': { complexity: 'C2', buildCost: 112, buildInputs: [{ productId: 'timber', quantity: 5 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }], systemValue: 225 },
  'feed-factory': { complexity: 'C2', buildCost: 108, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }], systemValue: 210 },
  'pulp-mill': { complexity: 'C3', buildCost: 110, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 1 }], systemValue: 250 },
  'steelworks': { complexity: 'C3', buildCost: 137, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'ore', quantity: 5 }], systemValue: 315 },
  'textile-mill': { complexity: 'C3', buildCost: 111, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 2 }], systemValue: 290 },
  'food-factory': { complexity: 'C3', buildCost: 121, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 2 }], systemValue: 300 },
  'paper-mill': { complexity: 'C3', buildCost: 124, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 2 }], systemValue: 325 },
  'refinery': { complexity: 'C4', buildCost: 104, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'copper', quantity: 1 }], systemValue: 390 },
  'fertilizer-factory': { complexity: 'C4', buildCost: 134, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'copper', quantity: 1 }], systemValue: 430 },
  'veterinary-medicine-factory': { complexity: 'C4', buildCost: 163, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'plastic', quantity: 1 }], systemValue: 470 },
  'beverage-factory': { complexity: 'C4', buildCost: 96, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 3 }, { productId: 'copper', quantity: 1 }], systemValue: 365 },
  'furniture-factory': { complexity: 'C4', buildCost: 140, buildInputs: [{ productId: 'lumber', quantity: 6 }, { productId: 'steel', quantity: 2 }], systemValue: 390 },
  'garment-factory': { complexity: 'C4', buildCost: 165, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 3 }, { productId: 'plastic', quantity: 1 }], systemValue: 455 },
  'tool-workshop': { complexity: 'C4', buildCost: 136, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 4 }], systemValue: 420 },
  'machine-factory': { complexity: 'C5', buildCost: 130, buildInputs: [{ productId: 'steel', quantity: 7 }, { productId: 'copper', quantity: 3 }, { productId: 'plastic', quantity: 2 }], systemValue: 625 },
  'tractor-factory': { complexity: 'C5', buildCost: 214, buildInputs: [{ productId: 'steel', quantity: 8 }, { productId: 'copper', quantity: 2 }, { productId: 'machinery', quantity: 1 }], systemValue: 680 },
  'electronics-factory': { complexity: 'C6', buildCost: 216, buildInputs: [{ productId: 'steel', quantity: 6 }, { productId: 'copper', quantity: 6 }, { productId: 'plastic', quantity: 4 }, { productId: 'machinery', quantity: 1 }], systemValue: 910 },
  'appliance-factory': { complexity: 'C7', buildCost: 468, buildInputs: [{ productId: 'steel', quantity: 8 }, { productId: 'plastic', quantity: 5 }, { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }], systemValue: 1235 },
};
const expectedProfitByComplexity = { C2: 3, C3: 6, C4: 6, C5: 8, C6: 10, C7: 12 };
const expectedC1ProfitByFacility = { farm: 0.6, orchard: 0.9, ranch: 0.8, fishery: 1 };
const expectedProductionMethods = ['standard', 'rapid', 'economical', 'high-yield'];
const expectedC1ProductionMethods = ['standard', 'assisted', 'intensive', 'mechanized'];
const expectedC1Plans = {
  farm: [[], [['tools', 1], 12], [['fertilizer', 2], 14], [['tractor', 1], 16]],
  orchard: [[], [['tools', 1], 11], [['fertilizer', 2], 13], [['tractor', 1], 15]],
  ranch: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]],
  fishery: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]],
};

function standardRecipes(facility) {
  return facility.recipes.filter((recipe) => (recipe.productionMethodId || 'standard') === 'standard');
}

function hasAtMostTwoDecimals(value) {
  return Math.abs(Number(value) - Math.round(Number(value) * 100) / 100) < 1e-9;
}

function expectedProfitFor(facility) {
  return facility.complexity === 'C1'
    ? expectedC1ProfitByFacility[facility.id]
    : expectedProfitByComplexity[facility.complexity];
}

assert.equal(PRODUCT_CATALOG.length, 36, '商品目录必须为 36 项');
assert.equal(FACILITY_TYPE_CATALOG.length, 26, '工厂目录必须为 26 项');
assert.deepEqual(PRODUCT_CATALOG.map((item) => item.id), expectedProducts);
assert.deepEqual(FACILITY_TYPE_CATALOG.map((item) => item.id), expectedFacilities);
const facilityComplexityRanks = FACILITY_TYPE_CATALOG.map((item) => Number(item.complexity.slice(1)));
assert.deepEqual(
  facilityComplexityRanks,
  [...facilityComplexityRanks].sort((left, right) => left - right),
  '工厂正式目录必须按复杂度 C1 至 C7 升序排列',
);
assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((item) => [item.id, item.basePrice])), expectedPrices);
assert.deepEqual(Object.fromEntries(FACILITY_TYPE_CATALOG.map((item) => [item.id, {
  complexity: item.complexity,
  buildCost: item.buildCost,
  buildInputs: item.buildInputs,
  systemValue: item.systemValue,
}])), expectedConstruction);

const productIds = new Set(expectedProducts);
const cashOnlyFacilityIds = new Set(['farm', 'orchard']);
for (const product of PRODUCT_CATALOG) {
  assert.equal(hasAtMostTwoDecimals(product.basePrice), true, `${product.id} 初始参考价最多保留两位小数`);
  assert.ok(product.marketDemandGroupId === undefined || ['food', 'household'].includes(product.marketDemandGroupId), `${product.id} 市场需求组无效`);
}
for (const facility of FACILITY_TYPE_CATALOG) {
  assert.equal(Number.isInteger(facility.buildCost), true, `${facility.id} 建造费必须为整数`);
  assert.ok(Array.isArray(facility.buildInputs), `${facility.id} 必须声明 buildInputs 数组`);
  if (cashOnlyFacilityIds.has(facility.id)) {
    assert.deepEqual(facility.buildInputs, [], `${facility.id} 必须使用空建造材料数组`);
  } else {
    assert.ok(facility.buildInputs.length > 0, `${facility.id} 必须声明至少一种建造材料`);
  }
  let materialReferenceValue = 0;
  for (const item of facility.buildInputs) {
    assert.ok(productIds.has(item.productId), `${facility.id} 建造材料必须引用正式商品`);
    assert.equal(Number.isSafeInteger(item.quantity) && item.quantity > 0, true, `${facility.id} 建造材料数量必须为安全正整数`);
    assert.notEqual(item.productId, facility.output.productId, `${facility.id} 不得使用自身产出作为建造材料`);
    materialReferenceValue += expectedPrices[item.productId] * item.quantity;
  }
  assert.equal(
    facility.systemValue,
    Math.ceil(((facility.buildCost + materialReferenceValue) * 1.3) / 5) * 5,
    `${facility.id} 系统参考值必须按资金与材料参考总值的 130% 向上取整到 5`,
  );

  const routes = standardRecipes(facility);
  assert.ok(routes.some((recipe) => recipe.id === facility.defaultRecipeId));
  const defaultRecipe = routes.find((recipe) => recipe.id === facility.defaultRecipeId);
  assert.equal(facility.cycleMs, defaultRecipe.cycleMs);
  assert.equal(facility.operatingCost, defaultRecipe.operatingCost);

  const methodGroup = facility.productionMethodGroups.find((group) => group.id === 'operation');
  assert.ok(methodGroup, `${facility.id} 必须声明作业制度`);
  assert.equal(methodGroup.defaultMethodId, 'standard');
  const methodIds = facility.complexity === 'C1' ? expectedC1ProductionMethods : expectedProductionMethods;
  assert.deepEqual(methodGroup.methods.map((method) => method.id), methodIds);
  assert.equal(facility.recipes.length, routes.length * methodIds.length);

  for (const route of routes) {
    const variants = facility.recipes.filter((recipe) => recipe.baseRecipeId === route.id);
    assert.deepEqual(variants.map((recipe) => recipe.productionMethodId), methodIds);
    for (const recipe of variants) {
      assert.ok(Array.isArray(recipe.inputs), `${facility.id}/${recipe.id} 必须使用 inputs[]`);
      assert.equal(Number.isInteger(recipe.cycleMs / 1_000), true);
      assert.equal(hasAtMostTwoDecimals(recipe.operatingCost), true);
      assert.ok(recipe.operatingCost >= 0, `${facility.id}/${recipe.id} 周期成本不得为负数`);
      for (const input of recipe.inputs) {
        assert.ok(productIds.has(input.productId));
        assert.equal(Number.isInteger(input.quantity), true);
      }
      assert.ok(productIds.has(recipe.output.productId));
      assert.equal(Number.isInteger(recipe.output.quantity), true);
      if (facility.complexity !== 'C1' || recipe.productionMethodId === 'standard') {
        const inputValue = recipe.inputs.reduce((sum, input) => sum + expectedPrices[input.productId] * input.quantity, 0);
        const profit = (expectedPrices[recipe.output.productId] * recipe.output.quantity - inputValue - recipe.operatingCost)
          * 60_000 / recipe.cycleMs;
        assert.ok(Math.abs(profit - expectedProfitFor(facility)) < 1e-9, `${facility.id}/${recipe.id} 参考分钟利润错误: ${profit}`);
      }
    }
    if (facility.complexity === 'C1') {
      assert.equal(variants.every((recipe) => recipe.cycleMs === route.cycleMs), true);
      assert.equal(variants.every((recipe) => recipe.operatingCost === route.operatingCost), true);
      assert.deepEqual(variants[0].inputs, []);
      assert.equal(variants[0].output.quantity, 1);
      for (let index = 1; index < variants.length; index += 1) {
        const [expectedInput, expectedOutput] = expectedC1Plans[facility.id][index];
        assert.deepEqual(variants[index].inputs.map((input) => [input.productId, input.quantity]), [expectedInput]);
        assert.equal(variants[index].output.quantity, expectedOutput);
      }
      continue;
    }
    const rapid = variants.find((recipe) => recipe.productionMethodId === 'rapid');
    const economical = variants.find((recipe) => recipe.productionMethodId === 'economical');
    const highYield = variants.find((recipe) => recipe.productionMethodId === 'high-yield');
    assert.ok(rapid.cycleMs <= route.cycleMs && rapid.operatingCost >= route.operatingCost);
    assert.ok(economical.cycleMs >= route.cycleMs && economical.operatingCost <= route.operatingCost);
    assert.equal(highYield.cycleMs, route.cycleMs);
    assert.equal(highYield.output.quantity, route.output.quantity * 2);
    assert.deepEqual(highYield.inputs, route.inputs.map((input) => ({ ...input, quantity: input.quantity * 2 })));
  }
}

const facilities = new Map(FACILITY_TYPE_CATALOG.map((item) => [item.id, item]));
const expectedC1Standard = {
  farm: { cycleMs: 20_000, operatingCost: 1, outputQuantity: 1 },
  orchard: { cycleMs: 20_000, operatingCost: 1, outputQuantity: 1 },
  ranch: { cycleMs: 30_000, operatingCost: 2, outputQuantity: 1 },
  fishery: { cycleMs: 30_000, operatingCost: 2, outputQuantity: 1 },
};
for (const [facilityId, expected] of Object.entries(expectedC1Standard)) {
  for (const recipe of standardRecipes(facilities.get(facilityId))) {
    assert.equal(recipe.cycleMs, expected.cycleMs);
    assert.equal(recipe.operatingCost, expected.operatingCost);
    assert.equal(recipe.output.quantity, expected.outputQuantity);
  }
}
assert.deepEqual(standardRecipes(facilities.get('farm')).map((item) => item.id), ['wheat-crop', 'rice-crop', 'cotton-crop', 'sugarcane-crop']);
assert.equal(standardRecipes(facilities.get('orchard'))[0].output.productId, 'fruit');
assert.equal(standardRecipes(facilities.get('fishery'))[0].output.productId, 'fish');
assert.equal(facilities.get('mill').name, '磨坊');
assert.deepEqual(standardRecipes(facilities.get('mill')).map((item) => item.id), ['mill-default', 'sugar-milling']);
assert.equal(facilities.get('steelworks').name, '冶炼厂');
assert.equal(facilities.has('copper-smelter'), false, '不得新增铜冶炼厂');
assert.deepEqual(standardRecipes(facilities.get('food-factory')).map((item) => item.id), ['food-factory-default', 'prepared-meal-production']);
assert.deepEqual(standardRecipes(facilities.get('beverage-factory')).map((item) => item.id), ['milk-beverage', 'fruit-beverage']);
assert.deepEqual(standardRecipes(facilities.get('mill')).map((item) => item.operatingCost), [8.6, 8.6]);
assert.deepEqual(standardRecipes(facilities.get('textile-mill')).map((item) => item.operatingCost), [8.8, 11.2]);
assert.equal(standardRecipes(facilities.get('food-factory'))[1].operatingCost, 14.5);
assert.deepEqual(standardRecipes(facilities.get('beverage-factory')).map((item) => item.operatingCost), [14.6, 14.4]);
assert.equal(standardRecipes(facilities.get('furniture-factory'))[0].operatingCost, 8);
assert.deepEqual(standardRecipes(facilities.get('tool-workshop'))[0].inputs, [{ productId: 'steel', quantity: 1 }, { productId: 'lumber', quantity: 1 }]);
assert.deepEqual(standardRecipes(facilities.get('tool-workshop'))[0].output, { productId: 'tools', quantity: 5 });
assert.deepEqual(standardRecipes(facilities.get('electronics-factory'))[0].inputs, [
  { productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 },
]);
assert.deepEqual(standardRecipes(facilities.get('appliance-factory'))[0].inputs, [
  { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 },
]);

const coreSource = readFileSync('server/src/domain-core.js', 'utf8');
const catalogSource = readFileSync('server/src/industry-catalog.js', 'utf8');
const methodSource = readFileSync('server/src/production-methods.js', 'utf8');
assert.ok(coreSource.includes("from './industry-catalog.js'"), '核心领域必须读取单一产业目录');
assert.equal(coreSource.includes('export const PRODUCT_CATALOG = Object.freeze(['), false, 'domain-core.js 不得复制正式商品目录');
assert.equal(coreSource.includes('STARTER_CONSTRUCTION_MATERIALS'), false, '不得恢复新玩家建造材料包');
assert.equal(coreSource.includes('grantStarterConstructionMaterials'), false, '不得恢复建造材料补发逻辑');
assert.ok(catalogSource.includes("from './production-methods.js'"));
assert.ok(methodSource.includes("id: 'rapid'"));
assert.ok(methodSource.includes("id: 'economical'"));
assert.ok(methodSource.includes("id: 'high-yield'"));
assert.ok(methodSource.includes("id: 'assisted'"));
assert.ok(methodSource.includes("id: 'intensive'"));
assert.ok(methodSource.includes("id: 'mechanized'"));
assert.ok(catalogSource.includes("id: 'fruit'"));
assert.ok(catalogSource.includes("id: 'appliance-factory'"));
assert.ok(catalogSource.includes("id: 'feed-factory'"));
assert.ok(catalogSource.includes("id: 'veterinary-medicine-factory'"));
assert.ok(catalogSource.includes("id: 'tractor-factory'"));

const iconSource = readFileSync('src/components/icons/ProductIcons.tsx', 'utf8');
assert.equal(existsSync('src/components/icons/ProductIcons.tsx'), true);
for (const id of expectedProducts) assert.match(iconSource, new RegExp(`case '${id}':`), `${id} 缺少显式 SVG 图标`);

for (const [path, texts] of [
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', [
    '当前基线为 36 种商品和 26 种工厂类型',
    'C1 基础制度采用工厂级参考分钟利润',
    '农场 0.6、果园 0.9、畜牧场 0.8、渔场 1.0',
    '不新增铜冶炼厂',
    '任一输入不足时不得扣除其他输入',
    '模型 1 的未完成市场需求订单',
    '正式目录为每座工厂声明现金 `buildCost` 与商品数组 `buildInputs`',
    '客户端兼容字段 `buildTimeMs` 固定返回 `0`',
    '资金和适用的全部材料必须先完整校验，再原子扣除',
    '农场和果园固定使用空 `buildInputs`',
    '新玩家不再获得首座工厂建造材料包',
    '标准生产、高速生产、节约生产和高产生产',
    '基础、工具／饲料、化肥／药剂、拖拉机／机械化',
    '每周期整件消耗',
    '不累计折旧',
    '生产方式与配方必须在同一次配置动作中原子切换',
  ]],
  ['docs/UI_DESIGN_SYSTEM.md', ['当前 36 种正式商品', '服务器未来返回未知商品 ID', '生产方式下拉选择', '不得恢复 `radiogroup`、选择卡、按钮组、可见原生 `select`']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['36 种商品和 26 种工厂', '饮料、预制餐、电子产品和家电', '作业制度']],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of texts) assert.ok(content.includes(text), `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：36 种商品、26 种工厂、农场与果园现金建造、C1 固定作业制度及参考分钟利润梯度。');

const fertilizerFacility = facilities.get('fertilizer-factory');
assert.ok(fertilizerFacility, '化肥厂必须存在于正式目录');
assert.equal(fertilizerFacility.name, '化肥厂');
assert.deepEqual(standardRecipes(fertilizerFacility)[0].inputs, [{ productId: 'crude-oil', quantity: 2 }]);
assert.deepEqual(standardRecipes(fertilizerFacility)[0].output, { productId: 'fertilizer', quantity: 6 });
assert.equal(standardRecipes(fertilizerFacility)[0].cycleMs, 60_000);
assert.equal(standardRecipes(fertilizerFacility)[0].operatingCost, 16.56);