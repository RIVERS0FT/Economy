import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../types/commercial';
import { commercialStaffingCapacity, projectCommercialStaffingRate } from '../../shared/commercial-staffing.js';

function amount(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Active cycles never borrow a newer count, staffing rate, catalog or market price. */
export function commercialSettlementPresentation(group: CommercialBuildingGroup, type: CommercialBuildingTypeDefinition,
  markets: Record<string, { officialPrice?: number | null }>, now = group.staffingUpdatedAt ?? 0) {
  if (group.status === 'running') {
    return {
      locked: true,
      inputs: group.pendingInputs ?? null,
      operatingCost: amount(group.pendingOperatingCost),
      inputValue: amount(group.pendingInputValue),
      revenue: amount(group.pendingRevenue),
      profit: amount(group.pendingProfit),
      count: group.participatingCount,
      effectiveCount: amount(group.pendingEffectiveCount),
      label: '本周期收入',
    };
  }
  const rate = projectCommercialStaffingRate(group, now);
  const effectiveCount = rate === null ? null
    : commercialStaffingCapacity(group.count, rate, group.staffingBatchCarryBps ?? 0).effectiveCount;
  const inputs = effectiveCount === null ? null
    : type.consumptionInputs.map((input) => ({ ...input, quantity: input.quantity * effectiveCount }));
  const knownPrices = inputs !== null && inputs.every((input) => input.quantity === 0 || amount(markets[input.productId]?.officialPrice ?? undefined) !== null);
  const inputValue = knownPrices && inputs ? inputs.reduce((sum, input) => sum + (input.quantity === 0 ? 0 : input.quantity * Number(markets[input.productId].officialPrice)), 0) : null;
  const operatingCost = effectiveCount === null ? null : type.operatingCost * effectiveCount;
  const profit = effectiveCount === null ? null : type.profitPerCycle * effectiveCount;
  return {
    locked: false, inputs, inputValue, operatingCost, profit, count: group.count, effectiveCount,
    revenue: inputValue === null || operatingCost === null || profit === null ? null : inputValue + operatingCost + profit,
    label: group.status === 'error' ? '恢复后预计收入' : '启动后预计收入',
  };
}
