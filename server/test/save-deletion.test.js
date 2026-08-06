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
    assert.equal(preflight.alreadyUsed, false);
    assert.equal(preflight.autoClose.orders, 1);

    const response = deletePlayerSave(store, user, {
      confirmation: '删除存档',
      requestKey: 'save-delete-request-0001',
    }, now + 4);
    assert.equal(response.result.ok, true);
    assert.equal(response.saveEpoch, 1);

    const world = store.loadWorld(now + 5).world;
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
    assert.equal(player.inventoryCapacity, 500);
    assert.equal(player.bankAccount.depositCredits, 0);
    assert.equal(player.bankAccount.activeLoan, null);
    assert.equal((player.facilityGroups || []).length, 0);
    assert.equal(world.orders.some((order) => Number(order.ownerId) === Number(user.id)), false);
    assert.equal(
      store.database.prepare('SELECT COUNT(*) AS total FROM economy_save_deletions WHERE user_id = ?')
        .get(Number(user.id)).total,
      1,
    );

    const after = getPlayerSaveDeletionPreflight(store, user, now + 6);
    assert.equal(after.allowed, false);
    assert.equal(after.alreadyUsed, true);
    assert.match(after.blockers[0].message, /已经使用过一次/);

    assert.doesNotThrow(() => assertPlayerSaveEpoch(store, user, '1', now + 6));
    assert.throws(
      () => assertPlayerSaveEpoch(store, user, '0', now + 6),
      (error) => error.statusCode === 409 && error.code === 'SAVE_EPOCH_MISMATCH',
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
