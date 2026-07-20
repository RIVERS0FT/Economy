import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push('缺少文件: ' + path); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(path + ' 缺少: ' + text); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(path + ' 不应包含: ' + text); };
[
  'src/pages/MarketPage.tsx','src/pages/ProductionPage.tsx','src/pages/SettingsPage.tsx','src/app/AdminApp.tsx',
  'src/app/gameViewModel.ts','src/utils/defaultOrderPrice.ts','src/utils/orderIdentity.ts','src/utils/orderBookLevels.ts',
  'src/api/admin.ts','src/styles/unified-market-admin.css','src/styles/virtual-list.css','server/src/domain.js','server/src/domain-core.js','server/src/facility-groups.js','server/src/storage.js',
  'server/src/market-demand.js','server/src/market-liquidity.js','server/src/balanced-market.js','server/src/order-book-integrity.js','server/src/market-demand/price-transmission.js',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md','docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md','docs/GIFT_CODE_AND_ADMIN_DESIGN.md','docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'src/utils/localActivityStore.ts','src/types.ts','src/components/ui/layout.tsx','src/components/ui/VirtualList.tsx','src/components/icons/GameIcons.tsx'
].forEach(requireFile);
for (const text of [
  'unified-asset-tabs','placeAssetOrder','single-order-book','order-book-divider','items={localTrades}',
  'local-trades-virtual-table','virtual-record-viewport','VirtualList',
  "import { FactoryIcon } from '../components/icons/GameIcons'",'<FactoryIcon />','selectOrderSide',
  'title={selectedAssetTitle(`${assetName}订单`)}','label="价格"','className="numeric-cell">价格</th>',
  'formatNumber(order.remaining)','formatCurrency(order.price)',
  "import { buildOrderBookLevels } from '../utils/orderBookLevels'",
  "buildOrderBookLevels(selectedOrders, 'sell').reverse()",
  "buildOrderBookLevels(selectedOrders, 'buy')",
  '最低价前 5 档','最高价前 5 档','data-order-count={level.orderCount}',
  '合计剩余 ${formatNumber(level.remaining)}','包含 ${formatNumber(level.orderCount)} 笔订单',
  'key={`sell-${level.price}`}','key={`buy-${level.price}`}',
]) requireText('src/pages/MarketPage.tsx', text);
for (const text of [
  'localTrades.map(','market-stat-strip','工厂数量市场','仅保存在当前浏览器；更换设备或清除网站数据后不会恢复。','>⚙</span>','限价',
  '最低价前 5 笔','最高价前 5 笔',
  ".filter((order) => order.side === 'sell')\n    .sort(",
  ".filter((order) => order.side === 'buy')\n    .sort(",
]) forbidText('src/pages/MarketPage.tsx', text);

for (const text of [
  'export interface OrderBookLevel','export function buildOrderBookLevels','const levels = new Map<number, OrderBookLevel>()',
  "order.side !== side", "!['open', 'partial'].includes(order.status)", 'order.remaining <= 0',
  'current.remaining += order.remaining','current.orderCount += 1','price: order.price','remaining: order.remaining','orderCount: 1',
  ".sort(side === 'buy'", '.slice(0, normalizedLimit)',
]) requireText('src/utils/orderBookLevels.ts', text);
for (const text of ['order.quantity +', 'order.quantity *', 'createdAt', 'ownerId', 'ownerName']) {
  forbidText('src/utils/orderBookLevels.ts', text);
}

for (const text of [
  'items={collectibles}','items={giftCodes}','items={ownership}','items={redemptions}',
  'admin-collectibles-virtual-table','admin-gifts-virtual-table','admin-redemptions-virtual-table',
]) requireText('src/app/AdminApp.tsx', text);
for (const text of ['collectibles.map(','giftCodes.map(','ownership.map(','redemptions.map(']) forbidText('src/app/AdminApp.tsx', text);

for (const text of [
  'ResizeObserver','overscan','measuredSizesRef','aria-setsize','virtual-list__canvas',
]) requireText('src/components/ui/VirtualList.tsx', text);
for (const text of ['virtual-record-table','virtual-record-row','asset-event-virtual-list']) requireText('src/styles/virtual-list.css', text);

for (const text of [
  "import type { AssetKind, AssetOrder, OrderSide } from '../types'",
  "!['open', 'partial'].includes(order.status) || order.remaining <= 0",
  'orderKind(order) !== assetKind || orderAssetId(order) !== assetId',
  'Number.isFinite(price) && Number.isInteger(price) && price >= 1',
  'Math.max(bestBid, order.price)',
  'Math.min(bestAsk, order.price)',
  '? bestAsk ?? bestBid ?? 1',
  ': bestBid ?? bestAsk ?? 1',
]) requireText('src/utils/defaultOrderPrice.ts', text);
for (const text of ['lastPrice','basePrice','systemValue','valuationPrices','getGameState','refresh']) forbidText('src/utils/defaultOrderPrice.ts', text);
for (const text of [
  "order.assetKind === 'facility' || order.facilityTypeId",
  "order.assetId || order.facilityTypeId || ''",
  "order.assetId || order.productId || 'wheat'",
]) requireText('src/utils/orderIdentity.ts', text);

for (const text of [
  "import { defaultOrderPrice } from '../utils/defaultOrderPrice'",
  'setTab: (tab: TabId) => void;',
  'selectOrderSide: (side: OrderSide) => void;',
  "const [tab, setActiveTab] = useState<TabId>('home');",
  "const [orderSide, setOrderSideState] = useState<OrderSide>('buy');",
  'const [orderPrice, setOrderPrice] = useState(1);',
  'const loadedGame = game;',
  "if (nextTab === 'market' && tab !== 'market')",
  'defaultOrderPrice(loadedGame.orders, marketAssetKind, marketAssetId, orderSide)',
  "if (changed || tab !== 'market')",
  'defaultOrderPrice(loadedGame.orders, kind, assetId, orderSide)',
  'function selectOrderSide(side: OrderSide)',
  'defaultOrderPrice(loadedGame.orders, marketAssetKind, marketAssetId, side)',
]) requireText('src/app/gameViewModel.ts', text);
for (const text of [
  'const [orderPrice, setOrderPrice] = useState(6);',
  'setOrderPrice(market.lastPrice)',
  'orderSide, setOrderSide,',
]) forbidText('src/app/gameViewModel.ts', text);

requireText('src/components/icons/GameIcons.tsx', 'export function FactoryIcon');
requireText('src/components/icons/GameIcons.tsx', 'M17 6V3h3v17');
for (const text of [
  'SwitchControl',
  '运行中 <strong>{formatNumber(group.participatingCount)}</strong>',
  '下一周期加入 <strong>{formatNumber(group.pendingJoinCount)}</strong>',
  '冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong>',
  'facility-recipe-section',
  '生产配方',
  '下一周期切换为：',
  '前往市场交易该工厂',
  '前往市场交易该工厂 →',
]) requireText('src/pages/ProductionPage.tsx', text);
for (const text of [
  'facility-power-button','产成品去向','挂牌数量','单座价格','启动全部未挂牌工厂','停止全部',
  '>保存计划</Button>','下一周期按 ','<span>冻结 <strong>{group.listedCount}</strong></span>'
]) forbidText('src/pages/ProductionPage.tsx', text);
for (const text of ['点击工作次数','生产商品总数','买入商品总数','卖出商品总数','礼品兑换','退出登录']) requireText('src/pages/SettingsPage.tsx', text);
for (const text of ['登录会话','重置经济状态','重置服务器经济状态']) forbidText('src/pages/SettingsPage.tsx', text);
for (const text of ["label: '仓库剩余'", "id: 'warehouse'"]) requireText('src/app/GameApp.tsx', text);
for (const text of ["id: 'inventory'", "id: 'market'"]) forbidText('src/app/GameApp.tsx', text);
for (const text of ['assetKind','matchFacilityOrder','reduceRunningGroupForSellOrder','valuationPricesFor','recentTradePriceFor','lastTradePrice','world.version = 13','reconcileFacilityGroup','activeRecipeId','pendingRecipeId','removeSystemFacilityOrders','SELF_CROSS_MESSAGE']) requireText('server/src/facility-groups.js', text);
for (const text of ['refreshFacilityLiquidity','系统资产采购','系统资产供给']) forbidText('server/src/facility-groups.js', text);
for (const text of ['SELF_CROSS_MESSAGE','findSelfCrossingOrder','pricesCross','bestSystemPrice','systemBookIsCrossed']) requireText('server/src/order-book-integrity.js', text);
const domainSource = [
  'server/src/domain.js',
  'server/src/domain-core.js',
  'server/src/market-demand.js',
  'server/src/market-liquidity.js',
  'server/src/balanced-market.js',
  'server/src/order-book-integrity.js',
  'server/src/market-demand/price-transmission.js',
].map(read).join('\n');
for (const text of ['workCooldownMs: 10_000','workClicks','boughtGoods','soldGoods','processPriceTransmission','costAnchor','downstreamValueAnchor','liquidity-buy','liquidity-sell','settleLiquidityBuy','settleLiquiditySell','findSelfCrossingOrder','systemBookIsCrossed']) {
  if (!domainSource.includes(text)) failures.push('领域实现缺少: ' + text);
}
for (const text of ['market.lastPrice - 2','market.lastPrice + 2']) {
  if (domainSource.includes(text)) failures.push('领域实现不应包含: ' + text);
}
for (const text of ['economy_gift_codes','economy_gift_redemptions','requireAdmin','getAdminSummary']) requireText('server/src/storage.js', text);
for (const text of ['export interface OrderFill','fills?: OrderFill[]','isOwn?: boolean',"FacilityStatus = 'running' | 'stopped' | 'error'"]) requireText('src/types.ts', text);
for (const text of ['STORAGE_VERSION = 5','previousFillIds','fill.price','fill.total','normalizeTrades']) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['makerOrderId','takerOrderId','counterparty: string']) forbidText('src/types.ts', text);
for (const text of ['fill.counterparty','trade.counterparty']) forbidText('src/utils/localActivityStore.ts', text);
for (const text of ['after.markets[assetId]?.lastPrice','after.facilityMarkets[assetId]?.lastPrice','executedQuantity * price']) forbidText('src/utils/localActivityStore.ts', text);
for (const text of [
  'maker price','反推玩家成交价','逐笔','工厂资产标签使用独立厂房 SVG',
  '玩家界面统一将订单输入字段称为“价格”',
  '默认价格只从客户端当前已经加载的 `game.orders` 本地快照计算',
  '从其他页面重新进入市场页',
  '自动刷新、下单响应、成交、撤单或其他权威状态同步只更新本地订单快照，不得直接覆盖当前价格输入',
  '商品订单只允许玩家、消费需求或市场储备作为所有者',
  '市场储备可以提交商品买单和卖单',
  '任何系统订单之间都不得成交',
  '工厂订单仍只能由玩家提交',
  '同资产、同方向、同价格的有效订单按当前剩余数量聚合为价格档位',
  '档位聚合只属于客户端匿名展示',
  '聚合完成后再按最优价格截取 5 档',
  '最高系统买价 < 最低系统卖价',
  '服务器必须在冻结任何资金、商品或工厂之前拒绝新订单',
  '不同主体之间可成交的交叉订单必须在新订单进入订单簿时立即按 maker price 撮合',
  '模型 4 升级到 5 时必须删除全部旧系统商品订单',
]) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);
for (const text of [
  '玩家可见输入字段、订单标题和未完成订单表头统一使用“价格”',
  '从其他页面重新进入市场',
  '自动刷新和下单后的状态同步不得覆盖当前输入',
  '订单簿按价格档位聚合展示',
  '我的未完成订单继续逐单展示并可单独撤销',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  '必须使用共享 `VirtualList` 窗口化组件',
  'DOM 只创建当前滚动视口及少量 `overscan` 范围内的记录',
  '不得用分页、截断、`slice` 或只显示最近记录替代窗口化',
]) requireText('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', text);
for (const text of [
  '藏品列表、礼品码列表、归属历史和兑换记录可能持续增长，必须复用共享 `VirtualList`',
  '对管理员藏品、礼品码、归属或兑换记录恢复全量 `.map()` DOM 渲染',
]) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);

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
    order('buy-4', 'buy', 8, 1, 1),
    order('buy-5', 'buy', 7, 1, 1),
    order('buy-6', 'buy', 6, 1, 1),
    order('buy-7', 'buy', 5, 1, 1),
    order('buy-filled', 'buy', 99, 50, 50, 'filled'),
    order('buy-cancelled', 'buy', 98, 50, 50, 'cancelled'),
    order('buy-zero', 'buy', 97, 50, 0),
    order('sell-other-side', 'sell', 100, 1, 1),
  ], 'buy');
  assert.deepEqual(buyLevels, [
    { side: 'buy', price: 10, remaining: 5, orderCount: 2 },
    { side: 'buy', price: 9, remaining: 1, orderCount: 1 },
    { side: 'buy', price: 8, remaining: 1, orderCount: 1 },
    { side: 'buy', price: 7, remaining: 1, orderCount: 1 },
    { side: 'buy', price: 6, remaining: 1, orderCount: 1 },
  ]);

  const sellLevels = buildOrderBookLevels([
    order('sell-1', 'sell', 4, 8, 2),
    order('sell-2', 'sell', 2, 8, 3),
    order('sell-3', 'sell', 2, 9, 4, 'partial'),
    order('sell-4', 'sell', 3, 1, 1),
    order('sell-5', 'sell', 1, 1, 1),
    order('sell-6', 'sell', 5, 1, 1),
    order('sell-7', 'sell', 6, 1, 1),
  ], 'sell');
  assert.deepEqual(sellLevels, [
    { side: 'sell', price: 1, remaining: 1, orderCount: 1 },
    { side: 'sell', price: 2, remaining: 7, orderCount: 2 },
    { side: 'sell', price: 3, remaining: 1, orderCount: 1 },
    { side: 'sell', price: 4, remaining: 2, orderCount: 1 },
    { side: 'sell', price: 5, remaining: 1, orderCount: 1 },
  ]);
}

if (failures.length) { console.error('统一资产市场、价格档位、窗口化记录与管理功能验证失败:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('统一资产市场、非交叉撮合、价格档位聚合、玩家／消费需求／市场储备商品订单、窗口化本地成交、管理员高增长记录和本地默认价格验证通过。');
