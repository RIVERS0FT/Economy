import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWorld, ensurePlayer, commoditySystemPriceFor } from '../src/domain.js';
import { PROVINCE_CATALOG, inventoryForProvince } from '../src/provinces.js';
import { freezeCommodity } from '../src/commodity-freezes.js';
import { EconomyStore } from '../src/runtime-store.js';
import {
  applyCommodityInvestmentTrade, assertCommodityInvestmentAccount, commodityInvestmentValuation,
  settleDueCommodityInvestments,
} from '../src/commodity-investments.js';
import {
  archiveCashPriceDay, cashDateKey, commodityInvestmentPeriod, commodityInvestmentQuote,
  officialCashPrice,
} from '../src/commodity-investment-prices.js';

const NOW = Date.parse('2026-09-10T08:00:00Z');
const USER = { id: 901, name: 'cash-investment-test' };
function priceAll(world, productId, price, at = NOW) {
  for (const province of PROVINCE_CATALOG) {
    commoditySystemPriceFor(world, productId, province.id, at);
    const market = world.markets[`${province.id}:${productId}`];
    market.officialPrice = price;
    market.priceDateKey = cashDateKey(at);
  }
}
function setup() {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, USER, NOW);
  player.credits = 10000;
  priceAll(world, 'wheat', 10);
  return { world, player };
}
function trade(world, player, side, quantity, productId = 'wheat', now = NOW) {
  const quote = commodityInvestmentQuote(world, productId, now);
  return applyCommodityInvestmentTrade(world, player, { ...quote, side, quantity }, now);
}
function state(player) { return structuredClone(player); }

test('full-funded commodity positions never buy, sell or freeze physical stock and never move market volumes', () => {
  const { world, player } = setup();
  const inventory = inventoryForProvince(player, 'wheat', '110000');
  inventory.available = 50;
  freezeCommodity(inventory, 'contract', 'unchanged-contract', 20);
  const before = structuredClone({ inventories: player.inventories, markets: world.markets, orders: world.orders });
  const result = trade(world, player, 'buy', 100);
  assert.equal(result.transaction.cashChange, -1000);
  assert.equal(player.credits, 9000);
  assert.equal(commodityInvestmentValuation(world, player, NOW).equity, 1000);
  assert.equal(commodityInvestmentValuation(world, player, NOW).principal, 1000);
  assert.deepEqual({ inventories: player.inventories, markets: world.markets, orders: world.orders }, before);
  priceAll(world, 'wheat', 11);
  trade(world, player, 'sell', 100);
  assert.equal(player.credits, 10089);
  assert.equal(player.commodityInvestmentAccount.realizedProfit, 89);
  assert.equal(player.commodityInvestmentAccount.feesPaid, 11);
  assert.equal(player.commodityInvestmentAccount.profitIssued, 100);
  assert.equal(Object.keys(player.commodityInvestmentAccount.positions).length, 0);
  assertCommodityInvestmentAccount(player);
});

test('weighted average cost and final partial close release the exact original principal', () => {
  const { world, player } = setup();
  trade(world, player, 'buy', 1);
  priceAll(world, 'wheat', 10.01);
  trade(world, player, 'buy', 2);
  const closed = Array.from({ length: 3 }, () => trade(world, player, 'sell', 1).transaction);
  assert.equal(closed.reduce((sum, row) => sum + Math.round(row.principalReleased * 1e6), 0), 30020000);
  assert.equal(player.commodityInvestmentAccount.principalReleased, 30.02);
  assert.equal(player.commodityInvestmentAccount.feesPaid, 0.3003);
  assert.equal(player.commodityInvestmentAccount.realizedProfit, -0.2903);
  assert.equal(player.credits, 9999.7097);
  assertCommodityInvestmentAccount(player);
});

test('splitting sell orders cannot evade the cumulative fee', () => {
  const a = setup(); const b = setup();
  priceAll(a.world, 'wheat', 0.01); priceAll(b.world, 'wheat', 0.01);
  trade(a.world, a.player, 'buy', 100); trade(b.world, b.player, 'buy', 100);
  trade(a.world, a.player, 'sell', 100);
  for (let n = 0; n < 100; n += 1) trade(b.world, b.player, 'sell', 1);
  assert.equal(a.player.credits, b.player.credits);
  assert.equal(a.player.commodityInvestmentAccount.feesPaid, 0.01);
  assert.equal(b.player.commodityInvestmentAccount.recentTransactions.length, 100);
});

test('expiry uses the official expiry-day index once, not the price on a delayed login', () => {
  const { world, player } = setup();
  const expiresAt = commodityInvestmentPeriod(NOW).endsAt;
  assert.equal(new Date(expiresAt).toISOString(), '2026-09-13T16:00:00.000Z');
  trade(world, player, 'buy', 100);
  priceAll(world, 'wheat', 11, expiresAt);
  archiveCashPriceDay(world, expiresAt);
  priceAll(world, 'wheat', 20, expiresAt + 2 * 86400000);
  const settled = settleDueCommodityInvestments(world, player, expiresAt + 2 * 86400000);
  assert.equal(settled.settled, 1);
  assert.equal(player.credits, 10089);
  assert.equal(settled.transactions[0].createdAt, expiresAt);
  assert.equal(settled.transactions[0].processedAt, expiresAt + 2 * 86400000);
  const before = state(player);
  assert.equal(settleDueCommodityInvestments(world, player, expiresAt + 100 * 86400000).settled, 0);
  assert.deepEqual(player, before);
});

test('expiry missing a price rejects the whole batch without clearing any position', () => {
  const { world, player } = setup();
  priceAll(world, 'rice', 10);
  trade(world, player, 'buy', 10);
  trade(world, player, 'buy', 10, 'rice');
  const expiresAt = commodityInvestmentPeriod(NOW).endsAt;
  priceAll(world, 'wheat', 12, expiresAt);
  const before = state(player);
  assert.throws(() => settleDueCommodityInvestments(world, player, expiresAt), { code: 'CASH_PRICE_UNAVAILABLE' });
  assert.deepEqual(player, before);
  assert.throws(() => trade(world, player, 'buy', 1, 'wheat', expiresAt), { code: 'INVESTMENT_EXPIRY_PENDING' });
  assert.deepEqual(player, before);
});

for (const quantity of [0, -1, 1.5, true, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid quantity ${String(quantity)} never changes assets`, () => {
    const { world, player } = setup(); const before = state(player);
    assert.throws(() => trade(world, player, 'buy', quantity), { code: 'CASH_QUANTITY_INVALID' });
    assert.deepEqual(player, before);
  });
}

test('insufficient funding, overselling, unknown product and stale quotes are atomic failures', () => {
  const { world, player } = setup();
  const quote = commodityInvestmentQuote(world, 'wheat', NOW);
  const before = state(player);
  assert.throws(() => trade(world, player, 'buy', 1001), { code: 'INVESTMENT_FUNDS_INSUFFICIENT' });
  assert.throws(() => trade(world, player, 'sell', 1), { code: 'INVESTMENT_HOLDINGS_INSUFFICIENT' });
  assert.throws(() => applyCommodityInvestmentTrade(world, player, { ...quote, productId: 'no-product', side: 'buy', quantity: 1 }, NOW), { code: 'CASH_PRODUCT_INVALID' });
  assert.throws(() => applyCommodityInvestmentTrade(world, player, { ...quote, contractId: 'old', side: 'buy', quantity: 1 }, NOW), { code: 'INVESTMENT_QUOTE_STALE' });
  assert.throws(() => applyCommodityInvestmentTrade(world, player, { ...quote, priceDateKey: '2026-09-09', side: 'buy', quantity: 1 }, NOW), { code: 'INVESTMENT_QUOTE_STALE' });
  assert.deepEqual(player, before);
});

test('foreign region and injected price cannot alter the global index', () => {
  const { world, player } = setup();
  const quote = commodityInvestmentQuote(world, 'wheat', NOW);
  applyCommodityInvestmentTrade(world, player, { ...quote, price: 0.01, provinceId: 'bad', side: 'buy', quantity: 100 }, NOW);
  assert.equal(player.credits, 9000);
  assert.throws(() => officialCashPrice(world, 'bad', 'wheat', NOW), { code: 'CASH_PROVINCE_INVALID' });
});

test('valuation is read-only, does not initialize an account and does not count principal twice', () => {
  const { world, player } = setup(); const before = structuredClone(world);
  assert.equal(commodityInvestmentValuation(world, player, NOW).equity, 0);
  assert.deepEqual(world, before);
  trade(world, player, 'buy', 100);
  const value = commodityInvestmentValuation(world, player, NOW);
  assert.equal(player.credits + value.equity, 10000);
  assert.equal(value.unrealizedProfit, 0);
});

test('price archive is read only on repeat and fails rather than overwriting a published day', () => {
  const { world } = setup();
  assert.equal(archiveCashPriceDay(world, NOW), true);
  const archive = structuredClone(world.cashPriceArchive);
  assert.equal(archiveCashPriceDay(world, NOW), false);
  world.markets['110000:wheat'].officialPrice = 10.01;
  assert.throws(() => archiveCashPriceDay(world, NOW), { code: 'CASH_PRICE_CONFLICT' });
  assert.deepEqual(world.cashPriceArchive, archive);
});

test('money and sequence overflow reject without partially debiting funds', () => {
  const { world, player } = setup();
  const before = state(player);
  assert.throws(() => trade(world, player, 'buy', Number.MAX_SAFE_INTEGER), { code: 'CASH_AMOUNT_RANGE' });
  assert.deepEqual(player, before);
  trade(world, player, 'buy', 1);
  player.commodityInvestmentAccount.sequence = Number.MAX_SAFE_INTEGER;
  const after = state(player);
  assert.throws(() => trade(world, player, 'buy', 1), { code: 'CASH_QUANTITY_INVALID' });
  assert.deepEqual(player, after);
});

test('tampered principal and policy identifiers cannot be silently normalized into a valid account', () => {
  const { world, player } = setup();
  trade(world, player, 'buy', 1);
  player.commodityInvestmentAccount.principalDeposited += 1;
  assert.throws(() => assertCommodityInvestmentAccount(player), { code: 'INVESTMENT_ACCOUNT_UNBALANCED' });
  player.commodityInvestmentAccount.principalDeposited -= 1;
  Object.values(player.commodityInvestmentAccount.positions)[0].indexPolicyId = 'changed-weights';
  assert.throws(() => assertCommodityInvestmentAccount(player), { code: 'INVESTMENT_POSITION_INVALID' });
});

test('real SQLite storage persists positions and rolls back a failure after preparing a close', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-investment-'));
  const path = join(directory, 'economy.sqlite');
  let store = new EconomyStore(path, { scheduledProcessing: false });
  try {
    store.transaction(() => {
      const { world, revision, stateJson } = store.loadWorld(NOW);
      const player = ensurePlayer(world, USER, NOW); player.credits = 10000;
      priceAll(world, 'wheat', 10);
      trade(world, player, 'buy', 100);
      store.saveWorldIfChanged(revision, world, NOW, stateJson);
    });
    assert.throws(() => store.transaction(() => {
      const { world, revision, stateJson } = store.loadWorld(NOW);
      trade(world, world.players[String(USER.id)], 'sell', 100);
      store.saveWorldIfChanged(revision, world, NOW, stateJson);
      throw new Error('test after save');
    }), /test after save/);
    store.close();
    store = new EconomyStore(path, { scheduledProcessing: false });
    store.transaction(() => {
      const player = store.loadWorld(NOW).world.players[String(USER.id)];
      assert.equal(player.credits, 9000);
      assert.equal(Object.values(player.commodityInvestmentAccount.positions)[0].quantity, 100);
      assertCommodityInvestmentAccount(player);
    });
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
