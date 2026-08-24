import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const baseResult = spawnSync(
  process.execPath,
  ['scripts/verify-market-page-layout-base.mjs'],
  { cwd: root, encoding: 'utf8' },
);
if (baseResult.error) throw baseResult.error;
if (baseResult.status !== 0) {
  if (baseResult.stdout) process.stdout.write(baseResult.stdout);
  if (baseResult.stderr) process.stderr.write(baseResult.stderr);
  process.exit(baseResult.status || 1);
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
  'src/pages/MarketPage.tsx',
  'src/components/market/MarketCommodityRow.tsx',
  'src/styles/market-commodity-row.css',
  'src/pages/BuildingsPage.tsx',
  'src/pages/ProvincePage.tsx',
  'src/utils/provinceScope.ts',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
]) requireFile(path);

for (const text of [
  '| 市场 | `market` | `GlobalMarketPage` |',
  '商品目录 → 商品全局详情 → 地区商品详情',
  '实际盘口、下单和自动交易继续由地区 `MarketPage` 执行',
  '`ProvincePage` 的市场分区继续直接嵌入当前地图州的同一个 `MarketPage`',
  '筛选默认折叠且不提供商品名称搜索框',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text, `页面职责设计缺少商品优先市场边界: ${text}`);

for (const text of [
  'export function GlobalMarketPage',
  '<PageLayout title="市场">',
  'data-global-scope="market"',
  '<WidgetHeading title="商品"',
  'global-market-filter-disclosure',
  'selectedGlobalProductId',
  'global-market-product-detail-panel',
  'global-market-product-region-list',
  '<MarketCommodityRow',
  'allProvinceOrders',
  'order.provinceId',
  '返回商品全局详情',
  '<EmbeddedMarketPage model={model} embedded />',
]) requireText('src/pages/GlobalMarketPage.tsx', text);
for (const text of [
  'global-market-provinces-panel',
  'global-market-province-row',
  'MarketCoverageBar',
  'game.facilityTypes.map',
  '<FacilityIcon facilityTypeId={entry.id}',
]) forbidText('src/pages/GlobalMarketPage.tsx', text, `全局市场不得恢复旧地区入口或工厂目录: ${text}`);

const marketPage = read('src/pages/MarketPage.tsx');
const catalogStart = marketPage.indexOf("if (!facilityAssetId && marketViewMode === 'catalog')");
const detailStart = marketPage.indexOf('\n  const detailContent =', catalogStart);
const catalogSource = marketPage.slice(catalogStart, detailStart);
if (catalogStart < 0 || detailStart < 0) failures.push('地区 MarketPage 必须保留商品目录与详情的明确分界。');
for (const text of [
  'game.facilityTypes.map',
  '<FacilityIcon',
  'market-workspace-switch',
  'market-overview-metrics',
  'market-catalog-panel',
  'TextInput',
  'catalogQuery',
  '挂单差额',
  '基准偏离',
  '挂单状态',
]) {
  if (catalogSource.includes(text)) failures.push(`地区 MarketPage 商品目录不得包含: ${text}`);
}
if (!catalogSource.includes('market-catalog-filter-disclosure')) failures.push('地区 MarketPage 筛选必须默认折叠。');
if (!catalogSource.includes('<MarketCommodityRow')) failures.push('地区 MarketPage 必须复用共享商品数据行。');

requireText('src/pages/BuildingsPage.tsx', '<EmbeddedFacilityAssetMarket', '工厂资产交易必须继续从建筑详情打开从属市场。');
requireText('src/pages/ProvincePage.tsx', '<EmbeddedMarketPage model={model} embedded />', '州级上下文必须继续复用地区 MarketPage。');
requireText('src/pages/ProvincePage.tsx', '<RegionalEntityPageTitle entityName={marketDetailProduct.name} regionName={provinceName} />', '州级商品详情必须使用共享两行地区实体标题。');
requireText('src/pages/MarketPage.tsx', 'fixedProductId={selectedProduct.id}', '地区商品详情必须承载当前商品固定自动交易设置。');
requireText('src/pages/MarketPage.tsx', "<small>{selectedProduct ? '24h 成交量' : availableAssetLabel}</small>", '地区商品详情必须显示真实 24h 成交量。');
requireText('src/utils/provinceScope.ts', 'allProvinceOrders,', '全局市场必须复用已加载的完整公开订单快照。');
requireText('src/utils/provinceScope.ts', 'const orders = allProvinceOrders.filter((order) => order.provinceId === provinceId);', '地区 MarketPage 仍必须只看到当前州订单。');

if (failures.length) {
  console.error('市场页布局与运行时验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('市场页布局与运行时验证通过：一级市场按商品钻取全局详情，再按地区进入既有地区交易；地区目录默认折叠、无搜索并复用四指标单行商品数据行。');
