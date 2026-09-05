import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';
import { ensurePlayer } from '../src/domain.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';

const now = 1_800_000_000_000;
const user = { id: 77231, email: 'admission@example.com', name: 'Admission' };

test('a user write joins the serial executor after its arrival barrier without recursively chasing later deadlines', async (t) => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  t.after(() => store.close());
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  let checks = 0;
  const order = [];
  store.ensureScheduledProcessingBarrier = () => {
    checks += 1;
    assert.equal(checks, 1, 'must not re-enter a newly due scheduler barrier');
    return barrier;
  };
  const action = store.enqueueAuthoritativeWrite({ actor: `user:${user.id}`, operation: 'placeOrder' }, () => { order.push('trade'); return 42; });
  assert.deepEqual(order, []);
  order.push('arrival-world-settled');
  release();
  assert.equal(await action, 42);
  assert.deepEqual(order, ['arrival-world-settled', 'trade']);
  assert.equal(checks, 1);
});

test('a failed world barrier does not execute or acknowledge an economic write', async (t) => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  t.after(() => store.close());
  store.ensureScheduledProcessingBarrier = () => Promise.reject(new Error('world failed'));
  let calls = 0;
  await assert.rejects(store.enqueueAuthoritativeWrite({ actor: `user:${user.id}`, operation: 'placeOrder' }, () => { calls += 1; }), /world failed/);
  assert.equal(calls, 0);
});

for (const side of ['buy', 'sell']) {
  test(`${side} confirmation after delayed admission mutates the real SQLite world once`, async (t) => {
    const store = new EconomyStore(':memory:', { scheduledProcessing: false });
    t.after(() => store.close());
    const provinceId = '110000';
    store.transaction(() => {
      const { world, revision, stateJson } = store.loadWorld(now);
      const player = ensurePlayer(world, user, now);
      player.credits = 10000;
      inventoryForProvince(player, 'food', provinceId).available = 20;
      world.markets[provinceScopedKey(provinceId, 'food')].officialPrice = 15;
      store.saveWorldIfChanged(revision, world, now, stateJson);
    });
    let releases = 0;
    store.ensureScheduledProcessingBarrier = () => { releases += 1; return Promise.resolve(); };
    const request = { action: 'placeOrder', requestKey: `staffing-admission-${side}`, method: 'POST', path: '/api/game/orders',
      payload: { provinceId, assetKind: 'commodity', assetId: 'food', productId: 'food', side, quantity: 2 } };
    const first = await store.enqueueAuthoritativeWrite({ actor: `user:${user.id}`, operation: 'placeOrder' }, () => store.apply(user, request, now + 1));
    assert.equal(first.result.ok, true, first.result.message);
    const after = structuredClone(store.worldCache.world.players[String(user.id)]);
    const second = await store.enqueueAuthoritativeWrite({ actor: `user:${user.id}`, operation: 'placeOrder' }, () => store.apply(user, request, now + 2));
    assert.deepEqual(second, first);
    assert.deepEqual(store.worldCache.world.players[String(user.id)], after);
    assert.equal(inventoryForProvince(after, 'food', provinceId).available, side === 'buy' ? 22 : 18);
    assert.equal(releases, 2);
  });
}
