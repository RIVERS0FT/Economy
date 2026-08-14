import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push('缺少文件: ' + path); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(path + ' 缺少: ' + text); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(path + ' 不应包含: ' + text); };

[
  'server/src/facility-groups.js',
  'server/src/app.js',
  'server/src/runtime-store.js',
  'server/src/runtime-store-core.js',
  'server/test/order-history.test.js',
  'src/types.ts',
  'src/app/gameViewModel.ts',
  'src/app/useDerivedGameData.ts',
  'src/app/clientOrderIndex.ts',
  'src/utils/localActivityStore.ts',
  'src/pages/MarketPage.tsx',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'function publicOrderView(order, userId)',
  'normalized.isOwn = isOwn',
  'delete normalized.ownerType',
  'delete normalized.ownerId',
  'delete normalized.ownerName',
  'delete normalized.demandGroupId',
  'delete normalized.demandTier',
  'delete normalized.demandCycleId',
  'delete normalized.populationModelId',
  'delete normalized.fundingPool',
  'delete normalized.fundingSlices',
  'normalized.fills.map(publicOrderFill)',
  'else delete normalized.fills',
  'version: CURRENT_CLIENT_STATE_VERSION',
  'CLIENT_RECENT_CLOSED_ORDER_LIMIT = ECONOMY_CONSTANTS.maxOpenOrders',
  'closedOrdersForOwner(world, userId)',
  'createOrderHistoryPage',
  'isOpenOrder(order) || recentClosedIds.has',
]) requireText('server/src/facility-groups.js', text);

for (const text of [
  "path === '/api/game/orders/history'",
  'store.listOrderHistory(user',
]) requireText('server/src/app.js', text);
const runtimeStore = `${read('server/src/runtime-store-core.js')}\n${read('server/src/runtime-store.js')}`;
for (const text of [
  'listOrderHistory(user, options = {}',
  'createOrderHistoryPage(this.worldCache.world',
]) if (!runtimeStore.includes(text)) failures.push('运行时存储缺少: ' + text);
for (const text of [
  'main state keeps all open orders and only bounded recent closed orders for the current player',
  'order history provides opaque cursor pagination with only the current player anonymous fills',
  'order history rejects malformed cursors',
]) requireText('server/test/order-history.test.js', text);
for (const text of ['isOwn?: boolean', `version: ${CURRENT_CLIENT_STATE_VERSION};`, 'export interface OrderFill']) requireText('src/types.ts', text);
for (const text of ['counterparty: string', 'makerOrderId', 'takerOrderId', "liquidity: 'maker' | 'taker'", 'populationModelId?:', 'fundingPool?:']) forbidText('src/types.ts', text);

for (const text of [
  'STORAGE_VERSION = 6',
  'normalizeTrades',
  'legacyVersion of [5, 4, 3, 2, 1]',
  'window.localStorage.removeItem(storageKey(userId, legacyVersion))',
  'orders: state.orders.filter((order) => order.isOwn)',
  'products: state.products.map(({ id, name }) => ({ id, name }))',
  'facilityTypes: state.facilityTypes.map(({ id, name }) => ({ id, name }))',
  'export function clearLocalTrades',
]) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['AssetEvent', 'assetEvents', 'diffInventories']) forbidText('src/utils/localActivityStore.ts', text);
for (const text of ['fill.counterparty', 'trade.counterparty', 'counterparty:', 'populationModelId', 'fundingPool']) forbidText('src/utils/localActivityStore.ts', text);

for (const text of [
  'if (order.isOwn === true) ownOpenOrders.push(order);',
  'order.isOwn === true',
]) requireText('src/app/clientOrderIndex.ts', text);
requireText('src/app/useDerivedGameData.ts', 'getClientOrderIndex(orders).ownOpenOrders');
requireText('src/pages/MarketPage.tsx', 'order.isOwn');
for (const text of ['trade.counterparty', 'role="columnheader">来源', '人口经济', 'fundingSlices']) forbidText('src/pages/MarketPage.tsx', text);

for (const [path, text] of [
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '只保存当前玩家订单新增的匿名逐笔成交'],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '隐藏页面列但继续在 API 或 localStorage 中保留来源信息'],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '`GET /api/game/orders/history`'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '主状态不得发送全部 800 笔关闭历史'],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '集中式公开订单序列化'],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '`populationModelId`'],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '不得设置“来源”列'],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '市场页面不得增加人口经济区域'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '单一公开订单序列化函数'],
]) requireText(path, text);

if (failures.length) {
  console.error(`普通玩家成交匿名化验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('普通玩家订单 API、本地存储和市场成交展示均已匿名化，客户端订单索引只依据 isOwn 识别当前玩家订单，人口模型及资金池字段不会公开。');