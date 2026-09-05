export type CommodityWritePhase = 'submitting' | 'confirming' | 'unconfirmed' | 'settled';
export interface CommodityWriteProgress {
  provinceId: string;
  assetId: string;
  side: 'buy' | 'sell';
  quantity: number;
  phase: CommodityWritePhase;
}
const listeners = new Set<(progress: CommodityWriteProgress) => void>();

export function subscribeCommodityWriteProgress(listener: (progress: CommodityWriteProgress) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishCommodityWriteProgress(body: string, phase: CommodityWritePhase) {
  let value: Record<string, unknown>;
  try { value = JSON.parse(body) as Record<string, unknown>; } catch { return; }
  if (!value || value.assetKind !== 'commodity' || value.execution
    || (value.side !== 'buy' && value.side !== 'sell')) return;
  const progress: CommodityWriteProgress = {
    provinceId: String(value.provinceId || ''), assetId: String(value.assetId || value.productId || ''),
    side: value.side, quantity: Number(value.quantity), phase,
  };
  for (const listener of listeners) {
    try { listener(progress); } catch { /* Presentation must never interrupt an economic request. */ }
  }
}
