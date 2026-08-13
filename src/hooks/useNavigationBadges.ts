import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useGameAuthorityDependencies } from '../app/gameAuthorityStore';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import type { EconomyState } from '../types';
import {
  buildNavigationBadges,
  createNavigationBadgeBaseline,
  getUnreadAuctionIds,
  markNavigationBadgeTabRead,
  navigationBadgeStorageKey,
  normalizeNavigationBadgeReadState,
  type NavigationBadgeReadState,
} from '../navigation/navigationBadges';

export const AuctionNewIdsContext = createContext<ReadonlySet<string>>(new Set());

export function useAuctionNewIds() {
  return useContext(AuctionNewIdsContext);
}

function loadReadState(model: LoadedGameViewModel, game: EconomyState): NavigationBadgeReadState {
  const baseline = createNavigationBadgeBaseline(game);
  if (typeof window === 'undefined') return baseline;
  try {
    const raw = window.localStorage.getItem(navigationBadgeStorageKey(model.user.id));
    return raw ? normalizeNavigationBadgeReadState(JSON.parse(raw), game) : baseline;
  } catch {
    return baseline;
  }
}

export function useNavigationBadges(model: LoadedGameViewModel) {
  const authorityGame = useGameAuthorityDependencies([
    'player.production',
    'market.orders',
    'auction',
    'contract',
    'leaderboard',
  ]);
  const game = authorityGame ?? model.game;
  const storageKey = navigationBadgeStorageKey(model.user.id);
  const [readState, setReadState] = useState<NavigationBadgeReadState>(() => loadReadState(model, game));
  const [auctionVisitUnreadIds, setAuctionVisitUnreadIds] = useState<string[]>([]);

  const currentUnreadAuctionIds = useMemo(() => (
    getUnreadAuctionIds(game, readState)
  ), [game, readState]);

  useEffect(() => {
    if (model.tab !== 'auction') {
      setAuctionVisitUnreadIds((current) => current.length === 0 ? current : []);
      return;
    }
    if (currentUnreadAuctionIds.length === 0) return;
    setAuctionVisitUnreadIds((current) => (
      [...new Set([...current, ...currentUnreadAuctionIds])].sort()
    ));
  }, [currentUnreadAuctionIds, model.tab]);

  const effectiveReadState = useMemo(() => (
    markNavigationBadgeTabRead(readState, model.tab, game)
  ), [game, model.tab, readState]);

  useEffect(() => {
    if (effectiveReadState !== readState) setReadState(effectiveReadState);
  }, [effectiveReadState, readState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(readState));
    } catch {
      // Navigation read state is optional; storage failures must not block gameplay.
    }
  }, [readState, storageKey]);

  const badges = useMemo(() => (
    buildNavigationBadges(game, effectiveReadState)
  ), [effectiveReadState, game]);

  return { badges, auctionNewIds: auctionVisitUnreadIds };
}
