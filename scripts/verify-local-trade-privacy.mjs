import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push('缺少文件: ' + path); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(path + ' 缺少: ' + text); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(path + ' 不应包含: ' + text); };

[
  'server/src/facility-groups.js',
  'src/types.ts',
  'src/app/gameViewModel.ts',
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
  'normalized.fills.map(publicOrderFill)',
  'else delete normalized.fills',
  'version: CURRENT_CLIENT_STATE_VERSION',
]) requireText('server/src/facility-groups.js', text);

for (const text of ['isOwn?: boolean', 'version: 17;', 'export interface OrderFill']) requireText('src/types.ts', text);
for (const text of ['counterparty: string', 'makerOrderId', 'takerOrderId', "liquidity: 'maker' | 'taker'", 'populationModelId?:', 'fundingPool?:']) forbidText('src/types.ts', text);

for (const text of [
  'STORAGE_VERSION = 5',
  'normalizeTrades',
  'legacyVersion of [4, 3, 2, 1]',
  "event.category !== 'trade' && event.sourceType !== 'trade'",
  'window.localStorage.removeItem(storageKey(userId, legacyVersion))',
  'orders: state.orders.filter((order) => order.isOwn)',
  'if (!order.isOwn) continue',
]) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['fill.counterparty', 'trade.counterparty', 'counterparty:', 'populationModelId', 'fundingPool']) forbidText('src/utils/localActivityStore.ts', text);

requireText('src/app/gameViewModel.ts', 'order.isOwn &&');
requireText('src/pages/MarketPage.tsx', 'order.isOwn');
for (const text of ['trade.counterparty', 'role="columnheader">来源', '人口经济']) forbidText('src/pages/MarketPage.tsx', text);

for (const [path, text] of [
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '普通玩家只能感知自己的订单完成情况'],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '隐藏页面列但继续在 API 或 localStorage 中保留来源信息'],
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
console.log('普通玩家订单 API、本地存储和市场成交展示均已匿名化，人口模型及资金池字段不会公开。');
