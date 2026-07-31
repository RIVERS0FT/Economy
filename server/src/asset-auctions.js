import { randomUUID } from 'node:crypto';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './domain.js';
import {
  releaseFacilityAuctionQuantity,
  reserveFacilityAuctionQuantity,
  transferFacilityAuctionQuantity,
  validateFacilityAuctionQuantity,
  validateFacilityAuctionTransferQuantity,
} from './facility-groups.js';
import { createWarehouseUsage, ensureWarehouse } from './warehouse.js';
import {
  calculateRateMoney,
  ceilPlayerMoney,
  normalizePlayerMoneyInput,
  roundInternalMoney,
} from './money.js';
import { creditPopulationEmployment } from './population-economy.js';
import { queueAuctionAuditEvent } from './auction-audit-store.js';

export const ASSET_AUCTION_RULE_VERSION = 2;
export const AUCTION_LISTING_FEE_RATE_BPS = 20;
export const AUCTION_LISTING_FEE_MINIMUM = 0.5;
export const AUCTION_LISTING_FEE_MAXIMUM = 100;
export const AUCTION_SELLER_FEE_BPS = 100;
export const AUCTION_BUYER_FEE_BPS = 0;
export const AUCTION_MINIMUM_INCREMENT_RATE_BPS = 200;
export const AUCTION_EXTENSION_WINDOW_MS = 2 * 60 * 1_000;
export const AUCTION_EXTENSION_DURATION_MS = 2 * 60 * 1_000;
export const AUCTION_MAX_EXTENSION_MS = 30 * 60 * 1_000;
export const AUCTION_RECENT_BID_LIMIT = 10;

const BASIS_POINTS = 10_000;
const MAX_BID = 1_000_000_000;
const MAX_AUCTION_HOURS = 168;
const MAX_AUCTION_QUANTITY = 1_000_000;
const MAX_AUCTION_ITEMS = 20;
const MAX_AUCTIONS = 2_000;
const PRODUCTS = new Map(PRODUCT_CATALOG.map((item) => [item.id, item]));
const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((item) => [item.id, item]));
const TERMINAL_REASONS = new Set([
  'sold', 'no_bid', 'reserve_not_met', 'seller_cancelled', 'settlement_failed', 'migration_cancelled',
]);

function result(ok, message) { return { ok, message }; }
function integer(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= max ? number : null;
}
function money(value, max = MAX_BID) {
  return normalizePlayerMoneyInput(value, { min: 0.01, max });
}
function optionalMoney(value, max = MAX_BID) {
  if (value === null || value === undefined || value === '') return null;
  return money(value, max);
}
function text(value, max, fallback = '') {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  return (normalized || fallback).slice(0, max);
}
function player(world, id) { return world.players?.[String(id)] || null; }
function playerName(world, id, fallback = '未分配') { return player(world, id)?.playerName || fallback; }
function inventoryFor(account, productId) {
  account.inventories ||= {};
  account.inventories[productId] ||= { available: 0, frozen: 0 };
  return account.inventories[productId];
}
function addMoney(left, right) { return roundInternalMoney(Number(left || 0) + Number(right || 0)) || 0; }
function subtractMoney(left, right) { return Math.max(0, roundInternalMoney(Number(left || 0) - Number(right || 0)) || 0); }

export function calculateAuctionListingFee(startingBid, reservePrice = null) {
  const starting = money(startingBid, MAX_BID);
  const reserve = optionalMoney(reservePrice, MAX_BID);
  if (!starting || (reserve !== null && reserve < starting)) return null;
  const basis = Math.max(starting, reserve || 0);
  const proportional = calculateRateMoney(basis, AUCTION_LISTING_FEE_RATE_BPS, BASIS_POINTS, 'ceil');
  const ticked = ceilPlayerMoney(proportional ?? 0) ?? AUCTION_LISTING_FEE_MINIMUM;
  return Math.min(AUCTION_LISTING_FEE_MAXIMUM, Math.max(AUCTION_LISTING_FEE_MINIMUM, ticked));
}

export function calculateAuctionMinimumIncrement(startingBid) {
  const starting = money(startingBid, MAX_BID);
  if (!starting) return null;
  const proportional = calculateRateMoney(starting, AUCTION_MINIMUM_INCREMENT_RATE_BPS, BASIS_POINTS, 'ceil');
  return Math.max(0.01, ceilPlayerMoney(proportional ?? 0) ?? 0.01);
}

function explicitAssetKind(raw) {
  if (raw?.assetKind === 'commodity' || raw?.assetKind === 'facility' || raw?.assetKind === 'collectible') {
    return raw.assetKind;
  }
  if (raw?.productId) return 'commodity';
  if (raw?.facilityTypeId) return 'facility';
  if (raw?.collectibleId) return 'collectible';
  return null;
}

function migrationAuctionItem(raw) {
  const assetKind = explicitAssetKind(raw);
  if (!assetKind) return null;
  const assetId = assetKind === 'commodity'
    ? String(raw?.assetId || raw?.productId || '')
    : assetKind === 'facility'
      ? String(raw?.assetId || raw?.facilityTypeId || '')
      : String(raw?.assetId || raw?.collectibleId || '');
  const quantity = assetKind === 'collectible' ? 1 : integer(raw?.quantity, MAX_AUCTION_QUANTITY);
  return assetId && quantity ? { assetKind, assetId, quantity } : null;
}

function normalizeAuctionItem(raw) {
  const item = migrationAuctionItem(raw);
  return item && item.assetKind !== 'collectible' ? item : null;
}

function normalizeAuctionItems(source) {
  if (!Array.isArray(source) || source.length < 1 || source.length > MAX_AUCTION_ITEMS) return null;
  const normalized = [];
  const byKey = new Map();
  for (const raw of source) {
    const item = normalizeAuctionItem(raw);
    if (!item) return null;
    const key = `${item.assetKind}:${item.assetId}`;
    const existing = byKey.get(key);
    if (existing) {
      const quantity = existing.quantity + item.quantity;
      if (!integer(quantity, MAX_AUCTION_QUANTITY)) return null;
      existing.quantity = quantity;
    } else {
      normalized.push(item);
      byKey.set(key, item);
    }
  }
  return normalized.length <= MAX_AUCTION_ITEMS ? normalized : null;
}

function migrationAuctionItems(auction) {
  const source = Array.isArray(auction?.items) && auction.items.length > 0 ? auction.items : [auction];
  return source.map(migrationAuctionItem).filter(Boolean);
}

function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) return auction.items;
  const legacy = normalizeAuctionItem(auction);
  return legacy ? [legacy] : [];
}

function applyAuctionAliases(auction) {
  const first = auction.items[0];
  auction.assetKind = first.assetKind;
  auction.assetId = first.assetId;
  auction.quantity = first.quantity;
  if (first.assetKind === 'commodity') auction.productId = first.assetId;
  else delete auction.productId;
  if (first.assetKind === 'facility') auction.facilityTypeId = first.assetId;
  else delete auction.facilityTypeId;
  delete auction.collectibleId;
  return auction;
}

function bidderAliasLetters(index) {
  let value = Math.max(0, Math.floor(Number(index) || 0));
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return letters;
}

function nextBidderLabel(auction) {
  const count = Object.keys(auction.bidderAliases || {}).length;
  return `竞买人 ${bidderAliasLetters(Math.floor(count / 99))}${String((count % 99) + 1).padStart(2, '0')}`;
}

function storedBidderLabel(auction, userId) {
  return auction.bidderAliases?.[String(userId)] || '竞买人';
}

function bidderLabelFor(auction, userId) {
  auction.bidderAliases ||= {};
  const key = String(userId);
  if (!auction.bidderAliases[key]) auction.bidderAliases[key] = nextBidderLabel(auction);
  return auction.bidderAliases[key];
}

function normalizeLegacyBids(auction) {
  auction.bidderAliases = auction.bidderAliases && typeof auction.bidderAliases === 'object'
    ? { ...auction.bidderAliases }
    : {};
  const source = Array.isArray(auction.bids) ? auction.bids : [];
  const normalized = [];
  for (const raw of source) {
    const bidderId = integer(raw?.bidderId);
    const amount = money(raw?.amount, MAX_BID);
    const createdAt = Math.max(0, Number(raw?.createdAt || auction.createdAt || 0));
    if (!bidderId || !amount) continue;
    const bidderLabel = bidderLabelFor(auction, bidderId);
    normalized.push({ bidderId, bidderLabel, amount, createdAt });
  }
  auction.bids = normalized.slice(-AUCTION_RECENT_BID_LIMIT);
  auction.bidCount = Math.max(Number(auction.bidCount || 0), source.length, normalized.length);
  auction.latestBidAt = normalized.at(-1)?.createdAt ?? (auction.latestBidAt ? Number(auction.latestBidAt) : null);
}

function normalizeAuction(rawAuction, now, items = undefined) {
  const auction = { ...rawAuction };
  const normalizedItems = normalizeAuctionItems(items || (Array.isArray(auction.items) ? auction.items : [auction]));
  if (!normalizedItems) return null;
  auction.items = normalizedItems;
  applyAuctionAliases(auction);
  auction.id = String(auction.id || '');
  if (!auction.id) return null;
  auction.sellerId = integer(auction.sellerId) || 0;
  auction.sellerName = text(auction.sellerName, 64, `玩家 ${auction.sellerId}`);
  auction.startingBid = money(auction.startingBid, MAX_BID) || 0.01;
  auction.highestBid = auction.highestBid ? money(auction.highestBid, MAX_BID) : null;
  auction.highestBidderId = auction.highestBidderId ? integer(auction.highestBidderId) : null;
  auction.createdAt = Math.max(0, Number(auction.createdAt || now));
  auction.endsAt = Math.max(auction.createdAt, Number(auction.endsAt || now));
  auction.status = ['open', 'sold', 'ended', 'cancelled'].includes(auction.status) ? auction.status : 'cancelled';
  auction.escrowStatus = ['held', 'released', 'transferred'].includes(auction.escrowStatus)
    ? auction.escrowStatus
    : auction.status === 'open' ? 'held' : auction.status === 'sold' ? 'transferred' : 'released';

  const currentRules = Number(auction.auctionRuleVersion || 0) >= ASSET_AUCTION_RULE_VERSION;
  auction.auctionRuleVersion = currentRules ? ASSET_AUCTION_RULE_VERSION : 1;
  auction.reservePrice = currentRules ? optionalMoney(auction.reservePrice, MAX_BID) : auction.startingBid;
  if (auction.reservePrice !== null && auction.reservePrice < auction.startingBid) auction.reservePrice = auction.startingBid;
  auction.minimumIncrement = currentRules
    ? (money(auction.minimumIncrement, MAX_BID) || calculateAuctionMinimumIncrement(auction.startingBid) || 0.01)
    : 0.01;
  auction.originalEndsAt = currentRules ? Math.max(auction.createdAt, Number(auction.originalEndsAt || auction.endsAt)) : auction.endsAt;
  auction.extensionWindowMs = currentRules ? Math.max(0, Number(auction.extensionWindowMs ?? AUCTION_EXTENSION_WINDOW_MS)) : 0;
  auction.extensionDurationMs = currentRules ? Math.max(0, Number(auction.extensionDurationMs ?? AUCTION_EXTENSION_DURATION_MS)) : 0;
  auction.maxExtensionMs = currentRules ? Math.max(0, Number(auction.maxExtensionMs ?? AUCTION_MAX_EXTENSION_MS)) : 0;
  auction.extensionCount = currentRules ? Math.max(0, Math.floor(Number(auction.extensionCount || 0))) : 0;
  auction.listingFeeRuleVersion = currentRules ? 1 : 0;
  auction.listingFee = currentRules ? Math.max(0, roundInternalMoney(auction.listingFee || 0) || 0) : 0;
  auction.listingFeeStatus = currentRules && ['held', 'distributed', 'refunded'].includes(auction.listingFeeStatus)
    ? auction.listingFeeStatus
    : 'none';
  auction.sellerFeeBps = currentRules ? Math.max(0, Math.floor(Number(auction.sellerFeeBps ?? AUCTION_SELLER_FEE_BPS))) : 0;
  auction.buyerFeeBps = currentRules ? Math.max(0, Math.floor(Number(auction.buyerFeeBps ?? AUCTION_BUYER_FEE_BPS))) : 0;
  auction.sellerFee = auction.sellerFee === null || auction.sellerFee === undefined
    ? null
    : Math.max(0, roundInternalMoney(auction.sellerFee) || 0);
  auction.sellerNetProceeds = auction.sellerNetProceeds === null || auction.sellerNetProceeds === undefined
    ? null
    : Math.max(0, roundInternalMoney(auction.sellerNetProceeds) || 0);
  auction.settlementReason = TERMINAL_REASONS.has(auction.settlementReason) ? auction.settlementReason : null;
  delete auction.highestBidderName;
  normalizeLegacyBids(auction);
  if (auction.highestBidderId) bidderLabelFor(auction, auction.highestBidderId);
  return auction;
}

function releaseBid(world, auction) {
  if (!auction.highestBidderId || !auction.highestBid) return 0;
  const bidder = player(world, auction.highestBidderId);
  if (!bidder) return 0;
  const amount = Math.min(Number(bidder.frozenCredits || 0), Number(auction.highestBid || 0));
  bidder.frozenCredits = subtractMoney(bidder.frozenCredits, amount);
  bidder.credits = addMoney(bidder.credits, amount);
  return amount;
}

function releaseItems(world, sellerId, items) {
  const seller = player(world, sellerId);
  for (const item of items) {
    if (item.assetKind === 'commodity' && seller) {
      const inventory = inventoryFor(seller, item.assetId);
      const quantity = Math.min(Number(inventory.frozen || 0), item.quantity);
      inventory.frozen = Math.max(0, Number(inventory.frozen || 0) - quantity);
      inventory.available = Number(inventory.available || 0) + quantity;
    } else if (item.assetKind === 'facility') {
      releaseFacilityAuctionQuantity(world, sellerId, item.assetId, item.quantity);
    }
  }
}

function releaseAuctionAsset(world, auction) {
  if (auction.escrowStatus !== 'held') return;
  releaseItems(world, auction.sellerId, auctionItems(auction));
  auction.escrowStatus = 'released';
}

function distributeListingFee(world, auction, now, reason) {
  if (auction.listingFeeStatus !== 'held' || auction.listingFee <= 0) return 0;
  const fee = Math.min(Number(world.auctionFeeEscrowCredits || 0), Number(auction.listingFee || 0));
  world.auctionFeeEscrowCredits = subtractMoney(world.auctionFeeEscrowCredits, fee);
  creditPopulationEmployment(world, fee, 'marketService');
  const seller = player(world, auction.sellerId);
  if (seller) {
    seller.stats ||= {};
    seller.stats.marketServiceFees = addMoney(seller.stats.marketServiceFees, fee);
    seller.stats.employmentPayments = addMoney(seller.stats.employmentPayments, fee);
  }
  auction.listingFeeStatus = 'distributed';
  queueAuctionAuditEvent(world, {
    auctionId: auction.id,
    eventType: 'listing_fee_distributed',
    actorUserId: auction.sellerId,
    amount: fee,
    metadata: { reason },
    createdAt: now,
  });
  return fee;
}

function refundListingFee(world, auction, now, reason) {
  if (auction.listingFeeStatus !== 'held' || auction.listingFee <= 0) return 0;
  const seller = player(world, auction.sellerId);
  if (!seller) {
    queueAuctionAuditEvent(world, {
      auctionId: auction.id,
      eventType: 'listing_fee_refund_deferred',
      actorUserId: auction.sellerId,
      amount: auction.listingFee,
      metadata: { reason, missingSeller: true },
      createdAt: now,
    });
    return 0;
  }
  const fee = Math.min(Number(world.auctionFeeEscrowCredits || 0), Number(auction.listingFee || 0));
  world.auctionFeeEscrowCredits = subtractMoney(world.auctionFeeEscrowCredits, fee);
  seller.credits = addMoney(seller.credits, fee);
  auction.listingFeeStatus = 'refunded';
  queueAuctionAuditEvent(world, {
    auctionId: auction.id,
    eventType: 'listing_fee_refunded',
    actorUserId: auction.sellerId,
    amount: fee,
    metadata: { reason },
    createdAt: now,
  });
  return fee;
}

function isCurrentAssetAuctionWorld(world) {
  return Number(world?.version || 0) >= 21
    && Number.isFinite(Number(world?.auctionFeeEscrowCredits))
    && Array.isArray(world?.assetAuctions)
    && !Object.hasOwn(world, 'collectibleAuctions')
    && !Object.hasOwn(world, 'collectibles')
    && !Object.hasOwn(world, 'collectibleOwnershipHistory')
    && world.assetAuctions.every((auction) => {
      if (!auction || !String(auction.id || '') || !Array.isArray(auction.items)) return false;
      if (auction.items.length < 1 || auction.items.length > MAX_AUCTION_ITEMS) return false;
      if (!Number.isInteger(Number(auction.auctionRuleVersion))) return false;
      return auction.items.every((item) => {
        const quantity = integer(item?.quantity, MAX_AUCTION_QUANTITY);
        if (!quantity) return false;
        if (item.assetKind === 'commodity') return PRODUCTS.has(String(item.assetId || ''));
        if (item.assetKind === 'facility') return FACILITY_TYPES.has(String(item.assetId || ''));
        return false;
      });
    });
}

function cancelLegacyCollectibleAuction(world, auction, items, now) {
  if (auction.status !== 'open') return;
  releaseBid(world, auction);
  if (auction.escrowStatus !== 'released' && auction.escrowStatus !== 'transferred') {
    releaseItems(world, auction.sellerId, items.filter((item) => item.assetKind !== 'collectible'));
  }
  auction.status = 'cancelled';
  auction.escrowStatus = 'released';
  auction.settlementReason = 'migration_cancelled';
  auction.settledAt = now;
}

export function migrateAssetAuctionWorld(world, now = Date.now()) {
  if (isCurrentAssetAuctionWorld(world)) return world;
  const legacyAuctions = Array.isArray(world.collectibleAuctions) ? world.collectibleAuctions : [];
  const currentAuctions = Array.isArray(world.assetAuctions) ? world.assetAuctions : [];
  const byId = new Map();
  for (const auction of [...legacyAuctions, ...currentAuctions]) {
    const id = String(auction?.id || '');
    if (id) byId.set(id, auction);
  }

  const migrated = [];
  for (const rawAuction of byId.values()) {
    const items = migrationAuctionItems(rawAuction);
    if (items.length < 1 || items.length > MAX_AUCTION_ITEMS) continue;
    if (items.some((item) => item.assetKind === 'collectible')) {
      cancelLegacyCollectibleAuction(world, rawAuction, items, now);
      continue;
    }
    const auction = normalizeAuction(rawAuction, now, items);
    if (auction) migrated.push(auction);
  }

  world.assetAuctions = migrated.slice(-MAX_AUCTIONS);
  world.auctionFeeEscrowCredits = migrated.reduce((sum, auction) => (
    auction.listingFeeStatus === 'held' ? addMoney(sum, auction.listingFee) : sum
  ), 0);
  delete world.collectibleAuctions;
  delete world.collectibles;
  delete world.collectibleOwnershipHistory;
  world.version = 21;
  return world;
}

function validateAuctionTransfer(world, auction, bidder) {
  const seller = player(world, auction.sellerId);
  if (!seller) return result(false, '卖家不存在');
  for (const item of auctionItems(auction)) {
    if (item.assetKind === 'commodity') {
      if (inventoryFor(seller, item.assetId).frozen < item.quantity) return result(false, '拍卖商品冻结数量不足');
    } else {
      const validation = validateFacilityAuctionTransferQuantity(world, auction.sellerId, item.assetId, item.quantity);
      if (!validation.ok) return validation;
    }
  }
  ensureWarehouse(bidder);
  if (createWarehouseUsage(world, bidder).warehouseUsedCapacity > bidder.inventoryCapacity) {
    return result(false, '买家仓库容量不足');
  }
  return result(true, '拍卖资产可以转移');
}

function transferAuctionAsset(world, auction, bidder, now) {
  const seller = player(world, auction.sellerId);
  const validation = validateAuctionTransfer(world, auction, bidder);
  if (!seller || !validation.ok) return validation;
  const sellerSnapshot = structuredClone(seller);
  const bidderSnapshot = structuredClone(bidder);
  try {
    for (const item of auctionItems(auction).filter((entry) => entry.assetKind === 'facility')) {
      const transferred = transferFacilityAuctionQuantity(
        world,
        auction.sellerId,
        auction.highestBidderId,
        item.assetId,
        item.quantity,
        now,
      );
      if (!transferred.ok) throw new Error(transferred.message);
    }
    for (const item of auctionItems(auction)) {
      if (item.assetKind === 'commodity') {
        const sellerInventory = inventoryFor(seller, item.assetId);
        sellerInventory.frozen -= item.quantity;
        inventoryFor(bidder, item.assetId).available += item.quantity;
        seller.stats ||= {};
        bidder.stats ||= {};
        seller.stats.commodityVolume = Number(seller.stats.commodityVolume || 0) + item.quantity;
        bidder.stats.commodityVolume = Number(bidder.stats.commodityVolume || 0) + item.quantity;
        seller.stats.soldGoods = Number(seller.stats.soldGoods || 0) + item.quantity;
        bidder.stats.boughtGoods = Number(bidder.stats.boughtGoods || 0) + item.quantity;
      }
    }
    const onlyItem = auction.items.length === 1 ? auction.items[0] : null;
    if (onlyItem?.assetKind === 'facility') {
      seller.stats ||= {};
      bidder.stats ||= {};
      seller.stats.facilityVolume = Number(seller.stats.facilityVolume || 0) + auction.highestBid;
      bidder.stats.facilityVolume = Number(bidder.stats.facilityVolume || 0) + auction.highestBid;
    }
  } catch (error) {
    world.players[String(auction.sellerId)] = sellerSnapshot;
    world.players[String(auction.highestBidderId)] = bidderSnapshot;
    return result(false, error instanceof Error ? error.message : '拍卖资产转移失败');
  }
  auction.escrowStatus = 'transferred';
  return result(true, '拍卖资产包已整体转移');
}

function finalizeAuction(world, auction, now, status, reason) {
  auction.status = status;
  auction.settlementReason = reason;
  auction.settledAt = now;
}

function cancelBrokenAuction(world, auction, now, message = '拍卖结算校验失败') {
  const refundedBid = releaseBid(world, auction);
  releaseAuctionAsset(world, auction);
  const refundedListingFee = refundListingFee(world, auction, now, 'settlement_failed');
  finalizeAuction(world, auction, now, 'cancelled', 'settlement_failed');
  queueAuctionAuditEvent(world, {
    auctionId: auction.id,
    eventType: 'settlement_failed',
    amount: refundedBid,
    metadata: { message, refundedListingFee },
    createdAt: now,
  });
}

function settleAuction(world, auction, now) {
  if (auction.status !== 'open') return;
  const seller = player(world, auction.sellerId);
  if (!seller) {
    cancelBrokenAuction(world, auction, now, '卖家不存在');
    return;
  }
  if (!auction.highestBidderId || !auction.highestBid) {
    releaseAuctionAsset(world, auction);
    const listingFee = distributeListingFee(world, auction, now, 'no_bid');
    finalizeAuction(world, auction, now, 'ended', 'no_bid');
    queueAuctionAuditEvent(world, {
      auctionId: auction.id,
      eventType: 'ended_without_bid',
      amount: listingFee,
      metadata: { listingFee },
      createdAt: now,
    });
    return;
  }
  const reserve = auction.reservePrice || auction.startingBid;
  if (auction.highestBid < reserve) {
    const refundedBid = releaseBid(world, auction);
    releaseAuctionAsset(world, auction);
    const listingFee = distributeListingFee(world, auction, now, 'reserve_not_met');
    finalizeAuction(world, auction, now, 'ended', 'reserve_not_met');
    queueAuctionAuditEvent(world, {
      auctionId: auction.id,
      eventType: 'ended_below_reserve',
      amount: refundedBid,
      metadata: { listingFee },
      createdAt: now,
    });
    return;
  }
  const bidder = player(world, auction.highestBidderId);
  if (!bidder || Number(bidder.frozenCredits || 0) < auction.highestBid) {
    cancelBrokenAuction(world, auction, now, '最高出价资金不足');
    return;
  }
  const transferred = transferAuctionAsset(world, auction, bidder, now);
  if (!transferred.ok) {
    cancelBrokenAuction(world, auction, now, transferred.message);
    return;
  }

  const sellerFee = auction.sellerFeeBps > 0
    ? (calculateRateMoney(auction.highestBid, auction.sellerFeeBps, BASIS_POINTS, 'half-up') || 0)
    : 0;
  const net = Math.max(0, roundInternalMoney(auction.highestBid - sellerFee) || 0);
  bidder.frozenCredits = subtractMoney(bidder.frozenCredits, auction.highestBid);
  seller.credits = addMoney(seller.credits, net);
  if (sellerFee > 0) {
    creditPopulationEmployment(world, sellerFee, 'marketService');
    seller.stats ||= {};
    seller.stats.marketServiceFees = addMoney(seller.stats.marketServiceFees, sellerFee);
    seller.stats.employmentPayments = addMoney(seller.stats.employmentPayments, sellerFee);
  }
  const listingFee = distributeListingFee(world, auction, now, 'sold');
  if (sellerFee > 0) {
    queueAuctionAuditEvent(world, {
      auctionId: auction.id,
      eventType: 'seller_fee_charged',
      actorUserId: auction.sellerId,
      amount: sellerFee,
      metadata: { gross: auction.highestBid, sellerFeeBps: auction.sellerFeeBps, net },
      createdAt: now,
    });
  }
  auction.sellerFee = sellerFee;
  auction.sellerNetProceeds = net;
  finalizeAuction(world, auction, now, 'sold', 'sold');
  queueAuctionAuditEvent(world, {
    auctionId: auction.id,
    eventType: 'settled',
    actorUserId: auction.highestBidderId,
    amount: auction.highestBid,
    metadata: { sellerFee, sellerNetProceeds: net, listingFee },
    createdAt: now,
  });
}

export function processAssetAuctions(world, now = Date.now()) {
  migrateAssetAuctionWorld(world, now);
  for (const auction of world.assetAuctions) {
    if (auction.status === 'open' && Number(auction.endsAt) <= now) settleAuction(world, auction, now);
  }
  return world;
}

function normalizeRequestedItems(payload) {
  const source = Array.isArray(payload.items) ? payload.items : [payload];
  return normalizeAuctionItems(source);
}

function validateAuctionItems(world, seller, userId, items) {
  for (const item of items) {
    if (item.assetKind === 'commodity') {
      if (!PRODUCTS.has(item.assetId)) return result(false, '商品不存在');
      if (inventoryFor(seller, item.assetId).available < item.quantity) return result(false, '可拍卖商品数量不足');
    } else {
      if (!FACILITY_TYPES.has(item.assetId)) return result(false, '工厂类型不存在');
      const validation = validateFacilityAuctionQuantity(world, userId, item.assetId, item.quantity);
      if (!validation.ok) return validation;
    }
  }
  return result(true, '资产包可以冻结');
}

function holdAuctionItems(world, seller, userId, items, now) {
  const inventoriesBefore = structuredClone(seller.inventories || {});
  const facilityGroupsBefore = structuredClone(seller.facilityGroups || []);
  for (const item of items) {
    if (item.assetKind === 'commodity') {
      const inventory = inventoryFor(seller, item.assetId);
      inventory.available -= item.quantity;
      inventory.frozen += item.quantity;
    } else {
      const reserved = reserveFacilityAuctionQuantity(world, userId, item.assetId, item.quantity, now);
      if (!reserved.ok) {
        seller.inventories = inventoriesBefore;
        seller.facilityGroups = facilityGroupsBefore;
        return reserved;
      }
    }
  }
  return result(true, '资产包已冻结');
}

function createAuction(world, userId, payload, now) {
  const startingBid = money(payload.startingBid, MAX_BID);
  const reservePrice = optionalMoney(payload.reservePrice, MAX_BID);
  const durationHours = integer(payload.durationHours, MAX_AUCTION_HOURS);
  const items = normalizeRequestedItems(payload);
  if (!startingBid || !durationHours || !items) return result(false, '拍卖资产包、起拍价或时长无效');
  if (reservePrice !== null && reservePrice < startingBid) return result(false, '保留价不得低于起拍价');
  const listingFee = calculateAuctionListingFee(startingBid, reservePrice);
  const minimumIncrement = calculateAuctionMinimumIncrement(startingBid);
  if (listingFee === null || minimumIncrement === null) return result(false, '拍卖收费规则计算失败');
  const seller = player(world, userId);
  if (!seller) return result(false, '玩家不存在');
  if (Number(seller.credits || 0) < listingFee) return result(false, `可用资金不足，发布需要支付 ¤${listingFee.toFixed(2)}`);
  const validation = validateAuctionItems(world, seller, userId, items);
  if (!validation.ok) return validation;

  const sellerSnapshot = structuredClone(seller);
  const escrowBefore = Number(world.auctionFeeEscrowCredits || 0);
  seller.credits = subtractMoney(seller.credits, listingFee);
  world.auctionFeeEscrowCredits = addMoney(world.auctionFeeEscrowCredits, listingFee);
  const held = holdAuctionItems(world, seller, userId, items, now);
  if (!held.ok) {
    world.players[String(userId)] = sellerSnapshot;
    world.auctionFeeEscrowCredits = escrowBefore;
    return held;
  }

  const originalEndsAt = now + durationHours * 60 * 60 * 1_000;
  const auction = applyAuctionAliases({
    id: `asset-auction-${randomUUID()}`,
    auctionRuleVersion: ASSET_AUCTION_RULE_VERSION,
    items,
    sellerId: userId,
    sellerName: playerName(world, userId, `玩家 ${userId}`),
    startingBid,
    reservePrice,
    minimumIncrement,
    highestBid: null,
    highestBidderId: null,
    bidderAliases: {},
    bidCount: 0,
    latestBidAt: null,
    status: 'open',
    escrowStatus: 'held',
    createdAt: now,
    originalEndsAt,
    endsAt: originalEndsAt,
    extensionWindowMs: AUCTION_EXTENSION_WINDOW_MS,
    extensionDurationMs: AUCTION_EXTENSION_DURATION_MS,
    maxExtensionMs: AUCTION_MAX_EXTENSION_MS,
    extensionCount: 0,
    listingFeeRuleVersion: 1,
    listingFee,
    listingFeeStatus: 'held',
    sellerFeeBps: AUCTION_SELLER_FEE_BPS,
    buyerFeeBps: AUCTION_BUYER_FEE_BPS,
    sellerFee: null,
    sellerNetProceeds: null,
    settlementReason: null,
    bids: [],
  });
  world.assetAuctions.push(auction);
  world.assetAuctions = world.assetAuctions.slice(-MAX_AUCTIONS);
  queueAuctionAuditEvent(world, {
    auctionId: auction.id,
    eventType: 'created',
    actorUserId: userId,
    amount: listingFee,
    metadata: {
      startingBid,
      hasReserve: reservePrice !== null,
      minimumIncrement,
      originalEndsAt,
      listingFee,
      sellerFeeBps: AUCTION_SELLER_FEE_BPS,
    },
    createdAt: now,
  });
  const label = items.length > 1 ? '资产包' : items[0].assetKind === 'commodity' ? '商品' : '工厂';
  return result(true, `${label}拍卖已发布，已支付发布费 ¤${listingFee.toFixed(2)}，资产已冻结`);
}

function minimumBidFor(auction) {
  if (!auction.highestBid) return auction.startingBid;
  return Math.min(MAX_BID, roundInternalMoney(auction.highestBid + auction.minimumIncrement) || MAX_BID);
}

function extendAuctionDeadline(auction, now) {
  if (auction.extensionWindowMs <= 0 || auction.extensionDurationMs <= 0 || auction.maxExtensionMs <= 0) return null;
  if (auction.endsAt - now > auction.extensionWindowMs) return null;
  const maximum = auction.originalEndsAt + auction.maxExtensionMs;
  const next = Math.min(maximum, Math.max(auction.endsAt, now + auction.extensionDurationMs));
  if (next <= auction.endsAt) return null;
  const previous = auction.endsAt;
  auction.endsAt = next;
  auction.extensionCount += 1;
  return { previous, next };
}

function placeBid(world, userId, payload, now) {
  const auction = world.assetAuctions.find((item) => item.id === String(payload.auctionId || ''));
  if (!auction || auction.status !== 'open') return result(false, '拍卖不存在或已经结束');
  if (auction.endsAt <= now) {
    settleAuction(world, auction, now);
    return result(false, '拍卖已经结束');
  }
  if (auction.sellerId === userId) return result(false, '卖家不能竞拍自己的资产');
  const amount = money(payload.amount, MAX_BID);
  const minimum = minimumBidFor(auction);
  if (!amount || amount < minimum) return result(false, `出价不得低于 ¤${minimum.toFixed(2)}`);
  const bidder = player(world, userId);
  if (!bidder) return result(false, '玩家不存在');

  const requiredCommodityCapacity = auctionItems(auction)
    .filter((item) => item.assetKind === 'commodity')
    .reduce((sum, item) => sum + item.quantity, 0);
  if (requiredCommodityCapacity > 0 && auction.highestBidderId !== userId) {
    ensureWarehouse(bidder);
    if (createWarehouseUsage(world, bidder).warehouseAvailableCapacity < requiredCommodityCapacity) {
      return result(false, '仓库剩余容量不足，无法竞拍该资产包');
    }
  }

  if (auction.highestBidderId === userId && auction.highestBid) {
    const difference = roundInternalMoney(amount - auction.highestBid) || 0;
    if (Number(bidder.credits || 0) < difference) return result(false, '可用资金不足');
    bidder.credits = subtractMoney(bidder.credits, difference);
    bidder.frozenCredits = addMoney(bidder.frozenCredits, difference);
  } else {
    if (Number(bidder.credits || 0) < amount) return result(false, '可用资金不足');
    const previousBidder = auction.highestBidderId ? player(world, auction.highestBidderId) : null;
    if (previousBidder && auction.highestBid) {
      const releasedAmount = auction.highestBid;
      const releasedBidderId = auction.highestBidderId;
      previousBidder.frozenCredits = subtractMoney(previousBidder.frozenCredits, releasedAmount);
      previousBidder.credits = addMoney(previousBidder.credits, releasedAmount);
      queueAuctionAuditEvent(world, {
        auctionId: auction.id,
        eventType: 'previous_bid_released',
        actorUserId: releasedBidderId,
        amount: releasedAmount,
        metadata: { bidderLabel: storedBidderLabel(auction, releasedBidderId) },
        createdAt: now,
      });
    }
    bidder.credits = subtractMoney(bidder.credits, amount);
    bidder.frozenCredits = addMoney(bidder.frozenCredits, amount);
  }

  const bidderLabel = bidderLabelFor(auction, userId);
  const extension = extendAuctionDeadline(auction, now);
  auction.highestBid = amount;
  auction.highestBidderId = userId;
  auction.bidCount = Math.max(0, Number(auction.bidCount || 0)) + 1;
  auction.latestBidAt = now;
  auction.bids.push({ bidderId: userId, bidderLabel, amount, createdAt: now });
  auction.bids = auction.bids.slice(-AUCTION_RECENT_BID_LIMIT);
  queueAuctionAuditEvent(world, {
    auctionId: auction.id,
    eventType: 'bid_placed',
    actorUserId: userId,
    amount,
    previousEndsAt: extension?.previous ?? auction.endsAt,
    nextEndsAt: extension?.next ?? auction.endsAt,
    metadata: { bidderLabel, extended: Boolean(extension), bidCount: auction.bidCount },
    createdAt: now,
  });
  if (extension) {
    queueAuctionAuditEvent(world, {
      auctionId: auction.id,
      eventType: 'deadline_extended',
      actorUserId: userId,
      amount,
      previousEndsAt: extension.previous,
      nextEndsAt: extension.next,
      metadata: { bidderLabel, extensionCount: auction.extensionCount },
      createdAt: now,
    });
  }
  return result(true, extension
    ? '竞拍出价已提交，资金已冻结；结束时间已自动延长'
    : '竞拍出价已提交，资金已冻结');
}

function cancelAuction(world, userId, payload, now) {
  const auction = world.assetAuctions.find((item) => item.id === String(payload.auctionId || ''));
  if (!auction || auction.status !== 'open') return result(false, '拍卖不存在或已经结束');
  if (auction.sellerId !== userId) return result(false, '只能取消自己发起的拍卖');
  if (auction.highestBidderId) return result(false, '已有出价的拍卖不能取消');
  releaseAuctionAsset(world, auction);
  const listingFee = distributeListingFee(world, auction, now, 'seller_cancelled');
  finalizeAuction(world, auction, now, 'cancelled', 'seller_cancelled');
  queueAuctionAuditEvent(world, {
    auctionId: auction.id,
    eventType: 'seller_cancelled',
    actorUserId: userId,
    amount: listingFee,
    metadata: { listingFee },
    createdAt: now,
  });
  return result(true, '拍卖已取消，资产已解冻；发布费不退还');
}

export function applyAssetAuctionAction(world, user, action, payload = {}, now = Date.now()) {
  processAssetAuctions(world, now);
  const userId = Number(user.id);
  if (action === 'createAuction') return createAuction(world, userId, payload, now);
  if (action === 'placeAuctionBid') return placeBid(world, userId, payload, now);
  if (action === 'cancelAuction') return cancelAuction(world, userId, payload, now);
  return result(false, '拍卖操作不存在');
}

function clientAuctionItem(item) {
  if (item.assetKind === 'commodity') {
    const product = PRODUCTS.get(item.assetId);
    return product ? {
      kind: 'commodity', id: product.id, name: product.name, subtitle: '商品资产', quantity: item.quantity,
    } : null;
  }
  const type = FACILITY_TYPES.get(item.assetId);
  return type ? {
    kind: 'facility', id: type.id, name: type.name, subtitle: '工厂资产', quantity: item.quantity,
  } : null;
}

function clientAuction(auction, userId) {
  const itemSummaries = auctionItems(auction).map((item) => clientAuctionItem(item));
  if (itemSummaries.some((item) => !item)) return null;
  const asset = itemSummaries[0];
  const isSeller = auction.sellerId === userId;
  const reserve = auction.reservePrice || auction.startingBid;
  const reserveMet = Boolean(auction.highestBid && auction.highestBid >= reserve);
  return {
    id: auction.id,
    items: auctionItems(auction).map((item) => ({ ...item })),
    itemSummaries,
    itemCount: itemSummaries.length,
    isBundle: itemSummaries.length > 1,
    assetKind: auction.assetKind,
    assetId: auction.assetId,
    ...(auction.productId ? { productId: auction.productId } : {}),
    ...(auction.facilityTypeId ? { facilityTypeId: auction.facilityTypeId } : {}),
    quantity: auction.quantity,
    asset,
    sellerName: auction.sellerName,
    startingBid: auction.startingBid,
    highestBid: auction.highestBid,
    highestBidderLabel: auction.highestBidderId ? storedBidderLabel(auction, auction.highestBidderId) : null,
    status: auction.status,
    escrowStatus: auction.escrowStatus,
    settlementReason: auction.settlementReason,
    createdAt: auction.createdAt,
    originalEndsAt: auction.originalEndsAt,
    endsAt: auction.endsAt,
    settledAt: auction.settledAt,
    extensionCount: auction.extensionCount,
    maxExtendedEndsAt: auction.originalEndsAt + auction.maxExtensionMs,
    minimumIncrement: auction.minimumIncrement,
    minimumBid: minimumBidFor(auction),
    hasBids: Boolean(auction.highestBidderId),
    bidCount: Math.max(0, Number(auction.bidCount || 0)),
    latestBidAt: auction.latestBidAt,
    hasHiddenReserve: auction.auctionRuleVersion >= ASSET_AUCTION_RULE_VERSION && auction.reservePrice !== null,
    reserveMet,
    sellerFeeBps: auction.sellerFeeBps,
    buyerFeeBps: auction.buyerFeeBps,
    isSeller,
    isHighestBidder: auction.highestBidderId === userId,
    ...(isSeller ? {
      reservePrice: auction.reservePrice,
      listingFee: auction.listingFee,
      listingFeeStatus: auction.listingFeeStatus,
      sellerFee: auction.sellerFee,
      sellerNetProceeds: auction.sellerNetProceeds,
    } : {}),
  };
}

export function createAssetAuctionClientState(world, userId, now = Date.now()) {
  processAssetAuctions(world, now);
  return {
    assetAuctions: world.assetAuctions
      .slice()
      .sort((left, right) => (left.status === 'open' ? 0 : 1) - (right.status === 'open' ? 0 : 1) || left.endsAt - right.endsAt)
      .slice(0, 200)
      .map((auction) => clientAuction(auction, userId))
      .filter(Boolean),
  };
}

export function createAuctionBidHistoryFallback(auction, userId) {
  const bids = Array.isArray(auction?.bids) ? auction.bids.slice(-AUCTION_RECENT_BID_LIMIT).reverse() : [];
  return bids.map((bid) => ({
    bidderLabel: String(bid.bidderLabel || bidderLabelFor(auction, bid.bidderId)),
    amount: Number(bid.amount || 0),
    createdAt: Number(bid.createdAt || 0),
    isMine: Number(bid.bidderId) === Number(userId),
  }));
}
