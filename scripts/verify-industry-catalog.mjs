import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));
const facilityIds = new Set(FACILITY_TYPE_CATALOG.map((facility) => facility.id));
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const expectedProducts = ['wheat', 'rice', 'timber', 'ore', 'crude-oil', 'flour', 'lumber', 'steel', 'plastic', 'food', 'furniture', 'machinery', 'electronics'];
const expectedFacilities = ['farm', 'logging-camp', 'mine', 'oil-field', 'mill', 'sawmill', 'steelworks', 'refinery', 'food-factory', 'furniture-factory', 'machine-factory', 'electronics-factory'];
const expectedPrices = {
  wheat: 2,
  rice: 2,
  timber: 5,
  ore: 6,
  'crude-oil': 8,
  flour: 13,
  lumber: 15,
  steel: 24,
  plastic: 24,
  food: 15,
  furniture: 20,
  machinery: 60,
  electronics: 64,
};
const expectedFacilityBalance = {
  farm: { cycleMs: 120_000, operatingCost: 6, profitPerMinute: 1 },
  'logging-camp': { cycleMs: 60_000, operatingCost: 9, profitPerMinute: 1 },
  mine: { cycleMs: 60_000, operatingCost: 11, profitPerMinute: 1 },
  'oil-field': { cycleMs: 60_000, operatingCost: 15, profitPerMinute: 1 },
  mill: { cycleMs: 40_000, operatingCost: 7, profitPerMinute: 3 },
  sawmill: { cycleMs: 40_000, operatingCost: 3, profitPerMinute: 3 },
  steelworks: { cycleMs: 40_000, operatingCost: 4, profitPerMinute: 3 },
  refinery: { cycleMs: 40_000, operatingCost: 6, profitPerMinute: 3 },
  'food-factory': { cycleMs: 50_000, operatingCost: 14, profitPerMinute: 6 },
  'furniture-factory': { cycleMs: 60_000, operatingCost: 4, profitPerMinute: 6 },
  'machine-factory': { cycleMs: 60_000, operatingCost: 6, profitPerMinute: 6 },
  'electronics-factory': { cycleMs: 60_000, operatingCost: 10, profitPerMinute: 6 },
};

assert.equal(PRODUCT_CATALOG.length, 13, '商品目录必须保持 13 项');
assert.equal(FACILITY_TYPE_CATALOG.length, 12, '工厂目录必须保持 12 项');
assert.equal(productIds.size, PRODUCT_CATALOG.length, '商品 ID 必须唯一');
assert.equal(facilityIds.size, FACILITY_TYPE_CATALOG.length, '工厂 ID 必须唯一');
for (const id of expectedProducts) assert.equal(productIds.has(id), true, `缺少商品: ${id}`);
for (const id of expectedFacilities) assert.equal(facilityIds.has(id), true, `缺少工厂: ${id}`);
assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice])), expectedPrices);

for (const product of PRODUCT_CATALOG) {
  assert.equal(Number.isInteger(product.basePrice), true, `${product.id} 初始参考价必须为整数`);
  assert.ok(product.basePrice > 0, `${product.id} 初始参考价必须为正数`);
}

for (const facility of FACILITY_TYPE_CATALOG) {
  const expected = expectedFacilityBalance[facility.id];
  assert.ok(expected, `${facility.id} 缺少平衡目标`);
  assert.equal(facility.cycleMs, expected.cycleMs, `${facility.id} 周期错误`);
  assert.equal(facility.operatingCost, expected.operatingCost, `${facility.id} 周期成本错误`);
  assert.equal(Number.isInteger(facility.cycleMs / 1_000), true, `${facility.id} 周期秒数必须为整数`);
  assert.equal(Number.isInteger(facility.operatingCost), true, `${facility.id} 周期成本必须为整数`);
  assert.equal(productIds.has(facility.output.productId), true, `${facility.id} 输出商品不存在`);
  if (facility.input) assert.equal(productIds.has(facility.input.productId), true, `${facility.id} 输入商品不存在`);
  assert.ok(Array.isArray(facility.recipes) && facility.recipes.length >= 1, `${facility.id} 必须显式提供至少一个配方`);
  assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId), `${facility.id} 默认配方无效`);
  assert.equal(new Set(facility.recipes.map((recipe) => recipe.id)).size, facility.recipes.length, `${facility.id} 配方 ID 必须唯一`);

  for (const recipe of facility.recipes) {
    assert.equal(recipe.cycleMs, expected.cycleMs, `${facility.id}/${recipe.id} 周期未同步`);
    assert.equal(recipe.operatingCost, expected.operatingCost, `${facility.id}/${recipe.id} 成本未同步`);
    assert.equal(productIds.has(recipe.output.productId), true, `${facility.id}/${recipe.id} 输出商品不存在`);
    if (recipe.input) assert.equal(productIds.has(recipe.input.productId), true, `${facility.id}/${recipe.id} 输入商品不存在`);
    assert.equal(Number.isInteger(recipe.output.quantity), true, `${facility.id}/${recipe.id} 产量必须为整数`);
    if (recipe.input) assert.equal(Number.isInteger(recipe.input.quantity), true, `${facility.id}/${recipe.id} 输入量必须为整数`);

    const outputValue = products.get(recipe.output.productId).basePrice * recipe.output.quantity;
    const inputValue = recipe.input ? products.get(recipe.input.productId).basePrice * recipe.input.quantity : 0;
    const profitPerMinute = (outputValue - inputValue - recipe.operatingCost) * 60_000 / recipe.cycleMs;
    assert.equal(profitPerMinute, expected.profitPerMinute, `${facility.id}/${recipe.id} 参考分钟利润错误`);
    assert.equal(Number.isInteger(profitPerMinute), true, `${facility.id}/${recipe.id} 参考分钟利润必须为整数`);
  }
}

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const farm = facilities.get('farm');
assert.deepEqual(farm.recipes.map((recipe) => recipe.id), ['wheat-crop', 'rice-crop']);
for (const recipe of farm.recipes) {
  assert.equal(recipe.cycleMs, 120_000);
  assert.equal(recipe.operatingCost, 6);
  assert.equal(recipe.output.quantity, 4);
}

const mine = facilities.get('mine');
assert.equal(mine.name, '矿场', '不得修改矿场名称');
assert.equal(mine.recipes.length, 1, '不得增加矿场配方');
assert.equal(mine.defaultRecipeId, 'mine-default');
assert.deepEqual(mine.output, { productId: 'ore', quantity: 2 });

const steelworks = facilities.get('steelworks');
assert.equal(steelworks.name, '钢铁厂', '不得修改钢铁厂名称');
assert.equal(steelworks.recipes.length, 1, '不得增加钢铁厂配方');
assert.equal(steelworks.defaultRecipeId, 'steelworks-default');
assert.deepEqual(steelworks.input, { productId: 'ore', quantity: 3 });
assert.deepEqual(steelworks.output, { productId: 'steel', quantity: 1 });

const css = readFileSync('src/styles/industry-system.css', 'utf8');
assert.match(css, /\.product-tabs \{[\s\S]*grid-auto-flow: column;/);
assert.match(css, /grid-auto-columns: minmax\(130px, 1fr\);/);
assert.doesNotMatch(css, /grid-template-columns: repeat\(6,/);

const productIconPath = 'src/components/icons/ProductIcons.tsx';
assert.equal(existsSync(productIconPath), true, '缺少统一商品 SVG 图标库');
const productIcons = readFileSync(productIconPath, 'utf8');
for (const id of expectedProducts) assert.match(productIcons, new RegExp(`case '${id}':`), `商品 ${id} 缺少显式 SVG 图标`);
assert.match(productIcons, /export function ProductIconLabel/);
assert.match(productIcons, /default:/);

const warehouseCard = readFileSync('src/components/warehouse/WarehouseUpgradeCard.tsx', 'utf8');
assert.match(warehouseCard, /ProductIconLabel/);
assert.match(warehouseCard, /inventory\.available > 0 \|\| inventory\.frozen > 0/);

const tests = readFileSync('server/test/domain.test.js', 'utf8');
assert.match(tests, /state\.products\.length, 13/);
assert.match(tests, /state\.facilityTypes\.length, 12/);
assert.match(tests, /expectedFacilityBalance/);
assert.match(tests, /recipe\.cycleMs, 120_000/);
assert.match(tests, /recipe\.output\.quantity, 4/);
assert.match(tests, /初始参考价必须为整数/);

for (const [path, required] of [
  ['README.md', ['当前目录共 13 种商品和 12 种工厂类型', '基础原料 1／分钟、中间产品 3／分钟、最终产品 6／分钟', '周期 120 秒', '单座周期成本 6']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['当前基线为 13 种商品和 12 种工厂类型', '参考分钟利润', '基础原料 1／分钟', '中间产品 3／分钟', '最终产品 6／分钟', '价格、数量、周期秒数和成本必须保持整数']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['经济目录中的价格、数量、周期秒数和成本保持整数', '当前初始参考价为小麦 2、水稻 2、食品 15']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['商品与工厂目录扩展规则', '不得写死 6 个商品 ID']],
  ['docs/UI_DESIGN_SYSTEM.md', ['当前 13 种正式商品', '服务器未来返回未知商品 ID']],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：13 种商品、12 种工厂、整数经济数值和 1/3/6 参考分钟利润梯度。');
