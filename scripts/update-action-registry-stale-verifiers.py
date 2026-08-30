from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:100]!r}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


replace_once(
    'scripts/verify-admin-player-statistics.mjs',
    """requireText('server/src/world-storage-v2.js', [
  "'setFacilityRecipe'",
  'label: `local:${action}`',
]);
""",
    """requireText('server/src/world-storage-v2.js', [
  'getPlayerActionMetadata(action)',
  'finalizeInteractiveMutationScope',
]);
requireText('server/src/player-action-registry.js', [
  "setFacilityRecipe: defineAction({ mutationScope: 'factory'",
]);
""",
)
replace_once(
    'scripts/verify-admin-player-statistics.mjs',
    """requireText('server/test/runtime-hotpath-architecture.test.js', [
  'facility recipe changes stay on the player-local copy-on-write scope',
  "assert.equal(scope.label, 'local:setFacilityRecipe')",
]);
""",
    """requireText('server/test/runtime-hotpath-architecture.test.js', [
  'facility recipe changes use the bounded factory copy-on-write scope',
  "assert.equal(scope.label, 'facility:auto-operation-rebuild')",
]);
""",
)

replace_once(
    'server/test/runtime-hotpath-architecture.test.js',
    """  const storageV2 = read('server/src/world-storage-v2.js');
""",
    """  const storageV2 = read('server/src/world-storage-v2.js');
  const actionRegistry = read('server/src/player-action-registry.js');
""",
)
replace_once(
    'server/test/runtime-hotpath-architecture.test.js',
    """  assert.match(storageV2, /worldDirtyPlayerRows/);
  assert.match(storageV2, /worldDirtySegments/);
  assert.match(storageV2, /'setFacilityRecipe'/);
  assert.match(storageV2, /cloneScopedOrders/);
  assert.match(storageV2, /LOCAL_ORDER_POLICY_EXECUTIONS/);
""",
    """  assert.match(storageV2, /worldDirtyPlayerRows/);
  assert.match(storageV2, /worldDirtySegments/);
  assert.match(storageV2, /cloneScopedOrders/);
  assert.match(storageV2, /getPlayerActionMetadata/);
  assert.match(storageV2, /requireOrderExecutionMetadata/);
  assert.doesNotMatch(storageV2, /LOCAL_ORDER_POLICY_EXECUTIONS/);
  assert.match(actionRegistry, /setFacilityRecipe: defineAction\\(\\{ mutationScope: 'factory'/);
  assert.match(actionRegistry, /ORDER_EXECUTION_REGISTRY/);
""",
)
replace_once(
    'server/test/runtime-hotpath-architecture.test.js',
    "test('facility recipe changes stay on the player-local copy-on-write scope', () => {",
    "test('facility recipe changes use the bounded factory copy-on-write scope', () => {",
)
replace_once(
    'server/test/runtime-hotpath-architecture.test.js',
    """    assert.equal(scope.allPlayers, false);
    assert.equal(scope.allSegments, false);
    assert.equal(scope.label, 'local:setFacilityRecipe');
    assert.deepEqual([...scope.playerIds], [String(alice.id)]);
    assert.equal(scope.segments.has('populationEconomy'), true);
    assert.equal(scope.segments.has('orders'), false);
    assert.equal(scope.segments.has('markets'), false);

    const loaded = store.loadWorld(now + 1, scope);
    assert.notEqual(loaded.world.players[String(alice.id)], committed.players[String(alice.id)]);
    assert.equal(loaded.world.orders, committed.orders);
    assert.equal(loaded.world.markets, committed.markets);
""",
    """    assert.equal(scope.allPlayers, false);
    assert.equal(scope.allSegments, false);
    assert.equal(scope.label, 'facility:auto-operation-rebuild');
    assert.deepEqual([...scope.playerIds], [String(alice.id)]);
    assert.equal(scope.segments.has('populationEconomy'), true);
    assert.equal(scope.segments.has('orders'), true);
    assert.equal(scope.segments.has('markets'), false);

    const loaded = store.loadWorld(now + 1, scope);
    assert.notEqual(loaded.world.players[String(alice.id)], committed.players[String(alice.id)]);
    assert.notEqual(loaded.world.orders, committed.orders);
    assert.equal(loaded.world.markets, committed.markets);
""",
)

print('stale action-scope verifiers updated')
