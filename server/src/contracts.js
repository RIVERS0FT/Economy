import { adoptLegacyCommodityFreeze, consumeCommodityFreeze, freezeCommodity, releaseCommodityFreeze, transferCommodityFreeze } from './commodity-freezes.js';
import { randomUUID } from 'node:crypto';
import { PRODUCT_CATALOG } from './domain.js';
import { calculateCumulativeMarketSellFee } from './market-sell-fee.js';
import { creditPopulationEmployment } from './population-economy.js';
import { createContractRuntimeIndex } from './contract-runtime-index.js';
import {
  acceptCommercialContract,
  applyCommercialContractAction,
  commercialIssue,
  createCommercialContract,
  normalizeCommercialContract,
  processCommercialContract,
  publicCommercialContract,
} from './commercial-contracts.js';
import { calculateRateMoney, multiplyMoneyByInteger, normalizePlayerMoneyInput, roundInternalMoney } from './money.js';
import { inventoryForProvince } from './provinces.js';
import { optionalPlayerDisplayName, playerDisplayName } from './player-identity.js';

export const PRODUCTION_CONTRACT_SCHEMA_VERSION = 10;
export const PRODUCTION_CONTRACT_INTERVALS = Object.freeze([
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
]);
export const PRODUCTION_CONTRACT_FIRST_DELAYS = Object.freeze([
  0,
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
]);

const MAX_OPEN_CONTRACTS_PER_PLAYER = 10;
const MAX_ACTIVE_CONTRACTS_PER_PLAYER = 20;
const MAX_CONTRACTS = 2_000;
const MAX_VISIBLE_OPEN_CONTRACTS = 200;
const MAX_VISIBLE_RECENT_CONTRACTS = 100;
const MAX_QUANTITY = 1_000_000;
const MAX_UNIT_PRICE = 1_000_000;
const MIN_DELIVERIES = 2;
const MAX_DELIVERIES = 100;
const OFFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RENEWAL_TTL_MS = 24 * 60 * 60 * 1000;
const RENEWAL_WINDOW_DELIVERIES = 3;
const NEGOTIATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_NEGOTIATIONS_PER_CONTRACT = 3;
const MAX_NEGOTIATION_REVISIONS = 5;
const BOND_RATE_BPS = 2_000;
const BASIS_POINTS = 10_000;
const PRODUCT_IDS = new Set(PRODUCT_CATALOG.map((product) => product.id));

function clone(value) {
  return structuredClone(value);
}

function result(ok, message) {
  return { ok, message };
}

function positiveInteger(value, max) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 1 && normalized <= max ? normalized : null;
}

function optionalTotalDeliveries(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = positiveInteger(value, MAX_DELIVERIES);
  return normalized !== null && normalized >= MIN_DELIVERIES ? normalized : undefined;
}

function positiveMoney(value, max) {
  return normalizePlayerMoneyInput(value, { min: 0.01, max });
}

function exactAllowedInteger(value, allowed) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && allowed.includes(normalized) ? normalized : null;
}

function playerFor(world, userId) {
  return world.players?.[String(userId)] || null;
}

function addMoney(...values) {
  return roundInternalMoney(values.reduce((sum, value) => sum + Number(value || 0), 0));
}

function marketReserveGroupFor(world, contract) {
  return world.marketDemand?.liquidity?.groups?.[String(contract?.marketReserveGroupId || '')] || null;
}

function marketReserveProductFor(world, contract) {
  return marketReserveGroupFor(world, contract)?.reserves?.[String(contract?.productId || '')] || null;
}

function holdMarketReserveCredits(group, amount) {
  const target = Math.max(0, roundInternalMoney(amount || 0) || 0);
  if (target <= 0) return true;
  if (!group || Number(group.credits || 0) + 0.0000001 < target) return false;
  group.credits = Math.max(0, roundInternalMoney(Number(group.credits || 0) - target) || 0);
  group.frozenCredits = Math.max(0, roundInternalMoney(Number(group.frozenCredits || 0) + target) || 0);
  return true;
}

function consumeMarketReserveFrozenCredits(group, amount) {
  const target = Math.max(0, roundInternalMoney(amount || 0) || 0);
  if (!group || target <= 0) return 0;
  const consumed = Math.min(target, Math.max(0, roundInternalMoney(group.frozenCredits || 0) || 0));
  group.frozenCredits = Math.max(0, roundInternalMoney(Number(group.frozenCredits || 0) - consumed) || 0);
  return consumed;
}

function releaseMarketReserveCredits(group, amount) {
  const released = consumeMarketReserveFrozenCredits(group, amount);
  if (group && released > 0) group.credits = Math.max(0, roundInternalMoney(Number(group.credits || 0) + released) || 0);
  return released;
}

function transferMarketReserveBondToPlayer(group, player, amount) {
  const transferred = consumeMarketReserveFrozenCredits(group, amount);
  if (player && transferred > 0) player.credits = Math.max(0, roundInternalMoney(Number(player.credits || 0) + transferred) || 0);
  return transferred;
}

function transferPlayerBondToMarketReserve(player, group, amount) {
  const transferred = consumeFrozenCredits(player, amount);
  if (group && transferred > 0) group.credits = Math.max(0, roundInternalMoney(Number(group.credits || 0) + transferred) || 0);
  return transferred;
}

function inventoryFor(player, productId) {
  return inventoryForProvince(player, productId);
}

function normalizeStats(player) {
  player.stats ||= {};
  player.stats.contractDeliveriesCompleted = Math.max(0, Math.floor(Number(player.stats.contractDeliveriesCompleted || 0)));
  player.stats.contractGoodsSupplied = Math.max(0, Math.floor(Number(player.stats.contractGoodsSupplied || 0)));
  player.stats.contractGoodsPurchased = Math.max(0, Math.floor(Number(player.stats.contractGoodsPurchased || 0)));
  player.stats.contractCreditsPaid = Math.max(0, roundInternalMoney(player.stats.contractCreditsPaid || 0) || 0);
  player.stats.contractCreditsReceived = Math.max(0, roundInternalMoney(player.stats.contractCreditsReceived || 0) || 0);
  player.stats.contractDefaults = Math.max(0, Math.floor(Number(player.stats.contractDefaults || 0)));
  player.stats.boughtGoods = Math.max(0, Math.floor(Number(player.stats.boughtGoods || 0)));
  player.stats.soldGoods = Math.max(0, Math.floor(Number(player.stats.soldGoods || 0)));
  player.stats.commodityVolume = Math.max(0, Math.floor(Number(player.stats.commodityVolume || 0)));
  player.stats.marketServiceFees = Math.max(0, roundInternalMoney(player.stats.marketServiceFees || 0) || 0);
  player.stats.employmentPayments = Math.max(0, roundInternalMoney(player.stats.employmentPayments || 0) || 0);
  return player.stats;
}


function normalizeRenewalApprovalAt(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = Math.max(0, Number(value));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
}

function normalizeRenewalProposal(contract, proposal) {
  if (!proposal || typeof proposal !== 'object') return null;
  const status = ['proposed', 'accepted', 'activated'].includes(proposal.status) ? proposal.status : 'proposed';
  const terms = proposal.terms && typeof proposal.terms === 'object' ? proposal.terms : {};
  const proposedBy = Number(proposal.proposedBy);
  const proposedAt = Math.max(0, Number(proposal.proposedAt || contract?.createdAt || Date.now()));
  const legacyAcceptedBy = proposal.acceptedBy === undefined ? undefined : Number(proposal.acceptedBy);
  const legacyAcceptedAt = normalizeRenewalApprovalAt(proposal.acceptedAt);
  let buyerApprovedAt = normalizeRenewalApprovalAt(proposal.buyerApprovedAt);
  let supplierApprovedAt = normalizeRenewalApprovalAt(proposal.supplierApprovedAt);
  if ((status === 'accepted' || status === 'activated') && (!buyerApprovedAt || !supplierApprovedAt)) {
    if (proposedBy === Number(contract?.buyerId)) buyerApprovedAt ||= proposedAt;
    if (proposedBy === Number(contract?.supplierId)) supplierApprovedAt ||= proposedAt;
    if (legacyAcceptedBy === Number(contract?.buyerId)) buyerApprovedAt ||= legacyAcceptedAt || proposedAt;
    if (legacyAcceptedBy === Number(contract?.supplierId)) supplierApprovedAt ||= legacyAcceptedAt || proposedAt;
    buyerApprovedAt ||= legacyAcceptedAt || proposedAt;
    supplierApprovedAt ||= legacyAcceptedAt || proposedAt;
  }
  const confirmedAt = status === 'accepted' || status === 'activated'
    ? normalizeRenewalApprovalAt(proposal.confirmedAt) || legacyAcceptedAt || Math.max(buyerApprovedAt || 0, supplierApprovedAt || 0) || proposedAt
    : undefined;
  return {
    id: String(proposal.id || `contract-renewal-${randomUUID()}`),
    status,
    revision: Math.max(1, Math.floor(Number(proposal.revision || 1))),
    proposedBy,
    proposedAt,
    expiresAt: Math.max(0, Number(proposal.expiresAt || 0)),
    buyerApprovedAt,
    supplierApprovedAt,
    confirmedAt,
    activatedAt: proposal.activatedAt === undefined ? undefined : Math.max(0, Number(proposal.activatedAt)),
    activatedContractId: proposal.activatedContractId ? String(proposal.activatedContractId) : undefined,
    terms: {
      quantityPerDelivery: Math.max(1, Math.floor(Number(terms.quantityPerDelivery || contract?.quantityPerDelivery || 1))),
      unitPrice: positiveMoney(terms.unitPrice ?? contract?.unitPrice ?? 1, MAX_UNIT_PRICE) || 0.01,
      deliveryIntervalMs: Number(terms.deliveryIntervalMs || contract?.deliveryIntervalMs || PRODUCTION_CONTRACT_INTERVALS[2]),
      totalDeliveries: terms.totalDeliveries === null
        ? null
        : Math.max(MIN_DELIVERIES, Math.floor(Number(terms.totalDeliveries || contract?.totalDeliveries || MIN_DELIVERIES))),
      firstDeliveryDelayMs: Math.max(0, Math.floor(Number(terms.firstDeliveryDelayMs || 0))),
    },
    buyerEscrowCredits: Math.max(0, roundInternalMoney(proposal.buyerEscrowCredits || 0) || 0),
    buyerBondCredits: Math.max(0, roundInternalMoney(proposal.buyerBondCredits || 0) || 0),
    supplierBondCredits: Math.max(0, roundInternalMoney(proposal.supplierBondCredits || 0) || 0),
    supplierReservedQuantity: Math.max(0, Math.floor(Number(proposal.supplierReservedQuantity || 0))),
  };
}

function renewalApprovalField(contract, userId) {
  const normalizedUserId = Number(userId);
  if (Number(contract?.buyerId) === normalizedUserId) return 'buyerApprovedAt';
  if (Number(contract?.supplierId) === normalizedUserId) return 'supplierApprovedAt';
  return null;
}

function renewalApprovedBy(contract, proposal, userId) {
  const field = renewalApprovalField(contract, userId);
  return Boolean(field && proposal?.[field]);
}

function normalizeNegotiation(contract, negotiation) {
  if (!negotiation || typeof negotiation !== 'object') return null;
  const proposerId = Number(negotiation.proposerId);
  const lastActionBy = Number(negotiation.lastActionBy);
  const terms = renewalTerms(negotiation.terms || {});
  if (!Number.isSafeInteger(proposerId) || proposerId <= 0 || !Number.isSafeInteger(lastActionBy) || lastActionBy <= 0 || !terms) return null;
  return {
    id: String(negotiation.id || `contract-negotiation-${randomUUID()}`),
    proposerId,
    revision: Math.max(1, Math.min(MAX_NEGOTIATION_REVISIONS, Math.floor(Number(negotiation.revision || 1)))),
    terms,
    lastActionBy,
    createdAt: Math.max(0, Number(negotiation.createdAt || contract?.createdAt || Date.now())),
    updatedAt: Math.max(0, Number(negotiation.updatedAt || negotiation.createdAt || contract?.createdAt || Date.now())),
    expiresAt: Math.max(0, Number(negotiation.expiresAt || 0)),
  };
}

function normalizeNegotiations(contract, negotiations) {
  if (!Array.isArray(negotiations)) return [];
  const seenIds = new Set();
  const seenProposers = new Set();
  return negotiations.flatMap((negotiation) => {
    const normalized = normalizeNegotiation(contract, negotiation);
    if (!normalized || seenIds.has(normalized.id) || seenProposers.has(normalized.proposerId)) return [];
    seenIds.add(normalized.id);
    seenProposers.add(normalized.proposerId);
    return [normalized];
  }).slice(0, MAX_NEGOTIATIONS_PER_CONTRACT);
}

function normalizeContract(contract) {
  const normalized = {
    ...contract,
    id: String(contract?.id || `contract-${randomUUID()}`),
    publisherId: Number(contract?.publisherId),
    publisherName: String(contract?.publisherName || '玩家'),
    publisherType: contract?.publisherType === 'market_reserve' ? 'market_reserve' : 'player',
    fixedTerms: contract?.fixedTerms === true,
    marketReserveGroupId: contract?.marketReserveGroupId ? String(contract.marketReserveGroupId) : null,
    kind: 'supply',
    publisherSide: contract?.publisherRole === 'supplier' ? 'supplier' : 'buyer',
    publisherRole: contract?.publisherRole === 'supplier' ? 'supplier' : 'buyer',
    buyerId: contract?.buyerId === null || contract?.buyerId === undefined ? null : Number(contract.buyerId),
    buyerName: contract?.buyerName ? String(contract.buyerName) : null,
    supplierId: contract?.supplierId === null || contract?.supplierId === undefined ? null : Number(contract.supplierId),
    supplierName: contract?.supplierName ? String(contract.supplierName) : null,
    productId: String(contract?.productId || ''),
    quantityPerDelivery: Math.max(1, Math.floor(Number(contract?.quantityPerDelivery || 1))),
    unitPrice: positiveMoney(contract?.unitPrice ?? 1, MAX_UNIT_PRICE) || 0.01,
    deliveryIntervalMs: Number(contract?.deliveryIntervalMs || PRODUCTION_CONTRACT_INTERVALS[2]),
    totalDeliveries: contract?.totalDeliveries === null
      ? null
      : Math.max(MIN_DELIVERIES, Math.floor(Number(contract?.totalDeliveries || MIN_DELIVERIES))),
    completedDeliveries: Math.max(0, Math.floor(Number(contract?.completedDeliveries || 0))),
    firstDeliveryDelayMs: Math.max(0, Math.floor(Number(contract?.firstDeliveryDelayMs || 0))),
    createdAt: Math.max(0, Number(contract?.createdAt || Date.now())),
    offerExpiresAt: Math.max(0, Number(contract?.offerExpiresAt || 0)),
    acceptedAt: contract?.acceptedAt === undefined ? undefined : Math.max(0, Number(contract.acceptedAt)),
    nextDueAt: contract?.nextDueAt === null || contract?.nextDueAt === undefined ? null : Math.max(0, Number(contract.nextDueAt)),
    graceEndsAt: contract?.graceEndsAt === undefined ? undefined : Math.max(0, Number(contract.graceEndsAt)),
    breachedAt: contract?.breachedAt === undefined ? undefined : Math.max(0, Number(contract.breachedAt)),
    buyerEscrowCredits: Math.max(0, roundInternalMoney(contract?.buyerEscrowCredits || 0) || 0),
    supplierReservedQuantity: Math.max(0, Math.floor(Number(contract?.supplierReservedQuantity || 0))),
    buyerBondCredits: Math.max(0, roundInternalMoney(contract?.buyerBondCredits || 0) || 0),
    supplierBondCredits: Math.max(0, roundInternalMoney(contract?.supplierBondCredits || 0) || 0),
    buyerAutoFund: contract?.buyerAutoFund !== false,
    supplierAutoReserve: contract?.supplierAutoReserve !== false,
    renewalProposal: normalizeRenewalProposal(contract, contract?.renewalProposal),
    negotiations: normalizeNegotiations(contract, contract?.negotiations),
    renewedFromContractId: contract?.renewedFromContractId ? String(contract.renewedFromContractId) : undefined,
    renewedToContractId: contract?.renewedToContractId ? String(contract.renewedToContractId) : undefined,
    renewalCancellationReason: contract?.renewalCancellationReason ? String(contract.renewalCancellationReason) : undefined,
    marketSellFeeGross: Math.max(0, roundInternalMoney(contract?.marketSellFeeGross || 0) || 0),
    marketSellFeeCharged: Math.max(0, roundInternalMoney(contract?.marketSellFeeCharged || 0) || 0),
    status: ['open', 'active', 'completed', 'cancelled', 'terminated', 'expired'].includes(contract?.status)
      ? contract.status
      : 'open',
    roundStatus: ['preparing', 'ready', 'grace'].includes(contract?.roundStatus)
      ? contract.roundStatus
      : 'preparing',
  };
  if (normalized.publisherType === 'market_reserve') {
    normalized.publisherName = String(contract?.publisherName || contract?.buyerName || '市场储备');
    normalized.buyerName = String(contract?.buyerName || normalized.publisherName);
  } else {
    delete normalized.publisherName;
    delete normalized.buyerName;
  }
  delete normalized.supplierName;
  if (!normalized.offerExpiresAt) normalized.offerExpiresAt = normalized.createdAt + OFFER_TTL_MS;
  if (normalized.totalDeliveries !== null
    && normalized.completedDeliveries >= normalized.totalDeliveries
    && normalized.status === 'active') {
    normalized.status = 'completed';
  }
  return normalized;
}

export function migrateProductionContractWorld(world) {
  world.productionContracts = Array.isArray(world.productionContracts)
    ? world.productionContracts.map((contract) => (
      contract?.kind && contract.kind !== 'supply'
        ? normalizeCommercialContract(contract)
        : normalizeContract(contract)
    )).filter(Boolean)
    : [];
  world.productionContractSchemaVersion = PRODUCTION_CONTRACT_SCHEMA_VERSION;
  for (const player of Object.values(world.players || {})) normalizeStats(player);
  return world;
}


function batchGross(contract) {
  const gross = multiplyMoneyByInteger(contract.unitPrice, contract.quantityPerDelivery);
  return gross !== null && gross > 0 ? gross : null;
}

function bondFor(gross) {
  const bond = calculateRateMoney(gross, BOND_RATE_BPS, BASIS_POINTS, 'ceil');
  return bond !== null && bond > 0 ? bond : null;
}

function renewalGross(proposal) {
  const gross = multiplyMoneyByInteger(
    Number(proposal?.terms?.unitPrice || 0),
    Number(proposal?.terms?.quantityPerDelivery || 0),
  );
  return gross !== null && gross > 0 ? gross : null;
}

function renewalTerms(payload) {
  const quantityPerDelivery = positiveInteger(payload.quantityPerDelivery, MAX_QUANTITY);
  const unitPrice = positiveMoney(payload.unitPrice, MAX_UNIT_PRICE);
  const deliveryIntervalMs = exactAllowedInteger(payload.deliveryIntervalMs, PRODUCTION_CONTRACT_INTERVALS);
  const totalDeliveries = optionalTotalDeliveries(payload.totalDeliveries);
  const firstDeliveryDelayMs = exactAllowedInteger(payload.firstDeliveryDelayMs, PRODUCTION_CONTRACT_FIRST_DELAYS);
  if (!quantityPerDelivery || !unitPrice || !deliveryIntervalMs || totalDeliveries === undefined || firstDeliveryDelayMs === null) return null;
  const gross = multiplyMoneyByInteger(unitPrice, quantityPerDelivery);
  if (gross === null || gross <= 0) return null;
  return { quantityPerDelivery, unitPrice, deliveryIntervalMs, totalDeliveries, firstDeliveryDelayMs };
}

function consumeFrozenCredits(player, amount) {
  const normalized = Math.max(0, roundInternalMoney(amount || 0) || 0);
  const consumed = Math.min(normalized, Math.max(0, roundInternalMoney(player.frozenCredits || 0) || 0));
  player.frozenCredits = Math.max(0, roundInternalMoney(Number(player.frozenCredits || 0) - consumed) || 0);
  return consumed;
}

function releaseFrozenCredits(player, amount) {
  const released = consumeFrozenCredits(player, amount);
  player.credits = Math.max(0, roundInternalMoney(Number(player.credits || 0) + released) || 0);
  return released;
}

function transferFrozenCredits(fromPlayer, toPlayer, amount) {
  const transferred = consumeFrozenCredits(fromPlayer, amount);
  toPlayer.credits = Math.max(0, roundInternalMoney(Number(toPlayer.credits || 0) + transferred) || 0);
  return transferred;
}

function releaseSupplierGoods(contract, supplier) {
  const inventory = inventoryFor(supplier, contract.productId);
  const quantity = Math.min(contract.supplierReservedQuantity, Math.max(0, Number(inventory.frozen || 0)));
  adoptLegacyCommodityFreeze(inventory, 'contract', contract.id, contract.supplierReservedQuantity);
  releaseCommodityFreeze(inventory, 'contract', contract.id, quantity);
  contract.supplierReservedQuantity = Math.max(0, contract.supplierReservedQuantity - quantity);
  return quantity;
}

function releaseRenewalEscrow(contract, buyer, supplier, reason = null) {
  const proposal = contract.renewalProposal;
  if (!proposal) return false;
  if (proposal.status === 'accepted') {
    if (buyer) {
      releaseFrozenCredits(buyer, proposal.buyerEscrowCredits);
      releaseFrozenCredits(buyer, proposal.buyerBondCredits);
    }
    if (supplier) {
      releaseFrozenCredits(supplier, proposal.supplierBondCredits);
      const inventory = inventoryFor(supplier, contract.productId);
      const quantity = Math.min(proposal.supplierReservedQuantity, Math.max(0, Number(inventory.frozen || 0)));
      adoptLegacyCommodityFreeze(inventory, 'contract', `${contract.id}:renewal`, proposal.supplierReservedQuantity);
      releaseCommodityFreeze(inventory, 'contract', `${contract.id}:renewal`, quantity);
    }
  }
  if (reason) contract.renewalCancellationReason = reason;
  contract.renewalProposal = null;
  return true;
}

function reserveRenewalSupplierGoods(contract, supplier) {
  const proposal = contract.renewalProposal;
  if (!proposal || proposal.status !== 'accepted') return false;
  const required = proposal.terms.quantityPerDelivery - proposal.supplierReservedQuantity;
  if (required <= 0) return true;
  const inventory = inventoryFor(supplier, contract.productId);
  if (inventory.available < required) return false;
  adoptLegacyCommodityFreeze(inventory, 'contract', `${contract.id}:renewal`, proposal.supplierReservedQuantity);
  freezeCommodity(inventory, 'contract', `${contract.id}:renewal`, required);
  proposal.supplierReservedQuantity += required;
  return true;
}

function activateRenewal(world, contract, buyer, supplier, now, runtimeIndex) {
  const proposal = contract.renewalProposal;
  if (!proposal || proposal.status !== 'accepted') return null;
  const proposerIsBuyer = Number(proposal.proposedBy) === Number(contract.buyerId);
  const nextContract = normalizeContract({
    id: `production-contract-${randomUUID()}`,
    publisherId: Number(proposal.proposedBy),
    publisherRole: proposerIsBuyer ? 'buyer' : 'supplier',
    buyerId: Number(contract.buyerId),
    supplierId: Number(contract.supplierId),
    productId: contract.productId,
    ...proposal.terms,
    completedDeliveries: 0,
    createdAt: now,
    offerExpiresAt: now,
    acceptedAt: proposal.confirmedAt || now,
    nextDueAt: now + proposal.terms.firstDeliveryDelayMs,
    buyerEscrowCredits: proposal.buyerEscrowCredits,
    buyerBondCredits: proposal.buyerBondCredits,
    supplierBondCredits: proposal.supplierBondCredits,
    supplierReservedQuantity: proposal.supplierReservedQuantity,
    buyerAutoFund: contract.buyerAutoFund,
    supplierAutoReserve: contract.supplierAutoReserve,
    status: 'active',
    roundStatus: 'preparing',
    renewedFromContractId: contract.id,
  });
  if (proposal.supplierReservedQuantity > 0) {
    const inventory = inventoryFor(supplier, contract.productId);
    adoptLegacyCommodityFreeze(inventory, 'contract', `${contract.id}:renewal`, proposal.supplierReservedQuantity);
    transferCommodityFreeze(inventory, 'contract', `${contract.id}:renewal`, nextContract.id, proposal.supplierReservedQuantity);
  }
  if (nextContract.supplierAutoReserve && nextContract.supplierReservedQuantity < nextContract.quantityPerDelivery) {
    reserveSupplierBatch(nextContract, supplier);
  }
  nextContract.roundStatus = nextContract.buyerEscrowCredits >= batchGross(nextContract)
    && nextContract.supplierReservedQuantity >= nextContract.quantityPerDelivery
    ? 'ready'
    : 'preparing';
  contract.renewedToContractId = nextContract.id;
  proposal.status = 'activated';
  proposal.activatedAt = now;
  proposal.activatedContractId = nextContract.id;
  proposal.buyerEscrowCredits = 0;
  proposal.buyerBondCredits = 0;
  proposal.supplierBondCredits = 0;
  proposal.supplierReservedQuantity = 0;
  world.productionContracts.push(nextContract);
  runtimeIndex.addContract(nextContract);
  return nextContract;
}

function reserveBuyerBatch(contract, buyer) {
  const gross = batchGross(contract);
  if (!gross) return false;
  if (contract.buyerEscrowCredits >= gross) return true;
  const required = gross - contract.buyerEscrowCredits;
  if (buyer.credits < required) return false;
  buyer.credits -= required;
  buyer.frozenCredits = Math.max(0, Number(buyer.frozenCredits || 0)) + required;
  contract.buyerEscrowCredits += required;
  return true;
}

function reserveSupplierBatch(contract, supplier) {
  const required = contract.quantityPerDelivery - contract.supplierReservedQuantity;
  if (required <= 0) return true;
  const inventory = inventoryFor(supplier, contract.productId);
  if (inventory.available < required) return false;
  adoptLegacyCommodityFreeze(inventory, 'contract', contract.id, contract.supplierReservedQuantity);
  freezeCommodity(inventory, 'contract', contract.id, required);
  contract.supplierReservedQuantity += required;
  return true;
}

function gracePeriodFor(contract) {
  return Math.max(10 * 60 * 1000, Math.min(Math.floor(contract.deliveryIntervalMs / 2), 6 * 60 * 60 * 1000));
}

function fundMarketReserveBatch(world, contract) {
  const group = marketReserveGroupFor(world, contract);
  const gross = batchGross(contract);
  if (!group || !gross) return false;
  if (contract.buyerEscrowCredits >= gross) return true;
  const required = roundInternalMoney(gross - contract.buyerEscrowCredits) || 0;
  if (!holdMarketReserveCredits(group, required)) return false;
  contract.buyerEscrowCredits = addMoney(contract.buyerEscrowCredits, required) || 0;
  return true;
}

function completeMarketReserveContract(world, contract, supplier, now) {
  const group = marketReserveGroupFor(world, contract);
  releaseMarketReserveCredits(group, contract.buyerBondCredits);
  releaseFrozenCredits(supplier, contract.supplierBondCredits);
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
  contract.status = 'completed';
  contract.completedAt = now;
  contract.nextDueAt = null;
  contract.roundStatus = 'ready';
  delete contract.graceEndsAt;
}

function releaseMarketReserveContractEscrow(world, contract, supplier) {
  const group = marketReserveGroupFor(world, contract);
  releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
  releaseFrozenCredits(supplier, contract.supplierBondCredits);
  releaseSupplierGoods(contract, supplier);
  contract.buyerEscrowCredits = 0;
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
}

function settleMarketReserveBatch(world, contract, supplier, now, runtimeIndex) {
  const group = marketReserveGroupFor(world, contract);
  const reserve = marketReserveProductFor(world, contract);
  const gross = batchGross(contract);
  if (!group || !reserve || !gross) return false;
  if (contract.buyerEscrowCredits < gross || contract.supplierReservedQuantity < contract.quantityPerDelivery) return false;
  const supplierInventory = inventoryFor(supplier, contract.productId);
  if (supplierInventory.frozen < contract.quantityPerDelivery) return false;

  return runtimeIndex.transition(contract, () => {
    adoptLegacyCommodityFreeze(supplierInventory, 'contract', contract.id, contract.supplierReservedQuantity);
    consumeCommodityFreeze(supplierInventory, 'contract', contract.id, contract.quantityPerDelivery);
    contract.supplierReservedQuantity -= contract.quantityPerDelivery;
    reserve.inventory = Math.max(0, Math.floor(Number(reserve.inventory || 0))) + contract.quantityPerDelivery;
    consumeMarketReserveFrozenCredits(group, gross);
    contract.buyerEscrowCredits = Math.max(0, roundInternalMoney(contract.buyerEscrowCredits - gross) || 0);

    const previousGross = contract.marketSellFeeGross;
    const previousFee = contract.marketSellFeeCharged;
    const nextGross = roundInternalMoney(previousGross + gross) || 0;
    const nextFee = calculateCumulativeMarketSellFee(nextGross);
    const fee = Math.max(0, roundInternalMoney(nextFee - previousFee) || 0);
    const net = Math.max(0, roundInternalMoney(gross - fee) || 0);
    contract.marketSellFeeGross = nextGross;
    contract.marketSellFeeCharged = nextFee;
    supplier.credits = roundInternalMoney(Number(supplier.credits || 0) + net) || 0;
    if (fee > 0) creditPopulationEmployment(world, fee, 'marketService');

    const supplierStats = normalizeStats(supplier);
    supplierStats.contractDeliveriesCompleted += 1;
    supplierStats.contractGoodsSupplied += contract.quantityPerDelivery;
    supplierStats.contractCreditsReceived += net;
    supplierStats.soldGoods += contract.quantityPerDelivery;
    supplierStats.commodityVolume += contract.quantityPerDelivery;
    supplierStats.marketServiceFees += fee;
    supplierStats.employmentPayments += fee;

    contract.completedDeliveries += 1;
    contract.lastDeliveryAt = now;
    contract.lastDeliveryGross = gross;
    contract.lastDeliveryFee = fee;
    contract.roundStatus = 'preparing';
    delete contract.graceEndsAt;

    if (contract.completedDeliveries >= contract.totalDeliveries) {
      completeMarketReserveContract(world, contract, supplier, now);
      return true;
    }
    if (contract.terminationRequestedBy) {
      releaseMarketReserveContractEscrow(world, contract, supplier);
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.terminationReason = 'notice_completed';
      contract.nextDueAt = null;
      return true;
    }

    contract.nextDueAt = Math.max(
      Number(contract.nextDueAt || now) + contract.deliveryIntervalMs,
      now + contract.deliveryIntervalMs,
    );
    if (contract.buyerAutoFund) fundMarketReserveBatch(world, contract);
    if (contract.supplierAutoReserve) reserveSupplierBatch(contract, supplier);
    contract.roundStatus = contract.buyerEscrowCredits >= gross
      && contract.supplierReservedQuantity >= contract.quantityPerDelivery
      ? 'ready'
      : 'preparing';
    return true;
  });
}

function terminateMarketReserveForDefault(world, contract, supplier, defaultParty, now, runtimeIndex) {
  const group = marketReserveGroupFor(world, contract);
  runtimeIndex.transition(contract, () => {
    if (defaultParty === 'buyer') {
      releaseMarketReserveCredits(group, contract.buyerEscrowCredits);
      transferMarketReserveBondToPlayer(group, supplier, contract.buyerBondCredits);
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
    } else if (defaultParty === 'supplier') {
      releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
      transferPlayerBondToMarketReserve(supplier, group, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
      normalizeStats(supplier).contractDefaults += 1;
    } else {
      releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
      normalizeStats(supplier).contractDefaults += 1;
    }
    contract.buyerEscrowCredits = 0;
    contract.buyerBondCredits = 0;
    contract.supplierBondCredits = 0;
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.terminationReason = `${defaultParty}_default`;
    contract.roundStatus = 'preparing';
    delete contract.graceEndsAt;
  });
}

function confirmMarketReserveBuyerDefault(world, contract, supplier, now, runtimeIndex) {
  const group = marketReserveGroupFor(world, contract);
  runtimeIndex.transition(contract, () => {
    releaseMarketReserveCredits(group, contract.buyerEscrowCredits);
    releaseFrozenCredits(supplier, contract.supplierBondCredits);
    releaseSupplierGoods(contract, supplier);
    contract.buyerEscrowCredits = 0;
    contract.supplierBondCredits = 0;
    contract.breachedAt = now;
    contract.terminationReason = 'buyer_default';
    contract.nextDueAt = null;
    contract.roundStatus = 'grace';
    delete contract.graceEndsAt;
  });
}

function isConfirmedDefault(contract) {
  return contract?.status === 'active'
    && Number(contract?.breachedAt || 0) > 0
    && String(contract?.terminationReason || '').endsWith('_default');
}

function processMarketReserveContract(world, contract, now, runtimeIndex) {
  if (isConfirmedDefault(contract)) return;
  const group = marketReserveGroupFor(world, contract);
  const reserve = marketReserveProductFor(world, contract);
  const supplier = playerFor(world, contract.supplierId);
  if (!group || !reserve || !supplier) {
    runtimeIndex.transition(contract, () => {
      if (supplier) {
        releaseFrozenCredits(supplier, contract.supplierBondCredits);
        releaseSupplierGoods(contract, supplier);
      }
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.terminationReason = 'participant_missing';
    });
    return;
  }
  normalizeStats(supplier);
  if (contract.buyerAutoFund) fundMarketReserveBatch(world, contract);
  if (contract.supplierAutoReserve) reserveSupplierBatch(contract, supplier);

  const gross = batchGross(contract);
  const fundsReady = Boolean(gross && contract.buyerEscrowCredits >= gross);
  const goodsReady = contract.supplierReservedQuantity >= contract.quantityPerDelivery;
  contract.roundStatus = fundsReady && goodsReady ? 'ready' : contract.graceEndsAt ? 'grace' : 'preparing';
  if (now < Number(contract.nextDueAt || Number.POSITIVE_INFINITY)) return;
  if (fundsReady && goodsReady) {
    settleMarketReserveBatch(world, contract, supplier, now, runtimeIndex);
    return;
  }
  if (!contract.graceEndsAt) {
    contract.graceEndsAt = now + gracePeriodFor(contract);
    contract.roundStatus = 'grace';
    return;
  }
  if (now < contract.graceEndsAt) return;
  const defaultParty = goodsReady && !fundsReady
    ? 'buyer'
    : !goodsReady && fundsReady
      ? 'supplier'
      : 'both';
  if (defaultParty === 'buyer') {
    confirmMarketReserveBuyerDefault(world, contract, supplier, now, runtimeIndex);
    return;
  }
  terminateMarketReserveForDefault(world, contract, supplier, defaultParty, now, runtimeIndex);
}

function releaseAllEscrow(contract, buyer, supplier) {
  releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
  releaseFrozenCredits(buyer, contract.buyerBondCredits);
  releaseFrozenCredits(supplier, contract.supplierBondCredits);
  releaseSupplierGoods(contract, supplier);
  contract.buyerEscrowCredits = 0;
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
}

function confirmDefault(world, contract, defaultParty, now, runtimeIndex) {
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  runtimeIndex.transition(contract, () => {
    releaseRenewalEscrow(contract, buyer, supplier, `${defaultParty}_default`);
    if (!buyer || !supplier) {
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.terminationReason = 'participant_missing';
      return;
    }

    if (defaultParty === 'buyer') {
      releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
      contract.buyerEscrowCredits = 0;
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      contract.supplierBondCredits = 0;
      releaseSupplierGoods(contract, supplier);
      normalizeStats(buyer).contractDefaults += 1;
    } else if (defaultParty === 'supplier') {
      releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
      releaseFrozenCredits(buyer, contract.buyerBondCredits);
      contract.buyerEscrowCredits = 0;
      contract.buyerBondCredits = 0;
      releaseSupplierGoods(contract, supplier);
      normalizeStats(supplier).contractDefaults += 1;
    } else {
      releaseAllEscrow(contract, buyer, supplier);
      normalizeStats(buyer).contractDefaults += 1;
      normalizeStats(supplier).contractDefaults += 1;
    }

    contract.breachedAt = now;
    contract.terminationReason = `${defaultParty}_default`;
    contract.nextDueAt = null;
    contract.roundStatus = 'grace';
    delete contract.graceEndsAt;
  });
}

function completeContract(contract, buyer, supplier, now) {
  releaseFrozenCredits(buyer, contract.buyerBondCredits);
  releaseFrozenCredits(supplier, contract.supplierBondCredits);
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
  contract.status = 'completed';
  contract.completedAt = now;
  contract.nextDueAt = null;
  contract.roundStatus = 'ready';
  delete contract.graceEndsAt;
}

function settleBatch(world, contract, buyer, supplier, now, runtimeIndex) {
  const gross = batchGross(contract);
  if (!gross || contract.buyerEscrowCredits < gross || contract.supplierReservedQuantity < contract.quantityPerDelivery) return false;

  const supplierInventory = inventoryFor(supplier, contract.productId);
  const buyerInventory = inventoryFor(buyer, contract.productId);
  if (supplierInventory.frozen < contract.quantityPerDelivery || buyer.frozenCredits < gross) return false;

  return runtimeIndex.transition(contract, () => {
    adoptLegacyCommodityFreeze(supplierInventory, 'contract', contract.id, contract.supplierReservedQuantity);
    consumeCommodityFreeze(supplierInventory, 'contract', contract.id, contract.quantityPerDelivery);
    contract.supplierReservedQuantity -= contract.quantityPerDelivery;
    buyerInventory.available += contract.quantityPerDelivery;

    consumeFrozenCredits(buyer, gross);
    contract.buyerEscrowCredits -= gross;

    const previousGross = contract.marketSellFeeGross;
    const previousFee = contract.marketSellFeeCharged;
    const nextGross = roundInternalMoney(previousGross + gross) || 0;
    const nextFee = calculateCumulativeMarketSellFee(nextGross);
    const fee = Math.max(0, roundInternalMoney(nextFee - previousFee) || 0);
    const net = Math.max(0, roundInternalMoney(gross - fee) || 0);
    contract.marketSellFeeGross = nextGross;
    contract.marketSellFeeCharged = nextFee;

    supplier.credits = roundInternalMoney(supplier.credits + net) || 0;
    if (fee > 0) creditPopulationEmployment(world, fee, 'marketService');

    const buyerStats = normalizeStats(buyer);
    const supplierStats = normalizeStats(supplier);
    buyerStats.contractDeliveriesCompleted += 1;
    buyerStats.contractGoodsPurchased += contract.quantityPerDelivery;
    buyerStats.contractCreditsPaid += gross;
    buyerStats.boughtGoods += contract.quantityPerDelivery;
    buyerStats.commodityVolume += contract.quantityPerDelivery;
    supplierStats.contractDeliveriesCompleted += 1;
    supplierStats.contractGoodsSupplied += contract.quantityPerDelivery;
    supplierStats.contractCreditsReceived += net;
    supplierStats.soldGoods += contract.quantityPerDelivery;
    supplierStats.commodityVolume += contract.quantityPerDelivery;
    supplierStats.marketServiceFees += fee;
    supplierStats.employmentPayments += fee;

    contract.completedDeliveries += 1;
    contract.lastDeliveryAt = now;
    contract.lastDeliveryGross = gross;
    contract.lastDeliveryFee = fee;
    contract.roundStatus = 'preparing';
    delete contract.graceEndsAt;

    if (contract.totalDeliveries !== null && contract.completedDeliveries >= contract.totalDeliveries) {
      completeContract(contract, buyer, supplier, now);
      activateRenewal(world, contract, buyer, supplier, now, runtimeIndex);
      return true;
    }

    if (contract.terminationRequestedBy) {
      releaseRenewalEscrow(contract, buyer, supplier, 'notice_completed');
      releaseAllEscrow(contract, buyer, supplier);
      contract.status = contract.totalDeliveries === null ? 'completed' : 'terminated';
      contract.endedAt = now;
      if (contract.totalDeliveries === null) contract.completedAt = now;
      contract.terminationReason = 'notice_completed';
      contract.nextDueAt = null;
      return true;
    }

    contract.nextDueAt = Math.max(
      Number(contract.nextDueAt || now) + contract.deliveryIntervalMs,
      now + contract.deliveryIntervalMs,
    );
    if (contract.buyerAutoFund) reserveBuyerBatch(contract, buyer);
    if (contract.supplierAutoReserve) reserveSupplierBatch(contract, supplier);
    contract.roundStatus = contract.buyerEscrowCredits >= gross && contract.supplierReservedQuantity >= contract.quantityPerDelivery
      ? 'ready'
      : 'preparing';
    return true;
  });
}

function processActiveContract(world, contract, now, runtimeIndex) {
  if (isConfirmedDefault(contract)) return;
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  if (!buyer || !supplier) {
    runtimeIndex.transition(contract, () => {
      releaseRenewalEscrow(contract, buyer, supplier, 'participant_missing');
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.terminationReason = 'participant_missing';
    });
    return;
  }

  normalizeStats(buyer);
  normalizeStats(supplier);
  if (contract.buyerAutoFund) reserveBuyerBatch(contract, buyer);
  if (contract.supplierAutoReserve) reserveSupplierBatch(contract, supplier);

  const gross = batchGross(contract);
  const fundsReady = Boolean(gross && contract.buyerEscrowCredits >= gross);
  const goodsReady = contract.supplierReservedQuantity >= contract.quantityPerDelivery;
  contract.roundStatus = fundsReady && goodsReady ? 'ready' : contract.graceEndsAt ? 'grace' : 'preparing';

  if (now < Number(contract.nextDueAt || Number.POSITIVE_INFINITY)) return;
  if (fundsReady && goodsReady) {
    settleBatch(world, contract, buyer, supplier, now, runtimeIndex);
    return;
  }

  if (!contract.graceEndsAt) {
    contract.graceEndsAt = now + gracePeriodFor(contract);
    contract.roundStatus = 'grace';
    return;
  }
  if (now < contract.graceEndsAt) return;

  const buyerReady = fundsReady;
  const defaultParty = goodsReady && !buyerReady
    ? 'buyer'
    : !goodsReady && buyerReady
      ? 'supplier'
      : 'both';
  confirmDefault(world, contract, defaultParty, now, runtimeIndex);
}

function trimContractHistory(world, runtimeIndex) {
  const activeOrOpen = [];
  const ended = [];
  for (const contract of world.productionContracts) {
    if (contract.status === 'open' || contract.status === 'active') activeOrOpen.push(contract);
    else ended.push(contract);
  }
  ended.sort((left, right) => Number(right.endedAt || right.createdAt) - Number(left.endedAt || left.createdAt));
  const nextContracts = [...activeOrOpen, ...ended.slice(0, Math.max(0, MAX_CONTRACTS - activeOrOpen.length))]
    .slice(0, MAX_CONTRACTS);
  if (nextContracts.length < world.productionContracts.length) {
    const retained = new Set(nextContracts);
    for (const contract of world.productionContracts) {
      if (!retained.has(contract)) runtimeIndex.removeContract(contract);
    }
  }
  world.productionContracts = nextContracts;
}

function processProductionContractsWithIndex(world, now = Date.now()) {
  migrateProductionContractWorld(world);
  const runtimeIndex = createContractRuntimeIndex(world);
  for (const contract of runtimeIndex.openContracts) {
    if (contract.kind === 'supply' && contract.status === 'open' && Array.isArray(contract.negotiations)) {
      const activeNegotiations = contract.negotiations.filter((negotiation) => now < Number(negotiation.expiresAt || 0));
      if (activeNegotiations.length !== contract.negotiations.length) {
        runtimeIndex.transition(contract, () => {
          contract.negotiations = activeNegotiations;
        });
      }
    }
    if (contract.status === 'open' && now >= contract.offerExpiresAt) {
      runtimeIndex.transition(contract, () => {
        if (contract.kind === 'supply') contract.negotiations = [];
        contract.status = 'expired';
        contract.endedAt = now;
      });
    }
  }
  for (const contract of runtimeIndex.activeContracts) {
    if (contract.status !== 'active') continue;
    if (contract.kind !== 'supply') {
      processCommercialContract(world, contract, now, runtimeIndex);
      continue;
    }
    if (contract.publisherType === 'market_reserve') {
      processMarketReserveContract(world, contract, now, runtimeIndex);
      continue;
    }
    if (contract.renewalProposal?.status === 'proposed' && now >= Number(contract.renewalProposal.expiresAt || 0)) {
      runtimeIndex.transition(contract, () => releaseRenewalEscrow(
        contract,
        playerFor(world, contract.buyerId),
        playerFor(world, contract.supplierId),
        'expired',
      ));
    }
    processActiveContract(world, contract, now, runtimeIndex);
  }
  trimContractHistory(world, runtimeIndex);
  return runtimeIndex;
}

export function processProductionContracts(world, now = Date.now()) {
  processProductionContractsWithIndex(world, now);
  return world;
}

export function createMarketReserveProcurementContract(world, payload, now = Date.now()) {
  migrateProductionContractWorld(world);
  const groupId = String(payload?.groupId || '');
  const group = world.marketDemand?.liquidity?.groups?.[groupId];
  const productId = PRODUCT_IDS.has(String(payload?.productId || '')) ? String(payload.productId) : null;
  const quantityPerDelivery = positiveInteger(payload?.quantityPerDelivery, MAX_QUANTITY);
  const unitPrice = positiveMoney(payload?.unitPrice, MAX_UNIT_PRICE);
  const deliveryIntervalMs = exactAllowedInteger(payload?.deliveryIntervalMs, PRODUCTION_CONTRACT_INTERVALS);
  const totalDeliveries = positiveInteger(payload?.totalDeliveries, MAX_DELIVERIES);
  const firstDeliveryDelayMs = exactAllowedInteger(payload?.firstDeliveryDelayMs, PRODUCTION_CONTRACT_FIRST_DELAYS);
  if (!group || !productId || !quantityPerDelivery || !unitPrice || !deliveryIntervalMs || !totalDeliveries || firstDeliveryDelayMs === null) return null;
  if (totalDeliveries < MIN_DELIVERIES) return null;
  if ((world.productionContracts || []).some((contract) => (
    contract.publisherType === 'market_reserve'
      && contract.marketReserveGroupId === groupId
      && contract.productId === productId
      && ['open', 'active'].includes(contract.status)
  ))) return null;
  const groupName = String(payload?.groupName || groupId);
  const offerTtlMs = Math.max(10 * 60 * 1000, Number(payload?.offerTtlMs || 60 * 60 * 1000));
  const contract = normalizeContract({
    id: `market-reserve-contract-${randomUUID()}`,
    publisherId: 0,
    publisherName: `${groupName}储备`,
    publisherType: 'market_reserve',
    fixedTerms: true,
    marketReserveGroupId: groupId,
    publisherRole: 'buyer',
    buyerId: 0,
    buyerName: `${groupName}储备`,
    supplierId: null,
    supplierName: null,
    productId,
    quantityPerDelivery,
    unitPrice,
    deliveryIntervalMs,
    totalDeliveries,
    completedDeliveries: 0,
    firstDeliveryDelayMs,
    createdAt: now,
    offerExpiresAt: now + offerTtlMs,
    buyerAutoFund: true,
    supplierAutoReserve: true,
    negotiations: [],
    status: 'open',
  });
  world.productionContracts.push(contract);
  return contract;
}

function createContract(world, user, payload, now, runtimeIndex) {
  if (payload.kind && payload.kind !== 'supply') {
    return createCommercialContract(world, user, payload, now, runtimeIndex) || result(false, '合同类型不存在');
  }
  const publisherRole = payload.publisherRole === 'supplier' ? 'supplier' : payload.publisherRole === 'buyer' ? 'buyer' : null;
  const productId = PRODUCT_IDS.has(String(payload.productId || '')) ? String(payload.productId) : null;
  const quantityPerDelivery = positiveInteger(payload.quantityPerDelivery, MAX_QUANTITY);
  const unitPrice = positiveMoney(payload.unitPrice, MAX_UNIT_PRICE);
  const deliveryIntervalMs = exactAllowedInteger(payload.deliveryIntervalMs, PRODUCTION_CONTRACT_INTERVALS);
  const totalDeliveries = optionalTotalDeliveries(payload.totalDeliveries);
  const firstDeliveryDelayMs = exactAllowedInteger(payload.firstDeliveryDelayMs, PRODUCTION_CONTRACT_FIRST_DELAYS);
  if (!publisherRole || !productId || !quantityPerDelivery || !unitPrice || !deliveryIntervalMs || totalDeliveries === undefined || firstDeliveryDelayMs === null) {
    return result(false, '合同参数无效');
  }
  const gross = roundInternalMoney(quantityPerDelivery * unitPrice);
  if (!Number.isFinite(gross)) return result(false, '单批货款超出安全范围');
  if (runtimeIndex.openCountForPublisher(user.id) >= MAX_OPEN_CONTRACTS_PER_PLAYER) return result(false, '公开合同数量已达上限');

  const publisher = playerFor(world, user.id);
  if (!publisher) return result(false, '玩家不存在');
  const contract = normalizeContract({
    id: `production-contract-${randomUUID()}`,
    publisherId: Number(user.id),
    publisherRole,
    buyerId: publisherRole === 'buyer' ? Number(user.id) : null,
    supplierId: publisherRole === 'supplier' ? Number(user.id) : null,
    productId,
    quantityPerDelivery,
    unitPrice,
    deliveryIntervalMs,
    totalDeliveries,
    completedDeliveries: 0,
    firstDeliveryDelayMs,
    createdAt: now,
    offerExpiresAt: now + OFFER_TTL_MS,
    status: 'open',
  });
  world.productionContracts.push(contract);
  runtimeIndex.addContract(contract);
  return result(true, '长期供货合同已发布');
}

function acceptMarketReserveContract(world, contract, user, now, runtimeIndex) {
  const supplier = playerFor(world, user.id);
  const group = marketReserveGroupFor(world, contract);
  const gross = batchGross(contract);
  const bond = gross ? bondFor(gross) : null;
  if (!supplier || !group || !gross || !bond) return result(false, '市场储备合同状态异常');
  if (Number(group.credits || 0) < gross + bond) return result(false, '市场储备当前可用采购资金不足，请稍后再试');
  if (Number(supplier.credits || 0) < bond) return result(false, `供应方需要至少 ¤${bond} 履约保证金`);

  runtimeIndex.transition(contract, () => {
    if (!holdMarketReserveCredits(group, gross + bond)) return;
    supplier.credits = roundInternalMoney(Number(supplier.credits || 0) - bond) || 0;
    supplier.frozenCredits = addMoney(supplier.frozenCredits, bond) || 0;
    contract.supplierId = Number(supplier.userId);
    contract.buyerEscrowCredits = gross;
    contract.buyerBondCredits = bond;
    contract.supplierBondCredits = bond;
    contract.acceptedAt = now;
    contract.nextDueAt = now + contract.firstDeliveryDelayMs;
    contract.status = 'active';
    contract.roundStatus = 'preparing';
    contract.negotiations = [];
    reserveSupplierBatch(contract, supplier);
    if (contract.supplierReservedQuantity >= contract.quantityPerDelivery) contract.roundStatus = 'ready';
  });
  return result(true, '市场储备采购合同已签订并进入履约');
}

function acceptContract(world, user, payload, now, runtimeIndex) {
  const contract = runtimeIndex.contractById(payload.contractId);
  if (!contract || contract.status !== 'open') return result(false, '合同不存在或已被承接');
  if (contract.publisherId === Number(user.id)) return result(false, '不能承接自己发布的合同');
  if (runtimeIndex.activeCountForParticipant(user.id) >= MAX_ACTIVE_CONTRACTS_PER_PLAYER) return result(false, '进行中的合同数量已达上限');
  if (contract.publisherType !== 'market_reserve'
    && runtimeIndex.activeCountForParticipant(contract.publisherId) >= MAX_ACTIVE_CONTRACTS_PER_PLAYER) return result(false, '发布者进行中的合同数量已达上限');
  if (contract.kind !== 'supply') {
    return acceptCommercialContract(world, contract, user, now, runtimeIndex) || result(false, '合同类型不存在');
  }
  if (contract.publisherType === 'market_reserve') return acceptMarketReserveContract(world, contract, user, now, runtimeIndex);

  const accepter = playerFor(world, user.id);
  const publisher = playerFor(world, contract.publisherId);
  if (!accepter || !publisher) return result(false, '合同参与者不存在');
  const buyer = contract.publisherRole === 'buyer' ? publisher : accepter;
  const supplier = contract.publisherRole === 'supplier' ? publisher : accepter;
  const gross = batchGross(contract);
  const bond = gross ? bondFor(gross) : null;
  if (!gross || !bond) return result(false, '合同金额超出安全范围');
  if (buyer.credits < gross + bond) return result(false, `采购方需要至少 ¤${gross + bond} 用于首批货款和保证金`);
  if (supplier.credits < bond) return result(false, `供应方需要至少 ¤${bond} 履约保证金`);

  runtimeIndex.transition(contract, () => {
    buyer.credits -= gross + bond;
    buyer.frozenCredits = Math.max(0, Number(buyer.frozenCredits || 0)) + gross + bond;
    supplier.credits -= bond;
    supplier.frozenCredits = Math.max(0, Number(supplier.frozenCredits || 0)) + bond;

    contract.buyerId = Number(buyer.userId);
    contract.supplierId = Number(supplier.userId);
    contract.buyerEscrowCredits = gross;
    contract.buyerBondCredits = bond;
    contract.supplierBondCredits = bond;
    contract.buyerAutoFund = true;
    contract.supplierAutoReserve = true;
    contract.acceptedAt = now;
    contract.nextDueAt = now + contract.firstDeliveryDelayMs;
    contract.status = 'active';
    contract.roundStatus = 'preparing';
    contract.negotiations = [];
    reserveSupplierBatch(contract, supplier);
    if (contract.supplierReservedQuantity >= contract.quantityPerDelivery) contract.roundStatus = 'ready';
  });
  return result(true, '合同已签订并进入履约');
}

function openSupplyContract(runtimeIndex, contractId) {
  const contract = runtimeIndex.contractById(contractId);
  return contract?.kind === 'supply' && contract.status === 'open' && contract.fixedTerms !== true ? contract : null;
}

function negotiationFor(contract, negotiationId) {
  return contract?.negotiations?.find((item) => item.id === String(negotiationId || '')) || null;
}

function proposeNegotiation(world, user, payload, now, runtimeIndex) {
  const contract = openSupplyContract(runtimeIndex, payload.contractId);
  if (!contract) return result(false, '可议价的商品合同不存在');
  if (contract.publisherId === Number(user.id)) return result(false, '发布者不能向自己的合同发起议价');
  contract.negotiations ||= [];
  if (contract.negotiations.some((item) => item.proposerId === Number(user.id))) return result(false, '你已经有一个进行中的议价');
  if (contract.negotiations.length >= MAX_NEGOTIATIONS_PER_CONTRACT) return result(false, '该合同同时进行中的议价已达上限');
  const terms = renewalTerms(payload);
  if (!terms) return result(false, '议价条款无效');
  const expiresAt = Math.min(contract.offerExpiresAt, now + NEGOTIATION_TTL_MS);
  runtimeIndex.transition(contract, () => {
    contract.negotiations.push({
      id: `contract-negotiation-${randomUUID()}`,
      proposerId: Number(user.id),
      revision: 1,
      terms,
      lastActionBy: Number(user.id),
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });
  });
  return result(true, '议价提议已发送');
}

function counterNegotiation(world, user, payload, now, runtimeIndex) {
  const contract = openSupplyContract(runtimeIndex, payload.contractId);
  const negotiation = negotiationFor(contract, payload.negotiationId);
  if (!contract || !negotiation) return result(false, '可反报价的议价不存在');
  const userId = Number(user.id);
  if (![contract.publisherId, negotiation.proposerId].includes(userId)) return result(false, '你不是该议价的参与者');
  if (negotiation.lastActionBy === userId) return result(false, '请等待对方回应当前报价');
  if (negotiation.revision >= MAX_NEGOTIATION_REVISIONS) return result(false, `议价最多 ${MAX_NEGOTIATION_REVISIONS} 轮`);
  const terms = renewalTerms(payload);
  if (!terms) return result(false, '议价条款无效');
  runtimeIndex.transition(contract, () => {
    negotiation.terms = terms;
    negotiation.revision += 1;
    negotiation.lastActionBy = userId;
    negotiation.updatedAt = now;
    negotiation.expiresAt = Math.min(contract.offerExpiresAt, now + NEGOTIATION_TTL_MS);
  });
  return result(true, '反报价已发送');
}

function rejectNegotiation(world, user, payload, runtimeIndex) {
  const contract = openSupplyContract(runtimeIndex, payload.contractId);
  const negotiation = negotiationFor(contract, payload.negotiationId);
  if (!contract || !negotiation) return result(false, '可拒绝的议价不存在');
  const userId = Number(user.id);
  if (![contract.publisherId, negotiation.proposerId].includes(userId)) return result(false, '你不是该议价的参与者');
  if (negotiation.lastActionBy === userId) return result(false, '当前报价由你提出，请撤回而不是拒绝');
  runtimeIndex.transition(contract, () => {
    contract.negotiations = contract.negotiations.filter((item) => item.id !== negotiation.id);
  });
  return result(true, '议价已拒绝');
}

function revokeNegotiation(world, user, payload, runtimeIndex) {
  const contract = openSupplyContract(runtimeIndex, payload.contractId);
  const negotiation = negotiationFor(contract, payload.negotiationId);
  if (!contract || !negotiation) return result(false, '可撤回的议价不存在');
  if (negotiation.proposerId !== Number(user.id)) return result(false, '只有议价发起者可以撤回');
  if (negotiation.lastActionBy !== Number(user.id)) return result(false, '对方已经反报价，请接受、再报价或拒绝');
  runtimeIndex.transition(contract, () => {
    contract.negotiations = contract.negotiations.filter((item) => item.id !== negotiation.id);
  });
  return result(true, '议价已撤回');
}

function acceptNegotiation(world, user, payload, now, runtimeIndex) {
  const contract = openSupplyContract(runtimeIndex, payload.contractId);
  const negotiation = negotiationFor(contract, payload.negotiationId);
  if (!contract || !negotiation) return result(false, '可接受的议价不存在');
  const userId = Number(user.id);
  if (![contract.publisherId, negotiation.proposerId].includes(userId)) return result(false, '你不是该议价的参与者');
  if (negotiation.lastActionBy === userId) return result(false, '不能接受自己刚提出的报价');
  if (now >= Number(negotiation.expiresAt || 0)) return result(false, '议价已经过期');

  const previousTerms = {
    quantityPerDelivery: contract.quantityPerDelivery,
    unitPrice: contract.unitPrice,
    deliveryIntervalMs: contract.deliveryIntervalMs,
    totalDeliveries: contract.totalDeliveries,
    firstDeliveryDelayMs: contract.firstDeliveryDelayMs,
  };
  Object.assign(contract, negotiation.terms);
  const accepted = acceptContract(world, { id: negotiation.proposerId }, { contractId: contract.id }, now, runtimeIndex);
  if (!accepted.ok) {
    Object.assign(contract, previousTerms);
    return accepted;
  }
  return result(true, '议价条款已接受，合同已签订并进入履约');
}

function ownActiveContract(runtimeIndex, userId, contractId) {
  const contract = runtimeIndex.contractById(contractId);
  if (!contract || contract.status !== 'active') return null;
  return contract.buyerId === Number(userId) || contract.supplierId === Number(userId) ? contract : null;
}

function cancelOpenContract(world, user, payload, now, runtimeIndex) {
  const contract = runtimeIndex.contractById(payload.contractId);
  if (!contract || contract.status !== 'open' || contract.publisherId !== Number(user.id)) return result(false, '可取消的公开合同不存在');
  runtimeIndex.transition(contract, () => {
    contract.negotiations = [];
    contract.status = 'cancelled';
    contract.endedAt = now;
  });
  return result(true, '公开合同已取消');
}

export function cancelOpenProductionContractForSaveDeletion(world, user, contractId, now = Date.now()) {
  const runtimeIndex = createContractRuntimeIndex(world);
  return cancelOpenContract(world, user, { contractId }, now, runtimeIndex);
}

function prepareContract(world, user, payload, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  if (!contract || contract.supplierId !== Number(user.id)) return result(false, '只有供应方可以准备商品');
  const supplier = playerFor(world, user.id);
  if (!reserveSupplierBatch(contract, supplier)) return result(false, '可用商品库存不足');
  contract.roundStatus = contract.buyerEscrowCredits >= batchGross(contract) ? 'ready' : contract.roundStatus;
  return result(true, '本批商品已进入合同托管');
}

function fundContract(world, user, payload, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  if (!contract || contract.buyerId !== Number(user.id)) return result(false, '只有采购方可以补充货款');
  const buyer = playerFor(world, user.id);
  if (!reserveBuyerBatch(contract, buyer)) return result(false, '可用资金不足');
  contract.roundStatus = contract.supplierReservedQuantity >= contract.quantityPerDelivery ? 'ready' : contract.roundStatus;
  return result(true, '本批货款已进入合同托管');
}

function setAutoMode(world, user, payload, field, role, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  if (!contract || contract[`${role}Id`] !== Number(user.id)) return result(false, '无权修改该合同的自动设置');
  contract[field] = payload.enabled === true;
  if (field === 'buyerAutoFund' && contract[field]) reserveBuyerBatch(contract, playerFor(world, user.id));
  if (field === 'supplierAutoReserve' && contract[field]) reserveSupplierBatch(contract, playerFor(world, user.id));
  return result(true, contract[field] ? '自动履约已开启' : '自动履约已关闭');
}

function proposeRenewal(world, user, payload, now, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  if (!contract) return result(false, '进行中的合同不存在');
  if (contract.fixedTerms) return result(false, '市场储备采购合同使用固定条款，不支持续签议价');
  if (contract.totalDeliveries === null) return result(false, '长期合同无需续签');
  const remaining = Math.max(0, contract.totalDeliveries - contract.completedDeliveries);
  if (remaining < 1 || remaining > RENEWAL_WINDOW_DELIVERIES) return result(false, '仅可在合同剩余三批以内提出续签');
  if (contract.graceEndsAt) return result(false, '宽限期内不能提出续签');
  if (contract.terminationRequestedBy) return result(false, '已申请结束的合同不能续签');
  if (contract.renewalProposal) return result(false, '当前合同已有续签安排');
  const terms = renewalTerms(payload);
  if (!terms) return result(false, '续签条款无效');
  runtimeIndex.transition(contract, () => {
    contract.renewalCancellationReason = undefined;
    contract.renewalProposal = normalizeRenewalProposal(contract, {
      id: `contract-renewal-${randomUUID()}`,
      status: 'proposed',
      proposedBy: Number(user.id),
      proposedAt: now,
      expiresAt: now + RENEWAL_TTL_MS,
      terms,
    });
  });
  return result(true, '续签提议已发送，等待合作方确认');
}

function acceptRenewal(world, user, payload, now, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  const proposal = contract?.renewalProposal;
  if (!contract || !proposal || proposal.status !== 'proposed') return result(false, '可确认的续签提议不存在');
  const approvalField = renewalApprovalField(contract, user.id);
  if (!approvalField) return result(false, '只有合同参与方可以确认续签');
  if (proposal[approvalField]) return result(true, '你已同意当前续签条款，正在等待合作方确认');
  if (now >= Number(proposal.expiresAt || 0)) return result(false, '续签提议已过期');
  if (contract.graceEndsAt || contract.terminationRequestedBy) return result(false, '当前合同状态不允许续签');

  const counterpartyApproved = approvalField === 'buyerApprovedAt'
    ? Boolean(proposal.supplierApprovedAt)
    : Boolean(proposal.buyerApprovedAt);
  if (!counterpartyApproved) {
    runtimeIndex.transition(contract, () => {
      proposal[approvalField] = now;
    });
    return result(true, '已同意当前续签条款，等待合作方确认');
  }

  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  if (!buyer || !supplier) return result(false, '合同参与者不存在');
  const gross = renewalGross(proposal);
  const bond = gross ? bondFor(gross) : null;
  if (!gross || !bond) return result(false, '续签金额超出安全范围');
  if (buyer.credits < gross + bond) return result(false, `采购方需要至少 ¤${gross + bond} 用于续签首批货款和保证金`);
  if (supplier.credits < bond) return result(false, `供应方需要至少 ¤${bond} 续签履约保证金`);
  runtimeIndex.transition(contract, () => {
    proposal[approvalField] = now;
    buyer.credits -= gross + bond;
    buyer.frozenCredits += gross + bond;
    supplier.credits -= bond;
    supplier.frozenCredits += bond;
    proposal.status = 'accepted';
    proposal.confirmedAt = now;
    proposal.buyerEscrowCredits = gross;
    proposal.buyerBondCredits = bond;
    proposal.supplierBondCredits = bond;
    if (contract.supplierAutoReserve) reserveRenewalSupplierGoods(contract, supplier);
  });
  return result(true, '双方已同意续签，将在当前合同正常完成后自动生效');
}

function rejectRenewal(world, user, payload, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  const proposal = contract?.renewalProposal;
  if (!contract || !proposal || proposal.status !== 'proposed') return result(false, '可取消的续签提议不存在');
  const participant = renewalApprovalField(contract, user.id);
  if (!participant) return result(false, '只有合同参与方可以处理续签');
  const proposerCancelled = Number(proposal.proposedBy) === Number(user.id);
  runtimeIndex.transition(contract, () => releaseRenewalEscrow(
    contract,
    playerFor(world, contract.buyerId),
    playerFor(world, contract.supplierId),
    proposerCancelled ? 'cancelled_by_proposer' : 'rejected',
  ));
  return result(true, proposerCancelled ? '续签提议已取消' : '续签提议已拒绝');
}

function revokeRenewal(world, user, payload, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  const proposal = contract?.renewalProposal;
  if (!contract || !proposal || proposal.status !== 'proposed') return result(false, '可撤销同意的续签提议不存在');
  const approvalField = renewalApprovalField(contract, user.id);
  if (!approvalField) return result(false, '只有合同参与方可以处理续签');
  if (!proposal[approvalField]) return result(false, '你尚未同意当前续签条款');
  runtimeIndex.transition(contract, () => {
    proposal[approvalField] = undefined;
  });
  return result(true, '已撤销对当前续签条款的同意');
}

function requestTermination(world, user, payload, now, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  if (!contract) return result(false, '进行中的合同不存在');
  runtimeIndex.transition(contract, () => {
    releaseRenewalEscrow(
      contract,
      playerFor(world, contract.buyerId),
      playerFor(world, contract.supplierId),
      'termination_requested',
    );
    contract.terminationRequestedBy = Number(user.id);
    contract.terminationRequestedAt = now;
  });
  return result(true, '合同将在当前批次完成后结束');
}

function claimConfirmedDefault(world, user, contract, now, runtimeIndex) {
  const reason = String(contract.terminationReason || '');
  const userId = Number(user.id);
  if (!isConfirmedDefault(contract)) return result(false, '合同尚未确认违约');

  if (contract.publisherType === 'market_reserve') {
    const supplier = playerFor(world, contract.supplierId);
    const group = marketReserveGroupFor(world, contract);
    if (reason !== 'buyer_default' || !supplier || !group || Number(contract.supplierId) !== userId) {
      return result(false, '只有受偿供应方可以解除该违约合同');
    }
    const compensation = Math.max(0, Number(contract.buyerBondCredits || 0));
    runtimeIndex.transition(contract, () => {
      transferMarketReserveBondToPlayer(group, supplier, compensation);
      contract.lastCompensation = compensation;
      contract.lastCompensationFromId = null;
      contract.lastCompensationToId = userId;
      contract.buyerBondCredits = 0;
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.roundStatus = 'preparing';
    });
    return result(true, '合同已解除，市场储备违约保证金已领取');
  }

  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  if (!buyer || !supplier) return result(false, '合同参与者不存在');
  if (reason === 'buyer_default' && Number(contract.supplierId) !== userId) return result(false, '只有受偿供应方可以解除合同并领取违约金');
  if (reason === 'supplier_default' && Number(contract.buyerId) !== userId) return result(false, '只有受偿采购方可以解除合同并领取违约金');
  if (reason === 'both_default' && ![contract.buyerId, contract.supplierId].some((id) => Number(id) === userId)) return result(false, '无权解除该合同');
  if (!['buyer_default', 'supplier_default', 'both_default'].includes(reason)) return result(false, '当前违约状态不支持领取');

  runtimeIndex.transition(contract, () => {
    if (reason === 'buyer_default') {
      const compensation = Math.max(0, Number(contract.buyerBondCredits || 0));
      transferFrozenCredits(buyer, supplier, compensation);
      contract.lastCompensation = compensation;
      contract.lastCompensationFromId = Number(contract.buyerId);
      contract.lastCompensationToId = Number(contract.supplierId);
      contract.buyerBondCredits = 0;
    } else if (reason === 'supplier_default') {
      const compensation = Math.max(0, Number(contract.supplierBondCredits || 0));
      transferFrozenCredits(supplier, buyer, compensation);
      contract.lastCompensation = compensation;
      contract.lastCompensationFromId = Number(contract.supplierId);
      contract.lastCompensationToId = Number(contract.buyerId);
      contract.supplierBondCredits = 0;
    }
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.roundStatus = 'preparing';
  });
  return result(true, reason === 'both_default' ? '双方违约合同已解除' : '合同已解除，违约金已领取');
}

function terminateNow(world, user, payload, now, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  if (!contract) return result(false, '进行中的合同不存在');
  if (contract.publisherType === 'market_reserve') {
    const supplier = playerFor(world, contract.supplierId);
    const group = marketReserveGroupFor(world, contract);
    if (!supplier || !group || contract.supplierId !== Number(user.id)) return result(false, '市场储备合同参与者异常');
    runtimeIndex.transition(contract, () => {
      releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
      transferPlayerBondToMarketReserve(supplier, group, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
      contract.buyerEscrowCredits = 0;
      contract.buyerBondCredits = 0;
      contract.supplierBondCredits = 0;
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.terminationReason = 'immediate_by_participant';
      normalizeStats(supplier).contractDefaults += 1;
    });
    return result(true, '合同已立即终止，供应方履约保证金已赔付市场储备');
  }
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  if (!buyer || !supplier) return result(false, '合同参与者不存在');

  runtimeIndex.transition(contract, () => {
    releaseRenewalEscrow(contract, buyer, supplier, 'immediate_by_participant');
    if (contract.buyerId === Number(user.id)) {
      releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
      transferFrozenCredits(buyer, supplier, contract.buyerBondCredits);
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
    } else {
      releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
      releaseFrozenCredits(buyer, contract.buyerBondCredits);
      transferFrozenCredits(supplier, buyer, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
    }
    contract.buyerEscrowCredits = 0;
    contract.buyerBondCredits = 0;
    contract.supplierBondCredits = 0;
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.terminationReason = 'immediate_by_participant';
    normalizeStats(playerFor(world, user.id)).contractDefaults += 1;
  });
  return result(true, '合同已立即终止，违约保证金已支付给对方');
}

export function applyProductionContractAction(world, user, action, payload = {}, now = Date.now()) {
  const runtimeIndex = processProductionContractsWithIndex(world, now);
  const pendingSupply = runtimeIndex.contractById(payload.contractId);
  if (pendingSupply?.kind === 'supply' && isConfirmedDefault(pendingSupply)) {
    const participant = [pendingSupply.buyerId, pendingSupply.supplierId].some((id) => Number(id) === Number(user.id));
    if (!participant) return result(false, '无权处理该违约合同');
    if (action === 'terminateProductionContractNow') return claimConfirmedDefault(world, user, pendingSupply, now, runtimeIndex);
    return result(false, '合同已确认违约，不能继续补货、补款、续签或修改自动履约设置');
  }
  const commercialResult = applyCommercialContractAction(world, user, action, payload, now, runtimeIndex);
  if (commercialResult) return commercialResult;
  if (action === 'createProductionContract') return createContract(world, user, payload, now, runtimeIndex);
  if (action === 'acceptProductionContract') return acceptContract(world, user, payload, now, runtimeIndex);
  if (action === 'proposeProductionContractNegotiation') return proposeNegotiation(world, user, payload, now, runtimeIndex);
  if (action === 'counterProductionContractNegotiation') return counterNegotiation(world, user, payload, now, runtimeIndex);
  if (action === 'acceptProductionContractNegotiation') return acceptNegotiation(world, user, payload, now, runtimeIndex);
  if (action === 'rejectProductionContractNegotiation') return rejectNegotiation(world, user, payload, runtimeIndex);
  if (action === 'revokeProductionContractNegotiation') return revokeNegotiation(world, user, payload, runtimeIndex);
  if (action === 'cancelProductionContract') return cancelOpenContract(world, user, payload, now, runtimeIndex);
  if (action === 'prepareProductionContract') return prepareContract(world, user, payload, runtimeIndex);
  if (action === 'fundProductionContract') return fundContract(world, user, payload, runtimeIndex);
  if (action === 'setProductionContractAutoReserve') return setAutoMode(world, user, payload, 'supplierAutoReserve', 'supplier', runtimeIndex);
  if (action === 'setProductionContractAutoFund') return setAutoMode(world, user, payload, 'buyerAutoFund', 'buyer', runtimeIndex);
  if (action === 'proposeProductionContractRenewal') return proposeRenewal(world, user, payload, now, runtimeIndex);
  if (action === 'acceptProductionContractRenewal') return acceptRenewal(world, user, payload, now, runtimeIndex);
  if (action === 'rejectProductionContractRenewal') return rejectRenewal(world, user, payload, runtimeIndex);
  if (action === 'revokeProductionContractRenewal') return revokeRenewal(world, user, payload, runtimeIndex);
  if (action === 'requestProductionContractTermination') return requestTermination(world, user, payload, now, runtimeIndex);
  if (action === 'terminateProductionContractNow') return terminateNow(world, user, payload, now, runtimeIndex);
  return result(false, '合同操作不存在');
}

function issueForContract(world, contract, runtimeIndex, userId = null) {
  if (contract.kind !== 'supply') return commercialIssue(contract, userId);
  if (contract.status !== 'active') return null;
  if (isConfirmedDefault(contract)) {
    if (contract.terminationReason === 'both_default') return '双方均未满足履约条件，合同等待任一参与方主动解除';
    const claimantId = contract.terminationReason === 'buyer_default' ? contract.supplierId : contract.buyerId;
    return Number(claimantId) === Number(userId)
      ? '合同已确认违约，请主动解除合同并领取违约金'
      : '合同已确认违约，等待受偿方解除合同';
  }
  if (contract.publisherType === 'market_reserve') {
    const supplier = playerFor(world, contract.supplierId);
    const group = marketReserveGroupFor(world, contract);
    const reserve = marketReserveProductFor(world, contract);
    const gross = batchGross(contract) || 0;
    if (!supplier || !group || !reserve) return '市场储备合同参与者异常';
    if (contract.graceEndsAt) {
      if (contract.supplierReservedQuantity < contract.quantityPerDelivery) return '供应方商品不足，正在宽限期';
      if (contract.buyerEscrowCredits < gross) return '市场储备采购资金不足，正在宽限期';
      return '宽限期内等待结算';
    }
    if (contract.supplierReservedQuantity < contract.quantityPerDelivery) return '等待供应方准备商品';
    if (contract.buyerEscrowCredits < gross) return '等待市场储备补充本批采购资金';
    return null;
  }
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  const gross = batchGross(contract) || 0;
  if (!buyer || !supplier) return '合同参与者异常';
  if (contract.graceEndsAt) {
    if (contract.supplierReservedQuantity < contract.quantityPerDelivery) return '供应方商品不足，正在宽限期';
    if (contract.buyerEscrowCredits < gross) return '采购方货款不足，正在宽限期';
    return '宽限期内等待结算';
  }
  if (contract.supplierReservedQuantity < contract.quantityPerDelivery) return '等待供应方准备商品';
  if (contract.buyerEscrowCredits < gross) return '等待采购方补充货款';
  if (contract.renewalProposal?.status === 'proposed'
    && userId !== null
    && !renewalApprovedBy(contract, contract.renewalProposal, userId)) return '等待你确认续签提议';
  return null;
}

function publicNegotiations(world, contract, userId) {
  if (contract.kind !== 'supply' || contract.status !== 'open' || contract.fixedTerms) return [];
  const viewerId = Number(userId);
  const visible = contract.publisherId === viewerId
    ? contract.negotiations || []
    : (contract.negotiations || []).filter((item) => item.proposerId === viewerId);
  return visible.map((negotiation) => ({
    id: negotiation.id,
    revision: negotiation.revision,
    terms: clone(negotiation.terms),
    createdAt: negotiation.createdAt,
    updatedAt: negotiation.updatedAt,
    expiresAt: negotiation.expiresAt,
    proposerName: contract.publisherId === viewerId
      ? String(playerFor(world, negotiation.proposerId)?.playerName || '议价玩家')
      : null,
    isProposer: negotiation.proposerId === viewerId,
    awaitingMyResponse: contract.publisherId === viewerId
      ? negotiation.lastActionBy !== viewerId
      : negotiation.lastActionBy === contract.publisherId,
  }));
}

function publicContract(world, contract, userId, runtimeIndex) {
  if (contract.kind !== 'supply') return publicCommercialContract(world, contract, userId);
  const gross = batchGross(contract) || 0;
  return {
    id: contract.id,
    kind: 'supply',
    publisherSide: contract.publisherRole,
    publisherId: contract.publisherId,
    publisherName: contract.publisherType === 'market_reserve'
      ? String(contract.publisherName || contract.buyerName || '市场储备')
      : playerDisplayName(world, contract.publisherId),
    publisherType: contract.publisherType,
    fixedTerms: contract.fixedTerms,
    publisherRole: contract.publisherRole,
    buyerId: contract.buyerId,
    buyerName: contract.publisherType === 'market_reserve'
      ? String(contract.buyerName || contract.publisherName || '市场储备')
      : optionalPlayerDisplayName(world, contract.buyerId),
    supplierId: contract.supplierId,
    supplierName: optionalPlayerDisplayName(world, contract.supplierId),
    productId: contract.productId,
    quantityPerDelivery: contract.quantityPerDelivery,
    unitPrice: contract.unitPrice,
    batchGross: gross,
    deliveryIntervalMs: contract.deliveryIntervalMs,
    totalDeliveries: contract.totalDeliveries,
    completedDeliveries: contract.completedDeliveries,
    firstDeliveryDelayMs: contract.firstDeliveryDelayMs,
    createdAt: contract.createdAt,
    offerExpiresAt: contract.offerExpiresAt,
    acceptedAt: contract.acceptedAt,
    nextDueAt: contract.nextDueAt,
    graceEndsAt: contract.graceEndsAt,
    breachedAt: contract.breachedAt,
    status: contract.status,
    roundStatus: contract.roundStatus,
    buyerEscrowCredits: contract.buyerEscrowCredits,
    supplierReservedQuantity: contract.supplierReservedQuantity,
    buyerBondCredits: contract.buyerBondCredits,
    supplierBondCredits: contract.supplierBondCredits,
    buyerAutoFund: contract.buyerAutoFund,
    supplierAutoReserve: contract.supplierAutoReserve,
    renewalProposal: contract.renewalProposal ? {
      ...clone(contract.renewalProposal),
      isProposer: Number(contract.renewalProposal.proposedBy) === Number(userId),
      buyerApproved: Boolean(contract.renewalProposal.buyerApprovedAt),
      supplierApproved: Boolean(contract.renewalProposal.supplierApprovedAt),
      approvedByMe: renewalApprovedBy(contract, contract.renewalProposal, userId),
      awaitingMyApproval: contract.renewalProposal.status === 'proposed'
        && !renewalApprovedBy(contract, contract.renewalProposal, userId),
    } : null,
    negotiations: publicNegotiations(world, contract, userId),
    renewedFromContractId: contract.renewedFromContractId,
    renewedToContractId: contract.renewedToContractId,
    renewalCancellationReason: contract.renewalCancellationReason,
    terminationRequestedBy: contract.terminationRequestedBy,
    terminationReason: contract.terminationReason,
    endedAt: contract.endedAt,
    completedAt: contract.completedAt,
    issue: issueForContract(world, contract, runtimeIndex, userId),
    isPublisher: contract.publisherId === Number(userId),
    isBuyer: contract.buyerId === Number(userId),
    isSupplier: contract.supplierId === Number(userId),
    isParticipant: contract.buyerId === Number(userId) || contract.supplierId === Number(userId),
  };
}

export function createProductionContractClientState(world, userId, now = Date.now()) {
  const runtimeIndex = createContractRuntimeIndex(world);
  const visibleOpen = runtimeIndex.currentOpenContracts()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_VISIBLE_OPEN_CONTRACTS);
  const own = runtimeIndex.ownContractsFor(userId);
  const active = own.filter((contract) => contract.status === 'active');
  const recent = own
    .filter((contract) => !['open', 'active'].includes(contract.status))
    .sort((left, right) => Number(right.endedAt || right.createdAt) - Number(left.endedAt || left.createdAt))
    .slice(0, MAX_VISIBLE_RECENT_CONTRACTS);
  const ownOpen = own.filter((contract) => contract.status === 'open');
  const negotiationAttention = runtimeIndex.currentOpenContracts().reduce((sum, contract) => {
    if (contract.kind !== 'supply') return sum;
    return sum + (contract.negotiations || []).filter((negotiation) => (
      (contract.publisherId === Number(userId) && negotiation.lastActionBy !== Number(userId))
      || (negotiation.proposerId === Number(userId) && negotiation.lastActionBy === contract.publisherId)
    )).length;
  }, 0);
  const byId = new Map([...visibleOpen, ...active, ...recent, ...ownOpen].map((contract) => [contract.id, contract]));
  const productionContracts = [...byId.values()]
    .map((contract) => publicContract(world, contract, userId, runtimeIndex));
  return {
    productionContracts,
    productionContractSummary: {
      active: active.length,
      open: ownOpen.length,
      needsAttention: active.filter((contract) => Boolean(issueForContract(world, contract, runtimeIndex, userId))).length + negotiationAttention,
      upcomingWithin24Hours: active.filter((contract) => contract.nextDueAt !== null && !isConfirmedDefault(contract) && Number(contract.nextDueAt) <= now + 24 * 60 * 60 * 1000).length,
    },
  };
}
