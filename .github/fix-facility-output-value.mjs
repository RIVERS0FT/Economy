import { readFileSync, writeFileSync } from 'node:fs';

function replaceExact(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`${path} 缺少预期修改片段`);
  }
  writeFileSync(path, source.replace(before, after));
}

replaceExact(
  'src/utils/recipeProfitAnalysis.ts',
  `import type {
  FacilityRecipeDefinition,
  ProductMarketState,
} from '../types';`,
  `import type {
  FacilityRecipeDefinition,
  ProductMarketState,
} from '../types';
import { isValidOrderPrice } from './defaultOrderPrice';`,
);

replaceExact(
  'src/utils/recipeProfitAnalysis.ts',
  `function lastTradePrice(markets: Record<string, ProductMarketState>, productId: string) {
  const value = markets[productId]?.lastTradePrice;
  return Number.isInteger(value) && Number(value) >= 1 ? Number(value) : null;
}`,
  `function lastTradePrice(markets: Record<string, ProductMarketState>, productId: string) {
  const value = markets[productId]?.lastTradePrice;
  return typeof value === 'number' && isValidOrderPrice(value) ? value : null;
}`,
);

replaceExact(
  'scripts/verify-recipe-profit-analysis.mjs',
  `assert.equal(singleFactory.cycleProfit, 16);
assert.equal(singleFactory.profitPerMinute, 16, '界面单厂平均利润必须固定按一座工厂计算');`,
  `assert.equal(singleFactory.cycleProfit, 16);
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
}`,
);

replaceExact(
  'scripts/verify-recipe-profit-analysis.mjs',
  `const analysisSource = read('src/components/facilities/FacilityRecipeProfitAnalysis.tsx');`,
  `const profitSource = read('src/utils/recipeProfitAnalysis.ts');
const analysisSource = read('src/components/facilities/FacilityRecipeProfitAnalysis.tsx');`,
);

replaceExact(
  'scripts/verify-recipe-profit-analysis.mjs',
  `const routerSource = read('src/pages/PageRouter.tsx');`,
  `const routerSource = read('src/pages/PageRouter.tsx');
const runtimeHarnessSource = read('tests/browser/runtime-harness.tsx');
const browserSource = read('tests/browser/production-status-summary.spec.ts');`,
);

replaceExact(
  'scripts/verify-recipe-profit-analysis.mjs',
  `for (const text of [
  '单厂平均利润／分钟',`,
  `for (const text of [
  "import { isValidOrderPrice } from './defaultOrderPrice';",
  'isValidOrderPrice(value)',
]) assert.ok(profitSource.includes(text), \`工厂产值计算缺少统一价格边界: \${text}\`);
assert.doesNotMatch(
  profitSource,
  /Number\\.isInteger\\(value\\)|Number\\(value\\)\\s*>=\\s*1/,
  '工厂产值不得恢复整数或不低于 1 的成交价限制',
);
for (const text of [
  "scenario === 'decimal-profit'",
  'lastTradePrice: 28.75',
  'lastTradePrice: 76.25',
  'FacilityRecipeProfitMarketsProvider markets={model.game.markets}',
]) assert.ok(runtimeHarnessSource.includes(text), \`生产运行时小数产值场景缺少: \${text}\`);
for (const text of [
  'renders decimal last trade prices in single-factory profit',
  "toContainText('5.38')",
  "not.toContainText('缺少')",
]) assert.ok(browserSource.includes(text), \`生产页小数产值浏览器回归缺少: \${text}\`);

for (const text of [
  '单厂平均利润／分钟',`,
);

replaceExact(
  'scripts/verify-recipe-profit-analysis.mjs',
  `  '完整状态与工厂名称放在同一紧凑标题行',`,
  `  '完整状态与工厂名称放在同一紧凑标题行',
  '最近真实成交价必须使用统一订单簿的价格边界',
  '客户端不得要求成交价为整数或不低于 1',`,
);

replaceExact(
  'tests/browser/runtime-harness.tsx',
  `import { ProductionPage } from '../../src/pages/ProductionPage';`,
  `import { ProductionPage } from '../../src/pages/ProductionPage';
import { FacilityRecipeProfitMarketsProvider } from '../../src/components/facilities/FacilityRecipeProfitContext';`,
);

replaceExact(
  'tests/browser/runtime-harness.tsx',
  `import type { TabId } from '../../src/config/navigation';`,
  `import type { TabId } from '../../src/config/navigation';
import type { ProductMarketState } from '../../src/types';`,
);

replaceExact(
  'tests/browser/runtime-harness.tsx',
  `    next.game.products = [
      { id: 'steel', name: '钢材', category: 'industrial', basePrice: 29 },
      ...next.game.products,
    ];
    if (scenario === 'cluster-summary') {`,
  `    next.game.products = [
      { id: 'steel', name: '钢材', category: 'industrial', basePrice: 29 },
      ...next.game.products,
    ];
    if (scenario === 'decimal-profit') {
      const markets = next.game.markets as Record<string, ProductMarketState>;
      markets.steel = {
        ...markets.machinery,
        productId: 'steel',
        lastPrice: 29,
        lastTradePrice: 28.75,
        priceHistory: [],
      };
      markets.machinery = {
        ...markets.machinery,
        lastTradePrice: 76.25,
      };
    }
    if (scenario === 'cluster-summary') {`,
);

replaceExact(
  'tests/browser/runtime-harness.tsx',
  `    <GameShell model={model} statusItems={statusItems}>
      <ProductionPage model={model} />
    </GameShell>`,
  `    <GameShell model={model} statusItems={statusItems}>
      <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
        <ProductionPage model={model} />
      </FacilityRecipeProfitMarketsProvider>
    </GameShell>`,
);

replaceExact(
  'tests/browser/production-status-summary.spec.ts',
  `    await expect(page.locator('.facility-cluster-selector-card[data-status="constructing"]')).toHaveCount(0);
  });
});`,
  `    await expect(page.locator('.facility-cluster-selector-card[data-status="constructing"]')).toHaveCount(0);
  });

  test('renders decimal last trade prices in single-factory profit', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=decimal-profit');

    const profit = page.locator('.facility-average-profit');
    await expect(profit).toHaveCount(1);
    await expect(profit).toContainText('5.38');
    await expect(profit).not.toContainText('缺少');
    await expect(profit).toHaveClass(/is-positive/);
  });
});`,
);

replaceExact(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  `单厂平均利润只读取商品最近一次统一订单簿真实成交价和服务器正式配方。原料与产出均按一座工厂的完整配方数量乘对应商品 \`lastTradePrice\` 计价；不得读取玩家库存、公开挂单、预计交易手续费或建造费。不得回退到商品基础价、系统参考价、当前挂单价、未成交价格或 \`lastPrice\`。`,
  `单厂平均利润只读取商品最近一次统一订单簿真实成交价和服务器正式配方。原料与产出均按一座工厂的完整配方数量乘对应商品 \`lastTradePrice\` 计价；不得读取玩家库存、公开挂单、预计交易手续费或建造费。不得回退到商品基础价、系统参考价、当前挂单价、未成交价格或 \`lastPrice\`。最近真实成交价必须使用统一订单簿的价格边界：不低于 0.01、最多两位小数；客户端不得要求成交价为整数或不低于 1。`,
);

console.log('工厂产值小数成交价修复已应用。');
