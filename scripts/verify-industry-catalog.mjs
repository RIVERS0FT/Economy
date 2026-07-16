import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));
const facilityIds = new Set(FACILITY_TYPE_CATALOG.map((facility) => facility.id));
const expectedProducts = ['wheat', 'rice', 'timber', 'ore', 'crude-oil', 'flour', 'lumber', 'steel', 'plastic', 'food', 'furniture', 'machinery', 'electronics'];
const expectedFacilities = ['farm', 'logging-camp', 'mine', 'oil-field', 'mill', 'sawmill', 'steelworks', 'refinery', 'food-factory', 'furniture-factory', 'machine-factory', 'electronics-factory'];

assert.equal(PRODUCT_CATALOG.length, 13, '商品目录必须保持 13 项');
assert.equal(FACILITY_TYPE_CATALOG.length, 12, '工厂目录必须保持 12 项');
assert.equal(productIds.size, PRODUCT_CATALOG.length, '商品 ID 必须唯一');
assert.equal(facilityIds.size, FACILITY_TYPE_CATALOG.length, '工厂 ID 必须唯一');
for (const id of expectedProducts) assert.equal(productIds.has(id), true, `缺少商品: ${id}`);
for (const id of expectedFacilities) assert.equal(facilityIds.has(id), true, `缺少工厂: ${id}`);

for (const facility of FACILITY_TYPE_CATALOG) {
  assert.equal(productIds.has(facility.output.productId), true, `${facility.id} 输出商品不存在`);
  if (facility.input) assert.equal(productIds.has(facility.input.productId), true, `${facility.id} 输入商品不存在`);
  assert.ok(Array.isArray(facility.recipes) && facility.recipes.length >= 1, `${facility.id} 必须显式提供至少一个配方`);
  assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId), `${facility.id} 默认配方无效`);
  assert.equal(new Set(facility.recipes.map((recipe) => recipe.id)).size, facility.recipes.length, `${facility.id} 配方 ID 必须唯一`);
  for (const recipe of facility.recipes) {
    assert.equal(productIds.has(recipe.output.productId), true, `${facility.id}/${recipe.id} 输出商品不存在`);
    if (recipe.input) assert.equal(productIds.has(recipe.input.productId), true, `${facility.id}/${recipe.id} 输入商品不存在`);
  }
}

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const farm = facilities.get('farm');
assert.deepEqual(farm.recipes.map((recipe) => recipe.id), ['wheat-crop', 'rice-crop']);
for (const recipe of farm.recipes) {
  assert.equal(recipe.cycleMs, 45_000);
  assert.equal(recipe.operatingCost, 2);
  assert.equal(recipe.output.quantity, 4);
}

const mine = facilities.get('mine');
assert.equal(mine.name, '矿场', '本轮不得修改矿场名称');
assert.equal(mine.recipes.length, 1, '本轮不得增加矿场配方');
assert.equal(mine.defaultRecipeId, 'mine-default');
assert.deepEqual(mine.output, { productId: 'ore', quantity: 2 });

const steelworks = facilities.get('steelworks');
assert.equal(steelworks.name, '钢铁厂', '本轮不得修改钢铁厂名称');
assert.equal(steelworks.recipes.length, 1, '本轮不得增加钢铁厂配方');
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
assert.match(tests, /recipe\.cycleMs, 45_000/);
assert.match(tests, /recipe\.output\.quantity, 4/);

for (const [path, required] of [
  ['README.md', ['当前目录共 13 种商品和 12 种工厂类型', '矿场和钢铁厂本轮保持原目录']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['当前基线为 13 种商品', '当前基线为 12 种工厂类型', '4 小麦或 4 水稻', '矿场和钢铁厂本轮保持不变']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['商品与工厂目录扩展规则', '不得写死 6 个商品 ID']],
  ['docs/UI_DESIGN_SYSTEM.md', ['当前 13 种正式商品', '服务器未来返回未知商品 ID']],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：13 种商品、12 种工厂、农场 45 秒/4/2，矿场和钢铁厂保持现状。');
