import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG } from '../server/src/industry-catalog.js';
import {
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

assert.equal(RESEARCH_TECHNOLOGY_CATALOG.length, 24);
assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.initial).length, 2);
assert.equal(RESEARCH_LEVEL_CATALOG.length, 7);
assert.equal(RESEARCH_LEVEL_CATALOG.reduce((sum, stage) => sum + stage.cost, 0), 27_900);
assert.equal(RESEARCH_LEVEL_CATALOG.reduce((sum, stage) => sum + stage.durationMs, 0), 1_042 * 60_000);

const technologyIds = new Set(RESEARCH_TECHNOLOGY_CATALOG.map((technology) => technology.id));
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
const applianceDuration = applianceClosure.reduce((sum, technologyId) => sum + technologyById.get(technologyId).durationMs, 0);
assert.ok(applianceCost >= 15_500, `appliance route cost too low: ${applianceCost}`);
assert.ok(applianceDuration >= (11 * 60 + 40) * 60_000, `appliance route duration too short: ${applianceDuration}`);

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
processResearchWorld(world, now + 4 * 60_000);
assert.equal(player.research.completedTechnologyIds.includes('forestry-development'), true);
assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'logging-camp' }, now + 4 * 60_000), null);

const sourceChecks = [
  ['server/src/research.js', 'completedTechnologyIds'],
  ['server/src/research.js', 'hasResearchAccessForFacility'],
  ['server/src/research.js', 'legacy-stage-'],
  ['server/src/state-partitions.js', "'researchTechnologies'"],
  ['server/src/commercial-contracts.js', 'hasResearchAccessForFacility'],
  ['src/types.ts', 'ResearchTechnologyDefinition'],
  ['src/types.ts', 'researchTechnologies: ResearchTechnologyDefinition[]'],
  ['src/pages/ResearchPage.tsx', 'model.startResearch(selectedTechnology.id)'],
  ['src/pages/ResearchPage.tsx', '按产业链选择科技节点'],
  ['src/api/game.ts', "postAction('/research/start', { technologyId })"],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '工厂研发准入由具体科技节点决定'],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', 'C1–C7 只作为产业阶段'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'completedTechnologyIds'],
];
for (const [path, text] of sourceChecks) {
  assert.ok(readFileSync(path, 'utf8').includes(text), `${path} missing ${text}`);
}

console.log('split research technology catalog, dependencies, migration, access control, UI and design verification passed');
