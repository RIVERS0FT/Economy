export const TRANSPORT_FUEL_UNIT_PRICE: number;
export const TRANSPORT_BASE_SECONDS_PER_KM: number;

export interface TransportModePolicyDefinition {
  readonly id: 'road' | 'rail' | 'air';
  readonly name: string;
  readonly setupFixedCost: number;
  readonly setupCostPerKm: number;
  readonly transportFeePerKm: number;
  readonly fuelPerKm: number;
  readonly capacity: number;
  readonly timeFactor: number;
}

export const TRANSPORT_MODE_POLICY: Readonly<Record<'road' | 'rail' | 'air', TransportModePolicyDefinition>>;
