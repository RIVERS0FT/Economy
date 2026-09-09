import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from '../src/commercial-catalog.js';
import { applyCommercialBuildingAction, processCommercialWorld } from '../src/commercial-buildings.js';
import { RESEARCH_TECHNOLOGY_CATALOG, RESEARCH_CATALOG_VERSION, researchTechnologyClosure, researchTechnologyFor } from '../src/research-catalog.js';
import { LEGACY_RESEARCH_NODES } from '../src/legacy-research.js';
import { ensurePlayerResearch, applyResearchAction, processPlayerResearch, validateResearchAccess, migrateResearchWorld } from '../src/research.js';

const NOW = 1_800_000_000_000;
function setup() {
  const world = createWorld(NOW);
  const user = { id: 99881, email: 'unified-research@example.com', name: '科技测试' };
  const player = ensurePlayer(world, user, NOW);
  ensurePlayerResearch(world, player, NOW);
  player.credits = 100_000;
  return { world, user, player };
}

test('unified catalog covers every asset once, crosses building complexity and has an acyclic knowledge graph', () => {
  assert.equal(RESEARCH_TECHNOLOGY_CATALOG.length, 18);
  for (const [catalog, field] of [[FACILITY_TYPE_CATALOG, 'unlockFacilityTypeIds'], [COMMERCIAL_BUILDING_TYPE_CATALOG, 'unlockCommercialTypeIds']]) {
    for (const type of catalog) assert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((t) => t[field].includes(type.id)).length, 1, type.id);
    assert.deepEqual(new Set(RESEARCH_TECHNOLOGY_CATALOG.flatMap((t) => t[field])), new Set(catalog.map((t) => t.id)));
  }
  const visit = (id, parents = new Set()) => {
    assert.ok(!parents.has(id), id);
    const technology = researchTechnologyFor(id);
    assert.ok(technology, id);
    for (const predecessor of technology.prerequisiteTechnologyIds) visit(predecessor, new Set([...parents, id]));
  };
  for (const t of RESEARCH_TECHNOLOGY_CATALOG) visit(t.id);
  const wood = researchTechnologyFor('wood-industry');
  assert.ok(new Set(FACILITY_TYPE_CATALOG.filter((f) => wood.unlockFacilityTypeIds.includes(f.id)).map((f) => f.complexity)).size > 1);
  for (const f of FACILITY_TYPE_CATALOG) for (const group of f.productionMethodGroups) for (const method of group.methods) {
    assert.equal(new Set(method.requiredTechnologyIds).size, method.requiredTechnologyIds.length);
    for (const id of method.requiredTechnologyIds) assert.ok(researchTechnologyFor(id), `${f.id}/${method.id}/${id}`);
  }
});

test('commercial research is independent of manufacturing and shares the single paid research slot', () => {
  const { world, user, player } = setup();
  const build = (id) => applyCommercialBuildingAction(world, user, { operation: 'build', provinceId: '110000', commercialTypeId: id, quantity: 1 }, NOW);
  assert.equal(build('convenience-store').ok, true);
  assert.equal(build('fresh-market').ok, true);
  const credits = player.credits;
  assert.equal(build('restaurant').ok, false);
  assert.equal(build('clothing-store').ok, false);
  assert.equal(player.credits, credits);
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'department-retail' }, NOW).ok, false);
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'urban-commerce' }, NOW).ok, true);
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'resource-survey' }, NOW).ok, false);
  processPlayerResearch(world, player, player.research.active.completesAt);
  assert.equal(build('restaurant').ok, true);
  assert.equal(build('clothing-store').ok, true);
  assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: 'garment-factory' }, NOW)?.ok, false);
});

test('commercial expansion and restart require access; stop and invested settlement remain available', () => {
  const { world, user, player } = setup();
  player.research.completedTechnologyIds.push('urban-commerce');
  player.inventories.clothing.available = 10;
  const action = (operation, time = NOW) => applyCommercialBuildingAction(world, user, { operation, provinceId: '110000', commercialTypeId: 'clothing-store', quantity: 1 }, time);
  assert.equal(action('build').ok, true);
  const group = player.commercialBuildingGroups.find((g) => g.commercialTypeId === 'clothing-store');
  const revenue = group.pendingRevenue;
  const deadline = group.cycleCompletesAt;
  player.research.completedTechnologyIds = ['basic-crops', 'basic-livestock', 'basic-commerce'];
  const before = player.credits;
  assert.equal(action('build').ok, false);
  assert.equal(action('start').ok, false);
  assert.equal(player.credits, before);
  assert.equal(group.count, 1);
  assert.equal(action('stop').ok, true);
  processCommercialWorld(world, deadline);
  assert.equal(group.lifetimeRevenue, revenue);
  assert.equal(group.enabled, false);
});

test('a mixed technology unlocks manufacturing and multiple methods without changing running configurations', () => {
  const { world, user, player } = setup();
  const technology = researchTechnologyFor('scientific-agriculture');
  assert.ok(technology.unlockFacilityTypeIds.length > 1);
  assert.ok(FACILITY_TYPE_CATALOG.filter((f) => f.productionMethodGroups.some((g) => g.methods.some((m) => m.requiredTechnologyIds.includes(technology.id)))).length > 1);
  const facilities = structuredClone(player.facilityGroups);
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: technology.id }, NOW).ok, true);
  processPlayerResearch(world, player, player.research.active.completesAt);
  assert.deepEqual(player.facilityGroups, facilities);
  for (const id of technology.unlockFacilityTypeIds) assert.equal(validateResearchAccess(world, user, 'buildFacility', { facilityTypeId: id }, NOW), null);
});

test('every old node preserves its mapped unlocks and migration is idempotent', () => {
  for (const entry of LEGACY_RESEARCH_NODES) {
    const { world, player } = setup();
    player.research = { completedTechnologyIds: [entry.id], completedAt: NOW - 1000, active: null };
    ensurePlayerResearch(world, player, NOW);
    assert.ok(player.research.completedTechnologyIds.includes(entry.technologyId), entry.id);
    assert.equal(player.research.catalogVersion, RESEARCH_CATALOG_VERSION);
    const state = structuredClone(player);
    ensurePlayerResearch(world, player, NOW + 1);
    assert.deepEqual(player, state);
  }
});

test('paid colliding nodes retain cost, accelerated deadline and all payroll through completion', () => {
  const { world, player } = setup();
  player.stats.researchPayroll = 100;
  player.research = { completedTechnologyIds: ['forestry-development'], completedAt: NOW - 1000,
    active: { technologyId: 'mineral-exploration', targetComplexity: 'C2', startedAt: NOW,
      completesAt: NOW + 60_000, durationMs: 31 * 60_000, cost: 350, employmentReleased: 100 } };
  const credits = player.credits;
  ensurePlayerResearch(world, player, NOW);
  assert.ok(player.research.completedTechnologyIds.includes('resource-survey'));
  assert.equal(player.research.active.technologyId, 'resource-survey');
  assert.equal(player.research.active.cost, 350);
  assert.equal(player.research.active.durationMs, 31 * 60_000);
  assert.equal(player.research.active.completesAt, NOW + 60_000);
  assert.equal(player.research.active.employmentReleased, 100);
  processPlayerResearch(world, player, NOW + 60_000);
  assert.equal(player.research.active, null);
  assert.equal(player.stats.researchPayroll, 350);
  assert.equal(player.credits, credits);
  assert.equal(player.research.completedAtByTechnologyId['resource-survey'], NOW - 1000);
  processPlayerResearch(world, player, NOW + 120_000);
  assert.equal(player.stats.researchPayroll, 350);
});

test('old stage promises grant their original mapped nodes and settle even when all access is already held', () => {
  const { world, player } = setup();
  player.research = { unlockedComplexity: 'C7', active: {
    targetComplexity: 'C2', startedAt: NOW, completesAt: NOW + 60_000, durationMs: 60_000, cost: 300, employmentReleased: 50,
  } };
  ensurePlayerResearch(world, player, NOW);
  assert.ok(player.research.active);
  assert.ok(!player.research.completedTechnologyIds.includes('urban-commerce'));
  processPlayerResearch(world, player, NOW + 60_000);
  assert.equal(player.stats.researchPayroll, 250);
  assert.equal(player.research.active, null);
});

test('existing commercial assets grant access once without changing invested cycles or granting other owners access', () => {
  const { world, player } = setup();
  delete player.research.catalogVersion;
  player.commercialBuildingGroups = [{ provinceId: '110000', commercialTypeId: 'appliance-store', count: 2,
    enabled: true, pendingRevenue: 600, pendingProfit: 20, cycleStartedAt: NOW, cycleCompletesAt: NOW + 300_000 }];
  const groups = structuredClone(player.commercialBuildingGroups);
  ensurePlayerResearch(world, player, NOW);
  assert.deepEqual(player.commercialBuildingGroups, groups);
  for (const id of researchTechnologyClosure(['department-retail'])) assert.ok(player.research.completedTechnologyIds.includes(id));
  const newcomer = ensurePlayer(world, { id: 99882, email: 'other@example.com' }, NOW);
  ensurePlayerResearch(world, newcomer, NOW);
  assert.ok(!newcomer.research.completedTechnologyIds.includes('department-retail'));
});

test('acceleration at the instant of starting a short project does not lose its paid payroll', () => {
  const { world, user, player } = setup();
  player.gems = 1;
  assert.equal(applyResearchAction(world, user, 'startResearch', { technologyId: 'resource-survey' }, NOW).ok, true);
  assert.equal(applyResearchAction(world, user, 'accelerateResearch', {}, NOW).completedImmediately, true);
  assert.equal(player.stats.researchPayroll, researchTechnologyFor('resource-survey').cost);
});

test('pre-29 manufacturing promises retain their operation access after node consolidation', () => {
  const { world, player } = setup();
  world.version = 28;
  player.research = { completedTechnologyIds: ['tool-manufacturing'], active: null };
  migrateResearchWorld(world, NOW);
  for (const id of ['metallurgical-engineering', 'powered-production']) assert.ok(player.research.completedTechnologyIds.includes(id));
  const active = setup();
  active.world.version = 28;
  active.player.research = { completedTechnologyIds: ['basic-crops'], active: {
    technologyId: 'tool-manufacturing', targetComplexity: 'C4', startedAt: NOW,
    completesAt: NOW + 60_000, durationMs: 60_000, cost: 1050, employmentReleased: 0,
  } };
  migrateResearchWorld(active.world, NOW);
  processPlayerResearch(active.world, active.player, NOW + 60_000);
  for (const id of ['metallurgical-engineering', 'powered-production']) assert.ok(active.player.research.completedTechnologyIds.includes(id));
  assert.equal(active.player.stats.researchPayroll, 1050);
});

test('merged completion dates preserve the earliest earned timestamp', () => {
  const { world, player } = setup();
  player.research = { completedTechnologyIds: ['mineral-exploration', 'forestry-development'],
    completedAtByTechnologyId: { 'mineral-exploration': NOW - 1000, 'forestry-development': NOW - 2000 },
    completedAt: NOW - 1000, active: null };
  ensurePlayerResearch(world, player, NOW);
  assert.equal(player.research.completedAtByTechnologyId['resource-survey'], NOW - 2000);
});
