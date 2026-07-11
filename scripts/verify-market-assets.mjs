import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

function forbidFile(path) {
  if (existsSync(resolve(root, path))) failures.push(`不应存在文件: ${path}`);
}

function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
}

function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
}

[
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'server/src/asset-events.js',
  'server/src/storage.js',
  'server/test/asset-events.test.js',
  'src/pages/MarketPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/styles/market-funds.css',
].forEach(requireFile);

forbidFile('src/pages/RecordsPage.tsx');

for (const [path, forbidden] of [
  ['src/config/navigation.ts', ["id: 'records'", "label: '订单'"]],
  ['src/pages/PageRouter.tsx', ['RecordsPage', "case 'records'"]],
  ['src/components/shell/NavigationItems.tsx', ["id === 'records'"]],
  ['src/pages/OverviewPage.tsx', ["setTab('records')"]],
  ['src/pages/AssetsPage.tsx', ['game.ledger', 'ledgerCategoryNames', "setTab('records')"]],
  ['src/types.ts', ['version: 5;']],
]) {
  for (const text of forbidden) forbidText(path, text);
}

for (const [path, required] of [
  ['src/config/navigation.ts', ["label: '市场'", "label: '资金'"]],
  ['src/components/shell/NavigationItems.tsx', ["id === 'market' && openOrderCount > 0"]],
  ['src/pages/MarketPage.tsx', [
    'derived.ownSelectedOpenOrders',
    'derived.ownOpenOrders',
    'cancelOrder(order.id)',
    '我的订单与成交',
    '冻结资金',
    '冻结商品',
    '成交记录',
    'game.trades.map',
  ]],
  ['src/pages/AssetsPage.tsx', [
    'title="资金与资产"',
    'game.assetEvents',
    '资金与资产变动',
    'event.inventoryChanges',
    'event.facilityChanges',
    'event.productionChanges',
    'event.frozenCashDelta',
  ]],
  ['src/types.ts', [
    'version: 6;',
    'export interface AssetEvent',
    'assetEvents: AssetEvent[]',
  ]],
  ['server/src/asset-events.js', [
    'export function migrateAssetEvents',
    'export function capturePlayerAssetSnapshot',
    'export function appendAssetEventFromDiff',
    'world.version = 3',
    'legacy: true',
    'inventoryChanges',
    'facilityChanges',
    'productionChanges',
  ]],
  ['server/src/storage.js', [
    "this.database.exec('BEGIN IMMEDIATE')",
    'processAndRecord',
    'capturePlayerAssetSnapshot',
    'appendAssetEventFromDiff',
    'version: 6',
    'assetEvents:',
  ]],
  ['server/test/asset-events.test.js', [
    'client state exposes asset events and version 6',
    'placing and cancelling an order records frozen asset changes',
    'production settlement records cash input and output changes',
    'legacy ledger migrates once into asset events',
    'idempotency does not duplicate asset events',
  ]],
  ['docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md', [
    '市场负责交易行为',
    '资金负责资产结果',
    '不再提供独立“订单”导航或独立订单页面',
    '一次服务器事务只生成一条复合资产事件',
    '未更新本设计、迁移和测试的市场或资产信息架构回退不应合并',
  ]],
]) {
  for (const text of required) requireText(path, text);
}

if (failures.length) {
  console.error('市场订单与资金资产架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('市场订单与资金资产架构验证通过。');
