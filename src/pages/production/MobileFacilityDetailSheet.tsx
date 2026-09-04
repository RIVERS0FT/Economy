import type { RefObject } from 'react';
import { MobileWorkspaceDetailSheet } from '../../components/ui/MobileWorkspaceDetailSheet';
import {
  FacilityClusterDetailBody,
  FacilityClusterInformation,
  type FacilityClusterDetailSharedProps,
  type FacilityClusterEntry,
} from './ProductionFacilityDetail';

export function MobileFacilityDetailSheet({
  entry,
  products,
  inventories,
  markets,
  credits,
  completedTechnologyIds,
  researchTechnologies,
  now,
  isOpen,
  returnFocusRef,
  onClose,
  onToggle,
  onRecipeChange,
  onOpenProductMarket,
  onOpenContracts,
}: Omit<FacilityClusterDetailSharedProps, 'entry'> & {
  entry: FacilityClusterEntry | undefined;
  isOpen: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  if (!entry) return null;

  return (
    <MobileWorkspaceDetailSheet
      isOpen={isOpen}
      ariaLabel={`${entry.type.name}工厂详情`}
      viewportAriaLabel={`${entry.type.name}工厂详情内容`}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
    >
      <FacilityClusterInformation
        entry={entry}
        products={products}
        inventories={inventories}
        now={now}
        onToggle={onToggle}
      />
      <FacilityClusterDetailBody
        entry={entry}
        products={products}
        inventories={inventories}
        markets={markets}
        credits={credits}
        completedTechnologyIds={completedTechnologyIds}
        researchTechnologies={researchTechnologies}
        now={now}
        onRecipeChange={onRecipeChange}
        onOpenProductMarket={onOpenProductMarket}
        onOpenContracts={onOpenContracts}
      />
    </MobileWorkspaceDetailSheet>
  );
}
