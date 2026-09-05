import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!existsSync(resolve(root, path)) || !read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (existsSync(resolve(root, path)) && read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

for (const path of [
  'server/src/factory-auto-operation.js',
  'server/src/online-auto-buy.js',
  'server/src/online-auto-sell.js',
  'server/src/online-auto-trade-policy.js',
  'server/src/runtime-action-executor.js',
  'server/src/player-action-registry.js',
  'server/src/warehouse.js',
  'server/test/factory-auto-operation.test.js',
  'server/test/online-auto-buy.test.js',
  'server/test/online-auto-sell.test.js',
  'src/components/facilities/FacilityAutoOperationControls.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
  'src/components/market/MarketAutoTradePanel.tsx',
  'src/auto-trade/useOnlineAutoTrade.ts',
  'src/api/game.ts',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
]) requireFile(path);

for (const text of [
  "inputCoverageCycles: 2",
  "mode: 'balanced'",
  "outputMode: 'surplus'",
  "const COVERAGE_CYCLES = new Set([1, 2, 3, 5])",
  "profit: Object.freeze({ buy: 0.95, sell: 1.1 })",
  "balanced: Object.freeze({ buy: 1.05, sell: 1 })",
  "supply: Object.freeze({ buy: 1.15, sell: 0.95 })",
  'perCycle * Math.max(0, policy.inputCoverageCycles - 1)',
  'intent.buyPrice = Math.max(intent.buyPrice',
  'intent.sellPrice = Math.max(intent.sellPrice',
  "if (policy.outputMode === 'keep') intent.keepOutput = true",
  'const sellEnabled = intent.sellEnabled && !intent.keepOutput',
  'if (intent.buyEnabled && sellEnabled && sellPrice <= buyPrice)',
  'factoryAutoTradeExecutionPolicyFor',
  'createFactoryAutoTradeExecutionClientState',
  'applyFactoryAutoOperationPolicyAction',
]) requireText('server/src/factory-auto-operation.js', text);

for (const text of [
  'factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.buy',
  'commoditySystemPriceFor(world, productId, provinceId, now)',
  'officialPrice > policy.maxPrice',
  'desiredQuantity(world, player, productId, policy, provinceId)',
  'affordableQuantity(player, officialPrice, desired)',
  'applySettledCommodityOrder(world, user',
  "execution: 'online-auto-buy'",
  '已按今日系统价',
]) requireText('server/src/online-auto-buy.js', text);
for (const text of [
  'managedOnlineAutoBuyOrderFor',
  'cancelManagedOnlineAutoBuyOrder',
  'onlineAutoBuyManagedOrderIds',
]) forbidText('server/src/online-auto-buy.js', text);

for (const text of [
  'factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.sell',
  'commoditySystemPriceFor(world, productId, provinceId, now)',
  'officialPrice < policy.price',
  'buildingReservedQuantitiesForPlayer',
  'contractAvailableHoldForOnlineTrade',
  'applySettledCommodityOrder(world, user',
  "execution: 'online-auto-sell'",
  '已按今日系统价',
]) requireText('server/src/online-auto-sell.js', text);
for (const text of [
  'managedOnlineAutoSellOrderFor',
  'cancelManagedOnlineAutoSellOrder',
  'onlineAutoSellManagedOrderIds',
]) forbidText('server/src/online-auto-sell.js', text);

for (const [path, texts] of [
  ['server/src/runtime-action-executor.js', [
    "payload.execution === 'factory-auto-operation-policy'",
    'rebuildFactoryAutoTradePoliciesForProvince',
    'requirePlayerActionMetadata(action)',
  ]],
  ['server/src/player-action-registry.js', [
    "buildFacility: defineAction({ mutationScope: 'factory'",
    "startFacility: defineAction({ mutationScope: 'factory'",
    "pauseFacility: defineAction({ mutationScope: 'factory'",
    "setFacilityRecipe: defineAction({ mutationScope: 'factory'",
    "'factory-auto-operation-policy': defineOrderExecution('factory-policy'",
  ]],
  ['server/src/warehouse.js', [
    'createFactoryAutoTradeExecutionClientState(player)',
    'createFactoryAutoOperationClientState(player)',
  ]],
  ['src/auto-trade/useOnlineAutoTrade.ts', [
    'function productOfficialPrice(',
    'const buyPriceEligible = officialPrice <= buyPolicy.maxPrice;',
    'const sellPriceEligible = officialPrice >= sellPolicy.price;',
    'buyNeedsMaintenance',
    'sellNeedsMaintenance',
    "['catalog', 'player.assets', 'player.production', 'market.quotes', 'contract']",
  ]],
  ['src/api/game.ts', [
    'FactoryAutoOperationPolicyInput',
    'saveFactoryAutoOperationPolicy',
    "execution: 'factory-auto-operation-policy'",
  ]],
  ['src/components/facilities/FacilityAutoOperationControls.tsx', [
    '自动经营',
    'GameConcept',
    'const updatePolicy',
    'void save(nextPolicy);',
  ]],
  ['src/pages/production/ProductionFacilityDetail.tsx', [
    '原料保障',
    'FacilityAutoOperationControls',
    'GameConcept concept="input-coverage"',
  ]],
  ['src/components/market/MarketAutoTradePanel.tsx', [
    '自动经营执行',
    '由工厂策略汇总',
    '预计自动采购',
    '预计自动出售',
    '采购价格上限',
    '出售价格下限',
  ]],
]) {
  for (const text of texts) requireText(path, text);
}
for (const text of [
  '保存自动经营策略',
  '系统仍通过本州统一商品订单簿执行真实买卖；合同保留与其他工厂的原料需求会一起计算，不创建工厂专属订单簿。',
]) forbidText('src/components/facilities/FacilityAutoOperationControls.tsx', text);
for (const text of ['经营模式', '产成品处理', '利润优先', '保供优先', '满足内部需求后出售', '全部保留']) {
  forbidText('src/components/facilities/FacilityAutoOperationControls.tsx', text);
}
for (const text of [
  'getClientOrderIndex(',
  'managedCommodityOrder(',
  'hasCrossingCommodityOrder(',
  'onlineAutoBuyManagedOrderIds',
  'onlineAutoSellManagedOrderIds',
  'market.orders',
]) forbidText('src/auto-trade/useOnlineAutoTrade.ts', text);

for (const text of [
  'MoneyInput',
  'IntegerInput',
  '保存自动交易设置',
  '目标自由库存',
  '最低自由库存',
  '设置自动交易',
]) forbidText('src/components/market/MarketAutoTradePanel.tsx', text);

for (const text of [
  '地区商品详情不再渲染“自动经营执行”卡或逐商品执行摘要',
  '工业和商业详情是各自自动经营策略与执行解释的唯一玩家界面',
  'inputCoverageCycles: 1 | 2 | 3 | 5',
  '自动经营 = 开启',
  '原料保障 = 2 个生产周期',
  '`profit` 利润优先',
  '`balanced` 均衡',
  '`supply` 保供优先',
  '同一商品被多个工厂消费时采用最高采购上限',
  '任一自动经营生产者对某商品选择 `keep` 全部保留',
  '出售价格下限必须严格高于采购价格上限',
  '不改成服务器后台常驻扫描任务',
  '旧 `onlineAutoBuyPolicies`、`onlineAutoSellPolicies`',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);
for (const text of [
  '不再维护 managed-order ID',
  '自动采购：当日 `officialPrice <= 采购最高价`',
  '自动出售：当日 `officialPrice >= 出售最低价`',
]) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);

for (const text of [
  'applyOnlineAutoSellPolicyAction(world, alice',
  'applyOnlineAutoTradePolicyAction(world, alice',
  'setAutoSellPolicy(',
]) forbidText('server/test/online-auto-sell.test.js', text);
forbidText('server/test/online-auto-buy.test.js', 'applyOnlineAutoTradePolicyAction(world, alice');
forbidText('server/src/runtime-action-executor.js', 'factoryAutoOperationRebuild');

requireText('server/src/building-input-reservations.js', 'productionReservedQuantitiesForPlayer(world, userId, provinceId)');
requireText('server/src/building-input-reservations.js', 'commercialInputReservations');

if (failures.length) {
  console.error('工厂自动经营防回退检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('工厂自动经营防回退检查通过：工厂策略继续统一派生采购/出售阈值，在线客户端按当日官方系统价和库存缺口触发服务器即时交易，不再维护玩家托管挂单。');
