import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer } from '../src/domain.js';
import { createLeaderboardSnapshot, processLeaderboardWorld } from '../src/leaderboards.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0, 0);
const SELLER = { id: 101, email: 'instant-seller@example.com', name: '即时卖家' };

test('daily official-price immediate sell keeps decimal gross value on the trading leaderboard', () => {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, SELLER, NOW);
  player.credits = 1_000;
  player.inventories.wheat.available = 4;
  const market = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
  market.officialPrice = 0.8;

  processLeaderboardWorld(world, NOW);
  const result = applyAction(world, SELLER, 'placeOrder', {
    provinceId: DEFAULT_PROVINCE_ID,
    productId: 'wheat',
    side: 'sell',
    quantity: 4,
    price: 99,
  }, NOW + 1);

  assert.equal(result.ok, true);
  assert.equal(result.executedPrice, 0.8);
  assert.equal(result.total, 3.2);
  assert.equal(world.orders.at(-1).status, 'filled');
  assert.equal(world.orders.at(-1).fills[0].total, 3.2);

  processLeaderboardWorld(world, NOW + 2);
  const snapshot = createLeaderboardSnapshot(world, SELLER.id, NOW + 3);
  assert.equal(world.leaderboardState.trading[String(SELLER.id)].score, 3.2);
  assert.equal(world.leaderboardState.trading[String(SELLER.id)].tradeCount, 1);
  assert.equal(player.stats.marketSellScore, 3.2);
  assert.equal(player.stats.marketTradeCount, 1);
  assert.equal(snapshot.boards.trading.currentPlayer.score, 3.2);
});
