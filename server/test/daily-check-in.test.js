import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHECK_IN_DAY_MS,
  DAILY_CHECK_IN_REWARD_GEMS,
  WEEKLY_FULL_ATTENDANCE_REWARD_GEMS,
  dailyCheckInPeriodFor,
} from '../src/daily-check-in.js';
import { EconomyStore } from '../src/storage.js';

const MONDAY_SHANGHAI = Date.UTC(2026, 6, 12, 16, 0, 0, 0);

function user(id = 1) {
  return { id, email: `check-in-${id}@example.com`, name: `签到玩家${id}`, role: 'user' };
}

function claim(store, account, now, key) {
  return store.apply(account, {
    action: 'checkIn',
    payload: {},
    requestKey: key,
    method: 'POST',
    path: '/api/game/check-in',
  }, now);
}

test('daily check-in boundaries use Monday weeks and Shanghai midnight', () => {
  const beforeMonday = dailyCheckInPeriodFor(MONDAY_SHANGHAI - 1);
  const monday = dailyCheckInPeriodFor(MONDAY_SHANGHAI);
  assert.equal(beforeMonday.weekKey, '2026-07-06');
  assert.equal(monday.weekKey, '2026-07-13');
  assert.equal(monday.todayKey, '2026-07-13');
  assert.equal(monday.nextResetAt, MONDAY_SHANGHAI + CHECK_IN_DAY_MS);
  assert.deepEqual(monday.dateKeys, [
    '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16',
    '2026-07-17', '2026-07-18', '2026-07-19',
  ]);
});

test('daily check-in grants one gem once per server day', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  const account = user(1);
  try {
    store.getState(account, MONDAY_SHANGHAI - CHECK_IN_DAY_MS);
    const now = MONDAY_SHANGHAI + 12 * 60 * 60 * 1000;
    const first = claim(store, account, now, 'check-in-once-0001');
    const duplicate = claim(store, account, now + 1, 'check-in-once-0002');
    assert.equal(first.result.ok, true);
    assert.match(first.result.message, /获得 1 宝石/);
    assert.equal(duplicate.result.ok, false);
    assert.match(duplicate.result.message, /今日已签到/);
    const state = store.getState(account, now + 2);
    assert.equal(state.gems, DAILY_CHECK_IN_REWARD_GEMS);
    assert.equal(state.checkIn.claimedToday, true);
    assert.equal(state.checkIn.weeklyClaimCount, 1);
    assert.equal(store.database.prepare('SELECT COUNT(*) AS count FROM economy_daily_check_ins').get().count, 1);
    assert.equal(store.database.prepare("SELECT COUNT(*) AS count FROM economy_gem_ledger WHERE category = 'daily_check_in'").get().count, 1);
  } finally {
    store.close();
  }
});

test('seven complete days atomically grant the five-gem full-attendance bonus', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  const account = user(2);
  try {
    store.getState(account, MONDAY_SHANGHAI - CHECK_IN_DAY_MS);
    for (let index = 0; index < 7; index += 1) {
      const result = claim(
        store,
        account,
        MONDAY_SHANGHAI + index * CHECK_IN_DAY_MS + 12 * 60 * 60 * 1000,
        `full-week-${String(index).padStart(4, '0')}`,
      );
      assert.equal(result.result.ok, true);
    }
    const state = store.getState(account, MONDAY_SHANGHAI + 6 * CHECK_IN_DAY_MS + 13 * 60 * 60 * 1000);
    assert.equal(state.gems, 7 * DAILY_CHECK_IN_REWARD_GEMS + WEEKLY_FULL_ATTENDANCE_REWARD_GEMS);
    assert.equal(state.checkIn.weeklyClaimCount, 7);
    assert.equal(state.checkIn.weeklyBonusEarned, true);
    assert.equal(store.database.prepare("SELECT COUNT(*) AS count FROM economy_gem_ledger WHERE category = 'weekly_full_attendance'").get().count, 1);
    assert.equal(store.database.prepare('SELECT COUNT(*) AS count FROM economy_gem_ledger').get().count, 8);
  } finally {
    store.close();
  }
});

test('registration week can claim daily gems but cannot receive full-attendance bonus', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  const account = user(3);
  try {
    const wednesday = MONDAY_SHANGHAI + 2 * CHECK_IN_DAY_MS;
    store.getState(account, wednesday + 60_000);
    for (let index = 2; index < 7; index += 1) {
      claim(
        store,
        account,
        MONDAY_SHANGHAI + index * CHECK_IN_DAY_MS + 12 * 60 * 60 * 1000,
        `partial-week-${String(index).padStart(4, '0')}`,
      );
    }
    const state = store.getState(account, MONDAY_SHANGHAI + 6 * CHECK_IN_DAY_MS + 13 * 60 * 60 * 1000);
    assert.equal(state.gems, 5);
    assert.equal(state.checkIn.weeklyBonusEligible, false);
    assert.equal(state.checkIn.weeklyBonusEarned, false);
    assert.equal(store.database.prepare("SELECT COUNT(*) AS count FROM economy_gem_ledger WHERE category = 'weekly_full_attendance'").get().count, 0);
  } finally {
    store.close();
  }
});
