import test from 'node:test';
import assert from 'node:assert/strict';
import { EconomyStore } from '../src/runtime-store.js';
import { PRODUCT_CATALOG, commoditySystemPriceFor, ensurePlayer } from '../src/domain.js';
import { PROVINCE_CATALOG } from '../src/provinces.js';
import { commodityInvestmentQuote, cashDateKey, commodityInvestmentPeriod, archiveCashPriceDay } from '../src/commodity-investment-prices.js';
import { applyCommodityInvestmentAction, collectCommodityInvestmentForDebt, createCommodityInvestmentClientState,
  processCommodityInvestmentWorld, nextCommodityInvestmentDeadline, investmentFinancialPosition } from '../src/commodity-investment-runtime.js';
import { resolveAction } from '../src/game-routes.js';
import { createVersionedClientState } from '../src/storage.js';
import { bankCreditAssetValue, calculateAssetCreditAssessment } from '../src/banking.js';
import { createWeeklyCashSettlementClientState, processWeeklyCashSettlementWorld, resolvePendingInvestmentAssessment,
  weeklyCashPeriodFor, ensureWeeklyCashSettlementWorld } from '../src/weekly-cash-settlement.js';
import { getPlayerSaveDeletionPreflight } from '../src/save-deletion.js';
import { wealthAssetsFor, operatingAssetsFor } from '../src/leaderboards.js';
import { getPlayerActionMetadata } from '../src/player-action-registry.js';

const NOW = Date.parse('2026-09-10T08:00:00Z');
const USER = { id: 8101, name: 'Investment runtime', email: 'investment-runtime@example.test', role: 'user' };
function prices(world, at, changed = {}) {
  for (const product of PRODUCT_CATALOG) for (const province of PROVINCE_CATALOG) {
    commoditySystemPriceFor(world, product.id, province.id, at);
    const market = world.markets[`${province.id}:${product.id}`];
    if (changed[product.id] !== undefined) market.officialPrice = changed[product.id];
    market.priceDateKey = cashDateKey(at);
  }
  world.lastProcessedAt = at;
}
function setup(filename = ':memory:') {
  const store = new EconomyStore(filename, { scheduledProcessing: true });
  store.getState(USER, NOW); store.stopScheduler();
  const { world, revision } = store.loadWorld(NOW);
  world.cashEconomy = { version: 1, activatedAt: NOW };
  world.players[String(USER.id)].credits = 10000;
  prices(world, NOW, { wheat: 2 });
  store.transaction(() => store.saveWorld(revision, world, NOW)); store.stopScheduler();
  return store;
}
function command(store, side = 'buy', quantity = 100, key = 'investment-buy', at = NOW) {
  const quote = commodityInvestmentQuote(store.worldCache.world, 'wheat', at);
  return { action: 'tradeCommodityInvestment', method: 'POST', path: '/api/game/investments/commodities',
    requestKey: key, payload: { ...quote, side, quantity } };
}
function sqlState(store) {
  return {
    meta: store.database.prepare('SELECT * FROM economy_world_meta').all(),
    players: store.database.prepare('SELECT * FROM economy_world_players ORDER BY user_id').all(),
    segments: store.database.prepare('SELECT * FROM economy_world_segments ORDER BY segment_key').all(),
    audit: store.database.prepare('SELECT * FROM economy_commodity_investment_audit ORDER BY event_key').all(),
  };
}
function mutate(store, at, operation) {
  return store.transaction(() => {
    const { world, revision } = store.loadWorld(at);
    operation(world, world.players[String(USER.id)]);
    store.saveWorld(revision, world, at);
  });
}

test('investment has an authenticated registered route, order rate limit and explicit mutation scope', () => {
  const resolved = resolveAction('POST', '/api/game/investments/commodities');
  assert.equal(resolved.action, 'tradeCommodityInvestment');
  assert.equal(resolved.category, 'orders');
  assert.equal(getPlayerActionMetadata(resolved.action).mutationScope, 'local-player');
  assert.equal(getPlayerActionMetadata(resolved.action).economicActivity, true);
});

test('runtime trade persists private holdings, world liability and durable audit without changing inventory or quotes', () => {
  const store = setup();
  try {
    const before = structuredClone({ inventory: store.worldCache.world.players[USER.id].inventories, markets: store.worldCache.world.markets });
    const request = command(store);
    const result = store.apply(USER, request, NOW); store.stopScheduler();
    assert.equal(result.result.ok, true);
    const world = store.worldCache.world; const player = world.players[USER.id];
    assert.equal(player.credits, 9800);
    assert.equal(world.commodityInvestmentLedger.principalDeposited, 200);
    assert.equal(world.commodityInvestmentLedger.transactions, 1);
    assert.deepEqual({ inventory: player.inventories, markets: world.markets }, before);
    const audit = sqlState(store).audit;
    assert.equal(audit.length, 1); assert.equal(audit[0].event_type, 'buy');
    assert.equal(JSON.parse(audit[0].event_json).cashChange, -200);
    const after = sqlState(store);
    assert.deepEqual(store.apply(USER, request, NOW + 1), result);
    assert.deepEqual(sqlState(store), after);
    const view = createVersionedClientState(world, USER.id, NOW, {});
    assert.equal(view.commodityInvestment.equity, 200);
    assert.equal(view.assetSummary.investmentValue, 200);
    assert.equal(view.assetSummary.netAssetValue, 10000);
    assert.equal('commodityInvestmentLedger' in view, false);
    assert.equal(wealthAssetsFor(world, player), 10000);
    assert.equal(operatingAssetsFor(player), 10000);
  } finally { store.close(); }
});

test('an unknown commodity or oversell rolls back every preliminary mutation and leaves no audit', () => {
  const store = setup();
  try {
    const before = sqlState(store); const cache = JSON.stringify(store.worldCache.world);
    assert.throws(() => store.apply(USER, command(store, 'sell', 1, 'oversell'), NOW), { code: 'INVESTMENT_HOLDINGS_INSUFFICIENT' });
    assert.deepEqual(sqlState(store), before); assert.equal(JSON.stringify(store.worldCache.world), cache);
    assert.equal(store.selectIdempotency.get(USER.id, 'oversell'), undefined);
  } finally { store.close(); }
});

test('SQLite audit failure rolls back holdings, liability, world revision and request identity; original key can retry', () => {
  const store = setup();
  try {
    const before = sqlState(store); const cache = JSON.stringify(store.worldCache.world);
    store.database.exec("CREATE TRIGGER reject_investment_audit BEFORE INSERT ON economy_commodity_investment_audit BEGIN SELECT RAISE(ABORT, 'injected investment audit failure'); END;");
    const request = command(store);
    assert.throws(() => store.apply(USER, request, NOW), /injected investment audit failure/);
    assert.deepEqual(sqlState(store), before); assert.equal(JSON.stringify(store.worldCache.world), cache);
    assert.equal(store.selectIdempotency.get(USER.id, request.requestKey), undefined);
    store.database.exec('DROP TRIGGER reject_investment_audit');
    assert.equal(store.apply(USER, request, NOW).result.ok, true);
    assert.equal(sqlState(store).audit.length, 1);
  } finally { store.close(); }
});

test('migration gate refuses new investment writes and cannot be enabled by a client payload', () => {
  const store = setup();
  try {
    mutate(store, NOW, (world) => { delete world.cashEconomy; });
    const request = command(store); request.payload.cashEconomy = { version: 1 };
    assert.equal(store.apply(USER, request, NOW).result.ok, false);
    assert.equal(store.worldCache.world.players[USER.id].credits, 10000);
    assert.equal(sqlState(store).audit.length, 0);
  } finally { store.close(); }
});

test('new investment uses all-region prices but never exposes another player\'s holdings', () => {
  const store = setup();
  try {
    store.apply(USER, command(store), NOW);
    const world = store.worldCache.world;
    const other = ensurePlayer(world, { id: 8102, name: 'Other' }, NOW);
    const view = createCommodityInvestmentClientState(world, other, NOW);
    assert.equal(Object.keys(view.commodityInvestmentQuotes).length, PRODUCT_CATALOG.length);
    assert.deepEqual(view.commodityInvestment.positions, []);
    assert.equal(view.commodityInvestment.principal, 0);
  } finally { store.close(); }
});

test('unrealized gains increase wealth once but do not inflate credit; losses reduce both', () => {
  const store = setup();
  try {
    store.apply(USER, command(store), NOW);
    mutate(store, NOW, (world) => prices(world, NOW, { wheat: 3 }));
    let world = store.worldCache.world; let player = world.players[USER.id];
    assert.equal(wealthAssetsFor(world, player), 10100);
    assert.equal(bankCreditAssetValue(world, player, NOW), 10000);
    assert.equal(operatingAssetsFor(player), 10000);
    mutate(store, NOW, (world) => prices(world, NOW, { wheat: 1 }));
    world = store.worldCache.world; player = world.players[USER.id];
    assert.equal(wealthAssetsFor(world, player), 9900);
    assert.equal(bankCreditAssetValue(world, player, NOW), 9900);
  } finally { store.close(); }
});

test('weekly assets include portfolio equity exactly once and both new and legacy loan liabilities', () => {
  const store = setup();
  try {
    store.apply(USER, command(store), NOW);
    const world = store.worldCache.world; const player = world.players[USER.id];
    const before = createWeeklyCashSettlementClientState(world, player, NOW);
    assert.equal(before.estimatedTaxBase, 10000);
    player.bankAccount.creditLoan = { principalOutstanding: 100, interestOutstanding: 10 };
    player.bankAccount.activeLoan = { principalOutstanding: 200, interestOutstanding: 20 };
    assert.equal(createWeeklyCashSettlementClientState(world, player, NOW).estimatedTaxBase, 9670);
  } finally { store.close(); }
});

test('expiry pays once and expiry fee is durable without any new buy or regional volume', () => {
  const store = setup();
  try {
    store.apply(USER, command(store), NOW);
    const at = commodityInvestmentPeriod(NOW).endsAt;
    mutate(store, at, (world) => {
      prices(world, at, { wheat: 2.10 }); archiveCashPriceDay(world, at);
      assert.equal(processCommodityInvestmentWorld(world, at), 1);
    });
    const world = store.worldCache.world; const player = world.players[USER.id];
    assert.equal(player.credits, 10007.9);
    assert.equal(world.commodityInvestmentLedger.feesPaid, 2.1);
    assert.equal(world.commodityInvestmentLedger.profitIssued, 10);
    assert.equal(world.commodityInvestmentLedger.principalReleased, 200);
    assert.equal(sqlState(store).audit.at(-1).event_type, 'expiry');
    assert.equal(processCommodityInvestmentWorld(world, at), 0);
    assert.equal(nextCommodityInvestmentDeadline(world, at), null);
  } finally { store.close(); }
});

test('missing expiry quotes retain assets, show unknown totals rather than zero and defer assessment without changing its basis', () => {
  const store = setup();
  try {
    store.apply(USER, command(store), NOW);
    const world = store.worldCache.world; const player = world.players[USER.id];
    const at = commodityInvestmentPeriod(NOW).endsAt;
    const portfolio = JSON.stringify(player.commodityInvestmentAccount);
    world.lastProcessedAt = at;
    assert.equal(processCommodityInvestmentWorld(world, at), 0);
    assert.equal(JSON.stringify(player.commodityInvestmentAccount), portfolio);
    assert.equal(nextCommodityInvestmentDeadline(world, at), at + 60000);
    assert.equal(createCommodityInvestmentClientState(world, player, at).commodityInvestment.equity, null);
    assert.equal(createVersionedClientState(world, USER.id, at, {}).assetSummary.totalAssets, null);
    const weekly = ensureWeeklyCashSettlementWorld(world, NOW); weekly.partial = false;
    player.weeklyCashSettlement.activeWeekKey = weekly.currentWeekKey;
    assert.equal(processWeeklyCashSettlementWorld(world, at), true);
    assert.equal(player.weeklyCashSettlement.pendingSettlement, null);
    const basis = structuredClone(player.weeklyCashSettlement.pendingInvestmentAssessment);
    assert.equal(basis.cash, 9800);
    assert.equal(createWeeklyCashSettlementClientState(world, player, at).estimatedAssessment, null);
    assert.throws(() => calculateAssetCreditAssessment(world, player, 10, 24, at), { code: 'CASH_PRICE_UNAVAILABLE' });
    player.credits += 100; // A later receipt must not be retroactively taxed in the old assessment.
    prices(world, at, { wheat: 2.10 });
    assert.equal(resolvePendingInvestmentAssessment(world, player), true);
    assert.equal(player.weeklyCashSettlement.pendingSettlement.taxBase, 10007.9);
    assert.equal(player.weeklyCashSettlement.pendingSettlement.amountDue, 1000.79);
    assert.equal(player.weeklyCashSettlement.pendingInvestmentAssessment, undefined);
    assert.equal(resolvePendingInvestmentAssessment(world, player), false);
  } finally { store.close(); }
});

test('default collection closes the fewest units needed under the real fee and records the explicit reason', () => {
  const store = setup();
  try {
    store.apply(USER, command(store, 'buy', 10), NOW);
    mutate(store, NOW, (world, player) => {
      assert.equal(collectCommodityInvestmentForDebt(world, player, 3.96, NOW), 3.96);
      assert.equal(Object.values(player.commodityInvestmentAccount.positions)[0].quantity, 8);
    });
    assert.equal(sqlState(store).audit.at(-1).event_type, 'bank-collection');
  } finally { store.close(); }
});

test('default collection accounts for newly settled expiry cash instead of liquidating unrelated holdings', () => {
  const store = setup();
  try {
    store.apply(USER, command(store, 'buy', 10), NOW);
    const at = commodityInvestmentPeriod(NOW).endsAt;
    mutate(store, at, (world, player) => {
      prices(world, at, { wheat: 2 });
      assert.equal(collectCommodityInvestmentForDebt(world, player, 10, at), 19.8);
      assert.equal(Object.keys(player.commodityInvestmentAccount.positions).length, 0);
    });
  } finally { store.close(); }
});

test('save deletion is blocked by live positions; an empty investment account does not block deletion', () => {
  const store = setup();
  try {
    store.apply(USER, command(store), NOW);
    const pending = getPlayerSaveDeletionPreflight(store, USER, NOW);
    assert.equal(pending.allowed, false);
    assert.ok(pending.blockers.some((blocker) => blocker.type === 'commodity_investment_position'));
    store.apply(USER, command(store, 'sell', 100, 'close-before-delete'), NOW);
    assert.equal(getPlayerSaveDeletionPreflight(store, USER, NOW).allowed, true);
  } finally { store.close(); }
});

test('pending valuation blocks deletion even after positions settle; liability basis is not erased', () => {
  const store = setup();
  try {
    mutate(store, NOW, (_world, player) => {
      player.weeklyCashSettlement.pendingInvestmentAssessment = { version: 1, positions: [] };
    });
    assert.ok(getPlayerSaveDeletionPreflight(store, USER, NOW).blockers.some((item) => item.type === 'commodity_investment_assessment'));
  } finally { store.close(); }
});

test('durable audit outlives the private 100-entry history and reconciles exactly to outstanding principal', async () => {
  const { assertCommodityInvestmentLedger } = await import('../src/commodity-investment-ledger.js');
  const store = setup();
  try {
    mutate(store, NOW, (world, player) => {
      const quote = commodityInvestmentQuote(world, 'wheat', NOW);
      for (let i = 0; i < 55; i += 1) {
        applyCommodityInvestmentAction(world, player, { ...quote, side: 'buy', quantity: 1 }, NOW);
        applyCommodityInvestmentAction(world, player, { ...quote, side: 'sell', quantity: 1 }, NOW);
      }
      applyCommodityInvestmentAction(world, player, { ...quote, side: 'buy', quantity: 3 }, NOW);
      assertCommodityInvestmentLedger(world, { allPlayers: true });
    });
    const world = store.worldCache.world;
    assert.equal(sqlState(store).audit.length, 111);
    assert.equal(world.players[USER.id].commodityInvestmentAccount.recentTransactions.length, 100);
    assert.equal(world.commodityInvestmentLedger.principalDeposited - world.commodityInvestmentLedger.principalReleased, 6);
    const broken = structuredClone(world); broken.commodityInvestmentLedger.principalDeposited += 1;
    assert.throws(() => assertCommodityInvestmentLedger(broken, { allPlayers: true }), { code: 'INVESTMENT_LEDGER_UNBALANCED' });
    broken.commodityInvestmentLedger.principalDeposited -= 1;
    broken.commodityInvestmentLedger.profitIssued += 1;
    assert.throws(() => assertCommodityInvestmentLedger(broken), { code: 'INVESTMENT_LEDGER_UNBALANCED' });
  } finally { store.close(); }
});

test('deferred valuation rejects duplicated contracts and invented expiries', async () => {
  const { captureInvestmentAssessmentBasis, quoteInvestmentAssessmentBasis } = await import('../src/commodity-investment-assessment.js');
  const store = setup();
  try {
    store.apply(USER, command(store), NOW);
    const world = store.worldCache.world;
    const basis = captureInvestmentAssessmentBasis(world.players[USER.id], {
      type: 'active_week', weekKey: weeklyCashPeriodFor(NOW).key, assessedAt: NOW, cash: 9800, loan: 0, prior: 0,
    });
    assert.equal(quoteInvestmentAssessmentBasis(world, basis).taxBase, 10000);
    const duplicated = structuredClone(basis); duplicated.positions.push(duplicated.positions[0]);
    assert.throws(() => quoteInvestmentAssessmentBasis(world, duplicated), { code: 'INVESTMENT_ASSESSMENT_INVALID' });
    basis.positions[0].expiresAt += 1;
    assert.throws(() => quoteInvestmentAssessmentBasis(world, basis), { code: 'INVESTMENT_ASSESSMENT_INVALID' });
  } finally { store.close(); }
});

test('SQLite reopen preserves holdings, audit, world liability and the original command result', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = mkdtempSync(join(tmpdir(), 'economy-investment-'));
  const file = join(directory, 'world.sqlite');
  let store = setup(file);
  try {
    const request = command(store); const result = store.apply(USER, request, NOW);
    store.close(); store = new EconomyStore(file, { scheduledProcessing: true });
    store.loadWorld(NOW); store.stopScheduler();
    assert.equal(store.worldCache.world.players[USER.id].commodityInvestmentAccount.principalDeposited, 200);
    assert.equal(store.worldCache.world.commodityInvestmentLedger.principalDeposited, 200);
    assert.deepEqual(store.apply(USER, request, NOW + 1), result);
    assert.equal(sqlState(store).audit.length, 1);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('a winning position cannot offset a losing position to restore bank credit from unrealized gains', () => {
  const store = setup();
  try {
    store.apply(USER, command(store), NOW);
    mutate(store, NOW, (world, player) => {
      prices(world, NOW, { wheat: 2, rice: 2 });
      const quote = commodityInvestmentQuote(world, 'rice', NOW);
      applyCommodityInvestmentAction(world, player, { ...quote, side: 'buy', quantity: 100 }, NOW);
      prices(world, NOW, { wheat: 3, rice: 1 });
    });
    const world = store.worldCache.world; const player = world.players[USER.id];
    assert.equal(wealthAssetsFor(world, player), 10000);
    assert.equal(investmentFinancialPosition(world, player, NOW).prudentValue, 300);
    assert.equal(bankCreditAssetValue(world, player, NOW), 9900);
  } finally { store.close(); }
});
