import { getAuctionState } from '../auctions/types';
import { productionContractStateFromGame } from '../contracts/types';
import type { EconomyState } from '../types';

interface BuildingInventoryFreezeSource {
  kind: 'production' | 'commercial';
  provinceId: string;
  productId: string;
  sourceId: string;
  sourceLabel: string;
  quantity: number;
}

export interface InventoryFreezeBreakdownLine {
  label: string;
  quantity: number;
}

function quantity(value: unknown) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

export function inventoryFreezeBreakdown(
  game: EconomyState,
  provinceId: string,
  productId: string,
  frozenTotal: number,
): InventoryFreezeBreakdownLine[] {
  const lines: InventoryFreezeBreakdownLine[] = [];
  const state = game as EconomyState & { inventoryFreezeSources?: BuildingInventoryFreezeSource[] };

  for (const source of state.inventoryFreezeSources ?? []) {
    if (source.provinceId !== provinceId || source.productId !== productId) continue;
    const amount = quantity(source.quantity);
    if (amount < 1) continue;
    lines.push({
      label: `${source.kind === 'production' ? '生产冻结' : '经营冻结'} · ${source.sourceLabel || source.sourceId}`,
      quantity: amount,
    });
  }

  for (const contract of productionContractStateFromGame(game).productionContracts) {
    if (
      contract.kind !== 'supply'
      || contract.status !== 'active'
      || !contract.isSupplier
      || String(contract.provinceId || '') !== provinceId
      || contract.productId !== productId
    ) continue;
    const amount = quantity(contract.supplierReservedQuantity);
    if (amount > 0) lines.push({ label: `合同冻结 · ${contract.id}`, quantity: amount });
  }

  for (const auction of getAuctionState(game).assetAuctions) {
    if (!auction.isSeller || auction.status !== 'open' || auction.escrowStatus !== 'held') continue;
    const amount = (auction.items ?? []).reduce((sum, item) => (
      item.assetKind === 'commodity'
      && item.assetId === productId
      && item.provinceId === provinceId
        ? sum + quantity(item.quantity)
        : sum
    ), 0);
    if (amount > 0) lines.push({ label: `拍卖冻结 · ${auction.id}`, quantity: amount });
  }

  const known = lines.reduce((sum, line) => sum + line.quantity, 0);
  const other = Math.max(0, quantity(frozenTotal) - known);
  if (other > 0) lines.push({ label: '其他冻结', quantity: other });
  return lines;
}

export function inventoryFreezeBreakdownTitle(lines: InventoryFreezeBreakdownLine[]) {
  if (lines.length < 1) return '暂无冻结商品';
  return lines.map((line) => `${line.label}：${line.quantity}`).join('\n');
}
