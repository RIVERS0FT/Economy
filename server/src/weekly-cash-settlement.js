import { randomUUID } from 'node:crypto';
import { MARKET_DEMAND_GROUP_CATALOG } from './market-demand/catalog.js';
import { allocateMoneyBudget } from './market-demand/math.js';
import { calculateRateMoney, internalMoneyToMicros, roundInternalMoney } from './money.js';

export const WEEKLY_CASH_SETTLEMENT_VERSION = 2;
export const WEEKLY_CASH_SETTLEMENT_RATE_BPS = 1_000;
export const WEEKLY_CASH_TIME_ZONE = 'Asia/Shanghai';

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const MAX_TRANSACTION_HISTORY = 100;

function safeTimestamp(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function safeMoney(value, fallback = 0) {
  const normalized = roundInternalMoney(value);
  return normalized !== null && normalized >= 0 ? normalized : fallback;
}

function safeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function addMoney(left, right, message = '周资金结算金额超出系统可表示范围') {
  const total = roundInternalMoney(Number(left || 0) + Number(right || 0));
  if (total === null || internalMoneyToMicros(total) === null) throw new Error(message);
  return total;
}

function creditMarketReserve(world, amount) {
  const normalized = safeMoney(amount);
  if (normalized <= 0) return {};
  const groups = world.marketDemand?.liquidity?.groups;
  if (!groups || typeof groups !== 'object') {
    throw new Error('市场储备未初始化，无法接收周资金结算');
  }
  const entries = MARKET_DEMAND_GROUP_CATALOG.map((group) => {
    const state = groups[group.id];
    if (!state || typeof state !== 'object') {
      throw new Error(`市场储备账户缺失: ${group.id}`);
    }
    return {
      id: group.id,
      weight: Math.max(0, Number(group.baseBudget || 0)),
      maxBudget: normalized,
    };
  });
  const allocations = allocateMoneyBudget(entries, normalized);
  const transferredByGroup = {};
  let transferred = 0;
  for (const entry of entries) {
    const credit = safeMoney(allocations.get(entry.id));
    const state = groups[entry.id];
    state.credits = addMoney(
      state.credits,
      credit,
      '市场储备周资金结算金额超出系统可表示范围',
    );
    transferred = addMoney(transferred, credit);
    transferredByGroup[entry.id] = credit;
  }
  if (internalMoneyToMicros(transferred) !== internalMoneyToMicros(normalized)) {
    throw new Error('周资金结算转入市场储备时发生资金守恒错误');
  }
  return transferredByGroup;
}

function subtractMoney(left, right) {
  return Math.max(0, roundInternalMoney(Number(left || 0) - Number(right || 0)) || 0);
}

function floorRate(amount, rateBps) {
  const normalized = calculateRateMoney(amount, rateBps, 10_000, 'floor');
  if (normalized === null || normalized < 0 || normalized > MAX_SAFE) {
    throw new Error('周资金结算结果超出系统可表示范围');
  }
  return normalized;
}

function dateKey(timestamp) {
  return new Date(timestamp + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

export function weeklyCashPeriodFor(now = Date.now()) {
  const timestamp = Math.max(0, Number(now) || 0);
  const local = new Date(timestamp + BEIJING_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMonday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  const startsAt = localMonday - BEIJING_OFFSET_MS;
  return {
    key: dateKey(startsAt),
    startsAt,
    endsAt: startsAt + WEEK_MS,
  };
}

function nextLocalMidnightAt(now) {
  const timestamp = Math.max(0, Number(now) || 0);
  const local = new Date(timestamp + BEIJING_OFFSET_MS);
  const localNext = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  return localNext - BEIJING_OFFSET_MS;
}

function defaultWorldState(now) {
  const period = weeklyCashPeriodFor(now);
  return {
    version: WEEKLY_CASH_SETTLEMENT_VERSION,
    currentWeekKey: period.key,
    currentWeekStartsAt: period.startsAt,
    nextCloseAt: period.endsAt,
    partial: true,
    totals: {
      activePlayersAssessed: 0,
      returningPlayersAssessed: 0,
      assessedCredits: 0,
      collectedCredits: 0,
      outstandingCredits: 0,
      burnedCredits: 0,
      reserveTransferredCredits: 0,
    },
  };
}

function defaultPlayerState(now) {
  const period = weeklyCashPeriodFor(now);
  return {
    version: WEEKLY_CASH_SETTLEMENT_VERSION,
    activeWeekKey: null,
    activatedAt: null,
    interestEligibleFrom: null,
    lastClosedWeekKey: null,
    lastAppliedWeekKey: null,
    lastLoginWeekKey: period.key,
    lastLoginAt: Math.max(0, Number(now) || 0),
    pendingSettlement: null,
    lastSettlement: null,
    totals: {
      assessedCredits: 0,
      collectedCredits: 0,
      burnedCredits: 0,
      reserveTransferredCredits: 0,
    },
  };
}

function normalizeSettlement(value) {
  if (!value || typeof value !== 'object') return null;
  const amountDue = safeMoney(value.amountDue);
  const amountCollected = Math.min(amountDue, safeMoney(value.amountCollected));
  const amountOutstanding = Math.min(
    amountDue,
    safeMoney(value.amountOutstanding, subtractMoney(amountDue, amountCollected)),
  );
  if (amountDue <= 0 && amountOutstanding <= 0) return null;
  return {
    id: String(value.id || `weekly-cash-settlement-${randomUUID()}`),
    type: value.type === 'returning_player' ? 'returning_player' : 'active_week',
    weekKey: String(value.weekKey || ''),
    closingCurrencyAssets: safeMoney(value.closingCurrencyAssets),
    loanLiability: safeMoney(value.loanLiability),
    priorSettlementLiability: safeMoney(value.priorSettlementLiability),
    taxBase: safeMoney(value.taxBase),
    rateBps: safeInteger(value.rateBps, WEEKLY_CASH_SETTLEMENT_RATE_BPS),
    amountDue,
    amountCollected,
    amountOutstanding,
    assessedAt: safeTimestamp(value.assessedAt),
    appliedAt: value.appliedAt === null || value.appliedAt === undefined
      ? null
      : safeTimestamp(value.appliedAt),
  };
}

export function ensureWeeklyCashSettlementWorld(world, now = Date.now(), { normalizePlayers = true } = {}) {
  const fallback = defaultWorldState(now);
  const state = world.weeklyCashSettlement && typeof world.weeklyCashSettlement === 'object'
    ? world.weeklyCashSettlement
    : fallback;
  state.version = WEEKLY_CASH_SETTLEMENT_VERSION;
  state.currentWeekKey = typeof state.currentWeekKey === 'string' ? state.currentWeekKey : fallback.currentWeekKey;
  state.currentWeekStartsAt = safeTimestamp(state.currentWeekStartsAt, fallback.currentWeekStartsAt);
  state.nextCloseAt = safeTimestamp(state.nextCloseAt, fallback.nextCloseAt);
  state.partial = state.partial !== false;
  state.totals = { ...fallback.totals, ...(state.totals || {}) };
  for (const key of Object.keys(fallback.totals)) state.totals[key] = safeMoney(state.totals[key]);
  world.weeklyCashSettlement = state;
  if (normalizePlayers) {
    for (const player of Object.values(world.players || {})) ensurePlayerWeeklyCashSettlement(player, now);
  }
  return state;
}

export function ensurePlayerWeeklyCashSettlement(player, now = Date.now()) {
  const fallback = defaultPlayerState(now);
  const state = player.weeklyCashSettlement && typeof player.weeklyCashSettlement === 'object'
    ? player.weeklyCashSettlement
    : fallback;
  state.version = WEEKLY_CASH_SETTLEMENT_VERSION;
  state.activeWeekKey = typeof state.activeWeekKey === 'string' ? state.activeWeekKey : null;
  state.activatedAt = state.activatedAt === null || state.activatedAt === undefined
    ? null
    : safeTimestamp(state.activatedAt);
  state.interestEligibleFrom = state.interestEligibleFrom === null || state.interestEligibleFrom === undefined
    ? null
    : safeTimestamp(state.interestEligibleFrom);
  state.lastClosedWeekKey = typeof state.lastClosedWeekKey === 'string' ? state.lastClosedWeekKey : null;
  state.lastAppliedWeekKey = typeof state.lastAppliedWeekKey === 'string' ? state.lastAppliedWeekKey : null;
  state.lastLoginWeekKey = typeof state.lastLoginWeekKey === 'string' ? state.lastLoginWeekKey : fallback.lastLoginWeekKey;
  state.lastLoginAt = safeTimestamp(state.lastLoginAt, fallback.lastLoginAt);
  state.pendingSettlement = normalizeSettlement(state.pendingSettlement);
  state.lastSettlement = normalizeSettlement(state.lastSettlement);
  state.totals = { ...fallback.totals, ...(state.totals || {}) };
  for (const key of Object.keys(fallback.totals)) state.totals[key] = safeMoney(state.totals[key]);
  player.weeklyCashSettlement = state;
  return state;
}

function loanLiability(player) {
  const loan = player?.bankAccount?.activeLoan;
  if (!loan) return 0;
  return addMoney(safeMoney(loan.principalOutstanding), safeMoney(loan.interestOutstanding));
}

export function weeklySettlementLiability(player) {
  return safeMoney(player?.weeklyCashSettlement?.pendingSettlement?.amountOutstanding);
}

function currencyAssets(player) {
  return addMoney(
    addMoney(safeMoney(player?.credits), safeMoney(player.frozenCredits)),
    safeMoney(player?.bankAccount?.depositCredits),
  );
}

function settlementBaseFor(player) {
  const cash = currencyAssets(player);
  const loan = loanLiability(player);
  const priorSettlement = weeklySettlementLiability(player);
  return {
    currencyAssets: cash,
    loanLiability: loan,
    priorSettlementLiability: priorSettlement,
    taxBase: Math.max(0, subtractMoney(subtractMoney(cash, loan), priorSettlement)),
  };
}

function addBankTransaction(player, type, amount, now, description, metadata = {}) {
  const account = player.bankAccount;
  if (!account || typeof account !== 'object') return;
  account.recentTransactions = Array.isArray(account.recentTransactions) ? account.recentTransactions : [];
  account.recentTransactions.push({
    id: `bank-transaction-${randomUUID()}`,
    type,
    amount: safeMoney(amount),
    createdAt: safeTimestamp(now),
    description,
    ...metadata,
  });
  account.recentTransactions = account.recentTransactions.slice(-MAX_TRANSACTION_HISTORY);
}

function createAssessment(world, player, type, weekKey, assessedAt) {
  const state = ensureWeeklyCashSettlementWorld(world, assessedAt, { normalizePlayers: false });
  const playerState = ensurePlayerWeeklyCashSettlement(player, assessedAt);
  if (playerState.pendingSettlement) return playerState.pendingSettlement;
  const base = settlementBaseFor(player);
  const amountDue = floorRate(base.taxBase, WEEKLY_CASH_SETTLEMENT_RATE_BPS);
  const settlement = {
    id: `weekly-cash-settlement-${player.userId}-${weekKey}-${type}`,
    type,
    weekKey,
    closingCurrencyAssets: base.currencyAssets,
    loanLiability: base.loanLiability,
    priorSettlementLiability: base.priorSettlementLiability,
    taxBase: base.taxBase,
    rateBps: WEEKLY_CASH_SETTLEMENT_RATE_BPS,
    amountDue,
    amountCollected: 0,
    amountOutstanding: amountDue,
    assessedAt,
    appliedAt: null,
  };
  playerState.pendingSettlement = amountDue > 0 ? settlement : null;
  playerState.lastClosedWeekKey = weekKey;
  playerState.totals.assessedCredits = addMoney(playerState.totals.assessedCredits, amountDue);
  player.stats ||= {};
  player.stats.weeklyCashSettlementAssessed = addMoney(player.stats.weeklyCashSettlementAssessed, amountDue);
  world.stats ||= {};
  world.stats.weeklyCashSettlementAssessed = addMoney(world.stats.weeklyCashSettlementAssessed, amountDue);
  state.totals.assessedCredits = addMoney(state.totals.assessedCredits, amountDue);
  state.totals.outstandingCredits = addMoney(state.totals.outstandingCredits, amountDue);
  if (type === 'returning_player') state.totals.returningPlayersAssessed += 1;
  else state.totals.activePlayersAssessed += 1;
  if (amountDue <= 0) {
    playerState.lastSettlement = settlement;
    playerState.lastAppliedWeekKey = weekKey;
  }
  return settlement;
}

function closeWeek(world, state, closedAt) {
  const weekKey = state.currentWeekKey;
  if (!state.partial) {
    for (const player of Object.values(world.players || {})) {
      const playerState = ensurePlayerWeeklyCashSettlement(player, closedAt);
      if (playerState.activeWeekKey !== weekKey || playerState.pendingSettlement) continue;
      createAssessment(world, player, 'active_week', weekKey, closedAt);
    }
  }
  const next = weeklyCashPeriodFor(closedAt + 1);
  state.currentWeekKey = next.key;
  state.currentWeekStartsAt = next.startsAt;
  state.nextCloseAt = next.endsAt;
  state.partial = false;
}

export function processWeeklyCashSettlementWorld(world, now = Date.now()) {
  const state = ensureWeeklyCashSettlementWorld(world, now);
  let changed = false;
  let iterations = 0;
  while (state.nextCloseAt <= now && iterations < 520) {
    closeWeek(world, state, state.nextCloseAt);
    changed = true;
    iterations += 1;
  }
  if (iterations >= 520) throw new Error('周资金结算跨周处理超过安全上限');
  return changed;
}

export function activateWeeklyCashSettlement(world, player, now = Date.now(), { processWorld = true } = {}) {
  if (processWorld) processWeeklyCashSettlementWorld(world, now);
  else ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers: false });
  const state = ensurePlayerWeeklyCashSettlement(player, now);
  if (weeklySettlementLiability(player) > 0) return false;
  const period = weeklyCashPeriodFor(now);
  if (state.activeWeekKey === period.key) return false;
  state.activeWeekKey = period.key;
  state.activatedAt = now;
  state.interestEligibleFrom = nextLocalMidnightAt(now);
  return true;
}

export function isPlayerWeeklyInterestEligible(player, settlementAt) {
  const state = ensurePlayerWeeklyCashSettlement(player, settlementAt);
  const interestPeriod = weeklyCashPeriodFor(Math.max(0, Number(settlementAt) - 1));
  return state.activeWeekKey === interestPeriod.key
    && state.interestEligibleFrom !== null
    && state.interestEligibleFrom <= settlementAt;
}

export function collectPlayerWeeklyCashSettlement(world, player, now = Date.now()) {
  const worldState = ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers: false });
  const playerState = ensurePlayerWeeklyCashSettlement(player, now);
  const pending = playerState.pendingSettlement;
  if (!pending || pending.amountOutstanding <= 0) return { collected: 0, outstanding: 0, completed: true };

  let remaining = pending.amountOutstanding;
  const account = player.bankAccount && typeof player.bankAccount === 'object' ? player.bankAccount : null;
  const fromDeposit = account ? Math.min(safeMoney(account.depositCredits), remaining) : 0;
  if (fromDeposit > 0) {
    account.depositCredits = subtractMoney(account.depositCredits, fromDeposit);
    account.dayMinimumDepositCredits = Math.min(
      safeMoney(account.dayMinimumDepositCredits, account.depositCredits),
      account.depositCredits,
    );
    remaining = subtractMoney(remaining, fromDeposit);
  }
  const fromCash = Math.min(safeMoney(player.credits), remaining);
  if (fromCash > 0) {
    player.credits = subtractMoney(player.credits, fromCash);
    remaining = subtractMoney(remaining, fromCash);
  }
  const collected = addMoney(fromDeposit, fromCash);
  if (collected > 0) {
    const reserveAllocations = creditMarketReserve(world, collected);
    pending.amountCollected = addMoney(pending.amountCollected, collected);
    pending.amountOutstanding = remaining;
    pending.appliedAt = now;
    playerState.totals.collectedCredits = addMoney(playerState.totals.collectedCredits, collected);
    playerState.totals.reserveTransferredCredits = addMoney(
      playerState.totals.reserveTransferredCredits,
      collected,
    );
    player.stats ||= {};
    player.stats.weeklyCashSettlementCollected = addMoney(player.stats.weeklyCashSettlementCollected, collected);
    player.stats.weeklyCashSettlementReserveTransferred = addMoney(
      player.stats.weeklyCashSettlementReserveTransferred,
      collected,
    );
    world.stats ||= {};
    world.stats.weeklyCashSettlementCollected = addMoney(world.stats.weeklyCashSettlementCollected, collected);
    world.stats.weeklyCashSettlementReserveTransferred = addMoney(
      world.stats.weeklyCashSettlementReserveTransferred,
      collected,
    );
    worldState.totals.collectedCredits = addMoney(worldState.totals.collectedCredits, collected);
    worldState.totals.reserveTransferredCredits = addMoney(
      worldState.totals.reserveTransferredCredits,
      collected,
    );
    worldState.totals.outstandingCredits = subtractMoney(worldState.totals.outstandingCredits, collected);
    addBankTransaction(player, 'weekly_cash_settlement', collected, now, '完成周资金扣除结算，资金转入市场储备', {
      settlementId: pending.id,
      weekKey: pending.weekKey,
      source: fromDeposit > 0 && fromCash > 0 ? 'deposit_and_cash' : fromDeposit > 0 ? 'deposit' : 'cash',
      destination: 'market_reserve',
      reserveAllocations,
    });
  }

  if (remaining <= 0) {
    pending.amountOutstanding = 0;
    pending.appliedAt = now;
    playerState.lastSettlement = structuredClone(pending);
    playerState.lastAppliedWeekKey = pending.weekKey;
    playerState.pendingSettlement = null;
    return { collected, outstanding: 0, completed: true };
  }
  return { collected, outstanding: remaining, completed: false };
}

export function settlePlayerWeeklyCashOnLogin(world, player, now = Date.now(), { processWorld = true } = {}) {
  if (processWorld) processWeeklyCashSettlementWorld(world, now);
  else ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers: false });
  const playerState = ensurePlayerWeeklyCashSettlement(player, now);
  const currentPeriod = weeklyCashPeriodFor(now);
  const enteredNewLoginPeriod = playerState.lastLoginWeekKey !== currentPeriod.key
    || playerState.lastLoginAt < currentPeriod.startsAt;
  const hadPending = weeklySettlementLiability(player) > 0;
  let result = collectPlayerWeeklyCashSettlement(world, player, now);
  if (!hadPending
    && !playerState.pendingSettlement
    && enteredNewLoginPeriod) {
    createAssessment(world, player, 'returning_player', currentPeriod.key, now);
    result = collectPlayerWeeklyCashSettlement(world, player, now);
  }
  if (enteredNewLoginPeriod) {
    playerState.lastLoginWeekKey = currentPeriod.key;
    playerState.lastLoginAt = now;
  }
  return result;
}

export function playerNeedsWeeklyLoginSettlement(player, now = Date.now()) {
  if (!player || typeof player !== 'object') return false;
  const current = weeklyCashPeriodFor(now);
  const state = player.weeklyCashSettlement;
  if (!state || typeof state !== 'object') return true;
  return safeMoney(state.pendingSettlement?.amountOutstanding) > 0
    || safeTimestamp(state.lastLoginAt) < current.startsAt;
}

export function nextWeeklyCashSettlementDeadlineAt(world, now = Date.now()) {
  const state = ensureWeeklyCashSettlementWorld(world, now);
  return state.nextCloseAt;
}

export function createWeeklyCashSettlementClientState(world, player, now = Date.now()) {
  const worldState = world?.weeklyCashSettlement && typeof world.weeklyCashSettlement === 'object'
    ? world.weeklyCashSettlement
    : defaultWorldState(now);
  const playerState = player?.weeklyCashSettlement && typeof player.weeklyCashSettlement === 'object'
    ? player.weeklyCashSettlement
    : defaultPlayerState(now);
  const period = weeklyCashPeriodFor(now);
  const base = settlementBaseFor(player);
  return {
    version: WEEKLY_CASH_SETTLEMENT_VERSION,
    timeZone: WEEKLY_CASH_TIME_ZONE,
    rateBps: WEEKLY_CASH_SETTLEMENT_RATE_BPS,
    currentWeekKey: period.key,
    weekStartsAt: period.startsAt,
    weekEndsAt: period.endsAt,
    nextCloseAt: worldState.nextCloseAt,
    interestActive: playerState.activeWeekKey === period.key,
    activatedAt: playerState.activeWeekKey === period.key ? playerState.activatedAt : null,
    interestEligibleFrom: playerState.activeWeekKey === period.key ? playerState.interestEligibleFrom : null,
    estimatedTaxBase: base.taxBase,
    estimatedAssessment: floorRate(base.taxBase, WEEKLY_CASH_SETTLEMENT_RATE_BPS),
    outstandingCredits: weeklySettlementLiability(player),
    pendingSettlement: playerState.pendingSettlement ? structuredClone(playerState.pendingSettlement) : null,
    lastSettlement: playerState.lastSettlement ? structuredClone(playerState.lastSettlement) : null,
  };
}
