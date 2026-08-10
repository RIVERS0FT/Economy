import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const requireText = (path, text) => {
  if (!read(path).includes(text)) throw new Error(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) throw new Error(`${path} 不应包含: ${text}`);
};

for (const [path, texts] of Object.entries({
  'server/src/online-auto-sell-policy.js': [
    'onlineAutoSellPolicies',
    'applyOnlineAutoSellPolicyAction',
    'normalizeOnlineAutoSellPolicy',
    'onlineAutoSellPolicyFor',
    'importLegacyOnlineAutoSellPolicies',
    'payload.legacyImport === true',
    'Number(player.saveEpoch || 0) > 0',
    'Object.hasOwn(existing, productId)',
  ],
  'server/src/warehouse.js': [
    'createOnlineAutoSellPolicyClientState',
    'createOnlineAutoSellPolicyClientState(player)',
  ],
  'server/src/online-auto-sell.js': [
    'productionReservedQuantitiesForPlayer',
    'minimumFreeInventory',
    'contractAvailableHoldForAutoSell',
    'contract?.totalDeliveries === null',
    'crossingBuyQuantityForAutoSell',
    'onlineAutoSellPolicyFor',
    "execution: 'online-auto-sell'",
    'applySettledCommodityOrder',
    'cancelSettledCommodityOrder',
  ],
  'server/src/runtime-action-executor.js': [
    "payload.execution === 'online-auto-sell-policy'",
    'applyOnlineAutoSellPolicyAction(world, user, payload)',
    "payload.execution === 'online-auto-sell'",
    'applyOnlineAutoSell(world, user, payload, now)',
    '!isPolicySave',
  ],
  'server/src/facility-groups.js': [
    'export function productionReservedQuantitiesForPlayer',
    'if (!group.enabled) continue;',
    "group.status === 'running'",
  ],
  'server/test/online-auto-sell-persistence.test.js': [
    "execution: 'online-auto-sell-policy'",
    'persisted.onlineAutoSellPolicies.wheat',
    'persisted.lastEconomicActivityAt',
  ],
  'server/test/online-auto-sell-policy-import.test.js': [
    'import all catalog products in one atomic action',
    'PRODUCT_CATALOG.length',
    'all-or-nothing',
    'cannot restore settings after save deletion',
    'preserves saved entries and fills only missing products',
  ],
  'src/auto-sell/economy-state.d.ts': [
    "declare module '../types'",
    'interface EconomyState',
    'onlineAutoSellPolicies?: AutoSellPolicyMap;',
  ],
  'src/api/game.ts': [
    'autoSellCommodity',
    "execution: 'online-auto-sell'",
    'saveOnlineAutoSellPolicy',
    'importLegacyOnlineAutoSellPolicies',
    "execution: 'online-auto-sell-policy'",
    'legacyImport: true',
    'function postAction',
    "headers.set('Idempotency-Key', createRequestKey())",
    "headers.set('X-Economy-Save-Epoch', String(currentSaveEpoch))",
    'DEFAULT_WRITE_TIMEOUT_MS',
  ],
  'src/auto-sell/autoSellStorage.ts': [
    'Read-only compatibility source',
    'minimumFreeInventory',
    'raw.minimumFreeInventory ?? 0',
  ],
  'src/auto-sell/useOnlineAutoSell.ts': [
    'useOnlineAutoSell',
    'model.game.onlineAutoSellPolicies ?? {}',
    'saveOnlineAutoSellPolicy',
    'importLegacyOnlineAutoSellPolicies',
    'loadAutoSellPolicies',
    'clearAutoSellPolicies',
    'model.game.saveEpoch > 0',
    'eligibleQuantity',
    'productionReservations',
    'contractReservations',
    'contract.totalDeliveries !== null',
    'minimumFreeInventory',
    'model.onlineAutoSell',
  ],
  'src/components/warehouse/WarehouseInventoryPanel.tsx': [
    '设置自动出售',
    '最低自动出售价格',
    '最低自由库存',
    'parseIntegerDraft',
    '设置保存至存档 · 仅在线执行',
    '生产预定',
    '合同预定',
    '预计可自动出售',
    '正在保存…',
  ],
  'tests/browser/warehouse-auto-sell.spec.ts': [
    '设置保存至存档 · 仅在线执行',
  ],
  'docs/WAREHOUSE_EXPANSION_DESIGN.md': [
    '客户端状态版本：33',
    '世界状态版本：27',
    '### 4.1 在线自动出售',
    '自动出售策略属于玩家经济存档',
    '执行器仍属于在线客户端',
    '单次原子请求导入旧策略',
    '导入只能补齐缺失商品，绝不能覆盖服务器已有策略',
    '客户端状态版本以当前全局基线 33 为准',
    '不为旧客户端保留“执行时从请求阈值补写策略”的兼容桥接',
    '`saveEpoch = 0`',
    '`saveEpoch > 0`',
    '已删除存档的自动出售配置污染新存档',
    '不得为此增加在线心跳、自动出售专用轮询、全世界扫描调度器或后台常驻任务',
    '可自动出售 = max(0, available - 生产预定 - 合同可用保留 - 最低自由库存保留量)',
    '长期供货合同始终按仍在履约的下一批计入',
    '最低自由库存保留量只限制在线自动出售',
    '重新读取存档中的当前策略',
    '不得留下客户端离线后仍可继续成交的开放卖单',
  ],
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md': [
    'execution: online-auto-sell',
    '该临时执行不占用普通开放订单配额',
  ],
})) {
  for (const text of texts) requireText(path, text);
}

if (existsSync(resolve(process.cwd(), 'src/auto-sell/autoSellApi.ts'))) {
  throw new Error('自动出售策略写入不得恢复独立网络封装 src/auto-sell/autoSellApi.ts');
}
forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', "selectMarketAsset('commodity', product.id)");
forbidText('src/auto-sell/autoSellStorage.ts', 'export function saveAutoSellPolicies');
forbidText('src/auto-sell/useOnlineAutoSell.ts', 'saveAutoSellPolicies(');
forbidText('src/auto-sell/useOnlineAutoSell.ts', 'setInterval(');
forbidText('src/auto-sell/useOnlineAutoSell.ts', 'setTimeout(');
forbidText('server/src/online-auto-sell-policy.js', 'player.onlineAutoSellPolicies = normalized;');
forbidText('server/src/runtime-action-executor.js', 'ensureOnlineAutoSellPolicies');
forbidText('server/src/online-auto-sell.js', 'payload.price');
forbidText('server/src/online-auto-sell.js', 'payload.minimumFreeInventory');
forbidText('server/src/online-auto-sell.js', 'migrateLegacyExecutionPolicy');
forbidText('server/src/online-auto-sell.js', 'setInterval(');
forbidText('server/src/online-auto-sell.js', 'setTimeout(');

requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', 'model.autoSell ??');
forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '在线自动出售控制器属于浏览器本地增强');
forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '客户端状态版本继续为 31');

console.log('Online auto-sell verification passed.');
