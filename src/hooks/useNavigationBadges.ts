import { useEffect, useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  buildNavigationBadges,
  createNavigationBadgeBaseline,
  markNavigationBadgeTabRead,
  navigationBadgeStorageKey,
  normalizeNavigationBadgeReadState,
  type NavigationBadgeReadState,
} from '../navigation/navigationBadges';

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

  return useMemo(() => (
    buildNavigationBadges(model.game, effectiveReadState)
  ), [effectiveReadState, model.game]);
}
