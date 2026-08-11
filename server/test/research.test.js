import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  RESEARCH_DURATION_MS,
  RESEARCH_TECHNOLOGY_CATALOG,
  applyResearchAction,
  ensurePlayerResearch,
  hasResearchAccessForFacility,
  processResearchWorld,
  validateResearchAccess,
} from '../src/research.js';

const NOW = 1_800_000_000_000;

function createPlayer(id = 9901) {
  const world = createWorld(NOW);
  const user = { id, email: `research-${id}@example.com`, name: '研发测试' };
  const player = ensurePlayer(world, user, NOW);
  ensurePlayerResearch(world, player, NOW);
  return { world, user, player };
}

test('new players start with two C1 technologies and unlock facilities by concrete technology', () => {
  const { world, user, player } = createPlayer();
  assert.deepEqual(player.research.completedTechnologyIds, ['basic-crops', 'basic-livestock']);
  assert.equal(player.research.unlockedComplexity, 'C1');
  assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, NOW)?.ok, false);

  const started = applyResearchAction(world, user, 'startResearch', { technologyId: 'forestry-development' }, NOW);
  assert.equal(started.ok, true);
  assert.equal(player.credits, 200);
  assert.equal(player.research.active.technologyId, 'forestry-development');
  assert.equal(player.research.active.durationMs, RESEARCH_DURATION_MS);
  assert.equal(player.research.active.completesAt, NOW + RESEARCH_DURATION_MS);

  processResearchWorld(world, NOW + RESEARCH_DURATION_MS - 1);
  assert.notEqual(player.research.active, null);
  assert.equal(hasResearchAccessForFacility(world, player, 'logging-camp', NOW + RESEARCH_DURATION_MS - 1), false);

  processResearchWorld(world, NOW + RESEARCH_DURATION_MS);
  assert.equal(player.research.active, null);
  assert.equal(player.research.completedTechnologyIds.includes('forestry-development'), true);
  assert.equal(player.research.unlockedComplexity, 'C1');
  assert.equal(hasResearchAccessForFacility(world, player, 'logging-camp', NOW + RESEARCH_DURATION_MS), true);
  assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, NOW + RESEARCH_DURATION_MS), null);
  assert.equal(player.stats.researchPayroll, 300);
});

test('technology prerequisites form real industrial chains', () => {
  const { world, user, player } = createPlayer(9902);
  player.credits = 10_000;
  const blocked = applyResearchAction(world, user, 'startResearch', { technologyId: 'metallurgy' }, NOW);
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /矿产勘探/);

  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'mineral-exploration' }, NOW).ok, true);
  processResearchWorld(world, NOW + RESEARCH_DURATION_MS);
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'metallurgy' }, NOW + RESEARCH_DURATION_MS).ok, true);
  assert.equal(player.research.active.durationMs, RESEARCH_DURATION_MS);
});

test('legacy C1-C7 requests research the remaining technologies of the next complete stage in six hours', () => {
  const { world, user, player } = createPlayer(9903);
  player.credits = 20_000;
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'forestry-development' }, NOW).ok, true);
  processResearchWorld(world, NOW + RESEARCH_DURATION_MS);

  const legacyStartedAt = NOW + RESEARCH_DURATION_MS;
  const started = applyResearchAction(world, user, 'startResearch', { targetComplexity: 'C2' }, legacyStartedAt);
  assert.equal(started.ok, true);
  assert.equal(player.research.active.legacy, true);
  assert.equal(player.research.active.grantTechnologyIds.includes('forestry-development'), false);
  assert.equal(player.research.active.durationMs, RESEARCH_DURATION_MS);
  assert.equal(player.research.active.completesAt, legacyStartedAt + RESEARCH_DURATION_MS);
  processResearchWorld(world, player.research.active.completesAt);
  assert.equal(player.research.unlockedComplexity, 'C2');
  assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.stage === 'C2')
    .every((technology) => player.research.completedTechnologyIds.includes(technology.id)), true);
});

test('active research migration adopts six hours while preserving applied acceleration and released employment', () => {
  const { world, player } = createPlayer(9906);
  const legacyDurationMs = 195 * 60_000;
  const appliedAccelerationMs = 30 * 60_000;
  player.research.active = {
    technologyId: 'forestry-development',
    technologyName: '林业开发',
    targetComplexity: 'C2',
    startedAt: NOW,
    completesAt: NOW + legacyDurationMs - appliedAccelerationMs,
    durationMs: legacyDurationMs,
    cost: 300,
    employmentReleased: 25,
  };

  ensurePlayerResearch(world, player, NOW + 60_000);
  assert.equal(player.research.active.durationMs, RESEARCH_DURATION_MS);
  assert.equal(player.research.active.completesAt, NOW + RESEARCH_DURATION_MS - appliedAccelerationMs);
  assert.equal(player.research.active.employmentReleased, 25);
});

test('legacy levels and existing facility commitments migrate without removing access', () => {
  const { world, player } = createPlayer(9904);
  player.research = { unlockedComplexity: 'C4', completedAt: NOW - 1, active: null };
  ensurePlayerResearch(world, player, NOW);
  assert.equal(player.research.unlockedComplexity, 'C4');
  assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.rank <= 4)
    .every((technology) => player.research.completedTechnologyIds.includes(technology.id)), true);

  const { world: assetWorld, player: assetPlayer } = createPlayer(9905);
  assetPlayer.research = null;
  assetPlayer.facilityGroups = [{ facilityTypeId: 'machine-factory', count: 1 }];
  ensurePlayerResearch(assetWorld, assetPlayer, NOW);
  assert.equal(assetPlayer.research.completedTechnologyIds.includes('mechanical-engineering'), true);
  assert.equal(assetPlayer.research.completedTechnologyIds.includes('tool-manufacturing'), true);
  assert.equal(assetPlayer.research.completedTechnologyIds.includes('oil-refining'), false);
  assert.equal(hasResearchAccessForFacility(assetWorld, assetPlayer, 'machine-factory', NOW), true);
});
