import { RESEARCH_DURATION_BY_STAGE } from '../src/research-catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  RESEARCH_DURATION_MS,
  RESEARCH_TECHNOLOGY_CATALOG,
  applyResearchAction,
  ensurePlayerResearch,
  hasResearchAccessForFacility,
  migrateResearchWorld,
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

test('new players start with three initial technologies and unlock facilities by concrete technology', () => {
  const { world, user, player } = createPlayer();
  assert.deepEqual(player.research.completedTechnologyIds, ['basic-crops', 'basic-livestock', 'basic-commerce']);
  assert.equal(player.research.unlockedComplexity, 'C1');
  assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, NOW)?.ok, false);

  const started = applyResearchAction(world, user, 'startResearch', { technologyId: 'resource-survey' }, NOW);
  assert.equal(started.ok, true);
  assert.equal(player.credits, 50);
  assert.equal(player.research.active.technologyId, 'resource-survey');
  assert.equal(player.research.active.durationMs, RESEARCH_DURATION_BY_STAGE.C2);
  assert.equal(player.research.active.completesAt, NOW + RESEARCH_DURATION_BY_STAGE.C2);

  processResearchWorld(world, NOW + RESEARCH_DURATION_BY_STAGE.C2 - 1);
  assert.notEqual(player.research.active, null);
  assert.equal(hasResearchAccessForFacility(world, player, 'logging-camp', NOW + RESEARCH_DURATION_BY_STAGE.C2 - 1), false);

  processResearchWorld(world, NOW + RESEARCH_DURATION_BY_STAGE.C2);
  assert.equal(player.research.active, null);
  assert.equal(player.research.completedTechnologyIds.includes('resource-survey'), true);
  assert.equal(player.research.unlockedComplexity, 'C1');
  assert.equal(hasResearchAccessForFacility(world, player, 'logging-camp', NOW + RESEARCH_DURATION_BY_STAGE.C2), true);
  assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, NOW + RESEARCH_DURATION_BY_STAGE.C2), null);
  assert.equal(player.stats.researchPayroll, 450);
});

test('technology prerequisites form real industrial chains', () => {
  const { world, user, player } = createPlayer(9902);
  player.credits = 10_000;
  const blocked = applyResearchAction(world, user, 'startResearch', { technologyId: 'metallurgical-engineering' }, NOW);
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /资源勘探/);

  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'resource-survey' }, NOW).ok, true);
  processResearchWorld(world, NOW + RESEARCH_DURATION_BY_STAGE.C2);
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'metallurgical-engineering' }, NOW + RESEARCH_DURATION_BY_STAGE.C2).ok, true);
  assert.equal(player.research.active.durationMs, RESEARCH_DURATION_BY_STAGE.C3);
});

test('legacy C1-C7 requests use the next stage duration and only grant missing technologies', () => {
  const { world, user, player } = createPlayer(9903);
  player.credits = 20_000;
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'resource-survey' }, NOW).ok, true);
  processResearchWorld(world, NOW + RESEARCH_DURATION_BY_STAGE.C2);

  const legacyStartedAt = NOW + RESEARCH_DURATION_BY_STAGE.C2;
  const started = applyResearchAction(world, user, 'startResearch', { targetComplexity: 'C2' }, legacyStartedAt);
  assert.equal(started.ok, true);
  assert.equal(player.research.active.legacy, true);
  assert.equal(player.research.active.grantTechnologyIds.includes('resource-survey'), false);
  assert.equal(player.research.active.durationMs, RESEARCH_DURATION_BY_STAGE.C2);
  assert.equal(player.research.active.completesAt, legacyStartedAt + RESEARCH_DURATION_BY_STAGE.C2);
  processResearchWorld(world, player.research.active.completesAt);
  assert.equal(player.research.unlockedComplexity, 'C2');
  assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.stage === 'C2')
    .every((technology) => player.research.completedTechnologyIds.includes(technology.id)), true);
});

test('active research migration preserves paid duration, applied acceleration and released employment', () => {
  const { world, player } = createPlayer(9906);
  const legacyDurationMs = 195 * 60_000;
  const appliedAccelerationMs = 30 * 60_000;
  player.research.active = {
    technologyId: 'resource-survey',
    technologyName: '林业开发',
    targetComplexity: 'C2',
    startedAt: NOW,
    completesAt: NOW + legacyDurationMs - appliedAccelerationMs,
    durationMs: legacyDurationMs,
    cost: 300,
    employmentReleased: 25,
  };

  ensurePlayerResearch(world, player, NOW + 60_000);
  assert.equal(player.research.active.durationMs, legacyDurationMs);
  assert.equal(player.research.active.completesAt, NOW + legacyDurationMs - appliedAccelerationMs);
  assert.equal(player.research.active.employmentReleased, 25);
});

test('legacy levels and existing facility commitments migrate without removing facility access', () => {
  const { world, player } = createPlayer(9904);
  player.research = { unlockedComplexity: 'C4', completedAt: NOW - 1, active: null };
  ensurePlayerResearch(world, player, NOW);
  assert.equal(player.research.unlockedComplexity, 'C2');
  assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.rank <= 4 && technology.branch !== 'commerce')
    .every((technology) => player.research.completedTechnologyIds.includes(technology.id)), true);

  const { world: assetWorld, player: assetPlayer } = createPlayer(9905);
  assetPlayer.research = null;
  assetPlayer.facilityGroups = [{ facilityTypeId: 'machine-factory', count: 1 }];
  ensurePlayerResearch(assetWorld, assetPlayer, NOW);
  assert.equal(assetPlayer.research.completedTechnologyIds.includes('machine-engineering'), true);
  assert.equal(assetPlayer.research.completedTechnologyIds.includes('metallurgical-engineering'), true);
  assert.equal(assetPlayer.research.completedTechnologyIds.includes('chemical-engineering'), false);
  assert.equal(hasResearchAccessForFacility(assetWorld, assetPlayer, 'machine-factory', NOW), true);
});

test('C1 and C2 non-base production methods require their declared technologies', () => {
  const { world, user, player } = createPlayer(9907);
  player.facilityGroups = [{
    facilityTypeId: 'logging-camp', count: 1, participatingCount: 1, enabled: false,
    status: 'stopped', staffingRateBps: 10_000, staffingUpdatedAt: NOW,
    activeRecipeId: 'logging-camp-default', lifetimeOutput: 0,
  }];
  ensurePlayerResearch(world, player, NOW);
  assert.equal(player.research.completedTechnologyIds.includes('resource-survey'), true);

  const blockedTool = validateResearchAccess(world, user, 'setFacilityRecipe', {
    facilityTypeId: 'logging-camp', recipeId: 'logging-camp-default--saw-assisted-logging',
  }, NOW);
  assert.equal(blockedTool?.ok, false);
  assert.match(blockedTool.message, /工具与动力应用/);

  player.research.completedTechnologyIds.push('powered-production');
  assert.equal(validateResearchAccess(world, user, 'setFacilityRecipe', {
    facilityTypeId: 'logging-camp', recipeId: 'logging-camp-default--saw-assisted-logging',
  }, NOW), null);

  const blockedMechanized = validateResearchAccess(world, user, 'setFacilityRecipe', {
    facilityTypeId: 'logging-camp', recipeId: 'logging-camp-default--mechanized-logging',
  }, NOW);
  assert.equal(blockedMechanized?.ok, false);
  assert.match(blockedMechanized.message, /机械化作业/);

  player.research.completedTechnologyIds.push('mechanized-production', 'powered-production');
  assert.equal(validateResearchAccess(world, user, 'setFacilityRecipe', {
    facilityTypeId: 'logging-camp', recipeId: 'logging-camp-default--mechanized-logging',
  }, NOW), null);

  const retired = validateResearchAccess(world, user, 'setFacilityRecipe', {
    facilityTypeId: 'logging-camp', recipeId: 'logging-camp-default--rapid',
  }, NOW);
  assert.equal(retired?.ok, false);
  assert.match(retired.message, /旧作业制度已退役/);
});

test('migration resets unavailable advanced methods without applying a staffing penalty', () => {
  const { world, player } = createPlayer(9908);
  player.facilityGroups = [{
    facilityTypeId: 'farm', count: 1, participatingCount: 1, enabled: true,
    status: 'running', cycleStartedAt: NOW - 10_000, staffingRateBps: 8_700,
    staffingUpdatedAt: NOW, staffingBatchCarryBps: 432, activeRecipeId: 'wheat-crop--mechanized', lifetimeOutput: 0,
  }];
  player.research.completedTechnologyIds = ['basic-crops', 'basic-livestock', 'basic-commerce'];

  migrateResearchWorld(world, NOW + 1);

  assert.equal(world.version, 33);
  assert.equal(player.facilityGroups[0].activeRecipeId, 'wheat-crop');
  assert.equal(player.facilityGroups[0].cycleStartedAt, NOW + 1);
  assert.equal(player.facilityGroups[0].staffingRateBps, 8_700);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 432);
});

test('operation research is independent from production research for new players', () => {
  const { world, user, player } = createPlayer(9910);
  player.credits = 10_000;
  const started = applyResearchAction(world, user, 'startResearch', { technologyId: 'powered-production' }, NOW);
  assert.equal(started.ok, true);
  processResearchWorld(world, NOW + RESEARCH_DURATION_MS);
  assert.equal(player.research.completedTechnologyIds.includes('powered-production'), true);
  assert.equal(player.research.completedTechnologyIds.includes('metallurgical-engineering'), false);
  assert.equal(hasResearchAccessForFacility(world, player, 'tool-workshop', NOW + RESEARCH_DURATION_MS), false);
});
