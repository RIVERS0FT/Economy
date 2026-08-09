import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const requireText = (path, text) => {
  if (!read(path).includes(text)) throw new Error(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) throw new Error(`${path} 不应包含: ${text}`);
};

for (const [path, texts] of Object.entries({
  'server/src/online-auto-sell.js': [
    'productionReservedQuantitiesForPlayer',
    'contractAvailableHoldForAutoSell',
    'crossingBuyQuantityForAutoSell',
    "execution: 'online-auto-sell'",
    'applySettledCommodityOrder',
      'cancelSettledCommodityOrder',
  ],
  'server/src/runtime-action-executor.js': [
    "payload.execution === 'online-auto-sell'",
    'applyOnlineAutoSell(world, user, payload, now)',
  ],
  'server/src/facility-groups.js': [
    'export function productionReservedQuantitiesForPlayer',
    'if (!group.enabled) continue;',
    "group.status === 'running'",
  ],
  'src/api/game.ts': [
    'autoSellCommodity',
    "execution: 'online-auto-sell'",
  ],
  'src/auto-sell/useOnlineAutoSell.ts': [
    'useOnlineAutoSell',
    'eligibleQuantity',
    'productionReservations',
    'contractReservations',
    'model.onlineAutoSell',
  ],
  'src/components/warehouse/WarehouseUpgradeCard.tsx': [
    '设置自动出售',
    '最低自动出售价格',
    '仅客户端在线',
    '生产预定',
    '合同预定',
    '预计可自动出售',
  ],
  'docs/WAREHOUSE_EXPANSION_DESIGN.md': [
    '### 7.1 在线自动出售',
    '不得为此增加在线心跳、自动出售专用轮询、全世界扫描调度器或后台常驻任务',
    '可自动出售 = max(0, available - 生产预定 - 合同可用保留)',
    '不得留下客户端离线后仍可继续成交的开放卖单',
  ],
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md': [
    'execution: online-auto-sell',
    '该临时执行不占用普通开放订单配额',
  ],
})) {
  for (const text of texts) requireText(path, text);
}

forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', "selectMarketAsset('commodity', product.id)");
forbidText('src/auto-sell/useOnlineAutoSell.ts', 'setInterval(');
forbidText('src/auto-sell/useOnlineAutoSell.ts', 'setTimeout(');
forbidText('server/src/online-auto-sell.js', 'setInterval(');
forbidText('server/src/online-auto-sell.js', 'setTimeout(');

requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', 'model.autoSell ??');
requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '在线自动出售控制器属于浏览器本地增强');

console.log('Online auto-sell verification passed.');
