import { createContext, useContext } from 'react';
import type { PresentedEconomicEvent } from '../../economic-events/presentation';

export interface EconomicEventContextValue {
  events: PresentedEconomicEvent[];
  referenceNow: number;
  openEvent: (id: string) => void;
}
export const EconomicEventContext = createContext<EconomicEventContextValue | null>(null);
export function useEconomicEvents() {
  return useContext(EconomicEventContext);
}
