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
  'createFactoryAutoOperationClientState(player)',
  'createInventoryFreezeClientState(player)',
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

for (const [path, tokens] of [
  ['server/src/inventory-freezes.js', [
    'inventory.available -= added;',
    'inventory.frozen = nonNegativeInteger(inventory.frozen) + added;',
    'inventory.frozen -= released;',
    'sourceFrozenQuantity',
    'createInventoryFreezeClientState',
  ]],
  ['server/src/cycle-auto-operation.js', [
    'targetFor(descriptor, input)',
    'setInventoryFreezeTarget',
    'descriptorProfitable',
    'purchaseMissingFreeze',
    'sellAllAvailable',
    "execution: 'cycle-auto-operation'",
  ]],
  ['server/src/production-input-sourcing.js', [
    'thawProductionGuarantee',
    'finalizeProductionOutputContracts',
    'runCycleAutoOperation',
  ]],
]) {
  for (const token of tokens) requireText(path, token);
}
forbidText('server/src/production-input-sourcing.js', 'applyImmediateCommodityBuy');

for (const token of ['applySettledCommodityOrder', 'commoditySystemPriceFor', 'officialPrice > policy.maxPrice']) forbidText('server/src/online-auto-buy.js', token);
for (const token of ['applySettledCommodityOrder', 'commoditySystemPriceFor', 'officialPrice < policy.price']) forbidText('server/src/online-auto-sell.js', token);
requireText('server/src/online-auto-buy.js', '周期完成时由服务器统一结算');
requireText('server/src/online-auto-sell.js', '周期完成时由服务器统一结算');

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
requireText('src/pages/MarketPage.tsx', 'market-freeze-inventory-value');
requireText('src/utils/inventoryFreezeBreakdown.ts', '合同冻结');
requireText('src/utils/inventoryFreezeBreakdown.ts', '拍卖冻结');
for (const text of ['保障目标', '保障缺口']) forbidText('src/pages/MarketPage.tsx', text);

if (failures.length) {
  console.error('无限共享仓库/冻结周期自动经营防回退检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('无限共享仓库/冻结周期自动经营防回退检查通过：原料保障使用真实冻结库存；建筑周期完成后按正利润补货并出售全部非冻结商品。');
