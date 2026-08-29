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
  'server/src/online-auto-buy-orders.js',
  'server/src/online-auto-sell-orders.js',
  'server/src/runtime-action-executor.js',
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

for (const [path, texts] of [
  ['server/src/online-auto-buy.js', [
    'factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.buy',
    '当前工厂策略无需自动采购该商品',
    'managedOnlineAutoBuyOrderFor',
    'countOpenOrdersForOwner',
  ]],
  ['server/src/online-auto-sell.js', [
    'factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.sell',
    '当前工厂策略无需自动出售该商品',
    'productionReservedQuantitiesForPlayer',
    'contractAvailableHoldForOnlineTrade',
    'managedOnlineAutoSellOrderFor',
  ]],
  ['server/src/runtime-action-executor.js', [
    "payload.execution === 'factory-auto-operation-policy'",
    'rebuildFactoryAutoTradePoliciesForProvince',
    "'factoryAutoOperationRebuild'",
  ]],
  ['server/src/warehouse.js', [
    'createFactoryAutoTradeExecutionClientState(player)',
    'factoryAutoOperationPolicies',
  ]],
  ['src/api/game.ts', [
    'FactoryAutoOperationPolicyInput',
    'saveFactoryAutoOperationPolicy',
    "execution: 'factory-auto-operation-policy'",
  ]],
  ['src/components/facilities/FacilityAutoOperationControls.tsx', [
    '自动经营',
    '原料保障',
    '经营模式',
    '产成品处理',
    '保存自动经营策略',
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
  'MoneyInput',
  'IntegerInput',
  '保存自动交易设置',
  '目标自由库存',
  '最低自由库存',
  '设置自动交易',
]) forbidText('src/components/market/MarketAutoTradePanel.tsx', text);

for (const text of [
  '自动经营配置唯一归属工厂详情',
  '地区商品详情只读展示',
  'inputCoverageCycles: 1 | 2 | 3 | 5',
  '自动经营 = 开启',
  '原料保障 = 2 个生产周期',
  '`profit` 利润优先',
  '`balanced` 均衡',
  '`supply` 保供优先',
  '同一商品被多个工厂消费时采用最高采购上限',
  '任一自动经营生产者对某商品选择 `keep` 全部保留',
  '出售价格下限必须严格高于采购价格上限',
  '每个“玩家 + 地区 + 商品”最多维护一张关联自动买单和一张关联自动卖单',
  '不改成服务器后台常驻扫描任务',
  '旧 `onlineAutoBuyPolicies`、`onlineAutoSellPolicies`',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  'applyOnlineAutoSellPolicyAction(world, alice',
  'applyOnlineAutoTradePolicyAction(world, alice',
  'setAutoSellPolicy(',
]) forbidText('server/test/online-auto-sell.test.js', text);
forbidText('server/test/online-auto-buy.test.js', 'applyOnlineAutoTradePolicyAction(world, alice');

if (failures.length) {
  console.error('工厂自动经营防回退检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('工厂自动经营防回退检查通过');
