import assert from 'node:assert/strict';
import test from 'node:test';
import { PRODUCT_CATALOG, createWorld, ensurePlayer } from '../src/domain.js';
import { applyOnlineAutoSellPolicyAction } from '../src/online-auto-sell-policy.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

function policy(index = 0) {
  return {
    enabled: index % 2 === 0,
    price: index + 1,
    minimumFreeInventory: index,
  };
}

test('legacy auto-sell policies import all catalog products in one atomic action', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.saveEpoch = 0;
  const policies = Object.fromEntries(PRODUCT_CATALOG.map((product, index) => [product.id, policy(index)]));

  const result = applyOnlineAutoSellPolicyAction(world, alice, {
    legacyImport: true,
    policies,
  });

  assert.equal(result.ok, true);
  assert.equal(Object.keys(player.onlineAutoSellPolicies).length, PRODUCT_CATALOG.length);
  assert.deepEqual(player.onlineAutoSellPolicies[PRODUCT_CATALOG.at(-1).id], policy(PRODUCT_CATALOG.length - 1));
});

test('legacy auto-sell import is all-or-nothing when one known product policy is invalid', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.saveEpoch = 0;

  const result = applyOnlineAutoSellPolicyAction(world, alice, {
    legacyImport: true,
    policies: {
      wheat: policy(0),
      rice: { enabled: true, price: 5, minimumFreeInventory: -1 },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(Object.hasOwn(player, 'onlineAutoSellPolicies'), false);
});

test('legacy auto-sell import cannot restore settings after save deletion', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.saveEpoch = 1;

  const result = applyOnlineAutoSellPolicyAction(world, alice, {
    legacyImport: true,
    policies: { wheat: policy(0) },
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /不能导入已重建/);
  assert.equal(Object.hasOwn(player, 'onlineAutoSellPolicies'), false);
});

test('legacy auto-sell import preserves saved entries and fills only missing products', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.saveEpoch = 0;
  player.onlineAutoSellPolicies = {
    wheat: { enabled: true, price: 9, minimumFreeInventory: 5 },
  };

  const result = applyOnlineAutoSellPolicyAction(world, alice, {
    legacyImport: true,
    policies: {
      wheat: { enabled: false, price: 1, minimumFreeInventory: 0 },
      rice: policy(1),
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(player.onlineAutoSellPolicies, {
    '110000:wheat': { enabled: true, price: 9, minimumFreeInventory: 5 },
    '110000:rice': policy(1),
  });
});
