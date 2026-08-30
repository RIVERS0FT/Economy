from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text(encoding='utf-8')
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected 1 match, found {count}: {old!r}')
    target.write_text(content.replace(old, new, 1), encoding='utf-8')

replace_once(
    'server/src/world-storage-v2.js',
    "  'rejectGemShopQuote',\n  'productionSettlement',\n]);",
    "  'rejectGemShopQuote',\n  'setFacilityRecipe',\n]);",
)

replace_once(
    'server/src/runtime-action-executor.js',
    "  const mutationScopeAction = action === 'settleProduction'\n    ? 'productionSettlement'\n",
    "  const mutationScopeAction = action === 'settleProduction'\n    ? 'setFacilityRecipe'\n",
)

replace_once(
    'scripts/verify-runtime-efficiency.mjs',
    '  "? \'productionSettlement\'",\n',
    '  "? \'setFacilityRecipe\'",\n',
)

replace_once(
    'server/test/world-storage-v2.test.js',
    """test('production settlement remains current-player local after factory scopes are specialized', () => {
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
""",
    """test('production settlement alias remains current-player local after factory scopes are specialized', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    orders: [{ id: 'other', ownerType: 'player', ownerId: 2, status: 'open', remaining: 1 }],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 32,
  };
  const scope = createRuntimeMutationScope(world, 1, 'setFacilityRecipe', {}, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds], ['1']);
  assert.equal(scope.label, 'local:setFacilityRecipe');
  assert.equal(scope.segments.has('orders'), false);
});
""",
)

print('production settlement alias fix applied')
