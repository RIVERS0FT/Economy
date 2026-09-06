import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkInDateKey } from '../src/daily-check-in.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';
import { EconomyStore } from '../src/runtime-store.js';
import {
  WORLD_STORAGE_SCHEMA_VERSION,
  cloneWorldForMutation,
  createRuntimeMutationScope,
} from '../src/world-storage-v2.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob', role: 'user' };
const now = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

function action(actionName, payload, requestKey) {
  return {
    action: actionName,
    payload,
    requestKey,
    method: 'POST',
    path: actionName.startsWith('bank') ? '/api/game/bank' : '/api/game/action',
  };
}

test('segmented storage initializes one meta row, player rows, and top-level segment rows', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.getState(alice, now);
    const meta = store.database.prepare('SELECT * FROM economy_world_meta WHERE id = 1').get();
    const player = store.database.prepare('SELECT * FROM economy_world_players WHERE user_id = 1').get();
    const segments = store.database.prepare('SELECT segment_key FROM economy_world_segments ORDER BY segment_key').all();

    assert.equal(Number(meta.storage_schema_version), WORLD_STORAGE_SCHEMA_VERSION);
    assert.ok(Number(meta.revision) >= 1);
    assert.ok(player?.state_json);
    assert.ok(segments.some((row) => row.segment_key === 'orders'));
    assert.ok(segments.some((row) => row.segment_key === 'markets'));
    assert.ok(segments.some((row) => row.segment_key === 'lastProcessedAt'));
  } finally {
    store.close();
  }
});

test('local bank mutation persists one player row without rewriting the orders segment', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    store.getState(alice, now);
    const beforeMeta = store.database.prepare('SELECT revision FROM economy_world_meta WHERE id = 1').get();
    const beforeOrders = store.database.prepare(
      "SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'orders'",
    ).get();

    const result = store.apply(alice, action('bankDeposit', { amount: 10 }, 'storage-v2-bank-12345678'), now + 1);
    assert.equal(result.result.ok, true);

    const afterMeta = store.database.prepare('SELECT revision FROM economy_world_meta WHERE id = 1').get();
    const afterOrders = store.database.prepare(
      "SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'orders'",
    ).get();
    const player = store.database.prepare(
      'SELECT updated_revision, state_json FROM economy_world_players WHERE user_id = 1',
    ).get();
    const legacy = store.database.prepare(
      'SELECT revision, state_json FROM economy_world WHERE id = 1',
    ).get();

    assert.equal(Number(afterMeta.revision), Number(beforeMeta.revision) + 1);
    assert.equal(Number(player.updated_revision), Number(afterMeta.revision));
    assert.equal(Number(afterOrders.updated_revision), Number(beforeOrders.updated_revision));
    assert.equal(String(afterOrders.state_json), String(beforeOrders.state_json));
    assert.equal(Number(legacy.revision), Number(afterMeta.revision));
    assert.deepEqual(JSON.parse(String(legacy.state_json)), {
      version: 33,
      storageSchemaVersion: WORLD_STORAGE_SCHEMA_VERSION,
      segmented: true,
    });
  } finally {
    store.close();
  }
});

test('local mutation draft clones only the current player and declared segments', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    store.getState(alice, now);
    const committed = store.worldCache.world;
    const scope = createRuntimeMutationScope(committed, alice.id, 'bankDeposit', { amount: 10 }, {
      scheduledProcessing: true,
    });
    const draft = cloneWorldForMutation(committed, scope);

    assert.notEqual(draft.players, committed.players);
    assert.notEqual(draft.players['1'], committed.players['1']);
    assert.equal(draft.orders, committed.orders);
    assert.equal(draft.markets, committed.markets);
    assert.notEqual(draft.bank, committed.bank);
  } finally {
    store.close();
  }
});

test('province access mutations use the current-player local scope', () => {
  const world = {
    players: {
      1: { userId: 1, credits: 5000, unlockedProvinces: ['110000'] },
      2: { userId: 2, credits: 5000, unlockedProvinces: ['110000'] },
    },
    orders: [],
    markets: {},
    bank: {},
    weeklyCashSettlement: {},
    populationEconomy: {},
    marketDemand: {},
    stats: {},
    moneyPrecision: { version: 2 },
    auctionFeeEscrowCredits: 0,
    systemMarketAudit: {},
    transportShipments: [],
    version: 33,
  };

  for (const actionName of ['chooseStartingProvince', 'unlockProvince']) {
    const scope = createRuntimeMutationScope(world, alice.id, actionName, { provinceId: '130000' }, {
      scheduledProcessing: true,
    });
    assert.equal(scope.allPlayers, false);
    assert.equal(scope.allSegments, false);
    assert.deepEqual([...scope.playerIds], ['1']);
    assert.equal(scope.label, `local:${actionName}`);
    assert.equal(scope.segments.has('orders'), false);
    assert.equal(scope.segments.has('markets'), false);

    const draft = cloneWorldForMutation(world, scope);
    assert.notEqual(draft.players['1'], world.players['1']);
    assert.equal(draft.players['2'], world.players['2']);
    assert.equal(draft.orders, world.orders);
    assert.equal(draft.markets, world.markets);
  }
});

test('transport route mutation uses the current-player local scope', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    store.getState(alice, now);
    store.getState(bob, now + 1);
    const committed = store.worldCache.world;
    const scope = createRuntimeMutationScope(committed, alice.id, 'transportShip', {
      operation: 'route-create',
      sourceProvinceId: '110000',
      destinationProvinceId: '130000',
      productId: 'wheat',
      quantity: 1,
      mode: 'road',
    }, { scheduledProcessing: true });
    const draft = cloneWorldForMutation(committed, scope);

    assert.equal(scope.allPlayers, false);
    assert.deepEqual([...scope.playerIds], ['1']);
    assert.equal(scope.segments.has('transportShipments'), true);
    assert.equal(scope.segments.has('populationEconomy'), true);
    assert.notEqual(draft.players['1'], committed.players['1']);
    assert.equal(draft.players['2'], committed.players['2']);
    assert.equal(draft.orders, committed.orders);
  } finally {
    store.stopScheduler();
    store.close();
  }
});

test('segmented rows reconstruct the authoritative world after process restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-storage-v2-'));
  const databasePath = join(directory, 'economy.sqlite');
  try {
    const first = new EconomyStore(databasePath, { scheduledProcessing: false });
    first.getState(alice, now);
    const result = first.apply(alice, action('bankDeposit', { amount: 25 }, 'storage-v2-restart-12345678'), now + 1);
    const revision = result.revision;
    const credits = first.worldCache.world.players['1'].credits;
    const depositCredits = first.worldCache.world.players['1'].bankAccount.depositCredits;
    first.close();

    const second = new EconomyStore(databasePath, { scheduledProcessing: true });
    try {
      const state = second.getState(alice, now + 2);
      assert.equal(second.worldCache.revision, revision);
      assert.equal(state.credits, credits);
      assert.equal(state.bankAccount.depositCredits, depositCredits);
      assert.equal(Number(second.database.prepare(
        'SELECT storage_schema_version FROM economy_world_meta WHERE id = 1',
      ).get().storage_schema_version), WORLD_STORAGE_SCHEMA_VERSION);
    } finally {
      second.stopScheduler();
      second.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('market segment keeps official price, daily counters, and dailyHistory across process restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-market-history-restart-'));
  const databasePath = join(directory, 'economy.sqlite');
  const marketKey = provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat');
  const todayKey = checkInDateKey(now);
  const yesterdayKey = checkInDateKey(now - DAY_MS);
  try {
    const first = new EconomyStore(databasePath, { scheduledProcessing: false });
    first.getState(alice, now);
    const revision = first.worldCache.revision;
    const world = structuredClone(first.worldCache.world);
    const market = world.markets[marketKey];
    market.officialPrice = 1.37;
    market.lastPrice = 1.37;
    market.priceDateKey = todayKey;
    market.todayBuyQuantity = 198_000_000;
    market.todaySellQuantity = 27_000_000;
    market.dailyHistory = [{
      dateKey: yesterdayKey,
      price: 1.34,
      buyQuantity: 120_000_000,
      sellQuantity: 20_000_000,
      volume: 140_000_000,
    }];
    const persistedRevision = first.saveWorld(revision, world, now + 1);
    assert.ok(persistedRevision > revision);
    const storedSegment = JSON.parse(String(first.database.prepare(
      "SELECT state_json FROM economy_world_segments WHERE segment_key = 'markets'",
    ).get().state_json));
    assert.equal(storedSegment[marketKey].dailyHistory[0].dateKey, yesterdayKey);
    first.close();

    const second = new EconomyStore(databasePath, { scheduledProcessing: false });
    try {
      second.getState(alice, now + 2);
      const restored = second.worldCache.world.markets[marketKey];
      assert.equal(second.worldCache.revision, persistedRevision);
      assert.equal(restored.officialPrice, 1.37);
      assert.equal(restored.priceDateKey, todayKey);
      assert.equal(restored.todayBuyQuantity, 198_000_000);
      assert.equal(restored.todaySellQuantity, 27_000_000);
      assert.deepEqual(restored.dailyHistory, [{
        dateKey: yesterdayKey,
        price: 1.34,
        buyQuantity: 120_000_000,
        sellQuantity: 20_000_000,
        volume: 140_000_000,
      }]);
    } finally {
      second.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('current V2 cold restarts do not advance revision or rewrite segmented rows', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-storage-v2-cold-'));
  const databasePath = join(directory, 'economy.sqlite');
  try {
    const first = new EconomyStore(databasePath, { scheduledProcessing: true });
    first.getState(alice, now);
    const before = first.database.prepare(
      "SELECT m.revision, m.updated_at, s.updated_revision AS orders_revision, s.state_json AS orders_json FROM economy_world_meta m JOIN economy_world_segments s ON s.segment_key = 'orders' WHERE m.id = 1",
    ).get();
    first.stopScheduler();
    first.close();

    const second = new EconomyStore(databasePath, { scheduledProcessing: true });
    second.getState(alice, now + 1);
    const afterSecond = second.database.prepare(
      "SELECT m.revision, m.updated_at, s.updated_revision AS orders_revision, s.state_json AS orders_json FROM economy_world_meta m JOIN economy_world_segments s ON s.segment_key = 'orders' WHERE m.id = 1",
    ).get();
    assert.deepEqual(afterSecond, before);
    second.stopScheduler();
    second.close();

    const third = new EconomyStore(databasePath, { scheduledProcessing: true });
    third.getState(alice, now + 2);
    const afterThird = third.database.prepare(
      "SELECT m.revision, m.updated_at, s.updated_revision AS orders_revision, s.state_json AS orders_json FROM economy_world_meta m JOIN economy_world_segments s ON s.segment_key = 'orders' WHERE m.id = 1",
    ).get();
    assert.deepEqual(afterThird, before);
    third.stopScheduler();
    third.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('legacy monolithic world migrates to V2 only once', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-storage-v2-legacy-'));
  const databasePath = join(directory, 'economy.sqlite');
  try {
    const seed = new EconomyStore(databasePath, { scheduledProcessing: false });
    seed.getState(alice, now);
    const legacyWorldJson = JSON.stringify(seed.worldCache.world);
    seed.database.prepare('DELETE FROM economy_world_meta').run();
    seed.database.prepare('DELETE FROM economy_world_players').run();
    seed.database.prepare('DELETE FROM economy_world_segments').run();
    seed.database.prepare(
      'UPDATE economy_world SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1',
    ).run(7, legacyWorldJson, now);
    seed.close();

    const migrated = new EconomyStore(databasePath, { scheduledProcessing: true });
    migrated.getState(alice, now + 1);
    const firstMeta = migrated.database.prepare(
      'SELECT revision, world_version, storage_schema_version, updated_at FROM economy_world_meta WHERE id = 1',
    ).get();
    assert.equal(Number(firstMeta.storage_schema_version), WORLD_STORAGE_SCHEMA_VERSION);
    migrated.stopScheduler();
    migrated.close();

    const reopened = new EconomyStore(databasePath, { scheduledProcessing: true });
    reopened.getState(alice, now + 2);
    const secondMeta = reopened.database.prepare(
      'SELECT revision, world_version, storage_schema_version, updated_at FROM economy_world_meta WHERE id = 1',
    ).get();
    assert.deepEqual(secondMeta, firstMeta);
    reopened.stopScheduler();
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('dirty player write leaves unrelated player and market rows byte-identical', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  store.stopScheduler();
  try {
    store.getState(alice, now);
    store.getState(bob, now + 1);
    const scope = createRuntimeMutationScope(store.worldCache.world, alice.id, 'bankDeposit', { amount: 10 }, {
      scheduledProcessing: store.scheduledProcessing,
    });
    assert.equal(scope.allPlayers, false);
    assert.deepEqual([...scope.playerIds], ['1']);
    const committedBob = store.worldCache.world.players['2'];
    assert.equal(Object.hasOwn(committedBob, 'facilities'), false);
    const bobBefore = store.database.prepare(
      'SELECT updated_revision, state_json FROM economy_world_players WHERE user_id = 2',
    ).get();
    const marketsBefore = store.database.prepare(
      "SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'markets'",
    ).get();

    const result = store.apply(alice, action('bankDeposit', { amount: 10 }, 'storage-v2-dirty-12345678'), now + 2);
    assert.equal(result.result.ok, true);
    assert.equal(store.worldCache.world.players['2'], committedBob);
    assert.equal(Object.hasOwn(store.worldCache.world.players['2'], 'facilities'), false);

    const bobAfter = store.database.prepare(
      'SELECT updated_revision, state_json FROM economy_world_players WHERE user_id = 2',
    ).get();
    const marketsAfter = store.database.prepare(
      "SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'markets'",
    ).get();
    assert.deepEqual(bobAfter, bobBefore);
    assert.deepEqual(marketsAfter, marketsBefore);
  } finally {
    store.close();
  }
});

test('commodity order COW scope clones actor and crossing counterparties only', () => {
  const world = {
    players: {
      1: { userId: 1, marker: 'actor' },
      2: { userId: 2, marker: 'crossing' },
      3: { userId: 3, marker: 'non-crossing' },
    },
    orders: [
      { id: 'crossing', assetKind: 'commodity', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 2, price: 9, remaining: 4, status: 'open' },
      { id: 'expensive', assetKind: 'commodity', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 3, price: 12, remaining: 4, status: 'open' },
    ],
    markets: { wheat: { lastPrice: 10 } },
    bank: {},
    weeklyCashSettlement: {},
    populationEconomy: {},
    marketDemand: {},
    stats: {},
    moneyPrecision: { version: 2 },
    auctionFeeEscrowCredits: 0,
    version: 33,
  };
  const scope = createRuntimeMutationScope(world, 1, 'placeOrder', {
    assetKind: 'commodity',
    productId: 'wheat',
    side: 'buy',
    quantity: 2,
    price: 10,
  }, { scheduledProcessing: true });
  assert.equal(scope.allPlayers, false);
  assert.equal(scope.allSegments, false);
  assert.deepEqual([...scope.playerIds].sort(), ['1', '2']);
  assert.equal(scope.segments.has('orders'), true);
  assert.equal(scope.segments.has('markets'), true);

  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.notEqual(draft.players['2'], world.players['2']);
  assert.equal(draft.players['3'], world.players['3']);
  assert.notEqual(draft.orders, world.orders);
  assert.notEqual(draft.markets, world.markets);
});

test('commodity cancel COW scope stays on the actor and order segment', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    orders: [
      { id: 'mine', assetKind: 'commodity', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 1, price: 10, remaining: 1, status: 'open' },
    ],
  };
  const scope = createRuntimeMutationScope(world, 1, 'cancelOrder', { orderId: 'mine' }, {
    scheduledProcessing: true,
  });
  assert.equal(scope.allPlayers, false);
  assert.deepEqual([...scope.playerIds], ['1']);
  assert.equal(scope.segments.has('orders'), true);
  assert.equal(scope.segments.has('markets'), false);
});

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
    markets: { '110000:wheat': { lastPrice: 9 }, '130000:wheat': { lastPrice: 8 } },
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
  };
  const scope = createRuntimeMutationScope(world, 1, 'buildFacility', {
    provinceId: '110000', autoProcure: true, materialPriceCaps: { wheat: 10 },
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

test('factory auto-operation policy uses bounded order scope without cloning markets', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    orders: [
      { id: 'managed', ownerType: 'player', ownerId: 1, provinceId: '110000', assetKind: 'commodity', productId: 'wheat', side: 'buy', price: 8, remaining: 1, status: 'open' },
      { id: 'other', ownerType: 'player', ownerId: 2, provinceId: '110000', assetKind: 'commodity', productId: 'wheat', side: 'sell', price: 9, remaining: 1, status: 'open' },
    ],
    markets: { '110000:wheat': { lastPrice: 9 } },
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
  };
  const scope = createRuntimeMutationScope(world, 1, 'placeOrder', {
    execution: 'factory-auto-operation-policy', provinceId: '110000', assetKind: 'facility', facilityTypeId: 'farm',
  }, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds], ['1']);
  assert.equal(scope.segments.has('orders'), true);
  assert.equal(scope.segments.has('markets'), false);
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.orders[0], world.orders[0]);
  assert.equal(draft.orders[1], world.orders[1]);
  assert.equal(draft.markets, world.markets);
});

test('profile scope keeps the global order segment shared for name and avatar changes', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    orders: [
      { id: 'open-own', ownerType: 'player', ownerId: 1, status: 'open', remaining: 1 },
      { id: 'closed-own', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0 },
      { id: 'other', ownerType: 'player', ownerId: 2, status: 'open', remaining: 1 },
    ],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
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
      "SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'orders'",
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
      "SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'orders'",
    ).get();
    assert.deepEqual(afterOrders, beforeOrders);
  } finally {
    store.close();
  }
});

test('contract scope clones all contract participants but keeps non-contract players shared', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 }, 3: { userId: 3 }, 4: { userId: 4 } },
    productionContracts: [
      { id: 'contract-a', publisherId: 2, buyerId: 1, supplierId: 2 },
      { id: 'contract-b', publisherId: 3, buyerId: 3, supplierId: 2 },
    ],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
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

test('legacy facility listing cancel scope includes actor and listing owner only', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 }, 3: { userId: 3 } },
    facilityListings: [{ id: 'listing-a', ownerType: 'player', ownerId: 2 }],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
  };
  const scope = createRuntimeMutationScope(world, 1, 'cancelFacilityListing', { listingId: 'listing-a' }, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds].sort(), ['1', '2']);
  assert.equal(scope.segments.has('facilityListings'), true);
  const draft = cloneWorldForMutation(world, scope);
  assert.notEqual(draft.players['1'], world.players['1']);
  assert.notEqual(draft.players['2'], world.players['2']);
  assert.equal(draft.players['3'], world.players['3']);
  assert.notEqual(draft.facilityListings, world.facilityListings);
});

test('production settlement remains current-player local through the action registry', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    orders: [{ id: 'other', ownerType: 'player', ownerId: 2, status: 'open', remaining: 1 }],
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
  };
  const scope = createRuntimeMutationScope(world, 1, 'settleProduction', {}, { scheduledProcessing: true });
  assert.deepEqual([...scope.playerIds], ['1']);
  assert.equal(scope.label, 'local:settleProduction');
  assert.equal(scope.segments.has('orders'), false);
});

test('unregistered interactive actions are rejected instead of falling back to full-world mutation', () => {
  const world = {
    players: { 1: { userId: 1 }, 2: { userId: 2 } },
    bank: {}, weeklyCashSettlement: {}, populationEconomy: {}, marketDemand: {}, stats: {},
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
  };
  assert.throws(
    () => createRuntimeMutationScope(
      world,
      1,
      'futureUnregisteredAction',
      {},
      { scheduledProcessing: true },
    ),
    { code: 'INTERACTIVE_ACTION_SCOPE_UNDECLARED', statusCode: 500 },
  );

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
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
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
    moneyPrecision: { version: 2 }, auctionFeeEscrowCredits: 0, systemMarketAudit: {}, transportShipments: [], version: 33,
  };
  assert.throws(
    () => createRuntimeMutationScope(world, 1, 'placeOrder', {
      execution: 'future-unregistered-execution',
      productId: 'wheat',
      side: 'buy',
      price: 10,
      quantity: 1,
    }, { scheduledProcessing: true }),
    { code: 'ORDER_EXECUTION_UNREGISTERED', statusCode: 400 },
  );
});
