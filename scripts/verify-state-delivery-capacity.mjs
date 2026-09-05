import { readFileSync } from 'node:fs';
import { canAcceptRevision } from '../src/app/revisionGate.js';
import { createStateDeliveryCache } from '../src/app/stateDelivery.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';
import { createServerClock } from '../src/utils/serverClock.js';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少状态容量规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 恢复了禁止的状态容量规则: ${fragment}`);
  }
}

requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '?revision=N&catalog=',
  '`catalog`、`player`、`market`、`auction`、`contract`、`leaderboard`',
  '{ revision, unchanged: true, serverNow }',
  '`serverNow` 是状态交付 envelope 的顶层响应元数据',
  '不属于 `EconomyState`、世界 JSON 或任何状态分区',
  '每次 `GET state` 都必须生成当前值',
  '不能在客户端每次接收轮询时重新解释为当前服务器时间',
  '每个返回的 `patches[name]` 都是该分区的完整快照',
  '整块替换同名缓存分区',
  '字段缺失即代表该字段已经被服务器删除',
  '`catalog` 的必需目录字段必须在完整快照中同时存在',
  '客户端必须拒绝发布该坏状态并清空本地分区修订缓存，只允许自动执行一次无条件完整状态重拉',
  '普通玩家权威动作的持久化幂等确认仍固定为 `{ result: { ok, message }, revision }`',
  '动作事务和 `economy_idempotency.response_json` 只生成并保存这份精简确认',
  'HTTP 传输层在事务提交且权威写执行器释放串行写队列之后生成',
  '手动商品即时买卖是延迟敏感例外',
  '`commandRevision` 表示该命令实际提交时的世界修订号',
  '正常成功路径不得为了取得同一动作结果再追加一次 `GET state`',
  '补拉失败不得把已经提交成功的动作改写为失败',
  '`X-Economy-State-Revisions`',
  'Intent Overlay',
  '普通轮询不得承担时间推进',
  '正式服务的全局调度器保证到期处理延后不超过 1 秒',
  '正式客户端默认每 5 秒轮询一次修订号',
  '共享单调服务器时钟',
  '只有 `GET state` 或权威动作响应中的状态交付可以更新 `EconomyState`',
  '发起任一权威动作时必须使用 `AbortController` 取消正在进行的状态轮询',
  '存在重复提交风险的权威按钮必须在请求发出时同步进入本地“处理中”状态',
  'gzip_types application/json',
  '部署脚本必须修补既有游戏 API snippet 或手工 `location`',
  '超过 1 KB 的 HTML、JavaScript、CSS、JSON、SVG、Web Manifest、XML 与 WASM',
  '线上压缩响应体必须小于构建产物原始字节数',
  '扫描时必须跳过 `.bak`、`.backup-*` 与 `.economy-proxy.bak`',
  'Nginx reload 后必须在 5 秒窗口内',
]);

// 状态轮询、分区、修订门禁与动作 pending 属于服务器权威状态交付和客户端生命周期，
// 已由 SERVER DESIGN 与下方实际实现断言覆盖；PAGE DESIGN 不再复制状态协议规则。

requireText('scripts/configure-economy-nginx.py', [
  'STATIC_COMPRESSION_BEGIN',
  '(\"gzip_comp_level\", \"6\")',
  'text/css text/plain text/javascript application/javascript application/json',
  'application/atom+xml image/svg+xml application/wasm',
  'remove_top_level_directives',
  'ensure_static_compression',
  'ensure_static_vary_headers',
  'STATIC_VARY_HEADER',
  'NGINX_CONFIG_ROOTS',
  'NGINX_BACKUP_NAME_PATTERN',
  'is_nginx_backup_path',
  'collect_static_vary_changes',
  '/etc/nginx/snippets',
  'normalize_static_asset_path',
  'find_static_asset_paths',
  'validate_gzip_payload',
  '--resolve',
  '--connect-timeout',
  '--max-time',
  '443:127.0.0.1',
  'verify_static_compression',
  'verify_static_compression_after_reload',
  'STATIC_VERIFY_TIMEOUT_SECONDS',
  'ECONOMY_STATIC_GZIP_RETRY',
  'ECONOMY_STATIC_GZIP_RECOVERED',
  'ECONOMY_STATIC_GZIP_RETRY_EXHAUSTED',
  'ECONOMY_STATIC_GZIP_MISSING',
  'ECONOMY_STATIC_GZIP_VARY_MISSING',
  'ECONOMY_STATIC_GZIP_CONTENT_MISMATCH',
  'ECONOMY_STATIC_GZIP_NOT_SMALLER',
  'ECONOMY_STATIC_GZIP_VERIFIED',
]);
requireText('deploy/nginx/game.riversoft.top.economy-location.conf', [
  'location ^~ /economy/assets/',
  'location ^~ /economy/',
  'add_header Vary "Accept-Encoding" always;',
  'add_header Cache-Control "public, max-age=31536000, immutable" always;',
  'add_header Cache-Control "no-cache, max-age=0, must-revalidate" always;',
]);
const nginxConfigurator = read('scripts/configure-economy-nginx.py');
const staticCompressionStart = nginxConfigurator.indexOf('STATIC_COMPRESSION = (');
const staticCompressionEnd = nginxConfigurator.indexOf('STATIC_COMPRESSION_NAMES', staticCompressionStart);
const staticCompressionSource = staticCompressionStart >= 0 && staticCompressionEnd > staticCompressionStart
  ? nginxConfigurator.slice(staticCompressionStart, staticCompressionEnd)
  : '';
for (const fragment of ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'font/woff2']) {
  if (staticCompressionSource.includes(fragment)) {
    failures.push(`scripts/configure-economy-nginx.py 恢复了禁止的静态压缩类型: ${fragment}`);
  }
}
requireText('server/src/storage.js', [
  "immediate ? 'BEGIN IMMEDIATE' : 'BEGIN'",
  'this.worldCache = null',
  'this.scheduledProcessing = Boolean(scheduledProcessing)',
  'scheduleWorldProcessing()',
  'handleScheduledWorldWake(generation)',
  'this.setTimeoutFn(() => this.handleScheduledWorldWake(generation), delay)',
  'processScheduledWorld(now = this.nowProvider())',
  'structuredClone(this.worldCache.world)',
  'processWorldIfDue(world, now',
  '(this.scheduledProcessing || now < this.nextWorldProcessingAt)',
  'getStateSnapshot(user, knownRevision',
  'unchanged: true',
  'function createActionAcknowledgement(result, revision)',
  'const response = createActionAcknowledgement(gameResult, nextRevision);',
  'createActionAcknowledgement(cachedResponse.result, cachedResponse.revision)',
]);

forbidText('server/src/runtime-store.js', [
  "Object.defineProperty(response, 'stateSnapshot'",
  'value: this.getStateSnapshot(user, null, now)',
]);

requireText('server/src/world-storage-v2.js', [
  'prepareSegmentedWorldWrite(',
  'segmentedSnapshotsEqual(',
  'applySegmentedWorldWrite(',
]);

forbidText('server/src/storage.js', [
  'setInterval(',
  'JSON.parse(stateJson)',
  'candidate === previousStateJson',
  'const state = createVersionedClientState(world, Number(user.id), now);\n      const response',
  'normalizeJson({ result: gameResult, revision: nextRevision, state })',
]);
forbidText('server/src/leaderboards.js', [
  'STORE_HOOK',
  'EconomyStore.prototype',
]);

requireText('server/src/state-partitions.js', [
  "'catalog'",
  "'player'",
  "'market'",
  "'auction'",
  "'contract'",
  "'leaderboard'",
  "createHash('sha256')",
  'isValidCatalogPartitionSnapshot',
  'catalog.defaultProvinceId 不存在于 catalog.provinces',
  'prepared && !isValidCatalogPartitionSnapshot',
  'createPartitionedStateDelivery(snapshot, knownRevisions = {}, serverNow = Date.now())',
  'serverNow: responseServerNow',
  'createPartitionedActionDelivery',
  'const snapshot = actionResponse?.stateSnapshot',
  'commandRevision',
  "message: String(actionResponse?.result?.message || '')",
  'readKnownPartitionRevisionsFromSearch',
  'readKnownPartitionRevisionsFromHeader',
  'serializeAndDigestJson',
  'stateOrdersJsonBytes',
  'stateProvinceMarketsJsonBytes',
  'stateProvinceFacilityMarketsJsonBytes',
]);
forbidText('server/src/state-partitions.js', [
  "const CATALOG_KEYS = new Set(['version', 'products', 'facilityTypes', 'serverNow'])",
  "const MARKET_KEYS = new Set(['serverNow'",
]);

requireText('server/src/market-state-delivery.js', [
  'createMarketSummaryStatesByProvince',
  "includeOrderBook: assetKind !== 'commodity'",
  'todayBuyQuantity',
  'todaySellQuantity',
  'demand: { lastQuantity: demandLastQuantity, satisfaction: demandSatisfaction },',
  'createMarketDetail',
  'eventTradeWindows',
  'getOrderBookDepth',
  'function publicPricePoint(point)',
]);
requireText('server/src/runtime-store-core.js', [
  'getMarketDetail(user, options = {}',
  'marketDetailProjectionMs',
  'getFacilityBuildQuote(user, options = {}',
  'facilityBuildQuoteProjectionMs',
]);
requireText('server/src/app.js', [
  "path === '/api/game/market-detail'",
  "path === '/api/game/facility-build-quote'",
  "const compactManualCommodityOrder = route.action === 'placeOrder'",
  "payload.assetKind === 'commodity'",
  "sendJson(response, 200, actionResponse);",
  "Object.defineProperty(actionResponse, 'stateSnapshot'",
  'value: store.getStateSnapshot(user, null, actionDeliveryNow)',
  'createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow)',
]);
requireText('src/api/game.ts', [
  'const marketDetailCache = new Map<string, MarketDetail>()',
  'function rememberMarketDetail(key: string, detail: MarketDetail)',
  "(path === '/state' || path.startsWith('/state?')) && isStateDeliveryPayload(payload)",
  'if (payload.unchanged && cached) return rememberMarketDetail(key, cached)',
  'while (marketDetailCache.size > 32)',
  'getFacilityBuildProcurementQuote',
]);
requireText('server/test/state-delivery-size.test.js', [
  '48-province initial state remains below two MiB without embedded market histories',
  'TWO_MIB',
  "serialized.includes('cycleBuyQuantity')",
  "serialized.includes('baselineQuantity')",
]);
requireText('server/test/market-state-delivery.test.js', [
  'initial player state keeps market summaries and only the current player legacy orders',
  'commodity market detail returns bounded public real-trade history, empty public depth, and a conditional revision',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '首次未压缩 JSON 响应必须不超过 2 MiB',
  '状态读取 p95 不超过 800 ms',
  '市场详情 p95 不超过 300 ms',
  '事件循环 p99 不超过 200 ms',
  '普通商品市场状态摘要只允许携带玩家页面实际消费的当日 `officialPrice`',
  '不得复制服务器内部完整 `demand`',
  '只有独立市场详情接口负责返回有界成交历史与显式空盘口',
]);

requireText('server/src/app.js', [
  "url.searchParams.get('revision')",
  'store.getStateSnapshot(user, knownRevision)',
  'createPartitionedStateDelivery(',
  'createPartitionedActionDelivery(actionResponse, knownPartitions)',
  "request.headers['x-economy-state-revisions']",
]);

requireText('server/src/index.js', ["import './app.js'"]);

requireText('src/app/stateDelivery.d.ts', [
  'serverNow: number;',
  'StateDeliveryEnvelope',
  'StateDeliveryIntegrityError',
  'getActiveStatePartitionRevisions',
  'acceptExternalStateDelivery',
  "'contract'",
]);

requireText('src/app/stateDelivery.js', [
  'STATE_PARTITION_NAMES',
  "'contract'",
  'StateDeliveryIntegrityError',
  'catalogIntegrityIssue',
  'catalog.provinces',
  'nextPartitionRevisions',
  'validPartitionSnapshot',
  'mergeStatePatches',
  'partitions[name] = { ...patch }',
  'Object.assign(state, partition)',
  'createStateDeliveryCache',
  'activeDeliveryCache = cache',
  'acceptExternalStateDelivery',
  'getActiveStatePartitionRevisions',
  'payload.revision < revision',
]);
forbidText('src/app/stateDelivery.js', [
  'Object.assign(next, patch)',
]);

requireText('src/api/idempotentGameWriteFetch.ts', [
  'getActiveStatePartitionRevisions',
  "headers.set('X-Economy-State-Revisions', JSON.stringify(revisions))",
  'acceptExternalStateDelivery(payload);',
  'facilityToggleIntent',
  'runSerializedDirectControl',
  'acknowledgeFacilityEnabledIntent',
  'rejectFacilityEnabledIntent',
]);
requireText('src/app/immediateCommandIntent.ts', [
  'setFacilityEnabledIntent',
  'expectedSequence',
  'acknowledged: true',
  'reconcileFacilityEnabledIntent',
  'subscribeFacilityEnabledIntent',
]);
requireText('src/pages/production/ProductionFacilityDetail.tsx', [
  'useSyncExternalStore',
  'getFacilityEnabledIntent',
  'reconcileFacilityEnabledIntent',
  'checked={displayedEnabled}',
]);

requireText('src/utils/serverClock.js', [
  'createServerClock',
  'Math.max(incomingServerNow, currentEstimate)',
  'performance.now',
  'subscribe(listener)',
]);

requireText('src/api/game.ts', [
  'GameStatePollResponse',
  'StateDeliveryIntegrityError',
  'fetchGameStateWithRecovery',
  '服务器状态同步异常',
  'export interface GameActionResponse {',
  'result: GameActionResult;',
  'revision: number;',
  'knownPartitionRevisions()',
  "params.set('revision', String(revision))",
  'params.set(name, value)',
  'acceptServerNow(payload.serverNow)',
  'stateDeliveryCache.accept(payload)',
  'resetServerClock()',
  'signal?: AbortSignal',
]);
forbidText('src/api/game.ts', [
  "const STATE_REVISIONS_HEADER = 'X-Economy-State-Revisions'",
  'headers.set(STATE_REVISIONS_HEADER',
  'export interface GameActionResponse extends StateDeliveryEnvelope',
  'state?: EconomyState;\n}',
]);

requireText('src/app/gameViewModel.ts', [
  "useState('5')",
  'revisionRef.current',
  'canAcceptRevision(currentRevision, incomingRevision)',
  'getGameState(revisionRef.current, controller.signal)',
  'const authoritySnapshot = getGameAuthoritySnapshot();',
  'const stateResponse = await getGameState(revisionRef.current);',
  'stateResponse.revision < response.revision',
  '操作已完成，但状态同步失败',
  'syncConfirmedAction(response, action);',
  'finish();',
  'return response.result;',
  'refreshTaskRef.current?.controller.abort()',
  "mode === 'normal' && actionsInFlightRef.current > 0",
  'existing.controller.abort()',
]);
forbidText('src/app/gameViewModel.ts', [
  'acceptVersionedState(response.revision, response.state, action',
  'refreshAbortRef.current',
  '.finally(finish)',
]);
forbidText('src/app/gameViewModel.ts', [
  "action === 'work'",
  'workPendingRef',
  'setIsWorking(',
  "work: () => runAction('work'",
]);
forbidText('src/api/game.ts', ["postAction('/work')"]);
forbidText('server/src/game-routes.js', ["/api/game/work"]);

requireText('src/hooks/useNow.ts', [
  'estimateServerNow(referenceNow)',
  'const sharedTickers = new Map',
  'subscribeServerClock(() => signalTicker(ticker))',
  'useSyncExternalStore',
  'window.setInterval(() => signalTicker(ticker), interval)',
]);
forbidText('src/hooks/useNow.ts', [
  'referenceNow + Math.max(0, Date.now() - receivedAt)',
]);

forbidText('src/pages/OverviewPage.tsx', ['<OverviewWorkButton', 'cooldownUntil={game.work.cooldownUntil}']);
requireText('src/components/EconomicEventLogPanel.tsx', ['<LiveServerTime referenceNow={referenceNow}>']);

if (!canAcceptRevision(null, 1)
  || !canAcceptRevision(7, 7)
  || !canAcceptRevision(7, 8)
  || canAcceptRevision(7, 6)
  || canAcceptRevision(null, undefined)
  || canAcceptRevision(7, undefined)) {
  failures.push('revision 门禁必须只接受不低于当前值的有效修订号');
}

const deliveryCache = createStateDeliveryCache();
const initialDelivery = deliveryCache.accept({
  revision: 7,
  unchanged: false,
  serverNow: 10_000,
  partitionRevisions: {
    catalog: 'catalog-0001',
    player: 'player-00001',
    market: 'market-00001',
    auction: 'auction-0001',
    contract: 'contract-0001',
    leaderboard: 'leader-00001',
  },
  patches: {
    catalog: {
      version: CURRENT_CLIENT_STATE_VERSION,
      products: [{ id: 'wheat' }],
      facilityTypes: [{ id: 'farm' }],
      commercialBuildingTypes: [{ id: 'convenience-store' }],
      researchLevels: [{ id: 'C1' }],
      provinces: [{ id: '110000' }],
      defaultProvinceId: '110000',
    },
    player: {
      userId: 1,
      credits: 100,
      facilityGroups: [{ facilityTypeId: 'farm', count: 11 }],
      facilityConstruction: { facilityTypeId: 'farm', startedAt: 0, completesAt: 1_000 },
    },
    market: { orders: [] },
    auction: { assetAuctions: [{ id: 'auction-1' }] },
    contract: { productionContracts: [], productionContractSummary: { active: 0 } },
    leaderboard: { leaderboard: [] },
  },
});
const incrementalDelivery = deliveryCache.accept({
  revision: 8,
  unchanged: false,
  serverNow: 11_000,
  partitionRevisions: {
    catalog: 'catalog-0001',
    player: 'player-00002',
    market: 'market-00001',
    auction: 'auction-0001',
    contract: 'contract-0001',
    leaderboard: 'leader-00001',
  },
  patches: {
    player: {
      userId: 1,
      credits: 101,
      facilityGroups: [{ facilityTypeId: 'farm', count: 12 }],
    },
  },
});
const contractDelivery = deliveryCache.accept({
  revision: 9,
  unchanged: false,
  serverNow: 11_500,
  partitionRevisions: {
    catalog: 'catalog-0001',
    player: 'player-00002',
    market: 'market-00001',
    auction: 'auction-0001',
    contract: 'contract-0002',
    leaderboard: 'leader-00001',
  },
  patches: {
    contract: { productionContracts: [{ id: 'contract-1' }], productionContractSummary: { active: 1 } },
  },
});
const emptyPartitionDelivery = deliveryCache.accept({
  revision: 10,
  unchanged: false,
  serverNow: 12_000,
  partitionRevisions: {
    catalog: 'catalog-0001',
    player: 'player-00002',
    market: 'market-00001',
    auction: 'auction-0002',
    contract: 'contract-0002',
    leaderboard: 'leader-00001',
  },
  patches: { auction: {} },
});
const staleDelivery = deliveryCache.accept({
  revision: 6,
  unchanged: false,
  serverNow: 9_000,
  partitionRevisions: { player: 'player-stale' },
  patches: {
    player: {
      userId: 1,
      credits: 1,
      facilityGroups: [{ facilityTypeId: 'farm', count: 9 }],
      facilityConstruction: { facilityTypeId: 'farm', startedAt: 0, completesAt: 1_000 },
    },
  },
});
if (initialDelivery.state?.credits !== 100
  || initialDelivery.state?.provinces?.[0]?.id !== '110000'
  || initialDelivery.state?.defaultProvinceId !== '110000'
  || initialDelivery.state?.facilityGroups?.[0]?.count !== 11
  || !initialDelivery.state?.facilityConstruction
  || incrementalDelivery.state?.credits !== 101
  || incrementalDelivery.state?.facilityGroups?.[0]?.count !== 12
  || incrementalDelivery.state?.facilityConstruction !== undefined
  || contractDelivery.state?.productionContracts?.[0]?.id !== 'contract-1'
  || contractDelivery.state?.productionContractSummary?.active !== 1
  || emptyPartitionDelivery.state?.assetAuctions !== undefined
  || emptyPartitionDelivery.state?.productionContracts?.[0]?.id !== 'contract-1'
  || emptyPartitionDelivery.state?.orders?.length !== 0
  || staleDelivery.state?.credits !== 101
  || staleDelivery.state?.facilityGroups?.[0]?.count !== 12
  || staleDelivery.state?.facilityConstruction !== undefined
  || deliveryCache.getPartitionRevisions().player !== 'player-00002'
  || deliveryCache.getPartitionRevisions().auction !== 'auction-0002'
  || deliveryCache.getPartitionRevisions().contract !== 'contract-0002') {
  failures.push('客户端必须整块替换变化分区、删除服务器已省略字段、保留未变化分区，并拒绝旧全局修订号覆盖当前状态');
}

const integrityCache = createStateDeliveryCache();
let rejectedIncompleteCatalog = false;
try {
  integrityCache.accept({
    revision: 1,
    unchanged: false,
    serverNow: 10_000,
    partitionRevisions: {
      catalog: 'catalog-bad01',
      player: 'player-bad01',
      market: 'market-bad01',
      auction: 'auction-bad1',
      contract: 'contract-bad1',
      leaderboard: 'leader-bad01',
    },
    patches: {
      catalog: {
        version: CURRENT_CLIENT_STATE_VERSION,
        products: [{ id: 'wheat' }],
        facilityTypes: [{ id: 'farm' }],
        researchLevels: [{ id: 'C1' }],
        defaultProvinceId: '110000',
      },
      player: { userId: 1 },
      market: {},
      auction: {},
      contract: {},
      leaderboard: {},
    },
  });
} catch (reason) {
  rejectedIncompleteCatalog = reason?.name === 'StateDeliveryIntegrityError';
}
if (!rejectedIncompleteCatalog
  || integrityCache.getSnapshot().revision !== null
  || integrityCache.getSnapshot().state !== null
  || Object.keys(integrityCache.getPartitionRevisions()).length !== 0) {
  failures.push('客户端必须在发布权威状态前拒绝不完整 catalog，且失败接受不得污染修订号或分区缓存');
}

let monotonicNow = 1_000;
const serverClock = createServerClock(() => monotonicNow);
serverClock.accept(10_000);
monotonicNow = 6_000;
const beforeStalePoll = serverClock.now();
serverClock.accept(10_100);
const afterStalePoll = serverClock.now();
if (beforeStalePoll !== 15_000 || afterStalePoll !== 15_000) {
  failures.push('5 秒状态轮询携带较旧时间时，共享服务器时钟和工作冷却不得重新计时');
}

requireText('src/pages/SettingsPage.tsx', [
  '状态刷新频率',
  '<option value="3">每 3s</option>',
  '<option value="5">每 5s</option>',
  '<option value="10">每 10s</option>',
]);
forbidText('src/pages/SettingsPage.tsx', [
  '<option value="1">每 1s</option>',
  '<option value="3">每 3 秒</option>',
  '<option value="5">每 5 秒</option>',
  '<option value="10">每 10 秒</option>',
]);

for (const path of [
  'deploy/nginx/game.riversoft.top.economy-location.conf',
  'scripts/configure-economy-nginx.py',
]) {
  requireText(path, [
    'gzip on;',
    'gzip_vary on;',
    'gzip_proxied any;',
    'gzip_min_length 1024;',
    'gzip_comp_level 5;',
    'gzip_types application/json;',
  ]);
}

if (failures.length) {
  console.error(`状态交付容量验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('状态交付容量验证通过：世界缓存、单一全局调度、六分区增量交付与完整快照替换、catalog 完整性门禁与单次全量恢复、独立 serverNow、共享单调服务器时钟、动作权威增量回执与直接控制 Intent、修订号门禁、可抢占刷新任务、5 秒默认间隔和 JSON gzip 均已锁定。');
