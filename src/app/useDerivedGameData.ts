import { useMemo } from 'react';
import type { EconomyState } from '../types';
import type { DerivedGameData } from './gameViewModel';

export function useDerivedGameData(game: EconomyState | null): DerivedGameData | null {
  const hasGame = game !== null;
  const orders = game?.orders;
  const leaderboard = game?.leaderboard;
  const facilityGroups = game?.facilityGroups;
  const assetSummary = game?.assetSummary;
  const inventoryUsed = game?.warehouseStoredQuantity ?? 0;
  const constructingFacilities = game?.facilityConstruction ? 1 : 0;

  const ownOpenOrders = useMemo(() => (
    orders?.filter((order) => order.isOwn && ['open', 'partial'].includes(order.status)) ?? []
  ), [orders]);

  const ranking = useMemo(() => {
    const currentRank = leaderboard?.find((entry) => entry.isCurrentPlayer);
    const previousRank = currentRank
      ? leaderboard?.find((entry) => entry.rank === currentRank.rank - 1) ?? null
      : null;
    return { currentRank, previousRank };
  }, [leaderboard]);

  const facilityCounts = useMemo(() => {
    let runningFacilities = 0;
    let stoppedFacilities = 0;
    let blockedFacilities = 0;
    for (const group of facilityGroups ?? []) {
      if (group.status === 'running') runningFacilities += group.participatingCount;
      else if (group.status === 'stopped') stoppedFacilities += group.count;
      else if (group.status === 'error') blockedFacilities += group.count;
    }
    return { runningFacilities, stoppedFacilities, blockedFacilities };
  }, [facilityGroups]);

  return useMemo(() => {
    if (!hasGame || !assetSummary) return null;
    return {
      ownOpenOrders,
      facilityValue: assetSummary.facilityValue,
      commodityValue: assetSummary.commodityValue,
      cashValue: assetSummary.cashValue,
      totalAssets: assetSummary.totalAssets,
      currentRank: ranking.currentRank,
      previousRank: ranking.previousRank,
      runningFacilities: facilityCounts.runningFacilities,
      constructingFacilities,
      stoppedFacilities: facilityCounts.stoppedFacilities,
      blockedFacilities: facilityCounts.blockedFacilities,
      inventoryUsed,
    };
  }, [
    assetSummary,
    constructingFacilities,
    facilityCounts,
    hasGame,
    inventoryUsed,
    ownOpenOrders,
    ranking,
  ]);
}
