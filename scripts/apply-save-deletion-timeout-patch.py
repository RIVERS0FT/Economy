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
        raise RuntimeError(f'{path}: expected exactly one match, found {count}: {old[:160]!r}')
    write(path, content.replace(old, new, 1))


def regex_replace_once(path: str, pattern: str, replacement: str) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{path}: expected one regex match, found {count}: {pattern[:160]!r}')
    write(path, updated)


# Register save deletion as a first-class interactive write class so special routes cannot bypass scope rules.
replace_once(
    'server/src/player-action-registry.js',
    "  'auction',\n  'order',\n]);",
    "  'auction',\n  'order',\n  'save-deletion',\n]);",
)
replace_once(
    'server/src/player-action-registry.js',
    "export const PLAYER_ACTION_REGISTRY = Object.freeze({\n  checkIn: defineAction({ mutationScope: 'local-player' }),",
    """export const PLAYER_ACTION_REGISTRY = Object.freeze({
  saveDeletionPreflight: defineAction({ mutationScope: 'save-deletion', domain: 'save-deletion', latencyClass: 'market', publicRoute: false }),
  saveDeletion: defineAction({ mutationScope: 'save-deletion', domain: 'save-deletion', latencyClass: 'market', publicRoute: false }),
  checkIn: defineAction({ mutationScope: 'local-player' }),""",
)

# Give save deletion a bounded COW scope. Preflight only mutates the actor/core accounting state;
# commit additionally clones the bounded shared collections it can rewrite.
save_scope_helper = r'''
function saveDeletionMutationScope(userId, payload) {
  const preflight = payload?.preflight === true;
  const segments = new Set(CORE_LOCAL_SEGMENTS);
  if (!preflight) {
    for (const key of ['orders', 'facilityListings', 'assetAuctions', 'productionContracts']) segments.add(key);
  }
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: new Set([playerKey(userId)]),
    segments,
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: !preflight,
    label: preflight ? 'save-deletion:preflight' : 'save-deletion:commit',
  };
}
'''
replace_once(
    'server/src/world-storage-v2.js',
    "function orderValidationScope(userId, label) {\n",
    save_scope_helper.strip() + "\n\nfunction orderValidationScope(userId, label) {\n",
)
replace_once(
    'server/src/world-storage-v2.js',
    """    case 'facility-listing':
      scope = facilityListingMutationScope(world, userId, payload, action);
      break;
    case 'auction':
""",
    """    case 'facility-listing':
      scope = facilityListingMutationScope(world, userId, payload, action);
      break;
    case 'save-deletion':
      scope = saveDeletionMutationScope(userId, payload);
      break;
    case 'auction':
""",
)

# Expose a single-player facility-state initializer instead of migrating/reconciling every player after rebuilding a save.
player_facility_helper = r'''
export function ensurePlayerFacilityGroupState(world, player, now = Date.now()) {
  migrateLegacyPlayer(world, player, now);
  player.facilityGroups = (player.facilityGroups || [])
    .map((group) => normalizeGroup(group, now))
    .filter(Boolean);
  for (const group of player.facilityGroups) {
    const available = availableGroupCount(world, player, group);
    if (group.status === 'running') {
      const previousCount = group.participatingCount;
      if (available > previousCount) expandAvailableFacilities(group, previousCount, available, now);
      else group.participatingCount = available;
      if (group.participatingCount < 1) setGroupError(group, 'no_available_facility', now);
    }
    reconcileFacilityGroup(world, player, group, now);
  }
  return player.facilityGroups;
}
'''
replace_once(
    'server/src/facility-groups.js',
    "export function migrateFacilityGroupWorld(world, now = Date.now()) {\n",
    player_facility_helper.strip() + "\n\nexport function migrateFacilityGroupWorld(world, now = Date.now()) {\n",
)

# Cancelling an unaccepted contract during save deletion must not run the global contract processor again.
contract_cancel_helper = r'''
export function cancelOpenProductionContractForSaveDeletion(world, user, contractId, now = Date.now()) {
  const runtimeIndex = createContractRuntimeIndex(world);
  return cancelOpenContract(world, user, { contractId }, now, runtimeIndex);
}
'''
replace_once(
    'server/src/contracts.js',
    "function prepareContract(world, user, payload, runtimeIndex) {\n",
    contract_cancel_helper.strip() + "\n\nfunction prepareContract(world, user, payload, runtimeIndex) {\n",
)

# Save deletion now uses the same explicit registry/scope/latency instrumentation as normal player actions.
replace_once(
    'server/src/save-deletion.js',
    """import { ensurePlayer } from './domain.js';
import { applyFacilityGroupAction, migrateFacilityGroupWorld } from './facility-groups.js';
import { applyAssetAuctionAction } from './asset-auctions.js';
import { applyProductionContractAction } from './contracts.js';
""",
    """import { ensurePlayer } from './domain.js';
import { ensurePlayerFacilityGroupState } from './facility-groups.js';
import { applyAssetAuctionAction } from './asset-auctions.js';
import { cancelOpenProductionContractForSaveDeletion } from './contracts.js';
""",
)
replace_once(
    'server/src/save-deletion.js',
    "import { ensureGemState } from './invitations.js';\nimport { migrateResearchWorld } from './research.js';\n",
    """import { ensureGemState } from './invitations.js';
import { ensurePlayerResearch } from './research.js';
import { requirePlayerActionMetadata } from './player-action-registry.js';
import { setRequestGauge } from './request-performance.js';
import { createRuntimeMutationScope } from './world-storage-v2.js';
""",
)
replace_once(
    'server/src/save-deletion.js',
    """function preparePlayerSystems(world, player, now) {
  ensureWarehouse(player);
  ensureGemState(player);
  ensureBankWorld(world, now);
  ensurePlayerBankAccount(player, now);
  ensureWeeklyCashSettlementWorld(world, now);
  ensurePlayerWeeklyCashSettlement(player, now);
}
""",
    """function preparePlayerSystems(store, world, player, now) {
  const normalizePlayers = !store.scheduledProcessing;
  ensureWarehouse(player);
  ensureGemState(player);
  ensureBankWorld(world, now, { normalizePlayers });
  ensurePlayerBankAccount(player, now);
  ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers });
  ensurePlayerWeeklyCashSettlement(player, now);
}

function saveDeletionMutationScope(store, user, preflight) {
  const action = preflight ? 'saveDeletionPreflight' : 'saveDeletion';
  const metadata = requirePlayerActionMetadata(action);
  setRequestGauge('interactiveActionBudgetMs', metadata.latencyBudgetMs);
  setRequestGauge('interactiveActionRegistered', 1);
  return createRuntimeMutationScope(
    store.worldCache?.world,
    user.id,
    action,
    { preflight },
    { scheduledProcessing: store.scheduledProcessing },
  );
}
""",
)
regex_replace_once(
    'server/src/save-deletion.js',
    r"function loadPreparedWorld\(store, user, now, expectedSaveEpoch, validateSaveEpoch = false\) \{.*?\n\}\n\nexport function getPlayerSaveDeletionPreflight",
    """function loadPreparedWorld(
  store,
  user,
  now,
  expectedSaveEpoch,
  { validateSaveEpoch = false, preflight = false } = {},
) {
  const mutationScope = saveDeletionMutationScope(store, user, preflight);
  const loaded = store.loadWorld(now, mutationScope);
  const player = ensurePlayer(loaded.world, user, now);
  if (validateSaveEpoch) assertExpectedSaveEpoch(player.saveEpoch, expectedSaveEpoch);
  preparePlayerSystems(store, loaded.world, player, now);
  if (!store.scheduledProcessing) {
    store.processWorldIfDue(loaded.world, now, Number(user.id), {
      force: true,
      auditTrigger: 'save_deletion_preflight',
    });
  }
  settlePlayerWeeklyCashOnLogin(loaded.world, player, now, {
    processWorld: !store.scheduledProcessing,
  });
  return { ...loaded, player, mutationScope };
}

export function getPlayerSaveDeletionPreflight""",
)
replace_once(
    'server/src/save-deletion.js',
    """    const { revision, stateJson, world, player } = loadPreparedWorld(store, user, now);
    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson);
""",
    """    const { revision, stateJson, world, player, mutationScope } = loadPreparedWorld(
      store,
      user,
      now,
      undefined,
      { preflight: true },
    );
    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson, mutationScope);
""",
)
regex_replace_once(
    'server/src/save-deletion.js',
    r"function closeOwnedResources\(world, user, preflight, now\) \{.*?\n  return \{ \.\.\.preflight\.autoClose \};\n\}",
    """function closeOwnedResources(world, user, preflight, now) {
  world.orders = (world.orders || []).filter(
    (order) => Number(order?.ownerId) !== Number(user.id),
  );
  world.facilityListings = (world.facilityListings || []).filter(
    (listing) => Number(listing?.ownerId) !== Number(user.id),
  );

  for (const auction of [...(world.assetAuctions || [])]) {
    if (
      !isOpenAuction(auction)
      || Number(auction?.sellerId) !== Number(user.id)
      || auction.highestBidderId
      || Number(auction.bidCount || 0) > 0
    ) continue;
    requireSuccessful(
      applyAssetAuctionAction(
        world,
        user,
        'cancelAuction',
        { auctionId: auction.id },
        now,
        { migrate: false, process: false },
      ),
      `取消拍卖 ${String(auction.id)}`,
    );
  }

  for (const contract of [...(world.productionContracts || [])]) {
    if (contract?.status !== 'open' || Number(contract?.publisherId) !== Number(user.id)) continue;
    requireSuccessful(
      cancelOpenProductionContractForSaveDeletion(world, user, contract.id, now),
      `取消合同 ${String(contract.id)}`,
    );
  }

  return { ...preflight.autoClose };
}""",
)
regex_replace_once(
    'server/src/save-deletion.js',
    r"function rebuildPlayer\(world, user, previous, now\) \{.*?\n  return \{ player, saveEpochBefore, saveEpochAfter \};\n\}",
    """function rebuildPlayer(store, world, user, previous, now) {
  const registeredAt = Math.max(0, Number(previous.registeredAt || now));
  const gems = safeNonNegativeInteger(previous.gems);
  const gemStats = permanentGemStats(previous);
  const saveEpochBefore = safeNonNegativeInteger(previous.saveEpoch);
  const saveEpochAfter = saveEpochBefore + 1;

  delete world.players[String(user.id)];
  const player = ensurePlayer(world, user, now);
  player.registeredAt = registeredAt;
  player.gems = gems;
  player.saveEpoch = saveEpochAfter;
  player.saveCreatedAt = now;
  player.saveResetCount = safeNonNegativeInteger(previous.saveResetCount) + 1;
  Object.assign(player.stats, gemStats);

  preparePlayerSystems(store, world, player, now);
  ensurePlayerFacilityGroupState(world, player, now);
  ensurePlayerResearch(world, player, now);

  return { player, saveEpochBefore, saveEpochAfter };
}""",
)
replace_once(
    'server/src/save-deletion.js',
    """    const { revision, world, player } = loadPreparedWorld(store, user, now, expectedSaveEpoch, true);
""",
    """    const { revision, world, player, mutationScope } = loadPreparedWorld(
      store,
      user,
      now,
      expectedSaveEpoch,
      { validateSaveEpoch: true },
    );
""",
)
replace_once(
    'server/src/save-deletion.js',
    """    const { saveEpochBefore, saveEpochAfter } = rebuildPlayer(world, user, player, now);
    statements.deleteTutorialCompletion.run(Number(user.id));
    const nextRevision = store.saveWorld(revision, world, now);
""",
    """    const { saveEpochBefore, saveEpochAfter } = rebuildPlayer(store, world, user, player, now);
    statements.deleteTutorialCompletion.run(Number(user.id));
    const nextRevision = store.saveWorld(revision, world, now, mutationScope);
""",
)

# Add a production-mode regression: unrelated player and market objects must remain shared across deletion.
replace_once(
    'server/test/save-deletion.test.js',
    "import { ensurePlayerBankAccount } from '../src/banking.js';\n",
    """import { ensurePlayerBankAccount } from '../src/banking.js';
import { cloneWorldForMutation, createRuntimeMutationScope } from '../src/world-storage-v2.js';
""",
)
append_test = r'''

test('scheduled save deletion keeps unrelated players and markets shared', () => {
  const inertTimer = { unref() {} };
  const store = new EconomyStore(':memory:', {
    scheduledProcessing: true,
    nowProvider: () => now,
    setTimeoutFn: () => inertTimer,
    clearTimeoutFn: () => {},
  });
  const unrelatedUser = {
    id: 91002,
    name: 'Unrelated Save Player',
    email: 'unrelated-save@example.com',
    role: 'user',
  };
  try {
    store.getState(user, now);
    store.transaction(() => {
      const { revision, world } = store.loadWorld(now + 1);
      ensurePlayer(world, unrelatedUser, now + 1);
      store.saveWorld(revision, world, now + 1);
    });

    const committed = store.worldCache.world;
    const unrelatedPlayer = committed.players[String(unrelatedUser.id)];
    const markets = committed.markets;
    const preflightScope = createRuntimeMutationScope(
      committed,
      user.id,
      'saveDeletionPreflight',
      { preflight: true },
      { scheduledProcessing: true },
    );
    const preflightDraft = cloneWorldForMutation(committed, preflightScope);
    assert.equal(preflightScope.label, 'save-deletion:preflight');
    assert.notEqual(preflightDraft.players[String(user.id)], committed.players[String(user.id)]);
    assert.equal(preflightDraft.players[String(unrelatedUser.id)], unrelatedPlayer);
    assert.equal(preflightDraft.orders, committed.orders);
    assert.equal(preflightDraft.markets, markets);

    const response = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-bounded-scope-0001',
      expectedSaveEpoch: '0',
    }, now + 2);
    assert.equal(response.result.ok, true);

    const after = store.worldCache.world;
    assert.equal(after.players[String(unrelatedUser.id)], unrelatedPlayer, '删档不得复制无关玩家');
    assert.equal(after.markets, markets, '删档不得复制无关市场');
    assert.notEqual(after.orders, committed.orders, '删档只复制会被清理的订单分区');
    assert.notEqual(after.assetAuctions, committed.assetAuctions, '删档只复制会被清理的拍卖分区');
    assert.notEqual(after.productionContracts, committed.productionContracts, '删档只复制会被清理的合同分区');
    assert.equal(after.players[String(user.id)].saveEpoch, 1);
  } finally {
    store.close();
  }
});
'''
path = 'server/test/save-deletion.test.js'
content = read(path)
if "scheduled save deletion keeps unrelated players and markets shared" in content:
    raise RuntimeError(f'{path}: bounded scope test already exists')
write(path, content.rstrip() + append_test + '\n')

# Save-deletion verifier now locks the special-route scope, no global facility/contract processors, and COW test.
replace_once(
    'scripts/verify-save-deletion.mjs',
    "  'server/src/save-deletion.js',\n  'server/test/save-deletion.test.js',",
    """  'server/src/save-deletion.js',
  'server/src/player-action-registry.js',
  'server/src/world-storage-v2.js',
  'server/test/save-deletion.test.js',""",
)
replace_once(
    'scripts/verify-save-deletion.mjs',
    """  const deletion = read('server/src/save-deletion.js');
  const test = read('server/test/save-deletion.test.js');
""",
    """  const deletion = read('server/src/save-deletion.js');
  const actionRegistry = read('server/src/player-action-registry.js');
  const worldStorage = read('server/src/world-storage-v2.js');
  const test = read('server/test/save-deletion.test.js');
""",
)
replace_once(
    'scripts/verify-save-deletion.mjs',
    """    'activeLoanLiability',
    'weeklySettlementLiability',
    "'cancelOrder'",
    "'cancelAuction'",
""",
    """    'activeLoanLiability',
    'weeklySettlementLiability',
    "'cancelAuction'",
""",
)
replace_once(
    'scripts/verify-save-deletion.mjs',
    """  for (const text of [
    'economy_save_deletions_repeatable',
    'idx_economy_save_deletions_user_deleted',
    'assertExpectedSaveEpoch',
  ]) {
""",
    """  for (const text of [
    'economy_save_deletions_repeatable',
    'idx_economy_save_deletions_user_deleted',
    'assertExpectedSaveEpoch',
  ]) {
""",
)
# Insert performance/scope checks after the duplicate-delete migration checks.
replace_once(
    'scripts/verify-save-deletion.mjs',
    """  for (const forbidden of [
    'already_used',
""",
    """  for (const text of [
    "'saveDeletionPreflight'",
    "'saveDeletion'",
    "mutationScope: 'save-deletion'",
  ]) {
    if (!actionRegistry.includes(text)) failures.push(`删档特殊写路由未登记交互元数据: ${text}`);
  }
  for (const text of [
    'saveDeletionMutationScope',
    "case 'save-deletion'",
    "label: preflight ? 'save-deletion:preflight' : 'save-deletion:commit'",
  ]) {
    if (!worldStorage.includes(text)) failures.push(`删档局部 Mutation Scope 缺少: ${text}`);
  }
  for (const text of [
    'createRuntimeMutationScope',
    "'saveDeletionPreflight'",
    "'saveDeletion'",
    'store.loadWorld(now, mutationScope)',
    'store.saveWorldIfChanged(revision, world, now, stateJson, mutationScope)',
    'store.saveWorld(revision, world, now, mutationScope)',
    'processWorld: !store.scheduledProcessing',
    '{ migrate: false, process: false }',
    'cancelOpenProductionContractForSaveDeletion',
    'ensurePlayerFacilityGroupState',
    'ensurePlayerResearch',
  ]) {
    if (!deletion.includes(text)) failures.push(`删档局部事务或即时路径缺少: ${text}`);
  }
  for (const forbidden of [
    'applyFacilityGroupAction',
    'migrateFacilityGroupWorld',
    'migrateResearchWorld',
  ]) {
    if (deletion.includes(forbidden)) failures.push(`删档事务不得恢复全局玩家处理: ${forbidden}`);
  }
  const preparedStart = deletion.indexOf('function loadPreparedWorld');
  const preparedEnd = deletion.indexOf('export function getPlayerSaveDeletionPreflight', preparedStart);
  const prepared = preparedStart >= 0 && preparedEnd > preparedStart ? deletion.slice(preparedStart, preparedEnd) : '';
  if (!prepared.includes('if (!store.scheduledProcessing)')) failures.push('正式删档不得在自身事务内重复强制推进全世界');

  for (const forbidden of [
    'already_used',
""",
)
replace_once(
    'scripts/verify-save-deletion.mjs',
    """    'currentSaveWrite',
""" if False else "",
    "",
) if False else None
replace_once(
    'scripts/verify-save-deletion.mjs',
    """    '当前存档世代必须保持可写',
    'assertPlayerSaveEpoch',
  ]) {
""",
    """    '当前存档世代必须保持可写',
    'scheduled save deletion keeps unrelated players and markets shared',
    '删档不得复制无关玩家',
    '删档不得复制无关市场',
    'assertPlayerSaveEpoch',
  ]) {
""",
)
replace_once(
    'scripts/verify-save-deletion.mjs',
    "console.log('删除存档的确认、阻断、自动关闭、账号级数据保留、页面存档世代锁、后台自动写 authority 门禁、旧标签页写入隔离与旧接口墓碑验证通过。');",
    "console.log('删除存档的确认、阻断、自动关闭、局部 Mutation Scope、账号级数据保留、页面存档世代锁、后台自动写 authority 门禁、旧标签页写入隔离与旧接口墓碑验证通过。');",
)

# General runtime registry verifier accepts the new special-route scope class.
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    "const validMutationScopes = new Set(['local-player', 'factory', 'profile', 'contract', 'facility-listing', 'auction', 'order']);",
    "const validMutationScopes = new Set(['local-player', 'factory', 'profile', 'contract', 'facility-listing', 'auction', 'order', 'save-deletion']);",
)
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    """requireText('server/src/player-action-registry.js', [
  'PLAYER_ACTION_REGISTRY',
  'ORDER_EXECUTION_REGISTRY',
  'latencyBudgetMs',
  "acknowledgement = 'immediate'",
  'mutationScope',
]);
""",
    """requireText('server/src/player-action-registry.js', [
  'PLAYER_ACTION_REGISTRY',
  'ORDER_EXECUTION_REGISTRY',
  'latencyBudgetMs',
  "acknowledgement = 'immediate'",
  'mutationScope',
  "saveDeletionPreflight: defineAction({ mutationScope: 'save-deletion'",
  "saveDeletion: defineAction({ mutationScope: 'save-deletion'",
]);
""",
)

# Authority doc: production queue barrier is the only global advancement; deletion itself is bounded.
regex_replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    r"(## 12\. 玩家自助删除存档\n\n).*?(\n\n删除事务通过首次建档共用的 `ensurePlayer` 初始化重新创建玩家)",
    r"\1`save-deletion.js` 是玩家自助删除存档的唯一领域入口。`GET /api/game/save-deletion/preflight` 与 `POST /api/game/save-deletion` 都属于正式玩家可触发的权威写，必须登记显式交互元数据、延迟预算和 Mutation Scope；生产服务器先通过统一权威写队列的 scheduler barrier 推进到当前世界状态，删档领域自身不得再 `force` 推进或复制完整世界。预检查只复制当前玩家与必要核心资金域；正式删除只额外复制 `orders`、旧 `facilityListings`、`assetAuctions`、`productionContracts` 等实际会清理的有界共享分区，无关玩家、市场与工厂行情必须保持共享引用。这个边界是强制规则，因为删除一个玩家的延迟不得随全服玩家数量增长并超过浏览器普通写请求超时。\n\n`POST /api/game/save-deletion` 继续使用 `Idempotency-Key`、精确确认文字“删除存档”和同一 `BEGIN IMMEDIATE` 事务再次检查。开放订单和旧工厂挂牌与被删除玩家本身处于同一原子事务，可直接从共享集合移除，冻结资产随旧玩家存档销毁，不得为了“先解冻再销毁”调用全局工厂迁移或协调；无出价自有拍卖仍走不推进全世界的定向取消路径以保留发布费分配和拍卖审计；未承接自有合同走不执行全局合同处理器的定向取消路径。未偿银行贷款、未完成周资金结算、已有出价的自有拍卖、当前最高出价和履约合同必须返回 `409 SAVE_DELETION_BLOCKED`，任何资产不得改变。\2",
)
