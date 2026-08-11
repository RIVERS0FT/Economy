import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyOnlineAutoTradePolicyAction } from '../src/online-auto-trade-policy.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

function basePayload() {
  return {
    productId: 'wheat',
    buy: {
      enabled: true,
      maxPrice: 4.5,
      targetFreeInventory: 10,
    },
    sell: {
      enabled: true,
      price: 6,
      minimumFreeInventory: 20,
    },
  };
}

test('auto trade policy atomically saves compatible buy and sell settings', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);

  const result = applyOnlineAutoTradePolicyAction(world, alice, basePayload());

  assert.equal(result.ok, true);
  assert.match(result.message, /自动采购、自动出售设置已保存/);
  assert.deepEqual(player.onlineAutoBuyPolicies.wheat, {
    enabled: true,
    maxPrice: 4.5,
    targetFreeInventory: 10,
  });
  assert.deepEqual(player.onlineAutoSellPolicies.wheat, {
    enabled: true,
    price: 6,
    minimumFreeInventory: 20,
  });
});

test('auto trade policy rejects an overlapping inventory band without partial writes', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  const payload = basePayload();
  payload.buy.targetFreeInventory = 21;

  const result = applyOnlineAutoTradePolicyAction(world, alice, payload);

  assert.equal(result.ok, false);
  assert.match(result.message, /目标自由库存不能高于/);
  assert.equal(player.onlineAutoBuyPolicies, undefined);
  assert.equal(player.onlineAutoSellPolicies, undefined);
});

test('auto trade policy rejects crossing buy and sell prices without partial writes', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  const payload = basePayload();
  payload.buy.maxPrice = 6;

  const result = applyOnlineAutoTradePolicyAction(world, alice, payload);

  assert.equal(result.ok, false);
  assert.match(result.message, /最高自动采购价格必须低于/);
  assert.equal(player.onlineAutoBuyPolicies, undefined);
  assert.equal(player.onlineAutoSellPolicies, undefined);
});
