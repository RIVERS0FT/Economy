from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))


def replace_between(path: str, start_marker: str, end_marker: str, replacement: str) -> None:
    content = read(path)
    start = content.find(start_marker)
    end = content.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise RuntimeError(f'{path}: markers not found: {start_marker!r} -> {end_marker!r}')
    write(path, content[:start] + replacement + content[end:])


def append_once(path: str, marker: str, block: str) -> None:
    content = read(path)
    if marker in content:
        raise RuntimeError(f'{path}: marker already present: {marker}')
    if not content.endswith('\n'):
        content += '\n'
    write(path, content + '\n' + block.strip() + '\n')


# Route resolution must validate every public action against the registry and use registry rate-limit metadata.
replace_once(
    'server/src/game-routes.js',
    'export function decodeRouteParameter(value) {',
    "import { requirePlayerActionMetadata } from './player-action-registry.js';\n\nexport function decodeRouteParameter(value) {",
)
replace_once(
    'server/src/game-routes.js',
    'export function resolveAction(method, path) {',
    'function resolveActionUnchecked(method, path) {',
)
append_once(
    'server/src/game-routes.js',
    'const metadata = requirePlayerActionMetadata(route.action);',
    '''
export function resolveAction(method, path) {
  const route = resolveActionUnchecked(method, path);
  if (!route) return null;
  const metadata = requirePlayerActionMetadata(route.action);
  return { ...route, category: metadata.rateLimitCategory };
}
''',
)

# Runtime actions use the registry for monitoring metadata and pass the real action to the scope resolver.
replace_once(
    'server/src/runtime-action-executor.js',
    "import { applyPlayerProfileAction } from './player-profile.js';\n",
    "import { applyPlayerProfileAction } from './player-profile.js';\nimport { requirePlayerActionMetadata } from './player-action-registry.js';\n",
)
replace_once(
    'server/src/runtime-action-executor.js',
    "import { measureRequestPhase } from './request-performance.js';",
    "import { measureRequestPhase, setRequestGauge } from './request-performance.js';",
)
replace_once(
    'server/src/runtime-action-executor.js',
    """  const payload = normalizePlayerMoneyPayload(action, requestMeta.payload);
  const mutationScopeAction = action === 'settleProduction'
    ? 'setFacilityRecipe'
    : FACTORY_AUTO_OPERATION_REBUILD_ACTIONS.has(action)
      ? 'factoryAutoOperationRebuild'
      : action;
  const mutationScope = createRuntimeMutationScope(
    store.worldCache?.world,
    user.id,
    mutationScopeAction,
    payload,
""",
    """  const actionMetadata = requirePlayerActionMetadata(action);
  setRequestGauge('interactiveActionBudgetMs', actionMetadata.latencyBudgetMs);
  setRequestGauge('interactiveActionRegistered', 1);
  const payload = normalizePlayerMoneyPayload(action, requestMeta.payload);
  const mutationScope = createRuntimeMutationScope(
    store.worldCache?.world,
    user.id,
    action,
    payload,
""",
)

# Mutation Scope is registry-driven; active production interactions may never silently become unbounded.
replace_once(
    'server/src/world-storage-v2.js',
    "import { installProvinceRuntimeAliases } from './provinces.js';\n",
    "import { installProvinceRuntimeAliases } from './provinces.js';\nimport { getPlayerActionMetadata, requireOrderExecutionMetadata } from './player-action-registry.js';\n",
)
replace_between(
    'server/src/world-storage-v2.js',
    'const LOCAL_PLAYER_ACTIONS = new Set([',
    'const CORE_LOCAL_SEGMENTS = Object.freeze([',
    'const CORE_LOCAL_SEGMENTS = Object.freeze([',
)

new_scope_function = r'''function orderValidationScope(userId, label) {
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: new Set([playerKey(userId)]),
    segments: new Set([...CORE_LOCAL_SEGMENTS, 'orders']),
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label,
  };
}

function interactiveScopeError(action, message, code = 'INTERACTIVE_ACTION_SCOPE_UNDECLARED', statusCode = 500) {
  setRequestGauge('unexpectedFullWorldAction', 1);
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.action = String(action || '');
  return error;
}

function publishMutationScopeGauges(scope) {
  setRequestGauge('mutationScopeFullWorld', scope.allPlayers && scope.allSegments ? 1 : 0);
  setRequestGauge('mutationScopePlayerCount', scope.playerIds?.size || 0);
  setRequestGauge('mutationScopeSegmentCount', scope.segments?.size || 0);
  setRequestGauge('mutationScopeOrderCount', scope.orderIndexes?.size || 0);
  setRequestGauge('mutationScopeMarketKeyCount', scope.marketKeys?.size || 0);
  setRequestGauge('mutationScopeFacilityMarketKeyCount', scope.facilityMarketKeys?.size || 0);
}

function finalizeInteractiveMutationScope(action, scope) {
  if (
    !scope
    || scope.allPlayers
    || scope.allSegments
    || scope.playerIds === null
    || scope.segments === null
  ) {
    throw interactiveScopeError(
      action,
      `正式玩家动作不得使用未声明或无界 Mutation Scope：${String(action || '')}`,
    );
  }
  setRequestGauge('unexpectedFullWorldAction', 0);
  publishMutationScopeGauges(scope);
  return scope;
}

function invalidScopeInput(action, payload) {
  const execution = action === 'placeOrder' ? `，execution=${String(payload?.execution || '')}` : '';
  return interactiveScopeError(
    action,
    `无法从动作参数推导安全 Mutation Scope：${String(action || '')}${execution}`,
    'INTERACTIVE_ACTION_SCOPE_INPUT_INVALID',
    400,
  );
}

export function createRuntimeMutationScope(world, userId, action, payload, {
  scheduledProcessing = true,
} = {}) {
  if (!scheduledProcessing) return createFullMutationScope();

  const metadata = getPlayerActionMetadata(action);
  if (!metadata) {
    throw interactiveScopeError(action, `正式玩家动作未登记 Mutation Scope：${String(action || '')}`);
  }
  if (metadata.lifecycle !== 'active' || metadata.mutationScope === 'none') {
    throw interactiveScopeError(
      action,
      `非活动玩家动作不得进入权威写事务：${String(action || '')}`,
      'INTERACTIVE_ACTION_RETIRED',
      410,
    );
  }

  let scope = null;
  switch (metadata.mutationScope) {
    case 'local-player':
      scope = {
        allPlayers: false,
        allSegments: false,
        playerIds: new Set([playerKey(userId)]),
        segments: new Set(CORE_LOCAL_SEGMENTS),
        orderIndexes: new Set(),
        marketKeys: new Set(),
        facilityMarketKeys: new Set(),
        includeAuctionEscrow: false,
        label: `local:${action}`,
      };
      break;
    case 'factory':
      scope = factoryAutoOperationScope(world, userId, payload);
      break;
    case 'profile':
      scope = profileMutationScope(world, userId, payload);
      break;
    case 'contract':
      scope = contractMutationScope(world, userId, payload, action);
      break;
    case 'facility-listing':
      scope = facilityListingMutationScope(world, userId, payload, action);
      break;
    case 'auction':
      scope = {
        allPlayers: false,
        allSegments: false,
        playerIds: auctionParticipantIds(world, payload, userId),
        segments: new Set([...CORE_LOCAL_SEGMENTS, 'assetAuctions']),
        orderIndexes: new Set(),
        marketKeys: new Set(),
        facilityMarketKeys: new Set(),
        includeAuctionEscrow: true,
        label: `auction:${action}`,
      };
      break;
    case 'order': {
      if (action === 'cancelOrder') {
        scope = cancelScope(world, userId, payload)
          || orderValidationScope(userId, 'order:cancel-validation');
        break;
      }
      if (action !== 'placeOrder') break;
      const execution = String(payload?.execution || '');
      const executionMetadata = requireOrderExecutionMetadata(execution);
      if (executionMetadata.mutationScope === 'factory-policy') {
        scope = factoryAutoOperationScope(world, userId, payload);
        break;
      }
      if (executionMetadata.mutationScope === 'local-order-policy') {
        scope = orderScope(world, userId, [ordinaryOrderAsset(payload)], {
          label: `commodity:${executionMetadata.label}`,
          currentPlayerOrdersOnly: true,
        });
        break;
      }
      if (executionMetadata.mutationScope === 'procurement') {
        scope = orderScope(world, userId, procurementAssets(payload), {
          label: 'commodity:facility-build-procurement',
          mutateMarkets: true,
        });
        break;
      }
      if (executionMetadata.mutationScope === 'procurement-cancel') {
        scope = orderScope(world, userId, procurementCancelAssets(world, payload), {
          label: 'commodity:facility-build-procurement-cancel',
          currentPlayerOrdersOnly: true,
        }) || orderValidationScope(userId, 'commodity:facility-build-procurement-cancel-validation');
        break;
      }
      if (executionMetadata.mutationScope === 'active-order') {
        const asset = ordinaryOrderAsset(payload);
        const label = !execution && asset.kind === 'commodity'
          ? 'commodity:placeOrder'
          : `${asset.kind}:placeOrder${execution ? `:${execution}` : ''}`;
        scope = orderScope(world, userId, [asset], {
          label,
          mutateMarkets: true,
        });
        if (scope) scope.playerIds = crossingOrderParticipantIds(world, payload, userId);
      }
      break;
    }
    default:
      break;
  }

  if (!scope) throw invalidScopeInput(action, payload);
  return finalizeInteractiveMutationScope(action, scope);
}

'''
replace_between(
    'server/src/world-storage-v2.js',
    'export function createRuntimeMutationScope(world, userId, action, payload, {',
    'function cloneScopedObject(source, keys) {',
    new_scope_function + 'function cloneScopedObject(source, keys) {',
)

# Request monitoring uses the per-action budget, and any unexpected unbounded scope is an outlier even if fast.
replace_once(
    'server/src/request-metrics.js',
    """    if (status >= 500 || duration >= slowRequestMs || bytes >= largeResponseBytes) {
      warn('Economy request outlier', JSON.stringify({
""",
    """    const interactiveBudgetMs = finiteNonNegative(gauges?.interactiveActionBudgetMs);
    const slowThresholdMs = interactiveBudgetMs > 0
      ? Math.min(slowRequestMs, interactiveBudgetMs)
      : slowRequestMs;
    const unexpectedFullWorldAction = Number(gauges?.unexpectedFullWorldAction || 0) > 0;
    if (status >= 500 || duration >= slowThresholdMs || bytes >= largeResponseBytes || unexpectedFullWorldAction) {
      warn('Economy request outlier', JSON.stringify({
""",
)

# Production settlement no longer relies on the ambiguous setFacilityRecipe alias; its registry scope is explicit.
replace_once(
    'scripts/verify-production-lazy-settlement.mjs',
    "const runtimeAction = read('server/src/runtime-action-executor.js');\n",
    "const runtimeAction = read('server/src/runtime-action-executor.js');\nconst actionRegistry = read('server/src/player-action-registry.js');\n",
)
replace_once(
    'scripts/verify-production-lazy-settlement.mjs',
    """assert.match(
  runtimeAction,
  /const mutationScopeAction = action === 'settleProduction'[\\s\\S]*?\\? 'setFacilityRecipe'/,
  '独立生产结算必须继续映射到 setFacilityRecipe 的本地玩家 COW 范围',
);
assert.match(
  runtimeAction,
  /createRuntimeMutationScope\\([\\s\\S]*?mutationScopeAction,/,
  '生产结算与其他玩家动作必须通过解析后的 mutationScopeAction 创建 COW 范围',
);
""",
    """assert.doesNotMatch(runtimeAction, /mutationScopeAction/, '玩家动作不得再依赖分散的 Mutation Scope 别名映射');
assert.match(
  runtimeAction,
  /createRuntimeMutationScope\\([\\s\\S]*?user\\.id,[\\s\\S]*?action,[\\s\\S]*?payload,/,
  '生产结算与其他玩家动作必须使用真实 action 进入统一 Mutation Scope 注册表',
);
assert.match(
  actionRegistry,
  /settleProduction: defineAction\\(\\{ mutationScope: 'local-player', domain: 'production' \\}\\)/,
  '独立生产结算必须在统一动作注册表中显式声明当前玩家局部范围',
);
""",
)

# Existing world-storage tests should use real public actions rather than internal scope aliases.
replace_once(
    'server/test/world-storage-v2.test.js',
    "createRuntimeMutationScope(world, 1, 'factoryAutoOperationRebuild', {",
    "createRuntimeMutationScope(world, 1, 'buildFacility', {",
)
replace_once(
    'server/test/world-storage-v2.test.js',
    "test('production settlement alias remains current-player local after factory scopes are specialized', () => {",
    "test('production settlement remains current-player local through the action registry', () => {",
)
replace_once(
    'server/test/world-storage-v2.test.js',
    "const scope = createRuntimeMutationScope(world, 1, 'setFacilityRecipe', {}, { scheduledProcessing: true });\n  assert.deepEqual([...scope.playerIds], ['1']);\n  assert.equal(scope.label, 'local:setFacilityRecipe');",
    "const scope = createRuntimeMutationScope(world, 1, 'settleProduction', {}, { scheduledProcessing: true });\n  assert.deepEqual([...scope.playerIds], ['1']);\n  assert.equal(scope.label, 'local:settleProduction');",
)
append_once(
    'server/test/world-storage-v2.test.js',
    "test('unregistered interactive actions are rejected instead of falling back to full-world mutation'",
    '''
test('unregistered interactive actions are rejected instead of falling back to full-world mutation', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const error = assert.throws(() => createRuntimeMutationScope(
    world,
    1,
    'futureUnregisteredAction',
    {},
    { scheduledProcessing: true },
  ));
  assert.equal(error.code, 'INTERACTIVE_ACTION_SCOPE_UNDECLARED');
  assert.equal(error.statusCode, 500);

  const testScope = createRuntimeMutationScope(world, 1, 'futureUnregisteredAction', {}, {
    scheduledProcessing: false,
  });
  assert.equal(testScope.allPlayers, true);
  assert.equal(testScope.allSegments, true);
});

test('local action scope size stays constant as unrelated player count grows', () => {
  const players = Object.fromEntries(Array.from({ length: 1_001 }, (_, index) => [
    String(index + 1),
    { userId: index + 1, credits: 5000, unlockedProvinces: ['110000'] },
  ]));
  const world = {
    players,
    orders: [],
    markets: {},
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'unlockProvince', { provinceId: '130000' }, {
    scheduledProcessing: true,
  });
  assert.equal(scope.playerIds.size, 1);
  assert.equal(scope.allPlayers, false);
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.equal(draft.players['1001'], world.players['1001']);
});

test('unknown order execution modes are rejected before mutation scope fallback', () => {
  const world = {
    players: { 1: { userId: 1 } },
    orders: [], markets: {},
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const error = assert.throws(() => createRuntimeMutationScope(world, 1, 'placeOrder', {
    execution: 'future-unregistered-execution',
    productId: 'wheat',
    side: 'buy',
    price: 10,
    quantity: 1,
  }, { scheduledProcessing: true }));
  assert.equal(error.code, 'ORDER_EXECUTION_UNREGISTERED');
  assert.equal(error.statusCode, 400);
});
''',
)

# Runtime verifier now enforces registry completeness, route/execution coverage and per-action monitoring budgets.
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    "import assert from 'node:assert/strict';\n",
    "import assert from 'node:assert/strict';\nimport { createRequestMetricsCollector } from '../server/src/request-metrics.js';\nimport { ORDER_EXECUTION_REGISTRY, PLAYER_ACTION_REGISTRY } from '../server/src/player-action-registry.js';\n",
)
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    "assert.equal(POLLING_IDLE_AFTER_MS, 30_000);\n",
    """assert.equal(POLLING_IDLE_AFTER_MS, 30_000);

const validMutationScopes = new Set(['local-player', 'factory', 'profile', 'contract', 'facility-listing', 'auction', 'order']);
for (const [action, metadata] of Object.entries(PLAYER_ACTION_REGISTRY)) {
  assert.ok(Number(metadata.latencyBudgetMs) > 0, `${action} 必须声明交互延迟预算`);
  if (metadata.lifecycle === 'active') {
    assert.equal(metadata.acknowledgement, 'immediate', `${action} 必须在服务器确认后立即完成交互`);
    assert.ok(validMutationScopes.has(metadata.mutationScope), `${action} 必须显式声明 Mutation Scope`);
  }
}
const routeSource = read('server/src/game-routes.js');
const routeActionCandidates = new Set([...routeSource.matchAll(/'([a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)'/g)].map((match) => match[1]));
for (const action of routeActionCandidates) {
  assert.ok(PLAYER_ACTION_REGISTRY[action], `公开路由动作必须登记在统一注册表: ${action}`);
}
for (const [action, metadata] of Object.entries(PLAYER_ACTION_REGISTRY)) {
  if (metadata.publicRoute) assert.ok(routeSource.includes(`'${action}'`), `公开注册动作必须存在路由: ${action}`);
}
const runtimeActionSourceForRegistry = read('server/src/runtime-action-executor.js');
const runtimeOrderExecutions = new Set([...runtimeActionSourceForRegistry.matchAll(/payload\\.execution === '([^']+)'/g)].map((match) => match[1]));
for (const execution of runtimeOrderExecutions) {
  assert.ok(ORDER_EXECUTION_REGISTRY[execution], `订单执行方式必须登记: ${execution}`);
}
for (const execution of Object.keys(ORDER_EXECUTION_REGISTRY).filter(Boolean)) {
  assert.ok(runtimeActionSourceForRegistry.includes(`'${execution}'`), `已登记订单执行方式必须由运行时处理: ${execution}`);
}
const metricWarnings = [];
const metricCollector = createRequestMetricsCollector({
  slowRequestMs: 1_000,
  warn: (...args) => metricWarnings.push(args),
  log: () => {},
});
metricCollector.record({
  method: 'POST',
  url: '/api/game/check-in',
  statusCode: 200,
  durationMs: 300,
  responseBytes: 64,
  gauges: { interactiveActionBudgetMs: 250, mutationScopeFullWorld: 0 },
});
assert.equal(metricWarnings.length, 1, '玩家动作超过自身延迟预算时必须进入请求异常日志');
""",
)
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    """requireText('server/src/request-performance.js', [
  'AsyncLocalStorage',
  'measureRequestPhase',
  'setRequestGauge',
  'snapshotRequestPerformance',
]);
""",
    """requireText('server/src/request-performance.js', [
  'AsyncLocalStorage',
  'measureRequestPhase',
  'setRequestGauge',
  'snapshotRequestPerformance',
]);
requireText('server/src/player-action-registry.js', [
  'PLAYER_ACTION_REGISTRY',
  'ORDER_EXECUTION_REGISTRY',
  'latencyBudgetMs',
  "acknowledgement = 'immediate'",
  'mutationScope',
]);
requireText('server/src/request-metrics.js', [
  'interactiveActionBudgetMs',
  'unexpectedFullWorldAction',
  'slowThresholdMs',
]);
""",
)
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    """requireText('server/src/world-storage-v2.js', [
  'WORLD_STORAGE_SCHEMA_VERSION = 2',
  'AUTHORITATIVE_WORLD_VERSION = 32',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'economy_world_meta',
  'economy_world_players',
  'economy_world_segments',
  \"label: 'commodity:placeOrder'\",
  'FACTORY_SCOPE_ACTIONS',
  'factoryAutoOperationScope',
  'profileMutationScope',
  'contractMutationScope',
  'facilityListingMutationScope',
  \"execution === 'factory-auto-operation-policy'\",
]);
""",
    """requireText('server/src/world-storage-v2.js', [
  'WORLD_STORAGE_SCHEMA_VERSION = 2',
  'AUTHORITATIVE_WORLD_VERSION = 32',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'economy_world_meta',
  'economy_world_players',
  'economy_world_segments',
  \"? 'commodity:placeOrder'\",
  'getPlayerActionMetadata(action)',
  'requireOrderExecutionMetadata(execution)',
  'finalizeInteractiveMutationScope',
  'unexpectedFullWorldAction',
  'factoryAutoOperationScope',
  'profileMutationScope',
  'contractMutationScope',
  'facilityListingMutationScope',
]);
const worldStorageSource = read('server/src/world-storage-v2.js');
assert.equal(worldStorageSource.includes('FACTORY_SCOPE_ACTIONS'), false, 'Mutation Scope 动作集合不得在存储层重复维护');
assert.equal(worldStorageSource.includes('LOCAL_PLAYER_ACTIONS'), false, '本地玩家动作集合不得在存储层重复维护');
assert.equal(worldStorageSource.includes('return createFullMutationScope();\\n}\\n\\nfunction cloneScopedObject'), false, '正式玩家动作不得在函数末尾静默回退 full-world');
""",
)
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    """requireText('server/src/runtime-action-executor.js', [
  \"measureRequestPhase('playerSnapshotMs'\",
  \"measureRequestPhase('economicInvariantMs'\",
  \"? 'setFacilityRecipe'\",
]);
""",
    """requireText('server/src/runtime-action-executor.js', [
  \"measureRequestPhase('playerSnapshotMs'\",
  \"measureRequestPhase('economicInvariantMs'\",
  'requirePlayerActionMetadata(action)',
  \"setRequestGauge('interactiveActionBudgetMs'\",
  'createRuntimeMutationScope(',
]);
assert.equal(read('server/src/runtime-action-executor.js').includes('mutationScopeAction'), false, '运行时不得维护第二份 Mutation Scope 动作映射');
requireText('server/src/game-routes.js', [
  'function resolveActionUnchecked',
  'const metadata = requirePlayerActionMetadata(route.action);',
  'category: metadata.rateLimitCategory',
]);
""",
)

# Client verifier globally rejects new blocking authoritative refreshes after a confirmed player action.
replace_once(
    'scripts/verify-client-response-performance.mjs',
    "import { readFileSync } from 'node:fs';",
    "import { readFileSync, readdirSync } from 'node:fs';",
)
replace_once(
    'scripts/verify-client-response-performance.mjs',
    "const failures = [];\n",
    """const failures = [];

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}
""",
)
replace_once(
    'scripts/verify-client-response-performance.mjs',
    """forbidText('src/app/gameViewModel.ts', [
  'await syncConfirmedAction(response, action);',
]);
const buildingsSource = read('src/pages/BuildingsPage.tsx');
""",
    """forbidText('src/app/gameViewModel.ts', [
  'await syncConfirmedAction(response, action);',
]);
const blockingRefreshAllowlist = new Map([
  ['src/auto-trade/useOnlineAutoTrade.ts', 1],
]);
for (const path of sourceFiles('src')) {
  const count = (read(path).match(/await model\\.refresh\\(\\{ mode: 'authoritative' \\}\\);/g) || []).length;
  const allowed = blockingRefreshAllowlist.get(path) || 0;
  assert.equal(
    count,
    allowed,
    `${path} 新增了阻塞式权威状态补拉；普通玩家动作确认后必须立即返回，确需阻塞的迁移路径必须显式登记`,
  );
}
const buildingsSource = read('src/pages/BuildingsPage.tsx');
""",
)

# Design authority: registered actions are mandatory in production; full-world fallback is test-only.
replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    '> 更新时间：2026-08-29',
    '> 更新时间：2026-08-30',
)
replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    "- `domain.js`：唯一公共领域门面，其他服务器模块只从此导入公共能力；",
    "- `domain.js`：唯一公共领域门面，其他服务器模块只从此导入公共能力；\n- `player-action-registry.js`：普通玩家可达 Action 的统一元数据注册表，唯一声明限流类别、显式 Mutation Scope、确认语义、延迟等级／预算、公开路由状态与订单 execution 白名单；路由、运行时 COW、请求监控和防回退验证共同读取该注册表；",
)
replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    '未知或尚未局部化的动作可以暂时退回完整草稿，但不得为了回滚、投影或持久化再创建第二份完整世界。',
    '普通玩家可达 Action 必须先登记到统一玩家动作注册表并显式声明 Mutation Scope；正式 `scheduledProcessing` 服务遇到未登记 Action、未登记订单 execution、无法从参数推导安全 scope 或任何 `allPlayers`／`allSegments` 无界 scope 时必须拒绝请求，不得静默退回完整世界草稿。只有关闭正式调度的内存测试／兼容测试可以显式使用 full-world 草稿，以保持旧测试确定性。',
)
replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    '普通商品下单只复制下单者、当前价格可交叉的玩家对手方、订单／市场及必要核心资金域；商品撤单只复制下单者、订单及必要核心资金域；拍卖动作只复制相关卖方／当前最高出价者／当前操作者、拍卖及必要核心资金域。',
    '普通商品下单只复制下单者、当前价格可交叉的玩家对手方、订单／市场及必要核心资金域；商品撤单只复制下单者、订单及必要核心资金域；拍卖动作只复制相关卖方／当前最高出价者／当前操作者、拍卖及必要核心资金域。统一注册表同时为本地、市场和合同类交互声明 250ms、500ms、750ms 请求延迟预算；请求指标必须输出 `interactiveActionBudgetMs`、Mutation Scope 玩家数／segment 数／订单数／市场键数和 `unexpectedFullWorldAction`，超过动作自身预算、出现 5xx 或发现意外无界 scope 时进入异常请求日志。',
)

print('interactive action guardrails applied')
