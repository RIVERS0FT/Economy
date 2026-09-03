import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少：${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含：${text}`); };

for (const text of [
  'createFacilityBuildProcurementQuote',
  'facilityBuildContext(world, user, payload, { readOnly: true })',
  'quoteMissingAtDailyPrice',
  'commoditySystemPriceFor(world, item.productId, provinceId, now)',
  'materialPriceCaps[item.productId] = price',
  'estimatedTotal',
  'validateProtectedQuote',
  'price > cap',
  'ensureBuildAndProcurementFunds',
  'executeImmediatePlans',
  'applyImmediateCommodityBuy(world, user',
  'autoProcureFacilityBuildMaterials',
  '建造材料已按今日系统价一次购齐',
  '现已即时采购，不存在待取消挂单',
]) requireText('server/src/facility-auto-procure.js', text);
for (const text of [
  'matchingCommodityOrders',
  'findSelfCrossingOrder',
  'countOpenOrdersForOwner',
  'ECONOMY_CONSTANTS.maxOpenOrders',
  "applyAction(world, user, 'placeOrder'",
  'procurementGroup',
  '市场卖盘不足',
]) forbidText('server/src/facility-auto-procure.js', text);

for (const text of [
  "action === 'buildFacility' && payload.autoProcure === true",
  'autoProcureFacilityBuildMaterials(world, user, payload, now)',
  '已一键购齐 ${procurement.purchasedQuantity} 件建造材料',
]) requireText('server/src/runtime-action-executor.js', text);

for (const text of [
  'getFacilityBuildProcurementQuote',
  'procurementQuoteLoading',
  'controller.abort()',
  'label="库存可直接建"',
  'label="预计采购"',
  'label="预计总支出"',
  '一键购齐并建造',
  'autoProcure: true',
  'maxProcurementTotal: procurementQuote.estimatedTotal',
  'materialPriceCaps: procurementQuote.materialPriceCaps',
  '按建造州各缺失材料的当日官方系统价即时购齐并建造',
  '不产生待成交商品订单',
]) requireText('src/pages/BuildingsPage.tsx', text);
for (const text of [
  'MoneyInput',
  '买单价格',
  '买单最高占用',
  '一键提交',
  '待采购',
  '取消全部',
  'createFacilityBuildProcurement(',
  'cancelFacilityBuildProcurement(',
  'openOrderLimitForCatalog',
  'crossingSellOrderIds',
  'procurementGroups',
]) forbidText('src/pages/BuildingsPage.tsx', text);

for (const [path, tokens] of [
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', [
    '“一键购齐并建造”只补足当前库存缺少的正式 `buildInputs`',
    '当日 `officialPrice`',
    '任一材料价格超过保护值、资金不足或随后建设失败时全部回滚',
    '不创建 FOK、开放买单或系统材料商店',
  ]],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [
    '建厂一键购料使用同州当前 `officialPrice`',
    '不读取玩家盘口深度，不创建 FOK 或普通商品挂单',
    '全部缺失材料的即时购买与建厂继续处于同一原子事务',
  ]],
  ['docs/WAREHOUSE_EXPANSION_DESIGN.md', [
    '“一键购齐并建造”按建造州各缺失材料的当日 `officialPrice` 即时购齐',
    '不创建 FOK 或开放商品买单',
  ]],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
    '报价按各缺失材料当日 `officialPrice` 显示逐材料缺口、成交价和采购总额',
    '不创建 FOK、开放商品挂单或待采购订单组',
  ]],
]) {
  for (const token of tokens) requireText(path, token);
}

requireText('server/test/facility-build-quote.test.js', 'official-price missing-material quote is read-only and complete');
for (const text of [
  'one-click construction buys every missing material from the daily official price and stays idempotent',
  'one-click construction rejects stale daily-price protection atomically',
  'one-click construction rolls back when total funds cannot cover build plus official-price procurement',
  'one-click construction ignores legacy warehouse capacity fields during official-price procurement',
]) requireText('server/test/instant-facility-construction.test.js', text);

if (failures.length) {
  failures.forEach((failure) => console.error(`facility auto-procure verification failed: ${failure}`));
  process.exit(1);
}
console.log('facility one-click procurement verification passed: building materials use the state daily official price atomically and never create player resting orders.');
