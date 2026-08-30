from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    target = ROOT / path
    content = target.read_text(encoding='utf-8')
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected 1 match, found {count}')
    target.write_text(content.replace(old, new, 1), encoding='utf-8')

replace_once(
    'server/src/world-storage-v2.js',
    """function contractParticipantIds(world, payload, userId) {
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
""",
    """function contractParticipantIds(world, userId) {
  const ids = new Set([playerKey(userId)]);
  for (const contract of world?.productionContracts || []) {
    for (const field of [
      'publisherId',
      'buyerId',
      'supplierId',
      'lenderId',
      'borrowerId',
      'lessorId',
      'lesseeId',
    ]) addPlayerId(ids, contract?.[field]);
  }
  return ids;
}

function contractMutationScope(world, userId, payload, action) {
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: contractParticipantIds(world, userId),
""",
)

replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    "合同动作只复制当前操作者、目标合同已知参与者、`productionContracts` 与必要核心资金域；不得为了单份合同复制无关玩家或无关世界 segment。",
    "合同动作复制当前操作者、当前合同集合中的全部玩家参与者、`productionContracts` 与必要核心资金域，但不得复制无合同玩家或无关世界 segment；非显然原因是动作提交后的合同域统一后处理仍会遍历当前合同集合，因此 Copy-on-Write 必须覆盖该后处理可能触碰的全部合同参与者。",
)

replace_once(
    'server/test/world-storage-v2.test.js',
    """test('contract scope clones target participants and contract segment without unrelated players', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 }, 3: { userId: 3 } },
    productionContracts: [
      { id: 'contract-a', publisherId: 2, buyerId: 1, supplierId: 2 },
      { id: 'contract-b', publisherId: 3, buyerId: 3, supplierId: 2 },
    ],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'acceptProductionContract', { contractId: 'contract-a' }, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds].sort(), ['1', '2']);
  assert.equal(scope.segments.has('productionContracts'), true);
  assert.equal(scope.label, 'contract:acceptProductionContract');
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.notEqual(draft.players['2'], world.players['2']);
  assert.equal(draft.players['3'], world.players['3']);
  assert.notEqual(draft.productionContracts, world.productionContracts);
});
""",
    """test('contract scope clones all contract participants but keeps non-contract players shared', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 }, 3: { userId: 3 }, 4: { userId: 4 } },
    productionContracts: [
      { id: 'contract-a', publisherId: 2, buyerId: 1, supplierId: 2 },
      { id: 'contract-b', publisherId: 3, buyerId: 3, supplierId: 2 },
    ],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'acceptProductionContract', { contractId: 'contract-a' }, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds].sort(), ['1', '2', '3']);
  assert.equal(scope.segments.has('productionContracts'), true);
  assert.equal(scope.label, 'contract:acceptProductionContract');
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.notEqual(draft.players['2'], world.players['2']);
  assert.notEqual(draft.players['3'], world.players['3']);
  assert.equal(draft.players['4'], world.players['4']);
  assert.notEqual(draft.productionContracts, world.productionContracts);
});
""",
)

print('contract scope safety patch applied')
