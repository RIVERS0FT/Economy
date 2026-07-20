import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureGiftCodeAdminStore,
  createGiftCodeBatch,
  listGiftCodePage,
  MAX_GIFT_CODE_BATCH_SIZE,
} from '../src/gift-code-batch.js';
import { EconomyStore } from '../src/storage.js';

const now = 1_700_000_000_000;
const admin = { id: 99, email: 'admin@example.com', name: 'Admin', role: 'admin' };
const player = { id: 1, email: 'player@example.com', name: 'Player', role: 'user' };

function requestMeta(requestKey = 'gift-batch-50000') {
  return {
    requestKey,
    method: 'POST',
    path: '/api/game/admin/gift-codes/batch',
  };
}

test('admins can atomically generate and retry a 50000-code batch', () => {
  const store = new EconomyStore(':memory:');
  configureGiftCodeAdminStore(store);
  try {
    const payload = {
      count: MAX_GIFT_CODE_BATCH_SIZE,
      rewardCredits: 25,
      maxRedemptions: 1,
      note: 'launch batch',
    };
    const created = createGiftCodeBatch(store, admin, payload, requestMeta(), now);

    assert.equal(created.createdCount, MAX_GIFT_CODE_BATCH_SIZE);
    assert.equal(created.codes.length, MAX_GIFT_CODE_BATCH_SIZE);
    assert.equal(new Set(created.codes).size, MAX_GIFT_CODE_BATCH_SIZE);
    assert.match(created.codes[0], /^RIVER-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    const firstPage = listGiftCodePage(store, admin);
    assert.equal(firstPage.total, MAX_GIFT_CODE_BATCH_SIZE);
    assert.equal(firstPage.items.length, 100);
    assert.ok(firstPage.nextCursor);

    const retried = createGiftCodeBatch(store, admin, payload, requestMeta(), now + 1);
    assert.deepEqual(retried, created);
    assert.equal(listGiftCodePage(store, admin).total, MAX_GIFT_CODE_BATCH_SIZE);

    const redeemed = store.apply(player, {
      action: 'redeemGift',
      payload: { code: created.codes[0] },
      requestKey: 'redeem-batch-code-1',
      method: 'POST',
      path: '/api/game/gifts/redeem',
    }, now + 2);
    assert.equal(redeemed.result.ok, true);
    assert.equal(store.getState(player, now + 3).credits, 125);
  } finally {
    store.close();
  }
});

test('bulk gift code generation validates count and administrator role', () => {
  const store = new EconomyStore(':memory:');
  configureGiftCodeAdminStore(store);
  try {
    assert.throws(() => createGiftCodeBatch(store, admin, {
      count: MAX_GIFT_CODE_BATCH_SIZE + 1,
      rewardCredits: 1,
      maxRedemptions: 1,
    }, requestMeta('gift-batch-too-large'), now), /1～50000/);

    assert.throws(() => createGiftCodeBatch(store, player, {
      count: 1,
      rewardCredits: 1,
      maxRedemptions: 1,
    }, requestMeta('gift-batch-non-admin'), now), /管理员权限/);
  } finally {
    store.close();
  }
});
