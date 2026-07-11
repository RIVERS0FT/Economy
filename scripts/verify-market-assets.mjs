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
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'server/src/asset-events.js',
  'server/src/storage.js',
  'server/test/asset-events.test.js',
  'src/utils/localActivityStore.ts',
  'src/pages/MarketPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/styles/market-funds.css',
].forEach(requireFile);

forbidFile('src/pages/RecordsPage.tsx');

for (const [path, forbidden] of [
  ['src/config/navigation.ts', ["id: 'records'", "label: '订单'"]],
  ['src/pages/PageRouter.tsx', ['RecordsPage', "case 'records'"]],
  ['src/components/shell/NavigationItems.tsx', ["id === 'records'"]],
  ['src/pages/OverviewPage.tsx', ["setTab('records')", 'game.trades']],
  ['src/pages/MarketPage.tsx', ['game.trades']],
  ['src/pages/AssetsPage.tsx', ['game.ledger', 'game.assetEvents', 'ledgerCategoryNames', "setTab('records')"]],
  ['src/types.ts', ['version: 5;', 'version: 6;', 'assetEvents: AssetEvent[];', 'trades: TradeRecord[];', 'ledger: LedgerEntry[];']],
  ['server/src/storage.js', ['migrateAssetEvents', 'appendAssetEventFromDiff', 'assetEvents: normalizeJson']],
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
    '本地成交记录',
    'localTrades.map',
    '仅保存在当前浏览器',
  ]],
  ['src/pages/AssetsPage.tsx', [
    'title="资金与资产"',
    'localAssetEvents',
    '本地资金与资产变动',
    'clearLocalActivity',
    'event.inventoryChanges',
    'event.facilityChanges',
    'event.productionChanges',
    'event.frozenCashDelta',
    '这些记录不上传服务器',
  ]],
  ['src/types.ts', [
    'version: 7;',
    'export interface AssetEvent',
    'localOnly: true;',
    'Never included in EconomyState or persisted by the API',
  ]],
  ['src/utils/localActivityStore.ts', [
    'window.localStorage',
    'syncLocalActivity',
    'loadLocalActivity',
    'clearLocalActivity',
    'snapshotState',
    'MAX_ASSET_EVENTS',
    'MAX_TRADES',
    'Local logs are optional and must never block authoritative game actions',
  ]],
  ['src/app/gameViewModel.ts', [
    'localAssetEvents',
    'localTrades',
    'syncLocalActivity',
    'loadLocalActivity',
    'clearLocalActivityStore',
  ]],
  ['server/src/asset-events.js', [
    'export function stripPlayerLogs',
    'delete player.trades',
    'delete player.ledger',
    'delete player.assetEvents',
    'called immediately before every SQLite write',
  ]],
  ['server/src/storage.js', [
    "this.database.exec('BEGIN IMMEDIATE')",
    'stripPlayerLogs',
    'version: 7',
    'trades: _serverTrades',
    'ledger: _serverLedger',
    'assetEvents: _serverAssetEvents',
  ]],
  ['server/test/asset-events.test.js', [
    'client state version 7 excludes all player log arrays',
    'actions update authoritative state without writing player logs to SQLite',
    'legacy server logs are removed during the next state load',
    'idempotency preserves authoritative response without creating server logs',
  ]],
  ['docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md', [
    '市场负责交易行为',
    '资金负责资产结果',
    '不再提供独立“订单”导航或独立订单页面',
    '用户可见日志只保存在浏览器本地',
  ]],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', [
    '# Economy 本地活动日志设计',
    '服务器不得持久化玩家活动日志',
    'localStorage',
    '不参与资产计算',
    '未更新本设计和防回退检查的日志存储修改不应合并',
  ]],
]) {
  for (const text of required) requireText(path, text);
}

if (failures.length) {
  console.error('市场订单、资金资产与本地日志架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('市场订单、资金资产与本地日志架构验证通过。');
