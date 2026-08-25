import { createContext, useContext, type ReactNode } from 'react';
import type { PlayerPageLocation } from '../../navigation/playerPageStack';

export interface PlayerPageNavigationValue {
  canGoBack: boolean;
  currentLocation: PlayerPageLocation;
  onBack: () => void;
  onClose: () => void;
  pushPage: (location: PlayerPageLocation) => void;
  replacePage: (location: PlayerPageLocation) => void;
}

const PlayerPageNavigationContext = createContext<PlayerPageNavigationValue | null>(null);

export function PlayerPageNavigationProvider({
  value,
  children,
}: {
  value: PlayerPageNavigationValue;
  children: ReactNode;
}) {
  return (
    <PlayerPageNavigationContext.Provider value={value}>
      {children}
    </PlayerPageNavigationContext.Provider>
  );
}

export function usePlayerPageNavigation() {
  return useContext(PlayerPageNavigationContext);
}
