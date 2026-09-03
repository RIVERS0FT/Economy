export const TRANSPORT_FUEL_UNIT_PRICE = 1;
export const TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000;

export const TRANSPORT_MODE_POLICY = Object.freeze({
  road: Object.freeze({
    id: 'road',
    name: '公路运输',
    setupFixedCost: 100,
    setupCostPerKm: 0.02,
    transportFeePerKm: 0.02,
    fuelPerKm: 0.01,
    capacity: 100,
    timeFactor: 1.0,
  }),
  rail: Object.freeze({
    id: 'rail',
    name: '铁路运输',
    setupFixedCost: 1000,
    setupCostPerKm: 0.15,
    transportFeePerKm: 0.17,
    fuelPerKm: 0.08,
    capacity: 2000,
    timeFactor: 2.0,
  }),
  air: Object.freeze({
    id: 'air',
    name: '航空运输',
    setupFixedCost: 500,
    setupCostPerKm: 0.05,
    transportFeePerKm: 0.27,
    fuelPerKm: 0.13,
    capacity: 500,
    timeFactor: 0.25,
  }),
});
