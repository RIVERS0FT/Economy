import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const requireText = (path, text) => assert.ok(read(path).includes(text), `${path} 缺少 ${text}`);
const forbidText = (path, text) => assert.ok(!read(path).includes(text), `${path} 不得恢复 ${text}`);

// Behavior belongs to integration tests, not duplicated price constants or paragraph wording.
for (const path of ['server/test/cycle-auto-operation.test.js', 'server/test/commodity-freezes.test.js',
  'server/test/building-shared-inventory.test.js', 'server/test/commercial-auto-operation.test.js']) {
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
}
for (const token of ['quoteBuildingAutoProcurement', 'netProfitMicros <= 0n', 'calculateCumulativeMarketSellFee',
  'reconcileBuildingInputFreezes', 'freezeCommodity', 'autoOperationCycleCursors', 'applySettledCommodityOrder',
  'provinceAutoSaleEnabled', 'quotePreparedDailySupply', 'consumePreparedDailySupply']) {
  requireText('server/src/cycle-auto-operation.js', token);
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
for (const text of ['经营模式', '产成品处理', '保存自动经营策略']) {
  forbidText('src/components/facilities/FacilityAutoOperationControls.tsx', text);
}
requireText('src/components/buildings/ProvinceAutoSaleControl.tsx', '出售本地区非冻结商品');
requireText('src/auto-trade/useOnlineAutoTrade.ts', 'state.saveEpoch !== saveEpoch');
console.log('周期自动经营检查通过：完成事件唯一触发，利润计费，来源冻结，地区出售显式启用，客户端只读。');
