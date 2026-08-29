import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const regionalResult = spawnSync(
  process.execPath,
  ['scripts/verify-market-page-layout-regional.mjs'],
  { cwd: root, encoding: 'utf8' },
);
if (regionalResult.error) throw regionalResult.error;
if (regionalResult.status !== 0) {
  if (regionalResult.stdout) process.stdout.write(regionalResult.stdout);
  if (regionalResult.stderr) process.stderr.write(regionalResult.stderr);
  process.exit(regionalResult.status || 1);
}

const failures = [];
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text, message = `${path} 缺少: ${text}`) => {
  if (!read(path).includes(text)) failures.push(message);
};
const forbidText = (path, text, message = `${path} 不应包含: ${text}`) => {
  if (read(path).includes(text)) failures.push(message);
};

for (const path of [
  'src/pages/GlobalMarketPage.tsx',
  'src/pages/ProvincePage.tsx',
  'src/utils/provinceScope.ts',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
]) requireFile(path);

for (const text of [
  '| 市场 | `market` | `GlobalMarketPage` |',
  '商品目录 → 商品全局详情 → 地区商品详情',
  '实际盘口、下单和自动经营只读执行状态继续由地区 `MarketPage` 执行，可编辑自动经营策略归地区 `BuildingsPage` 工厂详情',
  '`ProvincePage` 的市场分区继续直接嵌入当前地图州的同一个 `MarketPage`',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text, `页面职责设计缺少商品优先市场边界: ${text}`);

for (const text of [
  'export function GlobalMarketPage',
  '<PageLayout title="市场">',
  'data-global-scope="market"',
  'global-market-goods-header',
  '<MarketCommodityHeader',
  'entityLabel="地区"',
  'regionPrimary',
  'global-market-filter-disclosure',
  'selectedGlobalProductId',
  'global-market-product-detail',
  'global-market-product-region-list',
  '<MarketCommodityRow',
  'allProvinceOrders',
  'order.provinceId',
  '返回商品全局详情',
  '<EmbeddedMarketPage model={model} embedded />',
]) requireText('src/pages/GlobalMarketPage.tsx', text);
forbidText('src/pages/GlobalMarketPage.tsx', '筛选与排序', '全局市场不得把排序放回筛选面板。');
for (const text of [
  'global-market-provinces-panel',
  '<WidgetHeading title="商品"',
  'global-market-province-row',
  'MarketCoverageBar',
  'game.facilityTypes.map',
  '<FacilityIcon facilityTypeId={entry.id}',
]) forbidText('src/pages/GlobalMarketPage.tsx', text, `全局市场不得恢复旧地区入口或工厂目录: ${text}`);

requireText('src/pages/ProvincePage.tsx', '<EmbeddedMarketPage model={model} embedded readOnly={!isUnlocked} />', '州级上下文必须继续复用地区 MarketPage，并允许锁定州只读查看。');
requireText('src/pages/ProvincePage.tsx', '<RegionalEntityPageTitle entityName={marketDetailProduct.name} regionName={provinceName} />', '州级商品详情必须使用共享两行地区实体标题。');
requireText('src/utils/provinceScope.ts', 'allProvinceOrders,', '地区投影必须保留全部已加载的本人订单。');
requireText('src/utils/provinceScope.ts', 'const orders = allProvinceOrders.filter((order) => order.provinceId === provinceId);', '地区 MarketPage 仍必须只看到当前州订单。');

if (failures.length) {
  console.error('全局市场职责验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('市场页验证通过：地区核心检查只维护地区交易职责，正式入口再验证一级市场按商品进入全局详情并按地区下钻。');
