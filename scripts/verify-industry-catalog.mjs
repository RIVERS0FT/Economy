import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const expectedProducts = [
  'wheat', 'rice', 'cotton', 'sugarcane', 'fruit', 'timber', 'ore', 'copper-ore', 'crude-oil',
  'meat', 'eggs', 'milk', 'fish', 'wool', 'flour', 'sugar', 'lumber', 'steel', 'copper',
  'plastic', 'textile', 'pulp', 'food', 'beverage', 'prepared-meal', 'paper', 'furniture',
  'clothing', 'machinery', 'electronics', 'appliance',
];
const expectedFacilities = [
  'farm', 'orchard', 'logging-camp', 'mine', 'ranch', 'fishery', 'oil-field', 'mill', 'sawmill',
  'pulp-mill', 'steelworks', 'refinery', 'textile-mill', 'food-factory', 'beverage-factory',
  'paper-mill', 'furniture-factory', 'garment-factory', 'machine-factory',
  'electronics-factory', 'appliance-factory',
];
const expectedPrices = {
  wheat: 2, rice: 2, cotton: 2, sugarcane: 2, fruit: 4, timber: 5, ore: 6,
  'copper-ore': 6, 'crude-oil': 8, meat: 6, eggs: 3, milk: 3, fish: 6, wool: 6,
  flour: 13, sugar: 13, lumber: 15, steel: 24, copper: 24, plastic: 24, textile: 18,
  pulp: 16, food: 15, beverage: 16, 'prepared-meal': 18, paper: 13, furniture: 20,
  clothing: 48, machinery: 60, electronics: 64, appliance: 68,
};
const expectedConstruction = {
  farm: { complexity: 'C1', buildCost: 50, buildTimeMs: 30_000, systemValue: 65 },
  orchard: { complexity: 'C1', buildCost: 70, buildTimeMs: 40_000, systemValue: 95 },
  'logging-camp': { complexity: 'C2', buildCost: 120, buildTimeMs: 5 * 60_000, systemValue: 160 },
  mine: { complexity: 'C2', buildCost: 140, buildTimeMs: 6 * 60_000, systemValue: 185 },
  ranch: { complexity: 'C1', buildCost: 90, buildTimeMs: 50_000, systemValue: 120 },
  fishery: { complexity: 'C1', buildCost: 100, buildTimeMs: 60_000, systemValue: 130 },
  'oil-field': { complexity: 'C2', buildCost: 180, buildTimeMs: 10 * 60_000, systemValue: 235 },
  mill: { complexity: 'C2', buildCost: 150, buildTimeMs: 7 * 60_000, systemValue: 195 },
  sawmill: { complexity: 'C2', buildCost: 170, buildTimeMs: 8 * 60_000, systemValue: 225 },
  'pulp-mill': { complexity: 'C3', buildCost: 190, buildTimeMs: 30 * 60_000, systemValue: 250 },
  steelworks: { complexity: 'C3', buildCost: 240, buildTimeMs: 40 * 60_000, systemValue: 315 },
  refinery: { complexity: 'C4', buildCost: 300, buildTimeMs: 80 * 60_000, systemValue: 390 },
  'textile-mill': { complexity: 'C3', buildCost: 220, buildTimeMs: 35 * 60_000, systemValue: 290 },
  'food-factory': { complexity: 'C3', buildCost: 230, buildTimeMs: 45 * 60_000, systemValue: 300 },
  'beverage-factory': { complexity: 'C4', buildCost: 280, buildTimeMs: 60 * 60_000, systemValue: 365 },
  'paper-mill': { complexity: 'C3', buildCost: 250, buildTimeMs: 60 * 60_000, systemValue: 325 },
  'furniture-factory': { complexity: 'C4', buildCost: 300, buildTimeMs: 70 * 60_000, systemValue: 390 },
  'garment-factory': { complexity: 'C4', buildCost: 350, buildTimeMs: 90 * 60_000, systemValue: 455 },
  'machine-factory': { complexity: 'C5', buildCost: 480, buildTimeMs: 100 * 60_000, systemValue: 625 },
  'electronics-factory': { complexity: 'C6', buildCost: 700, buildTimeMs: 110 * 60_000, systemValue: 910 },
  'appliance-factory': { complexity: 'C7', buildCost: 950, buildTimeMs: 120 * 60_000, systemValue: 1235 },
};
const constructionTimeRanges = {
  C1: [30_000, 60_000],
  C2: [5 * 60_000, 10 * 60_000],
  C3: [30 * 60_000, 60 * 60_000],
  C4: [60 * 60_000, 120 * 60_000],
  C5: [60 * 60_000, 120 * 60_000],
  C6: [60 * 60_000, 120 * 60_000],
  C7: [60 * 60_000, 120 * 60_000],
};

assert.equal(PRODUCT_CATALOG.length, 31, '商品目录必须为 31 项');
assert.equal(FACILITY_TYPE_CATALOG.length, 21, '工厂目录必须为 21 项');
assert.deepEqual(PRODUCT_CATALOG.map((item) => item.id), expectedProducts);
assert.deepEqual(FACILITY_TYPE_CATALOG.map((item) => item.id), expectedFacilities);
assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((item) => [item.id, item.basePrice])), expectedPrices);
assert.deepEqual(Object.fromEntries(FACILITY_TYPE_CATALOG.map((item) => [item.id, {
  complexity: item.complexity,
  buildCost: item.buildCost,
  buildTimeMs: item.buildTimeMs,
  systemValue: item.systemValue,
}])), expectedConstruction);

const productIds = new Set(expectedProducts);
for (const product of PRODUCT_CATALOG) {
  assert.equal(Number.isInteger(product.basePrice), true, `${product.id} 初始参考价必须为整数`);
  assert.ok(product.marketDemandGroupId === undefined || ['food', 'household'].includes(product.marketDemandGroupId), `${product.id} 市场需求组无效`);
}
for (const facility of FACILITY_TYPE_CATALOG) {
  assert.equal(Number.isInteger(facility.buildCost), true, `${facility.id} 建造费必须为整数`);
  assert.equal(Number.isInteger(facility.buildTimeMs / 1_000), true, `${facility.id} 施工时间必须为整秒`);
  assert.ok(constructionTimeRanges[facility.complexity], `${facility.id} 建设复杂度无效`);
  const [minimumBuildTime, maximumBuildTime] = constructionTimeRanges[facility.complexity];
  assert.ok(
    facility.buildTimeMs >= minimumBuildTime && facility.buildTimeMs <= maximumBuildTime,
    `${facility.id} 施工时间超出 ${facility.complexity} 区间`,
  );
  assert.equal(
    facility.systemValue,
    Math.ceil((facility.buildCost * 1.3) / 5) * 5,
    `${facility.id} 系统参考值必须按建造费 130% 向上取整到 5`,
  );
  assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId));
  const defaultRecipe = facility.recipes.find((recipe) => recipe.id === facility.defaultRecipeId);
  assert.equal(facility.cycleMs, defaultRecipe.cycleMs);
  assert.equal(facility.operatingCost, defaultRecipe.operatingCost);
  for (const recipe of facility.recipes) {
    assert.ok(Array.isArray(recipe.inputs), `${facility.id}/${recipe.id} 必须使用 inputs[]`);
    assert.equal(Number.isInteger(recipe.cycleMs / 1_000), true);
    assert.equal(Number.isInteger(recipe.operatingCost), true);
    for (const input of recipe.inputs) {
      assert.ok(productIds.has(input.productId));
      assert.equal(Number.isInteger(input.quantity), true);
    }
    assert.ok(productIds.has(recipe.output.productId));
    assert.equal(Number.isInteger(recipe.output.quantity), true);
    const inputValue = recipe.inputs.reduce((sum, input) => sum + expectedPrices[input.productId] * input.quantity, 0);
    const profit = (expectedPrices[recipe.output.productId] * recipe.output.quantity - inputValue - recipe.operatingCost)
      * 60_000 / recipe.cycleMs;
    const expectedProfit = facility.category === 'raw' ? 1 : facility.category === 'processing' ? 3 : 6;
    assert.equal(profit, expectedProfit, `${facility.id}/${recipe.id} 参考分钟利润错误`);
  }
}

const facilities = new Map(FACILITY_TYPE_CATALOG.map((item) => [item.id, item]));
assert.deepEqual(facilities.get('farm').recipes.map((item) => item.id), ['wheat-crop', 'rice-crop', 'cotton-crop', 'sugarcane-crop']);
assert.equal(facilities.get('orchard').recipes[0].output.productId, 'fruit');
assert.equal(facilities.get('fishery').recipes[0].output.productId, 'fish');
assert.equal(facilities.get('mill').name, '磨坊');
assert.deepEqual(facilities.get('mill').recipes.map((item) => item.id), ['mill-default', 'sugar-milling']);
assert.equal(facilities.get('steelworks').name, '冶炼厂');
assert.equal(facilities.has('copper-smelter'), false, '不得新增铜冶炼厂');
assert.deepEqual(facilities.get('food-factory').recipes.map((item) => item.id), ['food-factory-default', 'prepared-meal-production']);
assert.deepEqual(facilities.get('beverage-factory').recipes.map((item) => item.id), ['milk-beverage', 'fruit-beverage']);
assert.deepEqual(facilities.get('beverage-factory').recipes.map((item) => item.operatingCost), [10, 5]);
assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
  { productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 },
]);
assert.deepEqual(facilities.get('appliance-factory').recipes[0].inputs, [
  { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 },
]);

const coreSource = readFileSync('server/src/domain-core.js', 'utf8');
const catalogSource = readFileSync('server/src/industry-catalog.js', 'utf8');
assert.ok(coreSource.includes("from './industry-catalog.js'"), '核心领域必须读取单一产业目录');
assert.equal(coreSource.includes('export const PRODUCT_CATALOG = Object.freeze(['), false, 'domain-core.js 不得复制正式商品目录');
assert.ok(catalogSource.includes("id: 'fruit'"));
assert.ok(catalogSource.includes("id: 'appliance-factory'"));

const iconSource = readFileSync('src/components/icons/ProductIcons.tsx', 'utf8');
assert.equal(existsSync('src/components/icons/ProductIcons.tsx'), true);
for (const id of expectedProducts) assert.match(iconSource, new RegExp(`case '${id}':`), `${id} 缺少显式 SVG 图标`);

for (const [path, texts] of [
  ['README.md', ['当前目录共 31 种商品和 21 种工厂类型', '`steelworks` ID 永久保留', '机械+电子产品', 'inputs[]']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', [
    '当前基线为 31 种商品和 21 种工厂类型',
    '基础原料 1／分钟、中间产品 3／分钟、最终产品 6／分钟',
    '不新增铜冶炼厂',
    '任一输入不足时不得扣除其他输入',
    '模型 1 的未完成市场需求订单',
    'C1 为 30 秒～1 分钟',
    'C2 为 5～10 分钟',
    'C3 为 30 分钟～1 小时',
    'C4～C7 为 1～2 小时',
  ]],
  ['docs/UI_DESIGN_SYSTEM.md', ['当前 31 种正式商品', '服务器未来返回未知商品 ID']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['31 种商品和 21 种工厂', '饮料、预制餐、电子产品和家电']],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of texts) assert.ok(content.includes(text), `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：31 种商品、21 种工厂、C1～C7 建设复杂度、精确建造费与施工时间、配方级参数及 1/3/6 参考分钟利润梯度。');
