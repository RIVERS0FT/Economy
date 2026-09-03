import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

for (const path of [
  'server/src/facility-groups.js',
  'server/src/app.js',
  'server/test/order-history.test.js',
  'src/utils/localActivityStore.ts',
  'src/pages/MarketPage.tsx',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
]) requireFile(path);

for (const text of [
  'function publicOrderView(order, userId)',
  'normalized.isOwn = isOwn',
  'delete normalized.ownerType',
  'delete normalized.ownerId',
  'delete normalized.ownerName',
  'delete normalized.populationModelId',
  'delete normalized.fundingPool',
  'delete normalized.fundingSlices',
  'normalized.fills.map(publicOrderFill)',
]) requireText('server/src/facility-groups.js', text);
for (const text of ["path === '/api/game/orders/history'", 'store.listOrderHistory(user']) requireText('server/src/app.js', text);
for (const text of [
  'main state keeps only current player open orders and bounded recent closed orders',
  'order history provides opaque cursor pagination with only the current player anonymous fills',
]) requireText('server/test/order-history.test.js', text);

for (const text of [
  'STORAGE_VERSION = 7',
  'normalizeTrades',
  'export function clearLocalTrades',
]) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['trade.counterparty', 'counterparty:', 'populationModelId', 'fundingPool', 'fundingSlices']) forbidText('src/utils/localActivityStore.ts', text);

for (const text of [
  'const selectedLocalTrades = useMemo(',
  'localTrades.filter((trade) => (',
  'trade.type === activeAssetKind',
  'trade.productId',
  'trade.facilityTypeId',
  '<VirtualRecordTable',
  'className="local-trades-section"',
  '手续费 / 实收',
]) requireText('src/pages/MarketPage.tsx', text);
for (const text of [
  'order.isOwn',
  'ownOpenOrders',
  'openOrdersForAsset',
  'trade.counterparty',
  'role="columnheader">来源',
  '人口经济',
  'fundingSlices',
]) forbidText('src/pages/MarketPage.tsx', text);

for (const [path, text] of [
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '只保存当前玩家订单新增的匿名逐笔成交'],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '`GET /api/game/orders/history`'],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '普通玩家页面不得展示内部订单所有者'],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '`populationModelId`'],
]) requireText(path, text);

if (failures.length) {
  console.error(`普通玩家成交匿名化验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('普通玩家成交隐私验证通过：历史兼容订单只公开匿名 fills，地区即时市场最近成交来自浏览器本地匿名缓存，不依赖开放订单或内部人口资金字段。');
