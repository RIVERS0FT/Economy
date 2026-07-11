import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

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

test('HTTP API authenticates through the shared account service and honors idempotency', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-api-test-'));
  const accountServer = createServer((request, response) => {
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
    cwd: new URL('..', import.meta.url).pathname,
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
    assert.equal((await stateResponse.json()).state.credits, 100);

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
    assert.equal((await first.json()).state.credits, 101);

    const repeated = await fetch(`http://127.0.0.1:${gamePort}/api/game/work`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).state.credits, 101);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await new Promise((resolve) => accountServer.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
