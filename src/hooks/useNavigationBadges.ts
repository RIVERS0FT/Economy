import { useEffect, useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  buildNavigationBadgeBaseline,
  buildNavigationBadges,
  type NavigationBadgeReadState,
} from '../navigation/navigationBadges';
import {
  loadNavigationBadgeReadState,
  navigationBadgeReadStateEqual,
  saveNavigationBadgeReadState,
} from '../navigation/navigationBadgeReadState';

export function useNavigationBadges(model: LoadedGameViewModel) {
  const baseline = useMemo(() => buildNavigationBadgeBaseline(model), [model]);
  const [readState, setReadState] = useState<NavigationBadgeReadState>(() => (
    loadNavigationBadgeReadState(model.user.id, baseline)
  ));

  useEffect(() => {
    saveNavigationBadgeReadState(model.user.id, readState);
  }, [model.user.id, readState]);

  const snapshot = useMemo(() => buildNavigationBadges(model, readState), [model, readState]);
  const auctionIdsKey = snapshot.currentAuctionIds.join('\u0000');
  const contractIdsKey = snapshot.currentContractIds.join('\u0000');

  useEffect(() => {
    if (!['auction', 'contracts', 'leaderboard'].includes(model.tab)) return;
    setReadState((current) => {
      const next: NavigationBadgeReadState = {
        seenAuctionIds: model.tab === 'auction' ? snapshot.currentAuctionIds : current.seenAuctionIds,
        seenContractIds: model.tab === 'contracts' ? snapshot.currentContractIds : current.seenContractIds,
        seenLeaderboardPeriodKey: model.tab === 'leaderboard'
          ? snapshot.currentLeaderboardPeriodKey
          : current.seenLeaderboardPeriodKey,
      };
      return navigationBadgeReadStateEqual(current, next) ? current : next;
    });
  }, [auctionIdsKey, contractIdsKey, model.tab, snapshot.currentLeaderboardPeriodKey]);

  return snapshot.badges;
}
