import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer, FACILITY_TYPE_CATALOG } from '../src/domain.js';
import {
  activeLoanLiability,
  applyBankAction,
  bankCreditAssetValue,
  bankPeriodFor,
  calculateAssetCreditAssessment,
  createBankClientState,
  ensureBankWorld,
  ensurePlayerBankAccount,
  mortgagedFacilityQuantity,
  processBankWorld,
} from '../src/banking.js';
import { assertEconomicStateInvariants } from '../src/economic-mutation.js';
import { activateWeeklyCashSettlement } from '../src/weekly-cash-settlement.js';
import {
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
} from '../src/facility-groups.js';

const now = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function farmGroup(count, overrides = {}) {
  return {
    provinceId: '110000',
    facilityTypeId: 'farm',
    count,
    participatingCount: 0,
    enabled: false,
    status: 'stopped',
    statusReason: 'manual',
    activeRecipeId: 'wheat-crop',
    lifetimeOutput: 0,
    ...overrides,
  };
}

function borrow(world, user, amount, termHours = 72, autoRepay = true, at = now + 1) {
  return applyBankAction(world, user, 'bankBorrow', { amount, termHours, autoRepay }, at);
}

test('deposits and withdrawals move existing funds without changing net assets', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 500;
  ensureBankWorld(world, now);
  migrateFacilityGroupWorld(world, now);
  const before = createFacilityGroupClientState(world, alice.id, now).assetSummary.totalAssets;

  assert.equal(applyBankAction(world, alice, 'bankDeposit', { amount: 300 }, now + 1).ok, true);
  assert.equal(player.credits, 200);
  assert.equal(player.bankAccount.depositCredits, 300);
  assert.equal(createFacilityGroupClientState(world, alice.id, now + 1).assetSummary.totalAssets, before);

  assert.equal(applyBankAction(world, alice, 'bankWithdraw', { amount: 125 }, now + 2).ok, true);
  assert.equal(player.credits, 325);
  assert.equal(player.bankAccount.depositCredits, 175);
  assert.equal(createFacilityGroupClientState(world, alice.id, now + 2).assetSummary.totalAssets, before);
});

test('asset credit loan needs no collateral and never freezes factories', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [farmGroup(2, {
    enabled: true,
    status: 'running',
    participatingCount: 2,
    cycleStartedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  const before = createFacilityGroupClientState(world, alice.id, now);
  const borrowed = borrow(world, alice, 100, 72, true);
  assert.equal(borrowed.ok, true);
  assert.equal(player.bankAccount.activeLoan, null);
  assert.ok(player.bankAccount.creditLoan);
  assert.equal(player.bankAccount.creditLoan.termMs, 72 * HOUR);
  assert.equal(player.bankAccount.creditLoan.principalOriginal, 100);
  assert.equal(mortgagedFacilityQuantity(player, 'farm', '110000'), 0);

  const after = createFacilityGroupClientState(world, alice.id, now + 1);
  assert.equal(after.facilityGroups[0].mortgagedCount, 0);
  assert.equal(after.facilityGroups[0].availableCount, before.facilityGroups[0].availableCount);
  assert.equal(after.facilityGroups[0].participatingCount, 2);
  assert.doesNotThrow(() => assertEconomicStateInvariants(world));
});

test('loan amount, term and utilization determine locked rate while assets determine limit', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  ensureBankWorld(world, now);

  assert.equal(bankCreditAssetValue(world, player), 1_000);
  const halfDay = calculateAssetCreditAssessment(world, player, 150, 24, now);
  assert.equal(halfDay.creditRatioBps, 3_000);
  assert.equal(halfDay.maximumLoanCredits, 300);
  assert.equal(halfDay.creditUtilizationBps, 5_000);
  assert.equal(halfDay.baseInterestRateBps, 200);
  assert.equal(halfDay.utilizationSurchargeBps, 0);
  assert.equal(halfDay.interestRateBps, 200);
  assert.equal(halfDay.totalInterestCredits, 3);

  const medium = calculateAssetCreditAssessment(world, player, 200, 72, now);
  assert.equal(medium.creditUtilizationBps, 6_667);
  assert.equal(medium.baseInterestRateBps, 400);
  assert.equal(medium.utilizationSurchargeBps, 100);
  assert.equal(medium.interestRateBps, 500);
  assert.equal(medium.totalInterestCredits, 10);

  const high = calculateAssetCreditAssessment(world, player, 270, 168, now);
  assert.equal(high.creditUtilizationBps, 9_000);
  assert.equal(high.baseInterestRateBps, 900);
  assert.equal(high.utilizationSurchargeBps, 200);
  assert.equal(high.interestRateBps, 1_100);
  assert.equal(high.totalInterestCredits, 29.7);

  assert.equal(calculateAssetCreditAssessment(world, player, 301, 72, now).requestedAmount, 0);
  assert.equal(calculateAssetCreditAssessment(world, player, 100, 48, now).termHours, null);
});

test('loan proceeds add matching principal liability and only locked interest reduces net wealth', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  migrateFacilityGroupWorld(world, now);
  const before = createFacilityGroupClientState(world, alice.id, now).assetSummary;

  assert.equal(borrow(world, alice, 100, 72).ok, true);
  const after = createFacilityGroupClientState(world, alice.id, now + 1).assetSummary;
  assert.equal(player.credits, 1_100);
  assert.equal(activeLoanLiability(player), 104);
  assert.equal(after.grossAssetValue, before.grossAssetValue + 100);
  assert.equal(after.totalAssets, before.totalAssets - 4);
});

test('complete repayment increases the future asset credit ratio', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  ensureBankWorld(world, now);
  const before = calculateAssetCreditAssessment(world, player, undefined, 72, now);
  assert.equal(before.creditRatioBps, 3_000);
  assert.equal(before.maximumLoanCredits, 300);

  assert.equal(borrow(world, alice, 100, 24).ok, true);
  const loanId = player.bankAccount.creditLoan.id;
  assert.equal(applyBankAction(world, alice, 'bankRepay', { loanId, amount: 'all' }, now + 2).ok, true);
  assert.equal(player.bankAccount.creditLoan, null);
  assert.equal(player.bankAccount.repaidLoanCount, 1);

  const after = calculateAssetCreditAssessment(world, player, undefined, 72, now + 3);
  assert.equal(after.goodRepayment, true);
  assert.equal(after.creditRatioBps, 3_500);
  assert.ok(after.maximumLoanCredits > 300);
});

test('new asset credit loan interest still funds deposits, employment and reserve at 70/20/10', () => {
  const world = createWorld(now);
  const borrower = ensurePlayer(world, alice, now);
  const depositor = ensurePlayer(world, bob, now);
  borrower.credits = 1_000;
  depositor.credits = 1_000;
  ensureBankWorld(world, now);

  assert.equal(applyBankAction(world, bob, 'bankDeposit', { amount: 400 }, now + 1).ok, true);
  activateWeeklyCashSettlement(world, depositor, now + 1);
  assert.equal(borrow(world, alice, 100, 72, true, now + 2).ok, true);
  const loanId = borrower.bankAccount.creditLoan.id;
  assert.equal(applyBankAction(world, alice, 'bankRepay', { loanId, amount: 'all' }, now + 3).ok, true);
  assert.equal(world.bank.totals.borrowerInterestReceived, 4);
  assert.equal(world.bank.interestPoolMicros, 2_800_000);
  assert.equal(world.populationEconomy.stats.bankingIncome, 0.8);
  assert.equal(world.bank.riskReserveCredits, 0.4);

  const firstMidnight = bankPeriodFor(now).nextSettlementAt;
  processBankWorld(world, firstMidnight);
  assert.equal(depositor.bankAccount.depositCredits, 400, 'same-day deposit is not eligible');
  processBankWorld(world, firstMidnight + 24 * HOUR);
  assert.equal(depositor.bankAccount.depositCredits, 404);
});

test('automatic repayment uses bank deposit before cash for an asset credit loan', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  ensureBankWorld(world, now);
  assert.equal(applyBankAction(world, alice, 'bankDeposit', { amount: 200 }, now + 1).ok, true);
  assert.equal(borrow(world, alice, 100, 24, true, now + 2).ok, true);
  const loan = player.bankAccount.creditLoan;
  assert.equal(loan.interestOutstanding, 2);

  processBankWorld(world, loan.dueAt);
  assert.equal(player.bankAccount.creditLoan, null);
  assert.equal(player.bankAccount.depositCredits, 98);
  assert.equal(player.credits, 900);
});

test('default does not write off missing assets and schedules continuing collection', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  ensureBankWorld(world, now);
  assert.equal(borrow(world, alice, 300, 72, false).ok, true);
  const loan = player.bankAccount.creditLoan;
  player.credits = 0;

  processBankWorld(world, loan.graceEndsAt);
  assert.ok(player.bankAccount.creditLoan);
  assert.equal(player.bankAccount.creditLoan.status, 'grace');
  assert.equal(player.bankAccount.lastDefaultAt, loan.graceEndsAt);
  assert.equal(player.stats.bankDefaults, 1);
  assert.ok(activeLoanLiability(player) > 0);
  assert.equal(player.bankAccount.creditLoan.graceEndsAt, loan.graceEndsAt + 6 * HOUR);

  const assessment = calculateAssetCreditAssessment(world, player, undefined, 72, loan.graceEndsAt + 1);
  assert.equal(assessment.recentDefault, true);
  assert.equal(assessment.creditRatioBps, 1_500);
});

test('default collection uses available assets only after grace and returns liquidation surplus', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [farmGroup(10)];
  migrateFacilityGroupWorld(world, now);
  ensureBankWorld(world, now);

  const assessment = calculateAssetCreditAssessment(world, player, undefined, 24, now);
  assert.ok(assessment.maximumLoanCredits >= 100);
  assert.equal(borrow(world, alice, 100, 24, false).ok, true);
  const loan = player.bankAccount.creditLoan;
  assert.equal(mortgagedFacilityQuantity(player, 'farm', '110000'), 0);
  player.credits = 0;

  const countBefore = player.facilityGroups[0].count;
  processBankWorld(world, loan.graceEndsAt);
  assert.equal(player.bankAccount.creditLoan, null);
  assert.ok(player.facilityGroups[0].count < countBefore);
  assert.ok(player.bankAccount.depositCredits >= 0);
  assert.equal(player.stats.bankDefaults, 1);
  assert.equal(mortgagedFacilityQuantity(player, 'farm', '110000'), 0);
});

test('legacy collateral loan remains readable and keeps its original freeze boundary', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [farmGroup(2)];
  migrateFacilityGroupWorld(world, now);
  const account = ensurePlayerBankAccount(player, now);
  account.activeLoan = {
    id: 'legacy-loan',
    status: 'active',
    borrowedAt: now,
    dueAt: now + 72 * HOUR,
    graceEndsAt: now + 84 * HOUR,
    principalOriginal: 20,
    principalOutstanding: 20,
    interestOriginal: 0.8,
    interestOutstanding: 0.8,
    interestRateBps: 400,
    collateral: [{ provinceId: '110000', facilityTypeId: 'farm', quantity: 1, prudentUnitValue: 60 }],
    collateralValueAtOrigination: 60,
    ltvBps: 3_334,
    autoRepay: false,
  };
  ensurePlayerBankAccount(player, now + 1);

  assert.equal(mortgagedFacilityQuantity(player, 'farm', '110000'), 1);
  assert.equal(activeLoanLiability(player), 20.8);
  const state = createBankClientState(world, player, now + 1);
  assert.equal(state.bankAccount.activeLoan.id, 'legacy-loan');
  assert.equal(state.bankAccount.activeLoan.collateral.length, 1);
  assert.equal(borrow(world, alice, 10, 24).ok, false);
});

test('client state exposes asset credit parameters and hides collateral selection for new loans', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [farmGroup(5)];
  migrateFacilityGroupWorld(world, now);
  const state = createBankClientState(world, player, now);
  assert.equal(state.bankAccount.availableCollateral.length, 0);
  assert.equal(state.bankSummary.baseLoanToValueBps, 3_000);
  assert.equal(state.bankSummary.minimumLoanToValueBps, 1_500);
  assert.equal(state.bankSummary.maximumLoanToValueBps, 3_500);
  assert.deepEqual(state.bankSummary.loanTermOptionsHours, [24, 72, 168]);
  assert.equal(state.bankSummary.dailyInterestCapBps, 100);
});

test('large asset credit interest remains representable in the micros pool', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 10_000_000;
  ensureBankWorld(world, now);

  assert.equal(borrow(world, alice, 3_000_000, 168, false).ok, true);
  const loan = player.bankAccount.creditLoan;
  assert.equal(loan.interestRateBps, 1_100);
  assert.equal(loan.interestOutstanding, 330_000);
  assert.equal(applyBankAction(world, alice, 'bankRepay', { loanId: loan.id, amount: 'all' }, now + 2).ok, true);
  assert.equal(world.bank.interestPoolMicros, 231_000_000_000);
  assert.equal(world.bank.totals.borrowerInterestReceived, 330_000);
  assert.equal(world.populationEconomy.stats.bankingIncome, 66_000);
});

test('grace period blocks withdrawals for new credit loans', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  ensureBankWorld(world, now);
  assert.equal(applyBankAction(world, alice, 'bankDeposit', { amount: 100 }, now + 1).ok, true);
  assert.equal(borrow(world, alice, 100, 24, false, now + 2).ok, true);
  const loan = player.bankAccount.creditLoan;
  processBankWorld(world, loan.dueAt);
  assert.equal(player.bankAccount.creditLoan.status, 'grace');
  const withdrawal = applyBankAction(world, alice, 'bankWithdraw', { amount: 1 }, loan.dueAt + 1);
  assert.equal(withdrawal.ok, false);
  assert.match(withdrawal.message, /宽限期|追偿期/);
});

// Keep one catalog assertion here so a drastic farm-value change cannot silently
// invalidate the default-collection coverage above.
test('banking test fixture uses the formal farm catalog', () => {
  const farm = FACILITY_TYPE_CATALOG.find((facility) => facility.id === 'farm');
  assert.ok(farm);
  assert.ok(farm.systemValue > 0);
});
