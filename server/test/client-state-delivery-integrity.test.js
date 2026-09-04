import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStateDeliveryCache,
  StateDeliveryIntegrityError,
  subscribeStateAuthority,
} from '../../src/app/stateDelivery.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';

function fullDelivery(revision = 7) {
  return {
    revision,
    unchanged: false,
    serverNow: 10_000,
    partitionRevisions: {
      catalog: 'catalog-0001',
      player: 'player-00001',
      market: 'market-00001',
      auction: 'auction-0001',
      contract: 'contract-0001',
      leaderboard: 'leader-00001',
    },
    patches: {
      catalog: {
        version: CURRENT_CLIENT_STATE_VERSION,
        products: [{ id: 'wheat' }],
        facilityTypes: [{ id: 'farm' }],
        commercialBuildingTypes: [{ id: 'convenience-store' }],
        researchLevels: [{ id: 'C1' }],
        provinces: [{ id: '110000' }],
        defaultProvinceId: '110000',
      },
      player: { userId: 1, saveEpoch: 1, credits: 100 },
      market: { orders: [] },
      auction: {},
      contract: {},
      leaderboard: {},
    },
  };
}

test('client rejects an initial delivery without partition patches', () => {
  const cache = createStateDeliveryCache();

  assert.throws(
    () => cache.accept({
      revision: 7,
      unchanged: true,
      serverNow: 10_000,
    }),
    StateDeliveryIntegrityError,
  );
  assert.equal(cache.getSnapshot().revision, null);
  assert.equal(cache.getSnapshot().state, null);
});

test('client treats a missing catalog version as delivery integrity failure', () => {
  const cache = createStateDeliveryCache();
  const delivery = fullDelivery();
  delete delivery.patches.catalog.version;

  assert.throws(
    () => cache.accept(delivery),
    StateDeliveryIntegrityError,
  );
  assert.equal(cache.getSnapshot().revision, null);
  assert.equal(cache.getSnapshot().state, null);
  assert.deepEqual(cache.getPartitionRevisions(), {});
});

test('client rejects an incomplete initial catalog before publishing authority state', () => {
  const cache = createStateDeliveryCache();
  const delivery = fullDelivery();
  delete delivery.patches.catalog.provinces;

  assert.throws(
    () => cache.accept(delivery),
    StateDeliveryIntegrityError,
  );
  assert.equal(cache.getSnapshot().revision, null);
  assert.equal(cache.getSnapshot().state, null);
  assert.deepEqual(cache.getPartitionRevisions(), {});
});

test('client rejects an initial catalog without the commercial building directory', () => {
  const cache = createStateDeliveryCache();
  const delivery = fullDelivery();
  delete delivery.patches.catalog.commercialBuildingTypes;

  assert.throws(
    () => cache.accept(delivery),
    /catalog\.commercialBuildingTypes/,
  );
  assert.equal(cache.getSnapshot().revision, null);
  assert.equal(cache.getSnapshot().state, null);
  assert.deepEqual(cache.getPartitionRevisions(), {});
});

test('client keeps the previous valid snapshot when a later catalog patch is incomplete', () => {
  const cache = createStateDeliveryCache();
  cache.accept(fullDelivery());

  assert.throws(
    () => cache.accept({
      revision: 8,
      unchanged: false,
      serverNow: 11_000,
      partitionRevisions: {
        catalog: 'catalog-0002',
        player: 'player-00001',
        market: 'market-00001',
        auction: 'auction-0001',
        contract: 'contract-0001',
        leaderboard: 'leader-00001',
      },
      patches: {
        catalog: {
          version: CURRENT_CLIENT_STATE_VERSION,
          products: [{ id: 'wheat' }],
          facilityTypes: [{ id: 'farm' }],
          researchLevels: [{ id: 'C1' }],
          defaultProvinceId: '110000',
        },
      },
    }),
    StateDeliveryIntegrityError,
  );

  const snapshot = cache.getSnapshot();
  assert.equal(snapshot.revision, 7);
  assert.equal(snapshot.state?.credits, 100);
  assert.equal(snapshot.state?.provinces?.[0]?.id, '110000');
  assert.equal(cache.getPartitionRevisions().catalog, 'catalog-0001');
});

test('pre-publish state validation is transactional and does not notify authority listeners on rejection', () => {
  const cache = createStateDeliveryCache({
    validateState(state) {
      if (state.saveEpoch !== 1) throw new Error('page save epoch mismatch');
    },
  });
  cache.accept(fullDelivery());
  let notifications = 0;
  const unsubscribe = subscribeStateAuthority(() => { notifications += 1; });

  try {
    assert.throws(
      () => cache.accept({
        revision: 8,
        unchanged: false,
        serverNow: 11_000,
        partitionRevisions: {
          catalog: 'catalog-0001',
          player: 'player-00002',
          market: 'market-00001',
          auction: 'auction-0001',
          contract: 'contract-0001',
          leaderboard: 'leader-00001',
        },
        patches: {
          player: { userId: 1, saveEpoch: 2, credits: 200 },
        },
      }),
      /page save epoch mismatch/,
    );
  } finally {
    unsubscribe();
  }

  const snapshot = cache.getSnapshot();
  assert.equal(snapshot.revision, 7);
  assert.equal(snapshot.state?.saveEpoch, 1);
  assert.equal(snapshot.state?.credits, 100);
  assert.equal(cache.getPartitionRevisions().player, 'player-00001');
  assert.equal(notifications, 0);
});
