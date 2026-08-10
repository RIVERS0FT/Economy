import type { RefObject } from 'react';
import { MobileWorkspaceDetailSheet } from '../../components/ui/MobileWorkspaceDetailSheet';
import {
  FacilityClusterDetailBody,
  FacilityClusterInformation,
  FacilityMarketAction,
  type FacilityClusterDetailSharedProps,
  type FacilityClusterEntry,
} from './ProductionFacilityDetail';

export function MobileFacilityDetailSheet({
  entry,
  products,
  inventories,
  markets,
  credits,
  now,
  isOpen,
  returnFocusRef,
  onClose,
  onToggle,
  onRecipeChange,
  onOpenMarket,
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
      ariaLabelledBy="mobile-facility-detail-title"
      viewportAriaLabel={`${entry.type.name}工厂详情内容`}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
      footer={(requestClose) => (
        <FacilityMarketAction onOpenMarket={() => requestClose(onOpenMarket)} />
      )}
    >
      <FacilityClusterInformation
        entry={entry}
        products={products}
        inventories={inventories}
        now={now}
        onToggle={onToggle}
        titleId="mobile-facility-detail-title"
      />
      <FacilityClusterDetailBody
        entry={entry}
        products={products}
        inventories={inventories}
        markets={markets}
        credits={credits}
        now={now}
        onRecipeChange={onRecipeChange}
        onOpenProductMarket={onOpenProductMarket}
        onOpenContracts={onOpenContracts}
      />
    </MobileWorkspaceDetailSheet>
  );
}
