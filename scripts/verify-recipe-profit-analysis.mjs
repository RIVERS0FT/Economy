import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeRecipeProfit } from '../src/utils/recipeProfitAnalysis.ts';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function market(productId, lastTradePrice, lastPrice = 999) {
  return { productId, lastPrice, lastTradePrice, priceHistory: [], demand: {} };
}

const recipe = {
  id: 'food-production',
  name: '生产食品',
  cycleMs: 60_000,
  operatingCost: 2,
  inputs: [{ productId: 'wheat', quantity: 2 }],
  output: { productId: 'food', quantity: 2 },
};
const markets = {
  wheat: market('wheat', 3, 100),
  food: market('food', 12, 200),
};

const cluster = analyzeRecipeProfit({ recipe, scopeCount: 2, markets, buildCost: 50 });
assert.equal(cluster.inputMarketCost, 12);
assert.equal(cluster.outputMarketValue, 48);
assert.equal(cluster.operatingCost, 4);
assert.equal(cluster.cycleProfit, 32);
assert.equal(cluster.profitPerMinute, 32);
assert.equal(cluster.inputs[0].lastTradePrice, 3, '不得回退到 lastPrice');

const singleFactory = analyzeRecipeProfit({ recipe, scopeCount: 1, markets, buildCost: 50 });
assert.equal(singleFactory.inputMarketCost, 6);
assert.equal(singleFactory.outputMarketValue, 24);
assert.equal(singleFactory.operatingCost, 2);
assert.equal(singleFactory.cycleProfit, 16);
assert.equal(singleFactory.profitPerMinute, 16, '界面单厂平均利润必须固定按一座工厂计算');

const changedInventoryAndOrders = analyzeRecipeProfit({
  recipe,
  scopeCount: 1,
  markets,
  buildCost: 50,
  inventories: { wheat: { available: 0, frozen: 999_999 } },
  orders: [],
});
assert.deepEqual(changedInventoryAndOrders, singleFactory, '库存与公开挂单不得影响单厂平均利润');

const missingPrice = analyzeRecipeProfit({
  recipe,
  scopeCount: 1,
  markets: { wheat: market('wheat', null, 3), food: market('food', 12) },
  buildCost: 50,
});
assert.equal(missingPrice.profitPerMinute, null);
assert.deepEqual(missingPrice.missingPriceProductIds, ['wheat']);

const noInput = analyzeRecipeProfit({
  recipe: {
    id: 'farm-production',
    name: '种植小麦',
    cycleMs: 120_000,
    operatingCost: 6,
    inputs: [],
    output: { productId: 'wheat', quantity: 4 },
  },
  scopeCount: 1,
  markets: { wheat: market('wheat', 2) },
  buildCost: 50,
});
assert.equal(noInput.inputMarketCost, 0);
assert.equal(noInput.profitPerMinute, 1);

const analysisSource = read('src/components/facilities/FacilityRecipeProfitAnalysis.tsx');
const contextSource = read('src/components/facilities/FacilityRecipeProfitContext.tsx');
const routerSource = read('src/pages/PageRouter.tsx');
const styleSource = read('src/styles/facility-recipe-profit-analysis.css');
const surfaceSource = read('src/styles/production-surface.css');
const sheetSource = read('src/styles/facility-detail-sheet.css');
const designSource = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');

for (const text of [
  '单厂平均利润／分钟',
  'scopeCount: scopeCount > 0 ? 1 : 0',
  '最近真实成交价',
  '不计玩家库存、挂单深度和交易手续费',
]) assert.ok(analysisSource.includes(text), `单厂平均利润界面缺少: ${text}`);
for (const removedText of [
  '市场利润分析',
  '原料市场成本',
  '产出市场价值',
  '周期运营成本',
  '单周期利润',
  '静态建造回本',
  '预计盈利',
  '最近成交价明细',
]) assert.equal(analysisSource.includes(removedText), false, `详情不得恢复完整利润分析: ${removedText}`);

assert.ok(contextSource.includes('createContext<Record<string, ProductMarketState>>({})'));
assert.ok(routerSource.includes('FacilityRecipeProfitMarketsProvider markets={model.game.markets}'));
for (const text of [
  '.facility-average-profit',
  'display: flex;',
  'justify-content: space-between;',
  '.facility-average-profit.is-positive',
  '.facility-average-profit.is-negative',
]) assert.ok(styleSource.includes(text), `单厂平均利润紧凑样式缺少: ${text}`);
assert.equal(styleSource.includes('.facility-profit-analysis__summary'), false);

for (const text of [
  '.facility-cluster-selector-heading',
  'flex-wrap: wrap;',
  '--facility-card-section-gap: var(--space-2);',
]) assert.ok(surfaceSource.includes(text), `工厂详情头部压缩样式缺少: ${text}`);
for (const text of [
  'min-height: 32px;',
  'gap: 0.35rem var(--space-2);',
  'font-size: 0.72rem;',
]) assert.ok(sheetSource.includes(text), `移动详情头部压缩样式缺少: ${text}`);

for (const text of [
  '### 9.5 单厂平均利润／分钟',
  '指标固定按一座工厂计算',
  '单厂平均利润／分钟 = 单厂周期利润 × 60000 ÷ 配方周期毫秒',
  '不得恢复市场利润分析标题',
  '完整状态与工厂名称放在同一紧凑标题行',
]) assert.ok(designSource.includes(text), `产业权威设计缺少单厂利润规则: ${text}`);
for (const removedText of [
  '### 9.5 玩家可见配方利润分析',
  '界面必须展示原料市场成本、产出市场价值',
  '窄屏利润分析保持紧凑而不删减信息',
]) assert.equal(designSource.includes(removedText), false, `产业设计不得保留旧利润卡规则: ${removedText}`);

console.log('单厂平均利润最近成交价、固定单座口径、缺价保护、完整利润卡移除和详情头部压缩验证通过。');
