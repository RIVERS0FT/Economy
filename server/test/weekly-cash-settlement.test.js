import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { ensurePlayerBankAccount } from '../src/banking.js';
import {
  activateWeeklyCashSettlement,
  collectPlayerWeeklyCashSettlement,
  ensurePlayerWeeklyCashSettlement,
  ensureWeeklyCashSettlementWorld,
  processWeeklyCashSettlementWorld,
  settlePlayerWeeklyCashOnLogin,
  weeklyCashPeriodFor,
  weeklySettlementLiability,
} from '../src/weekly-cash-settlement.js';

const monday = Date.UTC(2027, 0, 3, 16, 0, 0); // 2027-01-04 00:00 Asia/Shanghai
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

function preparedPlayer(world, credits = 0, deposit = 0, frozenCredits = 0) {
  const player = ensurePlayer(world, alice, monday);
  player.credits = credits;
  player.frozenCredits = frozenCredits;
  const account = ensurePlayerBankAccount(player, monday);
  account.depositCredits = deposit;
  account.dayOpeningDepositCredits = deposit;
  account.dayMinimumDepositCredits = deposit;
  ensureWeeklyCashSettlementWorld(world, monday);
  return player;
}

test('successful economic activity activates only the current week and interest begins next midnight', () => {
  const world = createWorld(monday);
  const player = preparedPlayer(world, 100, 100);
  const activatedAt = monday + 12 * 60 * 60 * 1000;
  assert.equal(activateWeeklyCashSettlement(world, player, activatedAt), true);
  const state = ensurePlayerWeeklyCashSettlement(player, activatedAt);
  assert.equal(state.activeWeekKey, weeklyCashPeriodFor(activatedAt).key);
  assert.equal(state.interestEligibleFrom, monday + 24 * 60 * 60 * 1000);
  assert.equal(activateWeeklyCashSettlement(world, player, activatedAt + 1), false);
});

test('an active week closes one immutable ten-percent assessment and login collects deposit before cash', () => {
  const world = createWorld(monday);
  const player = preparedPlayer(world, 30, 70, 200);
  const state = ensureWeeklyCashSettlementWorld(world, monday);
  state.partial = false;
  assert.equal(activateWeeklyCashSettlement(world, player, monday + 1), true);

  processWeeklyCashSettlementWorld(world, weeklyCashPeriodFor(monday).endsAt);
  const pending = player.weeklyCashSettlement.pendingSettlement;
  assert.equal(pending.taxBase, 300);
  assert.equal(pending.amountDue, 30);
  assert.equal(weeklySettlementLiability(player), 30);
  assert.equal(player.bankAccount.depositCredits, 70, 'week close creates a liability without taking funds');

  const result = settlePlayerWeeklyCashOnLogin(world, player, weeklyCashPeriodFor(monday).endsAt + 1);
  assert.deepEqual(result, { collected: 30, outstanding: 0, completed: true });
  assert.equal(player.bankAccount.depositCredits, 40);
  assert.equal(player.credits, 30);
  assert.equal(player.weeklyCashSettlement.pendingSettlement, null);
  assert.equal(player.stats.weeklyCashSettlementBurned, 30);
});

test('frozen money is assessed without breaking escrow and unpaid settlement remains a liability', () => {
  const world = createWorld(monday);
  const player = preparedPlayer(world, 5, 0, 195);
  const state = ensureWeeklyCashSettlementWorld(world, monday);
  state.partial = false;
  activateWeeklyCashSettlement(world, player, monday + 1);
  processWeeklyCashSettlementWorld(world, weeklyCashPeriodFor(monday).endsAt);

  assert.equal(player.weeklyCashSettlement.pendingSettlement.amountDue, 20);
  const result = collectPlayerWeeklyCashSettlement(world, player, weeklyCashPeriodFor(monday).endsAt + 1);
  assert.equal(result.collected, 5);
  assert.equal(result.outstanding, 15);
  assert.equal(player.frozenCredits, 195, 'escrow remains untouched');
  assert.equal(weeklySettlementLiability(player), 15);

  player.credits = 20;
  const second = collectPlayerWeeklyCashSettlement(world, player, weeklyCashPeriodFor(monday).endsAt + 2);
  assert.equal(second.collected, 15);
  assert.equal(player.credits, 5);
  assert.equal(weeklySettlementLiability(player), 0);
});

test('a long inactive return produces one login assessment instead of one assessment per missed week', () => {
  const world = createWorld(monday);
  const player = preparedPlayer(world, 1_000, 0);
  const state = ensurePlayerWeeklyCashSettlement(player, monday);
  state.lastLoginAt = monday;
  state.lastLoginWeekKey = weeklyCashPeriodFor(monday).key;
  const returnAt = monday + 8 * 7 * 24 * 60 * 60 * 1000 + 1;

  const result = settlePlayerWeeklyCashOnLogin(world, player, returnAt);
  assert.equal(result.collected, 100);
  assert.equal(player.credits, 900);
  assert.equal(player.weeklyCashSettlement.lastSettlement.type, 'returning_player');
  assert.equal(player.weeklyCashSettlement.totals.assessedCredits, 100);

  const repeated = settlePlayerWeeklyCashOnLogin(world, player, returnAt + 1);
  assert.equal(repeated.collected, 0);
  assert.equal(player.credits, 900);
  assert.equal(player.weeklyCashSettlement.totals.assessedCredits, 100);
});

test('loan liabilities lower the weekly assessment base', () => {
  const world = createWorld(monday);
  const player = preparedPlayer(world, 100, 100, 100);
  player.bankAccount.activeLoan = {
    id: 'loan', status: 'active', borrowedAt: monday, dueAt: monday + 10 * 24 * 60 * 60 * 1000,
    graceEndsAt: monday + 11 * 24 * 60 * 60 * 1000, principalOriginal: 100, principalOutstanding: 100,
    interestOriginal: 10, interestOutstanding: 10, interestRateBps: 1_000,
    collateral: [{ facilityTypeId: 'farm', quantity: 1, prudentUnitValue: 65 }],
    collateralValueAtOrigination: 65, ltvBps: 3_000, autoRepay: false,
  };
  const worldState = ensureWeeklyCashSettlementWorld(world, monday);
  worldState.partial = false;
  activateWeeklyCashSettlement(world, player, monday + 1);
  processWeeklyCashSettlementWorld(world, weeklyCashPeriodFor(monday).endsAt);
  assert.equal(player.weeklyCashSettlement.pendingSettlement.taxBase, 190);
  assert.equal(player.weeklyCashSettlement.pendingSettlement.amountDue, 19);
});
