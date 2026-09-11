import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, commoditySystemPriceFor, ensurePlayer } from '../src/domain.js';
import { PROVINCE_CATALOG } from '../src/provinces.js';
import policy from '../../shared/commodity-investment-policy.json' with { type: 'json' };
import {
  archiveCashPriceDay, cashDateKey, commodityInvestmentPeriod, commodityInvestmentQuote,
  officialCashPrice, pruneCashPriceArchive,
} from '../src/commodity-investment-prices.js';
const DAY = 86400000;
const NOW = Date.parse('2026-09-10T08:00:00Z');

test('a missing regional quote cannot silently turn into a base-price component of the global index', () => {
  const world = createWorld(NOW); const before = structuredClone(world);
  assert.throws(() => commodityInvestmentQuote(world, 'wheat', NOW), { code: 'CASH_PRICE_UNAVAILABLE' });
  assert.deepEqual(world, before);
});

test('the global index uses the fixed 48-region integer weights, rounded once to a cent', () => {
  const world = createWorld(NOW);
  let numerator = 0n; let denominator = 0n;
  for (let n = 0; n < PROVINCE_CATALOG.length; n += 1) {
    const province = PROVINCE_CATALOG[n];
    commoditySystemPriceFor(world, 'wheat', province.id, NOW);
    const cents = 1000 + n;
    world.markets[`${province.id}:wheat`].officialPrice = cents / 100;
    const weight = BigInt(policy.weights.find((row) => row.provinceId === province.id).weight);
    numerator += BigInt(cents) * weight; denominator += weight;
  }
  const quote = commodityInvestmentQuote(world, 'wheat', NOW);
  assert.equal(Math.round(quote.price * 100), Number((numerator + denominator / 2n) / denominator));
  const before = structuredClone(world);
  assert.deepEqual(commodityInvestmentQuote(world, 'wheat', NOW), quote);
  assert.deepEqual(world, before);
});

test('expiry switches to the next period exactly at Monday midnight in the authoritative timezone', () => {
  const close = Date.parse('2026-09-13T16:00:00Z');
  assert.equal(commodityInvestmentPeriod(close - 1).endsAt, close);
  assert.equal(commodityInvestmentPeriod(close).startsAt, close);
  assert.equal(commodityInvestmentPeriod(close).key, '2026-09-14');
  assert.equal(commodityInvestmentPeriod(close).endsAt, close + 7 * DAY);
});

test('contradicting historical and archived prices is an error rather than an arbitrary precedence choice', () => {
  const world = createWorld(NOW); archiveCashPriceDay(world, NOW);
  world.markets['110000:wheat'].dailyHistory = [{ dateKey: cashDateKey(NOW), price: 123 }];
  const before = structuredClone(world);
  assert.throws(() => officialCashPrice(world, '110000', 'wheat', NOW), { code: 'CASH_PRICE_CONFLICT' });
  assert.deepEqual(world, before);
});

test('archive pruning retains 30 days and all unresolved real obligation dates, not unlimited old history', () => {
  const world = createWorld(NOW); const player = ensurePlayer(world, { id: 912, name: 'history' }, NOW);
  world.cashPriceArchive = { version: 1, days: {} };
  for (let n = 0; n < 90; n += 1) world.cashPriceArchive.days[cashDateKey(NOW - n * DAY)] = { prices: { '110000:wheat': 10 } };
  player.facilityGroups = [{ cashCycle: { completesAt: NOW - 60 * DAY } }];
  player.commodityInvestmentAccount = { positions: { old: { expiresAt: NOW - 50 * DAY } } };
  const original = structuredClone(world.cashPriceArchive);
  assert.equal(pruneCashPriceArchive(world, NOW), true);
  assert.equal(Object.keys(world.cashPriceArchive.days).length, 32);
  assert.deepEqual(world.cashPriceArchive.days[cashDateKey(NOW - 60 * DAY)], original.days[cashDateKey(NOW - 60 * DAY)]);
  assert.deepEqual(world.cashPriceArchive.days[cashDateKey(NOW - 50 * DAY)], original.days[cashDateKey(NOW - 50 * DAY)]);
  assert.equal(pruneCashPriceArchive(world, NOW), false);
  player.facilityGroups = []; player.commodityInvestmentAccount.positions = {};
  assert.equal(pruneCashPriceArchive(world, NOW), true);
  assert.equal(Object.keys(world.cashPriceArchive.days).length, 30);
});

test('archive pruning refuses an unknown archive version without modifying it', () => {
  const world = { cashPriceArchive: { version: 99, days: { '2020-01-01': { prices: {} } } } };
  const before = structuredClone(world);
  assert.throws(() => pruneCashPriceArchive(world, NOW), { code: 'CASH_PRICE_ARCHIVE_VERSION' });
  assert.deepEqual(world, before);
});
