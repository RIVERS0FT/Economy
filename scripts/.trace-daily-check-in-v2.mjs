import { EconomyStore } from '../server/src/storage.js';
import { CHECK_IN_DAY_MS } from '../server/src/daily-check-in.js';
import { readSegmentedWorld } from '../server/src/world-storage-v2.js';

const MONDAY_SHANGHAI = Date.UTC(2026, 6, 12, 16, 0, 0, 0);
const account = { id: 1, email: 'trace@example.com', name: 'Trace', role: 'user' };
const request = (key) => ({ action: 'checkIn', payload: {}, requestKey: key, method: 'POST', path: '/api/game/check-in' });
const store = new EconomyStore(':memory:', { scheduledProcessing: false });
try {
  store.getState(account, MONDAY_SHANGHAI - CHECK_IN_DAY_MS);
  const now = MONDAY_SHANGHAI + 12 * 60 * 60 * 1000;
  const first = store.apply(account, request('trace-check-in-0001'), now);
  const before = readSegmentedWorld(store);
  const duplicate = store.apply(account, request('trace-check-in-0002'), now + 2);
  const after = readSegmentedWorld(store);
  const changedPlayers = [];
  for (const key of new Set([...before.snapshot.playerStateJsonById.keys(), ...after.snapshot.playerStateJsonById.keys()])) {
    if (before.snapshot.playerStateJsonById.get(key) !== after.snapshot.playerStateJsonById.get(key)) changedPlayers.push(key);
  }
  const changedSegments = [];
  for (const key of new Set([...before.snapshot.segmentStateJsonByKey.keys(), ...after.snapshot.segmentStateJsonByKey.keys()])) {
    if (before.snapshot.segmentStateJsonByKey.get(key) !== after.snapshot.segmentStateJsonByKey.get(key)) {
      changedSegments.push({ key, before: before.snapshot.segmentStateJsonByKey.get(key), after: after.snapshot.segmentStateJsonByKey.get(key) });
    }
  }
  console.log(JSON.stringify({ first, duplicate, beforeRevision: before.revision, afterRevision: after.revision, changedPlayers, changedSegments }, null, 2));
} finally {
  store.close();
}
