import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];
const requireText = (path, text) => { if (!existsSync(resolve(root, path)) || !read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (existsSync(resolve(root, path)) && read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

for (const text of [
  'delete player.inventoryCapacity;',
  'delete player.warehouseLevel;',
  'warehouseStoredQuantity: storedQuantity(player)',
  'createFactoryAutoTradeExecutionClientState(player)',
  'createFactoryAutoOperationClientState(player)',
]) requireText('server/src/warehouse.js', text);

for (const text of [
  'WarehouseInventoryPanel',
  'WarehouseInventoryGrid',
  'data-ui-interactive="surface"',
  'onOpenProduct?.(product.id)',
  '仓库中暂无商品',
]) requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
for (const text of ['共享仓库', '无限容量</StatusTag>', 'WarehouseTransportPanel', 'MarketAutoTradePanel']) forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
requireText('src/pages/ProvincePage.tsx', '<WarehouseInventoryPanel');
requireText('src/pages/ProvincePage.tsx', 'onOpenProduct={openWarehouseProduct}');

for (const text of [
  '自动经营',
  'GameConcept',
  'children({ policy: draft, saving, updatePolicy })',
]) requireText('src/components/facilities/FacilityAutoOperationControls.tsx', text);
for (const text of ['经营模式', '产成品处理', '利润优先', '保供优先', '满足内部需求后出售', '全部保留']) {
  forbidText('src/components/facilities/FacilityAutoOperationControls.tsx', text);
}
for (const text of ['<FacilityAutoOperationControls group={group}>', 'GameConcept concept="input-coverage"', '原料保障']) {
  requireText('src/pages/production/ProductionFacilityDetail.tsx', text);
}
forbidText('src/pages/MarketPage.tsx', '<MarketAutoTradePanel');

for (const path of ['server/src/online-auto-buy.js', 'server/src/online-auto-sell.js']) {
  requireText(path, '仅在服务器确认周期完成时执行');
  forbidText(path, 'applySettledCommodityOrder(');
}
for (const token of ['model.onlineAutoBuy(', 'model.onlineAutoSell(', 'setInterval(']) {
  forbidText('src/auto-trade/useOnlineAutoTrade.ts', token);
}
requireText('server/src/warehouse.js', 'createCommodityFreezeClientState(player)');
requireText('server/src/commodity-freezes.js', 'assertCommodityFreezeInvariant');
requireText('server/src/cycle-auto-operation.js', 'completeBuildingCycleAutoOperation');
for (const text of ['仓库容量永久无限', '连续 48 州均直接显示本地库存内容']) {
  requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);
}

const bannedRuntimeTokens = [
  'warehouseUpgradeCost',
  'warehouseNextCapacity',
  'warehouseAvailableCapacity',
  'warehouseReservedQuantity',
  'warehouseOrderReservedQuantity',
  'warehouseContractReservedQuantity',
  'warehouseAuctionReservedQuantity',
  'warehouseUsedCapacity',
  'upgradeWarehouse',
  'WAREHOUSE_BASE_CAPACITY',
  'WAREHOUSE_CAPACITY_STEP',
  'warehouseCapacityForLevel',
  "reason: 'warehouse_full'",
];
function walk(directory) {
  const base = resolve(root, directory);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return walk(relative);
    return /\.(?:js|ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}
for (const path of ['server/src', 'src'].flatMap(walk)) {
  const content = read(path);
  for (const token of bannedRuntimeTokens) if (content.includes(token)) failures.push(`${path} 不得恢复仓库容量机制: ${token}`);
}

const css = read('src/styles/warehouse-expansion.css');
for (const text of [
  'grid-template-columns: repeat(5, minmax(0, 1fr));',
  '@container (max-width: 559px)',
  '@container (min-width: 760px)',
  '@container (min-width: 960px)',
]) if (!css.includes(text)) failures.push(`仓库商品卡网格样式缺少: ${text}`);

requireText('src/styles/factory-auto-operation.css', 'grid-template-columns: minmax(0, 1fr) auto;');
requireText('src/pages/production/ProductionFacilityDetail.tsx', '(group.frozenCount ?? group.listedCount) + group.mortgagedCount + (group.contractCollateralCount ?? 0)');

if (failures.length) {
  console.error('无限共享仓库/即时自动经营防回退检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('无限共享仓库/即时自动经营防回退检查通过：连续 48 州仓库直接可用，工厂策略按当日官方价触发即时采购/出售，以来源冻结保护库存，不维护玩家挂单。');
