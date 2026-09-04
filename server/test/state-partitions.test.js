import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPartitionedActionDelivery,
  createPartitionedStateDelivery,
  createStatePartitionSnapshot,
  readKnownPartitionRevisionsFromHeader,
  readKnownPartitionRevisionsFromSearch,
} from '../src/state-partitions.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';
import {
  createRequestPerformanceContext,
  runWithRequestPerformance,
  snapshotRequestPerformance,
} from '../src/request-performance.js';

function rankedLeaderboards(score = 100) {
  return {
    period: { key: '2026-07-27', startsAt: 1, endsAt: 2 },
    boards: { wealth: { score } },
  };
}

function sampleState(overrides = {}) {
  return {
    version: CURRENT_CLIENT_STATE_VERSION,
    products: [{ id: 'wheat' }],
    facilityTypes: [{ id: 'farm' }],
    commercialBuildingTypes: [{ id: 'convenience-store' }],
    researchLevels: [{ id: 'C1' }],
    provinces: [{ id: '110000' }],
    defaultProvinceId: '110000',
    userId: 1,
    playerName: 'Alice',
    registeredAt: 1,
    saveEpoch: 0,
    credits: 100,
    frozenCredits: 0,
    gems: 0,
    inventories: {},
    warehouseStoredQuantity: 0,
    assetSummary: { totalAssets: 100 },
    facilityGroups: [],
    research: { active: null },
    checkIn: {},
    bankAccount: {},
    bankSummary: {},
    stats: {},
    lastProcessedAt: 1,
    markets: { wheat: { lastPrice: 2 } },
    facilityMarkets: {},
    orders: [],
    facilityListings: [],
    valuationPrices: {},
    economicCalendar: { version: 2, events: [] },
    assetAuctions: [],
    productionContracts: [],
    leaderboard: [{ rank: 1, playerName: 'Alice' }],
    leaderboards: rankedLeaderboards(),
    ...overrides,
  };
}

test('initial delivery returns all six state partitions without a full state field', () => {
  const delivery = createPartitionedStateDelivery({
    revision: 7,
    unchanged: false,
    state: sampleState(),
  }, {}, 1_700_000_000_000);

  assert.equal(delivery.revision, 7);
  assert.equal(delivery.unchanged, false);
  assert.equal(delivery.serverNow, 1_700_000_000_000);
  assert.equal('state' in delivery, false);
  assert.deepEqual(Object.keys(delivery.patches).sort(), [
    'auction', 'catalog', 'contract', 'leaderboard', 'market', 'player',
  ]);
  assert.equal(delivery.patches.catalog.products[0].id, 'wheat');
  assert.equal(delivery.patches.catalog.provinces[0].id, '110000');
  assert.equal(delivery.patches.catalog.defaultProvinceId, '110000');
  assert.equal(delivery.patches.player.credits, 100);
  assert.equal(delivery.patches.market.markets.wheat.lastPrice, 2);
  assert.equal(delivery.patches.leaderboard.leaderboards.period.key, '2026-07-27');
  assert.equal('leaderboards' in delivery.patches.player, false);
  assert.match(delivery.sliceRevisions['player.assets'], /^[A-Za-z0-9_-]{8,64}$/);
  assert.match(delivery.sliceRevisions['player.production'], /^[A-Za-z0-9_-]{8,64}$/);
  assert.match(delivery.sliceRevisions['market.orders'], /^[A-Za-z0-9_-]{8,64}$/);
  assert.match(delivery.sliceRevisions['market.quotes'], /^[A-Za-z0-9_-]{8,64}$/);
});

test('partition hashing reports exact partition and high-volume field byte gauges', () => {
  const state = sampleState({
    provinceMarkets: { '110000': { wheat: { lastPrice: 2 } } },
    provinceFacilityMarkets: { '110000': { farm: { lastPrice: 10 } } },
    orders: [{ id: 'own-order', isOwn: true }],
  });
  const context = createRequestPerformanceContext();
  const snapshot = runWithRequestPerformance(context, () => createStatePartitionSnapshot(state));
  const metrics = snapshotRequestPerformance(context);
  assert.equal(metrics.gauges.stateOrdersJsonBytes, Buffer.byteLength(JSON.stringify(state.orders)));
  assert.equal(
    metrics.gauges.stateProvinceMarketsJsonBytes,
    Buffer.byteLength(JSON.stringify(state.provinceMarkets)),
  );
  assert.equal(
    metrics.gauges.stateProvinceFacilityMarketsJsonBytes,
    Buffer.byteLength(JSON.stringify(state.provinceFacilityMarkets)),
  );
  for (const partitionName of ['catalog', 'player', 'market', 'auction', 'contract', 'leaderboard']) {
    const gauge = `state${partitionName[0].toUpperCase()}${partitionName.slice(1)}PartitionJsonBytes`;
    assert.equal(metrics.gauges[gauge], Buffer.byteLength(JSON.stringify(snapshot.partitions[partitionName])));
  }
});

test('incomplete catalog states are rejected before delivery', () => {
  assert.throws(
    () => createStatePartitionSnapshot(sampleState({ commercialBuildingTypes: undefined })),
    /客户端目录分区不完整：catalog\.commercialBuildingTypes/,
  );
  assert.throws(
    () => createStatePartitionSnapshot(sampleState({ provinces: undefined })),
    /客户端目录分区不完整：catalog\.provinces/,
  );
  assert.throws(
    () => createStatePartitionSnapshot(sampleState({ defaultProvinceId: 'missing' })),
    /defaultProvinceId 不存在于 catalog\.provinces/,
  );
});

test('precomputed partition snapshots bypass state splitting and hashing during delivery', () => {
  const prepared = createStatePartitionSnapshot(sampleState());
  const delivery = createPartitionedStateDelivery({
    revision: 30,
    unchanged: false,
    ...prepared,
  });

  assert.strictEqual(delivery.patches.catalog, prepared.partitions.catalog);
  assert.strictEqual(delivery.patches.player, prepared.partitions.player);
  assert.deepEqual(delivery.partitionRevisions, prepared.partitionRevisions);
  assert.deepEqual(delivery.sliceRevisions, prepared.sliceRevisions);
});

test('invalid precomputed catalog snapshots rebuild from the complete state', () => {
  const prepared = createStatePartitionSnapshot(sampleState());
  const invalidCatalog = { ...prepared.partitions.catalog };
  delete invalidCatalog.provinces;
  const delivery = createPartitionedStateDelivery({
    revision: 31,
    unchanged: false,
    state: sampleState(),
    partitions: { ...prepared.partitions, catalog: invalidCatalog },
    partitionRevisions: prepared.partitionRevisions,
    sliceRevisions: prepared.sliceRevisions,
  });

  assert.equal(delivery.patches.catalog.provinces[0].id, '110000');
  assert.equal(delivery.patches.catalog.defaultProvinceId, '110000');
});

test('catalog snapshots reuse one static partition and revision across player projections', () => {
  const first = createStatePartitionSnapshot(sampleState());
  const catalogSnapshot = {
    version: first.partitions.catalog.version,
    partition: first.partitions.catalog,
    revision: first.partitionRevisions.catalog,
  };
  const second = createStatePartitionSnapshot(sampleState({ userId: 2, playerName: 'Bob' }), { catalogSnapshot });

  assert.strictEqual(second.partitions.catalog, first.partitions.catalog);
  assert.equal(second.partitionRevisions.catalog, first.partitionRevisions.catalog);
  assert.notEqual(second.partitionRevisions.player, first.partitionRevisions.player);
  assert.notEqual(second.sliceRevisions['player.identity'], first.sliceRevisions['player.identity']);
  assert.equal(second.sliceRevisions['player.assets'], first.sliceRevisions['player.assets']);
});

test('invalid cached catalog snapshots are never reused', () => {
  const first = createStatePartitionSnapshot(sampleState());
  const invalidCatalog = { ...first.partitions.catalog };
  delete invalidCatalog.provinces;
  const second = createStatePartitionSnapshot(sampleState({ userId: 2, playerName: 'Bob' }), {
    catalogSnapshot: {
      version: first.partitions.catalog.version,
      partition: invalidCatalog,
      revision: first.partitionRevisions.catalog,
    },
  });

  assert.notStrictEqual(second.partitions.catalog, invalidCatalog);
  assert.equal(second.partitions.catalog.provinces[0].id, '110000');
});

test('cached catalogs without commercial building types are never reused', () => {
  const first = createStatePartitionSnapshot(sampleState());
  const staleCatalog = { ...first.partitions.catalog };
  delete staleCatalog.commercialBuildingTypes;
  const second = createStatePartitionSnapshot(sampleState({ userId: 2, playerName: 'Bob' }), {
    catalogSnapshot: {
      version: first.partitions.catalog.version,
      partition: staleCatalog,
      revision: first.partitionRevisions.catalog,
    },
  });

  assert.notStrictEqual(second.partitions.catalog, staleCatalog);
  assert.equal(second.partitions.catalog.commercialBuildingTypes[0].id, 'convenience-store');
});

test('known partition revisions suppress unchanged partitions and isolate player slices', () => {
  const initial = createPartitionedStateDelivery({
    revision: 7,
    unchanged: false,
    state: sampleState(),
  });
  const changed = createPartitionedStateDelivery({
    revision: 8,
    unchanged: false,
    state: sampleState({ credits: 101 }),
  }, initial.partitionRevisions);

  assert.equal(changed.unchanged, false);
  assert.deepEqual(Object.keys(changed.patches), ['player']);
  assert.equal(changed.patches.player.credits, 101);
  assert.equal(changed.partitionRevisions.catalog, initial.partitionRevisions.catalog);
  assert.notEqual(changed.partitionRevisions.player, initial.partitionRevisions.player);
  assert.notEqual(changed.sliceRevisions['player.assets'], initial.sliceRevisions['player.assets']);
  assert.equal(changed.sliceRevisions['player.production'], initial.sliceRevisions['player.production']);
  assert.equal(changed.sliceRevisions['player.bank'], initial.sliceRevisions['player.bank']);
});

test('market quote changes keep the market order slice revision stable', () => {
  const initial = createPartitionedStateDelivery({ revision: 40, unchanged: false, state: sampleState() });
  const changed = createPartitionedStateDelivery({
    revision: 41,
    unchanged: false,
    state: sampleState({ markets: { wheat: { lastPrice: 2.1 } } }),
  }, initial.partitionRevisions);

  assert.deepEqual(Object.keys(changed.patches), ['market']);
  assert.equal(changed.sliceRevisions['market.orders'], initial.sliceRevisions['market.orders']);
  assert.notEqual(changed.sliceRevisions['market.quotes'], initial.sliceRevisions['market.quotes']);
});

test('order changes keep market quote and calendar slice revisions stable', () => {
  const initial = createPartitionedStateDelivery({ revision: 50, unchanged: false, state: sampleState() });
  const changed = createPartitionedStateDelivery({
    revision: 51,
    unchanged: false,
    state: sampleState({ orders: [{ id: 'order-1' }] }),
  }, initial.partitionRevisions);

  assert.deepEqual(Object.keys(changed.patches), ['market']);
  assert.notEqual(changed.sliceRevisions['market.orders'], initial.sliceRevisions['market.orders']);
  assert.equal(changed.sliceRevisions['market.quotes'], initial.sliceRevisions['market.quotes']);
  assert.equal(changed.sliceRevisions['market.calendar'], initial.sliceRevisions['market.calendar']);
});

test('ranked leaderboard changes stay inside the leaderboard partition', () => {
  const initial = createPartitionedStateDelivery({
    revision: 20,
    unchanged: false,
    state: sampleState(),
  });
  const changed = createPartitionedStateDelivery({
    revision: 21,
    unchanged: false,
    state: sampleState({ leaderboards: rankedLeaderboards(101) }),
  }, initial.partitionRevisions);

  assert.deepEqual(Object.keys(changed.patches), ['leaderboard']);
  assert.equal(changed.patches.leaderboard.leaderboards.boards.wealth.score, 101);
  assert.equal(changed.partitionRevisions.player, initial.partitionRevisions.player);
  assert.notEqual(changed.partitionRevisions.leaderboard, initial.partitionRevisions.leaderboard);
});

test('a global revision change unrelated to the viewer can return no patches', () => {
  const state = sampleState();
  const initial = createPartitionedStateDelivery({ revision: 10, unchanged: false, state });
  const later = createPartitionedStateDelivery({
    revision: 11,
    unchanged: false,
    state: structuredClone(state),
  }, initial.partitionRevisions);

  assert.deepEqual(later.patches, {});
  assert.equal(later.unchanged, true);
  assert.equal(later.revision, 11);
});

test('unchanged delivery still returns a fresh server time without creating patches', () => {
  const delivery = createPartitionedStateDelivery({
    revision: 12,
    unchanged: true,
  }, {}, 1_700_000_005_000);

  assert.deepEqual(delivery, {
    revision: 12,
    unchanged: true,
    serverNow: 1_700_000_005_000,
  });
});

test('action delivery returns the command result with the committed authoritative delta', () => {
  const initial = createPartitionedStateDelivery({
    revision: 20,
    unchanged: false,
    state: sampleState(),
  });
  const stateSnapshot = {
    revision: 21,
    unchanged: false,
    ...createStatePartitionSnapshot(sampleState({ credits: 101 })),
  };
  const action = createPartitionedActionDelivery({
    result: { ok: true, message: '操作完成', creditsReceived: 10 },
    revision: 21,
    stateSnapshot,
  }, initial.partitionRevisions, 1_700_000_006_000);

  assert.equal(action.result.ok, true);
  assert.equal(action.result.message, '操作完成');
  assert.equal('creditsReceived' in action.result, false);
  assert.equal(action.commandRevision, 21);
  assert.equal(action.revision, 21);
  assert.equal(action.serverNow, 1_700_000_006_000);
  assert.deepEqual(Object.keys(action.patches), ['player']);
  assert.equal(action.patches.player.credits, 101);
  assert.equal(action.unchanged, false);
});

test('action delivery rejects a state snapshot older than the committed command', () => {
  const stateSnapshot = {
    revision: 20,
    unchanged: false,
    ...createStatePartitionSnapshot(sampleState()),
  };
  assert.throws(() => createPartitionedActionDelivery({
    result: { ok: true, message: '操作完成' },
    revision: 21,
    stateSnapshot,
  }), /动作后的权威状态落后于已提交操作/);
});

test('partition revisions accept only bounded safe tokens', () => {
  const query = new URLSearchParams({
    catalog: 'catalog_1234',
    player: 'bad token',
    market: 'm'.repeat(65),
  });
  assert.deepEqual(readKnownPartitionRevisionsFromSearch(query), { catalog: 'catalog_1234' });
  assert.deepEqual(
    readKnownPartitionRevisionsFromHeader(JSON.stringify({ player: 'player-1234', auction: 7 })),
    { player: 'player-1234' },
  );
  assert.deepEqual(readKnownPartitionRevisionsFromHeader('{bad json'), {});
});
