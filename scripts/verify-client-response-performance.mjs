import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';
import {
  createStateDeliveryCache,
  STATE_PARTITION_NAMES,
  subscribeStateAuthorityDependencies,
} from '../src/app/stateDelivery.js';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少客户端响应性能规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 不得恢复客户端响应性能反模式: ${fragment}`);
  }
}

const partitionRevisions = Object.fromEntries(STATE_PARTITION_NAMES.map((name, index) => [
  name,
  `partition-${index + 1}`,
]));
const sliceRevisions = {
  'player.identity': 'player-identity-0001',
  'player.assets': 'player-assets-0001',
  'player.production': 'player-production-0001',
  'player.progression': 'player-progress-0001',
  'player.bank': 'player-bank-0001',
  'player.stats': 'player-stats-0001',
  'player.misc': 'player-misc-0001',
  'market.orders': 'market-orders-0001',
  'market.quotes': 'market-quotes-0001',
  'market.calendar': 'market-calendar-0001',
  'market.misc': 'market-misc-0001',
};
const cache = createStateDeliveryCache();
const initial = cache.accept({
  revision: 1,
  unchanged: false,
  serverNow: 1_000,
  partitionRevisions,
  sliceRevisions,
  patches: {
    catalog: {
      version: CURRENT_CLIENT_STATE_VERSION,
      products: [{ id: 'wheat' }],
      facilityTypes: [{ id: 'farm' }],
      researchLevels: [{ id: 'C1' }],
      provinces: [{ id: '110000' }],
      defaultProvinceId: '110000',
    },
    player: {
      userId: 1,
      playerName: '响应测试',
      credits: 100,
      inventories: { wheat: { available: 1, frozen: 0 } },
      facilityGroups: [],
      bankAccount: { depositCredits: 0 },
    },
    market: { orders: [], markets: { wheat: { lastPrice: 1 } } },
    auction: {},
    contract: {},
    leaderboard: {},
  },
});
assert.equal(initial.stateChanged, true);
assert.deepEqual(initial.changedPartitions, STATE_PARTITION_NAMES);
assert.equal(initial.state?.userId, 1);
assert.ok(initial.changedSlices.includes('player.assets'));
assert.ok(initial.changedSlices.includes('market.orders'));

const unchanged = cache.accept({
  revision: 1,
  unchanged: true,
  serverNow: 2_000,
});
assert.equal(unchanged.stateChanged, false);
assert.deepEqual(unchanged.changedPartitions, []);
assert.deepEqual(unchanged.changedSlices, []);
assert.equal(unchanged.state, initial.state, '未变化轮询必须复用完整状态对象');

const initialInventories = initial.state.inventories;
const initialFacilityGroups = initial.state.facilityGroups;
const initialOrders = initial.state.orders;
const bankSliceRevisions = { ...sliceRevisions, 'player.bank': 'player-bank-0002' };
const bankChanged = cache.accept({
  revision: 2,
  unchanged: false,
  serverNow: 3_000,
  sliceRevisions: bankSliceRevisions,
  patches: {
    player: {
      userId: 1,
      playerName: '响应测试',
      credits: 100,
      inventories: { wheat: { available: 1, frozen: 0 } },
      facilityGroups: [],
      bankAccount: { depositCredits: 1 },
    },
  },
});
assert.deepEqual(bankChanged.changedPartitions, ['player']);
assert.deepEqual(bankChanged.changedSlices, ['player.bank']);
assert.equal(bankChanged.state.inventories, initialInventories, '银行变化必须复用 player.assets 字段引用');
assert.equal(bankChanged.state.facilityGroups, initialFacilityGroups, '银行变化必须复用 player.production 字段引用');

let orderSignals = 0;
let quoteSignals = 0;
let bankSignals = 0;
const unsubscribeOrders = subscribeStateAuthorityDependencies(['market.orders'], () => { orderSignals += 1; });
const unsubscribeQuotes = subscribeStateAuthorityDependencies(['market.quotes'], () => { quoteSignals += 1; });
const unsubscribeBank = subscribeStateAuthorityDependencies(['player.bank'], () => { bankSignals += 1; });

const quoteSliceRevisions = { ...bankSliceRevisions, 'market.quotes': 'market-quotes-0002' };
const quoteChanged = cache.accept({
  revision: 3,
  unchanged: false,
  serverNow: 4_000,
  sliceRevisions: quoteSliceRevisions,
  patches: {
    market: {
      orders: [],
      markets: { wheat: { lastPrice: 2 } },
    },
  },
});
assert.deepEqual(quoteChanged.changedSlices, ['market.quotes']);
assert.equal(quoteChanged.state.orders, initialOrders, '纯行情变化必须复用 market.orders 数组引用');
assert.equal(orderSignals, 0, '纯行情变化不得通知 market.orders 消费者');
assert.equal(quoteSignals, 1, '纯行情变化必须通知 market.quotes 消费者');
assert.equal(bankSignals, 0, '行情变化不得通知 player.bank 消费者');

const orderSliceRevisions = { ...quoteSliceRevisions, 'market.orders': 'market-orders-0002' };
const orderChanged = cache.accept({
  revision: 4,
  unchanged: false,
  serverNow: 5_000,
  sliceRevisions: orderSliceRevisions,
  patches: {
    market: {
      orders: [{ id: 'order-1', status: 'open', remaining: 1 }],
      markets: { wheat: { lastPrice: 2 } },
    },
  },
});
assert.deepEqual(orderChanged.changedSlices, ['market.orders']);
assert.notEqual(orderChanged.state.orders, initialOrders, '订单子切片变化必须接受新订单数组');
assert.equal(orderSignals, 1, '订单变化必须通知 market.orders 消费者');
assert.equal(quoteSignals, 1, '订单变化不得通知 market.quotes 消费者');

cache.accept({ revision: 4, unchanged: true, serverNow: 6_000 });
assert.equal(orderSignals, 1, '无变化轮询不得通知子切片消费者');
assert.equal(quoteSignals, 1, '无变化轮询不得通知子切片消费者');
assert.equal(bankSignals, 0, '无变化轮询不得通知子切片消费者');
unsubscribeOrders();
unsubscribeQuotes();
unsubscribeBank();

const compatibility = cache.accept({
  revision: 5,
  unchanged: false,
  serverNow: 7_000,
  patches: { player: { userId: 1, credits: 101 } },
});
assert.ok(compatibility.changedSlices.includes('player.assets'), '旧服务端缺少子修订时必须退化为 player 全子切片更新');
assert.equal(cache.getSliceRevisions()['player.assets'], undefined, '旧服务端回退后不得继续使用陈旧子修订 token');

requireText('server/shared/economy-state-slices.js', [
  "'player.assets'",
  "'player.production'",
  "'player.bank'",
  "'market.orders'",
  "'market.quotes'",
  "'market.calendar'",
  'stateSliceNameForKey',
]);
requireText('server/src/state-partitions.js', [
  'createSliceRevisions',
  'sliceRevisions',
  "setRequestGauge('stateSliceCount'",
]);
requireText('src/app/stateDelivery.js', [
  'sliceAuthorityListeners',
  'changedSliceNames',
  'reuseUnchangedSliceReferences',
  'subscribeStateAuthorityDependencies',
  'delete nextSliceRevisions[sliceName]',
]);
requireText('src/app/gameAuthorityStore.ts', [
  'readGameAuthorityState',
  'useAuthorityRenderSnapshot',
  'useGameAuthorityDependencies',
  'getStateAuthoritySliceRevision',
  'parentPartitionForSlice',
]);
forbidText('src/app/gameAuthorityStore.ts', [
  'new Proxy',
  'AUTHORITY_STATE_VIEW',
]);
requireText('src/pages/PageRouter.tsx', [
  'PAGE_AUTHORITY_DEPENDENCIES',
  "market: ['catalog', 'player.assets', 'player.production', 'market.orders', 'market.quotes']",
  "bank: ['catalog', 'player.assets', 'player.production', 'player.bank']",
  "'gem-shop': ['catalog', 'player.assets']",
  'useGameAuthorityDependencies(dependencies);',
]);
requireText('src/components/shell/GameShell.tsx', [
  "useGameAuthorityDependencies(['player.identity', 'player.assets', 'leaderboard'])",
  'const statusItems = useMemo<StatusBarItem[]>(() => [',
]);
requireText('src/app/clientOrderIndex.ts', [
  'getClientOrderIndex',
  'orderById',
  'ownOpenOrders',
  'openOrdersByAsset',
  'commodityPriceExtrema',
  'managedCommodityOrder',
  'hasCrossingCommodityOrder',
]);
requireText('src/pages/MarketPage.tsx', [
  'getClientOrderIndex(game.orders)',
  'openOrdersForAsset(orderIndex, activeAssetKind, assetId)',
  'const ownOpenOrders = orderIndex.ownOpenOrders;',
  'const MarketOrderEntry = memo(forwardRef',
]);
requireText('src/auto-trade/useOnlineAutoTrade.ts', [
  'getClientOrderIndex(game.orders)',
  'managedCommodityOrder(',
  'hasCrossingCommodityOrder(',
  'statusCacheRef',
  'enabledSellProductIds',
  'subscribeStateAuthorityDependencies(',
  "['catalog', 'player.assets', 'player.production', 'market.orders', 'market.quotes', 'contract']",
]);
forbidText('src/auto-trade/useOnlineAutoTrade.ts', [
  'game.orders.some((order)',
  'game.orders.find((order)',
  "['catalog', 'player', 'market', 'contract']",
]);
requireText('src/hooks/useNow.ts', [
  'const sharedTickers = new Map',
  'subscribeSharedTicker',
  'useSyncExternalStore',
  'window.setInterval(() => signalTicker(ticker), interval)',
]);
requireText('src/components/time/LiveServerTime.tsx', [
  'export function LiveServerTime',
  'export function LiveDurationUntil',
]);
requireText('src/components/EconomicEventLogPanel.tsx', [
  'EconomicEventLogPanel',
  '<LiveServerTime referenceNow={referenceNow}>',
]);
forbidText('src/pages/BuildingsPage.tsx', ['useNow(game.lastProcessedAt)']);
forbidText('src/pages/AuctionPage.tsx', ['useNow(model.game.lastProcessedAt)']);
forbidText('src/pages/GemShopPage.tsx', ['useNow(model.game.lastProcessedAt)']);
forbidText('src/pages/ResearchPage.tsx', ['const now = useNow(model.game.lastProcessedAt);']);
forbidText('src/pages/OverviewPage.tsx', ['const now = useNow(game.lastProcessedAt);']);
requireText('src/pages/BankPage.tsx', ['useNow(referenceNow, 60_000)', 'LiveDurationUntil']);
requireText('src/pages/ResearchPage.tsx', ['useNow(model.game.lastProcessedAt, 10_000)', 'const liveNow = useNow(now);']);
requireText('src/pages/production/ProductionFacilityDetail.tsx', ['const liveNow = useNow(now);', 'useNow(now, 10_000)']);
requireText('src/game-guide/useGameTutorial.ts', ["subscribeStateAuthoritySlice('player.production', confirmProduction)"]);
requireText('tests/browser/clock-leaf.spec.ts', [
  'shared second ticker only commits the clock leaf, not its parent',
  'expect(later.parent).toBe(1)',
]);
requireText('tests/browser/partition-authority.spec.ts', [
  "await patch(page, 'playerBank')",
  "await patch(page, 'marketQuotes')",
  "await patch(page, 'marketOrders')",
  "await patch(page, 'marketCalendar')",
]);
requireText('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md', [
  '子修订',
  '页面根组件不得订阅默认 1 秒 ticker',
  '共享秒级 ticker',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '`sliceRevisions`',
  '六个外层分区保持不变',
]);
requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [
  '客户端订单索引',
  '只读派生加速器',
]);
requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', [
  '客户端订单索引',
  '`market.orders`',
]);

requireText('src/app/gameViewModel.ts', [
  'void syncConfirmedAction(response, action).finally(finish);',
]);
forbidText('src/app/gameViewModel.ts', [
  'await syncConfirmedAction(response, action);',
]);

if (failures.length > 0) {
  console.error('客户端响应性能防回退验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('客户端响应性能防回退验证通过：六分区外层协议、player/market 子修订结构共享、React render 快照一致性、子切片隔离、共享秒级叶子时钟和客户端订单索引均已锁定。');
