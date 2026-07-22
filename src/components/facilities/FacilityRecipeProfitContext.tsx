import { createContext, useContext, type ReactNode } from 'react';
import type { ProductMarketState } from '../../types';

const FacilityRecipeProfitMarketsContext = createContext<Record<string, ProductMarketState>>({});

export function FacilityRecipeProfitMarketsProvider({
  markets,
  children,
}: {
  markets: Record<string, ProductMarketState>;
  children: ReactNode;
}) {
  return (
    <FacilityRecipeProfitMarketsContext.Provider value={markets}>
      {children}
    </FacilityRecipeProfitMarketsContext.Provider>
  );
}

export function useFacilityRecipeProfitMarkets() {
  return useContext(FacilityRecipeProfitMarketsContext);
}
