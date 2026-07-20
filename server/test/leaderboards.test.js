import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  captureTradingFills,
  createLeaderboardSnapshot,
  LEADERBOARD_TIME_ZONE,
  leaderboardPeriodFor,
  processLeaderboardWorld,
} from '../src/leaderboards.js';

const MONDAY_BEIJING = Date.UTC(2026, 6, 12, 16, 0, 0, 0);

function addPlayer(world, id, now = MONDAY_BEIJING) {
  return ensurePlayer(world, { id, name: `玩家${id}`, email: `player${id}@example.com` }, now);
}

test('leaderboard week starts Monday 00:00 in Beijing time', () => {
  const sundayEveningBeijing = Date.UTC(2026, 6, 12, 15, 59, 59, 999);
  const mondayStart = leaderboardPeriodFor(MONDAY_BEIJING);
  const sundayPeriod = leaderboardPeriodFor(sundayEveningBeijing);

  assert.equal(mondayStart.key, '2026-07-13');
  assert.equal(mondayStart.startsAt, MONDAY_BEIJING);
  assert.equal(mondayStart.endsAt, MONDAY_BEIJING + 7 * 24 * 60 * 60 * 1000);
  assert.equal(sundayPeriod.key, '2026-07-06');
  assert.equal(LEADERBOARD_TIME_ZONE, 'Asia/Shanghai');
});

test('trading board sums actual seller gross volume, counts completed fills on cancelled orders, and ignores unfilled remainder and auctions', () => {
  const now = MONDAY_BEIJING + 60_000;
  const world = createWorld(now);
  addPlayer(world, 1, now);
  addPlayer(world, 2, now);
  addPlayer(world, 3, now);
  processLeaderboardWorld(world, now);
  const state = world.leaderboardState;

  const playerFill = { id: 'fill-player', quantity: 1_000, price: 100, total: 100_000, createdAt: now, makerOrderId: 'sell-player', takerOrderId: 'buy-player' };
  const cancelledFill = { id: 'fill-cancelled', quantity: 35, price: 200, total: 7_000, createdAt: now + 1, makerOrderId: 'sell-cancelled', takerOrderId: 'buy-cancelled' };
  const populationFill = { id: 'fill-population', quantity: 100, price: 50, total: 5_000, createdAt: now + 2, makerOrderId: 'sell-population', takerOrderId: 'population-buy' };
  const facilityFill = { id: 'fill-facility', quantity: 2, price: 500, total: 1_000, createdAt: now + 3, makerOrderId: 'sell-facility', takerOrderId: 'buy-facility' };
  world.orders.push(
    { id: 'sell-player', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [playerFill] },
    { id: 'buy-player', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 2, status: 'filled', remaining: 0, fills: [playerFill] },
    { id: 'sell-cancelled', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'cancelled', quantity: 100, remaining: 65, fills: [cancelledFill] },
    { id: 'buy-cancelled', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 2, status: 'partial', remaining: 65, fills: [cancelledFill] },
    { id: 'sell-unfilled', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'cancelled', quantity: 100, remaining: 100, fills: [] },
    { id: 'sell-population', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [populationFill] },
    { id: 'population-buy', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'population', ownerName: '食品市场需求', status: 'filled', remaining: 0, fills: [] },
    { id: 'sell-facility', assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [facilityFill] },
    { id: 'buy-facility', assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm', side: 'buy', ownerType: 'player', ownerId: 3, status: 'filled', remaining: 0, fills: [facilityFill] },
  );
  world.collectibleAuctions = [{ id: 'auction-ignored', sellerId: 1, currentBid: 999_999, status: 'settled' }];

  captureTradingFills(world, state, world.orders);

  assert.equal(state.trading['1'].score, 113_000);
  assert.equal(state.trading['1'].tradeCount, 4);
  assert.equal(state.trading['2'].score, 0);
  assert.equal(Object.keys(state.trading['1'].buyers).length, 2);
  const snapshot = createLeaderboardSnapshot(world, 1, now + 4);
  assert.equal(snapshot.boards.trading.unit, 'currency');
  assert.equal(snapshot.boards.trading.currentPlayer.score, 113_000);
});

test('legacy capped trading state is rebuilt once from current-period actual fills', () => {
  const now = MONDAY_BEIJING + 60_000;
  const world = createWorld(now);
  const seller = addPlayer(world, 1, now);
  addPlayer(world, 2, now);
  processLeaderboardWorld(world, now);
  const state = world.leaderboardState;
  const fill = { id: 'legacy-fill', quantity: 20, price: 100, total: 2_000, createdAt: now, makerOrderId: 'legacy-sell', takerOrderId: 'legacy-buy' };
  world.orders.push(
    { id: 'legacy-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'cancelled', remaining: 5, fills: [fill] },
    { id: 'legacy-buy', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 2, status: 'filled', remaining: 0, fills: [fill] },
  );
  state.tradingRuleVersion = 1;
  state.trading['1'] = { score: 300, tradeCount: 1, buyers: { 2: true } };
  state.processedFillIds = { 'legacy-fill': now };
  state.pairDayScores = { '1:2:2026-07-13': 300 };
  seller.stats.marketSellScore = 300;
  seller.stats.marketTradeCount = 1;

  processLeaderboardWorld(world, now + 1);
  assert.equal(state.tradingRuleVersion, 2);
  assert.equal(state.trading['1'].score, 2_000);
  assert.equal(state.trading['1'].tradeCount, 1);
  assert.equal(seller.stats.marketSellScore, 2_000);
  assert.equal(seller.stats.marketTradeCount, 1);
  assert.equal(state.pairDayScores, undefined);

  processLeaderboardWorld(world, now + 2);
  assert.equal(state.trading['1'].score, 2_000);
  assert.equal(seller.stats.marketSellScore, 2_000);
});

test('three weekly boards grant 30, 20, and 10 gems and allow repeat winners', () => {
  const now = MONDAY_BEIJING + 60_000;
  const world = createWorld(now);
  const players = [1, 2, 3, 4].map((id) => addPlayer(world, id, now));
  processLeaderboardWorld(world, now);
  const state = world.leaderboardState;
  state.partial = false;

  players[0].credits += 300;
  players[1].credits += 200;
  players[2].credits += 100;
  state.production['1'] = { score: 300, quantity: 30 };
  state.production['2'] = { score: 200, quantity: 20 };
  state.production['3'] = { score: 100, quantity: 10 };
  state.trading['1'] = { score: 300, tradeCount: 3, buyers: { 2: true } };
  state.trading['2'] = { score: 200, tradeCount: 2, buyers: { 3: true } };
  state.trading['3'] = { score: 100, tradeCount: 1, buyers: { 4: true } };

  processLeaderboardWorld(world, state.endsAt);

  assert.equal(world.players['1'].gems, 90);
  assert.equal(world.players['2'].gems, 60);
  assert.equal(world.players['3'].gems, 30);
  assert.equal(world.leaderboardHistory.length, 1);
  assert.equal(world.leaderboardHistory[0].boards.growth[0].gems, 30);

  processLeaderboardWorld(world, state.endsAt);
  assert.equal(world.players['1'].gems, 90);
});

test('the first partial week records results without granting gems', () => {
  const now = MONDAY_BEIJING + 60_000;
  const world = createWorld(now);
  const player = addPlayer(world, 1, now);
  processLeaderboardWorld(world, now);
  const state = world.leaderboardState;
  player.credits += 500;
  state.production['1'] = { score: 500, quantity: 50 };
  state.trading['1'] = { score: 500, tradeCount: 5, buyers: {} };

  processLeaderboardWorld(world, state.endsAt);

  assert.equal(Number(player.gems || 0), 0);
  assert.equal(world.leaderboardHistory[0].partial, true);
  assert.equal(world.leaderboardHistory[0].boards.production[0].gems, 0);
});

test('top ten payload still returns the current player outside the visible rows', () => {
  const now = MONDAY_BEIJING + 60_000;
  const world = createWorld(now);
  for (let id = 1; id <= 12; id += 1) {
    const player = addPlayer(world, id, now);
    player.credits = 1_000 - id;
  }
  processLeaderboardWorld(world, now);
  const snapshot = createLeaderboardSnapshot(world, 12, now);

  assert.equal(snapshot.boards.wealth.entries.length, 10);
  assert.equal(snapshot.boards.wealth.currentPlayer.rank, 12);
  assert.equal(snapshot.boards.wealth.currentPlayer.isCurrentPlayer, true);
});
