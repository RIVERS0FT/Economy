import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LatestConfigurationQueue, configurationFailure, type ConfigurationResult, type ConfigurationTarget } from '../../src/app/latestConfigurationQueue.ts';
import { ConfirmedActionSync } from '../../src/app/confirmedActionSync.ts';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const queue = new LatestConfigurationQueue<string>();
  const authority = new Map([['CA:farm', 'a'], ['NY:farm', 'a'], ['TX:mill', 'a']]);
  const calls: ConfigurationTarget<string>[][] = [];
  const gates: ReturnType<typeof deferred<ConfigurationResult>>[] = [];
  const notices: ConfigurationResult[] = [];
  const submit = (targets: ConfigurationTarget<string>[]) => {
    calls.push(targets.map((target) => ({ ...target })));
    const gate = deferred<ConfigurationResult>(); gates.push(gate); return gate.promise;
  };
  const send = (entries: [string, string][]) => queue.enqueue(entries.map(([key, value]) => ({ key, value })), authority, submit, (result) => notices.push(result));
  return { queue, authority, calls, gates, notices, send };
}

test('configuration immediately projects, sends first now, coalesces B/C and protects A→B→A from old reads', async () => {
  const f = fixture();
  f.send([['CA:farm', 'b']]);
  assert.equal(f.calls.length, 1);
  f.send([['CA:farm', 'c']]);
  f.send([['CA:farm', 'a']]);
  assert.equal(f.queue.read('CA:farm', 'authority'), 'a');
  f.queue.reconcile(f.authority, 1);
  assert.equal(f.calls.length, 1);
  f.gates[0].resolve({ ok: true, message: 'b', revision: 2 }); await tick();
  assert.deepEqual(f.calls[1], [{ key: 'CA:farm', value: 'a' }]);
  assert.equal(f.queue.read('CA:farm', 'b'), 'a');
  f.queue.reconcile(new Map([...f.authority, ['CA:farm', 'b']]), 2);
  assert.equal(f.queue.read('CA:farm', 'b'), 'a');
  f.gates[1].resolve({ ok: true, message: 'a', revision: 3 }); await tick();
  f.queue.reconcile(f.authority, 3);
  assert.equal(f.queue.read('CA:farm', 'future-authority'), 'future-authority');
  assert.deepEqual(f.notices.map((n) => n.message), ['a']);
});

test('overlapping global and regional targets coalesce atomically while unrelated clusters run independently', async () => {
  const f = fixture();
  f.send([['CA:farm', 'b']]);
  f.send([['CA:farm', 'c'], ['NY:farm', 'c']]);
  f.send([['NY:farm', 'd']]);
  f.send([['TX:mill', 'z']]);
  assert.equal(f.calls.length, 2);
  f.gates[0].resolve({ ok: true, message: 'b', revision: 2 }); await tick();
  assert.deepEqual(f.calls[2], [{ key: 'CA:farm', value: 'c' }, { key: 'NY:farm', value: 'd' }]);
  f.gates[2].resolve({ ok: false, message: '整批拒绝' }); await tick();
  assert.equal(f.queue.read('CA:farm', 'a'), 'b');
  assert.equal(f.queue.read('NY:farm', 'a'), 'a');
  assert.equal(f.queue.read('TX:mill', 'a'), 'z');
});

test('latest failure rolls back to last receipt, never a stale poll; no-op creates no write', async () => {
  const f = fixture();
  f.send([['CA:farm', 'a']]); assert.equal(f.calls.length, 0);
  f.send([['CA:farm', 'b']]); f.send([['CA:farm', 'c']]);
  f.gates[0].resolve({ ok: true, message: 'b', revision: 5 }); await tick();
  f.queue.reconcile(f.authority, 4);
  f.gates[1].resolve({ ok: false, message: '拒绝' }); await tick();
  assert.equal(f.queue.read('CA:farm', 'a'), 'b');
  f.queue.reconcile(f.authority, 4);
  assert.equal(f.queue.read('CA:farm', 'a'), 'b');
  f.queue.reconcile(new Map([...f.authority, ['CA:farm', 'b']]), 5);
  assert.equal(f.queue.read('CA:farm', 'new'), 'new');
});

test('unknown response preserves intent and blocks successors until original payload is confirmed', async () => {
  const f = fixture();
  f.send([['CA:farm', 'b']]); f.send([['CA:farm', 'c']]);
  f.gates[0].reject(new TypeError('network disconnected')); await tick();
  assert.equal(f.queue.read('CA:farm', 'a'), 'c');
  assert.equal(f.calls.length, 1);
  f.queue.reconcile(f.authority, 99); assert.equal(f.calls.length, 1);
  f.send([['CA:farm', 'd']]);
  assert.deepEqual(f.calls[1], f.calls[0]);
  f.gates[1].resolve({ ok: true, message: 'b', revision: 100 }); await tick();
  assert.deepEqual(f.calls[2], [{ key: 'CA:farm', value: 'd' }]);
  f.gates[2].resolve({ ok: true, message: 'd', revision: 101 }); await tick();
  assert.equal(f.queue.isBusy('CA:farm'), false);
});

test('save/session disposal discards queued work and late callbacks', async () => {
  const f = fixture(); let signals = 0;
  const unsubscribe = f.queue.subscribe(() => { signals += 1; });
  f.send([['CA:farm', 'b']]); f.send([['CA:farm', 'c']]);
  f.queue.dispose(); const previous = signals;
  f.gates[0].resolve({ ok: true, message: 'old' }); await tick();
  f.send([['CA:farm', 'd']]);
  assert.equal(signals, previous); assert.equal(f.calls.length, 1); assert.equal(f.notices.length, 0);
  unsubscribe();
});

test('missing cluster cancels entire unsent batch rather than submitting surviving regions', async () => {
  const f = fixture();
  f.send([['CA:farm', 'b']]); f.send([['CA:farm', 'c'], ['NY:farm', 'c']]);
  const remaining = new Map(f.authority); remaining.delete('NY:farm');
  f.queue.reconcile(remaining, 2);
  f.gates[0].resolve({ ok: true, message: 'b', revision: 3 }); await tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.queue.isBusy('CA:farm'), false);
  assert.equal(f.queue.read('CA:farm', 'a'), 'b');
  assert.equal(f.queue.read('NY:farm', 'missing'), 'missing');
});

test('full auto policy retains enabled and coverage when rapidly composed', async () => {
  const base = { enabled: true, cycles: 2 };
  const queue = new LatestConfigurationQueue<typeof base>((a, b) => a.enabled === b.enabled && a.cycles === b.cycles);
  const authority = new Map([['CA:farm', base]]);
  const requests: typeof base[] = [];
  const gates: ReturnType<typeof deferred<ConfigurationResult>>[] = [];
  const set = (value: typeof base) => queue.enqueue([{ key: 'CA:farm', value }], authority, async ([target]) => {
    requests.push(target.value); const gate = deferred<ConfigurationResult>(); gates.push(gate); return gate.promise;
  }, () => {});
  set({ ...base, cycles: 3 });
  set({ ...queue.read('CA:farm', base), enabled: false });
  set({ ...queue.read('CA:farm', base), cycles: 5 });
  assert.deepEqual(queue.read('CA:farm', base), { enabled: false, cycles: 5 });
  gates[0].resolve({ ok: true, message: 'saved' }); await tick();
  assert.deepEqual(requests, [{ enabled: true, cycles: 3 }, { enabled: false, cycles: 5 }]);
});

test('HTTP rejections and indeterminate transport outcomes remain distinct', () => {
  assert.equal(configurationFailure({ status: 422, message: 'invalid', code: 'INVALID' }).code, 'INVALID');
  for (const status of [0, 408, 429, 500, 503]) {
    assert.equal(configurationFailure({ status }).code, 'OPERATION_RESULT_UNCONFIRMED');
  }
});

test('confirmed state sync coalesces minimum revision and reads again only for newer receipt', async () => {
  const gates: ReturnType<typeof deferred<number>>[] = [];
  let revision = 1; let errors = 0;
  const sync = new ConfirmedActionSync({ current: () => revision, read: async () => {
    const gate = deferred<number>(); gates.push(gate); const result = await gate.promise; revision = result; return result;
  }, onError: () => { errors += 1; } });
  const first = sync.request(2); const second = sync.request(3);
  assert.equal(first, second); assert.equal(gates.length, 1); assert.equal(sync.busy, true);
  gates[0].resolve(2); await tick(); assert.equal(gates.length, 2);
  gates[1].resolve(3); await first; assert.equal(sync.busy, false); assert.equal(errors, 0);
  await sync.request(3); assert.equal(gates.length, 2);
});

test('sync failure releases poll gate and does not retry automatically or turn receipt into failure', async () => {
  let reads = 0; let errors = 0;
  const sync = new ConfirmedActionSync({ current: () => 1, read: async () => { reads += 1; throw new Error('timeout'); }, onError: () => { errors += 1; } });
  await sync.request(2); assert.equal(sync.busy, false); assert.equal(errors, 1); assert.equal(reads, 1);
  await sync.request(3); assert.equal(reads, 2);
  const low = new ConfirmedActionSync({ current: () => 1, read: async () => 1, onError: () => { errors += 1; } });
  await low.request(2); assert.equal(low.busy, false); assert.equal(errors, 3);
});

test('reset aborts old read and its completion cannot release a new session gate', async () => {
  const gates: ReturnType<typeof deferred<number>>[] = [];
  const signals: AbortSignal[] = [];
  let errors = 0;
  const sync = new ConfirmedActionSync({ current: () => -1, read: (signal) => {
    signals.push(signal); const gate = deferred<number>(); gates.push(gate); return gate.promise;
  }, onError: () => { errors += 1; } });
  const first = sync.request(2); sync.reset(); assert.equal(signals[0].aborted, true);
  const second = sync.request(3);
  gates[0].reject(new Error('old')); await first; assert.equal(sync.busy, true);
  gates[1].resolve(3); await second; assert.equal(sync.busy, false); assert.equal(errors, 0);
});

test('sync deadline releases polling even if its transport ignores abort', async () => {
  const gate = deferred<number>(); let errors = 0; let signal: AbortSignal | undefined;
  const sync = new ConfirmedActionSync({ current: () => 1, timeoutMs: 5, read: (incoming) => { signal = incoming; return gate.promise; }, onError: () => { errors += 1; } });
  await sync.request(2);
  assert.equal(sync.busy, false); assert.equal(signal?.aborted, true); assert.equal(errors, 1);
  gate.resolve(2); await tick(); assert.equal(sync.busy, false);
});

test('returning to the in-flight target reuses its receipt and reports the final selection exactly once', async () => {
  const f = fixture();
  f.send([['CA:farm', 'b']]); f.send([['CA:farm', 'c']]); f.send([['CA:farm', 'b']]);
  f.gates[0].resolve({ ok: true, message: 'b', revision: 2 }); await tick();
  assert.equal(f.calls.length, 1); assert.equal(f.notices.length, 1);
  assert.equal(f.notices[0].message, 'b'); assert.equal(f.queue.read('CA:farm', 'a'), 'b');
});

test('first rejected choice ignores stale authority and releases its initial rollback preview', async () => {
  const f = fixture();
  f.send([['CA:farm', 'b']]);
  f.queue.reconcile(f.authority, 6);
  f.gates[0].resolve({ ok: false, message: '配置已变化', revision: 8 }); await tick();
  assert.equal(f.queue.read('CA:farm', 'd'), 'a');
  const updated = new Map([...f.authority, ['CA:farm', 'd']]);
  f.queue.reconcile(updated, 5);
  assert.equal(f.queue.read('CA:farm', 'd'), 'a');
  f.queue.reconcile(updated, 8);
  assert.equal(f.queue.read('CA:farm', 'd'), 'd');
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.notices.map((result) => result.ok), [false]);
});

test('an older rejection receipt cannot lower the last accepted configuration revision', async () => {
  const f = fixture();
  f.send([['CA:farm', 'b']]); f.send([['CA:farm', 'c']]);
  f.gates[0].resolve({ ok: true, message: 'b', revision: 10 }); await tick();
  f.gates[1].resolve({ ok: false, message: '拒绝', revision: 9 }); await tick();
  f.queue.reconcile(f.authority, 9);
  assert.equal(f.queue.read('CA:farm', 'a'), 'b');
  f.queue.reconcile(new Map([...f.authority, ['CA:farm', 'b']]), 10);
  assert.equal(f.queue.read('CA:farm', 'future-authority'), 'future-authority');
});
