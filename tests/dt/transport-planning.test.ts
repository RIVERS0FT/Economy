import assert from 'node:assert/strict';
import test from 'node:test';
import type { EconomyState, TransportShipment } from '../../src/types.ts';
import { planTransportCycle, planTransportNode, transportOfficialQuote, transportOperationFingerprint } from '../../src/transport/transportPlanner.js';
import { transportMaintenanceCandidates, estimateTransportRoute } from '../../src/transport/transportPlanning.js';
import { createTransportCyclePolicy, legacyTransportCyclePolicy, transportPolicyDurationMs, transportFuelQuantity } from '../../shared/transport-policy.js';

const now = 1_780_000_000_000;
function gameFixture(prices = { A: 1, B: 1.5, C: 2 }, stock: Record<string, number> = { A: 100 }) {
  return {
    userId: 1, saveEpoch: 1, lastProcessedAt: now, defaultProvinceId: 'A', credits: 10000,
    products: [{ id: 'wheat', basePrice: 999 }],
    provinces: Object.keys(prices).map((id, index) => ({ id, latitude: 30 + index, longitude: -100 })),
    provinceInventories: Object.fromEntries(Object.keys(prices).map((id) => [id, {
      wheat: { available: stock[id] ?? 0, frozen: 99999, inTransit: 99999 },
      'industrial-fuel': { available: 10000, frozen: 0, inTransit: 0 },
    }])),
    provinceMarkets: Object.fromEntries(Object.entries(prices).map(([id, price]) => [id, {
      wheat: { officialPrice: price, nextPriceAt: now + 86400000, lastTradePrice: 1000 - price, bestBid: 500 - price },
      'industrial-fuel': { officialPrice: 4, nextPriceAt: now + 86400000 },
    }])),
    transportRoutes: [], transportShipments: [],
  } as unknown as EconomyState;
}
function estimate(game = gameFixture(), overrides: Record<string, unknown> = {}) {
  return planTransportCycle({ game, traversal: ['A', 'B', 'A'], capacity: 200, cycleCost: 40, durationMs: 140000, now, ...overrides });
}
function shipment(visitIndex: number, count = 100) {
  return {
    id: 'cycle-1', routeId: 'route-1', mode: 'road', status: 'docked', currentVisitIndex: visitIndex,
    manifest: [{ productId: 'wheat', quantity: count, destinationProvinceId: 'B' }],
  } as TransportShipment;
}

test('transport uses official quotes, not best bid, trade history or catalog prices', () => {
  const game = gameFixture();
  const result = estimate(game);
  assert.equal(result.grossGain, 49.5);
  assert.equal(result.netGain, 9.5);
  assert.equal(result.threshold, 8);
  assert.equal(result.reason, 'ready');
  assert.deepEqual(result.firstLoad, [{ productId: 'wheat', quantity: 100 }]);
  assert.equal(transportOfficialQuote(game, 'B', 'wheat', now)?.price, 1.5);
  delete game.provinceMarkets!.B.wheat.officialPrice;
  assert.equal(estimate(game).reason, 'quotes-not-ready');
  assert.equal(estimate(game).netGain, null);
});

test('positive spread alone cannot launch a loss-making or below-margin cycle', () => {
  const game = gameFixture({ A: 1, B: 1.1, C: 2 });
  assert.equal(estimate(game).netGain, -30.1);
  assert.equal(estimate(game).reason, 'insufficient-profit');
  game.provinceMarkets!.B.wheat.officialPrice = 1.45;
  assert.equal(estimate(game).netGain, 4.55);
  assert.equal(estimate(game).reason, 'insufficient-profit');
  assert.equal(estimate(game, { cycleCost: 0 }).threshold, 1);
});

test('transport ignores frozen and in-transit inventory and never mutates a forecast input', () => {
  const game = gameFixture(undefined, {});
  const before = JSON.stringify(game);
  assert.equal(estimate(game).reason, 'no-inventory');
  assert.equal(JSON.stringify(game), before);
  const stocked = gameFixture();
  const stockedBefore = JSON.stringify(stocked);
  estimate(stocked);
  assert.equal(JSON.stringify(stocked), stockedBefore);
});

test('return visits do not count original stock twice or reload simulated deliveries', () => {
  const game = gameFixture({ A: 3, B: 1, C: 4 }, { B: 100 });
  const result = estimate(game, { traversal: ['A', 'B', 'C', 'B', 'A'], capacity: 100 });
  assert.deepEqual(result.firstLoad, []);
  assert.equal(result.transportedQuantity, 100);
  assert.equal(result.grossGain, 297);
  assert.equal(result.netGain, 257);
  assert.equal(result.reason, 'ready');
});

test('a cycle may start empty for real profitable stock at a later node', () => {
  const game = gameFixture({ A: 3, B: 1, C: 4 }, { B: 100 });
  const result = estimate(game);
  assert.equal(result.reason, 'ready');
  assert.deepEqual(result.firstLoad, []);
  assert.equal(result.transportedQuantity, 100);
  assert.equal(result.netGain, 158);
});

test('expired, missing and crossing-midnight official quotes prevent new cycles', () => {
  const game = gameFixture();
  game.provinceMarkets!.B.wheat.nextPriceAt = now;
  assert.equal(estimate(game).reason, 'quotes-not-ready');
  game.provinceMarkets!.B.wheat.nextPriceAt = now + 140000;
  assert.equal(estimate(game).reason, 'price-boundary');
  game.provinceMarkets!.B.wheat.nextPriceAt = now + 140001;
  assert.equal(estimate(game).reason, 'ready');
  delete game.provinceMarkets!.B.wheat.nextPriceAt;
  assert.equal(estimate(game).reason, 'quotes-not-ready');
});

test('insufficient cash or full in-transit slots do not submit a new cycle', () => {
  const game = gameFixture();
  game.credits = 39.999999;
  assert.equal(estimate(game).reason, 'insufficient-funds');
  game.credits = 40;
  assert.equal(estimate(game, { atInTransitLimit: true }).reason, 'in-transit-limit');
  assert.equal(estimate(game).reason, 'ready');
});

test('cargo selection is capacity bounded and deterministic under equal spreads', () => {
  const game = gameFixture(undefined, { A: 1000 });
  assert.equal(estimate(game).peakLoad, 200);
  assert.equal(estimate(game).firstLoad[0].quantity, 200);
  game.products.push({ id: 'apple' } as EconomyState['products'][number]);
  game.provinceInventories!.A.apple = { available: 50, frozen: 0, inTransit: 0 };
  for (const id of ['A', 'B', 'C']) game.provinceMarkets![id].apple = { ...game.provinceMarkets![id].wheat };
  assert.deepEqual(estimate(game).firstLoad, [{ productId: 'apple', quantity: 50 }, { productId: 'wheat', quantity: 150 }]);
});

test('a paid node service does not reapply cycle cost and final unloading works without quotes', () => {
  const game = gameFixture({ A: 1.01, B: 1, C: 2 }, { B: 100 });
  const plan = planTransportNode({ game, traversal: ['A', 'B', 'A'], shipment: shipment(1, 0), capacity: 200, now });
  assert.deepEqual(plan.load, [{ productId: 'wheat', quantity: 100 }]);
  game.provinceMarkets = {};
  const final = planTransportNode({ game, traversal: ['A', 'B', 'A'], shipment: shipment(2), capacity: 200, now });
  assert.deepEqual(final.unload, [{ productId: 'wheat', quantity: 100 }]);
  assert.deepEqual(final.load, []);
  const intermediate = planTransportNode({ game, traversal: ['A', 'B', 'A'], shipment: shipment(1), capacity: 200, now });
  assert.deepEqual(intermediate, { visitIndex: 1, unload: [], load: [] });
});

test('unload precedes load and a node never loads and unloads the same product', () => {
  const game = gameFixture({ A: 1, B: 2, C: 1 }, { B: 1000 });
  const plan = planTransportNode({ game, traversal: ['A', 'B', 'A'], shipment: shipment(1), capacity: 200, now });
  assert.deepEqual(plan.unload, [{ productId: 'wheat', quantity: 100 }]);
  assert.deepEqual(plan.load, []);
});

test('new mode duration includes departure overhead and legacy durations stay unchanged', () => {
  assert.equal(transportPolicyDurationMs(createTransportCyclePolicy('road'), 1000), 70000);
  assert.equal(transportPolicyDurationMs(createTransportCyclePolicy('rail'), 1000), 135000);
  assert.equal(transportPolicyDurationMs(createTransportCyclePolicy('air'), 1000), 30000);
  assert.equal(transportPolicyDurationMs(legacyTransportCyclePolicy('air'), 1000), 15000);
  assert.equal(legacyTransportCyclePolicy('air').capacity, 500);
  assert.equal(createTransportCyclePolicy('air').capacity, 300);
});

function route(id: string, source = 'A', destination = 'B') {
  return { id, sourceProvinceId: source, destinationProvinceId: destination, mode: 'road', createdAt: now, updatedAt: now } as EconomyState['transportRoutes'][number];
}

test('maintenance prioritizes final unloading, then docked service, then new starts and rotates peers', () => {
  const game = gameFixture({ A: 1, B: 3, C: 2 }, { A: 1000 });
  game.transportRoutes = [route('new'), route('service'), route('final'), route('new-2')];
  game.transportShipments = [
    { ...shipment(1), routeId: 'service', id: 'service-cycle' },
    { ...shipment(2), routeId: 'final', id: 'final-cycle' },
  ];
  assert.deepEqual(transportMaintenanceCandidates(game, now).map((candidate) => candidate.routeId), ['final', 'service', 'new', 'new-2']);
  assert.deepEqual(transportMaintenanceCandidates(game, now, 'new').map((candidate) => candidate.routeId), ['final', 'service', 'new-2', 'new']);
  for (let index = 0; index < 20; index += 1) game.transportShipments.push({ ...shipment(0), routeId: `busy-${index}`, id: `busy-${index}`, status: 'in-transit' });
  assert.deepEqual(transportMaintenanceCandidates(game, now).map((candidate) => candidate.routeId), ['final']);
  assert.equal(estimateTransportRoute(game, game.transportRoutes[0], now).reason, 'in-transit-limit');
});

test('maintenance uses a legacy aircraft cycle capacity rather than the new aircraft limit', () => {
  const game = gameFixture({ A: 3, B: 1, C: 2 }, { B: 1000 });
  game.transportRoutes = [{ ...route('air'), mode: 'air' }];
  game.transportShipments = [{ ...shipment(1, 400), id: 'old-air', routeId: 'air', mode: 'air', policySnapshot: legacyTransportCyclePolicy('air') }];
  const [command] = transportMaintenanceCandidates(game, now);
  assert.equal(command.kind, 'service');
  assert.equal(command.load[0].quantity, 100);
});

test('retry fingerprints ignore unrelated revision and time but track relevant authoritative inputs', () => {
  const game = gameFixture();
  const baseline = transportOperationFingerprint(game, ['A', 'B', 'A'], null, 0);
  game.lastProcessedAt += 1000;
  assert.equal(transportOperationFingerprint(game, ['A', 'B', 'A'], null, 0), baseline);
  game.provinceInventories!.A.wheat.available -= 1;
  assert.notEqual(transportOperationFingerprint(game, ['A', 'B', 'A'], null, 0), baseline);
});


test('propulsion fuel uses only origin available stock and its net sale value is not a cash requirement', () => {
  const game = gameFixture({ A: 1, B: 3, C: 2 });
  game.credits = 40;
  const fuel = game.provinceInventories!.A['industrial-fuel'];
  fuel.available = 7;
  fuel.frozen = 1000;
  const before = JSON.stringify(game);
  const result = estimate(game, { fuelQuantity: 7 });
  assert.equal(result.reason, 'ready');
  assert.equal(result.fuelValue, 27.72);
  assert.equal(result.operatingCost, 67.72);
  assert.equal(result.netGain, 130.28);
  assert.equal(JSON.stringify(game), before);
  fuel.available = 6;
  assert.equal(estimate(game, { fuelQuantity: 7 }).reason, 'insufficient-fuel');
  assert.equal(estimate(game, { fuelQuantity: 7 }).fuelAvailable, 6);
  fuel.available = 7;
  delete game.provinceMarkets!.A['industrial-fuel'].officialPrice;
  assert.equal(estimate(game, { fuelQuantity: 7 }).reason, 'quotes-not-ready');
  game.provinceMarkets!.A['industrial-fuel'].officialPrice = 4;
  game.provinceMarkets!.A['industrial-fuel'].nextPriceAt = now + 140000;
  assert.equal(estimate(game, { fuelQuantity: 7 }).reason, 'price-boundary');
});

test('origin propulsion fuel is reserved before selecting fuel as cargo and never mutates inventory', () => {
  const game = gameFixture({ A: 1, B: 3, C: 2 }, {});
  game.products = [{ id: 'industrial-fuel', name: '燃料', category: 'industrial', basePrice: 4 }];
  for (const id of ['A', 'B', 'C']) {
    game.provinceInventories![id]['industrial-fuel'].available = id === 'A' ? 20 : 0;
    game.provinceMarkets![id]['industrial-fuel'].officialPrice = id === 'A' ? 4 : 20;
  }
  const before = JSON.stringify(game);
  const result = estimate(game, { fuelQuantity: 7, cycleCost: 1 });
  assert.equal(result.reason, 'ready');
  assert.deepEqual(result.firstLoad, [{ productId: 'industrial-fuel', quantity: 13 }]);
  assert.equal(result.transportedQuantity, 13);
  assert.equal(JSON.stringify(game), before);
});

test('intermediate stops partially replace lower remaining-gain cargo and return visits decide afresh', () => {
  const game = gameFixture({ A: 1, B: 2, C: 3 }, { A: 100 });
  game.products.push({ id: 'ore', name: '矿石', category: 'raw', basePrice: 1 });
  for (const id of ['A', 'B', 'C']) {
    game.provinceInventories![id].ore = { available: id === 'B' ? 30 : 0, frozen: 0, inTransit: 0 };
    game.provinceMarkets![id].ore = { officialPrice: id === 'C' ? 10 : 1, nextPriceAt: now + 86400000 } as EconomyState['markets'][string];
  }
  const traversal = ['A', 'B', 'C', 'B', 'A'];
  const plan = planTransportNode({ game, traversal, shipment: shipment(1), capacity: 100, now });
  assert.deepEqual(plan.unload, [{ productId: 'wheat', quantity: 30 }]);
  assert.deepEqual(plan.load, [{ productId: 'ore', quantity: 30 }]);
  const forecast = estimate(game, { traversal, capacity: 100, cycleCost: 0 });
  assert.equal(forecast.grossGain, 435.6);
  assert.equal(forecast.transportedQuantity, 130);
  assert.equal(forecast.peakLoad, 100);
  const returning = planTransportNode({ game, traversal, shipment: shipment(3), capacity: 100, now });
  assert.deepEqual(returning.unload, [{ productId: 'wheat', quantity: 100 }]);
  assert.deepEqual(returning.load, []);
});

test('a pending deletion still services its paid trip but cannot produce a start command', () => {
  const game = gameFixture({ A: 1, B: 3, C: 2 }, { A: 1000 });
  game.transportRoutes = [{ ...route('route-1'), deletionPending: true }];
  assert.deepEqual(transportMaintenanceCandidates(game, now), []);
  game.transportShipments = [shipment(1)];
  assert.equal(transportMaintenanceCandidates(game, now)[0].kind, 'service');
});


test('fuel rounds the full unrounded distance once across modes and distance ranges', () => {
  for (const mode of ['road', 'rail', 'air'] as const) {
    const policy = createTransportCyclePolicy(mode);
    for (const distance of [0, 1, 100, 1234.56789, 9000]) {
      const expected = Math.ceil(distance * policy.fuelPerKm);
      assert.equal(transportFuelQuantity(distance, policy.fuelPerKm), expected);
      assert.ok(Number.isSafeInteger(expected));
    }
  }
  assert.equal(transportFuelQuantity(41 + 41 + 41, 0.005), 1);
  assert.equal(transportFuelQuantity(1234, 0.005), 7);
  assert.equal(transportFuelQuantity(Number.NaN, 0.005), 0);
});
