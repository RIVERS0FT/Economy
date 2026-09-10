import test from 'node:test';
import assert from 'node:assert/strict';
import { transportMaintenanceCandidates } from '../../src/transport/transportPlanning.js';
import type { EconomyState, TransportRoute } from '../../src/types';

const now = 1780000000000;
const route = (): TransportRoute => ({ id: 'route-1', name: 'A-B', sourceProvinceId: 'A', destinationProvinceId: 'B',
  mode: 'road', vehicleCount: 1, setupCost: 80, createdAt: now, updatedAt: now,
  transportBusiness: { tasks: [], offers: [], reservedFuel: 2, dailyRewardBudget: 10000, committedReward: 100,
    dispatch: { ready: true, maintenanceRequired: false, reason: '可启动任务运输', vehicleCount: 1,
      fuelRequired: 2, transportFee: 3, transportedQuantity: 200, fingerprint: 'task-basis' } } });
function game(routes: TransportRoute[]) {
  return { userId: 1, saveEpoch: 1, credits: 1000, lastProcessedAt: now,
    provinces: [{ id: 'A', longitude: 0, latitude: 0 }, { id: 'B', longitude: 1, latitude: 0 }],
    products: [], transportRoutes: routes, transportShipments: [], provinceInventories: {}, provinceMarkets: {},
  } as unknown as EconomyState;
}

test('a confirmed task starts ahead of speculative trading and carries no client cargo amounts', () => {
  const commands = transportMaintenanceCandidates(game([route()]), now);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].kind, 'task');
  assert.equal(commands[0].kind === 'task' && commands[0].operation, 'task-cycle-start');
  assert.equal('load' in commands[0], false);
});

test('task custody maintenance precedes dispatch and does not require an in-transit slot', () => {
  const entry = route();
  entry.transportBusiness!.dispatch!.maintenanceRequired = true;
  const state = game([entry]);
  state.transportShipments = Array.from({ length: 20 }, (_, index) => ({
    id: `other-${index}`, routeId: `other-route-${index}`, status: 'in-transit',
  })) as EconomyState['transportShipments'];
  const commands = transportMaintenanceCandidates(state, now);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].kind === 'task' && commands[0].operation, 'task-maintain');
});

test('docked task cargo bypasses price-based unloading and only submits its node identity', () => {
  const state = game([route()]);
  state.transportShipments = [{ id: 'trip', routeId: 'route-1', status: 'docked', taskTrip: true,
    currentVisitIndex: 1, manifest: [{ productId: 'external-cargo', quantity: 200, destinationProvinceId: 'A' }],
  }] as EconomyState['transportShipments'];
  const [command] = transportMaintenanceCandidates(state, now);
  assert.equal(command.kind, 'service');
  if (command.kind !== 'service') throw new Error('Expected service');
  assert.equal(command.cycleId, 'trip');
  assert.equal(command.visitIndex, 1);
  assert.deepEqual(command.unload, []);
  assert.deepEqual(command.load, []);
});

test('pending deletion never starts or re-reserves an idle route', () => {
  const entry = route();
  entry.deletionPending = true;
  entry.transportBusiness!.dispatch!.maintenanceRequired = true;
  assert.deepEqual(transportMaintenanceCandidates(game([entry]), now), []);
});
