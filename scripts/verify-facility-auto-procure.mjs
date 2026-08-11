import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];
const requireText = (relativePath, text) => {
  if (!read(relativePath).includes(text)) failures.push(`${relativePath} 缺少：${text}`);
};
const forbidText = (relativePath, text) => {
  if (read(relativePath).includes(text)) failures.push(`${relativePath} 不应包含：${text}`);
};

for (const [file, texts] of Object.entries({
  'server/src/facility-auto-procure.js': [
    'autoProcureFacilityBuildMaterials',
    'materialPriceCaps',
    'maxProcurementTotal',
    'findSelfCrossingOrder',
    'applyImmediateCommodityBuy',
    '市场卖盘不足，无法一次购齐',
    'createFacilityBuildProcurementOrders',
    'cancelFacilityBuildProcurementOrders',
    'materialOrderPrices',
    'countOpenOrdersForOwner',
    'ECONOMY_CONSTANTS.maxOpenOrders',
    "applyAction(world, user, 'placeOrder'",
    'procurementGroup',
    '已成交材料保留在仓库',
  ],
  'server/src/domain.js': [
    "payload.execution === 'fill-or-kill'",
    "const transientExecution = fillOrKill || onlineAutoSell || onlineAutoBuy;",
    '!transientExecution && countOpenOrdersForOwner',
    'export function applyImmediateCommodityBuy',
    '市场卖盘已变化，未能一次购齐',
  ],
  'server/src/runtime-action-executor.js': [
    "action === 'buildFacility' && payload.autoProcure === true",
    'autoProcureFacilityBuildMaterials(world, user, payload, now)',
    '已一键购齐 ${procurement.purchasedQuantity} 件建造材料',
    "payload.execution === 'facility-build-procurement'",
    "payload.execution === 'facility-build-procurement-cancel'",
    'createFacilityBuildProcurementOrders(world, user, payload, now)',
    'cancelFacilityBuildProcurementOrders(world, user, payload, now)',
    'result?.procurementGroup',
  ],
  'src/api/game.ts': [
    'export interface FacilityBuildProcurementOptions',
    'maxProcurementTotal: number;',
    'materialPriceCaps: Record<string, number>;',
    "postAction('/facilities', { facilityTypeId, quantity, ...procurement })",
    'FacilityBuildProcurementActionResponse',
    'createFacilityBuildProcurement',
    'cancelFacilityBuildProcurement',
    "execution: 'facility-build-procurement'",
    "execution: 'facility-build-procurement-cancel'",
  ],
  'src/utils/facilityBuildProcurement.ts': [
    'quoteFacilityBuildProcurement',
    'selfCrossingProductIds',
    'materialPriceCaps',
    'materialOrderPrices',
    'defaultFacilityBuildOrderPrice',
  ],
  'src/utils/facilityBuildProcurementGroups.ts': [
    'activeFacilityBuildProcurementGroups',
    'facility-build-procurements',
    'market orders remain server-authoritative',
  ],
  'src/pages/ProductionPage.tsx': [
    'quoteFacilityBuildProcurement(game.orders, missingBuildMaterials)',
    'openOrderLimitForCatalog(game.products.length, game.facilityTypes.length)',
    'label="库存可直接建"',
    'label="预计采购"',
    'label="预计总支出"',
    '一键购齐并建造',
    'autoProcure: true',
    'maxProcurementTotal: procurementQuote.estimatedTotal',
    'materialPriceCaps: procurementQuote.materialPriceCaps',
    'MoneyInput',
    '买单最高占用',
    '一键提交',
    '待采购',
    '取消全部',
    'createFacilityBuildProcurement',
    'cancelFacilityBuildProcurement',
    'reference.quantity - Math.max(0, Number(order.remaining || 0))',
  ],
  'server/test/instant-facility-construction.test.js': [
    'buys every missing material from the real order book and stays idempotent',
    'rolls back completely when market depth cannot fill every missing material',
    'rejects stale price protection without buying anything',
    'ignores legacy warehouse capacity fields during market delivery',
  ],
  'server/test/facility-build-procurement-orders.test.js': [
    'insufficient sell depth creates one build procurement group with ordinary partial buy orders',
    'cancelling a build procurement group releases only unfilled funds and keeps purchased materials',
    'invalid grouped material prices fail before creating any buy order',
    "execution: 'facility-build-procurement'",
    "execution: 'facility-build-procurement-cancel'",
    "path: '/api/game/orders'",
  ],
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md': [
    '一键购齐并建造',
    '全部采购与建设一起回滚',
    '缺料买单',
    '不得自动建厂',
  ],
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md': [
    '建厂一键购料',
    'Fill-or-Kill',
    'facility-build-procurement',
    '建造采购组',
    '(PRODUCT_CATALOG.length + FACILITY_TYPE_CATALOG.length) * 10',
  ],
  'docs/WAREHOUSE_EXPANSION_DESIGN.md': ['“一键购齐并建造”', '同样不检查仓库空间'],
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md': [
    '库存可直接建',
    '一键购齐并建造',
    '一键提交缺料买单',
    '待采购',
    '商品类型数与工厂类型数之和的 10 倍',
  ],
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md': [
    'facility-auto-procure.js',
    'maxProcurementTotal',
    'materialPriceCaps',
    'facility-build-procurement',
    'facility-build-procurement-cancel',
  ],
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md': ['“一键购齐并建造”仍属于即时建设'],
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md': ['一键购齐并建造不会产生施工任务'],
  'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md': ['一键购齐并建造同样不注册施工截止时间'],
  'docs/README.md': ['缺料且当前卖盘足够时允许在同一建造事务内执行真实统一订单簿 FOK 采购', '缺料买单'],
  'README.md': ['缺料且当前卖盘足够时可继续一键从真实统一订单簿 FOK 购齐后建造', '缺料买单'],
})) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`缺少文件：${file}`);
    continue;
  }
  for (const text of texts) requireText(file, text);
}

requireText('package.json', '"verify:facility-auto-procure": "node scripts/verify-facility-auto-procure.mjs"');
requireText('package.json', 'npm run verify:facility-auto-procure');

for (const text of ['createWarehouseUsage', 'warehouseAvailableCapacity', '共享仓库空间不足']) {
  forbidText('server/src/facility-auto-procure.js', text);
}
for (const text of ['/facilities/procurements', '/facilities/procurements/cancel']) {
  forbidText('server/src/game-routes.js', text);
  forbidText('src/api/game.ts', text);
}
forbidText('server/test/instant-facility-construction.test.js', 'still requires warehouse space for market delivery');
forbidText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '资金或仓库不足');
forbidText('docs/README.md', '仓库临时交割');
forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '临时交割空间');

if (failures.length > 0) {
  for (const failure of failures) console.error(`facility auto-procure verification failed: ${failure}`);
  process.exitCode = 1;
} else {
  console.log('facility one-click procurement verification passed');
}
