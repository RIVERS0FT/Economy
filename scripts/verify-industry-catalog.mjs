import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

const productIconPath = 'src/components/icons/ProductIcons.tsx';
assert.equal(existsSync(productIconPath), true, '缺少统一商品 SVG 图标库');
const productIcons = readFileSync(productIconPath, 'utf8');
assert.match(productIcons, /export const PRODUCT_ICON_IDS/);
assert.match(productIcons, /viewBox="0 0 24 24"/);
assert.match(productIcons, /stroke="currentColor"/);
assert.match(productIcons, /strokeWidth=\{1\.8\}/);
assert.match(productIcons, /aria-hidden="true"/);
assert.match(productIcons, /focusable="false"/);
assert.match(productIcons, /className=\{className \? `game-icon product-icon/);
assert.match(productIcons, /export function ProductIconLabel/);
assert.match(productIcons, /default:/);
assert.match(productIcons, /<path d="m4 8 8-4 8 4-8 4Z" \/>/);
for (const id of expectedProducts) {
  assert.match(productIcons, new RegExp(`case '${id}':`), `商品 ${id} 缺少显式 SVG 图标`);
}

const iconCss = readFileSync('src/styles/icon-system.css', 'utf8');
assert.match(iconCss, /\.product-icon \{[\s\S]*width: 1\.25rem;[\s\S]*height: 1\.25rem;/);
assert.match(iconCss, /\.product-icon-label \{[\s\S]*display: inline-flex;[\s\S]*align-items: center;/);

const marketPage = readFileSync('src/pages/MarketPage.tsx', 'utf8');
assert.match(marketPage, /ProductIcon, ProductIconLabel/);
assert.match(marketPage, /<ProductIcon productId=\{product\.id\} \/>/);
assert.match(marketPage, /selectedAssetTitle/);
assert.doesNotMatch(marketPage, />▣</, '商品市场标签不得恢复字符占位图标');

const pageRouter = readFileSync('src/pages/PageRouter.tsx', 'utf8');
assert.match(pageRouter, /const \[overviewProductId, setOverviewProductId\] = useState/);
assert.match(pageRouter, /model\.game\.products\.some\(\(product\) => product\.id === overviewProductId\)/);
assert.match(pageRouter, /overviewProductId=\{overviewProductId\}/);
assert.match(pageRouter, /onOverviewProductChange=\{setOverviewProductId\}/);

const overviewPage = readFileSync('src/pages/OverviewPage.tsx', 'utf8');
assert.match(overviewPage, /ProductIconLabel/);
assert.match(overviewPage, /productId=\{overviewMarket\.product\.id\}/);
assert.match(overviewPage, /game\.products\.map\(\(product\) => <option key=\{product\.id\} value=\{product\.id\}>\{product\.name\}<\/option>\)/);
assert.match(overviewPage, /overviewProductId: string;/);
assert.match(overviewPage, /onOverviewProductChange: \(productId: string\) => void;/);
assert.match(overviewPage, /value=\{overviewMarket\?\.product\.id \?\? ''\}/);
assert.match(overviewPage, /onOverviewProductChange\(event\.target\.value\)/);
assert.doesNotMatch(overviewPage, /const \[overviewProductId, setOverviewProductId\] = useState/);
assert.doesNotMatch(overviewPage, /selectedProductId/);
assert.doesNotMatch(overviewPage, /overview-product-strip/);

const warehouseCard = readFileSync('src/components/warehouse/WarehouseUpgradeCard.tsx', 'utf8');
assert.match(warehouseCard, /ProductIconLabel/);
assert.match(warehouseCard, /className="warehouse-product-card-title"/);
assert.match(warehouseCard, /productId=\{product\.id\}/);
assert.match(warehouseCard, /inventory\.available > 0 \|\| inventory\.frozen > 0/);

const assetsPage = readFileSync('src/pages/AssetsPage.tsx', 'utf8');
assert.match(assetsPage, /ProductIconLabel/);
assert.match(assetsPage, /productId=\{change\.productId\}/);
assert.match(assetsPage, /productId=\{change\.outputProductId \?\? 'unknown'\}/);
assert.doesNotMatch(assetsPage, /className="product-asset-card-title"/);
assert.doesNotMatch(assetsPage, /商品库存与估值/);

const unifiedMarketCss = readFileSync('src/styles/unified-market-admin.css', 'utf8');
assert.match(unifiedMarketCss, /\.asset-kind-icon > \.product-icon \{ width: 100%; height: 100%; \}/);
assert.match(unifiedMarketCss, /\.unified-asset-tab\.active \.asset-kind-icon/);

const tests = readFileSync('server/test/domain.test.js', 'utf8');
assert.match(tests, /state\.products\.length, 12/);
assert.match(tests, /state\.facilityTypes\.length, 12/);
assert.match(tests, /existing worlds receive new inventories, markets, and liquidity/);

for (const [path, required] of [
  ['README.md', ['当前目录共 12 种商品和 12 种工厂类型', '木材 → 木板 → 家具', '原油 → 塑料 → 电子产品']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['当前基线为 12 种商品', '当前基线为 12 种工厂类型', '旧存档自动补齐新增商品库存', '木材 → 木板 → 家具']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['商品与工厂目录扩展规则', '不得写死 6 个商品 ID', '仓库虽然只显示有库存商品']],
  ['docs/UI_DESIGN_SYSTEM.md', [
    '目录型横向导航',
    'repeat(6, ...)',
    '商品 SVG 图标目录',
    '当前 12 种正式商品必须在 `ProductIcons.tsx` 中各有一个独立、可辨识的本地内联 SVG',
    '服务器未来返回未知商品 ID 时必须使用统一包装箱 SVG 回退',
    '市场商品标签、概览商品行情、仓库商品卡、商品订单和商品资产变动必须使用相同的 `ProductIcon`／`ProductIconLabel`',
  ]],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：12 种商品、12 种工厂、全商品 SVG、概览路由会话选择、仅有库存仓库卡、未知商品回退和动态目录布局均满足设计。');
