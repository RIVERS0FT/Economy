import type { TabId } from '../config/navigation';
import type { EconomyState } from '../types';

export const MAX_NAVIGATION_BADGE_COUNT = 99;
export const NAVIGATION_BADGE_STORAGE_VERSION = 1;

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

interface NavigationAuction {
  id: string;
  status: 'open' | 'sold' | 'ended' | 'cancelled';
  isSeller: boolean;
  isHighestBidder: boolean;
  bids?: Array<{ bidderId: number }>;
}

interface NavigationContract {
  id: string;
  status: 'open' | 'active' | 'completed' | 'cancelled' | 'terminated' | 'expired';
  issue: string | null;
  isPublisher: boolean;
  isBuyer: boolean;
  isSupplier: boolean;
}

interface NavigationLeaderboardState {
  period?: { key?: string };
}

type EconomyStateWithNavigationSources = EconomyState & {
  assetAuctions?: NavigationAuction[];
  productionContracts?: NavigationContract[];
  stats: EconomyState['stats'] & {
    leaderboards?: NavigationLeaderboardState;
  };
};

function normalizedUniqueIds(values: Iterable<unknown>) {
  return [...new Set([...values]
    .map((value) => String(value || ''))
    .filter(Boolean))]
    .sort();
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function auctionsFromGame(game: EconomyState) {
  const source = (game as EconomyStateWithNavigationSources).assetAuctions;
  return Array.isArray(source) ? source : [];
}

function contractsFromGame(game: EconomyState) {
  const source = (game as EconomyStateWithNavigationSources).productionContracts;
  return Array.isArray(source) ? source : [];
}

function leaderboardPeriodKey(game: EconomyState) {
  const key = (game as EconomyStateWithNavigationSources).stats?.leaderboards?.period?.key;
  return typeof key === 'string' ? key : '';
}

function unreadAuctionCandidateIds(game: EconomyState) {
  return normalizedUniqueIds(auctionsFromGame(game)
    .filter((auction) => auction.status === 'open' && !auction.isSeller)
    .map((auction) => auction.id));
}

function unreadContractCandidateIds(game: EconomyState) {
  return normalizedUniqueIds(contractsFromGame(game)
    .filter((contract) => (
      (contract.status === 'open' && !contract.isPublisher)
      || (contract.status === 'active' && (contract.isBuyer || contract.isSupplier))
    ))
    .map((contract) => contract.id));
}

function outbidAuctionIds(game: EconomyState) {
  return normalizedUniqueIds(auctionsFromGame(game)
    .filter((auction) => (
      auction.status === 'open'
      && !auction.isHighestBidder
      && auction.bids?.some((bid) => Number(bid.bidderId) === Number(game.userId))
    ))
    .map((auction) => auction.id));
}

function attentionContractIds(game: EconomyState) {
  return normalizedUniqueIds(contractsFromGame(game)
    .filter((contract) => (
      contract.status === 'active'
      && (contract.isBuyer || contract.isSupplier)
      && Boolean(contract.issue)
    ))
    .map((contract) => contract.id));
}

function unionIds(...collections: Iterable<string>[]) {
  return normalizedUniqueIds(collections.flatMap((collection) => [...collection]));
}

function badge(count: number, label: string, title = label): NavigationBadge | undefined {
  const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));
  return normalizedCount > 0 ? { count: normalizedCount, accessibleLabel: label, title } : undefined;
}

function sourceSummary(parts: Array<[number, string]>) {
  return parts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} 个${label}`)
    .join('，');
}

export function formatNavigationBadgeCount(count: number) {
  const normalized = Math.max(0, Math.floor(Number(count) || 0));
  return normalized > MAX_NAVIGATION_BADGE_COUNT
    ? `${MAX_NAVIGATION_BADGE_COUNT}+`
    : String(normalized);
}

export function createNavigationBadgeBaseline(game: EconomyState): NavigationBadgeReadState {
  return {
    seenAuctionIds: unreadAuctionCandidateIds(game),
    seenContractIds: unreadContractCandidateIds(game),
    seenLeaderboardPeriodKey: leaderboardPeriodKey(game),
  };
}

export function normalizeNavigationBadgeReadState(
  value: unknown,
  game: EconomyState,
): NavigationBadgeReadState {
  const baseline = createNavigationBadgeBaseline(game);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return baseline;
  const record = value as Partial<NavigationBadgeReadState>;
  return {
    seenAuctionIds: Array.isArray(record.seenAuctionIds)
      ? normalizedUniqueIds(record.seenAuctionIds)
      : baseline.seenAuctionIds,
    seenContractIds: Array.isArray(record.seenContractIds)
      ? normalizedUniqueIds(record.seenContractIds)
      : baseline.seenContractIds,
    seenLeaderboardPeriodKey: typeof record.seenLeaderboardPeriodKey === 'string'
      ? record.seenLeaderboardPeriodKey
      : baseline.seenLeaderboardPeriodKey,
  };
}

export function navigationBadgeStorageKey(userId: number) {
  return `economy:navigation-badges:v${NAVIGATION_BADGE_STORAGE_VERSION}:${userId}`;
}

export function markNavigationBadgeTabRead(
  current: NavigationBadgeReadState,
  tab: TabId,
  game: EconomyState,
) {
  if (tab === 'auction') {
    const seenAuctionIds = unreadAuctionCandidateIds(game);
    return sameIds(current.seenAuctionIds, seenAuctionIds)
      ? current
      : { ...current, seenAuctionIds };
  }
  if (tab === 'contracts') {
    const seenContractIds = unreadContractCandidateIds(game);
    return sameIds(current.seenContractIds, seenContractIds)
      ? current
      : { ...current, seenContractIds };
  }
  if (tab === 'leaderboard') {
    const seenLeaderboardPeriodKey = leaderboardPeriodKey(game);
    return current.seenLeaderboardPeriodKey === seenLeaderboardPeriodKey
      ? current
      : { ...current, seenLeaderboardPeriodKey };
  }
  return current;
}

export function buildNavigationBadges(
  game: EconomyState,
  readState: NavigationBadgeReadState,
): NavigationBadgeMap {
  const result: NavigationBadgeMap = {};

  const marketCount = game.orders.filter((order) => (
    order.isOwn && (order.status === 'open' || order.status === 'partial')
  )).length;
  result.market = badge(marketCount, `${marketCount} 笔未完成订单`);

  const productionIssueIds = game.facilityGroups
    .filter((group) => group.status === 'error')
    .map((group) => `facility:${group.facilityTypeId}`);
  const lowCapacityThreshold = Math.max(25, Math.ceil(game.inventoryCapacity * 0.1));
  if (game.warehouseAvailableCapacity <= lowCapacityThreshold) {
    productionIssueIds.push('warehouse-capacity');
  }
  const productionCount = new Set(productionIssueIds).size;
  result.production = badge(productionCount, `${productionCount} 项生产问题需要处理`);

  const seenAuctions = new Set(readState.seenAuctionIds);
  const unreadAuctionIds = unreadAuctionCandidateIds(game)
    .filter((id) => !seenAuctions.has(id));
  const outbidIds = outbidAuctionIds(game);
  const auctionAttentionIds = unionIds(unreadAuctionIds, outbidIds);
  const auctionCount = auctionAttentionIds.length;
  const auctionSources = sourceSummary([
    [unreadAuctionIds.length, '新拍卖'],
    [outbidIds.length, '被超价拍卖'],
  ]);
  result.auction = badge(
    auctionCount,
    `${auctionCount} 个需要关注的拍卖`,
    `${auctionCount} 个需要关注的拍卖${auctionSources ? `：${auctionSources}` : ''}`,
  );

  const seenContracts = new Set(readState.seenContractIds);
  const unreadContractIds = unreadContractCandidateIds(game)
    .filter((id) => !seenContracts.has(id));
  const contractAttentionIds = attentionContractIds(game);
  const combinedContractIds = unionIds(unreadContractIds, contractAttentionIds);
  const contractCount = combinedContractIds.length;
  const contractSources = sourceSummary([
    [unreadContractIds.length, '新合同'],
    [contractAttentionIds.length, '需要处理的合同'],
  ]);
  result.contracts = badge(
    contractCount,
    `${contractCount} 个需要关注的合同`,
    `${contractCount} 个需要关注的合同${contractSources ? `：${contractSources}` : ''}`,
  );

  const currentPeriodKey = leaderboardPeriodKey(game);
  const hasUnseenSettlement = Boolean(
    currentPeriodKey
      && readState.seenLeaderboardPeriodKey
      && currentPeriodKey !== readState.seenLeaderboardPeriodKey,
  );
  result.leaderboard = hasUnseenSettlement
    ? { count: 1, accessibleLabel: '本期排名已经结算', title: '本期排名已经结算' }
    : undefined;

  return result;
}
