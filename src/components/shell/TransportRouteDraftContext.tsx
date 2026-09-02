import { createContext, useContext } from 'react';
import type { TransportModeId, TransportTripType } from '../../types';

export interface TransportRouteDraft {
  routeId: string | null;
  sourceProvinceId: string;
  destinationProvinceId: string;
  viaProvinceIds: string[];
  tripType: TransportTripType;
  mode: TransportModeId;
}

export interface TransportRouteDraftContextValue {
  draft: TransportRouteDraft | null;
  setDraft: (draft: TransportRouteDraft | null) => void;
  updateDraft: (patch: Partial<TransportRouteDraft>) => void;
  closeDraft: () => void;
  picking: boolean;
  beginPicking: () => void;
  finishPicking: () => void;
  cancelPicking: () => void;
  pickProvince: (provinceId: string) => void;
  closeLoop: () => void;
  resetStops: () => void;
  highlightedRouteId: string | null;
  setHighlightedRouteId: (routeId: string | null) => void;
}

export const TransportRouteDraftContext = createContext<TransportRouteDraftContextValue | null>(null);

export function useTransportRouteDraft() {
  const value = useContext(TransportRouteDraftContext);
  if (!value) throw new Error('TRANSPORT_ROUTE_DRAFT_CONTEXT_REQUIRED');
  return value;
}
