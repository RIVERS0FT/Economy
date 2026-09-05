import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../types/commercial';

function amount(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Locked cycles never borrow values from a newer catalog, count or market price. */
export function commercialSettlementPresentation(group: CommercialBuildingGroup, type: CommercialBuildingTypeDefinition,
  markets: Record<string, { officialPrice?: number | null }>) {
  if (group.status === 'running') {
    return {
      locked: true,
      inputs: group.pendingInputs ?? null,
      operatingCost: amount(group.pendingOperatingCost),
      inputValue: amount(group.pendingInputValue),
      revenue: amount(group.pendingRevenue),
      profit: amount(group.pendingProfit),
      count: group.participatingCount,
      label: '本周期锁定收入',
    };
  }
  const inputs = type.consumptionInputs.map((input) => ({ ...input, quantity: input.quantity * group.count }));
  const knownPrices = inputs.every((input) => amount(markets[input.productId]?.officialPrice ?? undefined) !== null);
  const inputValue = knownPrices ? inputs.reduce((sum, input) => sum + input.quantity * Number(markets[input.productId].officialPrice), 0) : null;
  const operatingCost = type.operatingCost * group.count;
  const profit = type.profitPerCycle * group.count;
  return {
    locked: false, inputs, inputValue, operatingCost, profit, count: group.count,
    revenue: inputValue === null ? null : inputValue + operatingCost + profit,
    label: group.status === 'error' ? '恢复后预计收入' : '启动后预计收入',
  };
}
