import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!existsSync(resolve(root, path)) || !read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (existsSync(resolve(root, path)) && read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

for (const path of [
  'server/src/auto-operation-profit.js',
  'server/src/cycle-auto-operation.js',
  'server/src/inventory-freezes.js',
  'server/src/factory-auto-operation.js',
  'server/src/online-auto-buy.js',
  'server/src/online-auto-sell.js',
  'server/src/production-input-sourcing.js',
  'server/src/commercial-buildings.js',
  'server/src/runtime-action-executor.js',
  'server/src/warehouse.js',
  'server/test/online-auto-buy.test.js',
  'server/test/online-auto-sell.test.js',
  'src/components/facilities/FacilityAutoOperationControls.tsx',
  'src/pages/production/ProductionFacilityDetail.tsx',
  'src/pages/MarketPage.tsx',
  'src/utils/inventoryFreezeBreakdown.ts',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
]) requireFile(path);

for (const text of [
  'evaluateProductionCycleProfit',
  'profitMicros > 0n',
  'calculateCumulativeMarketSellFee',
  'evaluateCommercialCycleProfit',
]) requireText('server/src/auto-operation-profit.js', text);

for (const text of [
  'runCycleAutoOperation',
  'descriptorProfitable',
  'purchaseMissingFreeze',
  'setInventoryFreezeTarget',
  'sellAllAvailable',
  "execution: 'cycle-auto-operation'",
  'commoditySystemPriceFor',
]) requireText('server/src/cycle-auto-operation.js', text);

for (const text of [
  'ensureInventoryFreezeSources',
  'sourceFrozenQuantity',
  'setInventoryFreezeTarget',
  'thawInventoryFreeze',
  'consumeInventoryFreeze',
  'releaseInventoryFreezeSource',
  'createInventoryFreezeClientState',
]) requireText('server/src/inventory-freezes.js', text);

for (const text of [
  '周期完成时由服务器统一结算',
]) {
  requireText('server/src/online-auto-buy.js', text);
  requireText('server/src/online-auto-sell.js', text);
}
forbidText('server/src/online-auto-buy.js', 'applySettledCommodityOrder');
forbidText('server/src/online-auto-sell.js', 'applySettledCommodityOrder');

for (const text of [
  'thawProductionGuarantee',
  'runCycleAutoOperation',
  'finalizeProductionOutputContracts',
]) requireText('server/src/production-input-sourcing.js', text);
forbidText('server/src/production-input-sourcing.js', 'applyImmediateCommodityBuy');

for (const text of [
  'consumeInventoryFreeze',
  'runCycleAutoOperation',
  'releaseInventoryFreezeSource',
  '周期完成时执行',
]) requireText('server/src/commercial-buildings.js', text);

for (const text of [
  'createInventoryFreezeClientState(player)',
  'createFactoryAutoOperationClientState(player)',
]) requireText('server/src/warehouse.js', text);

for (const text of [
  'inventoryFreezeBreakdown',
  '生产冻结',
  '经营冻结',
  '合同冻结',
  '拍卖冻结',
  '其他冻结',
]) requireText('src/utils/inventoryFreezeBreakdown.ts', text);
for (const text of [
  'market-freeze-inventory-value',
  'title={freezeBreakdownTitle}',
  '冻结库存',
]) requireText('src/pages/MarketPage.tsx', text);
for (const text of ['保障目标', '保障缺口']) forbidText('src/pages/MarketPage.tsx', text);

for (const text of [
  '自动经营',
  'GameConcept',
  'void save(nextPolicy);',
]) requireText('src/components/facilities/FacilityAutoOperationControls.tsx', text);
for (const text of ['经营模式', '产成品处理', '利润优先', '保供优先', '全部保留']) forbidText('src/components/facilities/FacilityAutoOperationControls.tsx', text);
for (const text of ['GameConcept concept="input-coverage"', '原料保障']) requireText('src/pages/production/ProductionFacilityDetail.tsx', text);

for (const text of [
  'legacy online auto-buy entry no longer trades outside a completed building cycle',
  'completed profitable production cycle purchases missing coverage and freezes it to production',
]) requireText('server/test/online-auto-buy.test.js', text);
for (const text of [
  'legacy online auto-sell entry no longer trades outside a completed building cycle',
  'completed profitable cycle sells every available item while leaving frozen goods untouched',
]) requireText('server/test/online-auto-sell.test.js', text);

if (failures.length) {
  console.error('建筑周期自动经营防回退检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('建筑周期自动经营防回退检查通过：只有周期完成后才评估严格正利润、补足真实冻结原料并出售全部非冻结商品；旧在线入口不再即时交易。');
