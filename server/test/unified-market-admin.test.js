import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';

const now = 1_700_000_000_000;
const admin = { id: 99, email: 'admin@example.com', name: 'Admin', role: 'admin' };
const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };

test('gift codes can be created by admins and redeemed once per player', () => {
  const store = new EconomyStore(':memory:');
  try {
    const created = store.createGiftCode(admin, { code: 'RIVER-TEST', rewardCredits: 25, maxRedemptions: 2 }, { requestKey: 'admin-create-1234', method: 'POST', path: '/api/game/admin/gift-codes' }, now);
    assert.equal(created.code, 'RIVER-TEST');
    const request = { action: 'redeemGift', payload: { code: 'river-test' }, requestKey: 'redeem-gift-1234', method: 'POST', path: '/api/game/gifts/redeem' };
    const first = store.apply(alice, request, now + 1);
    assert.equal(first.result.ok, true);
    assert.equal(store.getState(alice, now + 2).credits, 125);
    const duplicate = store.apply(alice, { ...request, requestKey: 'redeem-gift-5678' }, now + 3);
    assert.equal(duplicate.result.ok, false);
    assert.equal(store.getState(alice, now + 4).stats.giftIssued, 25);
  } finally { store.close(); }
});

test('non-admin users cannot read administrator summary', () => {
  const store = new EconomyStore(':memory:');
  try {
    assert.throws(() => store.getAdminSummary(alice, now), /管理员权限/);
  } finally { store.close(); }
});
