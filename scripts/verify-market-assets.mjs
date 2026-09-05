import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!existsSync(resolve(root, path)) || !read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (existsSync(resolve(root, path)) && read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

for (const path of [
  'src/pages/MarketPage.tsx',
  'src/components/market/MarketCommodityRow.tsx',
  'src/components/products/ProductArtwork.tsx',
  'src/components/icons/FacilityIcons.tsx',
  'src/components/icons/GameIcons.tsx',
  'src/components/ui/VirtualRecordTable.tsx',
  'src/components/ui/VirtualList.tsx',
  'src/utils/orderBookLevels.ts',
  'server/src/market-state-delivery.js',
  'server/src/order-matching.js',
  'server/src/market-sell-fee.js',
  'server/test/market-state-delivery.test.js',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
]) requireFile(path);

for (const text of [
  "import { FacilityIcon } from '../components/icons/FacilityIcons';",
  "import { FactoryIcon } from '../components/icons/GameIcons';",
  "import { ProductArtwork } from '../components/products/ProductArtwork';",
  "import { VirtualRecordTable } from '../components/ui/VirtualRecordTable';",
  'function MarketImmediateTradeEntry({',
  'const [quantityDraft',
  'const maxBuyByFunds = officialPrice > 0',
  'const total = (pendingTrade.current?.price ?? officialPrice) * effectiveQuantity;',
  'marketDetailRefreshToken',
  'getMarketDetail(',
  'detailedMarket?.priceHistory',
  '<FacilityIcon facilityTypeId={selectedFacility.id} />',
  'className="market-stepper market-quantity-stepper"',
  'id="market-trade-quantity"',
  'order-quick-fill',
  '25%',
  '50%',
  '最大',
  '今日成交量',
  'market-detail-product-icon-card ui-entity-card',
  '立即买入',
  '立即卖出',
  '成交记录',
]) requireText('src/pages/MarketPage.tsx', text);
for (const text of ['今日成交价', '下次调价']) forbidText('src/pages/MarketPage.tsx', text);
for (const text of [
  'MoneyInput',
  'market-order-price',
  '调整订单价格',
  'orderBook.bids',
  'orderBook.asks',
  'ownOpenOrderCount',
  'maxOpenOrders',
  '已有订单',
  '实时五档',
  '>撤单<',
]) forbidText('src/pages/MarketPage.tsx', text);

for (const text of [
  "import { ProductArtwork } from '../products/ProductArtwork';",
  '<ProductArtwork productId={productId} />',
  "{ label: '今日价格', sortKey: 'price' }",
  "{ label: '24h成交量', sortKey: 'volume24h' }",
]) requireText('src/components/market/MarketCommodityRow.tsx', text);
for (const text of ['卖单量', '买单量']) forbidText('src/components/market/MarketCommodityRow.tsx', text);

for (const text of [
  'const EMPTY_PUBLIC_ORDER_BOOK',
  'buyVolume: 0',
  'sellVolume: 0',
  'buyOrderCount: 0',
  'sellOrderCount: 0',
  'bestBid: null',
  'bestAsk: null',
  "assetKind === 'commodity' ? [] : publicDepth(getOrderBookDepth",
  'includeOrderBook = true',
  "includeOrderBook: assetKind !== 'commodity'",
  "const bids = assetKind === 'commodity' ? [] : publicDepth",
  "const asks = assetKind === 'commodity' ? [] : publicDepth",
]) requireText('server/src/market-state-delivery.js', text);

const marketDetailTest = read('server/test/market-state-delivery.test.js');
for (const text of [
  'commodity market detail returns bounded public real-trade history, empty public depth, and a conditional revision',
  'market detail store response omits an unchanged conditional payload',
  'assert.deepEqual(detail.orderBook.bids, [])',
  'assert.deepEqual(detail.orderBook.asks, [])',
  'assert.equal(detail.market.bestBid, null)',
  'assert.equal(detail.market.bestAsk, null)',
]) {
  if (!marketDetailTest.includes(text)) failures.push(`市场详情测试缺少: ${text}`);
}
for (const forbidden of ['ownerId', 'ownerName', 'counterparty', 'demandTier', 'fundingSlices']) {
  if (marketDetailTest.includes(`assert.ok(body.includes('${forbidden}'))`)) failures.push(`市场详情测试不得要求公开字段: ${forbidden}`);
}

for (const text of [
  '玩家商品交易不得创建 `open`／`partial` 商品订单',
  '玩家商品页面永久移除：价格输入框',
  '内部人口／储备订单继续复用共享撮合内核',
  '普通玩家页面不得展示内部订单所有者',
  '玩家即时商品交易不得经过该共享撮合内核',
  '商品卖出继续收取累计口径等价 1% 的市场服务费',
  '工厂所有权转移继续只通过拍卖完成',
]) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);
for (const text of [
  '卖 5 至卖 1',
  '买 1 至买 5',
  '点击任一档位只把该档价格填入价格输入',
  '玩家未完成订单达到当前商品类型数与工厂类型数之和的 10 倍',
]) forbidText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);

for (const text of [
  '本地成交表使用 `VirtualRecordTable` 与 `useVirtualWindow`',
  'DOM 只创建当前滚动视口及少量 `overscan` 条目',
  '不得用分页、截断、`slice` 或全量 `.map()` 替代窗口化',
]) requireText('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', text);
for (const text of [
  '礼品码列表和兑换记录可能持续增长，必须同时使用服务端游标分页和共享 `VirtualList`',
  '让礼品码或兑换记录接口恢复无边界全表返回',
]) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);

for (const [path, texts] of [
  ['src/components/AdminGiftSection.tsx', ['VirtualList', 'GiftCodeIcon']],
  ['src/components/AdminUserSection.tsx', ['VirtualRecordTable']],
  ['src/components/AdminAuctionSection.tsx', ['VirtualRecordTable', 'FactoryIcon']],
]) {
  if (!existsSync(resolve(root, path))) continue;
  for (const text of texts) requireText(path, text);
}

requireText('src/utils/orderBookLevels.ts', 'export function buildOrderBookLevels');
requireText('server/src/order-matching.js', 'export function matchIncomingOrder');
requireText('server/src/market-sell-fee.js', 'MARKET_SELL_FEE_VERSION = 4');

if (!failures.length) {
  const { buildOrderBookLevels } = await import('../src/utils/orderBookLevels.ts');
  const order = (id, side, price, quantity, remaining, status = 'open') => ({
    id,
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    side,
    price,
    quantity,
    remaining,
    status,
    createdAt: Number(id.replace(/\D/g, '')) || 1,
  });
  const buyLevels = buildOrderBookLevels([
    order('buy-1', 'buy', 10, 100, 2),
    order('buy-2', 'buy', 10, 200, 3, 'partial'),
    order('buy-3', 'buy', 9, 1, 1),
    order('buy-filled', 'buy', 99, 50, 50, 'filled'),
  ], 'buy');
  assert.deepEqual(buyLevels, [
    { side: 'buy', price: 10, remaining: 5, orderCount: 2 },
    { side: 'buy', price: 9, remaining: 1, orderCount: 1 },
  ]);
  const sellLevels = buildOrderBookLevels([
    order('sell-1', 'sell', 4, 8, 2),
    order('sell-2', 'sell', 2, 8, 3),
    order('sell-3', 'sell', 2, 9, 4, 'partial'),
  ], 'sell');
  assert.deepEqual(sellLevels, [
    { side: 'sell', price: 2, remaining: 7, orderCount: 2 },
    { side: 'sell', price: 4, remaining: 2, orderCount: 1 },
  ]);
}

if (failures.length) {
  console.error('商品即时市场、内部档位兼容、主视觉、窗口化记录与管理功能验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('商品即时市场资产验证通过：玩家只按当日服务器价格即时交易；公开商品盘口为空；内部人口／储备档位兼容、商品／工厂主视觉、本地成交窗口化与管理员高增长列表继续受保护。');
