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
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:160]!r}')
    write(path, content.replace(old, new, 1))


def regex_replace_once(path: str, pattern: str, replacement: str) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{path}: expected one regex match, found {count}: {pattern[:160]!r}')
    write(path, updated)


replace_once(
    'server/src/player-profile.js',
    """  if (hasPlayerName) {
    player.playerName = nextName;
    for (const order of world.orders || []) {
      if (order.ownerType === 'player' && Number(order.ownerId) === userId) {
        order.ownerName = nextName;
      }
    }
  }
""",
    """  if (hasPlayerName) player.playerName = nextName;
""",
)

regex_replace_once(
    'server/src/world-storage-v2.js',
    r"function profileMutationScope\(world, userId, payload\) \{.*?\n\}\n\nfunction contractParticipantIds",
    """function profileMutationScope(userId) {
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: new Set([playerKey(userId)]),
    segments: new Set(CORE_LOCAL_SEGMENTS),
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: 'profile:update',
  };
}

function contractParticipantIds""",
)
replace_once(
    'server/src/world-storage-v2.js',
    "      scope = profileMutationScope(world, userId, payload);",
    "      scope = profileMutationScope(userId);",
)

replace_once(
    'server/test/player-profile.test.js',
    "test('profile action atomically replaces the stored thumbnail and keeps nickname ownership in sync', () => {",
    "test('profile action atomically replaces the stored thumbnail and keeps order owner snapshots stable', () => {",
)
replace_once(
    'server/test/player-profile.test.js',
    "    assert.equal(world.orders[0].ownerName, '新玩家');",
    "    assert.equal(world.orders[0].ownerName, '旧玩家');",
)

regex_replace_once(
    'server/test/world-storage-v2.test.js',
    r"test\('profile scope clones only actor and actor orders when changing player name', \(\) => \{.*?\n\}\);\n\ntest\('contract scope clones all contract participants but keeps non-contract players shared'",
    """test('profile scope keeps the global order segment shared for name and avatar changes', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    orders: [
      { id: 'open-own', ownerType: 'player', ownerId: 1, status: 'open', remaining: 1 },
      { id: 'closed-own', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0 },
      { id: 'other', ownerType: 'player', ownerId: 2, status: 'open', remaining: 1 },
    ],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'renamePlayer', { playerName: '新的名字' }, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds], ['1']);
  assert.equal(scope.segments.has('orders'), false);
  assert.equal(scope.orderIndexes.size, 0);
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.equal(draft.players['2'], world.players['2']);
  assert.equal(draft.orders, world.orders);
  const avatarScope = createRuntimeMutationScope(world, 1, 'renamePlayer', { avatarData: 'thumbnail' }, { scheduledProcessing: true });
  assert.equal(avatarScope.segments.has('orders'), false);
  assert.equal(avatarScope.orderIndexes.size, 0);
});

test('profile rename persists only the player row and leaves order history byte-identical', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  store.stopScheduler();
  try {
    store.getState(alice, now);
    store.transaction(() => {
      const { revision, world } = store.loadWorld(now + 1);
      world.orders.push({
        id: 'profile-history-order',
        provinceId: '110000',
        assetKind: 'commodity',
        assetId: 'wheat',
        productId: 'wheat',
        side: 'buy',
        ownerType: 'player',
        ownerId: alice.id,
        ownerName: 'Alice',
        price: 1,
        quantity: 1,
        remaining: 0,
        status: 'filled',
        createdAt: now,
      });
      store.saveWorld(revision, world, now + 1);
    });
    const beforeOrders = store.database.prepare(
      \"SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'orders'\",
    ).get();

    const result = store.apply(
      alice,
      action('renamePlayer', { playerName: 'Alice Updated' }, 'storage-v2-profile-rename-12345678'),
      now + 2,
    );
    assert.equal(result.result.ok, true);
    assert.equal(store.worldCache.world.players['1'].playerName, 'Alice Updated');
    assert.equal(
      store.worldCache.world.orders.find((order) => order.id === 'profile-history-order')?.ownerName,
      'Alice',
      '订单 ownerName 是创建时兼容快照，正式资料改名不得回写历史订单',
    );

    const afterOrders = store.database.prepare(
      \"SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'orders'\",
    ).get();
    assert.deepEqual(afterOrders, beforeOrders);
  } finally {
    store.close();
  }
});

test('contract scope clones all contract participants but keeps non-contract players shared'""",
)

replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    "玩家资料修改只复制当前玩家，改名时额外复制该玩家自己的订单以同步公开名称；头像文件写入不得要求复制世界公共 segment。",
    "正式玩家资料路由的昵称和头像修改只复制当前玩家与必要核心域，不得复制或重写 `orders`、`facilityListings` 等世界公共 segment；昵称权威值只保存在玩家行，订单内兼容 `ownerName` 不随正式资料改名回写。头像文件写入同样不得要求复制世界公共 segment。非显然原因是普通玩家订单与订单历史已经匿名化，订单身份由稳定 `ownerId` 决定；为改一个昵称回写历史订单会把 O(1) profile 动作放大成全局订单 segment 序列化与持久化。",
)

replace_once(
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    "客户端通过 `isOwn` 识别本人订单，并只显示订单部分成交、全部成交、成交数量、价格、总额、手续费、实收和时间。隐藏界面列不能替代 API 脱敏。",
    "客户端通过 `isOwn` 识别本人订单，并只显示订单部分成交、全部成交、成交数量、价格、总额、手续费、实收和时间。隐藏界面列不能替代 API 脱敏。\n\n玩家订单内部的 `ownerName` 只作为订单创建时的兼容快照，不是玩家昵称权威来源，也不得作为公开身份字段。普通玩家通过正式资料路由修改昵称时只更新玩家资料行，不回写未完成订单或历史订单；撮合、资产归属、本人识别和审计关联始终以稳定 `ownerId` 为准。非显然原因是昵称回写会迫使单次资料修改重写全局 `orders` segment，而普通玩家接口已经删除 `ownerName`，这种写放大没有任何公开语义收益。",
)

verifier = 'scripts/verify-runtime-efficiency.mjs'
content = read(verifier)
anchor = "assert.equal(worldStorageSource.includes('return createFullMutationScope();\\n}\\n\\nfunction cloneScopedObject'), false, '正式玩家动作不得在函数末尾静默回退 full-world');\n"
addition = anchor + """const profileScopeSource = worldStorageSource.slice(
  worldStorageSource.indexOf('function profileMutationScope'),
  worldStorageSource.indexOf('function contractParticipantIds'),
);
assert.ok(profileScopeSource.includes('segments: new Set(CORE_LOCAL_SEGMENTS)'), '资料修改必须保持当前玩家局部核心范围');
assert.equal(profileScopeSource.includes('world?.orders'), false, '资料修改 Mutation Scope 不得扫描全局订单');
assert.equal(profileScopeSource.includes(\"'orders'\"), false, '资料修改 Mutation Scope 不得声明 orders segment');
const playerProfileSource = read('server/src/player-profile.js');
assert.equal(playerProfileSource.includes('world.orders'), false, '正式昵称保存不得遍历或回写全局订单');
"""
if content.count(anchor) != 1:
    raise RuntimeError('scripts/verify-runtime-efficiency.mjs: profile verifier anchor mismatch')
write(verifier, content.replace(anchor, addition, 1))
