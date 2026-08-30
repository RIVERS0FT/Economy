from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    content = read(path)
    if marker in content:
        raise RuntimeError(f'{path}: marker already present: {marker}')
    if not content.endswith('\n'):
        content += '\n'
    write(path, content + '\n' + block.strip() + '\n')


# Storage scopes: keep production settlement truly player-local, localize factory/profile/contracts/listings.
replace_once(
    'server/src/world-storage-v2.js',
    "  'rejectGemShopQuote',\n  'setFacilityRecipe',\n]);",
    "  'rejectGemShopQuote',\n  'productionSettlement',\n]);",
)

replace_once(
    'server/src/world-storage-v2.js',
    "const AUCTION_ACTIONS = new Set(['createAuction', 'placeAuctionBid', 'cancelAuction']);\n",
    """const AUCTION_ACTIONS = new Set(['createAuction', 'placeAuctionBid', 'cancelAuction']);
const FACTORY_SCOPE_ACTIONS = new Set([
  'factoryAutoOperationRebuild',
  'buildFacility',
  'startFacility',
  'pauseFacility',
  'setFacilityRecipe',
]);
const FACILITY_LISTING_ACTIONS = new Set(['listFacility', 'cancelFacilityListing', 'buyFacility']);
const CONTRACT_ACTIONS = new Set([
  'createProductionContract',
  'acceptProductionContract',
  'proposeProductionContractNegotiation',
  'counterProductionContractNegotiation',
  'acceptProductionContractNegotiation',
  'rejectProductionContractNegotiation',
  'revokeProductionContractNegotiation',
  'cancelProductionContract',
  'prepareProductionContract',
  'fundProductionContract',
  'setProductionContractAutoReserve',
  'setProductionContractAutoFund',
  'proposeProductionContractRenewal',
  'acceptProductionContractRenewal',
  'rejectProductionContractRenewal',
  'revokeProductionContractRenewal',
  'requestProductionContractTermination',
  'terminateProductionContractNow',
  'repayPlayerLoan',
  'setPlayerLoanAutoRepay',
  'fundFacilityLease',
  'setFacilityLeaseAutoFund',
]);
""",
)

helpers = r'''
function addPlayerId(ids, value) {
  const numeric = Number(value);
  if (Number.isSafeInteger(numeric) && numeric > 0) ids.add(playerKey(numeric));
}

function ownedOrderIndexesInProvince(world, userId, provinceId, { openOnly = true } = {}) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const indexes = new Set();
  for (const [index, order] of (world?.orders || []).entries()) {
    if (order?.ownerType !== 'player' || Number(order.ownerId) !== Number(userId)) continue;
    if (normalizeProvinceId(order.provinceId) !== selectedProvinceId) continue;
    if (openOnly && !isOpenOrder(order)) continue;
    indexes.add(index);
  }
  return indexes;
}

function factoryAutoOperationScope(world, userId, payload) {
  const provinceId = normalizeProvinceId(payload?.provinceId);
  const orderIndexes = ownedOrderIndexesInProvince(world, userId, provinceId);
  const procurement = payload?.autoProcure === true ? procurementAssets(payload) : [];
  for (const index of orderIndexesForAssets(world, procurement)) orderIndexes.add(index);
  const marketKeys = new Set(procurement.map(({ provinceId: assetProvinceId, assetId }) => (
    provinceScopedKey(assetProvinceId, assetId)
  )));
  const segments = new Set([...CORE_LOCAL_SEGMENTS, 'orders']);
  if (marketKeys.size > 0) segments.add('markets');
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: playerIdsForOrderIndexes(world, userId, orderIndexes),
    segments,
    orderIndexes,
    marketKeys,
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: 'facility:auto-operation-rebuild',
  };
}

function profileMutationScope(world, userId, payload) {
  const orderIndexes = new Set();
  if (Object.hasOwn(payload || {}, 'playerName')) {
    for (const [index, order] of (world?.orders || []).entries()) {
      if (order?.ownerType === 'player' && Number(order.ownerId) === Number(userId)) orderIndexes.add(index);
    }
  }
  const segments = new Set(CORE_LOCAL_SEGMENTS);
  if (orderIndexes.size > 0) segments.add('orders');
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: new Set([playerKey(userId)]),
    segments,
    orderIndexes,
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: 'profile:update',
  };
}

function contractParticipantIds(world, payload, userId) {
  const ids = new Set([playerKey(userId)]);
  const contractId = String(payload?.contractId || payload?.id || '');
  const contract = (world?.productionContracts || []).find((entry) => String(entry?.id || '') === contractId);
  if (!contract) return ids;
  for (const field of [
    'publisherId',
    'buyerId',
    'supplierId',
    'lenderId',
    'borrowerId',
    'lessorId',
    'lesseeId',
  ]) addPlayerId(ids, contract[field]);
  return ids;
}

function contractMutationScope(world, userId, payload, action) {
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: contractParticipantIds(world, payload, userId),
    segments: new Set([...CORE_LOCAL_SEGMENTS, 'productionContracts']),
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: `contract:${action}`,
  };
}

function facilityListingMutationScope(world, userId, payload, action) {
  const ids = new Set([playerKey(userId)]);
  const listingId = String(payload?.listingId || '');
  const listing = (world?.facilityListings || []).find((entry) => String(entry?.id || '') === listingId);
  if (listing?.ownerType === 'player') addPlayerId(ids, listing.ownerId);
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: ids,
    segments: new Set([...CORE_LOCAL_SEGMENTS, 'facilityListings']),
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: `facility-listing:${action}`,
  };
}
'''

replace_once(
    'server/src/world-storage-v2.js',
    "export function createRuntimeMutationScope(world, userId, action, payload, {\n",
    helpers.strip() + "\n\nexport function createRuntimeMutationScope(world, userId, action, payload, {\n",
)

replace_once(
    'server/src/world-storage-v2.js',
    """  if (AUCTION_ACTIONS.has(action)) {
""",
    """  if (FACTORY_SCOPE_ACTIONS.has(action)) {
    return factoryAutoOperationScope(world, userId, payload);
  }

  if (action === 'renamePlayer') {
    return profileMutationScope(world, userId, payload);
  }

  if (CONTRACT_ACTIONS.has(action)) {
    return contractMutationScope(world, userId, payload, action);
  }

  if (FACILITY_LISTING_ACTIONS.has(action)) {
    return facilityListingMutationScope(world, userId, payload, action);
  }

  if (AUCTION_ACTIONS.has(action)) {
""",
)

replace_once(
    'server/src/world-storage-v2.js',
    """    if (LOCAL_ORDER_POLICY_EXECUTIONS.has(execution)) {
""",
    """    if (execution === 'factory-auto-operation-policy') {
      return factoryAutoOperationScope(world, userId, payload);
    }
    if (LOCAL_ORDER_POLICY_EXECUTIONS.has(execution)) {
""",
)

# Runtime mapping: do not route production settlement through recipe scope.
replace_once(
    'server/src/runtime-action-executor.js',
    """  const mutationScopeAction = action === 'settleProduction'
    ? 'setFacilityRecipe'
""",
    """  const mutationScopeAction = action === 'settleProduction'
    ? 'productionSettlement'
""",
)

# Direct API interaction paths must release UI immediately after server acknowledgement.
replace_once(
    'src/pages/BuildingsPage.tsx',
    """      await model.refresh({ mode: 'authoritative' });
      return response.result;
""",
    """      void model.refresh({ mode: 'authoritative' });
      return response.result;
""",
)
replace_once(
    'src/pages/BuildingsPage.tsx',
    """      await model.refresh({ mode: 'authoritative' });
      return response.result;
""",
    """      void model.refresh({ mode: 'authoritative' });
      return response.result;
""",
)
replace_once(
    'src/auto-trade/useOnlineAutoTrade.ts',
    """      if (!response.result.ok) return response.result;
      await model.refresh({ mode: 'authoritative' });
      clearAutoSellPolicies(userId);
      if (normalized.sell.enabled) callbacks.onAutoSellPolicyEnabled?.(productId);
""",
    """      if (!response.result.ok) return response.result;
      void model.refresh({ mode: 'authoritative' });
      clearAutoSellPolicies(userId);
      if (normalized.sell.enabled) callbacks.onAutoSellPolicyEnabled?.(productId);
""",
)

# Lock the client response behavior in the existing performance verifier.
replace_once(
    'scripts/verify-client-response-performance.mjs',
    """forbidText('src/app/gameViewModel.ts', [
  'await syncConfirmedAction(response, action);',
]);

if (failures.length > 0) {
""",
    """forbidText('src/app/gameViewModel.ts', [
  'await syncConfirmedAction(response, action);',
]);
const buildingsSource = read('src/pages/BuildingsPage.tsx');
assert.equal(
  (buildingsSource.match(/void model\\.refresh\\(\\{ mode: 'authoritative' \\}\\);/g) || []).length,
  2,
  '建厂采购创建与取消都必须在动作确认后后台补拉状态',
);
assert.equal(
  (buildingsSource.match(/await model\\.refresh\\(\\{ mode: 'authoritative' \\}\\);/g) || []).length,
  0,
  '建厂采购不得等待动作后的状态补拉才结束交互',
);
const autoTradeSource = read('src/auto-trade/useOnlineAutoTrade.ts');
requireText('src/auto-trade/useOnlineAutoTrade.ts', [
  "void model.refresh({ mode: 'authoritative' });\\n      clearAutoSellPolicies(userId);\\n      if (normalized.sell.enabled)",
]);
assert.equal(
  (autoTradeSource.match(/await model\\.refresh\\(\\{ mode: 'authoritative' \\}\\);/g) || []).length,
  1,
  '仅允许旧浏览器策略迁移等待权威补拉；用户保存策略必须即时返回',
);

if (failures.length > 0) {
""",
)

# Lock server scope ownership in runtime verification.
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    """  \"label: 'commodity:placeOrder'\",
]);
""",
    """  \"label: 'commodity:placeOrder'\",
  'FACTORY_SCOPE_ACTIONS',
  'factoryAutoOperationScope',
  'profileMutationScope',
  'contractMutationScope',
  'facilityListingMutationScope',
  \"execution === 'factory-auto-operation-policy'\",
]);
""",
)
replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    """requireText('server/src/runtime-action-executor.js', [
  \"measureRequestPhase('playerSnapshotMs'\",
  \"measureRequestPhase('economicInvariantMs'\",
]);
""",
    """requireText('server/src/runtime-action-executor.js', [
  \"measureRequestPhase('playerSnapshotMs'\",
  \"measureRequestPhase('economicInvariantMs'\",
  \"? 'productionSettlement'\",
]);
""",
)

# Design authority: specify the newly localized interaction classes and direct-call completion rule.
replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    "起始州选择与州解锁只修改当前玩家资金、统计和州访问字段，必须固定使用当前玩家局部 Mutation Scope；不得因这类 O(1) 玩家写入复制、比较或序列化全部玩家与全部世界 segment。普通商品下单只复制下单者、当前价格可交叉的玩家对手方、订单／市场及必要核心资金域；商品撤单只复制下单者、订单及必要核心资金域；拍卖动作只复制相关卖方／当前最高出价者／当前操作者、拍卖及必要核心资金域。",
    "起始州选择与州解锁只修改当前玩家资金、统计和州访问字段，必须固定使用当前玩家局部 Mutation Scope；不得因这类 O(1) 玩家写入复制、比较或序列化全部玩家与全部世界 segment。工厂建造、启停、配方切换与自动经营策略只复制当前玩家及本州可能被撤销的玩家托管订单；一键购料额外纳入本次材料资产的订单对手方与对应市场键，不得因此退回完整世界草稿。玩家资料修改只复制当前玩家，改名时额外复制该玩家自己的订单以同步公开名称；头像文件写入不得要求复制世界公共 segment。合同动作只复制当前操作者、目标合同已知参与者、`productionContracts` 与必要核心资金域；不得为了单份合同复制无关玩家或无关世界 segment。旧设施挂牌动作只复制买卖相关玩家、`facilityListings` 与必要核心资金域。普通商品下单只复制下单者、当前价格可交叉的玩家对手方、订单／市场及必要核心资金域；商品撤单只复制下单者、订单及必要核心资金域；拍卖动作只复制相关卖方／当前最高出价者／当前操作者、拍卖及必要核心资金域。",
)
replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    "普通玩家交互不得把动作后的 `GET state` 纳入按钮、表单或提示的阻塞完成路径：请求发出时立即进入本地 pending，收到精简动作确认后立即返回成功或失败，状态补拉在后台继续；服务器确认前不得乐观修改资金、库存、州权限或其他权威经济状态，确认后只允许用不推进客户端权威修订号的短暂 confirmed UI 覆盖消除视觉等待。",
    "普通玩家交互不得把动作后的 `GET state` 纳入按钮、表单或提示的阻塞完成路径：请求发出时立即进入本地 pending，收到精简动作确认后立即返回成功或失败，状态补拉在后台继续；服务器确认前不得乐观修改资金、库存、州权限或其他权威经济状态，确认后只允许用不推进客户端权威修订号的短暂 confirmed UI 覆盖消除视觉等待。建厂采购创建／取消与商品自动交易策略保存等直接调用动作 API 的路径同样必须在确认后立即结束 pending，并以非阻塞方式触发权威补拉，不得局部重新引入 `await GET state`。",
)

# Runtime scope tests.
append_once(
    'server/test/world-storage-v2.test.js',
    "factory interaction scope keeps unrelated players shared",
    r'''
test('factory interaction scope keeps unrelated players shared while including procurement counterparties', () => {
  const world = {
    players: {
      1: { userId: 1, marker: 'actor' },
      2: { userId: 2, marker: 'material-seller' },
      3: { userId: 3, marker: 'unrelated' },
    },
    orders: [
      { id: 'managed', ownerType: 'player', ownerId: 1, provinceId: '110000', assetKind: 'commodity', productId: 'rice', side: 'sell', price: 12, remaining: 1, status: 'open' },
      { id: 'material', ownerType: 'player', ownerId: 2, provinceId: '110000', assetKind: 'commodity', productId: 'wheat', side: 'sell', price: 9, remaining: 4, status: 'open' },
      { id: 'other-province', ownerType: 'player', ownerId: 3, provinceId: '130000', assetKind: 'commodity', productId: 'wheat', side: 'sell', price: 8, remaining: 4, status: 'open' },
    ],
    markets: {
      '110000:wheat': { lastPrice: 9 },
      '130000:wheat': { lastPrice: 8 },
    },
    bank: {},
    weeklyCashSettlement: {},
    populationEconomy: {},
    marketDemand: {},
    stats: {},
    moneyPrecision: { version: 2 },
    auctionFeeEscrowCredits: 0,
    systemMarketAudit: {},
    transportShipments: [],
    version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'factoryAutoOperationRebuild', {
    provinceId: '110000',
    autoProcure: true,
    materialPriceCaps: { wheat: 10 },
  }, { scheduledProcessing: true });
  assert.equal(scope.allPlayers, false);
  assert.equal(scope.allSegments, false);
  assert.deepEqual([...scope.playerIds].sort(), ['1', '2']);
  assert.equal(scope.segments.has('orders'), true);
  assert.equal(scope.segments.has('markets'), true);
  assert.equal(scope.label, 'facility:auto-operation-rebuild');

  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.notEqual(draft.players['2'], world.players['2']);
  assert.equal(draft.players['3'], world.players['3']);
  assert.notEqual(draft.orders[0], world.orders[0]);
  assert.notEqual(draft.orders[1], world.orders[1]);
  assert.equal(draft.orders[2], world.orders[2]);
});

test('factory auto-operation policy uses the same bounded order scope without cloning markets', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    orders: [
      { id: 'managed', ownerType: 'player', ownerId: 1, provinceId: '110000', assetKind: 'commodity', productId: 'wheat', side: 'buy', price: 8, remaining: 1, status: 'open' },
      { id: 'other', ownerType: 'player', ownerId: 2, provinceId: '110000', assetKind: 'commodity', productId: 'wheat', side: 'sell', price: 9, remaining: 1, status: 'open' },
    ],
    markets: { '110000:wheat': { lastPrice: 9 } },
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'placeOrder', {
    execution: 'factory-auto-operation-policy',
    provinceId: '110000',
    assetKind: 'facility',
    facilityTypeId: 'farm',
  }, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds], ['1']);
  assert.equal(scope.segments.has('orders'), true);
  assert.equal(scope.segments.has('markets'), false);
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.orders[0], world.orders[0]);
  assert.equal(draft.orders[1], world.orders[1]);
  assert.equal(draft.markets, world.markets);
});

test('profile scope clones only the actor and actor orders when changing the player name', () => {
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
  const scope = createRuntimeMutationScope(world, 1, 'renamePlayer', { playerName: '新的名字' }, {
    scheduledProcessing: true,
  });
  assert.deepEqual([...scope.playerIds], ['1']);
  assert.equal(scope.segments.has('orders'), true);
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.equal(draft.players['2'], world.players['2']);
  assert.notEqual(draft.orders[0], world.orders[0]);
  assert.notEqual(draft.orders[1], world.orders[1]);
  assert.equal(draft.orders[2], world.orders[2]);

  const avatarScope = createRuntimeMutationScope(world, 1, 'renamePlayer', { avatarData: 'thumbnail' }, {
    scheduledProcessing: true,
  });
  assert.equal(avatarScope.segments.has('orders'), false);
});

test('contract scope clones target participants and contract segment without unrelated players', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 }, 3: { userId: 3 } },
    productionContracts: [
      { id: 'contract-a', publisherId: 2, buyerId: 1, supplierId: 2 },
      { id: 'contract-b', publisherId: 3, buyerId: 3, supplierId: 2 },
    ],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'acceptProductionContract', { contractId: 'contract-a' }, {
    scheduledProcessing: true,
  });
  assert.deepEqual([...scope.playerIds].sort(), ['1', '2']);
  assert.equal(scope.segments.has('productionContracts'), true);
  assert.equal(scope.label, 'contract:acceptProductionContract');
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.notEqual(draft.players['2'], world.players['2']);
  assert.equal(draft.players['3'], world.players['3']);
  assert.notEqual(draft.productionContracts, world.productionContracts);
});

test('legacy facility listing scope includes buyer and player seller only', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 }, 3: { userId: 3 } },
    facilityListings: [{ id: 'listing-a', ownerType: 'player', ownerId: 2 }],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'buyFacility', { listingId: 'listing-a' }, {
    scheduledProcessing: true,
  });
  assert.deepEqual([...scope.playerIds].sort(), ['1', '2']);
  assert.equal(scope.segments.has('facilityListings'), true);
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.notEqual(draft.players['2'], world.players['2']);
  assert.equal(draft.players['3'], world.players['3']);
  assert.notEqual(draft.facilityListings, world.facilityListings);
});

test('production settlement remains current-player local after factory scopes are specialized', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    orders: [{ id: 'other', ownerType: 'player', ownerId: 2, status: 'open', remaining: 1 }],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'productionSettlement', {}, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds], ['1']);
  assert.equal(scope.label, 'local:productionSettlement');
  assert.equal(scope.segments.has('orders'), false);
});
''',
)

print('interaction mutation scope patch applied')
