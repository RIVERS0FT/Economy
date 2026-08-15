import { createContext, useContext, type ReactNode } from 'react';

interface PlayerPageNavigationValue {
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
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
