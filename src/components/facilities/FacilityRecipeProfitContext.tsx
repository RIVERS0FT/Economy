import { createContext, useContext, type ReactNode } from 'react';
import type { AssetOrder } from '../../types';

const FacilityRecipeProfitOrdersContext = createContext<AssetOrder[]>([]);

export function FacilityRecipeProfitOrdersProvider({
  orders,
  children,
}: {
  orders: AssetOrder[];
  children: ReactNode;
}) {
  return (
    <FacilityRecipeProfitOrdersContext.Provider value={orders}>
      {children}
    </FacilityRecipeProfitOrdersContext.Provider>
  );
}

export function useFacilityRecipeProfitOrders() {
  return useContext(FacilityRecipeProfitOrdersContext);
}
