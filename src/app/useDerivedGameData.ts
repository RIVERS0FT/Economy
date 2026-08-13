import type { EconomyState } from '../types';
import { readGameAuthorityState } from './gameAuthorityStore';
import type { DerivedGameData } from './gameViewModel';

let cachedOrders: EconomyState['orders'] | undefined;
let cachedOwnOpenOrders: DerivedGameData['ownOpenOrders'] = [];
let cachedLeaderboard: EconomyState['leaderboard'] | undefined;
let cachedRanking: Pick<DerivedGameData, 'currentRank' | 'previousRank'> = {
  currentRank: undefined,
  previousRank: null,
};
let cachedFacilityGroups: EconomyState['facilityGroups'] | undefined;
let cachedFacilityCounts: Pick<
  DerivedGameData,
  'runningFacilities' | 'stoppedFacilities' | 'blockedFacilities'
> = {
  runningFacilities: 0,
  stoppedFacilities: 0,
  blockedFacilities: 0,
};
let cachedResultInputs: {
  assetSummary: EconomyState['assetSummary'];
  ownOpenOrders: DerivedGameData['ownOpenOrders'];
  ranking: Pick<DerivedGameData, 'currentRank' | 'previousRank'>;
  facilityCounts: Pick<DerivedGameData, 'runningFacilities' | 'stoppedFacilities' | 'blockedFacilities'>;
  constructingFacilities: number;
  inventoryUsed: number;
} | null = null;
let cachedResult: DerivedGameData | null = null;

export function deriveGameDataSnapshot(game: EconomyState | null): DerivedGameData | null {
  if (!game?.assetSummary) return null;

  const orders = game.orders;
  if (orders !== cachedOrders) {
    cachedOrders = orders;
    cachedOwnOpenOrders = orders?.filter(
      (order) => order.isOwn && ['open', 'partial'].includes(order.status),
    ) ?? [];
  }

  const leaderboard = game.leaderboard;
  if (leaderboard !== cachedLeaderboard) {
    cachedLeaderboard = leaderboard;
    const currentRank = leaderboard?.find((entry) => entry.isCurrentPlayer);
    const previousRank = currentRank
      ? leaderboard?.find((entry) => entry.rank === currentRank.rank - 1) ?? null
      : null;
    cachedRanking = { currentRank, previousRank };
  }

  const facilityGroups = game.facilityGroups;
  if (facilityGroups !== cachedFacilityGroups) {
    cachedFacilityGroups = facilityGroups;
    let runningFacilities = 0;
    let stoppedFacilities = 0;
    let blockedFacilities = 0;
    for (const group of facilityGroups ?? []) {
      if (group.status === 'running') runningFacilities += group.participatingCount;
      else if (group.status === 'stopped') stoppedFacilities += group.count;
      else if (group.status === 'error') blockedFacilities += group.count;
    }
    cachedFacilityCounts = { runningFacilities, stoppedFacilities, blockedFacilities };
  }

  const assetSummary = game.assetSummary;
  const inventoryUsed = game.warehouseStoredQuantity ?? 0;
  const constructingFacilities = game.facilityConstruction ? 1 : 0;
  const previousInputs = cachedResultInputs;
  if (
    previousInputs
    && previousInputs.assetSummary === assetSummary
    && previousInputs.ownOpenOrders === cachedOwnOpenOrders
    && previousInputs.ranking === cachedRanking
    && previousInputs.facilityCounts === cachedFacilityCounts
    && previousInputs.constructingFacilities === constructingFacilities
    && previousInputs.inventoryUsed === inventoryUsed
  ) return cachedResult;

  cachedResultInputs = {
    assetSummary,
    ownOpenOrders: cachedOwnOpenOrders,
    ranking: cachedRanking,
    facilityCounts: cachedFacilityCounts,
    constructingFacilities,
    inventoryUsed,
  };
  cachedResult = {
    ownOpenOrders: cachedOwnOpenOrders,
    facilityValue: assetSummary.facilityValue,
    commodityValue: assetSummary.commodityValue,
    cashValue: assetSummary.cashValue,
    totalAssets: assetSummary.totalAssets,
    currentRank: cachedRanking.currentRank,
    previousRank: cachedRanking.previousRank,
    runningFacilities: cachedFacilityCounts.runningFacilities,
    constructingFacilities,
    stoppedFacilities: cachedFacilityCounts.stoppedFacilities,
    blockedFacilities: cachedFacilityCounts.blockedFacilities,
    inventoryUsed,
  };
  return cachedResult;
}

function currentDerivedProperty(property: PropertyKey) {
  const derived = deriveGameDataSnapshot(readGameAuthorityState());
  return derived?.[property as keyof DerivedGameData];
}

const DERIVED_GAME_DATA_VIEW = new Proxy<Record<PropertyKey, unknown>>({}, {
  get: (_target, property) => currentDerivedProperty(property),
  ownKeys: () => Reflect.ownKeys(deriveGameDataSnapshot(readGameAuthorityState()) ?? {}),
  getOwnPropertyDescriptor: (_target, property) => {
    const derived = deriveGameDataSnapshot(readGameAuthorityState());
    if (!derived || !(property in derived)) return undefined;
    return {
      configurable: true,
      enumerable: true,
      writable: false,
      value: derived[property as keyof DerivedGameData],
    };
  },
  set: () => {
    throw new TypeError('派生游戏状态视图为只读');
  },
}) as unknown as DerivedGameData;

export function useDerivedGameData(game: EconomyState | null): DerivedGameData | null {
  return game ? DERIVED_GAME_DATA_VIEW : null;
}
