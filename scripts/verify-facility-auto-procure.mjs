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
  ],
  'server/src/domain.js': [
    "payload.execution === 'fill-or-kill'",
    "const transientExecution = fillOrKill || onlineAutoSell;",
    '!transientExecution && countOpenOrdersForOwner',
    'export function applyImmediateCommodityBuy',
    '市场卖盘已变化，未能一次购齐',
  ],
  'server/src/runtime-action-executor.js': [
    "action === 'buildFacility' && payload.autoProcure === true",
    'autoProcureFacilityBuildMaterials(world, user, payload, now)',
    '已一键购齐 ${procurement.purchasedQuantity} 件建造材料',
  ],
  'src/api/game.ts': [
    'export interface FacilityBuildProcurementOptions',
    'maxProcurementTotal: number;',
    'materialPriceCaps: Record<string, number>;',
    "postAction('/facilities', { facilityTypeId, quantity, ...procurement })",
  ],
  'src/utils/facilityBuildProcurement.ts': [
    'quoteFacilityBuildProcurement',
    'selfCrossingProductIds',
    'materialPriceCaps',
  ],
  'src/pages/ProductionPage.tsx': [
    'quoteFacilityBuildProcurement(game.orders, missingBuildMaterials)',
    'label="库存可直接建"',
    'label="预计采购"',
    'label="预计总支出"',
    '一键购齐并建造',
    'autoProcure: true',
    'maxProcurementTotal: procurementQuote.estimatedTotal',
    'materialPriceCaps: procurementQuote.materialPriceCaps',
  ],
  'server/test/instant-facility-construction.test.js': [
    'buys every missing material from the real order book and stays idempotent',
    'rolls back completely when market depth cannot fill every missing material',
    'rejects stale price protection without buying anything',
    'ignores legacy warehouse capacity fields during market delivery',
  ],
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md': ['一键购齐并建造', '全部采购与建设一起回滚'],
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md': ['建厂一键购料', 'Fill-or-Kill'],
  'docs/WAREHOUSE_EXPANSION_DESIGN.md': ['“一键购齐并建造”', '同样不检查仓库空间'],
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md': ['库存可直接建', '一键购齐并建造'],
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md': ['facility-auto-procure.js', 'maxProcurementTotal', 'materialPriceCaps'],
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md': ['“一键购齐并建造”仍属于即时建设'],
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md': ['一键购齐并建造不会产生施工任务'],
  'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md': ['一键购齐并建造同样不注册施工截止时间'],
  'docs/README.md': ['缺料时允许在同一建造事务内执行真实统一订单簿 FOK 采购'],
  'README.md': ['缺料时可一键从真实统一订单簿购齐后建造'],
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
