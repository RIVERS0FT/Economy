import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer, migrateWorld } from '../src/domain.js';

const now = 1_786_000_000_000;
const alice = { id: 91, name: '平衡迁移玩家' };

test('model 18 rebalance remains preserved while current migration retires every legacy player commodity order', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  world.marketDemand.modelVersion = 17;
  world.playerCommodityInstantTradeVersion = 0;
  player.credits = 100;
  player.frozenCredits = 41;
  player.inventories.tools.available = 7;
  player.inventories.tools.frozen = 3;
  player.inventories.wheat.available = 9;
  const history = [{ price: 60, quantity: 2, createdAt: now - 1_000, takerSide: 'buy' }];
  world.markets.tools.lastPrice = 60;
  world.markets.tools.lastTradePrice = 60;
  world.markets.tools.priceHistory = structuredClone(history);
  world.orders.push(
    { id: 'affected-buy', assetKind: 'commodity', assetId: 'fertilizer', productId: 'fertilizer', side: 'buy', ownerType: 'player', ownerId: alice.id, price: 20, quantity: 2, remaining: 2, status: 'open', fills: [], createdAt: now },
    { id: 'affected-sell', assetKind: 'commodity', assetId: 'tools', productId: 'tools', side: 'sell', ownerType: 'player', ownerId: alice.id, price: 12, quantity: 3, remaining: 3, status: 'open', fills: [], createdAt: now },
    { id: 'unaffected-buy', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: alice.id, price: 1, quantity: 1, remaining: 1, status: 'open', fills: [], createdAt: now },
  );

  migrateWorld(world, now + 1);

  assert.equal(world.marketDemand.modelVersion, 20);
  assert.equal(world.orders.find((order) => order.id === 'affected-buy').status, 'cancelled');
  assert.equal(world.orders.find((order) => order.id === 'affected-sell').status, 'cancelled');
  assert.equal(world.orders.find((order) => order.id === 'unaffected-buy').status, 'cancelled');
  assert.equal(player.credits, 141);
  assert.equal(player.frozenCredits, 0);
  assert.deepEqual(player.inventories.tools, { available: 10, frozen: 0, inTransit: 0 });
  assert.equal(player.inventories.wheat.available, 9);
  assert.equal(world.markets.tools.lastPrice, 12);
  assert.equal(world.markets.tools.lastTradePrice, null);
  assert.deepEqual(world.markets.tools.priceHistory, history);
  assert.equal(world.marketDemand.priceTransmission.products.tools.referencePrice, 12);
  assert.equal(world.playerCommodityInstantTradeVersion, 1);

  const snapshot = structuredClone({ credits: player.credits, frozenCredits: player.frozenCredits, tools: player.inventories.tools, orders: world.orders, history: world.markets.tools.priceHistory });
  migrateWorld(world, now + 2);
  assert.deepEqual({ credits: player.credits, frozenCredits: player.frozenCredits, tools: player.inventories.tools, orders: world.orders, history: world.markets.tools.priceHistory }, snapshot);
});
