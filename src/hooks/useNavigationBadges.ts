import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
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

function loadReadState(model: LoadedGameViewModel): NavigationBadgeReadState {
  const baseline = createNavigationBadgeBaseline(model.game);
  if (typeof window === 'undefined') return baseline;
  try {
    const raw = window.localStorage.getItem(navigationBadgeStorageKey(model.user.id));
    return raw ? normalizeNavigationBadgeReadState(JSON.parse(raw), model.game) : baseline;
  } catch {
    return baseline;
  }
}

export function useNavigationBadges(model: LoadedGameViewModel) {
  const storageKey = navigationBadgeStorageKey(model.user.id);
  const [readState, setReadState] = useState<NavigationBadgeReadState>(() => loadReadState(model));
  const [auctionVisitUnreadIds, setAuctionVisitUnreadIds] = useState<string[]>([]);

  const currentUnreadAuctionIds = useMemo(() => (
    getUnreadAuctionIds(model.game, readState)
  ), [model.game, readState]);

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
    markNavigationBadgeTabRead(readState, model.tab, model.game)
  ), [model.game, model.tab, readState]);

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
    buildNavigationBadges(model.game, effectiveReadState)
  ), [effectiveReadState, model.game]);

  return { badges, auctionNewIds: auctionVisitUnreadIds };
}
