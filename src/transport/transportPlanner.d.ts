import type { EconomyState, TransportShipment } from '../types';

export type TransportWaitingReason = 'ready' | 'no-inventory' | 'quotes-not-ready'
  | 'price-boundary' | 'insufficient-profit' | 'insufficient-funds'
  | 'in-transit-limit' | 'invalid-route';
export const TRANSPORT_WAITING_LABELS: Readonly<Record<TransportWaitingReason, string>>;
export interface TransportCargoEntry { productId: string; quantity: number }
export interface TransportCycleEstimate {
  reason: TransportWaitingReason;
  firstLoad: TransportCargoEntry[];
  grossGain: number | null;
  netGain: number | null;
  transportedQuantity: number;
  peakLoad: number;
  threshold: number;
}
export interface TransportCyclePlanningInput {
  game: EconomyState;
  traversal: readonly string[];
  capacity: number;
  cycleCost: number;
  durationMs: number;
  now: number;
  atInTransitLimit?: boolean;
}
export function transportOfficialQuote(game: EconomyState, provinceId: string, productId: string, now: number): { price: number; nextPriceAt: number } | null;
export function planTransportCycle(input: TransportCyclePlanningInput): TransportCycleEstimate;
export function planTransportNode(input: {
  game: EconomyState;
  traversal: readonly string[];
  shipment: TransportShipment;
  capacity: number;
  now: number;
}): { visitIndex: number; unload: TransportCargoEntry[]; load: TransportCargoEntry[] };
export function transportOperationFingerprint(game: EconomyState, traversal: readonly string[], shipment: TransportShipment | null, inTransitCount: number): string;
