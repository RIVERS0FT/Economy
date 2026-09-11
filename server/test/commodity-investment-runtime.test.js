import test from 'node:test';
import assert from 'node:assert/strict';
import { EconomyStore } from '../src/runtime-store.js';
import { createWorld, ensurePlayer, commoditySystemPriceFor } from '../src/domain.js';
import { PROVINCE_CATALOG } from '../src/provinces.js';
import { resolveAction } from '../src/game-routes.js';
import { executeRuntimeAction } from '../src/runtime-action-executor.js';
import { createRuntimeMutationScope, cloneWorldForMutation } from '../src/world-storage-v2.js';
import { createStatePartitionSnapshot } from '../src/state-partitions.js';
import { createVersionedClientState } from '../src/storage.js';
import { bankCreditAssetValue, ensurePlayerBankAccount } from '../src/banking.js';
import { cashFinancialAssets } from '../src/cash-financial-assets.js';
import { getPlayerSaveDeletionPreflight } from '../src/save-deletion.js';
import { createWeeklyCashSettlementClientState, processWeeklyCashSettlementWorld } from '../src/weekly-cash-settlement.js';
import { cashDateKey, commodityInvestmentQuote, COMMODITY_INDEX_POLICY_ID, archiveCashPriceDay } from '../src/commodity-investment-prices.js';
import {
  executeCommodityInvestmentTrade, settlePlayerCommodityInvestments, processCommodityInvestmentWorld,
  nextCommodityInvestmentDeadline, createCommodityInvestmentClientState, collectPlayerCommodityInvestments,
} from '../src/commodity-investment-runtime.js';

const NOW = Date.parse('2026-09-10T08:00:00Z');
const USER = { id: 902, name: 'investment-runtime', email: 'investment-runtime@example.com' };
function prices(world, price, at = NOW) {
  for (const region of PROVINCE_CATALOG) {
    commoditySystemPriceFor(world, 'wheat', region.id, at);
    Object.assign(world.markets[`${region.id}:wheat`], { officialPrice: price, priceDateKey: cashDateKey(at) });
  }
}
function setup() {
  const world = createWorld(NOW); const player = ensurePlayer(world, USER, NOW);
  world.cashEconomy = { version: 1, activatedAt: NOW, indexPolicyId: COMMODITY_INDEX_POLICY_ID };
  player.credits = 10000; prices(world, 10);
  return { world, player };
}
function payload(world, side = 'buy', quantity = 100, now = NOW) {
  return { ...commodityInvestmentQuote(world, 'wheat', now), side, quantity };
}
function fixtureStore() {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true, nowProvider: () => NOW });
  store.clearWorldProcessingTimer();
  store.transaction(() => {
    const { revision, world } = store.loadWorld(NOW);
    const player = ensurePlayer(world, USER, NOW);
    player.credits = 10000;
    prices(world, 10);
    world.cashEconomy = { version: 1, activatedAt: NOW, indexPolicyId: COMMODITY_INDEX_POLICY_ID };
    store.saveWorld(revision, world, NOW);
  });
  return store;
}
function request(world, key, side = 'buy', quantity = 100) {
  return { action: 'tradeCommodityInvestment', path: '/api/game/investments/trades', method: 'POST',
    payload: payload(world, side, quantity), requestKey: key };
}

test('investment has a distinct registered authenticated write route, not the retired goods endpoint', () => {
  assert.equal(resolveAction('POST', '/api/game/investments/trades').action, 'tradeCommodityInvestment');
  assert.equal(resolveAction('POST', '/api/game/investments/trades').category, 'orders');
  assert.equal(resolveAction('GET', '/api/game/investments/trades'), null);
});

test('an unconverted world cannot open investment positions through the new route', () => {
  const { world, player } = setup(); delete world.cashEconomy;
  const before = structuredClone(player);
  assert.throws(() => executeCommodityInvestmentTrade(world, player, payload(world), NOW), { code: 'INVESTMENT_NOT_ENABLED' });
  assert.deepEqual(player, before);
});

test('registered write persists positions and audit atomically; an identical request cannot debit twice', () => {
  const store = fixtureStore();
  try {
    const command = request(store.worldCache.world, 'investment-registered-0001');
    const first = executeRuntimeAction(store, USER, command, NOW);
    const next = executeRuntimeAction(store, USER, command, NOW + 1);
    assert.deepEqual(next, first);
    assert.equal(first.result.ok, true);
    const state = store.loadWorld(NOW).world;
    assert.equal(state.players[USER.id].credits, 9000);
    assert.equal(state.commodityInvestmentAudit.principalDeposited, 1000);
    assert.equal(state.commodityInvestmentAudit.transactionCount, 1);
    assert.equal(store.database.prepare('SELECT COUNT(*) AS n FROM economy_investment_ledger').get().n, 1);
    assert.equal(store.selectIdempotency.get(USER.id, command.requestKey).request_path, command.path);
  } finally { store.close(); }
});

test('the true SQLite rollback also restores investment audit and population income', () => {
  const store = fixtureStore();
  try {
    executeRuntimeAction(store, USER, request(store.worldCache.world, 'investment-before-rollback'), NOW);
    const before = JSON.stringify(store.worldCache.world);
    const persist = store.saveWorldIfChanged;
    store.saveWorldIfChanged = () => { throw new Error('injected disk failure'); };
    assert.throws(() => executeRuntimeAction(store, USER,
      request(store.worldCache.world, 'investment-rollback-sell', 'sell'), NOW + 1), /injected disk failure/);
    store.saveWorldIfChanged = persist;
    assert.equal(JSON.stringify(store.loadWorld(NOW).world), before);
    assert.equal(store.selectIdempotency.get(USER.id, 'investment-rollback-sell'), undefined);
    assert.equal(store.database.prepare('SELECT COUNT(*) AS n FROM economy_investment_ledger').get().n, 1);
  } finally { store.close(); }
});

test('scoped investment writes copy the audit and owner but never other players or operating market counters', () => {
  const { world, player } = setup(); ensurePlayer(world, { id: 999, name: 'other' }, NOW);
  const command = payload(world); const scope = createRuntimeMutationScope(world, USER.id, 'tradeCommodityInvestment', command);
  assert(scope.segments.has('commodityInvestmentAudit'));
  const before = JSON.stringify(world);
  const draft = cloneWorldForMutation(world, scope);
  executeCommodityInvestmentTrade(draft, draft.players[USER.id], command, NOW);
  assert.equal(JSON.stringify(world), before);
  assert.equal(draft.players[999], world.players[999]);
  assert.deepEqual(draft.markets, world.markets);
  assert.equal(player.credits, 10000);
});

test('sale fees fund population exactly once and principal is not recorded as profit', () => {
  const { world, player } = setup();
  executeCommodityInvestmentTrade(world, player, payload(world), NOW);
  const before = world.populationEconomy.stats.marketServiceIncome;
  executeCommodityInvestmentTrade(world, player, payload(world, 'sell'), NOW);
  assert.equal(world.populationEconomy.stats.marketServiceIncome - before, 10);
  assert.equal(world.commodityInvestmentAudit.principalReleased, 1000);
  assert.equal(world.commodityInvestmentAudit.grossSettled, 1000);
  assert.equal(world.commodityInvestmentAudit.profitIssued, 0);
  assert.equal(player.stats.investmentRealizedProfit, -10);
  assert.equal(player.stats.investmentFeesPaid, 10);
});

test('read projection has isolated player holdings and shared quotes without initialization or settlement', () => {
  const { world, player } = setup();
  const before = JSON.stringify(world);
  const initial = createCommodityInvestmentClientState(world, player, NOW);
  assert.equal(JSON.stringify(world), before);
  assert.equal(initial.commodityInvestment.equity, 0);
  assert(initial.commodityInvestmentQuotes.find((row) => row.productId === 'wheat').available);
  executeCommodityInvestmentTrade(world, player, payload(world), NOW);
  const state = createVersionedClientState(world, USER.id, NOW, {});
  const split = createStatePartitionSnapshot(JSON.parse(JSON.stringify(state)));
  assert(split.partitions.player.commodityInvestment);
  assert(!split.partitions.market.commodityInvestment);
  assert(split.partitions.market.commodityInvestmentQuotes);
  assert.equal(state.assetSummary.investmentValue, 1000);
  assert.equal(state.assetSummary.totalAssets, 10000);
});

test('net assets include equity once; credit uses the lesser of equity and actual principal', () => {
  const { world, player } = setup();
  executeCommodityInvestmentTrade(world, player, payload(world), NOW);
  assert.equal(cashFinancialAssets(world, player, NOW).investmentEquity, 1000);
  assert.equal(bankCreditAssetValue(world, player, NOW), 10000);
  prices(world, 12);
  assert.equal(cashFinancialAssets(world, player, NOW).investmentEquity, 1200);
  assert.equal(bankCreditAssetValue(world, player, NOW), 10000);
  prices(world, 9);
  assert.equal(bankCreditAssetValue(world, player, NOW), 9900);
});

test('weekly net funds count positions and both credit and legacy loan liabilities', () => {
  const { world, player } = setup();
  executeCommodityInvestmentTrade(world, player, payload(world), NOW);
  const bank = ensurePlayerBankAccount(player, NOW);
  bank.creditLoan = { principalOutstanding: 100, interestOutstanding: 3 };
  bank.activeLoan = { principalOutstanding: 20, interestOutstanding: 1 };
  const state = createWeeklyCashSettlementClientState(world, player, NOW);
  assert.equal(state.estimatedTaxBase, 9876);
  assert.equal(state.estimatedAssessment, 987.6);
});

test('migration principal is exempt from the first assessed week only, not subsequent gains', () => {
  const { world, player } = setup();
  player.cashInventoryMigration = { version: 1, at: NOW, liquidationCredits: 1000 };
  assert.equal(createWeeklyCashSettlementClientState(world, player, NOW).estimatedTaxBase, 9000);
  const week = world.weeklyCashSettlement;
  // Initialize the normal week state through its public read/write owner.
  processWeeklyCashSettlementWorld(world, NOW);
  const close = world.weeklyCashSettlement.nextCloseAt;
  world.weeklyCashSettlement.partial = false;
  player.weeklyCashSettlement.activeWeekKey = world.weeklyCashSettlement.currentWeekKey;
  processWeeklyCashSettlementWorld(world, close);
  assert.equal(player.cashInventoryMigration.weeklyAdjustmentApplied, true);
  assert.equal(player.weeklyCashSettlement.lastSettlement?.migrationAdjustment ?? player.weeklyCashSettlement.pendingSettlement?.migrationAdjustment, 1000);
});

test('expiry deadline and employment are idempotent and do not mark player activity', () => {
  const { world, player } = setup();
  executeCommodityInvestmentTrade(world, player, payload(world), NOW);
  const expiry = commodityInvestmentQuote(world, 'wheat', NOW).expiresAt;
  assert.equal(nextCommodityInvestmentDeadline(world, NOW), expiry);
  prices(world, 11, expiry);
  const activity = player.lastEconomicActivityAt;
  assert.equal(processCommodityInvestmentWorld(world, expiry), true);
  assert.equal(processCommodityInvestmentWorld(world, expiry), false);
  assert.equal(player.credits, 10089);
  assert.equal(player.lastEconomicActivityAt, activity);
  assert.equal(nextCommodityInvestmentDeadline(world, expiry), null);
  assert.equal(world.commodityInvestmentAudit.transactionCount, 2);
});

test('unknown expiry keeps assets and advertises a bounded retry instead of repeatedly failing the scheduler', () => {
  const { world, player } = setup();
  executeCommodityInvestmentTrade(world, player, payload(world), NOW);
  const expiry = commodityInvestmentQuote(world, 'wheat', NOW).expiresAt;
  const account = structuredClone(player.commodityInvestmentAccount);
  processCommodityInvestmentWorld(world, expiry);
  assert.deepEqual(player.commodityInvestmentAccount, account);
  assert.equal(player.credits, 9000);
  assert.equal(nextCommodityInvestmentDeadline(world, expiry), expiry + 60000);
  const projected = createCommodityInvestmentClientState(world, player, expiry);
  assert.equal(projected.commodityInvestment.equity, null);
  assert.equal(projected.commodityInvestment.positions.length, 1);
  assert.equal(projected.commodityInvestment.valuationAvailable, false);
});

test('debt collection sells the minimum whole units, preserves surplus and uses the normal fee ledger', () => {
  const { world, player } = setup();
  executeCommodityInvestmentTrade(world, player, payload(world), NOW);
  const result = collectPlayerCommodityInvestments(world, player, 21, NOW);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].type, 'collection');
  assert.equal(result.transactions[0].quantity, 3);
  assert.equal(player.credits, 9029.7);
  assert.equal(world.commodityInvestmentAudit.feesPaid, .3);
  assert.equal(Object.values(player.commodityInvestmentAccount.positions)[0].quantity, 97);
});

test('deleting a save cannot silently erase open investment principal', () => {
  const store = fixtureStore();
  try {
    executeRuntimeAction(store, USER, request(store.worldCache.world, 'investment-delete-block'), NOW);
    const preflight = getPlayerSaveDeletionPreflight(store, USER, NOW);
    assert.equal(preflight.allowed, false);
    assert(preflight.blockers.some((row) => row.type === 'commodity_investment_open'));
  } finally { store.close(); }
});

test('missing investment quote is unknown in the full state, never zero wealth or a new loan limit', () => {
  const { world, player } = setup();
  executeCommodityInvestmentTrade(world, player, payload(world), NOW);
  delete world.markets[`${PROVINCE_CATALOG[0].id}:wheat`];
  const before = JSON.stringify(player.commodityInvestmentAccount);
  const state = createVersionedClientState(world, USER.id, NOW);
  assert.equal(state.assetSummary.totalAssets, null);
  assert.equal(state.assetSummary.investmentValue, null);
  assert.equal(state.bankSummary.assetCreditValue, null);
  assert.equal(state.bankSummary.valuationAvailable, false);
  assert.equal(state.bankSummary.weeklyCashSettlement.estimatedAssessment, null);
  assert.equal(state.commodityInvestment.equity, null);
  assert.equal(JSON.stringify(player.commodityInvestmentAccount), before);
  assert.throws(() => bankCreditAssetValue(world, player, NOW), { code: 'CASH_PRICE_UNAVAILABLE' });
});
