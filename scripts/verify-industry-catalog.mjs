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

assert.equal(PRODUCT_CATALOG.length, 31, '商品目录必须为 31 项');
assert.equal(FACILITY_TYPE_CATALOG.length, 21, '工厂目录必须为 21 项');
assert.deepEqual(PRODUCT_CATALOG.map((item) => item.id), expectedProducts);
assert.deepEqual(FACILITY_TYPE_CATALOG.map((item) => item.id), expectedFacilities);
assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((item) => [item.id, item.basePrice])), expectedPrices);

const productIds = new Set(expectedProducts);
for (const product of PRODUCT_CATALOG) {
  assert.equal(Number.isInteger(product.basePrice), true, `${product.id} 初始参考价必须为整数`);
  assert.ok(product.marketDemandGroupId === undefined || ['food', 'household'].includes(product.marketDemandGroupId), `${product.id} 市场需求组无效`);
}
for (const facility of FACILITY_TYPE_CATALOG) {
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
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['当前基线为 31 种商品和 21 种工厂类型', '基础原料 1／分钟、中间产品 3／分钟、最终产品 6／分钟', '不新增铜冶炼厂', '任一输入不足时不得扣除其他输入', '模型 1 的未完成市场需求订单']],
  ['docs/UI_DESIGN_SYSTEM.md', ['当前 31 种正式商品', '服务器未来返回未知商品 ID']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['31 种商品和 21 种工厂', '饮料、预制餐、电子产品和家电']],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of texts) assert.ok(content.includes(text), `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：31 种商品、21 种工厂、水果产业链、配方级参数与 1/3/6 参考分钟利润梯度。');
