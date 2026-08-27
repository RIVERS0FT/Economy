import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { createLeaderboardSnapshot, processLeaderboardWorld } from '../src/leaderboards.js';

const NOW = Date.UTC(2026, 7, 24, 2, 0, 0, 0);

test('public leaderboard entries expose stable player ids for avatar lookup', () => {
  const world = createWorld(NOW);
  ensurePlayer(world, { id: 17, name: '玩家17', email: 'player17@example.com' }, NOW);
  ensurePlayer(world, { id: 29, name: '玩家29', email: 'player29@example.com' }, NOW);
  processLeaderboardWorld(world, NOW);

  const snapshot = createLeaderboardSnapshot(world, 17, NOW + 1);
  for (const boardId of ['wealth', 'growth', 'production', 'trading']) {
    const board = snapshot.boards[boardId];
    assert.equal(board.entries.length, 2);
    assert.deepEqual(new Set(board.entries.map((entry) => entry.userId)), new Set([17, 29]));
    assert.equal(board.currentPlayer.userId, 17);
    assert.equal(Object.hasOwn(board.entries[0], 'activityAt'), false);
  }
});
