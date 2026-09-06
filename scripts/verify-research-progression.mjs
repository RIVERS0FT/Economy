import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG } from '../server/src/industry-catalog.js';
import {
  RESEARCH_DURATION_MS,
  RESEARCH_DURATION_BY_STAGE,
  RESEARCH_LEVEL_CATALOG,
  RESEARCH_TECHNOLOGY_CATALOG,
  researchTechnologyClosure,
  researchTechnologyForFacility,
} from '../server/src/research-catalog.js';
import {
  applyResearchAction,
  ensurePlayerResearch,
  processResearchWorld,
  validateResearchAccess,
} from '../server/src/research.js';
import { createWorld, ensurePlayer } from '../server/src/domain.js';

assert.equal(RESEARCH_DURATION_MS, 6 * 60 * 60_000);
assert.equal(RESEARCH_TECHNOLOGY_CATALOG.length, 32);
assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.initial).length, 2);
assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.initial)
  .every((technology) => technology.durationMs === 0), true);
assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => !technology.initial)
  .every((technology) => technology.durationMs === RESEARCH_DURATION_BY_STAGE[technology.stage]), true);
assert.equal(RESEARCH_LEVEL_CATALOG.length, 7);
assert.equal(RESEARCH_LEVEL_CATALOG.reduce((sum, stage) => sum + stage.cost, 0), 31_700);
assert.equal(RESEARCH_LEVEL_CATALOG.every((stage) => stage.durationMs === RESEARCH_DURATION_BY_STAGE[stage.id]), true);

const technologyIds = new Set(RESEARCH_TECHNOLOGY_CATALOG.map((technology) => technology.id));
const operationTechnologyIds = new Set([
  'tool-operation', 'feed-husbandry', 'fertilizer-application', 'veterinary-application',
  'industrial-fuel-operation', 'industrial-chemical-operation', 'machinery-operation', 'tractor-operation',
]);
assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.kind === 'operation').length, 8);
assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.kind === 'operation')
  .every((technology) => operationTechnologyIds.has(technology.id) && technology.unlockFacilityTypeIds.length === 0), true);
assert.equal(technologyIds.size, RESEARCH_TECHNOLOGY_CATALOG.length);
for (const technology of RESEARCH_TECHNOLOGY_CATALOG) {
  for (const prerequisiteId of technology.prerequisiteTechnologyIds) {
    assert.equal(technologyIds.has(prerequisiteId), true, `${technology.id} has unknown prerequisite ${prerequisiteId}`);
  }
}

const visiting = new Set();
const visited = new Set();
const technologyById = new Map(RESEARCH_TECHNOLOGY_CATALOG.map((technology) => [technology.id, technology]));
function visit(technologyId) {
  if (visited.has(technologyId)) return;
  assert.equal(visiting.has(technologyId), false, `research dependency cycle at ${technologyId}`);
  visiting.add(technologyId);
  for (const prerequisiteId of technologyById.get(technologyId).prerequisiteTechnologyIds) visit(prerequisiteId);
  visiting.delete(technologyId);
  visited.add(technologyId);
}
for (const technologyId of technologyIds) visit(technologyId);

const mappedFacilities = new Set();
for (const facility of FACILITY_TYPE_CATALOG) {
  const technology = researchTechnologyForFacility(facility.id);
  assert.ok(technology, `${facility.id} has no required technology`);
  assert.equal(technology.stage, facility.complexity, `${facility.id} stage must match complexity`);
  assert.equal(mappedFacilities.has(facility.id), false, `${facility.id} mapped more than once`);
  mappedFacilities.add(facility.id);
}
assert.equal(mappedFacilities.size, FACILITY_TYPE_CATALOG.length);

const applianceClosure = researchTechnologyClosure(['appliance-engineering']);
const applianceCost = applianceClosure.reduce((sum, technologyId) => sum + technologyById.get(technologyId).cost, 0);
assert.ok(applianceCost >= 15_500, `appliance route cost too low: ${applianceCost}`);
assert.equal(applianceClosure
  .map((technologyId) => technologyById.get(technologyId))
  .filter((technology) => !technology.initial)
  .every((technology) => technology.durationMs === RESEARCH_DURATION_BY_STAGE[technology.stage]), true);

const now = 1_800_000_000_000;
const world = createWorld(now);
const user = { id: 9901, email: 'research@example.com', name: '研发测试' };
const player = ensurePlayer(world, user, now);
ensurePlayerResearch(world, player, now);
assert.deepEqual(player.research.completedTechnologyIds, ['basic-crops', 'basic-livestock']);
assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, now)?.ok, false);
const started = applyResearchAction(world, user, 'startResearch', { technologyId: 'forestry-development' }, now);
assert.equal(started.ok, true);
assert.equal(player.credits, 200);
assert.equal(player.research.active.durationMs, RESEARCH_DURATION_BY_STAGE.C2);
assert.equal(player.research.active.completesAt, now + RESEARCH_DURATION_BY_STAGE.C2);
processResearchWorld(world, now + RESEARCH_DURATION_BY_STAGE.C2 - 1);
assert.equal(player.research.completedTechnologyIds.includes('forestry-development'), false);
processResearchWorld(world, now + RESEARCH_DURATION_BY_STAGE.C2);
assert.equal(player.research.completedTechnologyIds.includes('forestry-development'), true);
assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, now + RESEARCH_DURATION_BY_STAGE.C2), null);

const migrationWorld = createWorld(now);
const migrationUser = { id: 9902, email: 'research-migration@example.com', name: '研发迁移测试' };
const migrationPlayer = ensurePlayer(migrationWorld, migrationUser, now);
ensurePlayerResearch(migrationWorld, migrationPlayer, now);
const previousDurationMs = 195 * 60_000;
const appliedAccelerationMs = 30 * 60_000;
migrationPlayer.research.active = {
  technologyId: 'forestry-development',
  technologyName: '林业开发',
  targetComplexity: 'C2',
  startedAt: now,
  completesAt: now + previousDurationMs - appliedAccelerationMs,
  durationMs: previousDurationMs,
  cost: 300,
  employmentReleased: 25,
};
ensurePlayerResearch(migrationWorld, migrationPlayer, now + 60_000);
assert.equal(migrationPlayer.research.active.durationMs, previousDurationMs);
assert.equal(migrationPlayer.research.active.completesAt, now + previousDurationMs - appliedAccelerationMs);
assert.equal(migrationPlayer.research.active.employmentReleased, 25);

const sourceChecks = [
  ['server/src/research.js', 'completedTechnologyIds'],
  ['server/src/research.js', 'hasResearchAccessForFacility'],
  ['server/src/research.js', 'legacy-stage-'],
  ['server/src/research-catalog.js', 'RESEARCH_DURATION_MS = 6 * 60 * 60_000'],
  ['server/src/research-catalog.js', "id: 'tool-operation'"],
  ['server/src/research-catalog.js', "kind: 'operation'"],
  ['server/src/research.js', 'LEGACY_OPERATION_TECHNOLOGY_GRANTS'],
  ['server/src/state-partitions.js', "'researchTechnologies'"],
  ['server/src/commercial-contracts.js', 'hasResearchAccessForFacility'],
  ['src/types.ts', 'ResearchTechnologyDefinition'],
  ['src/types.ts', 'researchTechnologies?: ResearchTechnologyDefinition[]'],
  ['src/pages/ResearchPage.tsx', 'model.startResearch(technologyId)'],
  ['src/pages/ResearchPage.tsx', '按产业链选择科技节点'],
  ['src/api/game.ts', "postAction('/research/start', { technologyId })"],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '工厂研发准入由具体科技节点决定'],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '研发时长读取服务器科技目录'],
];
for (const [path, text] of sourceChecks) {
  assert.ok(readFileSync(path, 'utf8').includes(text), `${path} missing ${text}`);
}

console.log('split research technology catalog, stage-specific duration and paid deadline preservation, migration, access control, UI and design verification passed');
