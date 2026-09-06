import type { EconomyState, FacilityGroup } from '../types';
import { operationalFacilityGroups } from '../utils/operationalFacilityGroups.js';
import type { PlayerPageLocation } from '../navigation/playerPageStack';
import type { TutorialRunContext, TutorialStepId } from './tutorialStorage';

/** Province and type form the identity; a missing legacy province must never pick an arbitrary group. */
export function tutorialFacility(game: EconomyState, context: TutorialRunContext): FacilityGroup | undefined {
  const matches = operationalFacilityGroups(game).filter((group) => group.facilityTypeId === context.facilityTypeId
    && (!context.provinceId || group.provinceId === context.provinceId));
  return matches.length === 1 ? matches[0] : undefined;
}

export function tutorialTargetLocation(
  step: TutorialStepId, context: TutorialRunContext, provinceId: string,
): PlayerPageLocation | undefined {
  const targetProvince = context.provinceId;
  if (step !== 'build-facility' && !targetProvince && context.facilityTypeId) {
    return step === 'complete-sale' && context.productId
      ? { type: 'global-market-product', productId: context.productId }
      : { type: 'global-building', facilityTypeId: context.facilityTypeId };
  }
  if (step === 'build-facility') return { type: 'province', provinceId, section: 'buildings' };
  if (['start-facility', 'complete-production', 'set-auto-sell'].includes(step) && context.facilityTypeId && targetProvince) {
    return { type: 'regional-facility', host: 'buildings', provinceId: targetProvince, facilityTypeId: context.facilityTypeId };
  }
  if (step === 'complete-sale' && context.productId && targetProvince) {
    return { type: 'regional-product', host: 'market', provinceId: targetProvince, productId: context.productId };
  }
  return undefined;
}
