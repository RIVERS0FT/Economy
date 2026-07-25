import type { NavigationBadgeReadState } from './navigationBadges';

const MAX_SEEN_IDS = 400;

function storageKey(userId: number) {
  return `economy:navigation-badges:v1:${userId}`;
}

function normalizeIds(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    .slice(-MAX_SEEN_IDS)
    .sort();
}

function normalizeState(value: unknown, fallback: NavigationBadgeReadState): NavigationBadgeReadState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...fallback };
  const source = value as Partial<NavigationBadgeReadState>;
  return {
    seenAuctionIds: normalizeIds(source.seenAuctionIds, fallback.seenAuctionIds),
    seenContractIds: normalizeIds(source.seenContractIds, fallback.seenContractIds),
    seenLeaderboardPeriodKey: typeof source.seenLeaderboardPeriodKey === 'string'
      ? source.seenLeaderboardPeriodKey
      : fallback.seenLeaderboardPeriodKey,
  };
}

export function loadNavigationBadgeReadState(
  userId: number,
  fallback: NavigationBadgeReadState,
): NavigationBadgeReadState {
  if (typeof window === 'undefined') return { ...fallback };
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? normalizeState(JSON.parse(raw), fallback) : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

export function saveNavigationBadgeReadState(userId: number, state: NavigationBadgeReadState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Navigation badges are optional browser state; quota and privacy failures must not break the game shell.
  }
}

export function navigationBadgeReadStateEqual(
  left: NavigationBadgeReadState,
  right: NavigationBadgeReadState,
) {
  return left.seenLeaderboardPeriodKey === right.seenLeaderboardPeriodKey
    && left.seenAuctionIds.length === right.seenAuctionIds.length
    && left.seenContractIds.length === right.seenContractIds.length
    && left.seenAuctionIds.every((id, index) => id === right.seenAuctionIds[index])
    && left.seenContractIds.every((id, index) => id === right.seenContractIds[index]);
}
