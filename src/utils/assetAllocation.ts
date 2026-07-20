import type { CSSProperties } from 'react';

export interface AssetAllocation {
  cashShare: number;
  commodityShare: number;
  facilityShare: number;
  allocationStyle: CSSProperties;
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
  const cashEnd = exactShares[0] * 3.6;
  const commodityEnd = (exactShares[0] + exactShares[1]) * 3.6;

  return {
    cashShare,
    commodityShare,
    facilityShare,
    allocationStyle: {
      background: `conic-gradient(var(--green) 0deg ${cashEnd}deg, var(--gold) ${cashEnd}deg ${commodityEnd}deg, var(--blue) ${commodityEnd}deg 360deg)`,
    },
  };
}
