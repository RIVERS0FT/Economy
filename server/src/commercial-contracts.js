import { randomUUID } from 'node:crypto';
import { FACILITY_TYPE_CATALOG } from './domain.js';
import { calculateCumulativeMarketSellFee } from './market-sell-fee.js';
import { creditPopulationEmployment } from './population-economy.js';
import { hasResearchAccessForFacility } from './research.js';
import { calculateRateMoney, multiplyMoneyByInteger, normalizePlayerMoneyInput, roundInternalMoney } from './money.js';
import { transferableFacilityQuantity } from './banking.js';
import { DEFAULT_PROVINCE_ID, normalizeProvinceId, provinceScopedKey } from './provinces.js';
import { optionalPlayerDisplayName, playerDisplayName } from './player-identity.js';

export const COMMERCIAL_CONTRACT_KINDS = Object.freeze(['loan', 'facility_lease']);
export const PLAYER_LOAN_TERMS = Object.freeze([12, 24, 72].map((hours) => hours * 60 * 60 * 1000));
export const FACILITY_LEASE_INTERVALS = Object.freeze([1, 3, 6, 12, 24].map((hours) => hours * 60 * 60 * 1000));
export const COMMERCIAL_GRACE_MS = 12 * 60 * 60 * 1000;

const MAX_MONEY = 1_000_000;
const MAX_FACILITY_QUANTITY = 1_000_000;
const MAX_LEASE_PERIODS = 100;
const MIN_LEASE_PERIODS = 2;
const MAX_LOAN_RATE_BPS = 2_000;
const MIN_LOAN_RATE_BPS = 100;
const MAX_LOAN_TO_VALUE_BPS = 5_000;
const BASIS_POINTS = 10_000;
const BOND_RATE_BPS = 2_000;
const FACILITY_BY_ID = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));

function result(ok, message) { return { ok, message }; }
function playerFor(world, userId) { return world.players?.[String(userId)] || null; }
function money(value, min = 0.01, max = MAX_MONEY) { return normalizePlayerMoneyInput(value, { min, max }); }
function integer(value, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= min && normalized <= max ? normalized : null;
}
function allowedInteger(value, allowed) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && allowed.includes(normalized) ? normalized : null;
}
function addMoney(...values) {
  return roundInternalMoney(values.reduce((sum, value) => sum + Number(value || 0), 0));
}
function consumeFrozenCredits(player, amount) {
  const target = Math.max(0, roundInternalMoney(amount || 0) || 0);
  const consumed = Math.min(target, Math.max(0, roundInternalMoney(player.frozenCredits || 0) || 0));
  player.frozenCredits = Math.max(0, roundInternalMoney(Number(player.frozenCredits || 0) - consumed) || 0);
  return consumed;
}
function releaseFrozenCredits(player, amount) {
  const released = consumeFrozenCredits(player, amount);
  player.credits = Math.max(0, roundInternalMoney(Number(player.credits || 0) + released) || 0);
  return released;
}
function transferFrozenCredits(from, to, amount) {
  const transferred = consumeFrozenCredits(from, amount);
  to.credits = Math.max(0, roundInternalMoney(Number(to.credits || 0) + transferred) || 0);
  return transferred;
}
function groupFor(player, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID, create = false, now = Date.now()) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  player.facilityGroups ||= [];
  let group = player.facilityGroups.find((candidate) => (
    String(candidate.facilityTypeId) === String(facilityTypeId)
    && normalizeProvinceId(candidate.provinceId) === selectedProvinceId
  ));
  if (!group && create) {
    group = {
      provinceId: selectedProvinceId,
      facilityTypeId: String(facilityTypeId), count: 0, participatingCount: 0,
      enabled: false, status: 'stopped', statusReason: 'manual', lifetimeOutput: 0,
      activeRecipeId: FACILITY_BY_ID.get(String(facilityTypeId))?.defaultRecipeId,
      staffingRateBps: 10_000, staffingUpdatedAt: Math.max(0, Number(now) || 0), staffingBatchCarryBps: 0,
    };
    player.facilityGroups.push(group);
  }
  return group;
}
function prudentFacilityUnitValue(world, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID) {
  const facility = FACILITY_BY_ID.get(String(facilityTypeId));
  if (!facility) return 0;
  const traded = roundInternalMoney(
    world.facilityMarkets?.[provinceScopedKey(provinceId, facility.id)]?.lastTradePrice,
  );
  const marketValue = traded !== null && traded > 0 ? traded : facility.systemValue;
  return Math.max(0.01, Math.min(Number(facility.systemValue || 0), Number(marketValue || 0)));
}
function canOperateFacility(world, player, facilityTypeId, now) {
  return hasResearchAccessForFacility(world, player, facilityTypeId, now);
}
function bondFor(value) {
  return calculateRateMoney(value, BOND_RATE_BPS, BASIS_POINTS, 'ceil');
}
function loanInterest(principal, rateBps) {
  return calculateRateMoney(principal, rateBps, BASIS_POINTS, 'ceil');
}
function leaseGross(contract) {
  return money(contract.rentPerPeriod) || 0;
}
function reserveLeaseRent(contract, lessee) {
  const gross = leaseGross(contract);
  if (!gross) return false;
  if (contract.lesseeEscrowCredits >= gross) return true;
  const required = roundInternalMoney(gross - contract.lesseeEscrowCredits) || 0;
  if (lessee.credits < required) return false;
  lessee.credits = roundInternalMoney(lessee.credits - required) || 0;
  lessee.frozenCredits = addMoney(lessee.frozenCredits, required) || 0;
  contract.lesseeEscrowCredits = addMoney(contract.lesseeEscrowCredits, required) || 0;
  return true;
}
function releaseLeaseEscrow(contract, lessee, lessor) {
  if (lessee) {
    releaseFrozenCredits(lessee, contract.lesseeEscrowCredits);
    releaseFrozenCredits(lessee, contract.lesseeBondCredits);
  }
  if (lessor) releaseFrozenCredits(lessor, contract.lessorBondCredits);
  contract.lesseeEscrowCredits = 0;
  contract.lesseeBondCredits = 0;
  contract.lessorBondCredits = 0;
}

function commercialAliases(contract) {
  if (contract.kind === 'loan') {
    contract.buyerId = contract.borrowerId;
    contract.supplierId = contract.lenderId;
    contract.productId = 'credits';
    contract.quantityPerDelivery = 0;
    contract.unitPrice = contract.principal;
    contract.batchGross = contract.principal;
    contract.deliveryIntervalMs = contract.termMs;
    contract.totalDeliveries = 1;
    contract.completedDeliveries = contract.status === 'completed' ? 1 : 0;
    contract.firstDeliveryDelayMs = contract.termMs;
    contract.nextDueAt = contract.status === 'active' ? contract.dueAt : null;
    contract.buyerAutoFund = contract.autoRepay;
    contract.supplierAutoReserve = false;
  } else if (contract.kind === 'facility_lease') {
    contract.buyerId = contract.lesseeId;
    contract.supplierId = contract.lessorId;
    contract.productId = `facility:${contract.facilityTypeId}`;
    contract.quantityPerDelivery = contract.quantity;
    contract.unitPrice = contract.rentPerPeriod;
    contract.batchGross = contract.rentPerPeriod;
    contract.deliveryIntervalMs = contract.periodMs;
    contract.totalDeliveries = contract.totalPeriods;
    contract.completedDeliveries = contract.completedPeriods;
    contract.firstDeliveryDelayMs = contract.firstPeriodDelayMs;
    contract.buyerAutoFund = contract.autoFund;
    contract.supplierAutoReserve = false;
    contract.buyerEscrowCredits = contract.lesseeEscrowCredits;
    contract.buyerBondCredits = contract.lesseeBondCredits;
    contract.supplierBondCredits = contract.lessorBondCredits;
    contract.supplierReservedQuantity = contract.status === 'active' && !contract.graceEndsAt && !contract.breachedAt ? contract.quantity : 0;
  }
  delete contract.buyerName;
  delete contract.supplierName;
  contract.publisherRole = ['lender', 'lessor'].includes(contract.publisherSide) ? 'supplier' : 'buyer';
  contract.roundStatus = contract.breachedAt ? 'grace' : contract.graceEndsAt ? 'grace' : contract.status === 'active' ? 'ready' : 'preparing';
  return contract;
}

function normalizeLoan(contract) {
  const principal = money(contract?.principal ?? contract?.unitPrice) || 0.01;
  const interestRateBps = integer(contract?.interestRateBps, MIN_LOAN_RATE_BPS, MAX_LOAN_RATE_BPS) || MIN_LOAN_RATE_BPS;
  const termMs = allowedInteger(contract?.termMs ?? contract?.deliveryIntervalMs, PLAYER_LOAN_TERMS) || PLAYER_LOAN_TERMS[1];
  const facilityTypeId = FACILITY_BY_ID.has(String(contract?.facilityTypeId || '')) ? String(contract.facilityTypeId) : FACILITY_TYPE_CATALOG[0]?.id;
  const provinceId = normalizeProvinceId(contract?.provinceId);
  const collateralQuantity = integer(contract?.collateralQuantity, 1, MAX_FACILITY_QUANTITY) || 1;
  const status = ['open', 'active', 'completed', 'cancelled', 'terminated', 'expired'].includes(contract?.status) ? contract.status : 'open';
  const createdAt = Math.max(0, Number(contract?.createdAt || Date.now()));
  const normalized = {
    ...contract,
    id: String(contract?.id || `player-loan-contract-${randomUUID()}`),
    kind: 'loan',
    publisherSide: contract?.publisherSide === 'lender' ? 'lender' : contract?.publisherSide === 'borrower' ? 'borrower' : contract?.publisherRole === 'supplier' ? 'lender' : 'borrower',
    publisherId: Number(contract?.publisherId),
    publisherName: String(contract?.publisherName || '玩家'),
    lenderId: contract?.lenderId == null ? null : Number(contract.lenderId),
    lenderName: contract?.lenderName ? String(contract.lenderName) : null,
    borrowerId: contract?.borrowerId == null ? null : Number(contract.borrowerId),
    borrowerName: contract?.borrowerName ? String(contract.borrowerName) : null,
    principal,
    principalOutstanding: Math.max(0, money(contract?.principalOutstanding, 0, MAX_MONEY) ?? (status === 'active' ? principal : 0)),
    interestRateBps,
    interestDue: Math.max(0, money(contract?.interestDue, 0, MAX_MONEY) ?? loanInterest(principal, interestRateBps) ?? 0),
    termMs,
    provinceId,
    facilityTypeId,
    collateralQuantity,
    collateralUnitValue: Math.max(0, Number(contract?.collateralUnitValue || 0)),
    collateralTransferredQuantity: Math.max(0, Math.floor(Number(contract?.collateralTransferredQuantity || 0))),
    autoRepay: contract?.autoRepay !== false,
    status,
    createdAt,
    offerExpiresAt: Math.max(0, Number(contract?.offerExpiresAt || createdAt + 7 * 24 * 60 * 60 * 1000)),
    acceptedAt: contract?.acceptedAt == null ? undefined : Math.max(0, Number(contract.acceptedAt)),
    dueAt: contract?.dueAt == null ? null : Math.max(0, Number(contract.dueAt)),
    graceEndsAt: contract?.graceEndsAt == null ? undefined : Math.max(0, Number(contract.graceEndsAt)),
    breachedAt: contract?.breachedAt == null ? undefined : Math.max(0, Number(contract.breachedAt)),
    defaultCollateralQuantity: Math.max(0, Math.floor(Number(contract?.defaultCollateralQuantity || 0))),
    defaultCollateralUnitValue: Math.max(0, Number(contract?.defaultCollateralUnitValue || 0)),
    endedAt: contract?.endedAt == null ? undefined : Math.max(0, Number(contract.endedAt)),
    completedAt: contract?.completedAt == null ? undefined : Math.max(0, Number(contract.completedAt)),
    marketSellFeeGross: Math.max(0, Number(contract?.marketSellFeeGross || 0)),
    marketSellFeeCharged: Math.max(0, Number(contract?.marketSellFeeCharged || 0)),
  };
  delete normalized.publisherName;
  delete normalized.lenderName;
  delete normalized.borrowerName;
  delete normalized.lessorName;
  delete normalized.lesseeName;
  delete normalized.buyerName;
  delete normalized.supplierName;
  return commercialAliases(normalized);
}

function normalizeLease(contract) {
  const rentPerPeriod = money(contract?.rentPerPeriod ?? contract?.unitPrice) || 0.01;
  const periodMs = allowedInteger(contract?.periodMs ?? contract?.deliveryIntervalMs, FACILITY_LEASE_INTERVALS) || FACILITY_LEASE_INTERVALS[0];
  const totalPeriods = integer(contract?.totalPeriods ?? contract?.totalDeliveries, MIN_LEASE_PERIODS, MAX_LEASE_PERIODS) || MIN_LEASE_PERIODS;
  const completedPeriods = Math.max(0, Math.min(totalPeriods, Math.floor(Number(contract?.completedPeriods ?? contract?.completedDeliveries ?? 0))));
  const firstPeriodDelayMs = allowedInteger(contract?.firstPeriodDelayMs ?? contract?.firstDeliveryDelayMs ?? 0, [0, ...FACILITY_LEASE_INTERVALS]) ?? 0;
  const facilityTypeId = FACILITY_BY_ID.has(String(contract?.facilityTypeId || '')) ? String(contract.facilityTypeId) : FACILITY_TYPE_CATALOG[0]?.id;
  const provinceId = normalizeProvinceId(contract?.provinceId);
  const quantity = integer(contract?.quantity ?? contract?.quantityPerDelivery, 1, MAX_FACILITY_QUANTITY) || 1;
  const status = ['open', 'active', 'completed', 'cancelled', 'terminated', 'expired'].includes(contract?.status) ? contract.status : 'open';
  const createdAt = Math.max(0, Number(contract?.createdAt || Date.now()));
  const normalized = {
    ...contract,
    id: String(contract?.id || `facility-lease-contract-${randomUUID()}`),
    kind: 'facility_lease',
    publisherSide: contract?.publisherSide === 'lessor' ? 'lessor' : contract?.publisherSide === 'lessee' ? 'lessee' : contract?.publisherRole === 'supplier' ? 'lessor' : 'lessee',
    publisherId: Number(contract?.publisherId),
    publisherName: String(contract?.publisherName || '玩家'),
    lessorId: contract?.lessorId == null ? null : Number(contract.lessorId),
    lessorName: contract?.lessorName ? String(contract.lessorName) : null,
    lesseeId: contract?.lesseeId == null ? null : Number(contract.lesseeId),
    lesseeName: contract?.lesseeName ? String(contract.lesseeName) : null,
    provinceId,
    facilityTypeId,
    quantity,
    rentPerPeriod,
    periodMs,
    totalPeriods,
    completedPeriods,
    firstPeriodDelayMs,
    lesseeEscrowCredits: Math.max(0, Number(contract?.lesseeEscrowCredits ?? contract?.buyerEscrowCredits ?? 0)),
    lesseeBondCredits: Math.max(0, Number(contract?.lesseeBondCredits ?? contract?.buyerBondCredits ?? 0)),
    lessorBondCredits: Math.max(0, Number(contract?.lessorBondCredits ?? contract?.supplierBondCredits ?? 0)),
    autoFund: contract?.autoFund ?? contract?.buyerAutoFund ?? true,
    status,
    createdAt,
    offerExpiresAt: Math.max(0, Number(contract?.offerExpiresAt || createdAt + 7 * 24 * 60 * 60 * 1000)),
    acceptedAt: contract?.acceptedAt == null ? undefined : Math.max(0, Number(contract.acceptedAt)),
    nextDueAt: contract?.nextDueAt == null ? null : Math.max(0, Number(contract.nextDueAt)),
    graceEndsAt: contract?.graceEndsAt == null ? undefined : Math.max(0, Number(contract.graceEndsAt)),
    breachedAt: contract?.breachedAt == null ? undefined : Math.max(0, Number(contract.breachedAt)),
    endedAt: contract?.endedAt == null ? undefined : Math.max(0, Number(contract.endedAt)),
    completedAt: contract?.completedAt == null ? undefined : Math.max(0, Number(contract.completedAt)),
    marketSellFeeGross: Math.max(0, Number(contract?.marketSellFeeGross || 0)),
    marketSellFeeCharged: Math.max(0, Number(contract?.marketSellFeeCharged || 0)),
  };
  delete normalized.publisherName;
  delete normalized.lenderName;
  delete normalized.borrowerName;
  delete normalized.lessorName;
  delete normalized.lesseeName;
  delete normalized.buyerName;
  delete normalized.supplierName;
  return commercialAliases(normalized);
}

export function normalizeCommercialContract(contract) {
  if (contract?.kind === 'loan') return normalizeLoan(contract);
  if (contract?.kind === 'facility_lease') return normalizeLease(contract);
  return null;
}

export function createCommercialContract(world, user, payload, now, runtimeIndex) {
  const publisher = playerFor(world, user.id);
  if (!publisher) return result(false, '玩家不存在');
  if (payload.kind === 'loan') {
    const publisherSide = payload.publisherSide === 'lender' ? 'lender' : payload.publisherSide === 'borrower' ? 'borrower' : null;
    const principal = money(payload.principal);
    const interestRateBps = integer(payload.interestRateBps, MIN_LOAN_RATE_BPS, MAX_LOAN_RATE_BPS);
    const termMs = allowedInteger(payload.termMs, PLAYER_LOAN_TERMS);
    const provinceId = normalizeProvinceId(payload.provinceId);
    const facilityTypeId = FACILITY_BY_ID.has(String(payload.facilityTypeId || '')) ? String(payload.facilityTypeId) : null;
    const collateralQuantity = integer(payload.collateralQuantity, 1, MAX_FACILITY_QUANTITY);
    if (!publisherSide || !principal || !interestRateBps || !termMs || !facilityTypeId || !collateralQuantity) return result(false, '借贷合同参数无效');
    if (runtimeIndex.openCountForPublisher(user.id) >= 10) return result(false, '公开合同数量已达上限');
    const contract = normalizeLoan({
      id: `player-loan-contract-${randomUUID()}`, kind: 'loan', publisherSide,
      publisherId: Number(user.id),
      lenderId: publisherSide === 'lender' ? Number(user.id) : null,
      borrowerId: publisherSide === 'borrower' ? Number(user.id) : null,
      principal, principalOutstanding: 0, interestRateBps, interestDue: loanInterest(principal, interestRateBps),
      termMs, provinceId, facilityTypeId, collateralQuantity, autoRepay: true,
      status: 'open', createdAt: now, offerExpiresAt: now + 7 * 24 * 60 * 60 * 1000,
    });
    world.productionContracts.push(contract);
    runtimeIndex.addContract(contract);
    return result(true, publisherSide === 'lender' ? '放贷合同已发布' : '贷款合同已发布');
  }
  if (payload.kind === 'facility_lease') {
    const publisherSide = payload.publisherSide === 'lessor' ? 'lessor' : payload.publisherSide === 'lessee' ? 'lessee' : null;
    const provinceId = normalizeProvinceId(payload.provinceId);
    const facilityTypeId = FACILITY_BY_ID.has(String(payload.facilityTypeId || '')) ? String(payload.facilityTypeId) : null;
    const quantity = integer(payload.quantity, 1, MAX_FACILITY_QUANTITY);
    const rentPerPeriod = money(payload.rentPerPeriod);
    const periodMs = allowedInteger(payload.periodMs, FACILITY_LEASE_INTERVALS);
    const totalPeriods = integer(payload.totalPeriods, MIN_LEASE_PERIODS, MAX_LEASE_PERIODS);
    const firstPeriodDelayMs = allowedInteger(payload.firstPeriodDelayMs, [0, ...FACILITY_LEASE_INTERVALS]);
    if (!publisherSide || !facilityTypeId || !quantity || !rentPerPeriod || !periodMs || !totalPeriods || firstPeriodDelayMs === null) return result(false, '租赁合同参数无效');
    if (runtimeIndex.openCountForPublisher(user.id) >= 10) return result(false, '公开合同数量已达上限');
    const contract = normalizeLease({
      id: `facility-lease-contract-${randomUUID()}`, kind: 'facility_lease', publisherSide,
      publisherId: Number(user.id),
      lessorId: publisherSide === 'lessor' ? Number(user.id) : null,
      lesseeId: publisherSide === 'lessee' ? Number(user.id) : null,
      provinceId, facilityTypeId, quantity, rentPerPeriod, periodMs, totalPeriods, completedPeriods: 0,
      firstPeriodDelayMs, autoFund: true, status: 'open', createdAt: now,
      offerExpiresAt: now + 7 * 24 * 60 * 60 * 1000,
    });
    world.productionContracts.push(contract);
    runtimeIndex.addContract(contract);
    return result(true, publisherSide === 'lessor' ? '出租合同已发布' : '租赁合同已发布');
  }
  return null;
}

function acceptLoan(world, contract, user, now, runtimeIndex) {
  const accepter = playerFor(world, user.id);
  const publisher = playerFor(world, contract.publisherId);
  if (!accepter || !publisher) return result(false, '合同参与者不存在');
  const lender = contract.publisherSide === 'lender' ? publisher : accepter;
  const borrower = contract.publisherSide === 'borrower' ? publisher : accepter;
  const unitValue = prudentFacilityUnitValue(world, contract.facilityTypeId, contract.provinceId);
  const collateralValue = multiplyMoneyByInteger(unitValue, contract.collateralQuantity);
  const maxPrincipal = collateralValue === null ? null : calculateRateMoney(collateralValue, MAX_LOAN_TO_VALUE_BPS, BASIS_POINTS, 'floor');
  if (!maxPrincipal || contract.principal > maxPrincipal) return result(false, '贷款本金超过冻结工厂审慎价值的 50%');
  if (lender.credits < contract.principal) return result(false, '出借方可用资金不足');
  if (transferableFacilityQuantity(world, borrower, contract.facilityTypeId, contract.provinceId) < contract.collateralQuantity) return result(false, '借款方可冻结工厂数量不足');
  runtimeIndex.transition(contract, () => {
    lender.credits = roundInternalMoney(lender.credits - contract.principal) || 0;
    borrower.credits = addMoney(borrower.credits, contract.principal) || 0;
    contract.lenderId = Number(lender.userId);
    contract.borrowerId = Number(borrower.userId);
    contract.principalOutstanding = contract.principal;
    contract.interestDue = loanInterest(contract.principal, contract.interestRateBps) || 0;
    contract.collateralUnitValue = unitValue;
    contract.status = 'active';
    contract.acceptedAt = now;
    contract.dueAt = now + contract.termMs;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
  return result(true, '玩家贷款已放款，冻结工厂继续生产但已禁止转让');
}

function acceptLease(world, contract, user, now, runtimeIndex) {
  const accepter = playerFor(world, user.id);
  const publisher = playerFor(world, contract.publisherId);
  if (!accepter || !publisher) return result(false, '合同参与者不存在');
  const lessor = contract.publisherSide === 'lessor' ? publisher : accepter;
  const lessee = contract.publisherSide === 'lessee' ? publisher : accepter;
  if (!canOperateFacility(world, lessee, contract.facilityTypeId, now)) return result(false, '承租方尚未解锁对应复杂度研发');
  if (transferableFacilityQuantity(world, lessor, contract.facilityTypeId, contract.provinceId) < contract.quantity) return result(false, '出租方可出租工厂数量不足');
  const gross = leaseGross(contract);
  const bond = bondFor(gross);
  if (!gross || !bond) return result(false, '租赁金额超出安全范围');
  if (lessee.credits < gross + bond) return result(false, '承租方需要准备首期租金和保证金');
  if (lessor.credits < bond) return result(false, '出租方履约保证金不足');
  runtimeIndex.transition(contract, () => {
    lessee.credits = roundInternalMoney(lessee.credits - gross - bond) || 0;
    lessee.frozenCredits = addMoney(lessee.frozenCredits, gross, bond) || 0;
    lessor.credits = roundInternalMoney(lessor.credits - bond) || 0;
    lessor.frozenCredits = addMoney(lessor.frozenCredits, bond) || 0;
    contract.lessorId = Number(lessor.userId);
    contract.lesseeId = Number(lessee.userId);
    groupFor(lessee, contract.facilityTypeId, contract.provinceId, true, now);
    contract.lesseeEscrowCredits = gross;
    contract.lesseeBondCredits = bond;
    contract.lessorBondCredits = bond;
    contract.status = 'active';
    contract.acceptedAt = now;
    contract.nextDueAt = now + contract.firstPeriodDelayMs;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
  return result(true, '工厂租赁已生效，使用权从下一次生产协调开始转移');
}

export function acceptCommercialContract(world, contract, user, now, runtimeIndex) {
  if (contract.kind === 'loan') return acceptLoan(world, contract, user, now, runtimeIndex);
  if (contract.kind === 'facility_lease') return acceptLease(world, contract, user, now, runtimeIndex);
  return null;
}

function repayLoan(world, contract, borrower, now, runtimeIndex, automatic = false) {
  const lender = playerFor(world, contract.lenderId);
  if (!lender || !borrower) return false;
  const totalDue = addMoney(contract.principalOutstanding, contract.interestDue);
  if (totalDue === null || borrower.credits < totalDue) return false;
  runtimeIndex.transition(contract, () => {
    borrower.credits = roundInternalMoney(borrower.credits - totalDue) || 0;
    const fee = calculateCumulativeMarketSellFee(contract.interestDue);
    const netInterest = Math.max(0, roundInternalMoney(contract.interestDue - fee) || 0);
    lender.credits = addMoney(lender.credits, contract.principalOutstanding, netInterest) || 0;
    if (fee > 0) creditPopulationEmployment(world, fee, 'banking');
    contract.lastPaymentGross = totalDue;
    contract.lastPaymentFee = fee;
    contract.marketSellFeeGross = contract.interestDue;
    contract.marketSellFeeCharged = fee;
    contract.principalOutstanding = 0;
    contract.interestDue = 0;
    contract.status = 'completed';
    contract.completedAt = now;
    contract.endedAt = now;
    contract.repaymentTrigger = automatic ? 'automatic' : 'manual';
    contract.dueAt = null;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
  return true;
}

function confirmLoanDefault(world, contract, now, runtimeIndex) {
  const borrower = playerFor(world, contract.borrowerId);
  const lender = playerFor(world, contract.lenderId);
  const borrowerGroup = borrower && groupFor(borrower, contract.facilityTypeId, contract.provinceId);
  if (!borrower || !lender || !borrowerGroup) {
    transferLoanCollateral(world, contract, now, runtimeIndex);
    return;
  }
  const unitValue = Math.max(0.01, prudentFacilityUnitValue(world, contract.facilityTypeId, contract.provinceId) * 0.8);
  const due = addMoney(contract.principalOutstanding, contract.interestDue) || 0;
  const required = Math.max(1, Math.ceil(due / unitValue));
  const quantity = Math.min(contract.collateralQuantity, borrowerGroup.count, required);
  runtimeIndex.transition(contract, () => {
    contract.defaultCollateralQuantity = quantity;
    contract.defaultCollateralUnitValue = unitValue;
    contract.breachedAt = now;
    contract.terminationReason = 'borrower_default';
    contract.dueAt = null;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
}

function transferLoanCollateral(world, contract, now, runtimeIndex) {
  const borrower = playerFor(world, contract.borrowerId);
  const lender = playerFor(world, contract.lenderId);
  const borrowerGroup = borrower && groupFor(borrower, contract.facilityTypeId, contract.provinceId);
  if (!borrower || !lender || !borrowerGroup) {
    runtimeIndex.transition(contract, () => {
      contract.status = 'terminated'; contract.terminationReason = 'participant_missing'; contract.endedAt = now;
      commercialAliases(contract);
    });
    return;
  }
  const unitValue = Math.max(0.01, Number(contract.defaultCollateralUnitValue || 0) || prudentFacilityUnitValue(world, contract.facilityTypeId, contract.provinceId) * 0.8);
  const due = addMoney(contract.principalOutstanding, contract.interestDue) || 0;
  const required = Math.max(1, Math.ceil(due / unitValue));
  const plannedQuantity = Math.max(0, Math.floor(Number(contract.defaultCollateralQuantity || 0)));
  const quantity = Math.min(contract.collateralQuantity, borrowerGroup.count, plannedQuantity || required);
  runtimeIndex.transition(contract, () => {
    borrowerGroup.count = Math.max(0, borrowerGroup.count - quantity);
    if (borrowerGroup.count === 0) borrower.facilityGroups = borrower.facilityGroups.filter((candidate) => candidate !== borrowerGroup);
    const lenderGroup = groupFor(lender, contract.facilityTypeId, contract.provinceId, true, now);
    lenderGroup.count += quantity;
    contract.collateralTransferredQuantity = quantity;
    contract.lastCollateralUnitValue = unitValue;
    contract.status = 'terminated';
    contract.terminationReason = 'borrower_default';
    contract.endedAt = now;
    contract.principalOutstanding = 0;
    contract.interestDue = 0;
    contract.dueAt = null;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
}

function settleLeasePeriod(world, contract, lessee, lessor, now, runtimeIndex) {
  const gross = leaseGross(contract);
  if (!gross || contract.lesseeEscrowCredits < gross || lessee.frozenCredits < gross) return false;
  runtimeIndex.transition(contract, () => {
    consumeFrozenCredits(lessee, gross);
    contract.lesseeEscrowCredits = Math.max(0, roundInternalMoney(contract.lesseeEscrowCredits - gross) || 0);
    const previousGross = contract.marketSellFeeGross;
    const previousFee = contract.marketSellFeeCharged;
    const nextGross = addMoney(previousGross, gross) || 0;
    const nextFee = calculateCumulativeMarketSellFee(nextGross);
    const fee = Math.max(0, roundInternalMoney(nextFee - previousFee) || 0);
    const net = Math.max(0, roundInternalMoney(gross - fee) || 0);
    lessor.credits = addMoney(lessor.credits, net) || 0;
    if (fee > 0) creditPopulationEmployment(world, fee, 'marketService');
    contract.marketSellFeeGross = nextGross;
    contract.marketSellFeeCharged = nextFee;
    contract.lastDeliveryAt = now;
    contract.lastDeliveryGross = gross;
    contract.lastDeliveryFee = fee;
    contract.completedPeriods += 1;
    delete contract.graceEndsAt;
    if (contract.completedPeriods >= contract.totalPeriods) {
      releaseFrozenCredits(lessee, contract.lesseeBondCredits);
      releaseFrozenCredits(lessor, contract.lessorBondCredits);
      contract.lesseeBondCredits = 0;
      contract.lessorBondCredits = 0;
      contract.status = 'completed';
      contract.completedAt = now;
      contract.endedAt = now;
      contract.nextDueAt = null;
    } else if (contract.terminationRequestedBy) {
      releaseLeaseEscrow(contract, lessee, lessor);
      contract.status = 'terminated';
      contract.terminationReason = 'notice_completed';
      contract.endedAt = now;
      contract.nextDueAt = null;
    } else {
      contract.nextDueAt = Math.max(Number(contract.nextDueAt || now) + contract.periodMs, now + contract.periodMs);
      if (contract.autoFund) reserveLeaseRent(contract, lessee);
    }
    commercialAliases(contract);
  });
  return true;
}

function confirmLeaseDefault(contract, lessee, lessor, now, runtimeIndex) {
  runtimeIndex.transition(contract, () => {
    releaseFrozenCredits(lessee, contract.lesseeEscrowCredits);
    releaseFrozenCredits(lessor, contract.lessorBondCredits);
    contract.lesseeEscrowCredits = 0;
    contract.lessorBondCredits = 0;
    contract.breachedAt = now;
    contract.terminationReason = 'lessee_default';
    contract.nextDueAt = null;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
}

function claimLeaseDefault(contract, lessee, lessor, now, runtimeIndex) {
  const compensation = Math.max(0, Number(contract.lesseeBondCredits || 0));
  runtimeIndex.transition(contract, () => {
    transferFrozenCredits(lessee, lessor, compensation);
    contract.lastCompensation = compensation;
    contract.lastCompensationFromId = Number(lessee.userId);
    contract.lastCompensationToId = Number(lessor.userId);
    contract.lesseeBondCredits = 0;
    contract.status = 'terminated';
    contract.endedAt = now;
    commercialAliases(contract);
  });
}

export function processCommercialContract(world, contract, now, runtimeIndex) {
  if (contract.status === 'active' && contract.breachedAt && String(contract.terminationReason || '').endsWith('_default')) return;
  if (contract.kind === 'loan') {
    const borrower = playerFor(world, contract.borrowerId);
    if (!borrower || !playerFor(world, contract.lenderId)) {
      transferLoanCollateral(world, contract, now, runtimeIndex);
      return;
    }
    if (contract.autoRepay && now >= Number(contract.dueAt || Number.POSITIVE_INFINITY) && repayLoan(world, contract, borrower, now, runtimeIndex, true)) return;
    if (now < Number(contract.dueAt || Number.POSITIVE_INFINITY)) return;
    if (!contract.graceEndsAt) {
      runtimeIndex.transition(contract, () => { contract.graceEndsAt = now + COMMERCIAL_GRACE_MS; commercialAliases(contract); });
      return;
    }
    if (now < contract.graceEndsAt) return;
    if (repayLoan(world, contract, borrower, now, runtimeIndex, true)) return;
    confirmLoanDefault(world, contract, now, runtimeIndex);
    return;
  }
  if (contract.kind === 'facility_lease') {
    const lessee = playerFor(world, contract.lesseeId);
    const lessor = playerFor(world, contract.lessorId);
    if (!lessee || !lessor) {
      runtimeIndex.transition(contract, () => { contract.status = 'terminated'; contract.terminationReason = 'participant_missing'; contract.endedAt = now; commercialAliases(contract); });
      return;
    }
    if (contract.autoFund) reserveLeaseRent(contract, lessee);
    commercialAliases(contract);
    if (now < Number(contract.nextDueAt || Number.POSITIVE_INFINITY)) return;
    if (settleLeasePeriod(world, contract, lessee, lessor, now, runtimeIndex)) return;
    if (!contract.graceEndsAt) {
      runtimeIndex.transition(contract, () => { contract.graceEndsAt = now + COMMERCIAL_GRACE_MS; commercialAliases(contract); });
      return;
    }
    if (now < contract.graceEndsAt) return;
    if (settleLeasePeriod(world, contract, lessee, lessor, now, runtimeIndex)) return;
    confirmLeaseDefault(contract, lessee, lessor, now, runtimeIndex);
  }
}

function ownCommercialContract(runtimeIndex, userId, contractId) {
  const contract = runtimeIndex.contractById(contractId);
  if (!contract || contract.status !== 'active' || !COMMERCIAL_CONTRACT_KINDS.includes(contract.kind)) return null;
  return [contract.buyerId, contract.supplierId].some((id) => Number(id) === Number(userId)) ? contract : null;
}

export function applyCommercialContractAction(world, user, action, payload, now, runtimeIndex) {
  const contract = ownCommercialContract(runtimeIndex, user.id, payload.contractId);
  if (contract?.breachedAt && String(contract.terminationReason || '').endsWith('_default')) {
    if (action !== 'terminateProductionContractNow') return result(false, '合同已确认违约，不能再补救、还款或修改自动履约设置');
    if (contract.kind === 'loan') {
      if (Number(contract.lenderId) !== Number(user.id)) return result(false, '只有出借方可以解除违约贷款并处置冻结');
      transferLoanCollateral(world, contract, now, runtimeIndex);
      return result(true, '违约贷款已解除，冻结工厂已按违约确认时快照处置');
    }
    if (contract.kind === 'facility_lease') {
      if (Number(contract.lessorId) !== Number(user.id)) return result(false, '只有出租方可以解除违约租赁并领取违约金');
      const lessee = playerFor(world, contract.lesseeId);
      const lessor = playerFor(world, contract.lessorId);
      if (!lessee || !lessor) return result(false, '合同参与者不存在');
      claimLeaseDefault(contract, lessee, lessor, now, runtimeIndex);
      return result(true, '租赁合同已解除，承租方违约保证金已领取');
    }
  }
  if (action === 'repayPlayerLoan') {
    if (!contract || contract.kind !== 'loan' || Number(contract.borrowerId) !== Number(user.id)) return result(false, '只有借款方可以还款');
    return repayLoan(world, contract, playerFor(world, user.id), now, runtimeIndex, false)
      ? result(true, '玩家贷款已全部偿还') : result(false, '可用资金不足以偿还本金和利息');
  }
  if (action === 'setPlayerLoanAutoRepay') {
    if (!contract || contract.kind !== 'loan' || Number(contract.borrowerId) !== Number(user.id)) return result(false, '只有借款方可以修改自动还款');
    runtimeIndex.transition(contract, () => { contract.autoRepay = payload.enabled === true; commercialAliases(contract); });
    return result(true, contract.autoRepay ? '自动还款已开启' : '自动还款已关闭');
  }
  if (action === 'fundFacilityLease') {
    if (!contract || contract.kind !== 'facility_lease' || Number(contract.lesseeId) !== Number(user.id)) return result(false, '只有承租方可以补充租金');
    return reserveLeaseRent(contract, playerFor(world, user.id)) ? result(true, '本期租金已进入托管') : result(false, '可用资金不足');
  }
  if (action === 'setFacilityLeaseAutoFund') {
    if (!contract || contract.kind !== 'facility_lease' || Number(contract.lesseeId) !== Number(user.id)) return result(false, '只有承租方可以修改自动补租');
    runtimeIndex.transition(contract, () => { contract.autoFund = payload.enabled === true; if (contract.autoFund) reserveLeaseRent(contract, playerFor(world, user.id)); commercialAliases(contract); });
    return result(true, contract.autoFund ? '自动补充租金已开启' : '自动补充租金已关闭');
  }
  if (action === 'requestProductionContractTermination') {
    if (!contract) return null;
    runtimeIndex.transition(contract, () => { contract.terminationRequestedBy = Number(user.id); contract.terminationRequestedAt = now; commercialAliases(contract); });
    return result(true, contract.kind === 'loan' ? '贷款合同不能提前免除债务，申请已记录' : '租赁将在当前租期完成后结束');
  }
  if (action === 'terminateProductionContractNow') {
    if (!contract) return null;
    if (contract.kind === 'loan') return result(false, '贷款合同必须通过还款或到期处置结束');
    const lessee = playerFor(world, contract.lesseeId);
    const lessor = playerFor(world, contract.lessorId);
    if (!lessee || !lessor) return result(false, '合同参与者不存在');
    runtimeIndex.transition(contract, () => {
      releaseFrozenCredits(lessee, contract.lesseeEscrowCredits);
      if (Number(user.id) === Number(contract.lesseeId)) {
        transferFrozenCredits(lessee, lessor, contract.lesseeBondCredits);
        releaseFrozenCredits(lessor, contract.lessorBondCredits);
        contract.lastCompensation = contract.lesseeBondCredits;
        contract.lastCompensationFromId = Number(lessee.userId);
        contract.lastCompensationToId = Number(lessor.userId);
      } else {
        releaseFrozenCredits(lessee, contract.lesseeBondCredits);
        transferFrozenCredits(lessor, lessee, contract.lessorBondCredits);
        contract.lastCompensation = contract.lessorBondCredits;
        contract.lastCompensationFromId = Number(lessor.userId);
        contract.lastCompensationToId = Number(lessee.userId);
      }
      contract.lesseeEscrowCredits = 0; contract.lesseeBondCredits = 0; contract.lessorBondCredits = 0;
      contract.status = 'terminated'; contract.terminationReason = 'immediate_by_participant'; contract.endedAt = now; contract.nextDueAt = null;
      commercialAliases(contract);
    });
    return result(true, '租赁已立即终止，违约保证金已支付给对方');
  }
  return null;
}

export function commercialIssue(contract, userId = null) {
  if (contract.status !== 'active') return null;
  if (contract.breachedAt && String(contract.terminationReason || '').endsWith('_default')) {
    const claimantId = contract.kind === 'loan' ? contract.lenderId : contract.lessorId;
    if (Number(claimantId) === Number(userId)) {
      return contract.kind === 'loan'
        ? '借款方已违约，请主动解除贷款并处置冻结'
        : '承租方已违约，请主动解除租赁并领取违约金';
    }
    return '合同已确认违约，等待受偿方解除合同';
  }
  if (contract.graceEndsAt) return contract.kind === 'loan' ? '贷款已进入还款宽限期' : '租金不足，租赁使用权已暂停';
  if (contract.kind === 'loan') return contract.autoRepay ? null : '自动还款已关闭，请在到期前手动还款';
  if (contract.kind === 'facility_lease' && contract.lesseeEscrowCredits < contract.rentPerPeriod) return '等待承租方补充本期租金';
  return null;
}

export function publicCommercialContract(world, contract, userId) {
  const view = commercialAliases(structuredClone(contract));
  view.publisherName = playerDisplayName(world, view.publisherId);
  if (view.kind === 'loan') {
    view.lenderName = optionalPlayerDisplayName(world, view.lenderId);
    view.borrowerName = optionalPlayerDisplayName(world, view.borrowerId);
    view.buyerName = view.borrowerName;
    view.supplierName = view.lenderName;
  } else if (view.kind === 'facility_lease') {
    view.lessorName = optionalPlayerDisplayName(world, view.lessorId);
    view.lesseeName = optionalPlayerDisplayName(world, view.lesseeId);
    view.buyerName = view.lesseeName;
    view.supplierName = view.lessorName;
  }
  return {
    ...view,
    issue: commercialIssue(contract, userId),
    isPublisher: Number(contract.publisherId) === Number(userId),
    isBuyer: Number(contract.buyerId) === Number(userId),
    isSupplier: Number(contract.supplierId) === Number(userId),
    isLender: Number(contract.lenderId) === Number(userId),
    isBorrower: Number(contract.borrowerId) === Number(userId),
    isLessor: Number(contract.lessorId) === Number(userId),
    isLessee: Number(contract.lesseeId) === Number(userId),
    isParticipant: [contract.buyerId, contract.supplierId].some((id) => Number(id) === Number(userId)),
  };
}
