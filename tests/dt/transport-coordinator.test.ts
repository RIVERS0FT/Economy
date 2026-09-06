import assert from 'node:assert/strict';
import test from 'node:test';
import { createTransportCoordinator, type TransportOperation } from '../../src/transport/transportCoordinator.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('failed transport route does not starve peers or retry unchanged authoritative inputs', async () => {
  const calls: string[] = [];
  const errors: string[] = [];
  let revision = 'stock-1';
  const coordinator = createTransportCoordinator({
    getCandidates: () => ['first', 'second'].map((routeId) => ({
      key: `start:${routeId}`, routeId, fingerprint: revision,
      async run() { calls.push(routeId); return { result: { ok: false, message: `failed-${routeId}` } }; },
    })),
    refresh: async () => {},
    onFailure: (message) => { errors.push(message); },
  });
  coordinator.notify();
  await coordinator.whenIdle();
  assert.deepEqual(calls, ['first', 'second']);
  assert.deepEqual(errors, ['failed-first', 'failed-second']);
  coordinator.notify();
  await coordinator.whenIdle();
  assert.equal(calls.length, 2);
  revision = 'stock-2';
  coordinator.notify();
  await coordinator.whenIdle();
  assert.deepEqual(calls, ['first', 'second', 'first', 'second']);
  coordinator.stop();
});

test('notifications during an in-flight operation coalesce without concurrent transport writes', async () => {
  const gate = deferred();
  const calls: string[] = [];
  let phase = 0;
  let running = 0;
  let maxRunning = 0;
  let coordinator: ReturnType<typeof createTransportCoordinator>;
  coordinator = createTransportCoordinator({
    getCandidates: () => phase > 1 ? [] : [{
      routeId: 'one', key: `phase-${phase}`, fingerprint: String(phase),
      async run() {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        calls.push(`phase-${phase}`);
        if (phase === 0) await gate.promise;
        running -= 1;
        return { result: { ok: true, message: '' } };
      },
    }],
    refresh: async () => { phase += 1; coordinator.notify(); },
  });
  coordinator.notify();
  coordinator.notify();
  coordinator.notify();
  assert.equal(calls.length, 1);
  gate.resolve();
  await coordinator.whenIdle();
  assert.deepEqual(calls, ['phase-0', 'phase-1']);
  assert.equal(maxRunning, 1);
  coordinator.stop();
});

test('confirmed acknowledgements with unchanged snapshots are not replayed in a tight loop', async () => {
  let calls = 0;
  const coordinator = createTransportCoordinator({
    getCandidates: () => [{ routeId: 'one', key: 'start', fingerprint: 'same', async run() { calls += 1; return { result: { ok: true } }; } }],
    refresh: async () => {},
  });
  coordinator.notify();
  await coordinator.whenIdle();
  coordinator.notify();
  await coordinator.whenIdle();
  assert.equal(calls, 1);
  coordinator.stop();
});

test('network and refresh failures are caught while remaining routes are still considered', async () => {
  const calls: string[] = [];
  const errors: string[] = [];
  const coordinator = createTransportCoordinator({
    getCandidates: () => ['bad', 'good'].map((routeId): TransportOperation => ({
      routeId, key: routeId, fingerprint: 'same', async run() {
        calls.push(routeId);
        if (routeId === 'bad') throw new Error('network');
        return { result: { ok: true } };
      },
    })),
    refresh: async () => { throw new Error('refresh'); },
    onFailure: (message) => { errors.push(message); },
  });
  coordinator.notify();
  await coordinator.whenIdle();
  assert.deepEqual(calls, ['bad', 'good']);
  assert.equal(errors.length, 3);
  coordinator.stop();
});

test('stopping a coordinator while awaiting a reply never dispatches a subsequent route', async () => {
  const gate = deferred();
  let calls = 0;
  let refreshes = 0;
  const coordinator = createTransportCoordinator({
    getCandidates: () => ['one', 'two'].map((routeId) => ({
      routeId, key: routeId, fingerprint: 'same', async run() {
        calls += 1;
        await gate.promise;
        return { result: { ok: true } };
      },
    })),
    refresh: async () => { refreshes += 1; },
  });
  coordinator.notify();
  coordinator.stop();
  gate.resolve();
  await coordinator.whenIdle();
  coordinator.notify();
  assert.equal(calls, 1);
  assert.equal(refreshes, 0);
});

test('a planner exception is reported and a later authority notification can recover', async () => {
  let broken = true;
  let calls = 0;
  const errors: string[] = [];
  const coordinator = createTransportCoordinator({
    getCandidates: () => {
      if (broken) throw new Error('stale projection');
      return [{ routeId: 'one', key: 'start', fingerprint: '1', async run() { calls += 1; return { result: { ok: true } }; } }];
    },
    refresh: async () => {},
    onFailure: (message) => { errors.push(message); },
  });
  coordinator.notify();
  await coordinator.whenIdle();
  assert.equal(errors.length, 1);
  broken = false;
  coordinator.notify();
  await coordinator.whenIdle();
  assert.equal(calls, 1);
  coordinator.stop();
});
