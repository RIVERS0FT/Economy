import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPartitionedActionDelivery,
  createPartitionedStateDelivery,
  readKnownPartitionRevisionsFromHeader,
  readKnownPartitionRevisionsFromSearch,
} from '../src/state-partitions.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';

function sampleState(overrides = {}) {
  return {
    version: CURRENT_CLIENT_STATE_VERSION,
    products: [{ id: 'wheat' }],
    facilityTypes: [{ id: 'farm' }],
    userId: 1,
    playerName: 'Alice',
    credits: 100,
    inventories: {},
    markets: { wheat: { lastPrice: 2 } },
    facilityMarkets: {},
    orders: [],
    facilityListings: [],
    valuationPrices: {},
    collectibles: [],
    assetAuctions: [],
    collectibleAuctions: [],
    leaderboard: [{ rank: 1, playerName: 'Alice' }],
    ...overrides,
  };
}

test('initial delivery returns all five state partitions without a full state field', () => {
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
    'auction', 'catalog', 'leaderboard', 'market', 'player',
  ]);
  assert.equal(delivery.patches.catalog.products[0].id, 'wheat');
  assert.equal(delivery.patches.player.credits, 100);
  assert.equal(delivery.patches.market.markets.wheat.lastPrice, 2);
});

test('known partition revisions suppress unchanged partitions', () => {
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

test('action delivery keeps only result status, message, and committed revision', () => {
  const action = createPartitionedActionDelivery({
    result: { ok: true, message: '工作完成', creditsReceived: 10 },
    revision: 21,
    unchanged: false,
    partitionRevisions: { player: 'player-00001' },
    patches: { player: { credits: 101 } },
    state: sampleState({ credits: 101 }),
  });

  assert.deepEqual(action, {
    result: { ok: true, message: '工作完成' },
    revision: 21,
  });
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
