import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';

const user = { id: 7091, email: 'research-gem@example.com', name: '研发加速玩家', role: 'user' };

function apply(store, action, payload, requestKey, path, now) {
  return store.apply(user, {
    action,
    payload,
    requestKey,
    method: 'POST',
    path,
  }, now);
}

test('one gem immediately completes research shorter than thirty minutes with idempotent audit', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_800_100_000_000;
  try {
    store.getState(user, now);
    const loaded = store.loadWorld(now + 1);
    const player = loaded.world.players[String(user.id)];
    player.gems = 2;
    player.credits = 10_000;
    store.saveWorld(loaded.revision, loaded.world, now + 1);

    const started = apply(
      store,
      'startResearch',
      { targetComplexity: 'C2' },
      'research-start-gem-1',
      '/api/game/research/start',
      now + 2,
    );
    assert.equal(started.result.ok, true);

    const meta = {
      action: 'accelerateResearch',
      payload: {},
      requestKey: 'research-accelerate-gem-1',
      method: 'POST',
      path: '/api/game/research/accelerate',
    };
    const first = store.apply(user, meta, now + 3);
    const repeated = store.apply(user, meta, now + 4);
    assert.deepEqual(repeated, first);
    assert.equal(first.result.ok, true);

    const state = store.getState(user, now + 5);
    assert.equal(state.gems, 1);
    assert.equal(state.research.unlockedComplexity, 'C2');
    assert.equal(state.research.active, null);
    assert.equal(state.stats.researchPayroll, 300);
    assert.equal(state.stats.researchGemSpent, 1);
    const actions = store.database.prepare('SELECT * FROM economy_research_gem_actions').all();
    assert.equal(actions.length, 1);
    assert.equal(actions[0].target_complexity, 'C2');
    assert.equal(Number(actions[0].completed_immediately), 1);
  } finally {
    store.close();
  }
});

test('research acceleration shortens a long active project by exactly thirty minutes', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_800_200_000_000;
  try {
    store.getState(user, now);
    const loaded = store.loadWorld(now + 1);
    const player = loaded.world.players[String(user.id)];
    player.gems = 3;
    player.credits = 10_000;
    player.research = {
      unlockedComplexity: 'C3',
      completedAt: now,
      active: null,
    };
    store.saveWorld(loaded.revision, loaded.world, now + 1);

    const started = apply(
      store,
      'startResearch',
      { targetComplexity: 'C4' },
      'research-start-gem-2',
      '/api/game/research/start',
      now + 2,
    );
    assert.equal(started.result.ok, true);
    const before = store.getState(user, now + 3).research.active?.completesAt;

    const accelerated = apply(
      store,
      'accelerateResearch',
      {},
      'research-accelerate-gem-2',
      '/api/game/research/accelerate',
      now + 4,
    );
    assert.equal(accelerated.result.ok, true);
    const afterState = store.getState(user, now + 5);
    assert.equal(before - afterState.research.active.completesAt, 30 * 60 * 1000);
    assert.equal(afterState.gems, 2);
    assert.equal(afterState.research.unlockedComplexity, 'C3');
    assert.equal(afterState.research.active.targetComplexity, 'C4');
    assert.equal(afterState.research.active.gemAccelerationMs, 30 * 60 * 1000);
    assert.equal(afterState.research.active.gemAccelerationCost, 1);
    assert.ok(afterState.research.active.employmentReleased > 0);
  } finally {
    store.close();
  }
});

test('research acceleration rejects missing gems without changing the deadline', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_800_300_000_000;
  try {
    store.getState(user, now);
    const loaded = store.loadWorld(now + 1);
    const player = loaded.world.players[String(user.id)];
    player.credits = 10_000;
    player.research = {
      unlockedComplexity: 'C3',
      completedAt: now,
      active: null,
    };
    store.saveWorld(loaded.revision, loaded.world, now + 1);
    assert.equal(apply(
      store,
      'startResearch',
      { targetComplexity: 'C4' },
      'research-start-gem-3',
      '/api/game/research/start',
      now + 2,
    ).result.ok, true);
    const before = store.getState(user, now + 3).research.active?.completesAt;
    const result = apply(
      store,
      'accelerateResearch',
      {},
      'research-accelerate-gem-3',
      '/api/game/research/accelerate',
      now + 4,
    );
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /宝石余额不足/);
    assert.equal(store.getState(user, now + 5).research.active?.completesAt, before);
    assert.equal(store.database.prepare('SELECT COUNT(*) AS count FROM economy_research_gem_actions').get().count, 0);
  } finally {
    store.close();
  }
});
