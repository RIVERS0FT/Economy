import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPartitionedActionDelivery,
  createStatePartitionSnapshot,
} from '../src/state-partitions.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';

function state(overrides = {}) {
  return {
    version: CURRENT_CLIENT_STATE_VERSION,
    products: [{ id: 'wheat' }],
    facilityTypes: [{ id: 'farm' }],
    commercialBuildingTypes: [{ id: 'convenience-store' }],
    researchLevels: [{ id: 'C1' }],
    provinces: [{ id: '110000' }],
    defaultProvinceId: '110000',
    userId: 1,
    credits: 100,
    orders: [],
    assetAuctions: [],
    productionContracts: [],
    leaderboard: [],
    ...overrides,
  };
}

function actionResponse(commandRevision, snapshotRevision, nextState) {
  return {
    result: { ok: true, message: '操作完成' },
    revision: commandRevision,
    stateSnapshot: {
      revision: snapshotRevision,
      unchanged: false,
      ...createStatePartitionSnapshot(nextState),
    },
  };
}

test('idempotent command result stays stable while authority delivery may advance', () => {
  const first = createPartitionedActionDelivery(
    actionResponse(7, 7, state({ credits: 101 })),
    {},
    1_000,
  );
  const replay = createPartitionedActionDelivery(
    actionResponse(7, 9, state({ credits: 102 })),
    first.partitionRevisions,
    2_000,
  );

  assert.deepEqual(replay.result, first.result);
  assert.equal(first.commandRevision, 7);
  assert.equal(replay.commandRevision, 7);
  assert.equal(first.revision, 7);
  assert.equal(replay.revision, 9);
  assert.equal(first.serverNow, 1_000);
  assert.equal(replay.serverNow, 2_000);
  assert.ok(replay.revision >= replay.commandRevision);
});
