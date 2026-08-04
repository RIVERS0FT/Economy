import type { AssetOrder, EconomyState, LeaderboardEntry } from '../types';

export interface DerivedGameData {
  ownOpenOrders: AssetOrder[];
  facilityValue: number;
  commodityValue: number;
  cashValue: number;
  totalAssets: number;
  currentRank?: LeaderboardEntry;
  previousRank: LeaderboardEntry | null;
  runningFacilities: number;
  constructingFacilities: number;
  stoppedFacilities: number;
  blockedFacilities: number;
  inventoryUsed: number;
}

export function deriveGameData(game: EconomyState): DerivedGameData {
  const ownOpenOrders = game.orders.filter((order) => (
    order.isOwn && ['open', 'partial'].includes(order.status)
  ));
  const currentRank = game.leaderboard.find((entry) => entry.isCurrentPlayer);
  const previousRank = currentRank
    ? game.leaderboard.find((entry) => entry.rank === currentRank.rank - 1) ?? null
    : null;
  return {
    ownOpenOrders,
    facilityValue: game.assetSummary.facilityValue,
    commodityValue: game.assetSummary.commodityValue,
    cashValue: game.assetSummary.cashValue,
    totalAssets: game.assetSummary.totalAssets,
    currentRank,
    previousRank,
    runningFacilities: game.facilityGroups.reduce(
      (sum, group) => sum + (group.status === 'running' ? group.participatingCount : 0),
      0,
    ),
    constructingFacilities: game.facilityConstruction ? 1 : 0,
    stoppedFacilities: game.facilityGroups.reduce(
      (sum, group) => sum + (group.status === 'stopped' ? group.count : 0),
      0,
    ),
    blockedFacilities: game.facilityGroups.reduce(
      (sum, group) => sum + (group.status === 'error' ? group.count : 0),
      0,
    ),
    inventoryUsed: game.warehouseStoredQuantity,
  };
}
