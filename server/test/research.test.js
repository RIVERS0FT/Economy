import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  applyResearchAction,
  createResearchClientState,
  ensurePlayerResearch,
  processResearchWorld,
  validateResearchAccess,
} from '../src/research.js';

test('C1-C7 research is sequential and authoritative', () => {
  const now = 1_800_000_000_000;
  const world = createWorld(now);
  const user = { id: 7001, email: 'research-test@example.com', name: 'Research' };
  const player = ensurePlayer(world, user, now);
  ensurePlayerResearch(world, player, now);
  assert.equal(player.research.unlockedComplexity, 'C1');
  assert.equal(applyResearchAction(world, user, 'startResearch', { targetComplexity: 'C3' }, now).ok, false);
  assert.equal(applyResearchAction(world, user, 'startResearch', { targetComplexity: 'C2' }, now).ok, true);
  assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, now)?.ok, false);
  processResearchWorld(world, now + 300_000);
  assert.equal(player.research.unlockedComplexity, 'C2');
  assert.equal(player.research.active, null);
  assert.equal(player.stats.researchPayroll, 300);
  assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, now + 300_000), null);
});

test('research client state serialization does not advance or mutate the world', () => {
  const now = 1_800_000_000_000;
  const world = createWorld(now);
  const user = { id: 7003, email: 'readonly@example.com', name: 'Readonly' };
  const player = ensurePlayer(world, user, now);
  ensurePlayerResearch(world, player, now);
  assert.equal(applyResearchAction(world, user, 'startResearch', { targetComplexity: 'C2' }, now).ok, true);
  const before = structuredClone(world);
  const state = createResearchClientState(world, player, now + 300_000);
  assert.deepEqual(world, before);
  assert.equal(state.research.unlockedComplexity, 'C1');
  assert.equal(state.research.active.targetComplexity, 'C2');
});

test('legacy players inherit their highest committed facility complexity', () => {
  const now = 1_800_000_000_000;
  const world = createWorld(now);
  const user = { id: 7002, email: 'legacy@example.com', name: 'Legacy' };
  const player = ensurePlayer(world, user, now);
  player.facilityGroups = [{ facilityTypeId: 'electronics-factory', count: 1 }];
  delete player.research;
  assert.equal(ensurePlayerResearch(world, player, now).unlockedComplexity, 'C6');
});
