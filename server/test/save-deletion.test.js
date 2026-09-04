import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';
import {
  assertPlayerSaveEpoch,
  deletePlayerSave,
  getPlayerSaveDeletionPreflight,
} from '../src/save-deletion.js';
import { ensurePlayerBankAccount } from '../src/banking.js';
import { cloneWorldForMutation, createRuntimeMutationScope } from '../src/world-storage-v2.js';

const user = {
  id: 91001,
  name: 'Save Deletion Tester',
  email: 'save-deletion@example.com',
  role: 'user',
};
const now = Date.UTC(2026, 7, 6, 12, 0, 0);

function apply(store, action, payload, requestKey, at) {
  return store.apply(user, {
    action,
    payload,
    requestKey,
    method: 'POST',
    path: `/test/${action}`,
  }, at);
}

function applyWithEpoch(store, expectedEpoch, action, payload, requestKey, at) {
  assertPlayerSaveEpoch(store, user, expectedEpoch, at);
  return apply(store, action, payload, requestKey, at);
}

test('delete save recreates the player baseline and preserves permanent account rewards', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.getState(user, now);
    store.transaction(() => {
      const { revision, world } = store.loadWorld(now + 1);
      const player = ensurePlayer(world, user, now + 1);
      player.credits = 321;
      player.gems = 17;
      player.stats.invitationGemsIssued = 10;
      player.inventories.timber.available = 9;
      store.saveWorld(revision, world, now + 1);
    });

    const placed = apply(store, 'placeOrder', {
      assetKind: 'commodity',
      assetId: 'timber',
      productId: 'timber',
      side: 'sell',
      quantity: 1,
      price: 999,
    }, 'save-delete-order-0001', now + 2);
    assert.equal(placed.result.ok, true);

    const before = store.loadWorld(now + 3).world.players[String(user.id)];
    const registeredAt = before.registeredAt;
    const preflight = getPlayerSaveDeletionPreflight(store, user, now + 3);
    assert.equal(preflight.allowed, true);
    assert.equal(preflight.autoClose.orders, 0);

    const response = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-request-0001',
    }, now + 4);
    assert.equal(response.result.ok, true);
    assert.equal(response.saveEpoch, 1);

    const replay = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-request-0001',
    }, now + 5);
    assert.deepEqual(replay, response);

    const world = store.loadWorld(now + 6).world;
    const player = world.players[String(user.id)];
    assert.equal(player.credits, 500);
    assert.equal(player.frozenCredits, 0);
    assert.equal(player.gems, 17);
    assert.equal(player.stats.invitationGemsIssued, 10);
    assert.equal(player.registeredAt, registeredAt);
    assert.equal(player.saveEpoch, 1);
    assert.equal(player.saveCreatedAt, now + 4);
    assert.equal(player.saveResetCount, 1);
    assert.equal(player.inventories.timber.available, 0);
    assert.equal(player.inventories.ore.available, 0);
    assert.equal('inventoryCapacity' in player, false);
    assert.equal(player.bankAccount.depositCredits, 0);
    assert.equal(player.bankAccount.activeLoan, null);
    assert.equal((player.facilityGroups || []).length, 0);
    assert.equal(world.orders.some((order) => Number(order.ownerId) === Number(user.id)), false);
    assert.equal(
      store.database.prepare('SELECT COUNT(*) AS total FROM economy_save_deletions WHERE user_id = ?')
        .get(Number(user.id)).total,
      1,
    );

    const after = getPlayerSaveDeletionPreflight(store, user, now + 7);
    assert.equal(after.allowed, true);
    assert.equal(after.saveEpoch, 1);

    assert.doesNotThrow(() => assertPlayerSaveEpoch(store, user, '1', now + 7));
    assert.throws(
      () => assertPlayerSaveEpoch(store, user, '0', now + 7),
      (error) => error.statusCode === 409 && error.code === 'SAVE_EPOCH_MISMATCH',
    );
    assert.throws(
      () => assertPlayerSaveEpoch(store, user, undefined, now + 7),
      (error) => error.statusCode === 409 && error.code === 'SAVE_EPOCH_MISMATCH',
    );
  } finally {
    store.close();
  }
});

test('repeat delete creates a new save epoch and appends audit history', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.getState(user, now);
    const first = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-repeat-0001',
      expectedSaveEpoch: '0',
    }, now + 1);
    assert.equal(first.saveEpoch, 1);

    const preflight = getPlayerSaveDeletionPreflight(store, user, now + 2);
    assert.equal(preflight.allowed, true);
    assert.equal(preflight.saveEpoch, 1);

    const second = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-repeat-0002',
      expectedSaveEpoch: '1',
    }, now + 3);
    assert.equal(second.saveEpoch, 2);

    const replay = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-repeat-0002',
      expectedSaveEpoch: '1',
    }, now + 4);
    assert.deepEqual(replay, second, '幂等重放不得重复删除新存档');

    const world = store.loadWorld(now + 5).world;
    const player = world.players[String(user.id)];
    assert.equal(player.credits, 500);
    assert.equal(player.saveEpoch, 2);
    assert.equal(player.saveResetCount, 2);
    const history = store.database.prepare(`
      SELECT save_epoch_before, save_epoch_after
      FROM economy_save_deletions
      WHERE user_id = ?
      ORDER BY id
    `).all(Number(user.id));
    assert.deepEqual(
      history.map((row) => [Number(row.save_epoch_before), Number(row.save_epoch_after)]),
      [[0, 1], [1, 2]],
    );

    assert.doesNotThrow(() => assertPlayerSaveEpoch(store, user, '2', now + 5));
    assert.throws(
      () => assertPlayerSaveEpoch(store, user, '1', now + 5),
      (error) => error.statusCode === 409 && error.code === 'SAVE_EPOCH_MISMATCH',
    );
  } finally {
    store.close();
  }
});

test('legacy single-use save deletion audit migrates without blocking another deletion', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.database.exec(`
      CREATE TABLE economy_save_deletions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        save_epoch_before INTEGER NOT NULL CHECK (save_epoch_before >= 0),
        save_epoch_after INTEGER NOT NULL CHECK (save_epoch_after > save_epoch_before),
        deleted_at INTEGER NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        asset_summary_json TEXT NOT NULL,
        auto_closed_json TEXT NOT NULL
      ) STRICT;
      INSERT INTO economy_save_deletions (
        user_id, save_epoch_before, save_epoch_after, deleted_at,
        request_key, asset_summary_json, auto_closed_json
      ) VALUES (91001, 0, 1, 1, 'legacy-delete-0001', '{}', '{}');
    `);
    store.getState(user, now);

    const preflight = getPlayerSaveDeletionPreflight(store, user, now + 1);
    assert.equal(preflight.allowed, true);
    const definition = store.database.prepare(`
      SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'economy_save_deletions'
    `).get();
    assert.doesNotMatch(String(definition.sql), /user_id INTEGER NOT NULL UNIQUE/);

    const deletion = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'legacy-delete-0002',
      expectedSaveEpoch: '0',
    }, now + 2);
    assert.equal(deletion.saveEpoch, 1);
    assert.equal(
      store.database.prepare('SELECT COUNT(*) AS total FROM economy_save_deletions WHERE user_id = ?')
        .get(Number(user.id)).total,
      2,
    );
  } finally {
    store.close();
  }
});

test('stale tab writes are rejected after save deletion while the new epoch remains writable', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.getState(user, now);
    const oldEpoch = '0';
    const deletion = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-stale-tab-0001',
    }, now + 1);
    assert.equal(deletion.saveEpoch, 1);

    const afterDeletion = store.loadWorld(now + 2);
    const revisionAfterDeletion = afterDeletion.revision;
    const playerAfterDeletion = afterDeletion.world.players[String(user.id)];
    assert.equal(playerAfterDeletion.saveEpoch, 1);
    assert.equal(playerAfterDeletion.credits, 500);
    assert.equal((playerAfterDeletion.facilityGroups || []).length, 0);
    assert.equal(playerAfterDeletion.research?.active || null, null);
    assert.equal(afterDeletion.world.orders.some((order) => Number(order.ownerId) === Number(user.id)), false);

    const staleWrites = [
      ['buildFacility', { facilityTypeId: 'farm', quantity: 1 }, 'save-stale-build-0001'],
      ['placeOrder', {
        assetKind: 'commodity',
        assetId: 'wheat',
        productId: 'wheat',
        side: 'buy',
        quantity: 1,
        price: 0.01,
      }, 'save-stale-order-0001'],
      ['startResearch', { technologyId: 'forestry-development' }, 'save-stale-research-0001'],
    ];
    for (const [action, payload, requestKey] of staleWrites) {
      assert.throws(
        () => applyWithEpoch(store, oldEpoch, action, payload, requestKey, now + 3),
        (error) => error.statusCode === 409 && error.code === 'SAVE_EPOCH_MISMATCH',
        `旧存档世代不得执行 ${action}`,
      );
    }
    assert.throws(
      () => applyWithEpoch(store, undefined, 'buildFacility', { facilityTypeId: 'farm', quantity: 1 }, 'save-stale-missing-0001', now + 3),
      (error) => error.statusCode === 409 && error.code === 'SAVE_EPOCH_MISMATCH',
      '删档后的缺失存档世代不得继续写入',
    );

    const afterRejectedWrites = store.loadWorld(now + 4);
    assert.equal(afterRejectedWrites.revision, revisionAfterDeletion, '旧标签页请求不得推进世界修订号');
    const unchangedPlayer = afterRejectedWrites.world.players[String(user.id)];
    assert.equal(unchangedPlayer.credits, 500, '旧标签页请求不得扣除资金');
    assert.equal((unchangedPlayer.facilityGroups || []).length, 0, '旧标签页请求不得创建工厂');
    assert.equal(unchangedPlayer.research?.active || null, null, '旧标签页请求不得启动研发');
    assert.equal(afterRejectedWrites.world.orders.some((order) => Number(order.ownerId) === Number(user.id)), false, '旧标签页请求不得创建订单');

    const currentWrite = applyWithEpoch(
      store,
      '1',
      'buildFacility',
      { facilityTypeId: 'farm', quantity: 1 },
      'save-current-build-0001',
      now + 5,
    );
    assert.equal(currentWrite.result.ok, true);
    const currentWorld = store.loadWorld(now + 6).world;
    const currentPlayer = currentWorld.players[String(user.id)];
    assert.equal(currentPlayer.credits, 450);
    assert.equal(
      currentPlayer.facilityGroups.find((group) => group.facilityTypeId === 'farm')?.count,
      1,
      '当前存档世代必须保持可写',
    );
  } finally {
    store.close();
  }
});

test('active liabilities block save deletion without changing the player', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.getState(user, now);
    store.transaction(() => {
      const { revision, world } = store.loadWorld(now + 1);
      const player = ensurePlayer(world, user, now + 1);
      const account = ensurePlayerBankAccount(player, now + 1);
      account.activeLoan = {
        id: 'bank-loan-save-deletion',
        status: 'active',
        borrowedAt: now,
        dueAt: now + 72 * 60 * 60 * 1000,
        graceEndsAt: now + 84 * 60 * 60 * 1000,
        principalOriginal: 100,
        principalOutstanding: 100,
        interestOriginal: 3,
        interestOutstanding: 3,
        interestRateBps: 300,
        collateral: [{ facilityTypeId: 'farm', quantity: 1, prudentUnitValue: 80 }],
        collateralValueAtOrigination: 80,
        ltvBps: 5_000,
        autoRepay: false,
      };
      store.saveWorld(revision, world, now + 1);
    });

    const preflight = getPlayerSaveDeletionPreflight(store, user, now + 2);
    assert.equal(preflight.allowed, false);
    assert.ok(preflight.blockers.some((entry) => entry.type === 'active_bank_loan'));
    assert.throws(
      () => deletePlayerSave(store, user, {
        confirmation: '删除存档',
        requestKey: 'save-delete-blocked-0001',
      }, now + 3),
      (error) => error.statusCode === 409 && error.code === 'SAVE_DELETION_BLOCKED',
    );
    assert.equal(store.loadWorld(now + 4).world.players[String(user.id)].saveEpoch || 0, 0);
  } finally {
    store.close();
  }
});

test('scheduled save deletion keeps unrelated players and markets shared', () => {
  const inertTimer = { unref() {} };
  const store = new EconomyStore(':memory:', {
    scheduledProcessing: true,
    nowProvider: () => now,
    setTimeoutFn: () => inertTimer,
    clearTimeoutFn: () => {},
  });
  const unrelatedUser = {
    id: 91002,
    name: 'Unrelated Save Player',
    email: 'unrelated-save@example.com',
    role: 'user',
  };
  try {
    store.getState(user, now);
    store.transaction(() => {
      const { revision, world } = store.loadWorld(now + 1);
      ensurePlayer(world, unrelatedUser, now + 1);
      store.saveWorld(revision, world, now + 1);
    });

    const committed = store.worldCache.world;
    const unrelatedPlayer = committed.players[String(unrelatedUser.id)];
    const markets = committed.markets;
    const preflightScope = createRuntimeMutationScope(
      committed,
      user.id,
      'saveDeletionPreflight',
      { preflight: true },
      { scheduledProcessing: true },
    );
    const preflightDraft = cloneWorldForMutation(committed, preflightScope);
    assert.equal(preflightScope.label, 'save-deletion:preflight');
    assert.notEqual(preflightDraft.players[String(user.id)], committed.players[String(user.id)]);
    assert.equal(preflightDraft.players[String(unrelatedUser.id)], unrelatedPlayer);
    assert.equal(preflightDraft.orders, committed.orders);
    assert.equal(preflightDraft.markets, markets);

    const response = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-bounded-scope-0001',
      expectedSaveEpoch: '0',
    }, now + 2);
    assert.equal(response.result.ok, true);

    const after = store.worldCache.world;
    assert.equal(after.players[String(unrelatedUser.id)], unrelatedPlayer, '删档不得复制无关玩家');
    assert.equal(after.markets, markets, '删档不得复制无关市场');
    assert.notEqual(after.orders, committed.orders, '删档只复制会被清理的订单分区');
    assert.notEqual(after.assetAuctions, committed.assetAuctions, '删档只复制会被清理的拍卖分区');
    assert.notEqual(after.productionContracts, committed.productionContracts, '删档只复制会被清理的合同分区');
    assert.equal(after.players[String(user.id)].saveEpoch, 1);
  } finally {
    store.close();
  }
});
