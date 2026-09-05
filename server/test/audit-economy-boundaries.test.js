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
