import type { EconomyState, FacilityTypeDefinition } from '../types';

type FacilityResearchState = Pick<EconomyState, 'facilityTypes'> & Partial<Pick<
  EconomyState,
  'research' | 'researchTechnologies'
>>;

function complexityRank(value: string) {
  const rank = Number.parseInt(String(value).slice(1), 10);
  return Number.isInteger(rank) && rank >= 1 && rank <= 7 ? rank : 1;
}

export function getUnlockedFacilityTypeIds(game: FacilityResearchState) {
  const research = game.research;
  if (!research) {
    return new Set(game.facilityTypes.map((facility) => facility.id));
  }

  const technologies = game.researchTechnologies;
  const completedTechnologyIds = research.completedTechnologyIds;

  if (Array.isArray(technologies) && Array.isArray(completedTechnologyIds)) {
    const completed = new Set(completedTechnologyIds);
    const unlocked = new Set<string>();
    for (const technology of technologies) {
      if (!completed.has(technology.id)) continue;
      for (const facilityTypeId of technology.unlockFacilityTypeIds) unlocked.add(facilityTypeId);
    }
    return unlocked;
  }

  const unlockedRank = complexityRank(research.unlockedComplexity);
  return new Set(
    game.facilityTypes
      .filter((facility) => complexityRank(facility.complexity) <= unlockedRank)
      .map((facility) => facility.id),
  );
}

export function getUnlockedFacilityTypes(game: FacilityResearchState): FacilityTypeDefinition[] {
  const unlockedFacilityTypeIds = getUnlockedFacilityTypeIds(game);
  return game.facilityTypes.filter((facility) => unlockedFacilityTypeIds.has(facility.id));
}
