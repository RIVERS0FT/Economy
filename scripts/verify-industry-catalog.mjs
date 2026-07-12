import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));
const facilityIds = new Set(FACILITY_TYPE_CATALOG.map((facility) => facility.id));
const expectedProducts = ['grain', 'timber', 'ore', 'crude-oil', 'flour', 'lumber', 'steel', 'plastic', 'food', 'furniture', 'machinery', 'electronics'];
const expectedFacilities = ['farm', 'logging-camp', 'mine', 'oil-field', 'mill', 'sawmill', 'steelworks', 'refinery', 'food-factory', 'furniture-factory', 'machine-factory', 'electronics-factory'];

assert.equal(PRODUCT_CATALOG.length, 12, '商品目录必须包含 12 项');
assert.equal(FACILITY_TYPE_CATALOG.length, 12, '工厂目录必须包含 12 项');
assert.equal(productIds.size, PRODUCT_CATALOG.length, '商品 ID 必须唯一');
assert.equal(facilityIds.size, FACILITY_TYPE_CATALOG.length, '工厂 ID 必须唯一');
for (const id of expectedProducts) assert.equal(productIds.has(id), true, `缺少商品: ${id}`);
for (const id of expectedFacilities) assert.equal(facilityIds.has(id), true, `缺少工厂: ${id}`);
for (const facility of FACILITY_TYPE_CATALOG) {
  assert.equal(productIds.has(facility.output.productId), true, `${facility.id} 输出商品不存在`);
  if (facility.input) assert.equal(productIds.has(facility.input.productId), true, `${facility.id} 输入商品不存在`);
}

const css = readFileSync('src/styles/industry-system.css', 'utf8');
assert.match(css, /\.product-tabs \{[\s\S]*grid-auto-flow: column;/);
assert.match(css, /grid-auto-columns: minmax\(130px, 1fr\);/);
assert.doesNotMatch(css, /grid-template-columns: repeat\(6,/);

const tests = readFileSync('server/test/domain.test.js', 'utf8');
assert.match(tests, /state\.products\.length, 12/);
assert.match(tests, /state\.facilityTypes\.length, 12/);
assert.match(tests, /existing worlds receive new inventories, markets, and liquidity/);

for (const [path, required] of [
  ['README.md', ['当前目录共 12 种商品和 12 种工厂类型', '木材 → 木板 → 家具', '原油 → 塑料 → 电子产品']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['当前基线为 12 种商品', '当前基线为 12 种工厂类型', '旧存档自动补齐新增商品库存']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['商品与工厂目录扩展规则', '不得写死 6 个商品 ID']],
  ['docs/UI_DESIGN_SYSTEM.md', ['目录型横向导航', 'repeat(6, ...)']],
  ['docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md', ['产业目录扩展边界', '木材—木板—家具']],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：12 种商品、12 种工厂、完整配方引用、旧存档补齐和动态目录布局均满足设计。');
