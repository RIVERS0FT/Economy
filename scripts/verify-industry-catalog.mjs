import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const expectedProducts = [
  'wheat', 'rice', 'cotton', 'timber', 'ore', 'copper-ore', 'crude-oil',
  'meat', 'eggs', 'milk', 'wool', 'flour', 'lumber', 'steel', 'copper',
  'plastic', 'textile', 'food', 'furniture', 'clothing', 'machinery', 'electronics',
];
const expectedFacilities = [
  'farm', 'logging-camp', 'mine', 'ranch', 'oil-field', 'mill', 'sawmill',
  'steelworks', 'refinery', 'textile-mill', 'food-factory', 'furniture-factory',
  'garment-factory', 'machine-factory', 'electronics-factory',
];
const expectedPrices = {
  wheat: 2, rice: 2, cotton: 2, timber: 5, ore: 6, 'copper-ore': 6,
  'crude-oil': 8, meat: 6, eggs: 3, milk: 3, wool: 6, flour: 13,
  lumber: 15, steel: 24, copper: 24, plastic: 24, textile: 18, food: 15,
  furniture: 20, clothing: 48, machinery: 60, electronics: 64,
};
const expectedFacilityBalance = {
  farm: [120_000, 6, 1], 'logging-camp': [60_000, 9, 1], mine: [60_000, 11, 1],
  ranch: [120_000, 16, 1], 'oil-field': [60_000, 15, 1], mill: [40_000, 7, 3],
  sawmill: [40_000, 3, 3], steelworks: [40_000, 4, 3], refinery: [40_000, 6, 3],
  'textile-mill': [40_000, 4, 3], 'food-factory': [50_000, 14, 6],
  'furniture-factory': [60_000, 4, 6], 'garment-factory': [60_000, 6, 6],
  'machine-factory': [60_000, 6, 6], 'electronics-factory': [60_000, 10, 6],
};

assert.equal(PRODUCT_CATALOG.length, 22, '商品目录必须为 22 项');
assert.equal(FACILITY_TYPE_CATALOG.length, 15, '工厂目录必须为 15 项');
assert.deepEqual(PRODUCT_CATALOG.map((item) => item.id), expectedProducts);
assert.deepEqual(FACILITY_TYPE_CATALOG.map((item) => item.id), expectedFacilities);
assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((item) => [item.id, item.basePrice])), expectedPrices);

const productIds = new Set(expectedProducts);
for (const product of PRODUCT_CATALOG) {
  assert.equal(Number.isInteger(product.basePrice), true, `${product.id} 初始参考价必须为整数`);
  assert.ok(['none', 'single', 'grouped'].includes(product.systemDemandMode), `${product.id} 缺少系统需求模式`);
}
for (const facility of FACILITY_TYPE_CATALOG) {
  const [cycleMs, operatingCost, expectedProfit] = expectedFacilityBalance[facility.id];
  assert.equal(facility.cycleMs, cycleMs);
  assert.equal(facility.operatingCost, operatingCost);
  assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId));
  for (const recipe of facility.recipes) {
    assert.ok(Array.isArray(recipe.inputs), `${facility.id}/${recipe.id} 必须使用 inputs[]`);
    for (const input of recipe.inputs) {
      assert.ok(productIds.has(input.productId));
      assert.equal(Number.isInteger(input.quantity), true);
    }
    assert.ok(productIds.has(recipe.output.productId));
    assert.equal(Number.isInteger(recipe.output.quantity), true);
    const inputValue = recipe.inputs.reduce((sum, input) => sum + expectedPrices[input.productId] * input.quantity, 0);
    const profit = (expectedPrices[recipe.output.productId] * recipe.output.quantity - inputValue - recipe.operatingCost) * 60_000 / recipe.cycleMs;
    assert.equal(profit, expectedProfit, `${facility.id}/${recipe.id} 参考分钟利润错误`);
  }
}

const facilities = new Map(FACILITY_TYPE_CATALOG.map((item) => [item.id, item]));
assert.deepEqual(facilities.get('farm').recipes.map((item) => item.id), ['wheat-crop', 'rice-crop', 'cotton-crop']);
assert.deepEqual(facilities.get('mine').recipes.map((item) => item.id), ['mine-default', 'copper-ore-mining']);
assert.deepEqual(facilities.get('ranch').recipes.map((item) => item.id), ['ranch-meat', 'ranch-eggs', 'ranch-milk', 'ranch-wool']);
assert.equal(facilities.get('steelworks').name, '冶炼厂');
assert.deepEqual(facilities.get('steelworks').recipes.map((item) => item.id), ['steelworks-default', 'copper-smelting']);
assert.equal(facilities.has('copper-smelter'), false, '不得新增铜冶炼厂');
assert.deepEqual(facilities.get('textile-mill').recipes.map((item) => item.id), ['cotton-textile', 'wool-textile']);
assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
  { productId: 'plastic', quantity: 1 },
  { productId: 'copper', quantity: 1 },
]);

const iconSource = readFileSync('src/components/icons/ProductIcons.tsx', 'utf8');
assert.equal(existsSync('src/components/icons/ProductIcons.tsx'), true);
for (const id of expectedProducts) assert.match(iconSource, new RegExp(`case '${id}':`), `${id} 缺少显式 SVG 图标`);

for (const [path, texts] of [
  ['README.md', ['当前目录共 22 种商品和 15 种工厂类型', '`steelworks` ID 永久保留', '同时消耗塑料和铜材', 'inputs[]']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['当前基线为 22 种商品和 15 种工厂类型', '基础原料 1／分钟、中间产品 3／分钟、最终产品 6／分钟', '不新增铜冶炼厂', '任一输入不足时不得扣除其他输入']],
  ['docs/UI_DESIGN_SYSTEM.md', ['当前 22 种正式商品', '服务器未来返回未知商品 ID']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['22 种商品和 15 种工厂', '1 塑料 + 1 铜材 → 1 电子产品']],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of texts) assert.ok(content.includes(text), `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：22 种商品、15 种工厂、多输入配方与 1/3/6 参考分钟利润梯度。');
