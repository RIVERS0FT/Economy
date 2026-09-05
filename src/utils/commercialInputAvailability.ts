import type { CommodityFreezeDetail, ProductInventory } from '../types';
import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../types/commercial';
import { commercialStaffingCapacity, hasCommercialCycle, projectCommercialStaffingRate } from '../../shared/commercial-staffing.js';

/** Read-only next-cycle estimates. Current locked inputs and warehouse totals stay unchanged. */
export function commercialNextCycleAvailability(group: CommercialBuildingGroup, type: CommercialBuildingTypeDefinition,
  inventories: Record<string, ProductInventory>, freezeDetails: Record<string, CommodityFreezeDetail[]> | undefined, now: number) {
  const startAt = hasCommercialCycle(group) && Number.isFinite(group.cycleCompletesAt)
    ? Math.max(now, Number(group.cycleCompletesAt)) : now;
  const rate = projectCommercialStaffingRate(group, startAt);
  const effectiveCount = rate === null ? null
    : commercialStaffingCapacity(group.count, rate, group.staffingBatchCarryBps ?? 0).effectiveCount;
  const sourceId = group.provinceId + ':' + group.commercialTypeId;
  const required = effectiveCount === null ? undefined : Object.fromEntries(type.consumptionInputs.map((input) =>
    [input.productId, input.quantity * effectiveCount]));
  const usable: Record<string, number | null> = {};
  for (const input of type.consumptionInputs) {
    const inventory = inventories[input.productId];
    const available = inventory?.available ?? 0;
    const frozen = inventory?.frozen ?? 0;
    const entries = freezeDetails?.[input.productId];
    // Missing source attribution is unknown, not evidence of a shortage or permission to spend all frozen goods.
    const attributed = (entries ?? []).reduce((sum, entry) => sum + (Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 0), 0);
    if (frozen > 0 && (!entries || attributed !== frozen)) { usable[input.productId] = null; continue; }
    const own = (entries ?? []).reduce((sum, entry) => sum + (entry.kind === 'commercial'
      && entry.sourceId === sourceId && Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 0), 0);
    usable[input.productId] = available + Math.min(frozen, own);
  }
  return { required, usable };
}
