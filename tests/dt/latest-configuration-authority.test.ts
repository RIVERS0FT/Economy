import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LatestConfigurationQueue, type ConfigurationResult, type ConfigurationTarget } from '../../src/app/latestConfigurationQueue.ts';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
  const queue = new LatestConfigurationQueue<string>();
  const authority = new Map([['CA:farm', 'a']]);
  const calls: ConfigurationTarget<string>[][] = [];
  const replies: Array<(result: ConfigurationResult) => void> = [];
  const notices: ConfigurationResult[] = [];
  const submit = (targets: ConfigurationTarget<string>[]) => {
    calls.push(targets);
    return new Promise<ConfigurationResult>((resolve) => replies.push(resolve));
  };
  const send = (value: string) => queue.enqueue([{ key: 'CA:farm', value }], authority, submit, (result) => notices.push(result));
  const observe = (value: string, revision: number) => queue.reconcile(new Map([['CA:farm', value]]), revision);
  return { queue, calls, replies, notices, send, observe };
}

test('first rejected configuration rolls back to newer authority observed while the write was pending', async () => {
  const f = fixture();
  f.send('b');
  f.observe('d', 10);
  assert.equal(f.queue.read('CA:farm', 'd'), 'b');
  f.observe('a', 9);
  f.replies[0]({ ok: false, message: 'rejected', revision: 11 });
  await tick();
  assert.equal(f.queue.read('CA:farm', 'd'), 'd');
  f.observe('a', 9);
  assert.equal(f.queue.read('CA:farm', 'a'), 'd');
  f.observe('d', 11);
  assert.equal(f.queue.read('CA:farm', 'later authority'), 'later authority');
  assert.equal(f.queue.isBusy('CA:farm'), false);
  assert.equal(f.calls.length, 1);
});

test('a late receipt cannot overwrite newer authority or incorrectly elide a queued target', async () => {
  const f = fixture();
  f.send('b'); f.send('c'); f.send('b');
  f.observe('d', 10);
  f.replies[0]({ ok: true, message: 'old b', revision: 2 });
  await tick();
  assert.deepEqual(f.calls, [[{ key: 'CA:farm', value: 'b' }], [{ key: 'CA:farm', value: 'b' }]]);
  assert.equal(f.queue.read('CA:farm', 'd'), 'b');
  f.replies[1]({ ok: false, message: 'rejected', revision: 11 });
  await tick();
  assert.equal(f.queue.read('CA:farm', 'd'), 'd');
  assert.deepEqual(f.notices.map((result) => result.message), ['rejected']);
});

test('a newer authoritative target avoids a redundant successor without releasing an unconfirmed predecessor', async () => {
  const f = fixture();
  f.send('b'); f.send('c');
  f.replies[0]({ ok: false, message: 'unknown', code: 'OPERATION_RESULT_UNCONFIRMED' });
  await tick();
  f.observe('c', 10);
  assert.equal(f.queue.isBusy('CA:farm'), true);
  assert.equal(f.calls.length, 1);
  f.send('c');
  assert.deepEqual(f.calls[1], f.calls[0]);
  f.replies[1]({ ok: true, message: 'old b', revision: 2 });
  await tick();
  assert.equal(f.calls.length, 2);
  assert.equal(f.queue.isBusy('CA:farm'), false);
  assert.equal(f.queue.read('CA:farm', 'c'), 'c');
  assert.equal(f.notices.filter((result) => result.ok).length, 1);
});

test('a newer local receipt still wins over an older observed snapshot', async () => {
  const f = fixture();
  f.send('b'); f.send('c');
  f.observe('a', 1);
  f.replies[0]({ ok: true, message: 'b', revision: 5 });
  await tick();
  f.observe('a', 4);
  f.replies[1]({ ok: false, message: 'rejected', revision: 6 });
  await tick();
  assert.equal(f.queue.read('CA:farm', 'a'), 'b');
  f.observe('b', 5);
  assert.equal(f.queue.read('CA:farm', 'future'), 'future');
});
