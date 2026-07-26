import { randomUUID } from 'node:crypto';
import { FACILITY_TYPE_CATALOG } from './domain.js';
import { facilitySellQuantityForOwner } from './order-book-runtime.js';
import { creditPopulationEmployment } from './population-economy.js';

export const BANKING_VERSION = 1;
export const BANK_TIME_ZONE = 'Asia/Shanghai';
export const BANK_LOAN_TERM_MS = 72 * 60 * 60 * 1000;
export const BANK_LOAN_GRACE_MS = 12 * 60 * 60 * 1000;
export const BANK_DAILY_INTEREST_CAP_BPS = 25; // 0.25%
export const BANK_INTEREST_POOL_RETENTION_DAYS = 7;
export const BANK_INTEREST_MICROS_PER_CREDIT = 1_000_000;
export const BANK_INTEREST_POOL_SHARE_PERCENT = 70;
export const BANK_EMPLOYMENT_SHARE_PERCENT = 20;
export const BANK_RISK_RESERVE_SHARE_PERCENT = 10;

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = 30 * DAY_MS;
const MAX_TRANSACTION_HISTORY = 100;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const FACILITY_BY_ID = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));

function safeNonNegativeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function safePositiveInteger(value, max = MAX_SAFE) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 1 && normalized <= max ? normalized : null;
}

function addSafe(left, right, message = '银行金额超出系统可表示范围') {
  const total = BigInt(safeNonNegativeInteger(left)) + BigInt(safeNonNegativeInteger(right));
  if (total > BigInt(MAX_SAFE)) throw new Error(message);
  return Number(total);
}

function multiplyFloor(left, right, divisor, message = '银行计算结果超出系统可表示范围') {
  const result = BigInt(safeNonNegativeInteger(left)) * BigInt(safeNonNegativeInteger(right)) / BigInt(divisor);
  if (result > BigInt(MAX_SAFE)) throw new Error(message);
  return Number(result);
}

function multiplyCeil(left, right, divisor, message = '银行计算结果超出系统可表示范围') {
  const numerator = BigInt(safeNonNegativeInteger(left)) * BigInt(safeNonNegativeInteger(right));
  const result = (numerator + BigInt(divisor) - 1n) / BigInt(divisor);
  if (result > BigInt(MAX_SAFE)) throw new Error(message);
  return Number(result);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function bankPeriodFor(now = Date.now()) {
  const timestamp = Math.max(0, Number(now) || 0);
  const local = new Date(timestamp + SHANGHAI_OFFSET_MS);
  const localStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const startsAt = localStart - SHANGHAI_OFFSET_MS;
  return {
    dayKey: new Date(startsAt + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10),
    startsAt,
    nextSettlementAt: startsAt + DAY_MS,
  };
}

function defaultBankWorld(now) {
  const period = bankPeriodFor(now);
  return {
    version: BANKING_VERSION,
    currentDayKey: period.dayKey,
    nextInterestSettlementAt: period.nextSettlementAt,
    interestPoolMicros: 0,
    riskReserveCredits: 0,
    facilityReserves: {},
    lastDailyInterestCredits: 0,
    lastDailyRatePpm: 0,
    recentDailyRatesPpm: [],
    totals: {
      creditIssued: 0,
      principalRepaid: 0,
      borrowerInterestReceived: 0,
      depositorInterestPaid: 0,
      interestTransferredToEmployment: 0,
      interestTransferredToReserve: 0,
      defaults: 0,
      facilitiesSeized: 0,
    },
  };
}

function defaultPlayerBankAccount(player, now) {
  const period = bankPeriodFor(now);
  const deposit = safeNonNegativeInteger(player?.bankAccount?.depositCredits);
  return {
    version: BANKING_VERSION,
    depositCredits: deposit,
    dayKey: period.dayKey,
    dayOpeningDepositCredits: deposit,
    dayMinimumDepositCredits: deposit,
    depositInterestCarryMicros: 0,
    totalDepositInterestEarned: 0,
    lastDepositInterestEarned: 0,
    repaidLoanCount: 0,
    lastDefaultAt: null,
    activeLoan: null,
    recentTransactions: [],
  };
}

function normalizeCollateral(items) {
  const quantities = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const facilityTypeId = String(item?.facilityTypeId || item?.assetId || '');
    const quantity = safePositiveInteger(item?.quantity, 1_000_000);
    if (!FACILITY_BY_ID.has(facilityTypeId) || !quantity) continue;
    quantities.set(facilityTypeId, addSafe(quantities.get(facilityTypeId) || 0, quantity));
  }
  return [...quantities].map(([facilityTypeId, quantity]) => ({ facilityTypeId, quantity }));
}

function normalizeLoan(loan) {
  if (!loan || typeof loan !== 'object') return null;
  const collateral = normalizeCollateral(loan.collateral).map((item) => ({
    ...item,
    prudentUnitValue: safeNonNegativeInteger(
      loan.collateral?.find?.((candidate) => String(candidate?.facilityTypeId) === item.facilityTypeId)?.prudentUnitValue,
      FACILITY_BY_ID.get(item.facilityTypeId)?.systemValue || 0,
    ),
  }));
  const status = loan.status === 'grace' ? 'grace' : 'active';
  const principalOutstanding = safeNonNegativeInteger(loan.principalOutstanding ?? loan.principalOriginal);
  const interestOutstanding = safeNonNegativeInteger(loan.interestOutstanding ?? loan.interestOriginal);
  if ((principalOutstanding + interestOutstanding) <= 0 || collateral.length === 0) return null;
  return {
    id: String(loan.id || `bank-loan-${randomUUID()}`),
    status,
    borrowedAt: safeNonNegativeInteger(loan.borrowedAt),
    dueAt: safeNonNegativeInteger(loan.dueAt),
    graceEndsAt: safeNonNegativeInteger(loan.graceEndsAt),
    principalOriginal: safeNonNegativeInteger(loan.principalOriginal, principalOutstanding),
    principalOutstanding,
    interestOriginal: safeNonNegativeInteger(loan.interestOriginal, interestOutstanding),
    interestOutstanding,
    interestRateBps: safeNonNegativeInteger(loan.interestRateBps),
    collateral,
    collateralValueAtOrigination: safeNonNegativeInteger(loan.collateralValueAtOrigination),
    ltvBps: safeNonNegativeInteger(loan.ltvBps),
    autoRepay: loan.autoRepay === true,
  };
}

export function ensureBankWorld(world, now = Date.now()) {
  const fallback = defaultBankWorld(now);
  const bank = world.bank && typeof world.bank === 'object' ? world.bank : fallback;
  bank.version = BANKING_VERSION;
  bank.currentDayKey = typeof bank.currentDayKey === 'string' ? bank.currentDayKey : fallback.currentDayKey;
  bank.nextInterestSettlementAt = safeNonNegativeInteger(bank.nextInterestSettlementAt, fallback.nextInterestSettlementAt);
  bank.interestPoolMicros = safeNonNegativeInteger(bank.interestPoolMicros);
  bank.riskReserveCredits = safeNonNegativeInteger(bank.riskReserveCredits);
  bank.facilityReserves = bank.facilityReserves && typeof bank.facilityReserves === 'object' ? bank.facilityReserves : {};
  for (const facility of FACILITY_TYPE_CATALOG) {
    bank.facilityReserves[facility.id] = safeNonNegativeInteger(bank.facilityReserves[facility.id]);
  }
  bank.lastDailyInterestCredits = safeNonNegativeInteger(bank.lastDailyInterestCredits);
  bank.lastDailyRatePpm = safeNonNegativeInteger(bank.lastDailyRatePpm);
  bank.recentDailyRatesPpm = (Array.isArray(bank.recentDailyRatesPpm) ? bank.recentDailyRatesPpm : [])
    .map((value) => safeNonNegativeInteger(value))
    .slice(-7);
  bank.totals = { ...fallback.totals, ...(bank.totals || {}) };
  for (const key of Object.keys(fallback.totals)) bank.totals[key] = safeNonNegativeInteger(bank.totals[key]);
  world.bank = bank;
  for (const player of Object.values(world.players || {})) ensurePlayerBankAccount(player, now);
  return bank;
}

export function ensurePlayerBankAccount(player, now = Date.now()) {
  const fallback = defaultPlayerBankAccount(player, now);
  const account = player.bankAccount && typeof player.bankAccount === 'object' ? player.bankAccount : fallback;
  account.version = BANKING_VERSION;
  account.depositCredits = safeNonNegativeInteger(account.depositCredits);
  account.dayKey = typeof account.dayKey === 'string' ? account.dayKey : fallback.dayKey;
  account.dayOpeningDepositCredits = safeNonNegativeInteger(account.dayOpeningDepositCredits, account.depositCredits);
  account.dayMinimumDepositCredits = Math.min(
    safeNonNegativeInteger(account.dayMinimumDepositCredits, account.depositCredits),
    account.dayOpeningDepositCredits,
    account.depositCredits,
  );
  account.depositInterestCarryMicros = safeNonNegativeInteger(account.depositInterestCarryMicros);
  account.totalDepositInterestEarned = safeNonNegativeInteger(account.totalDepositInterestEarned);
  account.lastDepositInterestEarned = safeNonNegativeInteger(account.lastDepositInterestEarned);
  account.repaidLoanCount = safeNonNegativeInteger(account.repaidLoanCount);
  account.lastDefaultAt = Number.isFinite(Number(account.lastDefaultAt)) ? Math.max(0, Number(account.lastDefaultAt)) : null;
  account.activeLoan = normalizeLoan(account.activeLoan);
  account.recentTransactions = (Array.isArray(account.recentTransactions) ? account.recentTransactions : [])
    .filter((entry) => entry && typeof entry === 'object')
    .slice(-MAX_TRANSACTION_HISTORY);
  player.bankAccount = account;
  return account;
}

export function migrateBankWorld(world, now = Date.now()) {
  ensureBankWorld(world, now);
  world.version = Math.max(16, safeNonNegativeInteger(world.version));
  return world;
}

function recordTransaction(account, type, amount, createdAt, description, metadata = {}) {
  account.recentTransactions.push({
    id: `bank-transaction-${randomUUID()}`,
    type,
    amount: safeNonNegativeInteger(amount),
    createdAt: safeNonNegativeInteger(createdAt),
    description: String(description || ''),
    ...metadata,
  });
  account.recentTransactions = account.recentTransactions.slice(-MAX_TRANSACTION_HISTORY);
}

function groupFor(player, facilityTypeId) {
  return (player.facilityGroups || []).find((group) => String(group.facilityTypeId) === String(facilityTypeId));
}

function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) return auction.items;
  const assetKind = auction?.assetKind;
  const assetId = String(auction?.assetId || auction?.facilityTypeId || auction?.productId || '');
  return assetKind && assetId ? [{ assetKind, assetId, quantity: safeNonNegativeInteger(auction.quantity, 1) }] : [];
}

function auctionedFacilityQuantity(world, userId, facilityTypeId) {
  return (world.assetAuctions || []).reduce((sum, auction) => {
    if (
      Number(auction?.sellerId) !== Number(userId)
      || auction?.status !== 'open'
      || ['released', 'transferred'].includes(auction?.escrowStatus)
    ) return sum;
    return sum + auctionItems(auction).reduce((itemSum, item) => (
      item?.assetKind === 'facility' && String(item.assetId) === String(facilityTypeId)
        ? itemSum + safeNonNegativeInteger(item.quantity)
        : itemSum
    ), 0);
  }, 0);
}

export function mortgagedFacilityQuantity(player, facilityTypeId) {
  const loan = ensurePlayerBankAccount(player).activeLoan;
  if (!loan) return 0;
  return loan.collateral.reduce((sum, item) => (
    String(item.facilityTypeId) === String(facilityTypeId) ? sum + safeNonNegativeInteger(item.quantity) : sum
  ), 0);
}

export function activeLoanLiability(player) {
  const loan = ensurePlayerBankAccount(player).activeLoan;
  return loan ? addSafe(loan.principalOutstanding, loan.interestOutstanding) : 0;
}

export function transferableFacilityQuantity(world, player, facilityTypeId) {
  const group = groupFor(player, facilityTypeId);
  if (!group) return 0;
  const listed = facilitySellQuantityForOwner(world, player.userId, facilityTypeId);
  const auctioned = auctionedFacilityQuantity(world, player.userId, facilityTypeId);
  return Math.max(0, safeNonNegativeInteger(group.count) - listed - auctioned - mortgagedFacilityQuantity(player, facilityTypeId));
}

function prudentFacilityValue(world, facilityTypeId) {
  const facility = FACILITY_BY_ID.get(String(facilityTypeId));
  if (!facility) return 0;
  const lastTradePrice = Number(world.facilityMarkets?.[facility.id]?.lastTradePrice);
  const marketPrice = Number.isFinite(lastTradePrice) && lastTradePrice > 0
    ? Math.floor(lastTradePrice)
    : facility.systemValue;
  return Math.max(1, Math.min(safeNonNegativeInteger(facility.systemValue), safeNonNegativeInteger(marketPrice)));
}

function normalizeCollateralWithValues(world, player, collateral) {
  return normalizeCollateral(collateral).map((item) => ({
    ...item,
    availableQuantity: transferableFacilityQuantity(world, player, item.facilityTypeId),
    prudentUnitValue: prudentFacilityValue(world, item.facilityTypeId),
  }));
}

function loanRateBpsForRatio(actualLtvBps) {
  if (actualLtvBps <= 3_000) return 200;
  if (actualLtvBps <= 4_000) return 300;
  return 500;
}

export function calculateLoanAssessment(world, player, collateral, requestedAmount = undefined, now = Date.now()) {
  ensureBankWorld(world, now);
  const account = ensurePlayerBankAccount(player, now);
  const normalized = normalizeCollateralWithValues(world, player, collateral);
  const invalidCollateral = normalized.some((item) => item.quantity > item.availableQuantity);
  const collateralValue = normalized.reduce((sum, item) => addSafe(
    sum,
    multiplyFloor(item.quantity, item.prudentUnitValue, 1),
  ), 0);
  const depositBufferEligible = collateralValue > 0 && account.depositCredits * 10 >= collateralValue;
  const recentDefault = account.lastDefaultAt !== null && now - account.lastDefaultAt < DEFAULT_LOOKBACK_MS;
  const goodRepayment = account.repaidLoanCount > 0 && !recentDefault;
  const modifiers = {
    baseBps: 4_000,
    depositBufferBps: depositBufferEligible ? 500 : 0,
    repaymentHistoryBps: goodRepayment ? 500 : 0,
    recentDefaultBps: recentDefault ? -1_500 : 0,
  };
  const loanToValueBps = clamp(
    modifiers.baseBps + modifiers.depositBufferBps + modifiers.repaymentHistoryBps + modifiers.recentDefaultBps,
    2_500,
    5_000,
  );
  const maximumLoanCredits = multiplyFloor(collateralValue, loanToValueBps, 10_000);
  const amount = requestedAmount === undefined ? maximumLoanCredits : safePositiveInteger(requestedAmount, maximumLoanCredits || MAX_SAFE);
  const actualLtvBps = amount && collateralValue > 0
    ? Math.ceil(amount * 10_000 / collateralValue)
    : 0;
  const interestRateBps = loanRateBpsForRatio(actualLtvBps);
  const totalInterestCredits = amount ? multiplyCeil(amount, interestRateBps, 10_000) : 0;
  return {
    collateral: normalized,
    collateralValue,
    invalidCollateral,
    depositBufferEligible,
    goodRepayment,
    recentDefault,
    modifiers,
    loanToValueBps,
    maximumLoanCredits,
    requestedAmount: amount || 0,
    actualLtvBps,
    interestRateBps,
    totalInterestCredits,
    totalRepaymentCredits: amount ? addSafe(amount, totalInterestCredits) : 0,
    termMs: BANK_LOAN_TERM_MS,
    graceMs: BANK_LOAN_GRACE_MS,
  };
}

function completeLoan(account, loan, now) {
  account.repaidLoanCount += 1;
  recordTransaction(account, 'loan_repaid', loan.principalOriginal, now, '抵押贷款已全部结清', { loanId: loan.id });
  account.activeLoan = null;
}

function splitRealizedInterest(amount) {
  const total = safeNonNegativeInteger(amount);
  const shares = [
    { key: 'poolCredits', weight: BANK_INTEREST_POOL_SHARE_PERCENT, order: 0 },
    { key: 'employmentCredits', weight: BANK_EMPLOYMENT_SHARE_PERCENT, order: 1 },
    { key: 'reserveCredits', weight: BANK_RISK_RESERVE_SHARE_PERCENT, order: 2 },
  ].map((entry) => {
    const exactNumerator = total * entry.weight;
    return {
      ...entry,
      value: Math.floor(exactNumerator / 100),
      remainder: exactNumerator % 100,
    };
  });
  let assigned = shares.reduce((sum, entry) => sum + entry.value, 0);
  shares.sort((left, right) => right.remainder - left.remainder || left.order - right.order);
  for (let index = 0; assigned < total; index = (index + 1) % shares.length) {
    shares[index].value += 1;
    assigned += 1;
  }
  return Object.fromEntries(shares.map((entry) => [entry.key, entry.value]));
}

function allocatePaidInterest(world, player, amount, now, loanId) {
  const paid = safeNonNegativeInteger(amount);
  if (paid <= 0) return;
  const bank = ensureBankWorld(world, now);
  const account = ensurePlayerBankAccount(player, now);
  const { poolCredits, employmentCredits, reserveCredits } = splitRealizedInterest(paid);
  bank.interestPoolMicros = addSafe(
    bank.interestPoolMicros,
    multiplyFloor(poolCredits, BANK_INTEREST_MICROS_PER_CREDIT, 1),
    '银行存款利息池超出系统可表示范围',
  );
  if (employmentCredits > 0) creditPopulationEmployment(world, employmentCredits, 'banking');
  bank.riskReserveCredits = addSafe(bank.riskReserveCredits, reserveCredits);
  bank.totals.borrowerInterestReceived = addSafe(bank.totals.borrowerInterestReceived, paid);
  player.stats ||= {};
  player.stats.bankInterestPaid = addSafe(player.stats.bankInterestPaid, paid);
  bank.totals.interestTransferredToEmployment = addSafe(bank.totals.interestTransferredToEmployment, employmentCredits);
  bank.totals.interestTransferredToReserve = addSafe(bank.totals.interestTransferredToReserve, reserveCredits);
  recordTransaction(account, 'interest_paid', paid, now, '支付贷款利息', { loanId });
}

function applyRepayment(world, player, amount, now, { fromDeposit = false, automatic = false } = {}) {
  const account = ensurePlayerBankAccount(player, now);
  const loan = account.activeLoan;
  if (!loan) return { ok: false, message: '当前没有进行中的贷款', paid: 0 };
  const liability = addSafe(loan.principalOutstanding, loan.interestOutstanding);
  const requested = safePositiveInteger(amount, liability);
  if (!requested) return { ok: false, message: '还款金额无效', paid: 0 };
  const available = fromDeposit ? account.depositCredits : safeNonNegativeInteger(player.credits);
  const paid = Math.min(requested, liability, available);
  if (paid <= 0) return { ok: false, message: fromDeposit ? '银行存款不足' : '可用资金不足', paid: 0 };
  if (fromDeposit) {
    account.depositCredits -= paid;
    account.dayMinimumDepositCredits = Math.min(account.dayMinimumDepositCredits, account.depositCredits);
  } else {
    player.credits -= paid;
  }
  const interestPaid = Math.min(loan.interestOutstanding, paid);
  loan.interestOutstanding -= interestPaid;
  const principalPaid = paid - interestPaid;
  loan.principalOutstanding -= principalPaid;
  allocatePaidInterest(world, player, interestPaid, now, loan.id);
  const bank = ensureBankWorld(world, now);
  bank.totals.principalRepaid = addSafe(bank.totals.principalRepaid, principalPaid);
  player.stats ||= {};
  player.stats.bankPrincipalRepaid = addSafe(player.stats.bankPrincipalRepaid, principalPaid);
  recordTransaction(account, automatic ? 'automatic_repayment' : 'repayment', paid, now, automatic ? '自动偿还贷款' : '偿还贷款', {
    loanId: loan.id,
    principalPaid,
    interestPaid,
    source: fromDeposit ? 'deposit' : 'cash',
  });
  if (loan.principalOutstanding === 0 && loan.interestOutstanding === 0) completeLoan(account, loan, now);
  return { ok: true, paid, principalPaid, interestPaid, message: account.activeLoan ? `已还款 ${paid}` : '贷款已全部结清' };
}

function autoRepayLoan(world, player, now) {
  const account = ensurePlayerBankAccount(player, now);
  let loan = account.activeLoan;
  if (!loan || !loan.autoRepay) return 0;
  let totalPaid = 0;
  let liability = activeLoanLiability(player);
  if (liability > 0 && account.depositCredits > 0) {
    const result = applyRepayment(world, player, Math.min(liability, account.depositCredits), now, { fromDeposit: true, automatic: true });
    totalPaid += result.paid || 0;
  }
  loan = account.activeLoan;
  liability = activeLoanLiability(player);
  if (loan && liability > 0 && player.credits > 0) {
    const result = applyRepayment(world, player, Math.min(liability, player.credits), now, { automatic: true });
    totalPaid += result.paid || 0;
  }
  return totalPaid;
}

function reduceGroupForSeizure(group, quantity) {
  const removed = Math.min(safeNonNegativeInteger(group.count), safeNonNegativeInteger(quantity));
  group.count -= removed;
  let remaining = removed;
  const pendingReduction = Math.min(safeNonNegativeInteger(group.pendingJoinCount), remaining);
  group.pendingJoinCount -= pendingReduction;
  remaining -= pendingReduction;
  const participatingReduction = Math.min(safeNonNegativeInteger(group.participatingCount), remaining);
  group.participatingCount -= participatingReduction;
  if (group.count <= 0) return removed;
  if (group.status === 'running' && group.participatingCount < 1) {
    group.status = 'error';
    group.statusReason = 'no_available_facility';
    delete group.cycleStartedAt;
    delete group.cycleWageMultiplierBps;
  }
  return removed;
}

function settleDefault(world, player, now) {
  const account = ensurePlayerBankAccount(player, now);
  const loan = account.activeLoan;
  if (!loan) return false;
  let liability = activeLoanLiability(player);
  const collateral = loan.collateral.map((item) => ({
    ...item,
    disposalUnitValue: Math.max(1, multiplyFloor(prudentFacilityValue(world, item.facilityTypeId), 80, 100)),
  })).sort((left, right) => right.disposalUnitValue - left.disposalUnitValue || left.facilityTypeId.localeCompare(right.facilityTypeId));
  let proceeds = 0;
  let seizedCount = 0;
  const seized = [];
  for (const item of collateral) {
    if (liability <= proceeds) break;
    const needed = Math.max(1, Math.ceil((liability - proceeds) / item.disposalUnitValue));
    const quantity = Math.min(item.quantity, needed);
    const group = groupFor(player, item.facilityTypeId);
    if (!group || quantity <= 0) continue;
    const removed = reduceGroupForSeizure(group, quantity);
    if (removed <= 0) continue;
    const value = multiplyFloor(removed, item.disposalUnitValue, 1);
    proceeds = addSafe(proceeds, value);
    seizedCount += removed;
    seized.push({ facilityTypeId: item.facilityTypeId, quantity: removed, disposalUnitValue: item.disposalUnitValue });
    const bank = ensureBankWorld(world, now);
    bank.facilityReserves[item.facilityTypeId] = addSafe(bank.facilityReserves[item.facilityTypeId], removed);
  }
  player.facilityGroups = (player.facilityGroups || []).filter((group) => safeNonNegativeInteger(group.count) > 0);
  const applied = Math.min(proceeds, liability);
  const interestPaid = Math.min(loan.interestOutstanding, applied);
  loan.interestOutstanding -= interestPaid;
  const principalPaid = applied - interestPaid;
  loan.principalOutstanding -= principalPaid;
  allocatePaidInterest(world, player, interestPaid, now, loan.id);
  const bank = ensureBankWorld(world, now);
  bank.totals.principalRepaid = addSafe(bank.totals.principalRepaid, principalPaid);
  player.stats.bankPrincipalRepaid = addSafe(player.stats.bankPrincipalRepaid, principalPaid);
  bank.totals.defaults = addSafe(bank.totals.defaults, 1);
  player.stats ||= {};
  player.stats.bankDefaults = addSafe(player.stats.bankDefaults, 1);
  player.stats.bankFacilitiesSeized = addSafe(player.stats.bankFacilitiesSeized, seizedCount);
  bank.totals.facilitiesSeized = addSafe(bank.totals.facilitiesSeized, seizedCount);
  const surplus = Math.max(0, proceeds - liability);
  if (surplus > 0) account.depositCredits = addSafe(account.depositCredits, surplus);
  const shortfall = activeLoanLiability(player);
  if (shortfall > 0) {
    const absorbed = Math.min(bank.riskReserveCredits, shortfall);
    bank.riskReserveCredits -= absorbed;
  }
  account.lastDefaultAt = now;
  recordTransaction(account, 'default', liability, now, '贷款逾期，银行处置抵押工厂', {
    loanId: loan.id,
    seized,
    proceeds,
    surplus,
    writtenOff: shortfall,
  });
  account.activeLoan = null;
  return true;
}

function processLoanDeadlines(world, timestamp) {
  for (const player of Object.values(world.players || {})) {
    const account = ensurePlayerBankAccount(player, timestamp);
    const loan = account.activeLoan;
    if (!loan) continue;
    if (loan.status === 'active' && timestamp >= loan.dueAt) {
      autoRepayLoan(world, player, timestamp);
      if (!account.activeLoan) continue;
      account.activeLoan.status = 'grace';
      account.activeLoan.graceEndsAt = Math.max(account.activeLoan.graceEndsAt, account.activeLoan.dueAt + BANK_LOAN_GRACE_MS);
      recordTransaction(account, 'grace_started', activeLoanLiability(player), timestamp, '贷款到期，已进入宽限期', { loanId: loan.id });
    }
    if (account.activeLoan?.status === 'grace' && timestamp >= account.activeLoan.graceEndsAt) {
      autoRepayLoan(world, player, timestamp);
      if (account.activeLoan) settleDefault(world, player, timestamp);
    }
  }
}

function totalEligibleDeposits(world) {
  return Object.values(world.players || {}).reduce((sum, player) => {
    const account = ensurePlayerBankAccount(player);
    return addSafe(sum, Math.min(account.dayOpeningDepositCredits, account.dayMinimumDepositCredits));
  }, 0);
}

function settleDepositInterest(world, settlementAt) {
  const bank = ensureBankWorld(world, settlementAt);
  const totalEligible = totalEligibleDeposits(world);
  const capMicros = multiplyFloor(totalEligible, BANK_DAILY_INTEREST_CAP_BPS * 100, 1);
  const distributableMicros = Math.min(bank.interestPoolMicros, capMicros);
  let distributedMicros = 0;
  let paidCredits = 0;
  for (const player of Object.values(world.players || {})) {
    const account = ensurePlayerBankAccount(player, settlementAt);
    const eligible = Math.min(account.dayOpeningDepositCredits, account.dayMinimumDepositCredits);
    const shareMicros = totalEligible > 0 && distributableMicros > 0
      ? Number(BigInt(distributableMicros) * BigInt(eligible) / BigInt(totalEligible))
      : 0;
    distributedMicros = addSafe(distributedMicros, shareMicros);
    const carry = addSafe(account.depositInterestCarryMicros, shareMicros);
    const wholeCredits = Math.floor(carry / BANK_INTEREST_MICROS_PER_CREDIT);
    account.depositInterestCarryMicros = carry % BANK_INTEREST_MICROS_PER_CREDIT;
    account.lastDepositInterestEarned = wholeCredits;
    if (wholeCredits > 0) {
      account.depositCredits = addSafe(account.depositCredits, wholeCredits);
      account.totalDepositInterestEarned = addSafe(account.totalDepositInterestEarned, wholeCredits);
      player.stats ||= {};
      player.stats.bankDepositInterestEarned = addSafe(player.stats.bankDepositInterestEarned, wholeCredits);
      paidCredits = addSafe(paidCredits, wholeCredits);
      recordTransaction(account, 'deposit_interest', wholeCredits, settlementAt, '银行存款每日结息');
    }
  }
  bank.interestPoolMicros -= distributedMicros;
  const ratePpm = totalEligible > 0 ? Math.floor(distributableMicros / totalEligible) : 0;
  bank.lastDailyInterestCredits = paidCredits;
  bank.lastDailyRatePpm = ratePpm;
  bank.recentDailyRatesPpm.push(ratePpm);
  bank.recentDailyRatesPpm = bank.recentDailyRatesPpm.slice(-7);
  bank.totals.depositorInterestPaid = addSafe(bank.totals.depositorInterestPaid, paidCredits);

  const depositsAfter = Object.values(world.players || {}).reduce((sum, player) => (
    addSafe(sum, ensurePlayerBankAccount(player, settlementAt).depositCredits)
  ), 0);
  const poolCapMicros = multiplyFloor(
    depositsAfter,
    BANK_DAILY_INTEREST_CAP_BPS * 100 * BANK_INTEREST_POOL_RETENTION_DAYS,
    1,
  );
  if (bank.interestPoolMicros > poolCapMicros) {
    const excessMicros = bank.interestPoolMicros - poolCapMicros;
    const reserveCredits = Math.floor(excessMicros / BANK_INTEREST_MICROS_PER_CREDIT);
    if (reserveCredits > 0) {
      bank.interestPoolMicros -= reserveCredits * BANK_INTEREST_MICROS_PER_CREDIT;
      bank.riskReserveCredits = addSafe(bank.riskReserveCredits, reserveCredits);
      bank.totals.interestTransferredToReserve = addSafe(bank.totals.interestTransferredToReserve, reserveCredits);
    }
  }
  const nextPeriod = bankPeriodFor(settlementAt + 1);
  bank.currentDayKey = nextPeriod.dayKey;
  bank.nextInterestSettlementAt = nextPeriod.nextSettlementAt;
  for (const player of Object.values(world.players || {})) {
    const account = ensurePlayerBankAccount(player, settlementAt);
    account.dayKey = nextPeriod.dayKey;
    account.dayOpeningDepositCredits = account.depositCredits;
    account.dayMinimumDepositCredits = account.depositCredits;
  }
}

function earliestLoanDeadline(world) {
  let deadline = null;
  for (const player of Object.values(world.players || {})) {
    const loan = player?.bankAccount?.activeLoan;
    if (!loan || typeof loan !== 'object') continue;
    const candidate = loan.status === 'grace' ? Number(loan.graceEndsAt) : Number(loan.dueAt);
    if (Number.isFinite(candidate) && candidate >= 0) deadline = deadline === null ? candidate : Math.min(deadline, candidate);
  }
  return deadline;
}

export function nextBankDeadlineAt(world, now = Date.now()) {
  const fallbackSettlement = bankPeriodFor(now).nextSettlementAt;
  const bankSettlement = Number(world?.bank?.nextInterestSettlementAt);
  const interestDeadline = Number.isFinite(bankSettlement) && bankSettlement >= 0 ? bankSettlement : fallbackSettlement;
  const loanDeadline = earliestLoanDeadline(world);
  return loanDeadline === null ? interestDeadline : Math.min(interestDeadline, loanDeadline);
}

export function processBankWorld(world, now = Date.now()) {
  const bank = ensureBankWorld(world, now);
  let changed = false;
  let iterations = 0;
  while (iterations < 4_000) {
    const loanDeadline = earliestLoanDeadline(world);
    const nextAt = loanDeadline === null
      ? bank.nextInterestSettlementAt
      : Math.min(bank.nextInterestSettlementAt, loanDeadline);
    if (!Number.isFinite(nextAt) || nextAt > now) break;
    processLoanDeadlines(world, nextAt);
    if (bank.nextInterestSettlementAt <= nextAt) settleDepositInterest(world, bank.nextInterestSettlementAt);
    changed = true;
    iterations += 1;
  }
  if (iterations >= 4_000) throw new Error('银行截止时间处理超过安全上限');
  return changed;
}

function applyDeposit(world, player, payload, now) {
  const amount = safePositiveInteger(payload.amount, safeNonNegativeInteger(player.credits));
  if (!amount) return { ok: false, message: '存款金额无效或可用资金不足' };
  const account = ensurePlayerBankAccount(player, now);
  player.credits -= amount;
  account.depositCredits = addSafe(account.depositCredits, amount);
  recordTransaction(account, 'deposit', amount, now, '存入银行');
  return { ok: true, message: `已存入 ${amount}` };
}

function applyWithdrawal(world, player, payload, now) {
  const account = ensurePlayerBankAccount(player, now);
  if (account.activeLoan?.status === 'grace') return { ok: false, message: '贷款处于宽限期，暂时不能取款' };
  const amount = safePositiveInteger(payload.amount, account.depositCredits);
  if (!amount) return { ok: false, message: '取款金额无效或银行存款不足' };
  account.depositCredits -= amount;
  account.dayMinimumDepositCredits = Math.min(account.dayMinimumDepositCredits, account.depositCredits);
  player.credits = addSafe(player.credits, amount);
  recordTransaction(account, 'withdrawal', amount, now, '从银行取出资金');
  return { ok: true, message: `已取出 ${amount}` };
}

function applyBorrow(world, player, payload, now) {
  const account = ensurePlayerBankAccount(player, now);
  if (account.activeLoan) return { ok: false, message: '每名玩家同时只能有一笔进行中的贷款' };
  const amount = safePositiveInteger(payload.amount);
  const assessment = calculateLoanAssessment(world, player, payload.collateral, amount, now);
  if (!amount || assessment.collateral.length === 0) return { ok: false, message: '贷款金额或抵押工厂无效' };
  if (assessment.invalidCollateral) return { ok: false, message: '可抵押工厂数量不足' };
  if (amount > assessment.maximumLoanCredits) return { ok: false, message: '申请金额超过当前贷款额度' };
  const loan = {
    id: `bank-loan-${randomUUID()}`,
    status: 'active',
    borrowedAt: now,
    dueAt: now + BANK_LOAN_TERM_MS,
    graceEndsAt: now + BANK_LOAN_TERM_MS + BANK_LOAN_GRACE_MS,
    principalOriginal: amount,
    principalOutstanding: amount,
    interestOriginal: assessment.totalInterestCredits,
    interestOutstanding: assessment.totalInterestCredits,
    interestRateBps: assessment.interestRateBps,
    collateral: assessment.collateral.map(({ facilityTypeId, quantity, prudentUnitValue }) => ({
      facilityTypeId,
      quantity,
      prudentUnitValue,
    })),
    collateralValueAtOrigination: assessment.collateralValue,
    ltvBps: assessment.actualLtvBps,
    autoRepay: payload.autoRepay !== false,
  };
  account.activeLoan = loan;
  player.credits = addSafe(player.credits, amount);
  const bank = ensureBankWorld(world, now);
  bank.totals.creditIssued = addSafe(bank.totals.creditIssued, amount);
  player.stats ||= {};
  player.stats.bankCreditIssued = addSafe(player.stats.bankCreditIssued, amount);
  recordTransaction(account, 'loan_disbursed', amount, now, '银行发放工厂抵押贷款', { loanId: loan.id });
  return { ok: true, message: `贷款已发放，到期应还 ${amount + assessment.totalInterestCredits}` };
}

function applyRepayAction(world, player, payload, now) {
  const activeLoan = ensurePlayerBankAccount(player, now).activeLoan;
  if (!activeLoan || (payload.loanId && String(payload.loanId) !== activeLoan.id)) return { ok: false, message: '贷款记录不存在' };
  const liability = activeLoanLiability(player);
  const amount = payload.amount === 'all' ? liability : safePositiveInteger(payload.amount, liability);
  if (!amount) return { ok: false, message: '还款金额无效' };
  return applyRepayment(world, player, amount, now);
}

function applyAutoRepaySetting(player, payload, now) {
  const account = ensurePlayerBankAccount(player, now);
  if (!account.activeLoan || (payload.loanId && String(payload.loanId) !== account.activeLoan.id)) return { ok: false, message: '贷款记录不存在' };
  account.activeLoan.autoRepay = payload.enabled === true;
  recordTransaction(account, 'auto_repay_updated', 0, now, account.activeLoan.autoRepay ? '已开启自动还款' : '已关闭自动还款', { loanId: account.activeLoan.id });
  return { ok: true, message: account.activeLoan.autoRepay ? '已开启自动还款' : '已关闭自动还款' };
}

export function applyBankAction(world, user, action, payload = {}, now = Date.now()) {
  migrateBankWorld(world, now);
  processBankWorld(world, now);
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家不存在' };
  if (action === 'bankDeposit') return applyDeposit(world, player, payload, now);
  if (action === 'bankWithdraw') return applyWithdrawal(world, player, payload, now);
  if (action === 'bankBorrow') return applyBorrow(world, player, payload, now);
  if (action === 'bankRepay') return applyRepayAction(world, player, payload, now);
  if (action === 'bankSetAutoRepay') return applyAutoRepaySetting(player, payload, now);
  return { ok: false, message: '银行操作不存在' };
}

export function createBankClientState(world, player, now = Date.now()) {
  const bank = ensureBankWorld(world, now);
  const account = ensurePlayerBankAccount(player, now);
  const eligibleDepositCredits = Math.min(account.dayOpeningDepositCredits, account.dayMinimumDepositCredits);
  const availableCollateral = FACILITY_TYPE_CATALOG.map((facility) => ({
    facilityTypeId: facility.id,
    totalQuantity: safeNonNegativeInteger(groupFor(player, facility.id)?.count),
    mortgagedQuantity: mortgagedFacilityQuantity(player, facility.id),
    availableQuantity: transferableFacilityQuantity(world, player, facility.id),
    prudentUnitValue: prudentFacilityValue(world, facility.id),
  })).filter((item) => item.totalQuantity > 0);
  const sevenDayAverageRatePpm = bank.recentDailyRatesPpm.length > 0
    ? Math.floor(bank.recentDailyRatesPpm.reduce((sum, rate) => sum + rate, 0) / bank.recentDailyRatesPpm.length)
    : 0;
  return {
    bankAccount: {
      depositCredits: account.depositCredits,
      eligibleDepositCredits,
      depositInterestCarryMicros: account.depositInterestCarryMicros,
      totalDepositInterestEarned: account.totalDepositInterestEarned,
      lastDepositInterestEarned: account.lastDepositInterestEarned,
      repaidLoanCount: account.repaidLoanCount,
      recentDefaultAt: account.lastDefaultAt,
      activeLoan: account.activeLoan ? structuredClone(account.activeLoan) : null,
      recentTransactions: structuredClone(account.recentTransactions.slice(-50).reverse()),
      availableCollateral,
    },
    bankSummary: {
      nextInterestSettlementAt: bank.nextInterestSettlementAt,
      lastDailyInterestCredits: bank.lastDailyInterestCredits,
      lastDailyRatePpm: bank.lastDailyRatePpm,
      sevenDayAverageRatePpm,
      dailyInterestCapBps: BANK_DAILY_INTEREST_CAP_BPS,
      interestPoolCredits: Math.floor(bank.interestPoolMicros / BANK_INTEREST_MICROS_PER_CREDIT),
      loanTermMs: BANK_LOAN_TERM_MS,
      loanGraceMs: BANK_LOAN_GRACE_MS,
      baseLoanToValueBps: 4_000,
      depositBufferBonusBps: 500,
      repaymentHistoryBonusBps: 500,
      recentDefaultPenaltyBps: 1_500,
      minimumLoanToValueBps: 2_500,
      maximumLoanToValueBps: 5_000,
    },
  };
}
