import type { FacilityRecipeDefinition, ProductInventory } from '../types';

export interface FacilityInputDiagnosis {
  productId: string;
  requiredPerCycle: number;
  available: number;
  supportedCycles: number;
  shortfallThisCycle: number;
}

export interface FacilityOperatingDiagnosis {
  productionCount: number;
  inputRows: FacilityInputDiagnosis[];
  inputCycles: number | null;
  cashPerCycle: number;
  cashCycles: number | null;
  outputPerCycle: number;
  bottleneck: { id: string; label: string; cycles: number | null };
}

function wholeCycles(available: number, required: number) {
  if (required <= 0) return null;
  return Math.max(0, Math.floor(Math.max(0, available) / required));
}

export function buildFacilityOperatingDiagnosis({
  recipe,
  productionCount,
  inventories,
  credits,
}: {
  recipe: FacilityRecipeDefinition;
  productionCount: number;
  inventories: Record<string, ProductInventory>;
  credits: number;
}): FacilityOperatingDiagnosis {
  const count = Math.max(0, Math.floor(Number(productionCount) || 0));
  const inputRows = recipe.inputs.map((input) => {
    const requiredPerCycle = input.quantity * count;
    const available = Math.max(0, Number(inventories[input.productId]?.available || 0));
    return {
      productId: input.productId,
      requiredPerCycle,
      available,
      supportedCycles: wholeCycles(available, requiredPerCycle) ?? 0,
      shortfallThisCycle: Math.max(0, requiredPerCycle - available),
    };
  });
  const inputCycles = inputRows.length > 0
    ? Math.min(...inputRows.map((item) => item.supportedCycles))
    : null;
  const cashPerCycle = Math.max(0, Number(recipe.operatingCost || 0) * count);
  const cashCycles = wholeCycles(Math.max(0, credits), cashPerCycle);
  const outputPerCycle = Math.max(0, Number(recipe.output.quantity || 0) * count);
  const candidates = [
    ...(inputCycles === null ? [] : [{ id: 'inputs', label: '生产原料', cycles: inputCycles }]),
    ...(cashCycles === null ? [] : [{ id: 'cash', label: '可用资金', cycles: cashCycles }]),
  ];
  const bottleneck = count <= 0
    ? { id: 'capacity', label: '当前等效产能', cycles: 0 }
    : candidates.sort((left, right) => left.cycles - right.cycles)[0]
      ?? { id: 'none', label: '暂无硬性瓶颈', cycles: null };
  return { productionCount: count, inputRows, inputCycles, cashPerCycle, cashCycles, outputPerCycle, bottleneck };
}
