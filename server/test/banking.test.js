import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  activeLoanLiability,
  applyBankAction,
  bankPeriodFor,
  createBankClientState,
  ensureBankWorld,
  ensurePlayerBankAccount,
  processBankWorld,
} from '../src/banking.js';
import {
  applyFacilityGroupAction,
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
  processFacilityGroupWorld,
} from '../src/facility-groups.js';

const now = 1_800_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function farmGroup(count, overrides = {}) {
  return {
    facilityTypeId: 'farm', count, participatingCount: 0, pendingJoinCount: 0,
    enabled: false, status: 'stopped', statusReason: 'manual', activeRecipeId: 'wheat-crop',
    lifetimeOutput: 0, ...overrides,
  };
}

test('deposits and withdrawals move existing funds without changing net assets', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  ensureBankWorld(world, now);
  player.credits = 500;
  migrateFacilityGroupWorld(world, now);
  const before = createFacilityGroupClientState(world, alice.id, now).assetSummary.totalAssets;

  assert.equal(applyBankAction(world, alice, 'bankDeposit', { amount: 300 }, now).ok, true);
  assert.equal(player.credits, 200);
  assert.equal(player.bankAccount.depositCredits, 300);
  assert.equal(createFacilityGroupClientState(world, alice.id, now).assetSummary.totalAssets, before);

  assert.equal(applyBankAction(world, alice, 'bankWithdraw', { amount: 125 }, now + 1).ok, true);
  assert.equal(player.credits, 325);
  assert.equal(player.bankAccount.depositCredits, 175);
  assert.equal(createFacilityGroupClientState(world, alice.id, now + 1).assetSummary.totalAssets, before);
});

test('mortgaged factories keep producing but cannot be transferred', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [farmGroup(2, {
    enabled: true, status: 'running', participatingCount: 2, cycleStartedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  const borrowed = applyBankAction(world, alice, 'bankBorrow', {
    amount: 20,
    collateral: [{ facilityTypeId: 'farm', quantity: 1 }],
    autoRepay: true,
  }, now + 1);
  assert.equal(borrowed.ok, true);
  const clientGroup = createFacilityGroupClientState(world, alice.id, now + 1).facilityGroups[0];
  assert.equal(clientGroup.mortgagedCount, 1);
  assert.equal(clientGroup.availableCount, 1);
  assert.equal(clientGroup.participatingCount, 2);

  const sell = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 65,
  }, now + 2);
  assert.equal(sell.ok, false);

  processFacilityGroupWorld(world, now + 120_000);
  assert.equal(player.inventories.wheat.available, 8);
});

test('loan proceeds add matching liability and do not inflate wealth', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [farmGroup(10)];
  migrateFacilityGroupWorld(world, now);
  const before = createFacilityGroupClientState(world, alice.id, now).assetSummary;

  assert.equal(applyBankAction(world, alice, 'bankBorrow', {
    amount: 100,
    collateral: [{ facilityTypeId: 'farm', quantity: 4 }],
  }, now + 1).ok, true);
  const after = createFacilityGroupClientState(world, alice.id, now + 1).assetSummary;
  assert.equal(player.credits, 200);
  assert.equal(activeLoanLiability(player), 103);
  assert.equal(after.grossAssetValue, before.grossAssetValue + 100);
  assert.equal(after.totalAssets, before.totalAssets - 3);
});

test('deposit interest is paid only from realized borrower interest and new deposits wait a full day', () => {
  const world = createWorld(now);
  const borrower = ensurePlayer(world, alice, now);
  const depositor = ensurePlayer(world, bob, now);
  borrower.credits = 1_000;
  depositor.credits = 1_000;
  borrower.facilityGroups = [farmGroup(10)];
  migrateFacilityGroupWorld(world, now);
  ensureBankWorld(world, now);

  assert.equal(applyBankAction(world, bob, 'bankDeposit', { amount: 400 }, now + 1).ok, true);
  assert.equal(applyBankAction(world, alice, 'bankBorrow', {
    amount: 100,
    collateral: [{ facilityTypeId: 'farm', quantity: 4 }],
  }, now + 2).ok, true);
  assert.equal(applyBankAction(world, alice, 'bankRepay', {
    loanId: borrower.bankAccount.activeLoan.id,
    amount: 'all',
  }, now + 3).ok, true);
  assert.equal(world.bank.totals.borrowerInterestReceived, 3);
  assert.equal(world.bank.interestPoolMicros, 2_100_000);
  assert.equal(world.populationEconomy.stats.bankingIncome, 0.6);

  const firstMidnight = bankPeriodFor(now).nextSettlementAt;
  processBankWorld(world, firstMidnight);
  assert.equal(depositor.bankAccount.depositCredits, 400, 'same-day deposit is not eligible');
  assert.equal(world.bank.interestPoolMicros, 2_100_000);

  processBankWorld(world, firstMidnight + 24 * 60 * 60 * 1000);
  assert.equal(depositor.bankAccount.depositCredits, 401);
  assert.equal(depositor.bankAccount.totalDepositInterestEarned, 1);
  assert.equal(world.bank.interestPoolMicros, 1_100_000);
});

test('loan assessment exposes transparent collateral and rate inputs', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [farmGroup(5)];
  migrateFacilityGroupWorld(world, now);
  const account = ensurePlayerBankAccount(player, now);
  account.depositCredits = 100;
  const state = createBankClientState(world, player, now);
  assert.equal(state.bankAccount.availableCollateral[0].availableQuantity, 5);
  assert.equal(state.bankSummary.baseLoanToValueBps, 4_000);
  assert.equal(state.bankSummary.dailyInterestCapBps, 25);
});


test('withdrawal lowers the daily minimum and re-deposit cannot restore same-day eligibility', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  const account = ensurePlayerBankAccount(player, now);
  account.depositCredits = 500;
  account.dayOpeningDepositCredits = 500;
  account.dayMinimumDepositCredits = 500;

  assert.equal(applyBankAction(world, alice, 'bankWithdraw', { amount: 300 }, now + 1).ok, true);
  assert.equal(account.dayMinimumDepositCredits, 200);
  assert.equal(applyBankAction(world, alice, 'bankDeposit', { amount: 300 }, now + 2).ok, true);
  assert.equal(account.depositCredits, 500);
  assert.equal(createBankClientState(world, player, now + 2).bankAccount.eligibleDepositCredits, 200);
});

test('deposit interest pays cent-level fractional credits without hidden player carry', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  const account = ensurePlayerBankAccount(player, now);
  account.depositCredits = 200;
  account.dayOpeningDepositCredits = 200;
  account.dayMinimumDepositCredits = 200;
  const bank = ensureBankWorld(world, now);
  bank.interestPoolMicros = 500_000;

  const firstMidnight = bankPeriodFor(now).nextSettlementAt;
  processBankWorld(world, firstMidnight);
  assert.equal(account.depositCredits, 200.5);
  assert.equal(account.depositInterestCarryMicros, 0);
  bank.interestPoolMicros += 500_000;
  processBankWorld(world, firstMidnight + 24 * 60 * 60 * 1000);
  assert.equal(account.depositCredits, 201);
  assert.equal(account.depositInterestCarryMicros, 0);
});

test('loan default seizes the minimum collateral once and releases the remaining mortgage', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [farmGroup(10)];
  migrateFacilityGroupWorld(world, now);
  assert.equal(applyBankAction(world, alice, 'bankBorrow', {
    amount: 100,
    collateral: [{ facilityTypeId: 'farm', quantity: 4 }],
    autoRepay: false,
  }, now + 1).ok, true);
  const loan = player.bankAccount.activeLoan;
  player.credits = 0;

  processBankWorld(world, loan.graceEndsAt);
  assert.equal(player.bankAccount.activeLoan, null);
  assert.equal(player.facilityGroups[0].count, 8);
  assert.equal(world.bank.facilityReserves.farm, 2);
  assert.equal(player.stats.bankFacilitiesSeized, 2);
  assert.equal(player.stats.bankDefaults, 1);

  processBankWorld(world, loan.graceEndsAt + 1);
  assert.equal(player.facilityGroups[0].count, 8);
  assert.equal(world.bank.facilityReserves.farm, 2);
  assert.equal(player.stats.bankDefaults, 1);
});

test('bank accepts two-decimal deposits without truncating account precision', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 10;
  assert.equal(applyBankAction(world, alice, 'bankDeposit', { amount: 1.23 }, now + 1).ok, true);
  assert.equal(player.credits, 8.77);
  assert.equal(player.bankAccount.depositCredits, 1.23);
  assert.equal(applyBankAction(world, alice, 'bankWithdraw', { amount: 0.23 }, now + 2).ok, true);
  assert.equal(player.credits, 9);
  assert.equal(player.bankAccount.depositCredits, 1);
});
