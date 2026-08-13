import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';
import { createStateDeliveryCache, STATE_PARTITION_NAMES } from '../src/app/stateDelivery.js';

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

requireText('src/app/gameViewModel.ts', [
  'const gameRef = useRef<EconomyState | null>(null);',
  'if (gameRef.current === state) return false;',
  "changedPartitions.includes('catalog') || changedPartitions.includes('market')",
  'response.changedPartitions',
  'stateResponse.changedPartitions',
  "import { useDerivedGameData } from './useDerivedGameData';",
  'const derived = useDerivedGameData(game);',
]);
requireText('src/app/useDerivedGameData.ts', [
  'orders?.filter',
  'leaderboard?.find',
  'for (const group of facilityGroups ?? [])',
  'assetSummary.facilityValue',
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
requireText('src/app/GameApp.tsx', [
  'const setTabRef = useRef(appModel.setTab);',
  "const openBank = useCallback(() => setTabRef.current('bank'), []);",
  'const statusItems = useMemo<StatusBarItem[]>(() => [',
  'onClick: openBank,',
]);
requireText('src/pages/PageRouter.tsx', [
  'function cachedLoader<T>',
  'export function preloadPage(tab: TabId)',
  'const pagePreloaders: Record<TabId, () => Promise<unknown>>',
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
  '状态栏五项资产数据必须使用稳定 `statusItems` 引用',
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

console.log('客户端响应性能防回退验证通过：状态复用、分区门控、导航预加载、市场草稿隔离、窄依赖派生和稳定状态栏均已锁定。');
