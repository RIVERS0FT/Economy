export const CHECK_IN_TIME_ZONE = 'Asia/Shanghai';
export const DAILY_CHECK_IN_REWARD_GEMS = 1;
export const WEEKLY_FULL_ATTENDANCE_REWARD_GEMS = 5;
export const CHECK_IN_DAY_MS = 24 * 60 * 60 * 1000;

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function safeTimestamp(value, fallback) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : fallback;
}

export function checkInDateKey(now = Date.now()) {
  return new Date(safeTimestamp(now, Date.now()) + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

export function dailyCheckInPeriodFor(now = Date.now()) {
  const timestamp = safeTimestamp(now, Date.now());
  const local = new Date(timestamp + SHANGHAI_OFFSET_MS);
  const localDayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const todayStartsAt = localDayStart - SHANGHAI_OFFSET_MS;
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMonday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  const weekStartsAt = localMonday - SHANGHAI_OFFSET_MS;
  const dateKeys = Array.from({ length: 7 }, (_, index) => (
    checkInDateKey(weekStartsAt + index * CHECK_IN_DAY_MS)
  ));
  return {
    todayKey: checkInDateKey(timestamp),
    todayStartsAt,
    nextResetAt: todayStartsAt + CHECK_IN_DAY_MS,
    weekKey: checkInDateKey(weekStartsAt),
    weekStartsAt,
    weekEndsAt: weekStartsAt + 7 * CHECK_IN_DAY_MS,
    dateKeys,
  };
}

export function nextDailyCheckInResetAt(now = Date.now()) {
  return dailyCheckInPeriodFor(now).nextResetAt;
}

export function processDailyCheckInWorld(world, now = Date.now()) {
  const dateKey = checkInDateKey(now);
  if (world?.checkInDateKey === dateKey) return false;
  world.checkInDateKey = dateKey;
  return true;
}

export function createDailyCheckInSummary(player, rows = [], now = Date.now()) {
  const period = dailyCheckInPeriodFor(now);
  const validDateKeys = new Set(period.dateKeys);
  const claimedDateKeys = [...new Set((rows || [])
    .map((row) => String(row?.date_key || row?.dateKey || ''))
    .filter((dateKey) => validDateKeys.has(dateKey)))]
    .sort();
  const weeklyBonusEarned = (rows || []).some((row) => (
    Number(row?.weekly_bonus_gems ?? row?.weeklyBonusGems ?? 0) > 0
  ));
  const registeredAt = safeTimestamp(player?.registeredAt, now);
  return {
    timeZone: CHECK_IN_TIME_ZONE,
    todayKey: period.todayKey,
    weekKey: period.weekKey,
    weekStartsAt: period.weekStartsAt,
    weekEndsAt: period.weekEndsAt,
    nextResetAt: period.nextResetAt,
    dateKeys: period.dateKeys,
    claimedToday: claimedDateKeys.includes(period.todayKey),
    claimedDateKeys,
    weeklyClaimCount: claimedDateKeys.length,
    weeklyBonusEarned,
    weeklyBonusEligible: registeredAt <= period.weekStartsAt,
    dailyRewardGems: DAILY_CHECK_IN_REWARD_GEMS,
    weeklyBonusGems: WEEKLY_FULL_ATTENDANCE_REWARD_GEMS,
  };
}

export function dailyCheckInRewardFor(player, rows = [], now = Date.now()) {
  const summary = createDailyCheckInSummary(player, rows, now);
  if (summary.claimedToday) {
    return { summary, alreadyClaimed: true, dailyGems: 0, weeklyBonusGems: 0, totalGems: 0 };
  }
  const weeklyBonusGems = summary.weeklyBonusEligible
    && !summary.weeklyBonusEarned
    && summary.weeklyClaimCount === 6
    ? WEEKLY_FULL_ATTENDANCE_REWARD_GEMS
    : 0;
  return {
    summary,
    alreadyClaimed: false,
    dailyGems: DAILY_CHECK_IN_REWARD_GEMS,
    weeklyBonusGems,
    totalGems: DAILY_CHECK_IN_REWARD_GEMS + weeklyBonusGems,
  };
}
