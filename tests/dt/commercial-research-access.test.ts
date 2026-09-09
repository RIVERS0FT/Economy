import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialResearchRequirement } from '../../src/utils/commercialResearchAccess.ts';
import type { ResearchTechnologyDefinition } from '../../src/types.ts';

const technology: ResearchTechnologyDefinition = {
  id: 'urban-commerce', name: '城市商业', branch: 'commerce', stage: 'C3', rank: 3,
  cost: 900, durationMs: 3600000, prerequisiteTechnologyIds: ['basic-commerce'],
  unlockFacilityTypeIds: [], unlockCommercialTypeIds: ['restaurant', 'clothing-store'], description: '',
};
test('commercial availability follows completed node identities for all declared types', () => {
  const game = { researchTechnologies: [technology], research: {
    unlockedComplexity: 'C7' as const, completedTechnologyIds: ['basic-commerce'], completedAt: null, active: null,
  } };
  assert.equal(commercialResearchRequirement(game, 'restaurant').unlocked, false);
  assert.match(commercialResearchRequirement(game, 'restaurant').message, /城市商业/);
  game.research.completedTechnologyIds.push('urban-commerce');
  for (const id of ['restaurant', 'clothing-store']) assert.equal(commercialResearchRequirement(game, id).unlocked, true);
  assert.equal(commercialResearchRequirement(game, 'appliance-store').unlocked, false);
});
test('missing research snapshots do not invent commercial permissions', () => {
  assert.equal(commercialResearchRequirement({}, 'restaurant').unlocked, false);
  assert.equal(commercialResearchRequirement({ researchTechnologies: [technology] }, 'restaurant').unlocked, false);
});
