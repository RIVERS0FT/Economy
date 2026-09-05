import assert from 'node:assert/strict';
import test from 'node:test';
import { beginGameWriteSession, endGameWriteSession, captureGameWriteSession, assertGameWriteSession,
  isCurrentGameWriteSession, subscribeGameWriteSession } from '../../src/api/gameWriteSession.ts';
test('write identity is stable within a session and old lifetime aborts across logout or account changes', () => {
  let changes = 0;
  const stop = subscribeGameWriteSession(() => { changes += 1; });
  beginGameWriteSession(7);
  const first = captureGameWriteSession();
  beginGameWriteSession(7);
  assert.equal(captureGameWriteSession(), first);
  assert.equal(isCurrentGameWriteSession(first), true);
  beginGameWriteSession(8);
  assert.equal(first.signal.aborted, true);
  assert.throws(() => assertGameWriteSession(first), { code: 'WRITE_SESSION_CHANGED' });
  assert.equal(captureGameWriteSession().userId, 8);
  const second = captureGameWriteSession();
  endGameWriteSession();
  assert.equal(second.signal.aborted, true);
  assert.throws(captureGameWriteSession, { code: 'WRITE_SESSION_CHANGED' });
  beginGameWriteSession(7);
  assert.notEqual(captureGameWriteSession().generation, first.generation);
  assert.equal(changes, 4);
  stop();
  endGameWriteSession();
  assert.equal(changes, 4);
  for (const id of [0, -1, 1.5, Infinity]) assert.throws(() => beginGameWriteSession(id), TypeError);
});
