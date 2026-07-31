export interface AssetAllocation {
  cashShare: number;
  commodityShare: number;
  facilityShare: number;
}

function normalizedValue(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function roundedShares(exactShares: readonly number[]) {
  const floors = exactShares.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exactShares
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (let index = 0; index < order.length && remaining > 0; index += 1, remaining -= 1) {
    floors[order[index].index] += 1;
  }
  return floors;
}

export function buildAssetAllocation(cashValue: number, commodityValue: number, facilityValue: number): AssetAllocation {
  const values = [cashValue, commodityValue, facilityValue].map(normalizedValue);
  const total = values.reduce((sum, value) => sum + value, 0);
  const exactShares = total > 0 ? values.map((value) => (value / total) * 100) : [0, 0, 0];
  const [cashShare, commodityShare, facilityShare] = total > 0
    ? roundedShares(exactShares)
    : [0, 0, 0];
  return {
    cashShare,
    commodityShare,
    facilityShare,
  };
}
