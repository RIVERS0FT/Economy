import type { EconomyState } from '../types';

type CommercialResearchState = Partial<Pick<EconomyState, 'research' | 'researchTechnologies'>>;

export function commercialResearchRequirement(game: CommercialResearchState, commercialTypeId: string) {
  const technology = game.researchTechnologies?.find((item) => item.unlockCommercialTypeIds?.includes(commercialTypeId));
  return {
    unlocked: Boolean(technology && game.research?.completedTechnologyIds?.includes(technology.id)),
    message: technology ? `需要先完成「${technology.name}」研发` : '正在同步研发目录',
  };
}
