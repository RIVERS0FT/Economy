import { cashFinancialAssets } from './cash-financial-assets.js';
import { collectPlayerCommodityInvestments } from './commodity-investment-runtime.js';
import { randomUUID } from 'node:crypto';
import * as legacy from './banking-legacy.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './domain.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';
import { creditPopulationEmployment } from './population-economy.js';
import { playerLoanFinancialPosition } from './contract-asset-locks.js';
import { weeklySettlementLiability } from './weekly-cash-settlement.js';
import { normalizeProvinceId, provinceScopedKey, splitProvinceScopedKey } from './provinces.js';
import {
  calculateRateMoney,
  floorInternalMoney,
  internalMoneyToMicros,
  microsToInternalMoney,
  normalizePlayerMoneyInput,
  roundInternalMoney,
} from './money.js';

export * from './banking-legacy.js';

export const BANKING_VERSION = 4;
export const BANK_LOAN_TERM_OPTIONS_HOURS = Object.freeze([24, 72, 168]);
export const BANK_LOAN_GRACE_MS = 12 * 60 * 60 * 1000;
export const BANK_COLLECTION_RETRY_MS = 6 * 60 * 60 * 1000;
export const BANK_BASE_CREDIT_RATIO_BPS = 3_000;
export const BANK_REPAYMENT_HISTORY_BONUS_BPS = 500;
export const BANK_RECENT_DEFAULT_PENALTY_BPS = 1_500;
export const BANK_MINIMUM_CREDIT_RATIO_BPS = 1_500;
export const BANK_MAXIMUM_CREDIT_RATIO_BPS = 3_500;

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DEFAULT_MS = 30 * DAY_MS;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const TERM_BASE_RATE_BPS = new Map([
  [24, 200],
  [72, 400],
  [168, 900],
]);
const TERM_CARRIER_PROVINCE_ID = '__bank_credit_term__';
const FACILITY_BY_ID = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const COMMERCIAL_BY_ID = new Map(COMMERCIAL_BUILDING_TYPE_CATALOG.map((building) => [building.id, building]));

function safeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function safeMoney(value, fallback = 0) {
  const normalized = roundInternalMoney(value);
  return normalized !== null && normalized >= 0 ? normalized : fallback;
}

function safePositiveMoney(value, max = MAX_SAFE) {
  return normalizePlayerMoneyInput(value, { min: 0.01, max });
}

function addSafe(left, right, message = '银行金额超出系统可表示范围') {
  const total = roundInternalMoney(Number(left || 0) + Number(right || 0));
  if (total === null || internalMoneyToMicros(total) === null) throw new Error(message);
  return total;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function floorCents(value) {
  const normalized = floorInternalMoney(value);
  if (normalized === null) return 0;
  return Math.max(0, Math.floor((normalized + Number.EPSILON) * 100) / 100);
}

function ceilCents(value) {
  const normalized = safeMoney(value);
  return Math.max(0, Math.ceil((normalized - Number.EPSILON) * 100) / 100);
}

function addInterestPoolMicros(bank, amount) {
  const micros = internalMoneyToMicros(amount);
  if (micros === null) throw new Error('银行存款利息池超出系统可表示范围');
  const next = BigInt(safeInteger(bank.interestPoolMicros)) + micros;
  if (next > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('银行存款利息池超出系统可表示范围');
  bank.interestPoolMicros = Number(next);
}

function normalizeCreditLoan(loan) {
  if (!loan || typeof loan !== 'object') return null;
  const principalOutstanding = safeMoney(loan.principalOutstanding ?? loan.principalOriginal);
  const interestOutstanding = safeMoney(loan.interestOutstanding ?? loan.interestOriginal);
  if (principalOutstanding + interestOutstanding <= 0) return null;
  const termMs = safeInteger(loan.termMs, Math.max(0, safeInteger(loan.dueAt) - safeInteger(loan.borrowedAt)));
  const borrowedAt = safeInteger(loan.borrowedAt);
  const dueAt = safeInteger(loan.dueAt, borrowedAt + termMs);
  return {
    id: String(loan.id || `bank-credit-loan-${randomUUID()}`),
    status: loan.status === 'grace' ? 'grace' : 'active',
    borrowedAt,
    dueAt,
    graceEndsAt: safeInteger(loan.graceEndsAt, dueAt + BANK_LOAN_GRACE_MS),
    termMs,
    principalOriginal: safeMoney(loan.principalOriginal, principalOutstanding),
    principalOutstanding,
    interestOriginal: safeMoney(loan.interestOriginal, interestOutstanding),
    interestOutstanding,
    interestRateBps: safeInteger(loan.interestRateBps),
    assetValueAtOrigination: safeMoney(loan.assetValueAtOrigination),
    creditLimitAtOrigination: safeMoney(loan.creditLimitAtOrigination),
    creditUtilizationBps: safeInteger(loan.creditUtilizationBps),
    autoRepay: loan.autoRepay !== false,
    defaultedAt: Number.isFinite(Number(loan.defaultedAt)) ? Math.max(0, Number(loan.defaultedAt)) : null,
  };
}

export function ensurePlayerBankAccount(player, now = Date.now()) {
  const account = legacy.ensurePlayerBankAccount(player, now);
  account.version = BANKING_VERSION;
  account.creditLoan = normalizeCreditLoan(account.creditLoan);
  return account;
}

export function ensureBankWorld(world, now = Date.now(), { normalizePlayers = true } = {}) {
  const bank = legacy.ensureBankWorld(world, now, { normalizePlayers: false });
  bank.version = BANKING_VERSION;
  if (normalizePlayers) {
    for (const player of Object.values(world.players || {})) ensurePlayerBankAccount(player, now);
  }
  return bank;
}

export function migrateBankWorld(world, now = Date.now()) {
  legacy.migrateBankWorld(world, now);
  ensureBankWorld(world, now);
  return world;
}

function creditLoanLiability(player) {
  const loan = player?.bankAccount?.creditLoan;
  return loan ? addSafe(loan.principalOutstanding, loan.interestOutstanding) : 0;
}

export function activeLoanLiability(player) {
  return addSafe(legacy.activeLoanLiability(player), creditLoanLiability(player));
}

export function mortgagedFacilityQuantity(player, facilityTypeId, provinceId) {
  return legacy.mortgagedFacilityQuantity(player, facilityTypeId, provinceId);
}

export function transferableFacilityQuantity(world, player, facilityTypeId, provinceId) {
  return legacy.transferableFacilityQuantity(world, player, facilityTypeId, provinceId);
}

function commodityUnitValue(world, productId, provinceId) {
  const market = world.markets?.[provinceScopedKey(provinceId, productId)];
  const official = safeMoney(market?.officialPrice);
  if (official > 0) return official;
  const lastTrade = safeMoney(market?.lastTradePrice);
  if (lastTrade > 0) return lastTrade;
  return safeMoney(PRODUCT_BY_ID.get(productId)?.basePrice);
}

function facilityUnitValue(world, facilityTypeId, provinceId) {
  const facility = FACILITY_BY_ID.get(facilityTypeId);
  if (!facility) return 0;
  const systemValue = safeMoney(facility.systemValue);
  const lastTrade = safeMoney(world.facilityMarkets?.[provinceScopedKey(provinceId, facilityTypeId)]?.lastTradePrice);
  return lastTrade > 0 ? lastTrade : systemValue;
}

function prudentFacilityUnitValue(world, facilityTypeId, provinceId) {
  const facility = FACILITY_BY_ID.get(facilityTypeId);
  if (!facility) return 0;
  const systemValue = safeMoney(facility.systemValue);
  const marketValue = facilityUnitValue(world, facilityTypeId, provinceId);
  return Math.max(0, Math.min(systemValue || marketValue, marketValue || systemValue));
}

export function bankCreditAssetValue(world, player, now = world.lastProcessedAt) {
  const financialPosition = playerLoanFinancialPosition(world, player.userId);
  const cash = safeMoney(player.credits)
    + safeMoney(player.frozenCredits)
    + safeMoney(player?.bankAccount?.depositCredits)
    + safeMoney(financialPosition.receivable);
  const commodity = Object.entries(player.inventories || {}).reduce((sum, [rawKey, inventory]) => {
    const { provinceId, assetId } = splitProvinceScopedKey(rawKey);
    const quantity = Math.max(0,
      Number(inventory?.available || 0)
      + Number(inventory?.frozen || 0)
      + Number(inventory?.inTransit || 0));
    return sum + quantity * commodityUnitValue(world, assetId, provinceId);
  }, 0);
  const facilities = (player.facilityGroups || []).reduce((sum, group) => (
    sum + Math.max(0, Number(group?.count || 0))
      * facilityUnitValue(world, String(group?.facilityTypeId || ''), normalizeProvinceId(group?.provinceId))
  ), 0);
  const commercial = (player.commercialBuildingGroups || []).reduce((sum, group) => {
    const type = COMMERCIAL_BY_ID.get(String(group?.commercialTypeId || ''));
    return sum + Math.max(0, Number(group?.count || 0)) * safeMoney(type?.systemValue);
  }, 0);
  const grossAssets = safeMoney(cash + commodity + facilities + commercial
    + cashFinancialAssets(world, player, now).investmentCreditValue);
  const liabilities = safeMoney(
    activeLoanLiability(player)
    + weeklySettlementLiability(player)
    + safeMoney(financialPosition.liability),
  );
  return floorCents(Math.max(0, grossAssets - liabilities));
}

function recentDefault(account, now) {
  return account.lastDefaultAt !== null
    && Number.isFinite(Number(account.lastDefaultAt))
    && now - Number(account.lastDefaultAt) < RECENT_DEFAULT_MS;
}

function creditRatioFor(account, now) {
  const defaultedRecently = recentDefault(account, now);
  const goodRepayment = safeInteger(account.repaidLoanCount) > 0 && !defaultedRecently;
  return {
    goodRepayment,
    recentDefault: defaultedRecently,
    ratioBps: clamp(
      BANK_BASE_CREDIT_RATIO_BPS
        + (goodRepayment ? BANK_REPAYMENT_HISTORY_BONUS_BPS : 0)
        - (defaultedRecently ? BANK_RECENT_DEFAULT_PENALTY_BPS : 0),
      BANK_MINIMUM_CREDIT_RATIO_BPS,
      BANK_MAXIMUM_CREDIT_RATIO_BPS,
    ),
  };
}

function utilizationSurchargeBps(utilizationBps) {
  if (utilizationBps <= 5_000) return 0;
  if (utilizationBps <= 8_000) return 100;
  return 200;
}

function normalizeTermHours(value) {
  const hours = Math.floor(Number(value));
  return BANK_LOAN_TERM_OPTIONS_HOURS.includes(hours) ? hours : null;
}

function termHoursFromPayload(payload) {
  const direct = normalizeTermHours(payload?.termHours);
  if (direct) return direct;
  for (const item of Array.isArray(payload?.collateral) ? payload.collateral : []) {
    if (String(item?.provinceId || '') !== TERM_CARRIER_PROVINCE_ID) continue;
    const match = /^bank-credit-term-(24|72|168)$/.exec(String(item?.facilityTypeId || ''));
    const carried = normalizeTermHours(match?.[1]);
    if (carried) return carried;
  }
  return null;
}

export function calculateAssetCreditAssessment(world, player, requestedAmount = undefined, termHours = 72, now = Date.now()) {
  ensureBankWorld(world, now);
  const account = ensurePlayerBankAccount(player, now);
  const selectedTermHours = normalizeTermHours(termHours);
  const assetValue = bankCreditAssetValue(world, player, now);
  const credit = creditRatioFor(account, now);
  const maximumLoanCredits = floorCents(assetValue * credit.ratioBps / 10_000);
  const requested = requestedAmount === undefined
    ? maximumLoanCredits
    : safePositiveMoney(requestedAmount, Math.max(0.01, maximumLoanCredits));
  const amount = requested && requested <= maximumLoanCredits ? requested : 0;
  const creditUtilizationBps = amount > 0 && maximumLoanCredits > 0
    ? Math.min(10_000, Math.ceil(amount * 10_000 / maximumLoanCredits))
    : 0;
  const surchargeBps = utilizationSurchargeBps(creditUtilizationBps);
  const baseInterestRateBps = selectedTermHours ? TERM_BASE_RATE_BPS.get(selectedTermHours) : 0;
  const interestRateBps = selectedTermHours ? baseInterestRateBps + surchargeBps : 0;
  const totalInterestCredits = amount > 0 ? ceilCents(amount * interestRateBps / 10_000) : 0;
  return {
    assetValue,
    goodRepayment: credit.goodRepayment,
    recentDefault: credit.recentDefault,
    creditRatioBps: credit.ratioBps,
    maximumLoanCredits,
    requestedAmount: amount,
    creditUtilizationBps,
    termHours: selectedTermHours,
    termMs: selectedTermHours ? selectedTermHours * 60 * 60 * 1000 : 0,
    baseInterestRateBps,
    utilizationSurchargeBps: surchargeBps,
    interestRateBps,
    totalInterestCredits,
    totalRepaymentCredits: amount > 0 ? addSafe(amount, totalInterestCredits) : 0,
    graceMs: BANK_LOAN_GRACE_MS,
  };
}

function recordTransaction(account, type, amount, createdAt, description, metadata = {}) {
  account.recentTransactions ||= [];
  account.recentTransactions.push({
    id: `bank-transaction-${randomUUID()}`,
    type,
    amount: Math.max(0, safeMoney(amount)),
    createdAt: safeInteger(createdAt),
    description: String(description || ''),
    ...metadata,
  });
  account.recentTransactions = account.recentTransactions.slice(-100);
}

function allocateCreditLoanInterest(world, player, amount, now, loanId) {
  const paid = safeMoney(amount);
  if (paid <= 0) return;
  const bank = ensureBankWorld(world, now, { normalizePlayers: false });
  const account = ensurePlayerBankAccount(player, now);
  const poolCredits = calculateRateMoney(paid, legacy.BANK_INTEREST_POOL_SHARE_PERCENT, 100, 'half-up') || 0;
  const employmentCredits = calculateRateMoney(paid, legacy.BANK_EMPLOYMENT_SHARE_PERCENT, 100, 'half-up') || 0;
  const reserveCredits = safeMoney(paid - poolCredits - employmentCredits);
  addInterestPoolMicros(bank, poolCredits);
  if (employmentCredits > 0) creditPopulationEmployment(world, employmentCredits, 'banking');
  bank.riskReserveCredits = addSafe(bank.riskReserveCredits, reserveCredits);
  bank.totals.borrowerInterestReceived = addSafe(bank.totals.borrowerInterestReceived, paid);
  bank.totals.interestTransferredToEmployment = addSafe(bank.totals.interestTransferredToEmployment, employmentCredits);
  bank.totals.interestTransferredToReserve = addSafe(bank.totals.interestTransferredToReserve, reserveCredits);
  player.stats ||= {};
  player.stats.bankInterestPaid = addSafe(player.stats.bankInterestPaid, paid);
  recordTransaction(account, 'interest_paid', paid, now, '支付贷款利息', { loanId });
}

function finishCreditLoan(account, loan, now, { collected = false } = {}) {
  if (!collected) account.repaidLoanCount = safeInteger(account.repaidLoanCount) + 1;
  recordTransaction(
    account,
    collected ? 'loan_collected' : 'loan_repaid',
    loan.principalOriginal,
    now,
    collected ? '资产授信贷款已完成追偿' : '资产授信贷款已全部结清',
    { loanId: loan.id },
  );
  account.creditLoan = null;
}

function applyCreditLoanPayment(world, player, amount, now, metadata = {}) {
  const account = ensurePlayerBankAccount(player, now);
  const loan = account.creditLoan;
  if (!loan) return { ok: false, message: '当前没有进行中的贷款', paid: 0 };
  const liability = creditLoanLiability(player);
  const requested = safePositiveMoney(amount, Math.max(0.01, liability));
  if (!requested || requested > liability) return { ok: false, message: '还款金额无效', paid: 0 };
  const paid = floorCents(Math.min(requested, liability));
  if (paid <= 0) return { ok: false, message: '还款金额无效', paid: 0 };
  const interestPaid = Math.min(loan.interestOutstanding, paid);
  loan.interestOutstanding = safeMoney(loan.interestOutstanding - interestPaid);
  const principalPaid = safeMoney(paid - interestPaid);
  loan.principalOutstanding = safeMoney(loan.principalOutstanding - principalPaid);
  allocateCreditLoanInterest(world, player, interestPaid, now, loan.id);
  const bank = ensureBankWorld(world, now, { normalizePlayers: false });
  bank.totals.principalRepaid = addSafe(bank.totals.principalRepaid, principalPaid);
  player.stats ||= {};
  player.stats.bankPrincipalRepaid = addSafe(player.stats.bankPrincipalRepaid, principalPaid);
  recordTransaction(
    account,
    metadata.automatic ? 'automatic_repayment' : metadata.collection ? 'collection_repayment' : 'repayment',
    paid,
    now,
    metadata.collection ? '银行追偿贷款' : metadata.automatic ? '自动偿还贷款' : '偿还贷款',
    { loanId: loan.id, principalPaid, interestPaid, source: metadata.source || 'cash' },
  );
  if (loan.principalOutstanding === 0 && loan.interestOutstanding === 0) {
    finishCreditLoan(account, loan, now, { collected: Boolean(loan.defaultedAt) });
  }
  return { ok: true, paid, principalPaid, interestPaid, message: account.creditLoan ? `已还款 ${paid}` : '贷款已全部结清' };
}

function repayCreditLoanFromBalance(world, player, source, now, { automatic = false, collection = false } = {}) {
  const account = ensurePlayerBankAccount(player, now);
  const liability = creditLoanLiability(player);
  if (liability <= 0) return 0;
  const available = source === 'deposit' ? safeMoney(account.depositCredits) : safeMoney(player.credits);
  const amount = floorCents(Math.min(liability, available));
  if (amount <= 0) return 0;
  if (source === 'deposit') {
    account.depositCredits = safeMoney(account.depositCredits - amount);
    account.dayMinimumDepositCredits = Math.min(account.dayMinimumDepositCredits, account.depositCredits);
  } else {
    player.credits = safeMoney(player.credits - amount);
  }
  const result = applyCreditLoanPayment(world, player, amount, now, { source, automatic, collection });
  return result.paid || 0;
}

function autoRepayCreditLoan(world, player, now) {
  const loan = ensurePlayerBankAccount(player, now).creditLoan;
  if (!loan || !loan.autoRepay) return 0;
  let paid = repayCreditLoanFromBalance(world, player, 'deposit', now, { automatic: true });
  if (ensurePlayerBankAccount(player, now).creditLoan) {
    paid += repayCreditLoanFromBalance(world, player, 'cash', now, { automatic: true });
  }
  return paid;
}

function reduceFacilityGroup(group, quantity) {
  const removed = Math.min(safeInteger(group?.count), safeInteger(quantity));
  if (removed <= 0) return 0;
  group.count -= removed;
  group.participatingCount = Math.max(0, safeInteger(group.participatingCount) - removed);
  if (group.count <= 0 || (group.status === 'running' && group.participatingCount < 1)) {
    group.status = 'error';
    group.statusReason = 'no_available_facility';
    delete group.cycleStartedAt;
    delete group.cycleWageMultiplierBps;
  }
  return removed;
}

function reduceCommercialGroup(group, quantity) {
  const removed = Math.min(safeInteger(group?.count), safeInteger(quantity));
  if (removed <= 0) return 0;
  group.count -= removed;
  if ('participatingCount' in group) group.participatingCount = Math.max(0, safeInteger(group.participatingCount) - removed);
  if (group.count <= 0 || (group.status === 'running' && safeInteger(group.participatingCount) < 1)) {
    group.status = 'error';
    group.statusReason = 'no_available_building';
    delete group.cycleStartedAt;
  }
  return removed;
}

function applyLiquidationValue(world, player, proceeds, now, metadata) {
  const account = ensurePlayerBankAccount(player, now);
  if (!account.creditLoan || proceeds <= 0) return 0;
  const liability = creditLoanLiability(player);
  const applied = floorCents(Math.min(liability, proceeds));
  if (applied > 0) applyCreditLoanPayment(world, player, applied, now, { collection: true, source: metadata.kind });
  const surplus = floorCents(proceeds - applied);
  if (surplus > 0) {
    account.depositCredits = addSafe(account.depositCredits, surplus);
    recordTransaction(account, 'collection_surplus', surplus, now, '追偿资产剩余价值返还银行存款', metadata);
  }
  return applied;
}

function collectAvailableCommodities(world, player, now) {
  const candidates = Object.entries(player.inventories || {}).flatMap(([rawKey, inventory]) => {
    const { provinceId, assetId } = splitProvinceScopedKey(rawKey);
    const quantity = Math.max(0, Math.floor(Number(inventory?.available || 0)));
    const unitValue = floorCents(commodityUnitValue(world, assetId, provinceId) * 0.8);
    return quantity > 0 && unitValue > 0 ? [{ rawKey, provinceId, assetId, inventory, quantity, unitValue }] : [];
  }).sort((left, right) => right.unitValue - left.unitValue || left.rawKey.localeCompare(right.rawKey));
  for (const item of candidates) {
    if (!ensurePlayerBankAccount(player, now).creditLoan) break;
    const liability = creditLoanLiability(player);
    const needed = Math.max(1, Math.ceil(liability / item.unitValue));
    const quantity = Math.min(item.quantity, needed);
    item.inventory.available = Math.max(0, Number(item.inventory.available || 0) - quantity);
    const proceeds = floorCents(quantity * item.unitValue);
    applyLiquidationValue(world, player, proceeds, now, {
      kind: 'commodity', provinceId: item.provinceId, assetId: item.assetId, quantity,
    });
  }
}

function collectAvailableFacilities(world, player, now) {
  const candidates = (player.facilityGroups || []).flatMap((group) => {
    const provinceId = normalizeProvinceId(group?.provinceId);
    const facilityTypeId = String(group?.facilityTypeId || '');
    const quantity = legacy.transferableFacilityQuantity(world, player, facilityTypeId, provinceId);
    const unitValue = floorCents(prudentFacilityUnitValue(world, facilityTypeId, provinceId) * 0.8);
    return quantity > 0 && unitValue > 0 ? [{ group, provinceId, facilityTypeId, quantity, unitValue }] : [];
  }).sort((left, right) => right.unitValue - left.unitValue
    || left.provinceId.localeCompare(right.provinceId)
    || left.facilityTypeId.localeCompare(right.facilityTypeId));
  for (const item of candidates) {
    if (!ensurePlayerBankAccount(player, now).creditLoan) break;
    const liability = creditLoanLiability(player);
    const needed = Math.max(1, Math.ceil(liability / item.unitValue));
    const quantity = Math.min(item.quantity, needed);
    const removed = reduceFacilityGroup(item.group, quantity);
    if (removed <= 0) continue;
    const key = provinceScopedKey(item.provinceId, item.facilityTypeId);
    const bank = ensureBankWorld(world, now, { normalizePlayers: false });
    bank.facilityReserves ||= {};
    bank.facilityReserves[key] = safeInteger(bank.facilityReserves[key]) + removed;
    const proceeds = floorCents(removed * item.unitValue);
    applyLiquidationValue(world, player, proceeds, now, {
      kind: 'facility', provinceId: item.provinceId, assetId: item.facilityTypeId, quantity: removed,
    });
  }
}

function collectAvailableCommercialBuildings(world, player, now) {
  const candidates = (player.commercialBuildingGroups || []).flatMap((group) => {
    const commercialTypeId = String(group?.commercialTypeId || '');
    const type = COMMERCIAL_BY_ID.get(commercialTypeId);
    const quantity = safeInteger(group?.count);
    const unitValue = floorCents(safeMoney(type?.systemValue) * 0.8);
    return quantity > 0 && unitValue > 0 ? [{ group, commercialTypeId, quantity, unitValue }] : [];
  }).sort((left, right) => right.unitValue - left.unitValue || left.commercialTypeId.localeCompare(right.commercialTypeId));
  for (const item of candidates) {
    if (!ensurePlayerBankAccount(player, now).creditLoan) break;
    const liability = creditLoanLiability(player);
    const needed = Math.max(1, Math.ceil(liability / item.unitValue));
    const quantity = Math.min(item.quantity, needed);
    const removed = reduceCommercialGroup(item.group, quantity);
    if (removed <= 0) continue;
    const proceeds = floorCents(removed * item.unitValue);
    applyLiquidationValue(world, player, proceeds, now, {
      kind: 'commercial', assetId: item.commercialTypeId, quantity: removed,
    });
  }
}

function beginCreditDefault(world, player, now) {
  const account = ensurePlayerBankAccount(player, now);
  const loan = account.creditLoan;
  if (!loan || loan.defaultedAt) return;
  loan.defaultedAt = now;
  account.lastDefaultAt = now;
  const bank = ensureBankWorld(world, now, { normalizePlayers: false });
  bank.totals.defaults = safeInteger(bank.totals.defaults) + 1;
  player.stats ||= {};
  player.stats.bankDefaults = safeInteger(player.stats.bankDefaults) + 1;
  recordTransaction(account, 'default', creditLoanLiability(player), now, '资产授信贷款进入违约追偿', { loanId: loan.id });
}

function collectCreditDefault(world, player, now) {
  const account = ensurePlayerBankAccount(player, now);
  if (!account.creditLoan) return;
  beginCreditDefault(world, player, now);
  repayCreditLoanFromBalance(world, player, 'deposit', now, { collection: true });
  if (ensurePlayerBankAccount(player, now).creditLoan) repayCreditLoanFromBalance(world, player, 'cash', now, { collection: true });
  if (ensurePlayerBankAccount(player, now).creditLoan && player.commodityInvestmentAccount) {
    collectPlayerCommodityInvestments(world, player, creditLoanLiability(player), now);
    repayCreditLoanFromBalance(world, player, 'cash', now, { collection: true });
  }
  if (ensurePlayerBankAccount(player, now).creditLoan) collectAvailableCommodities(world, player, now);
  if (ensurePlayerBankAccount(player, now).creditLoan) collectAvailableFacilities(world, player, now);
  if (ensurePlayerBankAccount(player, now).creditLoan) collectAvailableCommercialBuildings(world, player, now);
  const remaining = ensurePlayerBankAccount(player, now).creditLoan;
  if (remaining) {
    remaining.status = 'grace';
    remaining.graceEndsAt = now + BANK_COLLECTION_RETRY_MS;
    recordTransaction(account, 'collection_pending', creditLoanLiability(player), now, '违约欠款尚未结清，将继续追偿', { loanId: remaining.id });
  }
}

function processCreditLoanDeadlines(world, now) {
  for (const player of Object.values(world.players || {})) {
    const account = ensurePlayerBankAccount(player, now);
    let loan = account.creditLoan;
    if (!loan) continue;
    if (loan.status === 'active' && loan.dueAt <= now) {
      autoRepayCreditLoan(world, player, now);
      loan = ensurePlayerBankAccount(player, now).creditLoan;
      if (!loan) continue;
      loan.status = 'grace';
      loan.graceEndsAt = Math.max(loan.graceEndsAt, loan.dueAt + BANK_LOAN_GRACE_MS);
      recordTransaction(account, 'grace_started', creditLoanLiability(player), now, '贷款进入 12h 宽限期', { loanId: loan.id });
    }
    loan = ensurePlayerBankAccount(player, now).creditLoan;
    if (loan?.status === 'grace' && loan.graceEndsAt <= now) collectCreditDefault(world, player, now);
  }
}

function earliestCreditLoanDeadline(world) {
  let deadline = null;
  for (const player of Object.values(world.players || {})) {
    const loan = player?.bankAccount?.creditLoan;
    if (!loan) continue;
    const candidate = loan.status === 'grace' ? Number(loan.graceEndsAt) : Number(loan.dueAt);
    if (Number.isFinite(candidate) && candidate >= 0) deadline = deadline === null ? candidate : Math.min(deadline, candidate);
  }
  return deadline;
}

export function nextBankDeadlineAt(world, now = Date.now()) {
  const legacyDeadline = legacy.nextBankDeadlineAt(world, now);
  const creditDeadline = earliestCreditLoanDeadline(world);
  return creditDeadline === null ? legacyDeadline : Math.min(legacyDeadline, creditDeadline);
}

export function processBankWorld(world, now = Date.now()) {
  ensureBankWorld(world, now);
  let changed = false;
  let iterations = 0;
  while (iterations < 4_000) {
    const legacyDeadline = legacy.nextBankDeadlineAt(world, now);
    const creditDeadline = earliestCreditLoanDeadline(world);
    const nextAt = creditDeadline === null ? legacyDeadline : Math.min(legacyDeadline, creditDeadline);
    if (!Number.isFinite(nextAt) || nextAt > now) break;
    if (legacyDeadline <= nextAt) {
      legacy.processBankWorld(world, nextAt);
      changed = true;
    }
    if (creditDeadline !== null && creditDeadline <= nextAt) {
      processCreditLoanDeadlines(world, nextAt);
      changed = true;
    }
    iterations += 1;
  }
  if (iterations >= 4_000) throw new Error('银行截止时间处理超过安全上限');
  ensureBankWorld(world, now);
  return changed;
}

function applyCreditBorrow(world, player, payload, now) {
  const account = ensurePlayerBankAccount(player, now);
  if (account.activeLoan || account.creditLoan) return { ok: false, message: '每名玩家同时只能有一笔进行中的贷款' };
  const termHours = termHoursFromPayload(payload);
  if (!termHours) return { ok: false, message: '请选择有效的贷款周期' };
  const assessment = calculateAssetCreditAssessment(world, player, payload.amount, termHours, now);
  if (!assessment.requestedAmount || assessment.requestedAmount > assessment.maximumLoanCredits) {
    return { ok: false, message: '申请金额无效或超过当前最高贷款额度' };
  }
  const amount = assessment.requestedAmount;
  const loan = {
    id: `bank-credit-loan-${randomUUID()}`,
    status: 'active',
    borrowedAt: now,
    dueAt: now + assessment.termMs,
    graceEndsAt: now + assessment.termMs + BANK_LOAN_GRACE_MS,
    termMs: assessment.termMs,
    principalOriginal: amount,
    principalOutstanding: amount,
    interestOriginal: assessment.totalInterestCredits,
    interestOutstanding: assessment.totalInterestCredits,
    interestRateBps: assessment.interestRateBps,
    assetValueAtOrigination: assessment.assetValue,
    creditLimitAtOrigination: assessment.maximumLoanCredits,
    creditUtilizationBps: assessment.creditUtilizationBps,
    autoRepay: payload.autoRepay !== false,
    defaultedAt: null,
  };
  account.creditLoan = loan;
  player.credits = addSafe(player.credits, amount);
  const bank = ensureBankWorld(world, now, { normalizePlayers: false });
  bank.totals.creditIssued = addSafe(bank.totals.creditIssued, amount);
  player.stats ||= {};
  player.stats.bankCreditIssued = addSafe(player.stats.bankCreditIssued, amount);
  recordTransaction(account, 'loan_disbursed', amount, now, '银行发放资产授信贷款', {
    loanId: loan.id,
    termHours,
    creditUtilizationBps: assessment.creditUtilizationBps,
  });
  return { ok: true, message: `贷款已发放，到期应还 ${assessment.totalRepaymentCredits}` };
}

function applyCreditRepay(world, player, payload, now) {
  const account = ensurePlayerBankAccount(player, now);
  const loan = account.creditLoan;
  if (!loan || (payload.loanId && String(payload.loanId) !== loan.id)) return { ok: false, message: '贷款记录不存在' };
  const liability = creditLoanLiability(player);
  const amount = payload.amount === 'all' ? liability : safePositiveMoney(payload.amount, Math.max(0.01, liability));
  if (!amount || amount > liability) return { ok: false, message: '还款金额无效' };
  if (safeMoney(player.credits) < amount) return { ok: false, message: '可用资金不足' };
  player.credits = safeMoney(player.credits - amount);
  return applyCreditLoanPayment(world, player, amount, now, { source: 'cash' });
}

function applyCreditAutoRepaySetting(player, payload, now) {
  const account = ensurePlayerBankAccount(player, now);
  if (!account.creditLoan || (payload.loanId && String(payload.loanId) !== account.creditLoan.id)) {
    return { ok: false, message: '贷款记录不存在' };
  }
  account.creditLoan.autoRepay = payload.enabled === true;
  recordTransaction(
    account,
    'auto_repay_updated',
    0,
    now,
    account.creditLoan.autoRepay ? '已开启自动还款' : '已关闭自动还款',
    { loanId: account.creditLoan.id },
  );
  return { ok: true, message: account.creditLoan.autoRepay ? '已开启自动还款' : '已关闭自动还款' };
}

export function applyBankAction(world, user, action, payload = {}, now = Date.now(), { processWorld: shouldProcessWorld = true } = {}) {
  if (shouldProcessWorld) {
    migrateBankWorld(world, now);
    processBankWorld(world, now);
  } else {
    ensureBankWorld(world, now, { normalizePlayers: false });
  }
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家不存在' };
  const account = ensurePlayerBankAccount(player, now);
  if (action === 'bankBorrow') return applyCreditBorrow(world, player, payload, now);
  if (action === 'bankWithdraw' && account.creditLoan?.status === 'grace') {
    return { ok: false, message: '贷款处于宽限期或追偿期，暂时不能取款' };
  }
  if (action === 'bankRepay' && account.creditLoan && (!payload.loanId || String(payload.loanId) === account.creditLoan.id)) {
    return applyCreditRepay(world, player, payload, now);
  }
  if (action === 'bankSetAutoRepay' && account.creditLoan && (!payload.loanId || String(payload.loanId) === account.creditLoan.id)) {
    return applyCreditAutoRepaySetting(player, payload, now);
  }
  return legacy.applyBankAction(world, user, action, payload, now, { processWorld: false });
}

function publicCreditLoan(loan) {
  if (!loan) return null;
  return {
    id: loan.id,
    status: loan.status,
    borrowedAt: loan.borrowedAt,
    dueAt: loan.dueAt,
    graceEndsAt: loan.graceEndsAt,
    principalOriginal: loan.principalOriginal,
    principalOutstanding: loan.principalOutstanding,
    interestOriginal: loan.interestOriginal,
    interestOutstanding: loan.interestOutstanding,
    interestRateBps: loan.interestRateBps,
    collateral: [],
    collateralValueAtOrigination: loan.assetValueAtOrigination,
    ltvBps: loan.creditUtilizationBps,
    autoRepay: loan.autoRepay,
  };
}

export function createBankClientState(world, player, now = Date.now()) {
  const legacyState = legacy.createBankClientState(world, player, now);
  const account = ensurePlayerBankAccount(player, now);
  const currentLoan = legacyState.bankAccount.activeLoan || publicCreditLoan(account.creditLoan);
  let assetAssessment;
  try { assetAssessment = calculateAssetCreditAssessment(world, player, undefined, 72, now); }
  catch (error) {
    if (error.code !== 'CASH_PRICE_UNAVAILABLE') throw error;
    assetAssessment = { assetValue: null, maximumLoanCredits: null };
  }
  return {
    ...legacyState,
    bankAccount: {
      ...legacyState.bankAccount,
      activeLoan: currentLoan,
      recentTransactions: structuredClone((account.recentTransactions || []).slice(-50).reverse()),
      availableCollateral: legacyState.bankAccount.activeLoan ? legacyState.bankAccount.availableCollateral : [],
    },
    bankSummary: {
      ...legacyState.bankSummary,
      loanGraceMs: BANK_LOAN_GRACE_MS,
      baseLoanToValueBps: BANK_BASE_CREDIT_RATIO_BPS,
      depositBufferBonusBps: 0,
      repaymentHistoryBonusBps: BANK_REPAYMENT_HISTORY_BONUS_BPS,
      recentDefaultPenaltyBps: BANK_RECENT_DEFAULT_PENALTY_BPS,
      minimumLoanToValueBps: BANK_MINIMUM_CREDIT_RATIO_BPS,
      maximumLoanToValueBps: BANK_MAXIMUM_CREDIT_RATIO_BPS,
      valuationAvailable: assetAssessment.assetValue !== null,
      assetCreditValue: assetAssessment.assetValue,
      maximumLoanCredits: assetAssessment.maximumLoanCredits,
      loanTermOptionsHours: BANK_LOAN_TERM_OPTIONS_HOURS,
    },
  };
}

// Historical collateral remains province-scoped inside banking-legacy.js. New
// credit loans never create or consume collateral; this adapter only delegates
// the old mortgaged-factory boundary while a legacy activeLoan still exists.
