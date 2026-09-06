import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const requireText = (path, text) => assert.ok(read(path).includes(text), `${path} 缺少 ${text}`);
const forbidText = (path, text) => assert.ok(!read(path).includes(text), `${path} 不得恢复 ${text}`);

// Behavior belongs to integration tests, not duplicated price constants or paragraph wording.
for (const path of ['server/test/cycle-auto-operation.test.js', 'server/test/commodity-freezes.test.js',
  'server/test/building-shared-inventory.test.js', 'server/test/commercial-auto-operation.test.js',
  'server/test/first-building-auto-start.test.js']) {
  assert.ok(existsSync(path), `缺少周期与冻结行为回归 ${path}`);
}
for (const path of ['server/src/online-auto-buy.js', 'server/src/online-auto-sell.js']) {
  requireText(path, '仅在服务器确认周期完成时执行');
  forbidText(path, 'applySettledCommodityOrder(');
}
for (const token of ['model.onlineAutoBuy(', 'model.onlineAutoSell(', 'setInterval(', 'setTimeout(']) {
  forbidText('src/auto-trade/useOnlineAutoTrade.ts', token);
}
for (const path of ['server/src/production-settlement.js', 'server/src/facility-groups.js', 'server/src/commercial-buildings.js']) {
  requireText(path, 'completeBuildingCycleAutoOperation');
  requireText(path, 'bootstrapBuildingAutoOperation');
}
for (const path of ['server/src/cycle-auto-operation.js', 'server/src/facility-groups.js', 'server/src/commercial-buildings.js', 'server/src/production-settlement.js']) {
  requireText(path, 'autoOperationBootstrapPending');
}
for (const token of ['quoteBuildingAutoProcurement', 'netProfitMicros <= 0n', 'calculateCumulativeMarketSellFee',
  'reconcileBuildingInputFreezes', 'freezeCommodity', 'autoOperationCycleCursors', 'applySettledCommodityOrder',
  'quotePreparedDailySupply', 'consumePreparedDailySupply', 'bootstrapBuildingAutoOperation',
  'initialOnly: true', "executionPrefix: 'bootstrap-auto'", '__suppressInitialAutoOperationBootstrap']) {
  requireText('server/src/cycle-auto-operation.js', token);
}
for (const token of ["action === 'pauseFacility'", "action === 'setFacilityRecipe'", "action === 'setFacilityRecipes'",
  "payload?.execution === 'factory-auto-operation-policy'", "payload?.operation === 'stop'", "payload?.operation === 'auto-operation'",
  '__suppressInitialAutoOperationBootstrap']) {
  requireText('server/src/runtime-action-executor.js', token);
}
for (const token of ['首周期原料 bootstrap', '不出售地区商品', '不写 `autoOperationCycleCursors`', '后续权威推进可以重新尝试']) {
  requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', token);
}
for (const token of ['首次建设默认开启营业意图', '玩家已手动停止的集群不得因扩建自动重启']) {
  requireText('docs/COMMERCIAL_BUILDINGS_DESIGN.md', token);
}
for (const token of ['默认开启运行意图 `enabled = true`', '首次建设后默认保持停止', '玩家正在关闭运行、切换配方或关闭／修改自动经营策略的动作前置结算不得抢先触发 bootstrap']) {
  requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', token);
}
for (const token of ['MODE_PRICE_MULTIPLIERS', 'intent.keepOutput', 'intent.extraProtected']) {
  forbidText('server/src/factory-auto-operation.js', token);
}
requireText('server/src/warehouse.js', 'createCommodityFreezeClientState(player)');
requireText('server/shared/economy-state-slices.js', "'inventoryFreezeDetails'");
requireText('server/src/economic-mutation.js', 'assertCommodityFreezeInvariant');
requireText('src/pages/MarketPage.tsx', '<CommodityFreezeDisclosure');
requireText('src/components/market/CommodityFreezeDisclosure.tsx', 'SafeTooltip');
requireText('src/components/market/CommodityFreezeDisclosure.tsx', 'aria-expanded={expanded}');
for (const token of ['保障目标', '缺口']) forbidText('src/components/market/CommodityFreezeDisclosure.tsx', token);
forbidText('src/pages/MarketPage.tsx', '<MarketAutoTradePanel');
assert.ok(!existsSync('src/components/market/MarketAutoTradePanel.tsx'), '退役自动交易展示组件不得继续保留死代码');
forbidText('src/pages/MarketPage.tsx', 'MarketContractSummary');
assert.ok(!existsSync('src/components/market/MarketContractSummary.tsx'), '商品详情合同简要组件必须删除');
for (const text of ['经营模式', '产成品处理', '保存自动经营策略']) {
  forbidText('src/components/facilities/FacilityAutoOperationControls.tsx', text);
}
assert.ok(!existsSync('src/components/buildings/ProvinceAutoSaleControl.tsx'), '不得保留独立地区自动出售开关');
forbidText('src/components/buildings/BuildingAutoOperationSection.tsx', 'ProvinceAutoSaleControl');
forbidText('src/api/game.ts', 'saveProvinceAutoSalePolicy');
forbidText('server/src/cycle-auto-operation.js', 'provinceAutoSaleEnabled');
requireText('server/src/world-storage-v2.js', 'autoSaleRegions');
forbidText('server/src/world-storage-v2.js', 'player.provinceAutoSaleEnabled?.[provinceId]');
requireText('src/auto-trade/useOnlineAutoTrade.ts', 'state.saveEpoch !== saveEpoch');
console.log('周期自动经营检查通过：首周期 bootstrap 仅限首次建设待处理标记，只采购且不伪造完成，停止/配置动作不会抢先采购，常规出售与后续采购仍由真实完成事件驱动。');
