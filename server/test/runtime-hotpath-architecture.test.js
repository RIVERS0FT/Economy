import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';
import {
  createRuntimeMutationScope,
  readSegmentedWorld,
} from '../src/world-storage-v2.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };

test('runtime hot path uses segmented copy-on-write drafts and scheduler barrier', () => {
  const runtime = read('server/src/runtime-store.js');
  const core = read('server/src/runtime-store-core.js');
  const executor = read('server/src/authoritative-write-executor.js');
  const action = read('server/src/runtime-action-executor.js');
  const storageV2 = read('server/src/world-storage-v2.js');
  const actionRegistry = read('server/src/player-action-registry.js');

  const cacheStart = runtime.indexOf('  cacheWorld(');
  const loadStart = runtime.indexOf('  loadWorld(', cacheStart);
  assert.ok(cacheStart >= 0 && loadStart > cacheStart);
  const cacheBody = runtime.slice(cacheStart, loadStart);

  assert.match(runtime, /EconomyStore as CoreEconomyStore/);
  assert.match(runtime, /worldDraftCowMs/);
  assert.match(runtime, /cloneWorldForMutation/);
  assert.doesNotMatch(runtime, /worldDraftParseMs/);
  assert.doesNotMatch(runtime, /JSON\.parse\(this\.worldCache\.stateJson\)/);
  assert.match(runtime, /worldDraftCloneMs/);
  assert.doesNotMatch(cacheBody, /structuredClone/);
  assert.doesNotMatch(runtime, /committedWorldForCache/);
  assert.doesNotMatch(runtime, /stateProjectionCacheIsolationDepth/);
  assert.doesNotMatch(runtime, /worldCacheIsolationCloneMs/);
  assert.match(runtime, /ensureScheduledProcessingBarrier/);
  assert.match(runtime, /schedulerBarrierPromise/);
  assert.match(runtime, /schedulerBarrierWaitMs/);
  assert.match(runtime, /settledSynchronously/);
  assert.match(runtime, /captureRequestContext:\s*false/);
  assert.match(runtime, /return executeRuntimeAction\(this, user, requestMeta, now\)/);

  assert.match(core, /prepareSegmentedWorldWrite/);
  assert.match(core, /applySegmentedWorldWrite/);
  assert.doesNotMatch(core, /JSON\.stringify\(world\)/);
  assert.match(core, /filterStateForCurrentSave/);
  assert.match(core, /createVersionedClientState/);
  assert.match(core, /const world = this\.worldCache\.world/);
  assert.doesNotMatch(core, /contractProjectionForState/);

  assert.match(storageV2, /economy_world_meta/);
  assert.match(storageV2, /economy_world_players/);
  assert.match(storageV2, /economy_world_segments/);
  assert.match(storageV2, /worldDirtyPlayerRows/);
  assert.match(storageV2, /worldDirtySegments/);
  assert.match(storageV2, /cloneScopedOrders/);
  assert.match(storageV2, /getPlayerActionMetadata/);
  assert.match(storageV2, /requireOrderExecutionMetadata/);
  assert.doesNotMatch(storageV2, /LOCAL_ORDER_POLICY_EXECUTIONS/);
  assert.match(actionRegistry, /setFacilityRecipe: defineAction\(\{ mutationScope: 'factory'/);
  assert.match(actionRegistry, /ORDER_EXECUTION_REGISTRY/);

  assert.match(executor, /captureRequestContext = true/);
  assert.match(executor, /captureRequestContext \? requestPerformanceContext\(\) : null/);

  assert.doesNotMatch(action, /createEconomicActionBoundary/);
  assert.match(action, /structuredClone\(world\.players\?\.\[String\(user\.id\)\]/);
  assert.match(action, /createRuntimeMutationScope/);
  assert.match(action, /assertEconomicStateInvariantsScoped/);
  assert.match(action, /CONTRACT_ACTIONS/);
  assert.match(action, /applyProductionContractAction/);
  assert.match(action, /processProductionContracts/);
  assert.match(action, /applySettledCommodityOrder/);
  assert.match(action, /if \(!store\.scheduledProcessing\)/);
  assert.match(action, /createActionAcknowledgement\(gameResult, revision\)/);
});

test('committed state cache miss projects without a world draft or cache mutation', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    const now = 1_700_000_000_000;
    store.getStateSnapshot(alice, undefined, now);
    store.clientStateProjectionCache.clear();
    const before = JSON.stringify(store.worldCache.world);
    const originalLoadWorld = store.loadWorld.bind(store);
    let loadWorldCalls = 0;
    store.loadWorld = (...args) => {
      loadWorldCalls += 1;
      return originalLoadWorld(...args);
    };

    const snapshot = store.getStateSnapshot(alice, undefined, now + 500);
    assert.equal(snapshot.unchanged, false);
    assert.ok(snapshot.state);
    assert.equal(loadWorldCalls, 0);
    assert.equal(JSON.stringify(store.worldCache.world), before);
  } finally {
    store.stopScheduler();
    store.close();
  }
});

test('segmented copy-on-write draft isolates the mutated player and shares untouched domains', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    const now = 1_700_000_000_000;
    store.getStateSnapshot(alice, undefined, now);
    const committed = store.worldCache.world;
    const scope = createRuntimeMutationScope(committed, alice.id, 'bankDeposit', { amount: 10 }, {
      scheduledProcessing: true,
    });
    const loaded = store.loadWorld(now + 1, scope);
    assert.notEqual(loaded.world, committed);
    assert.notEqual(loaded.world.players, committed.players);
    assert.notEqual(loaded.world.players[String(alice.id)], committed.players[String(alice.id)]);
    assert.equal(loaded.world.orders, committed.orders);
    assert.equal(loaded.world.markets, committed.markets);
    loaded.world.players[String(alice.id)].credits += 1;
    assert.notEqual(loaded.world.players[String(alice.id)].credits, committed.players[String(alice.id)].credits);
  } finally {
    store.stopScheduler();
    store.close();
  }
});

test('facility recipe changes use the bounded factory copy-on-write scope', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    const now = 1_700_000_000_000;
    store.getStateSnapshot(alice, undefined, now);
    const committed = store.worldCache.world;
    const scope = createRuntimeMutationScope(committed, alice.id, 'setFacilityRecipe', {
      facilityTypeId: 'farm',
      recipeId: 'farm-wheat',
    }, { scheduledProcessing: true });

    assert.equal(scope.allPlayers, false);
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
    assert.equal(loaded.world.assetAuctions, committed.assetAuctions);
  } finally {
    store.stopScheduler();
    store.close();
  }
});

test('commodity order drafts clone only open orders and the market for the affected asset', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    const now = 1_700_000_000_000;
    store.getStateSnapshot(alice, undefined, now);
    const committed = store.worldCache.world;
    committed.orders.push(
      { id: 'wheat-open', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'market', ownerId: 0, price: 10, quantity: 1, remaining: 1, status: 'open', createdAt: now },
      { id: 'rice-open', assetKind: 'commodity', assetId: 'rice', productId: 'rice', side: 'sell', ownerType: 'market', ownerId: 0, price: 10, quantity: 1, remaining: 1, status: 'open', createdAt: now },
      { id: 'wheat-closed', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'market', ownerId: 0, price: 10, quantity: 1, remaining: 0, status: 'filled', createdAt: now },
    );
    committed.markets.wheat ||= { priceHistory: [] };
    committed.markets.rice ||= { priceHistory: [] };

    const scope = createRuntimeMutationScope(committed, alice.id, 'placeOrder', {
      assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', quantity: 1, price: 10,
    }, { scheduledProcessing: true });
    const loaded = store.loadWorld(now + 1, scope);

    assert.equal(scope.allPlayers, false);
    assert.equal(scope.allSegments, false);
    assert.equal(scope.label, 'commodity:placeOrder');
    assert.notEqual(loaded.world.orders, committed.orders);
    assert.notEqual(loaded.world.orders.at(-3), committed.orders.at(-3));
    assert.equal(loaded.world.orders.at(-2), committed.orders.at(-2));
    assert.equal(loaded.world.orders.at(-1), committed.orders.at(-1));
    assert.notEqual(loaded.world.markets, committed.markets);
    assert.notEqual(loaded.world.markets.wheat, committed.markets.wheat);
    assert.equal(loaded.world.markets.rice, committed.markets.rice);
  } finally {
    store.stopScheduler();
    store.close();
  }
});

test('segmented persistence reconstructs the same committed world without projection mutation', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    const snapshot = store.getStateSnapshot(alice, undefined, 1_700_000_000_000);
    const persisted = readSegmentedWorld(store);
    const legacy = store.database.prepare(
      'SELECT revision, state_json FROM economy_world WHERE id = 1',
    ).get();

    assert.equal(snapshot.revision, persisted.revision);
    assert.equal(store.worldCache.revision, persisted.revision);
    assert.deepEqual(persisted.world, store.worldCache.world);
    assert.deepEqual(JSON.parse(String(legacy.state_json)), {
      version: 33,
      storageSchemaVersion: 2,
      segmented: true,
    });
  } finally {
    store.stopScheduler();
    store.close();
  }
});
