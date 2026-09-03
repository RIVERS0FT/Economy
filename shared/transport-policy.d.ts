/** Shared transport constants consumed by both authoritative server logic and client previews. */
export const TRANSPORT_FUEL_UNIT_PRICE: number;
export const TRANSPORT_BASE_SECONDS_PER_KM: number;

export interface TransportModePolicyDefinition {
  readonly id: 'road' | 'rail' | 'air';
  readonly name: string;
  readonly setupFixedCost: number;
  readonly setupCostPerKm: number;
  /** Distance-only operating fee for one complete cycle; cargo quantity never changes it. */
  readonly transportFeePerKm: number;
  /** Distance-only fuel consumption; fuel is purchased for the complete cycle at the origin. */
  readonly fuelPerKm: number;
  readonly capacity: number;
  readonly timeFactor: number;
}

export const TRANSPORT_MODE_POLICY: Readonly<Record<'road' | 'rail' | 'air', TransportModePolicyDefinition>>;
