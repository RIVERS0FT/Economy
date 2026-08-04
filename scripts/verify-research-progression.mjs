import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RESEARCH_LEVEL_CATALOG,
  applyResearchAction,
  ensurePlayerResearch,
  processResearchWorld,
  validateResearchAccess,
} from '../server/src/research.js';
import { createWorld, ensurePlayer } from '../server/src/domain.js';

assert.deepEqual(RESEARCH_LEVEL_CATALOG.map(({ id, cost, durationMs }) => ({ id, cost, durationMs })), [
  { id: 'C1', cost: 0, durationMs: 0 },
  { id: 'C2', cost: 300, durationMs: 300_000 },
  { id: 'C3', cost: 700, durationMs: 1_200_000 },
  { id: 'C4', cost: 1_200, durationMs: 2_700_000 },
  { id: 'C5', cost: 2_400, durationMs: 5_400_000 },
  { id: 'C6', cost: 4_200, durationMs: 10_800_000 },
  { id: 'C7', cost: 6_700, durationMs: 21_600_000 },
]);

const now = 1_800_000_000_000;
const world = createWorld(now);
const user = { id: 9901, email: 'research@example.com', name: '研发测试' };
const player = ensurePlayer(world, user, now);
ensurePlayerResearch(world, player, now);
assert.equal(player.research.unlockedComplexity, 'C1');
assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, now)?.ok, false);
const started = applyResearchAction(world, user, 'startResearch', { targetComplexity: 'C2' }, now);
assert.equal(started.ok, true);
assert.equal(player.credits, 200);
assert.equal(applyResearchAction(world, user, 'startResearch', { targetComplexity: 'C3' }, now).ok, false);
processResearchWorld(world, now + 300_000);
assert.equal(player.research.unlockedComplexity, 'C2');
assert.equal(player.research.active, null);
assert.equal(player.stats.researchPayroll, 300);
assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, now + 300_000), null);

const routeSource = readFileSync('server/src/game-routes.js', 'utf8');
const storageSource = readFileSync('server/src/storage.js', 'utf8');
const countdownSource = readFileSync('src/utils/authoritativeCountdowns.ts', 'utf8');
const pageSource = readFileSync('src/pages/ResearchPage.tsx', 'utf8');
assert.ok(routeSource.includes("/api/game/research/start"));
assert.ok(storageSource.includes('validateResearchAccess'));
assert.ok(storageSource.includes('processResearchWorld'));
assert.ok(countdownSource.includes('game.research?.active?.completesAt'));
assert.ok(pageSource.includes('开始研发'));
assert.equal(pageSource.includes('研发功能尚未开放'), false);
console.log('research progression verification passed');
