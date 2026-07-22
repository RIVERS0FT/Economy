import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeRecipeProfit } from '../src/utils/recipeProfitAnalysis.ts';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function market(productId, lastTradePrice, lastPrice = 999) {
  return {
    productId,
    lastPrice,
    lastTradePrice,
    priceHistory: [],
    demand: {},
  };
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
const result = analyzeRecipeProfit({
  recipe,
  scopeCount: 2,
  markets,
  buildCost: 50,
  inventories: { wheat: { available: 999_999, frozen: 0 } },
  orders: [{ assetKind: 'commodity', assetId: 'wheat', price: 1 }],
});

assert.equal(result.inputMarketCost, 12, '原料必须按完整需求量乘最近真实成交价，不考虑库存');
assert.equal(result.outputMarketValue, 48, '产出必须按完整产量乘最近真实成交价');
assert.equal(result.operatingCost, 4);
assert.equal(result.cycleProfit, 32, '单周期利润不得扣除交易手续费');
assert.equal(result.profitPerMinute, 32);
assert.equal(result.paybackMinutes, 100 / 32);
assert.deepEqual(result.missingPriceProductIds, []);
assert.equal(result.inputs[0].lastTradePrice, 3, '不得回退到 lastPrice');

const changedInventoryAndOrders = analyzeRecipeProfit({
  recipe,
  scopeCount: 2,
  markets,
  buildCost: 50,
  inventories: { wheat: { available: 0, frozen: 999_999 } },
  orders: [],
});
assert.deepEqual(changedInventoryAndOrders, result, '库存与公开挂单变化不得影响最近成交价利润分析');

const missingInputPrice = analyzeRecipeProfit({
  recipe,
  scopeCount: 2,
  markets: {
    wheat: market('wheat', null, 3),
    food: market('food', 12),
  },
  buildCost: 50,
});
assert.equal(missingInputPrice.inputMarketCost, null);
assert.equal(missingInputPrice.cycleProfit, null);
assert.deepEqual(missingInputPrice.missingPriceProductIds, ['wheat']);

const missingOutputPrice = analyzeRecipeProfit({
  recipe,
  scopeCount: 2,
  markets: {
    wheat: market('wheat', 3),
    food: market('food', null, 12),
  },
  buildCost: 50,
});
assert.equal(missingOutputPrice.outputMarketValue, null);
assert.equal(missingOutputPrice.profitPerMinute, null);
assert.deepEqual(missingOutputPrice.missingPriceProductIds, ['food']);

const noInput = analyzeRecipeProfit({
  recipe: {
    id: 'farm-production',
    name: '种植小麦',
    cycleMs: 120_000,
    operatingCost: 6,
    inputs: [],
    output: { productId: 'wheat', quantity: 4 },
  },
  scopeCount: 3,
  markets: { wheat: market('wheat', 2) },
  buildCost: 50,
});
assert.equal(noInput.inputMarketCost, 0, '无输入配方原料成本必须为零');
assert.equal(noInput.outputMarketValue, 24);
assert.equal(noInput.cycleProfit, 6);
assert.equal(noInput.profitPerMinute, 3);

const noFacility = analyzeRecipeProfit({ recipe, scopeCount: 0, markets, buildCost: 50 });
assert.equal(noFacility.cycleProfit, null);
assert.equal(noFacility.paybackMinutes, null);
assert.deepEqual(noFacility.missingPriceProductIds, []);

const analysisSource = read('src/components/facilities/FacilityRecipeProfitAnalysis.tsx');
const contextSource = read('src/components/facilities/FacilityRecipeProfitContext.tsx');
const routerSource = read('src/pages/PageRouter.tsx');
const styleSource = read('src/styles/facility-recipe-profit-analysis.css');
const designSource = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');

for (const text of [
  '原料市场成本',
  '产出市场价值',
  '周期运营成本',
  '单周期利润',
  '利润／分钟',
  '最近真实成交价',
  '不考虑玩家库存、挂单深度和交易手续费',
]) assert.ok(analysisSource.includes(text), `利润分析界面缺少: ${text}`);
for (const removedText of [
  '补料成本',
  '产出净额',
  '全量采购利润',
  '相比直接卖原料',
  '预计卖方手续费',
  '逐档读取公开订单簿',
]) assert.equal(analysisSource.includes(removedText), false, `利润分析界面不得恢复: ${removedText}`);
assert.ok(contextSource.includes('createContext<Record<string, ProductMarketState>>({})'), '利润分析上下文必须只提供商品市场状态');
assert.ok(routerSource.includes('FacilityRecipeProfitMarketsProvider markets={model.game.markets}'), '生产页必须读取当前状态快照中的商品最近成交价');
for (const text of [
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.facility-profit-analysis__summary .facility-profit-analysis__metric:nth-child(4)',
  'grid-column: 1 / -1;',
]) assert.ok(styleSource.includes(text), `利润分析紧凑样式缺少: ${text}`);
for (const text of [
  '玩家可见配方利润分析只读取商品最近一次统一订单簿真实成交价',
  '不得读取玩家库存、公开挂单或预计交易手续费',
  '单周期利润 = 产出市场价值 − 原料市场成本 − 集群周期运营成本',
  '不得回退到商品基础价、系统参考价、当前挂单价或未成交价格',
]) assert.ok(designSource.includes(text), `产业权威设计缺少利润分析规则: ${text}`);

console.log('玩家可见配方利润分析最近成交价、忽略库存与手续费、缺价保护和紧凑布局验证通过。');
