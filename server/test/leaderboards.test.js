import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  captureTradingFills,
  createLeaderboardSnapshot,
  leaderboardPeriodFor,
  processLeaderboardWorld,
} from '../src/leaderboards.js';

const MONDAY_TAIPEI = Date.UTC(2026, 6, 12, 16, 0, 0, 0);

function addPlayer(world, id, now = MONDAY_TAIPEI) {
  return ensurePlayer(world, { id, name: `玩家${id}`, email: `player${id}@example.com` }, now);
}

test('leaderboard week starts Monday 00:00 in Asia/Taipei', () => {
  const sundayEveningTaipei = Date.UTC(2026, 6, 12, 15, 59, 59, 999);
  const mondayStart = leaderboardPeriodFor(MONDAY_TAIPEI);
  const sundayPeriod = leaderboardPeriodFor(sundayEveningTaipei);

  assert.equal(mondayStart.key, '2026-07-13');
  assert.equal(mondayStart.startsAt, MONDAY_TAIPEI);
  assert.equal(mondayStart.endsAt, MONDAY_TAIPEI + 7 * 24 * 60 * 60 * 1000);
  assert.equal(sundayPeriod.key, '2026-07-06');
});

test('trading board counts seller fills, caps player pairs, includes population, and ignores auctions', () => {
  const now = MONDAY_TAIPEI + 60_000;
  const world = createWorld(now);
  addPlayer(world, 1, now);
  addPlayer(world, 2, now);
  processLeaderboardWorld(world, now, 1);
  const state = world.leaderboardState;

  const playerFill1 = { id: 'fill-player-1', quantity: 1_000, price: 100, total: 100_000, createdAt: now, makerOrderId: 'sell-1', takerOrderId: 'buy-1' };
  const playerFill2 = { id: 'fill-player-2', quantity: 1_000, price: 100, total: 100_000, createdAt: now + 1, makerOrderId: 'sell-2', takerOrderId: 'buy-2' };
  const populationFill = { id: 'fill-population', quantity: 1_000, price: 100, total: 100_000, createdAt: now + 2, makerOrderId: 'sell-3', takerOrderId: 'population-buy' };
  world.orders.push(
    { id: 'sell-1', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [playerFill1] },
    { id: 'buy-1', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 2, status: 'filled', remaining: 0, fills: [playerFill1] },
    { id: 'sell-2', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [playerFill2] },
    { id: 'buy-2', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 2, status: 'filled', remaining: 0, fills: [playerFill2] },
    { id: 'sell-3', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [populationFill] },
    { id: 'population-buy', productId: 'wheat', side: 'buy', ownerType: 'population', ownerName: '饮食需求', status: 'filled', remaining: 0, fills: [] },
  );
  world.collectibleAuctions = [{ id: 'auction-ignored', sellerId: 1, currentBid: 999_999, status: 'settled' }];

  captureTradingFills(world, state, world.orders);

  assert.equal(state.trading['1'].score, 16_000);
  assert.equal(state.trading['1'].tradeCount, 3);
  assert.equal(state.trading['2'].score, 0);
  assert.equal(Object.keys(state.trading['1'].buyers).length, 1);
});

test('three weekly boards grant 30, 20, and 10 gems and allow repeat winners', () => {
  const now = MONDAY_TAIPEI + 60_000;
  const world = createWorld(now);
  const players = [1, 2, 3, 4].map((id) => addPlayer(world, id, now));
  processLeaderboardWorld(world, now, 1);
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

  processLeaderboardWorld(world, state.endsAt, 1);

  assert.equal(world.players['1'].gems, 90);
  assert.equal(world.players['2'].gems, 60);
  assert.equal(world.players['3'].gems, 30);
  assert.equal(world.leaderboardHistory.length, 1);
  assert.equal(world.leaderboardHistory[0].boards.growth[0].gems, 30);

  processLeaderboardWorld(world, state.endsAt, 1);
  assert.equal(world.players['1'].gems, 90);
});

test('the first partial week records results without granting gems', () => {
  const now = MONDAY_TAIPEI + 60_000;
  const world = createWorld(now);
  const player = addPlayer(world, 1, now);
  processLeaderboardWorld(world, now, 1);
  const state = world.leaderboardState;
  player.credits += 500;
  state.production['1'] = { score: 500, quantity: 50 };
  state.trading['1'] = { score: 500, tradeCount: 5, buyers: {} };

  processLeaderboardWorld(world, state.endsAt, 1);

  assert.equal(Number(player.gems || 0), 0);
  assert.equal(world.leaderboardHistory[0].partial, true);
  assert.equal(world.leaderboardHistory[0].boards.production[0].gems, 0);
});

test('top ten payload still returns the current player outside the visible rows', () => {
  const now = MONDAY_TAIPEI + 60_000;
  const world = createWorld(now);
  for (let id = 1; id <= 12; id += 1) {
    const player = addPlayer(world, id, now);
    player.credits = 1_000 - id;
  }
  processLeaderboardWorld(world, now, 12);
  const snapshot = createLeaderboardSnapshot(world, 12, now);

  assert.equal(snapshot.boards.wealth.entries.length, 10);
  assert.equal(snapshot.boards.wealth.currentPlayer.rank, 12);
  assert.equal(snapshot.boards.wealth.currentPlayer.isCurrentPlayer, true);
});
