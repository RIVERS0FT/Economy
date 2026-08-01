import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const orderPriceSource = read('src/utils/defaultOrderPrice.ts');
const priceFunctionMatch = orderPriceSource.match(
  /export function isValidOrderPrice\(price: number\) \{[\s\S]*?\n\}/,
);
assert.ok(priceFunctionMatch, '缺少统一两位小数订单价格校验');
const executablePriceSource = priceFunctionMatch[0]
  .replace('export ', '')
  .replace('price: number', 'price');
const isValidOrderPrice = new Function(
  executablePriceSource + '\nreturn isValidOrderPrice;',
)();

const recipeSource = read('src/utils/recipeProfitAnalysis.ts')
  .replace(/import type \{[\s\S]*?\} from '\.\.\/types';\n/, '')
  .replace("import { isValidOrderPrice } from './defaultOrderPrice';\n", '')
  .replaceAll('export interface', 'interface')
  .replace('export function analyzeRecipeProfit', 'function analyzeRecipeProfit');
const executableRecipeSource = stripTypeScriptTypes(recipeSource, { mode: 'strip' });
const analyzeRecipeProfit = new Function(
  'isValidOrderPrice',
  executableRecipeSource + '\nreturn analyzeRecipeProfit;',
)(isValidOrderPrice);

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

const singleFactory = analyzeRecipeProfit({ recipe, scopeCount: 1, markets, buildCost: 0 });
assert.equal(singleFactory.inputMarketCost, 6);
assert.equal(singleFactory.outputMarketValue, 24);
assert.equal(singleFactory.operatingCost, 2);
assert.equal(singleFactory.cycleProfit, 16);
assert.equal(singleFactory.profitPerMinute, 16, '界面单厂平均利润必须固定按一座工厂计算');

const decimalPrices = analyzeRecipeProfit({
  recipe,
  scopeCount: 1,
  markets: {
    wheat: market('wheat', 1.25, 100),
    food: market('food', 4.75, 200),
  },
  buildCost: 0,
});
assert.equal(decimalPrices.inputMarketCost, 2.5);
assert.equal(decimalPrices.outputMarketValue, 9.5);
assert.equal(decimalPrices.operatingCost, 2);
assert.equal(decimalPrices.cycleProfit, 5);
assert.equal(decimalPrices.profitPerMinute, 5, '合法两位小数成交价必须参与工厂产值计算');
assert.deepEqual(decimalPrices.missingPriceProductIds, []);

const minimumPrice = analyzeRecipeProfit({
  recipe: {
    id: 'minimum-price-output',
    name: '最小价格产出',
    cycleMs: 60_000,
    operatingCost: 0,
    inputs: [],
    output: { productId: 'wheat', quantity: 1 },
  },
  scopeCount: 1,
  markets: { wheat: market('wheat', 0.01, 999) },
  buildCost: 0,
});
assert.equal(minimumPrice.outputMarketValue, 0.01);
assert.equal(minimumPrice.profitPerMinute, 0.01, '0.01 最小合法成交价必须参与工厂产值计算');

for (const invalidPrice of [0, -1, 1.234, Number.POSITIVE_INFINITY]) {
  const invalid = analyzeRecipeProfit({
    recipe,
    scopeCount: 1,
    markets: {
      wheat: market('wheat', 3),
      food: market('food', invalidPrice, 200),
    },
    buildCost: 0,
  });
  assert.equal(invalid.profitPerMinute, null);
  assert.deepEqual(invalid.missingPriceProductIds, ['food']);
}

const changedInventoryAndOrders = analyzeRecipeProfit({
  recipe,
  scopeCount: 1,
  markets,
  buildCost: 0,
  inventories: { wheat: { available: 0, frozen: 999_999 } },
  orders: [],
});
assert.deepEqual(changedInventoryAndOrders, singleFactory, '库存与公开挂单不得影响单厂平均利润');

const missingPrice = analyzeRecipeProfit({
  recipe,
  scopeCount: 1,
  markets: { wheat: market('wheat', null, 3), food: market('food', 12) },
  buildCost: 0,
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
  buildCost: 0,
});
assert.equal(noInput.inputMarketCost, 0);
assert.equal(noInput.profitPerMinute, 1);

const profitSource = read('src/utils/recipeProfitAnalysis.ts');
const presentationSource = read('src/utils/facilityProfitPresentation.ts');
const analysisSource = read('src/components/facilities/FacilityRecipeProfitAnalysis.tsx');
const selectorSource = read('src/pages/production/ProductionFacilityDetail.tsx');
const marketPageSource = read('src/pages/MarketPage.tsx');
const contextSource = read('src/components/facilities/FacilityRecipeProfitContext.tsx');
const routerSource = read('src/pages/PageRouter.tsx');
const runtimeHarnessSource = read('tests/browser/runtime-harness.tsx');
const browserSource = read('tests/browser/production-status-summary.spec.ts');
const facilityCardsBrowserSource = read('tests/browser/production-facility-cards.spec.ts');
const styleSource = read('src/styles/facility-recipe-profit-analysis.css');
const surfaceSource = read('src/styles/production-surface.css');
const sheetSource = read('src/styles/facility-detail-sheet.css');
const designSource = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const marketDesignSource = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');

for (const text of [
  "import { isValidOrderPrice } from './defaultOrderPrice';",
  'isValidOrderPrice(value)',
]) assert.ok(profitSource.includes(text), `工厂产值计算缺少统一价格边界: ${text}`);
assert.doesNotMatch(
  profitSource,
  /Number\.isInteger\(value\)|Number\(value\)\s*>=\s*1/,
  '工厂产值不得恢复整数或不低于 1 的成交价限制',
);
for (const text of [
  "scenario === 'decimal-profit'",
  "scenario === 'facility-card-profit'",
  'lastTradePrice: 28.75',
  'lastTradePrice: 76.25',
  "id: 'sawmill-loss-recipe'",
  'FacilityRecipeProfitMarketsProvider markets={model.game.markets}',
]) assert.ok(runtimeHarnessSource.includes(text), `生产运行时小数产值场景缺少: ${text}`);
for (const text of [
  'renders decimal last trade prices in single-factory profit',
  "toContainText('5.38')",
  "not.toContainText('缺少')",
]) assert.ok(browserSource.includes(text), `生产页小数产值浏览器回归缺少: ${text}`);

for (const text of [
  "toHaveText('5.38')",
  "toHaveText('-9.00')",
  'toHaveClass(/is-positive/)',
  'toHaveClass(/is-negative/)',
  "backgroundPosition).toBe('50% 50%')",
  "backgroundSize).toBe('cover')",
  'gridTemplateColumns',
  'toBeCloseTo(1.25, 1)',
]) assert.ok(facilityCardsBrowserSource.includes(text), `工厂竖卡利润浏览器回归缺少: ${text}`);

for (const text of [
  '单厂平均利润／分钟',
  '最近真实成交价',
  'resolveFacilityProfitPresentation({',
]) assert.ok(analysisSource.includes(text), `单厂平均利润界面缺少: ${text}`);
for (const text of [
  'scopeCount: scopeCount > 0 ? 1 : 0',
  'buildCost: 0',
  'analysis.missingPriceProductIds',
  "missingPriceNames.join('、')",
  "visibleValue = profitPerMinute === null ? '—' : formatCurrency(profitPerMinute)",
  "? 'positive'",
  "? 'negative'",
  "? `盈利 ${formatCurrency(profitPerMinute)}`",
  "? `亏损 ${formatCurrency(Math.abs(profitPerMinute))}`",
  '不计玩家库存、挂单深度和交易手续费',
]) assert.ok(presentationSource.includes(text), `共享单厂利润展示模型缺少: ${text}`);
for (const text of [
  'className={`facility-cluster-profit is-${profit.tone}`}',
  '{profit.visibleValue}',
  '每分钟平均利润：${profit.accessibleValue}',
  'title={`${type.name}单厂平均利润／分钟；${profit.detail}`}',
]) assert.ok(selectorSource.includes(text), `工厂选择卡利润数字缺少: ${text}`);
const selectorCardSource = selectorSource.slice(
  selectorSource.indexOf('export function FacilityClusterSelectorCard'),
  selectorSource.indexOf('export function FacilityClusterDetailHeader'),
);
for (const forbiddenText of ['<CurrencyAmount', '/分']) {
  assert.equal(selectorCardSource.includes(forbiddenText), false, `工厂选择卡利润不得显示: ${forbiddenText}`);
}
for (const removedText of [
  '市场利润分析',
  '<small>原料市场成本</small>',
  '<small>产出市场价值</small>',
  '<small>周期运营成本</small>',
  '<small>单周期利润</small>',
  '静态建造回本',
  '预计盈利',
  '最近成交价明细',
  'buildCost: type.buildCost',
]) assert.equal(analysisSource.includes(removedText), false, `详情不得恢复完整利润分析: ${removedText}`);

for (const text of [
  'const lastTradePrice = game.markets[product.id]?.lastTradePrice;',
  'const lastTradePrice = game.facilityMarkets[facility.id]?.lastTradePrice;',
  "const hasLastTradePrice = typeof lastTradePrice === 'number';",
]) assert.ok(marketPageSource.includes(text), `市场资产目录缺少真实成交价字段: ${text}`);
for (const removedText of [
  'const lastPrice = game.markets[product.id]?.lastPrice;',
  'const lastPrice = game.facilityMarkets[facility.id]?.lastPrice;',
]) assert.equal(marketPageSource.includes(removedText), false, `市场资产目录不得把 lastPrice 标为最近成交价: ${removedText}`);

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
  '必须直接显示缺失商品名称',
  '不得只显示笼统的“暂无成交数据”',
  '完整状态与工厂名称放在同一紧凑标题行',
  '最近真实成交价必须使用统一订单簿的价格边界',
  '客户端不得要求成交价为整数或不低于 1',
  '选择卡只显示格式化数字或缺价占位',
  '正数不加正号并使用绿色，负数保留负号并使用红色',
]) assert.ok(designSource.includes(text), `产业权威设计缺少单厂利润规则: ${text}`);
for (const removedText of [
  '### 9.5 玩家可见配方利润分析',
  '界面必须展示原料市场成本、产出市场价值',
  '窄屏利润分析保持紧凑而不删减信息',
]) assert.equal(designSource.includes(removedText), false, `产业设计不得保留旧利润卡规则: ${removedText}`);
assert.ok(
  marketDesignSource.includes('横向资产目录中的商品和工厂价格都必须读取对应市场的 `lastTradePrice`'),
  '统一订单簿设计必须锁定资产目录真实成交价字段',
);

console.log('市场目录真实成交价、单厂平均利润固定单座口径、具体缺价提示和完整利润卡移除验证通过。');
