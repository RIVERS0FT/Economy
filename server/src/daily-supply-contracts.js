import { adoptLegacyCommodityFreeze, consumeCommodityFreeze, freezeCommodity, releaseCommodityFreeze } from './commodity-freezes.js';
import { randomUUID } from 'node:crypto';
import { PRODUCT_CATALOG } from './product-catalog.js';
import { calculateCumulativeMarketSellFee } from './market-sell-fee.js';
import { internalMoneyToMicros, multiplyMoneyByInteger, normalizePlayerMoneyInput, roundInternalMoney } from './money.js';
import { creditPopulationEmployment } from './population-economy.js';
import {
  DEFAULT_PROVINCE_ID,
  inventoryForProvince,
  normalizeProvinceId,
  PROVINCE_CATALOG,
  provinceScopedKey,
} from './provinces.js';
import { provinceUnlockError } from './province-access.js';
import { optionalPlayerDisplayName, playerDisplayName } from './player-identity.js';

const retainedDailyContracts = new WeakMap();
function currentContracts(world) {
  const retained = retainedDailyContracts.get(world);
  return retained ? [...(world.productionContracts || []), ...retained] : (world.productionContracts || []);
}

/** Existing daily objects remain reachable while the legacy scheduler isolates its own contracts. */
export function withDailySupplyContext(world, contracts, callback) {
  const previous = retainedDailyContracts.get(world);
  retainedDailyContracts.set(world, contracts);
  try { return callback(); }
  finally {
    if (previous) retainedDailyContracts.set(world, previous);
    else retainedDailyContracts.delete(world);
  }
}

export const CONTRACT_DAY_MS = 24 * 60 * 60 * 1000;
export const CONTRACT_DAY_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAILY_SUPPLY_CONTRACT_SCHEMA_VERSION = 11;

const OFFER_TTL_MS = 7 * CONTRACT_DAY_MS;
const NEGOTIATION_TTL_MS = CONTRACT_DAY_MS;
const BOND_RATE = 0.2;
const MAX_DAILY_QUANTITY = 1_000_000;
const MAX_UNIT_PRICE = 1_000_000;
const MAX_DURATION_DAYS = 3650;
const MAX_START_DELAY_DAYS = 365;
const MAX_NEGOTIATIONS_PER_CONTRACT = 3;
const MAX_NEGOTIATION_REVISIONS = 5;
const MAX_OPEN_CONTRACTS_PER_PLAYER = 10;
const MAX_ACTIVE_CONTRACTS_PER_PLAYER = 20;
const PRODUCT_IDS = new Set(PRODUCT_CATALOG.map((product) => product.id));
const PROVINCE_IDS = new Set(PROVINCE_CATALOG.map((province) => province.id));

const result = (ok, message) => ({ ok, message });
const safeInteger = (value, fallback = 0) => {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) ? normalized : fallback;
};
const nonNegativeInteger = (value) => Math.max(0, safeInteger(value, 0));
const positiveInteger = (value, max = Number.MAX_SAFE_INTEGER) => {
  const normalized = safeInteger(value, 0);
  return normalized >= 1 && normalized <= max ? normalized : null;
};
function optionalDurationDays(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = positiveInteger(value, MAX_DURATION_DAYS);
  return normalized === null ? undefined : normalized;
}
const positiveMoney = (value) => normalizePlayerMoneyInput(value, { min: 0.01, max: MAX_UNIT_PRICE });
const dayKey = (now) => Math.floor((Math.max(0, Number(now) || 0) + CONTRACT_DAY_OFFSET_MS) / CONTRACT_DAY_MS);
const nextDayAt = (now) => (dayKey(now) + 1) * CONTRACT_DAY_MS - CONTRACT_DAY_OFFSET_MS;
const playerFor = (world, userId) => world.players?.[String(userId)] || null;
const addMoney = (...values) => roundInternalMoney(values.reduce((sum, value) => sum + Number(value || 0), 0)) || 0;
const mutableInventory = (player, productId, provinceId) => inventoryForProvince(player, productId, provinceId);

function freezeCredits(player, amount) {
  const target = Math.max(0, roundInternalMoney(amount || 0) || 0);
  if (target <= 0) return true;
  if (!player || Number(player.credits || 0) + 0.0000001 < target) return false;
  player.credits = Math.max(0, roundInternalMoney(Number(player.credits || 0) - target) || 0);
  player.frozenCredits = addMoney(player.frozenCredits, target);
  return true;
}
function consumeFrozenCredits(player, amount) {
  const target = Math.max(0, roundInternalMoney(amount || 0) || 0);
  if (!player || target <= 0) return 0;
  const consumed = Math.min(target, Math.max(0, roundInternalMoney(player.frozenCredits || 0) || 0));
  player.frozenCredits = Math.max(0, roundInternalMoney(Number(player.frozenCredits || 0) - consumed) || 0);
  return consumed;
}
function releaseFrozenCredits(player, amount) {
  const released = consumeFrozenCredits(player, amount);
  if (released > 0) player.credits = addMoney(player.credits, released);
  return released;
}
function transferFrozenCredits(from, to, amount) {
  const transferred = consumeFrozenCredits(from, amount);
  if (transferred > 0) to.credits = addMoney(to.credits, transferred);
  return transferred;
}
const dailyGross = (contract) => multiplyMoneyByInteger(contract.unitPrice, contract.dailyMaxQuantity) || 0;
const dailyRemaining = (contract) => Math.max(0, nonNegativeInteger(contract.dailyMaxQuantity) - nonNegativeInteger(contract.dailyUsedQuantity));
const bondAmount = (contract) => Math.max(0, roundInternalMoney(dailyGross(contract) * BOND_RATE) || 0);

function normalizePrioritySupply(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const minContractPrice = Number(source.minContractPrice || 0);
  return {
    enabled: source.enabled === true,
    minDailyProduction: nonNegativeInteger(source.minDailyProduction),
    minContractPrice: Number.isFinite(minContractPrice) ? Math.max(0, Math.min(MAX_UNIT_PRICE, Math.floor(minContractPrice * 100) / 100)) : 0,
  };
}
function productionRecordFor(player, provinceId, productId, now, create = false) {
  const key = provinceScopedKey(provinceId, productId);
  const currentDayKey = dayKey(now);
  player.dailyProductProduction ||= {};
  let record = player.dailyProductProduction[key];
  if (!record || Number(record.dayKey) !== currentDayKey) {
    if (!create) return { dayKey: currentDayKey, quantity: 0 };
    record = { dayKey: currentDayKey, quantity: 0 };
    player.dailyProductProduction[key] = record;
  }
  return record;
}
export function recordDailyProductProduction(player, provinceId, productId, quantity, now = Date.now()) {
  if (!player) return 0;
  const amount = nonNegativeInteger(quantity);
  if (amount <= 0) return 0;
  const record = productionRecordFor(player, provinceId, productId, now, true);
  record.quantity = Math.min(Number.MAX_SAFE_INTEGER, nonNegativeInteger(record.quantity) + amount);
  return record.quantity;
}
function priorityEligible(contract, supplier, now) {
  const policy = normalizePrioritySupply(contract.prioritySupply);
  if (!policy.enabled) return true;
  if (Number(contract.unitPrice || 0) + 0.0000001 < policy.minContractPrice) return false;
  return productionRecordFor(supplier, contract.provinceId, contract.productId, now, false).quantity >= policy.minDailyProduction;
}
function normalizeTerms(contract, value = {}) {
  const dailyMaxQuantity = positiveInteger(value.dailyMaxQuantity ?? value.quantityPerDelivery ?? contract.dailyMaxQuantity, MAX_DAILY_QUANTITY);
  const unitPrice = positiveMoney(value.unitPrice ?? contract.unitPrice);
  const durationDays = optionalDurationDays(value.durationDays ?? value.totalDeliveries ?? contract.durationDays);
  const startDelayDays = nonNegativeInteger(value.startDelayDays ?? contract.startDelayDays);
  if (!dailyMaxQuantity || !unitPrice || durationDays === undefined || startDelayDays > MAX_START_DELAY_DAYS) return null;
  return { dailyMaxQuantity, unitPrice, durationDays, startDelayDays };
}
function normalizeNegotiations(contract, negotiations, now) {
  if (!Array.isArray(negotiations)) return [];
  const ids = new Set();
  const proposers = new Set();
  return negotiations.flatMap((item) => {
    const proposerId = Number(item?.proposerId);
    const lastActionBy = Number(item?.lastActionBy);
    const terms = normalizeTerms(contract, item?.terms || {});
    if (!Number.isSafeInteger(proposerId) || proposerId <= 0 || !Number.isSafeInteger(lastActionBy) || lastActionBy <= 0 || !terms) return [];
    const id = String(item?.id || `daily-supply-negotiation-${randomUUID()}`);
    if (ids.has(id) || proposers.has(proposerId)) return [];
    ids.add(id); proposers.add(proposerId);
    return [{ id, proposerId, lastActionBy, revision: Math.max(1, Math.min(MAX_NEGOTIATION_REVISIONS, positiveInteger(item?.revision, MAX_NEGOTIATION_REVISIONS) || 1)), terms, createdAt: Math.max(0, Number(item?.createdAt || now)), updatedAt: Math.max(0, Number(item?.updatedAt || item?.createdAt || now)), expiresAt: Math.max(0, Number(item?.expiresAt || now + NEGOTIATION_TTL_MS)) }];
  }).slice(0, MAX_NEGOTIATIONS_PER_CONTRACT);
}
function applyAliases(contract) {
  contract.quantityPerDelivery = nonNegativeInteger(contract.dailyMaxQuantity);
  contract.batchGross = dailyGross(contract);
  contract.deliveryIntervalMs = CONTRACT_DAY_MS;
  contract.totalDeliveries = contract.durationDays;
  contract.completedDeliveries = nonNegativeInteger(contract.completedDeliveryEvents);
  contract.firstDeliveryDelayMs = nonNegativeInteger(contract.startDelayDays) * CONTRACT_DAY_MS;
  const remaining = dailyRemaining(contract);
  contract.dailyRemainingQuantity = remaining;
  const remainingGross = multiplyMoneyByInteger(contract.unitPrice, remaining) || 0;
  contract.roundStatus = contract.buyerEscrowCredits >= remainingGross && contract.supplierReservedQuantity >= remaining ? 'ready' : 'preparing';
  return contract;
}
export function isDailySupplyContract(contract) { return contract?.kind === 'supply' && contract?.supplyMode === 'daily'; }

function normalizeDailyContract(contract, now = Date.now()) {
  const createdAt = Math.max(0, Number(contract?.createdAt || now));
  const dailyMaxQuantity = positiveInteger(contract?.dailyMaxQuantity ?? contract?.quantityPerDelivery, MAX_DAILY_QUANTITY) || 1;
  const durationCandidate = optionalDurationDays(contract?.durationDays ?? contract?.totalDeliveries);
  const durationDays = durationCandidate === undefined ? null : durationCandidate;
  const startDelayDays = Math.min(MAX_START_DELAY_DAYS, nonNegativeInteger(contract?.startDelayDays ?? Math.round(Number(contract?.firstDeliveryDelayMs || 0) / CONTRACT_DAY_MS)));
  const acceptedAt = contract?.acceptedAt === undefined ? undefined : Math.max(0, Number(contract.acceptedAt));
  const startsAt = contract?.startsAt == null ? (acceptedAt === undefined ? null : acceptedAt + startDelayDays * CONTRACT_DAY_MS) : Math.max(0, Number(contract.startsAt));
  const endsAt = durationDays === null || startsAt === null ? null : Math.max(startsAt, Number(contract?.endsAt || startsAt + durationDays * CONTRACT_DAY_MS));
  const normalized = {
    ...contract,
    id: String(contract?.id || `daily-supply-${randomUUID()}`), kind: 'supply', supplyMode: 'daily', contractSchemaVersion: DAILY_SUPPLY_CONTRACT_SCHEMA_VERSION,
    publisherRole: contract?.publisherRole === 'supplier' ? 'supplier' : 'buyer', publisherSide: contract?.publisherRole === 'supplier' ? 'supplier' : 'buyer',
    publisherId: Number(contract?.publisherId), buyerId: contract?.buyerId == null ? null : Number(contract.buyerId), supplierId: contract?.supplierId == null ? null : Number(contract.supplierId),
    provinceId: normalizeProvinceId(contract?.provinceId), productId: String(contract?.productId || ''), dailyMaxQuantity, unitPrice: positiveMoney(contract?.unitPrice) || 0.01,
    durationDays, startDelayDays, currentDayKey: Number.isSafeInteger(Number(contract?.currentDayKey)) ? Number(contract.currentDayKey) : dayKey(now),
    dailyUsedQuantity: Math.min(dailyMaxQuantity, nonNegativeInteger(contract?.dailyUsedQuantity)), totalDeliveredQuantity: nonNegativeInteger(contract?.totalDeliveredQuantity), completedDeliveryEvents: nonNegativeInteger(contract?.completedDeliveryEvents ?? contract?.completedDeliveries),
    createdAt, offerExpiresAt: Math.max(0, Number(contract?.offerExpiresAt || createdAt + OFFER_TTL_MS)), acceptedAt, startsAt, endsAt,
    nextDueAt: contract?.nextDueAt == null ? null : Math.max(0, Number(contract.nextDueAt)), buyerEscrowCredits: Math.max(0, roundInternalMoney(contract?.buyerEscrowCredits || 0) || 0), supplierReservedQuantity: nonNegativeInteger(contract?.supplierReservedQuantity),
    buyerBondCredits: Math.max(0, roundInternalMoney(contract?.buyerBondCredits || 0) || 0), supplierBondCredits: Math.max(0, roundInternalMoney(contract?.supplierBondCredits || 0) || 0), buyerAutoFund: contract?.buyerAutoFund !== false, supplierAutoReserve: contract?.supplierAutoReserve !== false,
    prioritySupply: normalizePrioritySupply(contract?.prioritySupply), negotiations: normalizeNegotiations(contract, contract?.negotiations, now),
    status: ['open', 'active', 'completed', 'cancelled', 'terminated', 'expired'].includes(contract?.status) ? contract.status : 'open', graceEndsAt: undefined,
  };
  delete normalized.publisherName; delete normalized.buyerName; delete normalized.supplierName;
  return applyAliases(normalized);
}
function releaseSupplierGoods(contract, supplier) {
  if (!supplier || contract.supplierReservedQuantity <= 0) return 0;
  const inventory = mutableInventory(supplier, contract.productId, contract.provinceId);
  const quantity = Math.min(nonNegativeInteger(contract.supplierReservedQuantity), nonNegativeInteger(inventory.frozen));
  adoptLegacyCommodityFreeze(inventory, 'contract', contract.id, contract.supplierReservedQuantity);
  releaseCommodityFreeze(inventory, 'contract', contract.id, quantity);
  contract.supplierReservedQuantity = Math.max(0, contract.supplierReservedQuantity - quantity);
  return quantity;
}
function releaseDailyEscrow(contract, buyer) {
  const released = releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
  contract.buyerEscrowCredits = Math.max(0, roundInternalMoney(contract.buyerEscrowCredits - released) || 0);
  return released;
}
function releaseAssets(contract, buyer, supplier, releaseBonds = true) {
  if (buyer) releaseDailyEscrow(contract, buyer);
  releaseSupplierGoods(contract, supplier);
  if (releaseBonds) {
    if (buyer) releaseFrozenCredits(buyer, contract.buyerBondCredits);
    if (supplier) releaseFrozenCredits(supplier, contract.supplierBondCredits);
    contract.buyerBondCredits = 0; contract.supplierBondCredits = 0;
  }
  applyAliases(contract);
}
function reserveBuyerCredits(contract, buyer) {
  if (!buyer) return false;
  const target = multiplyMoneyByInteger(contract.unitPrice, dailyRemaining(contract)) || 0;
  const required = Math.max(0, roundInternalMoney(target - contract.buyerEscrowCredits) || 0);
  if (required <= 0) return true;
  if (!freezeCredits(buyer, required)) return false;
  contract.buyerEscrowCredits = addMoney(contract.buyerEscrowCredits, required); applyAliases(contract); return true;
}
function reserveSupplierGoods(contract, supplier, now, ignorePriority = false) {
  if (!supplier || (!ignorePriority && !priorityEligible(contract, supplier, now))) return false;
  const required = Math.max(0, dailyRemaining(contract) - nonNegativeInteger(contract.supplierReservedQuantity));
  if (required <= 0) return true;
  const inventory = mutableInventory(supplier, contract.productId, contract.provinceId);
  const amount = Math.min(required, nonNegativeInteger(inventory.available));
  if (amount <= 0) return false;
  adoptLegacyCommodityFreeze(inventory, 'contract', contract.id, contract.supplierReservedQuantity);
  freezeCommodity(inventory, 'contract', contract.id, amount);
  contract.supplierReservedQuantity += amount; applyAliases(contract);
  return contract.supplierReservedQuantity >= dailyRemaining(contract);
}
function resetDailyWindow(contract, buyer, supplier, now) {
  const current = dayKey(now);
  if (Number(contract.currentDayKey) === current) return false;
  if (buyer) releaseDailyEscrow(contract, buyer); releaseSupplierGoods(contract, supplier);
  contract.currentDayKey = current; contract.dailyUsedQuantity = 0;
  if (contract.buyerAutoFund) reserveBuyerCredits(contract, buyer);
  if (contract.supplierAutoReserve) reserveSupplierGoods(contract, supplier, now);
  applyAliases(contract); return true;
}
const contractIsStarted = (contract, now) => contract.startsAt !== null && Number(now) >= Number(contract.startsAt);
function processOne(world, contract, now) {
  const buyer = playerFor(world, contract.buyerId); const supplier = playerFor(world, contract.supplierId);
  contract.negotiations = normalizeNegotiations(contract, contract.negotiations, now).filter((item) => item.expiresAt > now);
  if (contract.status === 'open') {
    if (now >= contract.offerExpiresAt) { contract.status = 'expired'; contract.endedAt = now; contract.nextDueAt = null; contract.negotiations = []; }
    return applyAliases(contract);
  }
  if (contract.status !== 'active') return applyAliases(contract);
  if (!buyer || !supplier) { releaseAssets(contract, buyer, supplier); contract.status = 'terminated'; contract.terminationReason = 'participant_missing'; contract.endedAt = now; contract.nextDueAt = null; return applyAliases(contract); }
  if (!contractIsStarted(contract, now)) { contract.nextDueAt = contract.startsAt; return applyAliases(contract); }
  if (contract.endsAt !== null && now >= contract.endsAt) { releaseAssets(contract, buyer, supplier); contract.status = 'completed'; contract.completedAt = contract.endsAt; contract.endedAt = contract.endsAt; contract.nextDueAt = null; return applyAliases(contract); }
  resetDailyWindow(contract, buyer, supplier, now);
  if (contract.terminationRequestedBy && dayKey(now) > Number(contract.terminationRequestedDayKey)) { releaseAssets(contract, buyer, supplier); contract.status = 'completed'; contract.terminationReason = 'termination_requested'; contract.completedAt = now; contract.endedAt = now; contract.nextDueAt = null; return applyAliases(contract); }
  if (contract.buyerAutoFund) reserveBuyerCredits(contract, buyer);
  if (contract.supplierAutoReserve) reserveSupplierGoods(contract, supplier, now);
  contract.nextDueAt = Math.min(nextDayAt(now), contract.endsAt ?? Number.POSITIVE_INFINITY); if (!Number.isFinite(contract.nextDueAt)) contract.nextDueAt = nextDayAt(now);
  return applyAliases(contract);
}
export function migrateDailySupplyContracts(world, now = Date.now()) {
  world.productionContracts ||= [];
  world.productionContracts = world.productionContracts.map((contract) => (
    isDailySupplyContract(contract) ? normalizeDailyContract(contract, now) : contract
  ));
  return world;
}
export function processDailySupplyContracts(world, now = Date.now()) {
  migrateDailySupplyContracts(world, now);
  for (const contract of world.productionContracts || []) if (isDailySupplyContract(contract)) processOne(world, contract, now);
  return world;
}
export function allocateDailySupplyReservesForSupplier(world, supplierId, provinceId = null, productId = null, now = Date.now(), { process = true } = {}) {
  const matches = (contract) => isDailySupplyContract(contract)
    && contract.status === 'active'
    && contractIsStarted(contract, now)
    && (contract.endsAt == null || now < contract.endsAt)
    && Number(contract.currentDayKey) === dayKey(now)
    && contract.supplierAutoReserve
    && Number(contract.supplierId) === Number(supplierId)
    && (provinceId === null || normalizeProvinceId(contract.provinceId) === normalizeProvinceId(provinceId))
    && (productId === null || String(contract.productId) === String(productId));
  const beforeReserved = new Map(currentContracts(world)
    .filter(matches)
    .map((contract) => [String(contract.id), nonNegativeInteger(contract.supplierReservedQuantity)]));
  if (process) processDailySupplyContracts(world, now);
  const supplier = playerFor(world, supplierId);
  if (!supplier) return 0;
  const contracts = currentContracts(world)
    .filter(matches)
    .sort((left, right) => Number(priorityEligible(right, supplier, now)) - Number(priorityEligible(left, supplier, now))
      || Number(right.unitPrice) - Number(left.unitPrice)
      || Number(left.acceptedAt || 0) - Number(right.acceptedAt || 0)
      || String(left.id).localeCompare(String(right.id)));
  for (const contract of contracts) reserveSupplierGoods(contract, supplier, now);
  return contracts.reduce((sum, contract) => (
    sum + Math.max(0, nonNegativeInteger(contract.supplierReservedQuantity) - (beforeReserved.get(String(contract.id)) || 0))
  ), 0);
}
function normalizeStats(player) {
  player.stats ||= {};
  for (const key of ['contractDeliveriesCompleted','contractGoodsSupplied','contractGoodsPurchased','boughtGoods','soldGoods','commodityVolume']) player.stats[key] = nonNegativeInteger(player.stats[key]);
  for (const key of ['contractCreditsPaid','contractCreditsReceived','marketServiceFees','employmentPayments']) player.stats[key] = Math.max(0, roundInternalMoney(player.stats[key] || 0) || 0);
  return player.stats;
}
function settleQuantity(world, contract, quantity, now, preparedOnly = false) {
  const buyer = playerFor(world, contract.buyerId); const supplier = playerFor(world, contract.supplierId);
  if (!buyer || !supplier) return 0;
  if (!preparedOnly) processOne(world, contract, now);
  if (contract.status !== 'active' || !contractIsStarted(contract, now)
    || (contract.endsAt != null && now >= contract.endsAt)) return 0;
  if (!preparedOnly) {
    if (contract.buyerAutoFund) reserveBuyerCredits(contract, buyer);
    if (contract.supplierAutoReserve) reserveSupplierGoods(contract, supplier, now);
  }
  const affordable = contract.unitPrice > 0 ? Math.floor((Number(contract.buyerEscrowCredits || 0) + 0.0000001) / contract.unitPrice) : 0;
  const amount = Math.min(nonNegativeInteger(quantity), dailyRemaining(contract), nonNegativeInteger(contract.supplierReservedQuantity), nonNegativeInteger(affordable)); if (amount <= 0) return 0;
  const gross = multiplyMoneyByInteger(contract.unitPrice, amount); if (gross === null || gross <= 0) return 0;
  const supplierInventory = mutableInventory(supplier, contract.productId, contract.provinceId); const buyerInventory = mutableInventory(buyer, contract.productId, contract.provinceId);
  if (supplierInventory.frozen < amount || contract.buyerEscrowCredits + 0.0000001 < gross) return 0;
  adoptLegacyCommodityFreeze(supplierInventory, 'contract', contract.id, contract.supplierReservedQuantity);
  consumeCommodityFreeze(supplierInventory, 'contract', contract.id, amount);
  buyerInventory.available = nonNegativeInteger(buyerInventory.available) + amount; contract.supplierReservedQuantity -= amount;
  const paid = consumeFrozenCredits(buyer, gross); contract.buyerEscrowCredits = Math.max(0, roundInternalMoney(contract.buyerEscrowCredits - paid) || 0);
  const previousGross = Math.max(0, roundInternalMoney(contract.marketSellFeeGross || 0) || 0); const previousFee = Math.max(0, roundInternalMoney(contract.marketSellFeeCharged || 0) || 0); const nextGross = addMoney(previousGross, gross); const nextFee = calculateCumulativeMarketSellFee(nextGross); const fee = Math.max(0, roundInternalMoney(nextFee - previousFee) || 0); const net = Math.max(0, roundInternalMoney(gross - fee) || 0);
  supplier.credits = addMoney(supplier.credits, net); if (fee > 0) creditPopulationEmployment(world, fee, 'marketService'); contract.marketSellFeeGross = nextGross; contract.marketSellFeeCharged = nextFee;
  contract.dailyUsedQuantity += amount; contract.totalDeliveredQuantity += amount; contract.completedDeliveryEvents += 1; contract.lastDeliveryQuantity = amount; contract.lastDeliveryGross = gross; contract.lastDeliveryFee = fee; contract.lastDeliveryAt = now;
  const bs = normalizeStats(buyer); const ss = normalizeStats(supplier); bs.contractDeliveriesCompleted += 1; ss.contractDeliveriesCompleted += 1; bs.contractGoodsPurchased += amount; ss.contractGoodsSupplied += amount; bs.contractCreditsPaid = addMoney(bs.contractCreditsPaid, gross); ss.contractCreditsReceived = addMoney(ss.contractCreditsReceived, net); bs.boughtGoods += amount; ss.soldGoods += amount; bs.commodityVolume += amount; ss.commodityVolume += amount; ss.marketServiceFees = addMoney(ss.marketServiceFees, fee); ss.employmentPayments = addMoney(ss.employmentPayments, fee);
  if (!preparedOnly) {
    if (contract.buyerAutoFund) reserveBuyerCredits(contract, buyer);
    if (contract.supplierAutoReserve) reserveSupplierGoods(contract, supplier, now);
  }
  applyAliases(contract); contract.quantityPerDelivery = amount; contract.batchGross = gross; return amount;
}
/** Quotes only real, already-funded and already-frozen contract stock; never future quotas. */
export function quotePreparedDailySupply(world, buyerId, provinceId, productId, requested, marketPrice, now) {
  let remaining = nonNegativeInteger(requested);
  const allocations = [];
  const contracts = currentContracts(world).filter((contract) => (
    isDailySupplyContract(contract) && contract.status === 'active'
    && Number(contract.buyerId) === Number(buyerId)
    && normalizeProvinceId(contract.provinceId) === normalizeProvinceId(provinceId)
    && contract.productId === productId && contractIsStarted(contract, now)
    && (contract.endsAt == null || now < contract.endsAt)
    && Number(contract.currentDayKey) === dayKey(now)
    && Number(contract.unitPrice) < marketPrice
  )).sort((a, b) => a.unitPrice - b.unitPrice || Number(a.acceptedAt || 0) - Number(b.acceptedAt || 0)
    || String(a.id).localeCompare(String(b.id)));
  for (const contract of contracts) {
    if (!remaining) break;
    const supplier = playerFor(world, contract.supplierId);
    const inventory = supplier?.inventories?.[provinceScopedKey(provinceId, productId)];
    const price = internalMoneyToMicros(contract.unitPrice);
    if (!price || price < 0n) continue;
    const funded = (internalMoneyToMicros(contract.buyerEscrowCredits) || 0n) / price;
    const amount = Math.min(remaining, dailyRemaining(contract), nonNegativeInteger(contract.supplierReservedQuantity),
      nonNegativeInteger(inventory?.frozen), Number(funded > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : funded));
    if (amount <= 0) continue;
    allocations.push({ contractId: contract.id, quantity: amount, unitPrice: contract.unitPrice });
    remaining -= amount;
  }
  return { allocations, remaining };
}

export function consumePreparedDailySupply(world, buyerId, allocation, now) {
  const contract = currentContracts(world).find((item) => item.id === allocation.contractId);
  if (!contract || Number(contract.buyerId) !== Number(buyerId)
    || contract.unitPrice !== allocation.unitPrice || Number(contract.currentDayKey) !== dayKey(now)) {
    throw new Error('周期采购合同基线已变化');
  }
  const amount = settleQuantity(world, contract, allocation.quantity, now, true);
  if (amount !== allocation.quantity) throw new Error('周期采购合同未能完整交付');
  return amount;
}

export function consumeDailySupplyForBuyer(world, buyerId, provinceId, productId, quantity, marketUnitPrice, now = Date.now()) {
  processDailySupplyContracts(world, now); let remaining = nonNegativeInteger(quantity); const boundary = Number.isFinite(Number(marketUnitPrice)) ? Number(marketUnitPrice) : Number.POSITIVE_INFINITY; let delivered = 0; let gross = 0; const contractIds = [];
  const contracts = (world.productionContracts || []).filter((contract) => isDailySupplyContract(contract) && contract.status === 'active' && Number(contract.buyerId) === Number(buyerId) && normalizeProvinceId(contract.provinceId) === normalizeProvinceId(provinceId) && String(contract.productId) === String(productId) && contractIsStarted(contract, now) && dailyRemaining(contract) > 0 && Number(contract.unitPrice) < boundary).sort((a,b) => Number(a.unitPrice)-Number(b.unitPrice) || Number(a.acceptedAt||0)-Number(b.acceptedAt||0) || String(a.id).localeCompare(String(b.id)));
  for (const contract of contracts) { if (remaining <= 0) break; const amount = settleQuantity(world, contract, remaining, now); if (amount <= 0) continue; delivered += amount; remaining -= amount; gross = addMoney(gross, multiplyMoneyByInteger(contract.unitPrice, amount) || 0); contractIds.push(contract.id); }
  return { quantity: delivered, gross, contractIds };
}
function createContract(world, user, payload, now) {
  const player = playerFor(world, user.id); if (!player) return result(false, '玩家不存在');
  const rawProvinceId = String(payload.provinceId || ''); if (!PROVINCE_IDS.has(rawProvinceId)) return result(false, '合同地区不存在'); const provinceId = normalizeProvinceId(rawProvinceId); const accessError = provinceUnlockError(player, provinceId); if (accessError) return result(false, accessError);
  const productId = String(payload.productId || ''); const dailyMaxQuantity = positiveInteger(payload.dailyMaxQuantity ?? payload.quantityPerDelivery, MAX_DAILY_QUANTITY); const unitPrice = positiveMoney(payload.unitPrice); const durationDays = optionalDurationDays(payload.durationDays ?? payload.totalDeliveries); const startDelayDays = nonNegativeInteger(payload.startDelayDays ?? 0);
  if (!PRODUCT_IDS.has(productId)) return result(false, '合同商品不存在'); if (!dailyMaxQuantity) return result(false, '每日最大供应量必须为 1 到 1000000 的整数'); if (!unitPrice) return result(false, '固定合同价格无效'); if (durationDays === undefined) return result(false, '合同天数无效'); if (startDelayDays > MAX_START_DELAY_DAYS) return result(false, '延迟开始天数超出允许范围');
  if ((world.productionContracts || []).filter((c) => c?.status === 'open' && Number(c?.publisherId) === Number(user.id)).length >= MAX_OPEN_CONTRACTS_PER_PLAYER) return result(false, '公开合同数量已达上限');
  const publisherRole = payload.publisherRole === 'supplier' ? 'supplier' : 'buyer'; const contract = normalizeDailyContract({ id:`daily-supply-${randomUUID()}`,kind:'supply',supplyMode:'daily',publisherId:Number(user.id),publisherRole,buyerId:publisherRole==='buyer'?Number(user.id):null,supplierId:publisherRole==='supplier'?Number(user.id):null,provinceId,productId,dailyMaxQuantity,unitPrice,durationDays,startDelayDays,status:'open',createdAt:now,offerExpiresAt:now+OFFER_TTL_MS,buyerEscrowCredits:0,supplierReservedQuantity:0,buyerBondCredits:0,supplierBondCredits:0,buyerAutoFund:true,supplierAutoReserve:true,prioritySupply:{enabled:false,minDailyProduction:0,minContractPrice:0},negotiations:[] }, now);
  world.productionContracts ||= []; world.productionContracts.push(contract); return result(true, '每日额度商品合同已发布');
}
function activate(world, contract, counterpartyId, now) {
  contract.buyerId = contract.publisherRole === 'buyer' ? Number(contract.publisherId) : Number(counterpartyId); contract.supplierId = contract.publisherRole === 'supplier' ? Number(contract.publisherId) : Number(counterpartyId); if (contract.buyerId === contract.supplierId) return result(false, '不能与自己签订合同');
  const buyer = playerFor(world, contract.buyerId); const supplier = playerFor(world, contract.supplierId); if (!buyer || !supplier) return result(false, '合同参与方不存在');
  const buyerAccess = provinceUnlockError(buyer, contract.provinceId); const supplierAccess = provinceUnlockError(supplier, contract.provinceId); if (buyerAccess || supplierAccess) return result(false, '双方必须已解锁合同所在地区');
  if ((world.productionContracts || []).filter((c) => c?.status === 'active' && [c?.buyerId,c?.supplierId,c?.lenderId,c?.borrowerId,c?.lessorId,c?.lesseeId].some((id)=>Number(id)===Number(counterpartyId))).length >= MAX_ACTIVE_CONTRACTS_PER_PLAYER) return result(false, '进行中的合同数量已达上限');
  const bond = bondAmount(contract); const gross = dailyGross(contract); if (Number(buyer.credits||0)+0.0000001 < gross+bond) return result(false, '采购方资金不足以冻结首日最高货款和履约保证金'); if (Number(supplier.credits||0)+0.0000001 < bond) return result(false, '供应方资金不足以冻结履约保证金');
  if (!freezeCredits(buyer,bond)) return result(false,'采购方履约保证金冻结失败'); contract.buyerBondCredits=bond; if(!freezeCredits(supplier,bond)){releaseFrozenCredits(buyer,bond);contract.buyerBondCredits=0;return result(false,'供应方履约保证金冻结失败');} contract.supplierBondCredits=bond;
  contract.status='active';contract.acceptedAt=now;contract.startsAt=now+contract.startDelayDays*CONTRACT_DAY_MS;contract.endsAt=contract.durationDays===null?null:contract.startsAt+contract.durationDays*CONTRACT_DAY_MS;contract.currentDayKey=dayKey(contract.startsAt);contract.dailyUsedQuantity=0;contract.negotiations=[];
  if(contract.startDelayDays===0){if(contract.buyerAutoFund)reserveBuyerCredits(contract,buyer);if(contract.supplierAutoReserve)reserveSupplierGoods(contract,supplier,now);} processOne(world,contract,now);return result(true,'每日额度商品合同已签订');
}
function proposeNegotiation(user, contract, payload, now) {
  if (!contract || contract.status !== 'open' || contract.fixedTerms) return result(false,'当前合同不接受议价'); if (Number(contract.publisherId)===Number(user.id)) return result(false,'发布者不能向自己的合同发起议价'); contract.negotiations ||= []; if(contract.negotiations.some((item)=>Number(item.proposerId)===Number(user.id))) return result(false,'你已经有一个进行中的议价'); if(contract.negotiations.length>=MAX_NEGOTIATIONS_PER_CONTRACT)return result(false,'该合同同时进行中的议价已达上限'); const terms=normalizeTerms(contract,payload); if(!terms)return result(false,'议价条款无效'); contract.negotiations.push({id:`daily-supply-negotiation-${randomUUID()}`,proposerId:Number(user.id),lastActionBy:Number(user.id),revision:1,terms,createdAt:now,updatedAt:now,expiresAt:Math.min(contract.offerExpiresAt,now+NEGOTIATION_TTL_MS)}); return result(true,'议价已发送');
}
function counterNegotiation(user,contract,id,payload,now){const n=(contract?.negotiations||[]).find((item)=>item.id===id);if(!contract||contract.status!=='open'||!n)return result(false,'议价不存在或已经结束');const uid=Number(user.id);if(![Number(contract.publisherId),Number(n.proposerId)].includes(uid))return result(false,'你不是该议价参与方');if(Number(n.lastActionBy)===uid)return result(false,'请等待对方回应');if(n.revision>=MAX_NEGOTIATION_REVISIONS)return result(false,'议价轮数已达到上限');const terms=normalizeTerms(contract,payload);if(!terms)return result(false,'议价条款无效');n.revision+=1;n.terms=terms;n.lastActionBy=uid;n.updatedAt=now;n.expiresAt=Math.min(contract.offerExpiresAt,now+NEGOTIATION_TTL_MS);return result(true,'反报价已发送');}
function removeNegotiation(user,contract,id,proposerOnly=false){const index=(contract?.negotiations||[]).findIndex((item)=>item.id===id);if(!contract||contract.status!=='open'||index<0)return result(false,'议价不存在或已经结束');const n=contract.negotiations[index];const publisher=Number(contract.publisherId)===Number(user.id);const proposer=Number(n.proposerId)===Number(user.id);if(proposerOnly?!proposer:(!publisher&&!proposer))return result(false,'你不是该议价参与方');contract.negotiations.splice(index,1);return result(true,proposerOnly?'议价已撤回':'议价已拒绝');}
export function applyDailySupplyContractAction(world,user,action,payload={},now=Date.now()){
  processDailySupplyContracts(world,now); if(action==='createProductionContract')return createContract(world,user,payload,now); const contract=(world.productionContracts||[]).find((item)=>item.id===String(payload.contractId||'')); if(!isDailySupplyContract(contract))return null;
  if(action==='acceptProductionContract'){if(contract.status!=='open'||Number(contract.publisherId)===Number(user.id))return result(false,'合同已无法承接');return activate(world,contract,user.id,now);} if(action==='cancelProductionContract'){if(contract.status!=='open'||Number(contract.publisherId)!==Number(user.id))return result(false,'只有发布者可以取消等待承接的合同');contract.status='cancelled';contract.endedAt=now;contract.nextDueAt=null;contract.negotiations=[];return result(true,'合同已取消');}
  if(action==='prepareProductionContract'){if(contract.status!=='active'||Number(contract.supplierId)!==Number(user.id))return result(false,'只有供应方可以准备当日商品');const before=contract.supplierReservedQuantity;reserveSupplierGoods(contract,playerFor(world,user.id),now,true);const added=contract.supplierReservedQuantity-before;return result(added>0||contract.supplierReservedQuantity>=dailyRemaining(contract),added>0?`已准备 ${added} 件当日合同商品`:'当前没有更多可准备商品');}
  if(action==='fundProductionContract'){if(contract.status!=='active'||Number(contract.buyerId)!==Number(user.id))return result(false,'只有采购方可以补充当日货款');const before=contract.buyerEscrowCredits;const ok=reserveBuyerCredits(contract,playerFor(world,user.id));return result(ok,ok?(contract.buyerEscrowCredits>before?'已补充当日合同货款':'当日合同货款已经充足'):'可用资金不足');}
  if(action==='setProductionContractAutoReserve'){if(contract.status!=='active'||Number(contract.supplierId)!==Number(user.id))return result(false,'只有供应方可以修改供应设置');contract.supplierAutoReserve=payload.enabled!==false;if(payload.prioritySupply)contract.prioritySupply=normalizePrioritySupply(payload.prioritySupply);const supplier=playerFor(world,user.id);if(contract.supplierAutoReserve&&!priorityEligible(contract,supplier,now))releaseSupplierGoods(contract,supplier);if(contract.supplierAutoReserve)reserveSupplierGoods(contract,supplier,now);applyAliases(contract);return result(true,'供应优先条件已保存');}
  if(action==='setProductionContractAutoFund'){if(contract.status!=='active'||Number(contract.buyerId)!==Number(user.id))return result(false,'只有采购方可以修改自动补款');contract.buyerAutoFund=payload.enabled!==false;if(contract.buyerAutoFund)reserveBuyerCredits(contract,playerFor(world,user.id));return result(true,'自动补充当日货款设置已保存');}
  if(action==='requestProductionContractTermination'){if(contract.status!=='active'||![contract.buyerId,contract.supplierId].map(Number).includes(Number(user.id)))return result(false,'只有合同参与方可以申请结束');contract.terminationRequestedBy=Number(user.id);contract.terminationRequestedAt=now;contract.terminationRequestedDayKey=dayKey(now);contract.nextDueAt=nextDayAt(now);return result(true,'合同将在当前自然日结束后正常终止');}
  if(action==='terminateProductionContractNow'){if(contract.status!=='active'||![contract.buyerId,contract.supplierId].map(Number).includes(Number(user.id)))return result(false,'只有合同参与方可以立即终止');const buyer=playerFor(world,contract.buyerId),supplier=playerFor(world,contract.supplierId);releaseDailyEscrow(contract,buyer);releaseSupplierGoods(contract,supplier);if(Number(user.id)===Number(contract.buyerId)){transferFrozenCredits(buyer,supplier,contract.buyerBondCredits);releaseFrozenCredits(supplier,contract.supplierBondCredits);contract.terminationReason='buyer_default';}else{transferFrozenCredits(supplier,buyer,contract.supplierBondCredits);releaseFrozenCredits(buyer,contract.buyerBondCredits);contract.terminationReason='supplier_default';}contract.buyerBondCredits=0;contract.supplierBondCredits=0;contract.status='terminated';contract.breachedAt=now;contract.endedAt=now;contract.nextDueAt=null;return result(true,'合同已立即终止，违约保证金已支付给对方');}
  if(action==='proposeProductionContractNegotiation')return proposeNegotiation(user,contract,payload,now); if(action==='counterProductionContractNegotiation')return counterNegotiation(user,contract,String(payload.negotiationId||''),payload,now); if(action==='rejectProductionContractNegotiation')return removeNegotiation(user,contract,String(payload.negotiationId||'')); if(action==='revokeProductionContractNegotiation')return removeNegotiation(user,contract,String(payload.negotiationId||''),true);
  if(action==='acceptProductionContractNegotiation'){const n=(contract.negotiations||[]).find((item)=>item.id===String(payload.negotiationId||''));if(!n||Number(n.lastActionBy)===Number(user.id)||![Number(contract.publisherId),Number(n.proposerId)].includes(Number(user.id)))return result(false,'当前议价不能接受');Object.assign(contract,n.terms);applyAliases(contract);return activate(world,contract,n.proposerId,now);}
  if(['proposeProductionContractRenewal','acceptProductionContractRenewal','rejectProductionContractRenewal','revokeProductionContractRenewal'].includes(action))return result(false,'每日额度商品合同不使用续签；有限合同结束后可重新发布'); return result(false,'合同操作不存在');
}
function publicNegotiations(world,contract,userId){const publisher=Number(contract.publisherId)===Number(userId);return(contract.negotiations||[]).flatMap((item)=>{const proposer=Number(item.proposerId)===Number(userId);if(!publisher&&!proposer)return[];return[{id:item.id,revision:item.revision,terms:{...item.terms},createdAt:item.createdAt,updatedAt:item.updatedAt,expiresAt:item.expiresAt,proposerName:publisher?optionalPlayerDisplayName(world,item.proposerId):null,isProposer:proposer,awaitingMyResponse:Number(item.lastActionBy)!==Number(userId)}];});}
function issueFor(world,contract,now){if(contract.status!=='active'||!contractIsStarted(contract,now))return null;const buyer=playerFor(world,contract.buyerId),supplier=playerFor(world,contract.supplierId);if(!buyer||!supplier)return'合同参与方状态异常';const remaining=dailyRemaining(contract);const target=multiplyMoneyByInteger(contract.unitPrice,remaining)||0;if(contract.buyerEscrowCredits+Number(buyer.credits||0)+0.0000001<target)return'采购方当日可用货款不足';const inventory=mutableInventory(supplier,contract.productId,contract.provinceId);if(contract.supplierReservedQuantity+inventory.available<remaining)return'供应方当日可用供应量不足';return null;}
export function publicDailySupplyContract(world,contract,userId,now=Date.now()){const isBuyer=Number(contract.buyerId)===Number(userId),isSupplier=Number(contract.supplierId)===Number(userId);return{...applyAliases({...contract}),publisherName:playerDisplayName(world,contract.publisherId),buyerName:optionalPlayerDisplayName(world,contract.buyerId),supplierName:optionalPlayerDisplayName(world,contract.supplierId),dailyRemainingQuantity:dailyRemaining(contract),dailyGrossLimit:dailyGross(contract),issue:issueFor(world,contract,now),isPublisher:Number(contract.publisherId)===Number(userId),isBuyer,isSupplier,isParticipant:isBuyer||isSupplier,negotiations:publicNegotiations(world,contract,userId),prioritySupply:isSupplier?normalizePrioritySupply(contract.prioritySupply):undefined};}
export function dailySupplyContractAvailableHold(world,supplierId,productId,provinceId,now=Date.now()){processDailySupplyContracts(world,now);return(world.productionContracts||[]).filter((c)=>isDailySupplyContract(c)&&c.status==='active'&&c.supplierAutoReserve!==false&&Number(c.supplierId)===Number(supplierId)&&String(c.productId)===String(productId)&&normalizeProvinceId(c.provinceId)===normalizeProvinceId(provinceId)).reduce((sum,c)=>sum+Math.max(0,dailyRemaining(c)-nonNegativeInteger(c.supplierReservedQuantity)),0);}
