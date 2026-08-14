import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const requireText = (path, text) => {
  if (!read(path).includes(text)) throw new Error(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) throw new Error(`${path} 不应包含: ${text}`);
};

for (const path of [
  'server/src/online-auto-buy.js',
  'server/src/online-auto-buy-policy.js',
  'server/src/online-auto-buy-orders.js',
  'server/src/online-auto-trade-policy.js',
  'server/src/online-auto-trade-reservations.js',
  'src/auto-trade/types.ts',
  'src/auto-trade/useOnlineAutoTrade.ts',
  'server/test/online-auto-buy.test.js',
]) {
  if (!existsSync(resolve(process.cwd(), path))) throw new Error(`缺少商品自动交易文件: ${path}`);
}

for (const [path, texts] of Object.entries({
  'server/src/online-auto-buy-policy.js': [
    'onlineAutoBuyPolicies',
    'normalizeOnlineAutoBuyPolicy',
    'onlineAutoBuyPolicyFor',
    'targetFreeInventory',
    'maxPrice',
    'onlineAutoBuyManagedOrderIds',
  ],
  'server/src/online-auto-buy-orders.js': [
    'onlineAutoBuyOrderIds',
    'managedOnlineAutoBuyOrderFor',
    'linkManagedOnlineAutoBuyOrder',
    'cancelManagedOnlineAutoBuyOrder',
    "order.side === 'buy'",
  ],
  'server/src/online-auto-trade-policy.js': [
    'applyOnlineAutoTradePolicyAction',
    'normalizeOnlineAutoBuyPolicy',
    'normalizeOnlineAutoSellPolicy',
    'buyPolicy.targetFreeInventory > sellPolicy.minimumFreeInventory',
    'buyPolicy.maxPrice >= sellPolicy.price',
    'cancelManagedOnlineAutoBuyOrder',
    'cancelManagedOnlineAutoSellOrder',
  ],
  'server/src/online-auto-trade-reservations.js': [
    'contractAvailableHoldForOnlineTrade',
    'contract?.totalDeliveries === null',
    "proposal?.status === 'accepted'",
  ],
  'server/src/online-auto-buy.js': [
    'productionReservedQuantitiesForPlayer',
    'contractAvailableHoldForOnlineTrade',
    'onlineAutoBuyPolicyFor',
    'desiredQuantity',
    'affordableQuantity',
    'managedOnlineAutoBuyOrderFor',
    'linkManagedOnlineAutoBuyOrder',
    'cancelManagedOnlineAutoBuyOrder',
    "execution: 'online-auto-buy'",
    'applySettledCommodityOrder',
    '继续挂单',
    '已挂出',
  ],
  'server/src/online-auto-sell-policy.js': [
    'onlineAutoSellPolicies',
    'applyOnlineAutoSellPolicyAction',
    'normalizeOnlineAutoSellPolicy',
    'onlineAutoSellPolicyFor',
    'importLegacyOnlineAutoSellPolicies',
    'ensureOnlineAutoBuyPolicies',
    'conflictsWithAutoBuy',
    'cancelManagedOnlineAutoSellOrder',
    'onlineAutoSellManagedOrderIds',
  ],
  'server/src/online-auto-sell-orders.js': [
    'onlineAutoSellOrderIds',
    'managedOnlineAutoSellOrderFor',
    'linkManagedOnlineAutoSellOrder',
    'cancelManagedOnlineAutoSellOrder',
    "order.side === 'sell'",
  ],
  'server/src/warehouse.js': [
    'createOnlineAutoBuyPolicyClientState',
    'createOnlineAutoSellPolicyClientState',
    'createOnlineAutoBuyPolicyClientState(player)',
    'createOnlineAutoSellPolicyClientState(player)',
  ],
  'server/src/online-auto-sell.js': [
    'productionReservedQuantitiesForPlayer',
    'minimumFreeInventory',
    'contractAvailableHoldForOnlineTrade',
    'onlineAutoSellPolicyFor',
    "execution: 'online-auto-sell'",
    'applySettledCommodityOrder',
    'standingTarget',
    'managedOnlineAutoSellOrderFor',
    'linkManagedOnlineAutoSellOrder',
    'cancelManagedOnlineAutoSellOrder',
    '继续挂单供应',
    '已挂出',
  ],
  'server/src/order-book-runtime.js': [
    'onlineAutoBuyOrderIds',
    'onlineAutoSellOrderIds',
    'managedOpen',
    'return Math.max(0, total - managedOpen);',
  ],
  'server/src/domain.js': [
    "payload.execution === 'online-auto-buy'",
    'fillOrKill || onlineAutoSell || onlineAutoBuy',
  ],
  'server/src/runtime-action-executor.js': [
    "payload.execution === 'online-auto-trade-policy'",
    'applyOnlineAutoTradePolicyAction(world, user, payload)',
    "payload.execution === 'online-auto-buy'",
    'applyOnlineAutoBuy(world, user, payload, now)',
    "payload.execution === 'online-auto-sell'",
    'applyOnlineAutoSell(world, user, payload, now)',
    'online-auto-sell-policy',
    '!isPolicySave',
  ],
  'server/test/online-auto-buy.test.js': [
    'leaves a real standing buy order',
    'countOpenOrdersForOwner(world, alice.id), 0',
    'fills qualifying sell orders',
    'production and contract holds before target free inventory',
    'funds still cap the same target',
    'own crossing sell cancels the managed auto buy',
    'ignores client thresholds and uses the saved policy',
    'rejects overlapping inventory or price bands',
  ],
  'server/test/online-auto-sell.test.js': [
    'leaves standing supply when no qualifying buyer exists',
    'countOpenOrdersForOwner(world, alice.id), 0',
    "order.status, 'open'",
    'changing an auto sell policy cancels the old standing order',
  ],
  'src/auto-sell/economy-state.d.ts': [
    'onlineAutoBuyPolicies?: AutoBuyPolicyMap;',
    'onlineAutoBuyManagedOrderIds?: Record<string, string>;',
    'onlineAutoSellPolicies?: AutoSellPolicyMap;',
    'onlineAutoSellManagedOrderIds?: Record<string, string>;',
  ],
  'src/api/game.ts': [
    'OnlineAutoBuyPolicyInput',
    'OnlineAutoTradePolicyInput',
    'saveOnlineAutoTradePolicy',
    "execution: 'online-auto-trade-policy'",
    'autoBuyCommodity',
    "execution: 'online-auto-buy'",
    'autoSellCommodity',
    "execution: 'online-auto-sell'",
    'importLegacyOnlineAutoSellPolicies',
  ],
  'src/auto-trade/useOnlineAutoTrade.ts': [
    'useOnlineAutoTrade',
    'model.game.onlineAutoBuyPolicies ?? {}',
    'model.game.onlineAutoSellPolicies ?? {}',
    'saveOnlineAutoTradePolicy',
    'importLegacyOnlineAutoSellPolicies',
    'productionReservations',
    'contractReservations',
    'buyDesiredQuantity',
    'buyEligibleQuantity',
    'sellEligibleQuantity',
    'model.onlineAutoBuy',
    'model.onlineAutoSell',
    'busyRef.current',
  ],
  'src/auto-sell/useOnlineAutoSell.ts': [
    "from '../auto-trade/useOnlineAutoTrade'",
    'useOnlineAutoTrade as useOnlineAutoSell',
  ],
  'src/components/warehouse/WarehouseInventoryPanel.tsx': [
    '自动交易',
    '自动采购',
    '自动出售',
    '自动交易商品',
    '目标自由库存',
    '最高自动采购价格',
    '最低自由库存',
    '最低自动出售价格',
    '保存自动交易设置',
    '设置保存至存档 · 在线维护买单',
    '设置保存至存档 · 在线维护卖单',
    '可以为零库存商品开启自动采购',
    'MobileWorkspaceDetailSheet',
  ],
  'docs/WAREHOUSE_EXPANSION_DESIGN.md': [
    '客户端状态版本：34',
    '世界状态版本：30',
    '### 4.2 在线自动采购',
    '### 4.3 在线自动出售',
    '### 4.4 双向自动交易区间',
    'onlineAutoBuyPolicies',
    'onlineAutoSellPolicies',
    '目标自由库存',
    '最高自动采购价格',
    '自动采购目标自由库存 <= 自动出售最低自由库存',
    '最高自动采购价格 < 最低自动出售价格',
    '一次保存必须原子写入同商品的采购与出售策略',
    '不占玩家普通开放订单配额',
    '零库存',
    '后台常驻任务',
  ],
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md': [
    '在线自动采购买单和在线自动出售卖单',
    'execution: online-auto-buy',
    'execution: online-auto-sell',
    '两类关联订单均不占普通开放订单配额',
    '共享仓库永久无限',
  ],
})) {
  for (const text of texts) requireText(path, text);
}

if (existsSync(resolve(process.cwd(), 'src/auto-sell/autoSellApi.ts'))) {
  throw new Error('自动交易策略写入不得恢复独立网络封装 src/auto-sell/autoSellApi.ts');
}
forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', "selectMarketAsset('commodity', product.id)");
forbidText('src/auto-sell/autoSellStorage.ts', 'export function saveAutoSellPolicies');
forbidText('src/auto-trade/useOnlineAutoTrade.ts', 'setInterval(');
forbidText('src/auto-trade/useOnlineAutoTrade.ts', 'setTimeout(');
forbidText('server/src/runtime-action-executor.js', 'ensureOnlineAutoSellPolicies');
forbidText('server/src/runtime-action-executor.js', 'ensureOnlineAutoBuyPolicies');
forbidText('server/src/online-auto-buy.js', 'payload.maxPrice');
forbidText('server/src/online-auto-buy.js', 'payload.targetFreeInventory');
forbidText('server/src/online-auto-buy.js', 'setInterval(');
forbidText('server/src/online-auto-buy.js', 'setTimeout(');
forbidText('server/src/online-auto-sell.js', 'payload.price');
forbidText('server/src/online-auto-sell.js', 'payload.minimumFreeInventory');
forbidText('server/src/online-auto-sell.js', 'setInterval(');
forbidText('server/src/online-auto-sell.js', 'setTimeout(');
forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '可成交部分完成后立即撤销剩余开放数量');
forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '不得留下客户端离线后仍可继续成交的开放卖单');
forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '在线自动出售控制器属于浏览器本地增强');
forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '客户端状态版本继续为 31');

console.log('Online commodity auto-trade verification passed.');
