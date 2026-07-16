import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content, 'utf8');

function replaceExact(path, search, replacement) {
  const source = read(path);
  if (!source.includes(search)) {
    throw new Error(`${path} 缺少待替换内容:\n${search}`);
  }
  write(path, source.replace(search, replacement));
}

const typePath = 'src/types.ts';
if (read(typePath).includes('takerSide?: OrderSide;')
  && read('src/pages/OverviewPage.tsx').includes('variant="compact"')) {
  console.log('Market flow chart changes are already applied.');
  process.exit(0);
}

replaceExact(typePath, `export interface PricePoint {
  price: number;
  quantity: number;
  createdAt: number;
}`, `export interface PricePoint {
  price: number;
  quantity: number;
  createdAt: number;
  takerSide?: OrderSide;
}`);

replaceExact('server/src/balanced-market.js', `  function recordPrice(world, productId, price, quantity, createdAt) {
    const market = marketFor(world, productId, createdAt);
    market.lastPrice = price;
    market.priceHistory ||= [];
    market.priceHistory.push({ price, quantity, createdAt });
    market.priceHistory = market.priceHistory.slice(-constants.maxPricePoints);
  }`, `  function recordPrice(world, productId, price, quantity, takerSide, createdAt) {
    const market = marketFor(world, productId, createdAt);
    market.lastPrice = price;
    market.priceHistory ||= [];
    market.priceHistory.push({ price, quantity, createdAt, takerSide });
    market.priceHistory = market.priceHistory.slice(-constants.maxPricePoints);
  }`);
replaceExact(
  'server/src/balanced-market.js',
  '    recordPrice(world, incoming.productId, price, quantity, createdAt);',
  '    recordPrice(world, incoming.productId, price, quantity, incoming.side, createdAt);',
);

replaceExact('server/src/facility-groups.js', `function recordFacilityPrice(world, typeId, price, quantity, createdAt) {
  const market = facilityMarketFor(world, typeId, createdAt);
  if (!market) return;
  market.lastPrice = price;
  market.priceHistory.push({ price, quantity, createdAt });
  market.priceHistory = market.priceHistory.slice(-MAX_PRICE_POINTS);
}`, `function recordFacilityPrice(world, typeId, price, quantity, takerSide, createdAt) {
  const market = facilityMarketFor(world, typeId, createdAt);
  if (!market) return;
  market.lastPrice = price;
  market.priceHistory.push({ price, quantity, createdAt, takerSide });
  market.priceHistory = market.priceHistory.slice(-MAX_PRICE_POINTS);
}`);
replaceExact(
  'server/src/facility-groups.js',
  '  recordFacilityPrice(world, typeId, price, quantity, createdAt);',
  '  recordFacilityPrice(world, typeId, price, quantity, incoming.side, createdAt);',
);

copyFileSync('.github/market-flow/marketHistory.ts', 'src/utils/marketHistory.ts');
copyFileSync('.github/market-flow/PriceSparkline.tsx', 'src/components/charts/PriceSparkline.tsx');

replaceExact(
  'src/pages/OverviewPage.tsx',
  "import { formatCurrency, formatDuration, formatNumber, formatRank, formatTime } from '../utils/formatters';",
  "import { formatCurrency, formatDuration, formatNumber, formatRank, formatTime } from '../utils/formatters';\nimport { buildMarketHistoryBuckets, summarizeMarketFlow } from '../utils/marketHistory';",
);
replaceExact('src/pages/OverviewPage.tsx', `  const overviewMarket = useMemo(() => {
    const product = game.products.find((item) => item.id === overviewProductId) ?? game.products[0];
    if (!product) return null;

    const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
    const market = game.markets[product.id];
    let bestBid = 0;
    let bestAsk = 0;

    for (const order of game.orders) {
      if (!['open', 'partial'].includes(order.status)) continue;
      if (orderKind(order) !== 'commodity' || orderAssetId(order) !== product.id) continue;
      if (order.side === 'buy') bestBid = Math.max(bestBid, order.price);
      else if (!bestAsk || order.price < bestAsk) bestAsk = order.price;
    }

    return {
      product,
      inventory,
      lastPrice: market?.lastPrice ?? product.basePrice,
      history: market?.priceHistory.map((point) => point.price) ?? [],
      bestBid,
      bestAsk,
    };
  }, [game, overviewProductId]);`, `  const overviewMarket = useMemo(() => {
    const product = game.products.find((item) => item.id === overviewProductId) ?? game.products[0];
    if (!product) return null;

    const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
    const market = game.markets[product.id];
    const lastPrice = market?.lastPrice ?? product.basePrice;
    const buckets = buildMarketHistoryBuckets(market?.priceHistory ?? [], lastPrice, now);
    let bestBid = 0;
    let bestAsk = 0;

    for (const order of game.orders) {
      if (!['open', 'partial'].includes(order.status)) continue;
      if (orderKind(order) !== 'commodity' || orderAssetId(order) !== product.id) continue;
      if (order.side === 'buy') bestBid = Math.max(bestBid, order.price);
      else if (!bestAsk || order.price < bestAsk) bestAsk = order.price;
    }

    return {
      product,
      inventory,
      lastPrice,
      buckets,
      flow: summarizeMarketFlow(buckets),
      bestBid,
      bestAsk,
    };
  }, [game, now, overviewProductId]);`);
replaceExact(
  'src/pages/OverviewPage.tsx',
  '              <PriceSparkline values={overviewMarket.history.slice(-24)} />',
  '              <PriceSparkline buckets={overviewMarket.buckets} variant="compact" />',
);
replaceExact('src/pages/OverviewPage.tsx', `              <div className="overview-market-footer">
                <Button variant="text" onClick={() => selectMarketAsset('commodity', overviewMarket.product.id)}>进入该商品市场 →</Button>
              </div>`, `              <div className="overview-market-footer">
                <small>{overviewMarket.flow.netVolume > 0
                  ? \`24h 净主动买入 \${formatNumber(overviewMarket.flow.netVolume)}\`
                  : overviewMarket.flow.netVolume < 0
                    ? \`24h 净主动卖出 \${formatNumber(Math.abs(overviewMarket.flow.netVolume))}\`
                    : '24h 主动买卖均衡／方向未知'}</small>
                <Button variant="text" onClick={() => selectMarketAsset('commodity', overviewMarket.product.id)}>进入该商品市场 →</Button>
              </div>`);

replaceExact(
  'src/pages/MarketPage.tsx',
  "import { buildMarketHistoryBuckets } from '../utils/marketHistory';",
  "import { buildMarketHistoryBuckets, summarizeMarketFlow } from '../utils/marketHistory';",
);
replaceExact('src/pages/MarketPage.tsx', `  const {
    game,
    localTrades,`, `  const {
    game,
    now,
    localTrades,`);
replaceExact('src/pages/MarketPage.tsx', `  const marketBuckets = buildMarketHistoryBuckets(marketHistory, marketFallbackPrice);
  const marketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;`, `  const marketBuckets = buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now);
  const marketFlow = summarizeMarketFlow(marketBuckets);
  const marketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;`);
replaceExact(
  'src/pages/MarketPage.tsx',
  '          <PriceSparkline buckets={marketBuckets} />',
  '          <PriceSparkline buckets={marketBuckets} variant="full" />',
);
replaceExact('src/pages/MarketPage.tsx', `            <span>24h · 6m × 240（{formatNumber(marketHistory.length)} 笔）</span>
            <span>我的当前订单 {formatNumber(ownSelectedOrders.length)} 笔</span>
            <span>估值买价 <CurrencyAmount>{game.valuationPrices[\`${marketAssetKind}:${assetId}\`] ? formatCurrency(game.valuationPrices[\`${marketAssetKind}:${assetId}\`]) : '--'}</CurrencyAmount></span>`, `            <span>24h · 6m × 240（{formatNumber(marketHistory.length)} 笔）</span>
            <span>{marketFlow.netVolume > 0
              ? \`净主动买入 \${formatNumber(marketFlow.netVolume)}\`
              : marketFlow.netVolume < 0
                ? \`净主动卖出 \${formatNumber(Math.abs(marketFlow.netVolume))}\`
                : '主动买卖均衡／方向未知'}</span>
            <span>我的当前订单 {formatNumber(ownSelectedOrders.length)} 笔</span>
            <span>估值买价 <CurrencyAmount>{game.valuationPrices[\`${marketAssetKind}:${assetId}\`] ? formatCurrency(game.valuationPrices[\`${marketAssetKind}:${assetId}\`]) : '--'}</CurrencyAmount></span>`);

replaceExact('src/styles/overview.css', `.overview-market-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}`, `.overview-market-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.overview-market-footer small {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}`);

replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '> 更新时间：2026-07-16',
  '> 更新时间：2026-07-17',
);
replaceExact('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', `市场行情图固定统计当前资产最近 24h，按 6 分钟聚合为 240 个数据分段。每个分段的价格使用该段最后一笔成交价；没有成交的分段延续最近有效成交价，成交量为该段全部成交数量之和。价格折线图位于上方，成交量柱状图位于下方，两图纵向堆叠并共享同一横轴。

横轴固定划分为 12 个 2h 分段，刻度标签使用浏览器系统时区的 \`HH:mm\`；纵轴分别标明“价格”和“成交量”，必须显示刻度、网格和可访问名称。横纵坐标刻度与轴标题的屏幕渲染字号必须与图表下方统计栏一致，横轴标题固定为“时间”。概览页仍使用紧凑价格迷你折线，不复制成交量图和完整坐标轴。`, `概览页与市场页的商品行情统一统计当前资产最近 24h，按 6 分钟聚合为 240 个数据分段。每个分段的价格使用该段最后一笔成交价；没有成交的分段延续最近有效成交价，成交量为该段全部成交数量之和。价格折线图位于上方，成交量柱状图位于下方，两图纵向堆叠并共享同一横轴。概览页只使用紧凑尺寸，不得恢复“最近 24 笔成交”或仅价格折线的独立数据口径。

每笔新成交必须记录吃单方（taker／incoming order）的方向。分段净主动量固定为“主动买入量 − 主动卖出量”；柱高始终表示总成交量，净主动买入使用成功色，净主动卖出使用危险色，主动买卖均衡或旧历史方向未知使用中性色。旧世界中没有方向字段的成交不得按涨跌猜测方向，统一计入中性成交量。

横轴固定划分为 12 个 2h 分段，刻度标签使用浏览器系统时区的 \`HH:mm\`；纵轴分别标明“价格”和“成交量”，必须显示刻度、网格、方向图例和可访问名称。横纵坐标刻度与轴标题的屏幕渲染字号必须与图表下方统计栏一致，横轴标题固定为“时间”。`);

replaceExact(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '> 更新时间：2026-07-15',
  '> 更新时间：2026-07-17',
);
replaceExact('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', `订单簿和价格曲线属于市场状态；玩家成交记录属于订单级权威明细。两者不得互相替代。

## 6. 单列订单簿`, `订单簿和价格曲线属于市场状态；玩家成交记录属于订单级权威明细。两者不得互相替代。

### 5.1 行情主动方向

商品和工厂每笔成交除价格、数量和时间外，还必须保存吃单方（taker／incoming order）的买卖方向。主动买单吃掉已有卖单时记为主动买入，主动卖单吃掉已有买单时记为主动卖出；不得把成交双方的买卖数量直接相减，也不得按价格涨跌猜测主动方向。

概览页与市场页共用同一最近 24h、6 分钟行情分段。分段收盘价取最后一笔成交价，总成交量为全部成交数量之和，净主动量为主动买入量减主动卖出量。成交量柱高表示总成交量，颜色只表达净主动方向：净买入使用成功色，净卖出使用危险色，均衡或旧历史方向未知使用中性色。旧成交没有主动方向字段时必须保留为中性成交量，新成交逐步替换该窗口，禁止伪造迁移方向。

## 6. 单列订单簿`);

copyFileSync('.github/market-flow/verify-market-chart.mjs', 'scripts/verify-market-chart.mjs');

replaceExact('scripts/verify-overview-content.mjs', `  'const overviewMarket = useMemo(() => {',
  "value={overviewMarket?.product.id ?? ''}",`, `  'const overviewMarket = useMemo(() => {',
  'buildMarketHistoryBuckets',
  'summarizeMarketFlow',
  '<PriceSparkline buckets={overviewMarket.buckets} variant="compact" />',
  "value={overviewMarket?.product.id ?? ''}",`);
replaceExact('scripts/verify-overview-content.mjs', `  '当前浏览器最近成交',
]) forbidText(overviewPath, text);`, `  '当前浏览器最近成交',
  'slice(-24)',
  '<PriceSparkline values=',
]) forbidText(overviewPath, text);`);
replaceExact('scripts/verify-overview-content.mjs', `  '让普通页面切换重置仍有效的概览商品选择',
]) requireText(pageDesignPath, text);`, `  '让普通页面切换重置仍有效的概览商品选择',
  '概览页与市场页的商品行情统一统计当前资产最近 24h',
  '不得恢复“最近 24 笔成交”',
]) requireText(pageDesignPath, text);`);

console.log('Applied unified 24h market flow chart changes.');
