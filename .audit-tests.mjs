import { writeFileSync, readFileSync, existsSync } from 'node:fs';
function put(path, content) { if (existsSync(path)) throw new Error('File already exists: ' + path); writeFileSync(path, content.trimStart().replace(/\s*$/, '\n')); }
put('server/test/audit-economy-boundaries.test.js', `
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer, migrateWorld, processWorld } from '../src/domain.js';
import { applyCommercialBuildingAction, ensureCommercialPlayer, COMMERCIAL_BUILDING_TYPE_CATALOG } from '../src/commercial-buildings.js';
import { createMarketDetail } from '../src/market-state-delivery.js';
import { provinceScopedKey } from '../src/provinces.js';
import { assertGameWriteIdentity } from '../src/game-write-identity.js';

const now = Date.parse('2026-09-04T12:00:00+08:00');
const user = { id: 77181, email: 'audit-boundaries@example.com', name: 'Audit' };
const type = COMMERCIAL_BUILDING_TYPE_CATALOG[0];
function setup() {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  ensureCommercialPlayer(player, now);
  player.credits = 100_000_000;
  return { world, player };
}
test('commercial build rejects missing, nonnumeric, fractional and out-of-range quantities without changing assets', () => {
  const { world, player } = setup();
  for (const quantity of [undefined, null, true, false, '1', 1.9, 100.9, 0, -1, 101, Number.MAX_SAFE_INTEGER, NaN, Infinity]) {
    const before = JSON.stringify(player);
    const result = applyCommercialBuildingAction(world, user, { operation: 'build', provinceId: '110000', commercialTypeId: type.id, quantity }, now);
    assert.equal(result.ok, false, 'accepted quantity ' + String(quantity));
    assert.equal(JSON.stringify(player), before);
  }
  for (const quantity of [1, 100]) {
    const result = applyCommercialBuildingAction(world, user, { operation: 'build', provinceId: '110000', commercialTypeId: type.id, quantity }, now);
    assert.equal(result.ok, true, result.message);
  }
  assert.equal(player.commercialBuildingGroups[0].count, 101);
});
test('commercial actions never redirect missing or invalid provinces to the default province', () => {
  const { world, player } = setup();
  for (const provinceId of [undefined, null, '', 'not-a-province', 110000, true]) {
    for (const operation of ['build', 'start', 'stop', 'auto-operation']) {
      const before = JSON.stringify(player);
      const result = applyCommercialBuildingAction(world, user, { operation, provinceId, commercialTypeId: type.id, quantity: 1 }, now);
      assert.equal(result.ok, false);
      assert.equal(JSON.stringify(player), before);
    }
  }
});
test('multi-day recovery archives actual old-day volumes without applying them to the current price', () => {
  const world = createWorld(now);
  for (const demand of Object.values(world.demandGroups)) demand.nextDemandAt = now + 90 * 86_400_000;
  const key = provinceScopedKey('110000', 'ore');
  const market = world.markets[key];
  market.officialPrice = 10;
  market.todayBuyQuantity = 100;
  market.todaySellQuantity = 30;
  const later = now + 2 * 86_400_000;
  processWorld(world, later);
  assert.equal(market.officialPrice, 10);
  assert.equal(market.previousDayBuyQuantity, 0);
  assert.equal(market.previousDaySellQuantity, 0);
  const archived = market.dailyHistory.find((entry) => entry.dateKey === '2026-09-04');
  assert.equal(archived.buyQuantity, 100);
  assert.equal(archived.sellQuantity, 30);
  assert.equal(archived.volume, 130);
  const detail = createMarketDetail(world, { provinceId: '110000', assetKind: 'commodity', assetId: 'ore', now: later });
  assert.equal(detail.market.dailyHistory.find((entry) => entry.dateKey === '2026-09-04').volume, 130);
  const restored = migrateWorld(JSON.parse(JSON.stringify(world)), later + 1);
  processWorld(restored, later + 2);
  assert.equal(restored.markets[key].dailyHistory.filter((entry) => entry.dateKey === '2026-09-04').length, 1);
  assert.equal(restored.markets[key].dailyHistory.find((entry) => entry.dateKey === '2026-09-04').volume, 130);
});
test('expected write identity never authorizes an account and rejects stale cookies before execution', () => {
  assert.doesNotThrow(() => assertGameWriteIdentity({ id: 10 }, '10'));
  assert.doesNotThrow(() => assertGameWriteIdentity({ id: 10 }, undefined));
  for (const expected of ['11', '', '0', '-1', '1.0', '1e1', '9007199254740992', ['10'], true, null]) {
    let executed = false;
    assert.throws(() => { assertGameWriteIdentity({ id: 10 }, expected); executed = true; },
      (error) => error.statusCode === 409 && error.code === 'WRITE_SESSION_MISMATCH');
    assert.equal(executed, false);
  }
});
`);
put('tests/dt/commercial-input-availability.test.ts', `
import assert from 'node:assert/strict';
import test from 'node:test';
import { commercialNextCycleAvailability } from '../../src/utils/commercialInputAvailability.ts';
import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../../src/types/commercial.ts';
import type { CommodityFreezeDetail, ProductInventory } from '../../src/types.ts';
const now = 1_800_000_000_000;
const type = { consumptionInputs: [{ productId: 'food', quantity: 2 }] } as CommercialBuildingTypeDefinition;
function group(extra = {}) { return { provinceId: '110000', commercialTypeId: 'convenience-store', count: 10,
  status: 'stopped', enabled: false, staffingRateBps: 5000, staffingUpdatedAt: now, staffingBatchCarryBps: 0, ...extra } as CommercialBuildingGroup; }
function inventories(available: number, frozen = 0) { return { food: { available, frozen } } as Record<string, ProductInventory>; }
function entry(kind: CommodityFreezeDetail['kind'], sourceId: string, quantity: number): CommodityFreezeDetail { return { kind, sourceId, quantity, label: 'fixture' }; }
test('half staffed demand uses integer effective operation rather than the entire cluster', () => {
  const result = commercialNextCycleAvailability(group(), type, inventories(12), {}, now);
  assert.equal(result.required?.food, 10);
  assert.equal(result.usable.food, 12);
});
test('only this regional commercial source can satisfy next cycle demand', () => {
  const details = { food: [entry('commercial', '110000:convenience-store', 20),
    entry('commercial', '120000:convenience-store', 20), entry('commercial', '110000:restaurant', 20),
    entry('production', '110000:convenience-store', 20), entry('contract', 'contract-1', 20), entry('legacy', 'unattributed', 20)] };
  const result = commercialNextCycleAvailability(group({ staffingRateBps: 10000 }), type, inventories(0, 120), details, now);
  assert.equal(result.required?.food, 20);
  assert.equal(result.usable.food, 20);
  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 120), { food: details.food.slice(1) }, now).usable.food, 0);
});
test('next running cycle projects staffing at its deadline and preserves locked inputs', () => {
  const value = group({ enabled: true, status: 'running', cycleActive: true, cycleStartedAt: now,
    cycleCompletesAt: now + 300000, pendingInputs: [{ productId: 'food', quantity: 10 }], pendingRevenue: 100 });
  const before = JSON.stringify(value);
  const result = commercialNextCycleAvailability(value, type, inventories(20), {}, now);
  assert.equal(result.required?.food, 20);
  assert.equal(JSON.stringify(value), before);
  assert.equal(commercialNextCycleAvailability(group({ count: 3, staffingBatchCarryBps: 5000 }), type, inventories(4), {}, now).required?.food, 4);
});
test('missing staffing and missing frozen attribution remain unknown while zero demand stays zero', () => {
  assert.equal(commercialNextCycleAvailability(group({ staffingRateBps: undefined }), type, inventories(0), {}, now).required, undefined);
  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 20), undefined, now).usable.food, null);
  assert.equal(commercialNextCycleAvailability(group({ staffingRateBps: 0 }), type, inventories(0), {}, now).required?.food, 0);
});
`);
put('tests/dt/game-write-session.test.ts', `
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
`);
put('tests/browser/write-session-boundaries.spec.ts', `
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/audit-write-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Write boundary harness</title>' }));
  await page.goto('audit-write-harness');
});

test('rapid start-stop-start receives three ordered keys and keeps the final intent', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl);
    beginGameWriteSession(801);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    const calls: { key: string; path: string }[] = [];
    const cache = new Set<string>();
    let enabled = false;
    const client = createIdempotentGameWriteFetch(async (input: RequestInfo | URL, init: RequestInit) => {
      const key = new Headers(init.headers).get('Idempotency-Key')!;
      const path = String(input);
      calls.push({ key, path });
      if (calls.length === 1) { started(); await gate; }
      if (!cache.has(key)) { cache.add(key); enabled = path.endsWith('/start'); }
      return Response.json({ result: { ok: true, message: 'confirmed' }, revision: calls.length });
    });
    const send = (action: string, key: string) => client('/economy-api/game/facilities/wheat-farm/' + action,
      { method: 'POST', headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '0' }, body: JSON.stringify({ provinceId: '110000' }) });
    const first = send('start', 'audit-start-first');
    const second = send('stop', 'audit-stop-second');
    const third = send('start', 'audit-start-third');
    await firstStarted;
    release();
    await Promise.all([first, second, third]);
    return { keys: calls.map((call) => call.key), enabled };
  });
  expect(result.keys).toEqual(['audit-start-first', 'audit-stop-second', 'audit-start-third']);
  expect(result.enabled).toBe(true);
});

test('unconfirmed control blocks an opposite command and only the original key can confirm it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl);
    beginGameWriteSession(802);
    const keys: string[] = [];
    const client = createIdempotentGameWriteFetch(async (_input: RequestInfo | URL, init: RequestInit) => {
      keys.push(new Headers(init.headers).get('Idempotency-Key')!);
      return keys.length === 1 ? Response.json({ message: 'unknown' }, { status: 503 })
        : Response.json({ result: { ok: true, message: 'confirmed' }, revision: keys.length });
    });
    const send = (action: string, key: string) => client('/economy-api/game/facilities/wheat-farm/' + action,
      { method: 'POST', headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '0' }, body: JSON.stringify({ provinceId: '110000' }) });
    await send('start', 'unknown-start-first');
    let blocked = '';
    try { await send('stop', 'unknown-stop-second'); } catch (error) { blocked = (error as { code: string }).code; }
    await send('start', 'replacement-not-used');
    await send('stop', 'confirmed-stop-final');
    return { blocked, keys };
  });
  expect(result.blocked).toBe('WRITE_RESULT_UNCONFIRMED');
  expect(result.keys).toEqual(['unknown-start-first', 'unknown-start-first', 'confirmed-stop-final']);
});

test('account switch aborts the old result, isolates identical writes and preserves the original account reservation', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession, endGameWriteSession } = await import(sessionUrl);
    const calls: { user: string; key: string }[] = [];
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    const client = createIdempotentGameWriteFetch(async (_input: RequestInfo | URL, init: RequestInit) => {
      const headers = new Headers(init.headers);
      const user = headers.get('X-Economy-User-Id')!;
      calls.push({ user, key: headers.get('Idempotency-Key')! });
      if (calls.length === 1) { started(); await gate; }
      return Response.json({ result: { ok: true, message: user }, revision: calls.length });
    });
    const send = (key: string) => client('/economy-api/game/orders', { method: 'POST',
      headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '0' },
      body: JSON.stringify({ assetKind: 'commodity', productId: 'ore', side: 'buy', quantity: 1, provinceId: '110000' }) });
    beginGameWriteSession(803);
    const old = send('account-a-original').then(() => 'incorrect-success', (error: { code: string }) => error.code);
    await firstStarted;
    endGameWriteSession();
    beginGameWriteSession(804);
    const second = await (await send('account-b-original')).json();
    release();
    const oldCode = await old;
    endGameWriteSession();
    beginGameWriteSession(803);
    await send('account-a-new-key-not-used');
    return { calls, oldCode, second: second.result.message };
  });
  expect(result.oldCode).toBe('WRITE_SESSION_CHANGED');
  expect(result.second).toBe('804');
  expect(result.calls).toEqual([{ user: '803', key: 'account-a-original' }, { user: '804', key: 'account-b-original' }, { user: '803', key: 'account-a-original' }]);
});

test('logout prevents queued controls and prevents a retry after transport failure', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const confirmationUrl = '/economy/src/api/gameWriteConfirmation.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const session = await import(sessionUrl);
    const { fetchConfirmedGameWrite } = await import(confirmationUrl);
    session.beginGameWriteSession(805);
    let started!: () => void;
    let release!: () => void;
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const client = createIdempotentGameWriteFetch(async () => { calls += 1; started(); await gate;
      return Response.json({ result: { ok: true, message: 'old' }, revision: 1 }); });
    const send = (action: string) => client('/economy-api/game/facilities/wheat-farm/' + action, { method: 'POST',
      headers: { 'Idempotency-Key': 'queued-' + action, 'X-Economy-Save-Epoch': '0' }, body: JSON.stringify({ provinceId: '110000' }) })
      .then(() => 'incorrect-success', (error: { code: string }) => error.code);
    const first = send('start');
    const second = send('stop');
    await firstStarted;
    session.endGameWriteSession();
    release();
    const codes = await Promise.all([first, second]);
    session.beginGameWriteSession(806);
    const captured = session.captureGameWriteSession();
    let retries = 0;
    let retryCode = '';
    try { await fetchConfirmedGameWrite(async () => { retries += 1; throw new TypeError('lost connection'); }, '/economy-api/game/orders', {},
      { timeoutMs: 1000, sessionSignal: captured.signal, onConfirming: session.endGameWriteSession }); }
    catch (error) { retryCode = (error as { code: string }).code; }
    return { calls, codes, retries, retryCode };
  });
  expect(result.calls).toBe(1);
  expect(result.codes).toEqual(['WRITE_SESSION_CHANGED', 'WRITE_SESSION_CHANGED']);
  expect(result.retries).toBe(1);
  expect(result.retryCode).toBe('WRITE_SESSION_CHANGED');
});
`);
console.log('AUDIT_REGRESSIONS_ADDED');
