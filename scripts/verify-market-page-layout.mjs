import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const obsoleteBaseFailures = new Set([
  '页面职责设计必须记录商品-only 市场目录。',
]);

const baseResult = spawnSync(
  process.execPath,
  ['scripts/verify-market-page-layout-base.mjs'],
  { cwd: root, encoding: 'utf8' },
);

if (baseResult.error) throw baseResult.error;
if (baseResult.status !== 0) {
  const failureLines = String(baseResult.stderr || '')
    .split(/\r?\n/)
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
  const remainingFailures = failureLines.filter((failure) => !obsoleteBaseFailures.has(failure));
  const recognizedOnly = failureLines.length > 0
    && remainingFailures.length === 0
    && failureLines.every((failure) => obsoleteBaseFailures.has(failure));
  if (!recognizedOnly) {
    if (baseResult.stdout) process.stdout.write(baseResult.stdout);
    if (baseResult.stderr) process.stderr.write(baseResult.stderr);
    process.exit(baseResult.status || 1);
  }
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
  'src/pages/BuildingsPage.tsx',
  'src/pages/ProvincePage.tsx',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
]) requireFile(path);

for (const text of [
  '| 市场 | `market` | `GlobalMarketPage` |',
  '实际盘口、下单和自动交易继续由地区 `MarketPage` 执行',
  '`ProvincePage` 内的市场与建筑分区仍始终是地图所打开当前州的本地视图',
  '市场不得包含工厂目录、资产包拍卖、长期合同、工厂固定价格挂牌',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text, `页面职责设计缺少全局市场与地区商品-only 边界: ${text}`);

for (const text of [
  'export function GlobalMarketPage',
  '<PageLayout title="市场">',
  'data-global-scope="market"',
  '全局商品行情',
  '地区市场',
  '<EmbeddedMarketPage model={model} embedded />',
]) requireText('src/pages/GlobalMarketPage.tsx', text);
for (const text of [
  'game.facilityTypes.map',
  '<FacilityIcon facilityTypeId={entry.id}',
]) forbidText('src/pages/GlobalMarketPage.tsx', text, `全局市场不得恢复工厂资产目录: ${text}`);

const marketPage = read('src/pages/MarketPage.tsx');
const catalogStart = marketPage.indexOf("if (!facilityAssetId && marketViewMode === 'catalog')");
const detailStart = marketPage.indexOf('\n  const detailContent =', catalogStart);
const catalogSource = marketPage.slice(catalogStart, detailStart);
if (catalogStart < 0 || detailStart < 0) failures.push('地区 MarketPage 必须保留商品目录与详情的明确分界。');
if (catalogSource.includes('game.facilityTypes.map')) failures.push('地区 MarketPage 商品目录不得恢复工厂资产行。');
if (catalogSource.includes('<FacilityIcon')) failures.push('地区 MarketPage 商品目录不得恢复工厂资产插画。');
requireText('src/pages/BuildingsPage.tsx', '<EmbeddedFacilityAssetMarket', '工厂资产交易必须继续从建筑详情打开从属市场。');
requireText('src/pages/ProvincePage.tsx', '<EmbeddedMarketPage model={model} embedded />', '州级上下文必须继续复用地区 MarketPage。');
requireText('src/pages/ProvincePage.tsx', '<RegionalEntityPageTitle entityName={marketDetailProduct.name} regionName={provinceName} />', '州级商品详情必须使用共享两行地区实体标题。');
requireText('src/pages/MarketPage.tsx', 'fixedProductId={selectedProduct.id}', '地区商品详情必须承载当前商品固定自动交易设置。');

if (failures.length) {
  console.error('市场页布局与运行时验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('市场页布局与运行时验证通过：原有商品目录、盘口、行情、响应式检查保持生效；一级市场为跨州总览，地区 MarketPage 保持商品-only，工厂资产交易继续归属建筑详情。');
