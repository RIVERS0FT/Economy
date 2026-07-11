import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
function requireFile(path) { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); }
function forbidFile(path) { if (existsSync(resolve(root, path))) failures.push(`不应存在文件: ${path}`); }
function requireText(path, text) { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); }
function forbidText(path, text) { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); }
function requireOrderedText(path, earlier, later) {
  const content = read(path); const first = content.indexOf(earlier); const second = content.indexOf(later);
  if (first < 0 || second < 0 || first >= second) failures.push(`${path} 必须先包含 ${earlier}，再包含 ${later}`);
}

[
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'server/src/asset-events.js',
  'server/src/storage.js',
  'server/src/facility-groups.js',
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
  ['src/pages/MarketPage.tsx', ['game.trades', 'aggregateOrderBook', 'book-columns', 'listing.facility.', 'facilityId:']],
  ['src/pages/AssetsPage.tsx', ['game.ledger', 'game.assetEvents', "setTab('records')"]],
  ['src/types.ts', ['version: 7;', 'assetEvents: AssetEvent[];', 'trades: TradeRecord[];', 'ledger: LedgerEntry[];', 'ProductionFacility']],
  ['server/src/storage.js', ['migrateAssetEvents', 'appendAssetEventFromDiff']],
]) {
  for (const text of forbidden) forbidText(path, text);
}

for (const text of [
  'derived.ownSelectedOpenOrders', 'derived.ownOpenOrders', 'cancelOrder(order.id)',
  '我的订单与成交', '冻结资金', '冻结商品', '本地成交记录', 'localTrades.map',
  'order-quick-fill', '1/4 仓', '1/2 仓', '全仓',
  'const maxBuyQuantity', 'game.warehouseAvailableCapacity', 'Math.floor(game.credits / orderPrice)',
  'const maxSellQuantity = selectedInventory.available',
  'const bestAsks = derived.asks.slice(0, 5).reverse()',
  'const bestBids = derived.bids.slice(0, 5)',
  'single-order-book', 'order-book-midpoint', '工厂数量市场',
  'purchaseQuantity', 'buyFacility(listing.id, purchaseQuantity)',
]) requireText('src/pages/MarketPage.tsx', text);
requireOrderedText('src/pages/MarketPage.tsx', '限价', '数量');
requireOrderedText('src/pages/MarketPage.tsx', '数量', 'order-quick-fill');

for (const text of [
  'title="资金与资产"', 'localAssetEvents', '本地资金与资产变动', 'clearLocalActivity',
  'event.inventoryChanges', 'event.facilityChanges', 'event.productionChanges', 'event.frozenCashDelta',
  'game.facilityGroups', '这些记录不上传服务器',
]) requireText('src/pages/AssetsPage.tsx', text);

for (const text of [
  'version: 8;', 'export interface FacilityGroup', 'export interface FacilityListing',
  'quantity: number;', 'unitPrice: number;', 'export interface AssetEvent', 'localOnly: true;',
]) requireText('src/types.ts', text);

for (const text of [
  'STORAGE_VERSION = 2', 'window.localStorage', 'syncLocalActivity', 'loadLocalActivity',
  'clearLocalActivity', 'snapshotState', 'facilityGroups: state.facilityGroups',
  'MAX_ASSET_EVENTS', 'MAX_TRADES', 'Local logs are optional and must never block authoritative game actions',
]) requireText('src/utils/localActivityStore.ts', text);

for (const text of [
  "this.database.exec('BEGIN IMMEDIATE')", 'stripPlayerLogs', 'version: 8',
  'trades: _serverTrades', 'ledger: _serverLedger', 'assetEvents: _serverAssetEvents',
]) requireText('server/src/storage.js', text);

for (const text of [
  'listFacilityGroup', 'buyFacilityGroup', 'listing.quantity -= quantity',
  'buyer.credits -= total', 'seller.credits += total', 'pendingJoinCount += quantity',
]) requireText('server/src/facility-groups.js', text);

for (const text of [
  '.order-quick-fill', '.single-order-book', '.order-book-stack', '.book-order-row',
  '.order-book-midpoint', '.listing-purchase-control',
]) requireText('src/styles/market-funds.css', text);

for (const text of [
  '限价在前、数量在后', '`1/4 仓`、`1/2 仓`、`全仓`',
  '订单簿为单列', '买卖盘各最多 5 笔', '工厂挂牌和购买按类型、数量和单座价格',
]) requireText('docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md', text);

for (const text of [
  '限价必须位于数量之前', '1/4 仓｜1/2 仓｜全仓', '订单簿不分左右两列',
  '工厂数量市场', '客户端状态版本 8',
]) requireText('docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md', text);

if (failures.length) {
  console.error('市场、工厂数量交易与本地资产架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('市场架构验证通过：快捷仓位、单列 5+5 订单簿、数量工厂市场和本地日志边界满足第三版设计。');
