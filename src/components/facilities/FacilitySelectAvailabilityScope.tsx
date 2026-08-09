import { useMemo, type ReactNode } from 'react';
import type { EconomyState } from '../../types';
import { getUnlockedFacilityTypeIds } from '../../utils/facilityResearchAccess';
import { SelectOptionAvailabilityProvider } from '../ui/FormControls';

export function FacilitySelectAvailabilityScope({
  game,
  children,
}: {
  game: EconomyState;
  children: ReactNode;
}) {
  const restrictedOptionValues = useMemo(
    () => new Set(game.facilityTypes.map((facility) => facility.id)),
    [game.facilityTypes],
  );
  const allowedRestrictedOptionValues = useMemo(
    () => getUnlockedFacilityTypeIds(game),
    [game.facilityTypes, game.research, game.researchTechnologies],
  );

  return (
    <SelectOptionAvailabilityProvider
      restrictedOptionValues={restrictedOptionValues}
      allowedRestrictedOptionValues={allowedRestrictedOptionValues}
    >
      {children}
    </SelectOptionAvailabilityProvider>
  );
}
