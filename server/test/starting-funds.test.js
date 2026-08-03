import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';

const now = Date.UTC(2026, 7, 3, 8, 0, 0);
const user = { id: 5001, name: 'Starting Funds Tester', email: 'starting-funds@example.com' };

test('new players receive 500 credits with a matching startup ledger entry', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);

  assert.equal(player.credits, 500);
  assert.equal(player.frozenCredits, 0);
  assert.equal(player.ledger.length, 1);
  assert.equal(player.ledger[0].category, 'system');
  assert.equal(player.ledger[0].amount, 500);
  assert.equal(player.ledger[0].balanceAfter, 500);
  assert.equal(player.ledger[0].description, '服务器发放玩家启动资金');
});

test('ensuring an existing player does not top up or rewrite their balance', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 123;

  const existingPlayer = ensurePlayer(world, user, now + 1_000);

  assert.strictEqual(existingPlayer, player);
  assert.equal(existingPlayer.credits, 123);
  assert.equal(existingPlayer.ledger[0].amount, 500);
});
