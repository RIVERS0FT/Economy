import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthoritativeWriteExecutor } from '../src/authoritative-write-executor.js';
import {
  createRequestPerformanceContext,
  runWithRequestPerformance,
  snapshotRequestPerformance,
} from '../src/request-performance.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('authoritative write executor preserves FIFO order and single concurrency', async () => {
  const executor = new AuthoritativeWriteExecutor();
  const gate = deferred();
  const events = [];
  const first = executor.submit({ actor: 'user:1', operation: 'first' }, async () => {
    events.push('first:start');
    await gate.promise;
    events.push('first:end');
    return 1;
  });
  const second = executor.submit({ actor: 'user:2', operation: 'second' }, () => {
    events.push('second');
    return 2;
  });

  assert.deepEqual(events, ['first:start']);
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second']);
  assert.equal(executor.getDiagnostics().maxDepth, 2);
});

test('authoritative write executor rejects total and per-actor overload', async () => {
  const gate = deferred();
  const executor = new AuthoritativeWriteExecutor({ maxQueueDepth: 2, maxPendingPerActor: 1 });
  const first = executor.submit({ actor: 'user:1' }, () => gate.promise);
  assert.throws(
    () => executor.submit({ actor: 'user:1' }, () => undefined),
    (error) => error?.statusCode === 503 && error?.code === 'WRITE_QUEUE_ACTOR_LIMIT',
  );
  const second = executor.submit({ actor: 'user:2' }, () => undefined);
  assert.throws(
    () => executor.submit({ actor: 'user:3' }, () => undefined),
    (error) => error?.statusCode === 503 && error?.code === 'WRITE_QUEUE_BUSY',
  );
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(executor.getDiagnostics().rejected, 2);
});

test('authoritative write executor expires queued writes before execution', async () => {
  let now = 0;
  const gate = deferred();
  const executor = new AuthoritativeWriteExecutor({ now: () => now, maxWaitMs: 5 });
  const first = executor.submit({ actor: 'user:1' }, () => gate.promise);
  const second = executor.submit({ actor: 'user:2', timeoutMs: 5 }, () => 'must-not-run');
  now = 10;
  gate.resolve();
  await first;
  await assert.rejects(second, (error) => error?.code === 'WRITE_QUEUE_TIMEOUT');
  assert.equal(executor.getDiagnostics().timedOut, 1);
});

test('authoritative write executor records queue phases in the submitting request context', async () => {
  let now = 0;
  const gate = deferred();
  const executor = new AuthoritativeWriteExecutor({ now: () => now });
  const blocker = executor.submit({ actor: 'system:blocker' }, () => gate.promise);
  const context = createRequestPerformanceContext();
  const queued = runWithRequestPerformance(context, () => executor.submit(
    { actor: 'user:1', operation: 'measured' },
    () => 'ok',
  ));
  now = 25;
  gate.resolve();
  await blocker;
  assert.equal(await queued, 'ok');
  const snapshot = snapshotRequestPerformance(context);
  assert.equal(snapshot.phases.writeQueueWaitMs, 25);
  assert.ok(snapshot.phases.writeExecutionMs >= 0);
  assert.equal(snapshot.gauges.writeQueueRejected, 0);
});

test('authoritative write executor drains accepted work during graceful close', async () => {
  const gate = deferred();
  const executor = new AuthoritativeWriteExecutor();
  const first = executor.submit({ actor: 'user:1' }, () => gate.promise);
  const second = executor.submit({ actor: 'user:2' }, () => 2);
  const closing = executor.close({ drain: true });
  assert.throws(
    () => executor.submit({ actor: 'user:3' }, () => 3),
    (error) => error?.code === 'WRITE_QUEUE_CLOSED',
  );
  gate.resolve(1);
  assert.equal(await first, 1);
  assert.equal(await second, 2);
  await closing;
  assert.equal(executor.isIdle(), true);
  assert.equal(executor.getDiagnostics().accepting, false);
});
