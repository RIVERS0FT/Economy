import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analyzeRecipeProfit,
  estimatePlayerSellFee,
  sweepCommodityOrders,
} from '../src/utils/recipeProfitAnalysis.ts';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function order(id, productId, side, price, remaining, createdAt, isOwn = false) {
  return {
    id,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    side,
    price,
    quantity: remaining,
    remaining,
    status: 'open',
    createdAt,
    isOwn,
  };
}

const orders = [
  order('wheat-sell-1', 'wheat', 'sell', 3, 2, 1),
  order('wheat-sell-2', 'wheat', 'sell', 4, 4, 2),
  order('wheat-own-sell', 'wheat', 'sell', 1, 100, 0, true),
  order('wheat-buy-1', 'wheat', 'buy', 2, 6, 3),
  order('food-buy-1', 'food', 'buy', 12, 2, 1),
  order('food-buy-2', 'food', 'buy', 10, 2, 2),
];

assert.deepEqual(sweepCommodityOrders(orders, 'wheat', 'sell', 5), {
  requestedQuantity: 5,
  filledQuantity: 5,
  total: 18,
  averagePrice: 3.6,
  fullyFilled: true,
}, '采购原料必须排除自己的卖单并按最低卖价逐档成交');
assert.equal(estimatePlayerSellFee(0), 0, '零成交额不应产生手续费');
assert.equal(estimatePlayerSellFee(24), 1, '卖方手续费最低为 1');
assert.equal(estimatePlayerSellFee(101), 2, '卖方手续费按累计成交额 1% 向上取整');

const result = analyzeRecipeProfit({
  recipe: {
    id: 'food-production',
    name: '生产食品',
    cycleMs: 60_000,
    operatingCost: 2,
    inputs: [{ productId: 'wheat', quantity: 2 }],
    output: { productId: 'food', quantity: 2 },
  },
  scopeCount: 2,
  inventories: { wheat: { available: 1, frozen: 0 } },
  orders,
  buildCost: 50,
});

assert.equal(result.outputSale.total, 44, '产出应按最高买价逐档变现');
assert.equal(result.outputSellFee, 1, '产出净额应扣除预计卖方手续费');
assert.equal(result.outputNetRevenue, 43);
assert.equal(result.shortagePurchaseCost, 10, '现金利润只采购库存缺口');
assert.equal(result.fullPurchaseCost, 14, '全量采购利润必须采购全部原料');
assert.equal(result.directInputSaleNet, 7, '原料直卖比较必须扣除每种原料卖单手续费');
assert.equal(result.cashProfit, 29);
assert.equal(result.fullPurchaseProfit, 25);
assert.equal(result.valueAddedProfit, 32);
assert.equal(result.profitPerMinute, 32);
assert.equal(result.paybackMinutes, 100 / 32);

const insufficientOutput = analyzeRecipeProfit({
  recipe: {
    id: 'food-production',
    name: '生产食品',
    cycleMs: 60_000,
    operatingCost: 2,
    inputs: [{ productId: 'wheat', quantity: 2 }],
    output: { productId: 'food', quantity: 3 },
  },
  scopeCount: 2,
  inventories: { wheat: { available: 0, frozen: 0 } },
  orders,
  buildCost: 50,
});
assert.equal(insufficientOutput.outputSale.fullyFilled, false);
assert.equal(insufficientOutput.outputNetRevenue, null, '买盘不足时不得使用参考价补齐收入');
assert.equal(insufficientOutput.cashProfit, null, '盘口不足时不得伪造完整周期利润');

const formulaSource = read('src/components/facilities/FacilityProductionFormula.tsx');
const analysisSource = read('src/components/facilities/FacilityRecipeProfitAnalysis.tsx');
const contextSource = read('src/components/facilities/FacilityRecipeProfitContext.tsx');
const routerSource = read('src/pages/PageRouter.tsx');
const styleSource = read('src/styles/facility-recipe-profit-analysis.css');
const designSource = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');

for (const text of [
  'FacilityRecipeProfitAnalysis',
  'showNextCyclePreview ? nextType : type',
  'showNextCyclePreview ? nextScope : scope',
]) assert.ok(formulaSource.includes(text), `生产公式缺少利润分析接入: ${text}`);
for (const text of [
  '本轮现金利润',
  '全量采购利润',
  '相比直接卖原料',
  '逐档读取公开订单簿并排除自己的反向订单',
  '卖方手续费',
]) assert.ok(analysisSource.includes(text), `利润分析界面缺少: ${text}`);
assert.ok(contextSource.includes('createContext<AssetOrder[]>([])'), '利润分析订单上下文必须保持只读公开订单数组');
assert.ok(routerSource.includes('FacilityRecipeProfitOrdersProvider orders={model.game.orders}'), '生产页必须读取当前状态快照中的公开订单簿');
for (const text of [
  '.facility-profit-analysis',
  'grid-template-columns: minmax(0, 1fr) auto;',
  '@container (max-width: 520px)',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.facility-profit-analysis__summary .facility-profit-analysis__metric:nth-child(3)',
  'grid-column: 1 / -1;',
  'grid-row: 1;',
]) assert.ok(styleSource.includes(text), `利润分析紧凑样式缺少: ${text}`);
assert.equal(
  styleSource.includes('@container (max-width: 460px)') && styleSource.includes('grid-template-columns: 1fr;'),
  false,
  '移动端利润摘要不得恢复三项逐项单列',
);
for (const text of [
  '玩家可见配方利润分析',
  '不得使用基础价、参考价或未成交价格外推',
  '排除当前玩家自己的反向订单',
  '窄屏利润分析保持紧凑而不删减信息',
  '摘要使用两列，本轮现金利润占满一行并优先显示',
]) assert.ok(designSource.includes(text), `产业权威设计缺少利润分析规则: ${text}`);

console.log('玩家可见配方利润分析、逐档盘口、手续费、库存缺口、利润倒挂和移动端紧凑布局验证通过。');
