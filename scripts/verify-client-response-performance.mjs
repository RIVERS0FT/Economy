import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';
import {
  createStateDeliveryCache,
  STATE_PARTITION_NAMES,
  subscribeStateAuthorityPartition,
  subscribeStateAuthorityPartitions,
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

const revisions = Object.fromEntries(STATE_PARTITION_NAMES.map((name, index) => [
  name,
  `partition-${index + 1}`,
]));
const cache = createStateDeliveryCache();
const initial = cache.accept({
  revision: 1,
  unchanged: false,
  serverNow: 1_000,
  partitionRevisions: revisions,
  patches: {
    catalog: { version: CURRENT_CLIENT_STATE_VERSION },
    player: { userId: 1 },
    market: { orders: [] },
    auction: {},
    contract: {},
    leaderboard: {},
  },
});
assert.equal(initial.stateChanged, true);
assert.deepEqual(initial.changedPartitions, STATE_PARTITION_NAMES);
assert.equal(initial.state?.userId, 1);

const unchanged = cache.accept({
  revision: 1,
  unchanged: true,
  serverNow: 2_000,
});
assert.equal(unchanged.stateChanged, false);
assert.deepEqual(unchanged.changedPartitions, []);
assert.equal(unchanged.state, initial.state, '未变化轮询必须复用完整状态对象');

const playerChanged = cache.accept({
  revision: 2,
  unchanged: false,
  serverNow: 3_000,
  patches: { player: { userId: 1, playerName: '响应测试' } },
});
assert.equal(playerChanged.stateChanged, true);
assert.deepEqual(playerChanged.changedPartitions, ['player']);
assert.notEqual(playerChanged.state, initial.state);

const marketChanged = cache.accept({
  revision: 3,
  unchanged: false,
  serverNow: 4_000,
  patches: { market: { orders: [{ id: 'order-1' }] } },
});
assert.equal(marketChanged.stateChanged, true);
assert.deepEqual(marketChanged.changedPartitions, ['market']);

const stale = cache.accept({
  revision: 2,
  unchanged: false,
  serverNow: 5_000,
  patches: { market: { orders: [] } },
});
assert.equal(stale.stateChanged, false);
assert.deepEqual(stale.changedPartitions, []);
assert.equal(stale.state, marketChanged.state, '迟到响应不得替换当前状态对象');

let marketSignals = 0;
let auctionSignals = 0;
let marketOrContractSignals = 0;
const unsubscribeMarket = subscribeStateAuthorityPartition('market', () => { marketSignals += 1; });
const unsubscribeAuction = subscribeStateAuthorityPartition('auction', () => { auctionSignals += 1; });
const unsubscribeMarketOrContract = subscribeStateAuthorityPartitions(
  ['market', 'contract'],
  () => { marketOrContractSignals += 1; },
);

cache.accept({
  revision: 4,
  unchanged: false,
  serverNow: 6_000,
  patches: { auction: { assetAuctions: [] } },
});
assert.equal(auctionSignals, 1, 'auction 更新必须只通知 auction 订阅');
assert.equal(marketSignals, 0, 'auction 更新不得通知 market 订阅');
assert.equal(marketOrContractSignals, 0, 'auction 更新不得通知 market+contract 订阅');

cache.accept({
  revision: 5,
  unchanged: false,
  serverNow: 7_000,
  patches: { contract: { productionContracts: [] } },
});
assert.equal(marketOrContractSignals, 1, 'contract 更新必须通知声明 contract 的组合订阅');
assert.equal(marketSignals, 0, 'contract 更新不得通知仅 market 订阅');

cache.accept({
  revision: 6,
  unchanged: false,
  serverNow: 8_000,
  patches: { market: { orders: [{ id: 'order-2' }] } },
});
assert.equal(marketSignals, 1, 'market 更新必须通知 market 订阅');
assert.equal(marketOrContractSignals, 2, 'market 更新必须通知声明 market 的组合订阅');
assert.equal(auctionSignals, 1, 'market 更新不得通知 auction 订阅');

cache.accept({ revision: 6, unchanged: true, serverNow: 9_000 });
assert.equal(marketSignals, 1, '无变化轮询不得通知分区订阅');
assert.equal(auctionSignals, 1, '无变化轮询不得通知分区订阅');
assert.equal(marketOrContractSignals, 2, '无变化轮询不得通知组合分区订阅');
unsubscribeMarket();
unsubscribeAuction();
unsubscribeMarketOrContract();

requireText('src/app/stateDelivery.js', [
  'partitionAuthorityListeners',
  'notifyPartitionListeners',
  'export function subscribeStateAuthorityPartition',
  'export function subscribeStateAuthorityPartitions',
]);
requireText('src/app/gameAuthorityStore.ts', [
  'AUTHORITY_STATE_VIEW',
  'readGameAuthorityState',
  'getStateAuthoritySnapshot().state !== null',
  'export function useGameAuthorityPartitions',
  'subscribeStateAuthorityPartitions',
]);
requireText('src/app/gameViewModel.ts', [
  'const gameRef = useRef<EconomyState | null>(null);',
  'if (gameRef.current === state) return false;',
  "changedPartitions.includes('catalog') || changedPartitions.includes('market')",
  'response.changedPartitions',
  'stateResponse.changedPartitions',
  "import { useDerivedGameData } from './useDerivedGameData';",
  'const derived = useDerivedGameData(game);',
]);
forbidText('src/app/gameViewModel.ts', [
  'const [game, setGame] = useState<EconomyState | null>',
]);
requireText('src/app/useDerivedGameData.ts', [
  'deriveGameDataSnapshot',
  'orders?.filter',
  'leaderboard?.find',
  'for (const group of facilityGroups ?? [])',
  'DERIVED_GAME_DATA_VIEW',
  'readGameAuthorityState()',
]);
requireText('src/pages/MarketPage.tsx', [
  'const MarketOrderEntry = memo(forwardRef',
  'useImperativeHandle(ref, () => ({ fillPrice: setPriceValue })',
  'const productById = useMemo',
  'const facilityGroupByTypeId = useMemo',
  'const selectedOrders = useMemo',
  'const ownOpenOrders = useMemo',
  'const bestAsks = useMemo',
  'const marketBuckets = useMemo',
  'key={`${marketAssetKind}:${assetId}:${orderSide}`}',
]);
forbidText('src/pages/MarketPage.tsx', [
  'setOrderPrice(parsed)',
  'setOrderQuantity(parsed)',
  'setOrderPrice(normalized)',
  'setOrderQuantity(normalized)',
]);
requireText('src/pages/PageRouter.tsx', [
  'function cachedLoader<T>',
  'export function preloadPage(tab: TabId)',
  'const pagePreloaders: Record<TabId, () => Promise<unknown>>',
  'const PAGE_AUTHORITY_PARTITIONS: Record<TabId, readonly StatePartitionName[]>',
  "market: ['catalog', 'player', 'market']",
  "production: ['catalog', 'player', 'market', 'contract']",
  "auction: ['catalog', 'player', 'auction']",
  "contracts: ['catalog', 'player', 'market', 'contract']",
  "leaderboard: ['catalog', 'player', 'leaderboard']",
  'function AuthorityPageBoundary',
  'useGameAuthorityPartitions(partitions);',
]);
requireText('src/components/shell/GameShell.tsx', [
  "useGameAuthorityPartitions(['player', 'leaderboard'])",
  'const statusItems = useMemo<StatusBarItem[]>(() => [',
  'onClick: openBank,',
  'playerName={game.playerName}',
]);
requireText('src/hooks/useNavigationBadges.ts', [
  'useGameAuthorityPartitions([',
  "'market'",
  "'auction'",
  "'contract'",
  "'leaderboard'",
]);
requireText('src/hooks/useNotificationCenter.ts', [
  "useGameAuthorityPartitions(['catalog', 'player', 'auction', 'contract'])",
  'derivePendingNotificationItems(game)',
]);
requireText('src/components/system/AuthoritativeCountdownRefresh.tsx', [
  'useGameAuthorityPartitions([',
  "'auction'",
  "'contract'",
  "'leaderboard'",
]);
requireText('src/auto-trade/useOnlineAutoTrade.ts', [
  'subscribeStateAuthorityPartitions(',
  "['catalog', 'player', 'market', 'contract']",
  'maintainAutoTrade',
]);
requireText('src/game-guide/useGameTutorial.ts', [
  "subscribeStateAuthorityPartition('player', confirmProduction)",
]);
forbidText('src/app/GameApp.tsx', [
  'const statusItems = useMemo<StatusBarItem[]>',
  'useGameAuthorityState()',
  'useGameAuthorityPartitions(',
]);
requireText('src/components/shell/NavigationItems.tsx', [
  'onPointerEnter={preload}',
  'onPointerDown={preload}',
  'onFocus={preload}',
]);
requireText('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md', [
  '`stateChanged`',
  '`changedPartitions`',
  '不得执行 `setGame`',
  '市场下单的价格与数量草稿必须留在 `MarketOrderEntry` 局部状态',
  '根级 `derived` 只能按真实数据引用分组重算',
  '根级游戏控制器只允许持有稳定的只读权威状态视图',
  '`useGameAuthorityPartitions`',
  '页面和外壳必须声明自己消费的状态分区',
]);
requireText('docs/README.md', [
  '允许页面或共享组件按分区订阅',
  '`useSyncExternalStore`',
]);
requireText('package.json', [
  '"verify:client-response": "node scripts/verify-client-response-performance.mjs"',
  'npm run verify:client-response',
]);

if (failures.length > 0) {
  console.error('客户端响应性能防回退验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('客户端响应性能防回退验证通过：状态复用、分区通知、页面与外壳六分区 React 隔离、市场草稿隔离、窄依赖派生和导航预加载均已锁定。');
