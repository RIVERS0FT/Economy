import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  configureGiftCodeAdminStore,
  listGiftCodePage,
  listGiftRedemptionPage,
} from '../src/gift-code-batch.js';
import { EconomyStore } from '../src/storage.js';

function codeHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('gift codes and redemptions use stable cursor pagination', () => {
  const store = new EconomyStore(':memory:');
  const admin = { id: 99, email: 'admin@example.com', role: 'admin' };
  configureGiftCodeAdminStore(store);
  try {
    for (let index = 1; index <= 5; index += 1) {
      store.insertGiftCode.run(codeHash(`CODE-${index}`), 100, 10, 0, null, admin.id, index, `code ${index}`);
    }

    const firstCodes = listGiftCodePage(store, admin, { limit: 2 });
    const secondCodes = listGiftCodePage(store, admin, { limit: 2, cursor: firstCodes.nextCursor });
    assert.equal(firstCodes.total, 5);
    assert.deepEqual(firstCodes.items.map((item) => item.id), [5, 4]);
    assert.deepEqual(secondCodes.items.map((item) => item.id), [3, 2]);
    assert.equal(new Set([...firstCodes.items, ...secondCodes.items].map((item) => item.id)).size, 4);

    for (let userId = 1; userId <= 5; userId += 1) {
      store.insertGiftRedemption.run(1, userId, 100, 1_000 + userId);
    }
    const firstRedemptions = listGiftRedemptionPage(store, admin, 1, { limit: 2 });
    const secondRedemptions = listGiftRedemptionPage(store, admin, 1, {
      limit: 2,
      cursor: firstRedemptions.nextCursor,
    });
    assert.equal(firstRedemptions.total, 5);
    assert.deepEqual(firstRedemptions.items.map((item) => item.user_id), [5, 4]);
    assert.deepEqual(secondRedemptions.items.map((item) => item.user_id), [3, 2]);
  } finally {
    store.close();
  }
});
