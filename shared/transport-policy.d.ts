/** Shared transport constants consumed by the authoritative server and previews. */
export const TRANSPORT_FUEL_UNIT_PRICE: number;
export const TRANSPORT_FUEL_PRODUCT_ID: 'industrial-fuel';
export const TRANSPORT_BASE_SECONDS_PER_KM: number;
export const TRANSPORT_POLICY_VERSION: number;
export const TRANSPORT_MIN_NET_GAIN: number;
export const TRANSPORT_COST_MARGIN: number;

export interface TransportModePolicyDefinition {
  readonly id: 'road' | 'rail' | 'air';
  readonly name: string;
  readonly setupFixedCost: number;
  readonly setupCostPerKm: number;
  readonly transportFeePerKm: number;
  readonly fuelPerKm: number;
  readonly capacity: number;
  readonly timeFactor: number;
  readonly departureSeconds: number;
}

export interface TransportCyclePolicy {
  readonly version: number;
  readonly capacity: number;
  readonly transportFeePerKm: number;
  readonly fuelPerKm: number;
  readonly fuelUnitPrice: number;
  readonly fuelProductId?: 'industrial-fuel';
  readonly secondsPerKm: number;
  readonly departureSeconds: number;
}

export const TRANSPORT_MODE_POLICY: Readonly<Record<'road' | 'rail' | 'air', TransportModePolicyDefinition>>;
export function createTransportCyclePolicy(mode: 'road' | 'rail' | 'air'): TransportCyclePolicy;
export function legacyTransportCyclePolicy(mode: 'road' | 'rail' | 'air'): TransportCyclePolicy;
export function isTransportCyclePolicy(policy: unknown): policy is TransportCyclePolicy;
export function transportCyclePolicyForShipment(shipment: { mode: 'road' | 'rail' | 'air'; policySnapshot?: TransportCyclePolicy }): TransportCyclePolicy;
export function transportPolicyDurationMs(policy: TransportCyclePolicy, distanceKm: number): number;

export function transportFuelQuantity(distanceKm: number, fuelPerKm: number): number;
