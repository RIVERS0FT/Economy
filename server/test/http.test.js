import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const accountPort = 43101;
const gamePort = 43102;

async function waitFor(url, attempts = 50) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry while the child process starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function mergePatches(current, patches) {
  const next = { ...(current || {}) };
  for (const patch of Object.values(patches || {})) Object.assign(next, patch);
  return next;
}

function revisionQuery(revision, partitionRevisions) {
  const params = new URLSearchParams({ revision: String(revision), ...partitionRevisions });
  return params.toString();
}

test('HTTP API authenticates through the shared account service and honors idempotency', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-api-test-'));
  let accountRequestCount = 0;
  const accountServer = createServer((request, response) => {
    accountRequestCount += 1;
    if (request.headers.host !== 'riversoft.top') {
      response.writeHead(400).end();
      return;
    }
    if (request.headers.cookie !== 'session=ok') {
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: 'unauthorized' }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ user: { id: 7, email: 'server@example.com', name: 'Server Player' } }));
  });
  await new Promise((resolve) => accountServer.listen(accountPort, '127.0.0.1', resolve));

  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      PORT: String(gamePort),
      ECONOMY_DB_PATH: join(directory, 'economy.sqlite'),
      ACCOUNT_SERVICE_URL: `http://127.0.0.1:${accountPort}`,
      ACCOUNT_SERVICE_HOST: 'riversoft.top',
      PUBLIC_ORIGIN: 'https://game.riversoft.top',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitFor(`http://127.0.0.1:${gamePort}/health`);

    const unauthorized = await fetch(`http://127.0.0.1:${gamePort}/api/game/state`);
    assert.equal(unauthorized.status, 401);

    const stateResponse = await fetch(`http://127.0.0.1:${gamePort}/api/game/state`, {
      headers: { Cookie: 'session=ok' },
    });
    assert.equal(stateResponse.status, 200);
    const statePayload = await stateResponse.json();
    const initialState = mergePatches(null, statePayload.patches);
    assert.equal(initialState.credits, 100);
    assert.equal(statePayload.unchanged, false);
    assert.equal(Number.isFinite(statePayload.serverNow), true);
    assert.equal('serverNow' in initialState, false);
    assert.equal('state' in statePayload, false);
    assert.deepEqual(Object.keys(statePayload.partitionRevisions).sort(), [
      'auction', 'catalog', 'leaderboard', 'market', 'player',
    ]);
    assert.equal(Number.isInteger(statePayload.revision), true);

    const unchangedResponse = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/state?${revisionQuery(statePayload.revision, statePayload.partitionRevisions)}`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(unchangedResponse.status, 200);
    const unchangedPayload = await unchangedResponse.json();
    assert.deepEqual(Object.keys(unchangedPayload).sort(), ['revision', 'serverNow', 'unchanged']);
    assert.equal(unchangedPayload.revision, statePayload.revision);
    assert.equal(unchangedPayload.unchanged, true);
    assert.equal(unchangedPayload.serverNow >= statePayload.serverNow, true);

    const headers = {
      Cookie: 'session=ok',
      Origin: 'https://game.riversoft.top',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'http-test-request-1',
    };
    const first = await fetch(`http://127.0.0.1:${gamePort}/api/game/work`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    assert.equal(first.status, 200);
    const firstPayload = await first.json();
    assert.deepEqual(Object.keys(firstPayload).sort(), ['result', 'revision']);
    assert.deepEqual(Object.keys(firstPayload.result).sort(), ['message', 'ok']);
    assert.equal(firstPayload.result.ok, true);
    assert.equal(typeof firstPayload.result.message, 'string');
    assert.equal(firstPayload.revision > statePayload.revision, true);

    const actionStateResponse = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/state?${revisionQuery(statePayload.revision, statePayload.partitionRevisions)}`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(actionStateResponse.status, 200);
    const actionStatePayload = await actionStateResponse.json();
    const actionState = mergePatches(initialState, actionStatePayload.patches);
    assert.equal(actionState.credits, 101);
    assert.equal(actionStatePayload.revision >= firstPayload.revision, true);
    assert.equal(actionStatePayload.serverNow >= unchangedPayload.serverNow, true);

    const repeated = await fetch(`http://127.0.0.1:${gamePort}/api/game/work`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    assert.equal(repeated.status, 200);
    const repeatedPayload = await repeated.json();
    assert.deepEqual(repeatedPayload, firstPayload);

    const repeatedStateResponse = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/state?${revisionQuery(actionStatePayload.revision, actionStatePayload.partitionRevisions)}`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(repeatedStateResponse.status, 200);
    const repeatedStatePayload = await repeatedStateResponse.json();
    assert.deepEqual(Object.keys(repeatedStatePayload).sort(), ['revision', 'serverNow', 'unchanged']);
    assert.equal(repeatedStatePayload.revision, actionStatePayload.revision);
    assert.equal(repeatedStatePayload.unchanged, true);
    assert.equal(repeatedStatePayload.serverNow >= actionStatePayload.serverNow, true);
    assert.equal(accountRequestCount, 1);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
    await new Promise((resolve) => accountServer.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
