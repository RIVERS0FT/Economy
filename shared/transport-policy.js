// Retained only for legacy cash-fuel snapshots. New trips consume inventory.
export const TRANSPORT_FUEL_UNIT_PRICE = 1;
export const TRANSPORT_FUEL_PRODUCT_ID = 'industrial-fuel';
export const TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000;
export const TRANSPORT_POLICY_VERSION = 4;
export const TRANSPORT_MAX_VEHICLES_PER_ROUTE = 100;
export const TRANSPORT_MIN_NET_GAIN = 1;
export const TRANSPORT_COST_MARGIN = 0.2;

export const TRANSPORT_MODE_POLICY = Object.freeze({
  road: Object.freeze({
    id: 'road',
    vehicleName: '卡车',
    vehicleUnit: '辆',
    vehiclePurchaseCost: 80,
    name: '公路运输',
    setupFixedCost: 80,
    setupCostPerKm: 0.02,
    transportFeePerKm: 0.015,
    fuelPerKm: 0.005,
    capacity: 200,
    timeFactor: 1.0,
    departureSeconds: 10,
  }),
  rail: Object.freeze({
    id: 'rail',
    vehicleName: '火车',
    vehicleUnit: '列',
    vehiclePurchaseCost: 1200,
    name: '铁路运输',
    setupFixedCost: 1200,
    setupCostPerKm: 0.10,
    transportFeePerKm: 0.02,
    fuelPerKm: 0.01,
    capacity: 2000,
    timeFactor: 1.5,
    departureSeconds: 45,
  }),
  air: Object.freeze({
    id: 'air',
    vehicleName: '飞机',
    vehicleUnit: '架',
    vehiclePurchaseCost: 2400,
    name: '航空运输',
    setupFixedCost: 2400,
    setupCostPerKm: 0.08,
    transportFeePerKm: 0.22,
    fuelPerKm: 0.08,
    capacity: 500,
    timeFactor: 0.25,
    departureSeconds: 15,
  }),
});

// These constants are only for cycles that predate policy snapshots. Never use
// them for a new route or cycle, and never infer a paid cycle from today's fees.
const LEGACY_CYCLE_POLICIES = Object.freeze({
  road: Object.freeze({ version: 1, capacity: 100, transportFeePerKm: 0.02, fuelPerKm: 0.01, fuelUnitPrice: 1, secondsPerKm: 0.06, departureSeconds: 0 }),
  rail: Object.freeze({ version: 1, capacity: 2000, transportFeePerKm: 0.17, fuelPerKm: 0.08, fuelUnitPrice: 1, secondsPerKm: 0.12, departureSeconds: 0 }),
  air: Object.freeze({ version: 1, capacity: 500, transportFeePerKm: 0.27, fuelPerKm: 0.13, fuelUnitPrice: 1, secondsPerKm: 0.015, departureSeconds: 0 }),
});

export function isTransportVehicleCount(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= TRANSPORT_MAX_VEHICLES_PER_ROUTE;
}

/** Missing fleet metadata is a legacy single vehicle, not free capacity. */
export function transportRouteVehicleCount(route) {
  return isTransportVehicleCount(route?.vehicleCount) ? route.vehicleCount : 1;
}

export function createTransportCyclePolicy(mode, vehicleCount = 1) {
  const definition = Object.hasOwn(TRANSPORT_MODE_POLICY, mode) ? TRANSPORT_MODE_POLICY[mode] : null;
  if (!definition) throw new Error('Invalid transport mode');
  if (!isTransportVehicleCount(vehicleCount)) throw new Error('Invalid transport vehicle count');
  return {
    version: TRANSPORT_POLICY_VERSION,
    vehicleCount,
    unitCapacity: definition.capacity,
    capacity: definition.capacity * vehicleCount,
    transportFeePerKm: definition.transportFeePerKm * vehicleCount,
    fuelPerKm: definition.fuelPerKm * vehicleCount,
    fuelUnitPrice: 0,
    fuelProductId: TRANSPORT_FUEL_PRODUCT_ID,
    secondsPerKm: TRANSPORT_BASE_SECONDS_PER_KM * definition.timeFactor,
    departureSeconds: definition.departureSeconds,
  };
}

export function legacyTransportCyclePolicy(mode) {
  const policy = LEGACY_CYCLE_POLICIES[mode];
  if (!policy) throw new Error('Invalid legacy transport mode');
  return { ...policy };
}

export function isTransportCyclePolicy(policy) {
  return Boolean(policy && typeof policy === 'object'
    && Number.isSafeInteger(policy.version) && policy.version > 0
    && Number.isSafeInteger(policy.capacity) && policy.capacity > 0
    && ['transportFeePerKm', 'fuelPerKm', 'fuelUnitPrice', 'secondsPerKm', 'departureSeconds']
      .every((key) => Number.isFinite(policy[key]) && policy[key] >= 0)
    && policy.secondsPerKm > 0
    && (policy.version < 3 || (policy.fuelProductId === TRANSPORT_FUEL_PRODUCT_ID && policy.fuelUnitPrice === 0))
    && (policy.version < 4 || (isTransportVehicleCount(policy.vehicleCount)
      && Number.isSafeInteger(policy.unitCapacity) && policy.unitCapacity > 0
      && policy.capacity === policy.unitCapacity * policy.vehicleCount)));
}

export function transportCyclePolicyForShipment(shipment) {
  return isTransportCyclePolicy(shipment?.policySnapshot)
    ? { ...shipment.policySnapshot }
    : legacyTransportCyclePolicy(shipment?.mode);
}

export function transportPolicyDurationMs(policy, distanceKm) {
  const distance = Number(distanceKm);
  if (!isTransportCyclePolicy(policy) || !Number.isFinite(distance) || distance < 0) return 0;
  return Math.max(1_000, Math.round((policy.departureSeconds + distance * policy.secondsPerKm) * 1000));
}

/** Round once after summing the unrounded full-trip distance, never per leg. */
export function transportFuelQuantity(distanceKm, fuelPerKm, vehicleCount = 1) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(fuelPerKm) || fuelPerKm < 0
    || !isTransportVehicleCount(vehicleCount)) return 0;
  return Math.ceil(distanceKm * fuelPerKm * vehicleCount);
}

/** Both previews and mutations round only the full dispatched fleet's trip. */
export function transportFleetCost(mode, distanceKm, vehicleCount = 1) {
  const definition = Object.hasOwn(TRANSPORT_MODE_POLICY, mode) ? TRANSPORT_MODE_POLICY[mode] : null;
  if (!definition || !Number.isFinite(distanceKm) || distanceKm < 0
    || !isTransportVehicleCount(vehicleCount)) throw new Error('Invalid transport fleet cost');
  const transportFee = Math.round(distanceKm * definition.transportFeePerKm * vehicleCount * 1_000_000) / 1_000_000;
  return {
    distanceKm,
    transportFee,
    fuelPurchased: transportFuelQuantity(distanceKm, definition.fuelPerKm, vehicleCount),
    fuelCost: 0,
    fuelProductId: TRANSPORT_FUEL_PRODUCT_ID,
    totalCost: transportFee,
  };
}
