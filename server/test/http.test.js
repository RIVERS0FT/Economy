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
const HTTP_API_READY_TIMEOUT_MS = 15_000;
const HTTP_API_PROBE_TIMEOUT_MS = 1_000;
const HTTP_API_RETRY_INTERVAL_MS = 50;

async function waitFor(url, timeoutMs = HTTP_API_READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastProbeFailure = 'no response';
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Math.min(HTTP_API_PROBE_TIMEOUT_MS, remaining)),
      });
      if (response.ok) return;
      lastProbeFailure = `HTTP ${response.status}`;
    } catch (error) {
      lastProbeFailure = error instanceof Error ? error.message : String(error);
    }
    const retryDelay = Math.min(HTTP_API_RETRY_INTERVAL_MS, Math.max(0, deadline - Date.now()));
    if (retryDelay > 0) await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${url}; last probe: ${lastProbeFailure}`);
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
  let childStdout = '';
  let childStderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { childStdout += chunk; });
  child.stderr.on('data', (chunk) => { childStderr += chunk; });

  try {
    try {
      await waitFor(`http://127.0.0.1:${gamePort}/health`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${message}\nchild stdout:\n${childStdout || '(empty)'}\nchild stderr:\n${childStderr || '(empty)'}`,
        { cause: error },
      );
    }

    const unauthorized = await fetch(`http://127.0.0.1:${gamePort}/api/game/state`);
    assert.equal(unauthorized.status, 401);
    const unauthorizedMarketDetail = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/market-detail?provinceId=110000&assetKind=commodity&assetId=wheat`,
    );
    assert.equal(unauthorizedMarketDetail.status, 401);

    const stateResponse = await fetch(`http://127.0.0.1:${gamePort}/api/game/state`, {
      headers: { Cookie: 'session=ok' },
    });
    assert.equal(stateResponse.status, 200);
    assert.match(String(stateResponse.headers.get('server-timing') || ''), /^app;dur=[0-9]+(?:\.[0-9]+)?$/);
    const statePayload = await stateResponse.json();
    const initialState = mergePatches(null, statePayload.patches);
    assert.equal(initialState.credits, 500);
    assert.equal(statePayload.unchanged, false);
    assert.equal(Number.isFinite(statePayload.serverNow), true);
    assert.equal('serverNow' in initialState, false);
    assert.equal('state' in statePayload, false);
    assert.deepEqual(Object.keys(statePayload.partitionRevisions).sort(), [
      'auction', 'catalog', 'contract', 'leaderboard', 'market', 'player',
    ]);
    assert.equal(Number.isInteger(statePayload.revision), true);

    const marketDetailResponse = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/market-detail?provinceId=110000&assetKind=commodity&assetId=wheat`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(marketDetailResponse.status, 200);
    const marketDetailPayload = await marketDetailResponse.json();
    assert.equal(marketDetailPayload.unchanged, false);
    assert.equal(marketDetailPayload.marketDetail.assetId, 'wheat');
    assert.equal(Array.isArray(marketDetailPayload.marketDetail.orderBook.bids), true);
    assert.equal(Array.isArray(marketDetailPayload.marketDetail.orderBook.asks), true);
    const unchangedMarketDetailResponse = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/market-detail?provinceId=110000&assetKind=commodity&assetId=wheat&revision=${marketDetailPayload.marketDetailRevision}`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(unchangedMarketDetailResponse.status, 200);
    const unchangedMarketDetailPayload = await unchangedMarketDetailResponse.json();
    assert.equal(unchangedMarketDetailPayload.unchanged, true);
    assert.equal('marketDetail' in unchangedMarketDetailPayload, false);

    const invalidMarketDetail = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/market-detail?provinceId=110000&assetKind=commodity&assetId=missing`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(invalidMarketDetail.status, 404);

    const facilityBuildQuoteResponse = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/facility-build-quote?provinceId=110000&facilityTypeId=ranch&quantity=1`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(facilityBuildQuoteResponse.status, 200);
    const facilityBuildQuotePayload = await facilityBuildQuoteResponse.json();
    assert.equal(facilityBuildQuotePayload.quote.missingQuantity, 5);
    assert.equal(typeof facilityBuildQuotePayload.quote.complete, 'boolean');
    const invalidFacilityBuildQuote = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/facility-build-quote?provinceId=110000&facilityTypeId=ranch&quantity=0`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(invalidFacilityBuildQuote.status, 400);
    const missingProvinceBuildQuote = await fetch(
      `http://127.0.0.1:${gamePort}/api/game/facility-build-quote?provinceId=missing&facilityTypeId=ranch&quantity=1`,
      { headers: { Cookie: 'session=ok' } },
    );
    assert.equal(missingProvinceBuildQuote.status, 404);

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
    const first = await fetch(`http://127.0.0.1:${gamePort}/api/game/profile`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ playerName: 'Server Player Updated' }),
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
    assert.equal(actionState.playerName, 'Server Player Updated');
    assert.equal(actionState.credits, 500);
    assert.equal(actionStatePayload.revision >= firstPayload.revision, true);
    assert.equal(actionStatePayload.serverNow >= unchangedPayload.serverNow, true);

    const repeated = await fetch(`http://127.0.0.1:${gamePort}/api/game/profile`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ playerName: 'Server Player Updated' }),
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

    const retiredWork = await fetch(`http://127.0.0.1:${gamePort}/api/game/work`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'retired-work-route' },
      body: '{}',
    });
    assert.equal(retiredWork.status, 404);
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
