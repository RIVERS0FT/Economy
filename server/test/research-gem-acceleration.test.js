import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  GEM_RESEARCH_ACCELERATION_MS,
  RESEARCH_DURATION_MS,
  applyResearchAction,
  ensurePlayerResearch,
} from '../src/research.js';

const NOW = 1_800_000_000_000;

function setup(id, unlockedComplexity = 'C1') {
  const world = createWorld(NOW);
  const user = { id, email: `research-gem-${id}@example.com`, name: '加速测试' };
  const player = ensurePlayer(world, user, NOW);
  player.research = { unlockedComplexity, completedAt: NOW - 1, active: null };
  ensurePlayerResearch(world, player, NOW);
  player.credits = 20_000;
  player.gems = 2;
  return { world, user, player };
}

test('immediately completes research when less than thirty minutes remain', () => {
  const { world, user, player } = setup(9911);
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'grain-processing' }, NOW).ok, true);
  assert.equal(player.research.active.durationMs, 30 * 60_000);
  const accelerateAt = NOW + 30 * 60_000 - 15 * 60_000;
  const result = applyResearchAction(world, user, 'accelerateResearch', {}, accelerateAt);
  assert.equal(result.ok, true);
  assert.equal(result.completedImmediately, true);
  assert.equal(result.reducedMs, 15 * 60_000);
  assert.equal(player.research.active, null);
  assert.equal(player.research.completedTechnologyIds.includes('grain-processing'), true);
  assert.equal(player.gems, 1);
});

test('shortens a six-hour active project by exactly thirty minutes', () => {
  const { world, user, player } = setup(9912, 'C5');
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'electronics-engineering' }, NOW).ok, true);
  assert.equal(player.research.active.durationMs, RESEARCH_DURATION_MS);
  const previousCompletesAt = player.research.active.completesAt;
  const result = applyResearchAction(world, user, 'accelerateResearch', {}, NOW + 10 * 60_000);
  assert.equal(result.ok, true);
  assert.equal(result.completedImmediately, false);
  assert.equal(result.reducedMs, GEM_RESEARCH_ACCELERATION_MS);
  assert.equal(player.research.active.completesAt, previousCompletesAt - GEM_RESEARCH_ACCELERATION_MS);
  assert.equal(player.research.active.technologyId, 'electronics-engineering');
  assert.equal(player.gems, 1);
});

test('rejects missing gems without changing the deadline', () => {
  const { world, user, player } = setup(9913, 'C5');
  player.gems = 0;
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'electronics-engineering' }, NOW).ok, true);
  const previousCompletesAt = player.research.active.completesAt;
  const result = applyResearchAction(world, user, 'accelerateResearch', {}, NOW + 10 * 60_000);
  assert.equal(result.ok, false);
  assert.equal(player.research.active.completesAt, previousCompletesAt);
  assert.equal(player.gems, 0);
});
