import type { LoadedGameViewModel } from '../app/gameViewModel';
import { getAuctionState } from '../auctions/types';
import type { TabId } from '../config/navigation';
import { productionContractStateFromGame } from '../contracts/types';
import { leaderboardsFromGame } from '../leaderboardTypes';

export const MAX_NAVIGATION_BADGE_COUNT = 99;

export interface NavigationBadge {
  count: number;
  accessibleLabel: string;
  title: string;
}

export type NavigationBadgeMap = Partial<Record<TabId, NavigationBadge>>;

export interface NavigationBadgeReadState {
  seenAuctionIds: string[];
  seenContractIds: string[];
  seenLeaderboardPeriodKey: string;
}

export interface NavigationBadgeSnapshot {
  badges: NavigationBadgeMap;
  currentAuctionIds: string[];
  currentContractIds: string[];
  currentLeaderboardPeriodKey: string;
}

function sortedUnique(values: Iterable<string>) {
  return [...new Set(values)].sort();
}

function currentLeaderboardPeriodKey(model: LoadedGameViewModel) {
  const key = leaderboardsFromGame(model.game)?.period.key;
  return typeof key === 'string' ? key : '';
}

function navigationBadgeCandidates(model: LoadedGameViewModel) {
  const { assetAuctions } = getAuctionState(model.game);
  const { productionContracts } = productionContractStateFromGame(model.game);

  const currentAuctionIds = sortedUnique(assetAuctions
    .filter((auction) => auction.status === 'open' && !auction.isSeller)
    .map((auction) => auction.id));

  const currentContractIds = sortedUnique(productionContracts
    .filter((contract) => (
      (contract.status === 'open' && !contract.isPublisher)
      || (contract.status === 'active' && (contract.isBuyer || contract.isSupplier))
    ))
    .map((contract) => contract.id));

  return {
    assetAuctions,
    productionContracts,
    currentAuctionIds,
    currentContractIds,
    currentLeaderboardPeriodKey: currentLeaderboardPeriodKey(model),
  };
}

export function buildNavigationBadgeBaseline(model: LoadedGameViewModel): NavigationBadgeReadState {
  const candidates = navigationBadgeCandidates(model);
  return {
    seenAuctionIds: candidates.currentAuctionIds,
    seenContractIds: candidates.currentContractIds,
    seenLeaderboardPeriodKey: candidates.currentLeaderboardPeriodKey,
  };
}

function countBadge(count: number, accessibleLabel: string, title = accessibleLabel): NavigationBadge | null {
  const normalized = Math.max(0, Math.floor(Number(count) || 0));
  return normalized > 0 ? { count: normalized, accessibleLabel, title } : null;
}

export function formatNavigationBadgeCount(count: number) {
  const normalized = Math.max(0, Math.floor(Number(count) || 0));
  return normalized > MAX_NAVIGATION_BADGE_COUNT
    ? `${MAX_NAVIGATION_BADGE_COUNT}+`
    : String(normalized);
}

export function buildNavigationBadges(
  model: LoadedGameViewModel,
  readState: NavigationBadgeReadState,
): NavigationBadgeSnapshot {
  const candidates = navigationBadgeCandidates(model);
  const badges: NavigationBadgeMap = {};

  const marketCount = model.derived.ownOpenOrders.length;
  const marketBadge = countBadge(marketCount, `${marketCount} 笔未完成订单`);
  if (marketBadge) badges.market = marketBadge;

  const productionIssueIds = new Set(model.game.facilityGroups
    .filter((group) => group.status === 'error')
    .map((group) => `facility:${group.facilityTypeId}`));
  const warehouseWarningThreshold = Math.max(25, Math.ceil(model.game.inventoryCapacity * 0.1));
  if (model.game.warehouseAvailableCapacity <= warehouseWarningThreshold) {
    productionIssueIds.add('warehouse-capacity');
  }
  const productionCount = productionIssueIds.size;
  const productionBadge = countBadge(productionCount, `${productionCount} 个需要处理的生产问题`);
  if (productionBadge) badges.production = productionBadge;

  const seenAuctionIds = new Set(readState.seenAuctionIds);
  const unreadAuctionIds = model.tab === 'auction'
    ? []
    : candidates.currentAuctionIds.filter((id) => !seenAuctionIds.has(id));
  const outbidAuctionIds = candidates.assetAuctions
    .filter((auction) => (
      auction.status === 'open'
      && !auction.isHighestBidder
      && auction.bids.some((bid) => Number(bid.bidderId) === Number(model.user.id))
    ))
    .map((auction) => auction.id);
  const auctionAttentionIds = new Set([...unreadAuctionIds, ...outbidAuctionIds]);
  const auctionCount = auctionAttentionIds.size;
  const auctionBadge = countBadge(
    auctionCount,
    `${auctionCount} 个需要关注的拍卖，其中 ${unreadAuctionIds.length} 个新拍卖，${outbidAuctionIds.length} 个被超价`,
  );
  if (auctionBadge) badges.auction = auctionBadge;

  const seenContractIds = new Set(readState.seenContractIds);
  const unreadContractIds = model.tab === 'contracts'
    ? []
    : candidates.currentContractIds.filter((id) => !seenContractIds.has(id));
  const attentionContractIds = candidates.productionContracts
    .filter((contract) => (
      contract.status === 'active'
      && (contract.isBuyer || contract.isSupplier)
      && Boolean(contract.issue)
    ))
    .map((contract) => contract.id);
  const contractAttentionIds = new Set([...unreadContractIds, ...attentionContractIds]);
  const contractCount = contractAttentionIds.size;
  const contractBadge = countBadge(
    contractCount,
    `${contractCount} 个需要关注的合同，其中 ${unreadContractIds.length} 个新合同，${attentionContractIds.length} 个需要处理`,
  );
  if (contractBadge) badges.contracts = contractBadge;

  const hasUnreadLeaderboardSettlement = model.tab !== 'leaderboard'
    && Boolean(candidates.currentLeaderboardPeriodKey)
    && Boolean(readState.seenLeaderboardPeriodKey)
    && candidates.currentLeaderboardPeriodKey !== readState.seenLeaderboardPeriodKey;
  if (hasUnreadLeaderboardSettlement) {
    badges.leaderboard = {
      count: 1,
      accessibleLabel: '1 次新的排行榜结算结果',
      title: '排行榜本期结算已经完成',
    };
  }

  return {
    badges,
    currentAuctionIds: candidates.currentAuctionIds,
    currentContractIds: candidates.currentContractIds,
    currentLeaderboardPeriodKey: candidates.currentLeaderboardPeriodKey,
  };
}
