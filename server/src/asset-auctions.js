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

const MAX_BID = 1_000_000_000;
const MAX_AUCTION_HOURS = 168;
const MAX_AUCTION_QUANTITY = 1_000_000;
const MAX_AUCTION_ITEMS = 20;
const MAX_AUCTIONS = 2_000;
const PRODUCTS = new Map(PRODUCT_CATALOG.map((item) => [item.id, item]));
const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((item) => [item.id, item]));

function result(ok, message) { return { ok, message }; }
function integer(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= max ? number : null;
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
  auction.startingBid = integer(auction.startingBid, MAX_BID) || 1;
  auction.highestBid = auction.highestBid ? integer(auction.highestBid, MAX_BID) : null;
  auction.highestBidderId = auction.highestBidderId ? integer(auction.highestBidderId) : null;
  auction.highestBidderName = auction.highestBidderName ? text(auction.highestBidderName, 64) : null;
  auction.createdAt = Number(auction.createdAt || now);
  auction.endsAt = Number(auction.endsAt || now);
  auction.bids = Array.isArray(auction.bids) ? auction.bids.slice(-100) : [];
  auction.status = ['open', 'sold', 'ended', 'cancelled'].includes(auction.status) ? auction.status : 'cancelled';
  auction.escrowStatus = ['held', 'released', 'transferred'].includes(auction.escrowStatus)
    ? auction.escrowStatus
    : auction.status === 'open' ? 'held' : auction.status === 'sold' ? 'transferred' : 'released';
  return auction;
}

function releaseBid(world, auction) {
  if (!auction.highestBidderId || !auction.highestBid) return;
  const bidder = player(world, auction.highestBidderId);
  if (!bidder) return;
  const amount = Math.min(Number(bidder.frozenCredits || 0), Number(auction.highestBid || 0));
  bidder.frozenCredits = Math.max(0, Number(bidder.frozenCredits || 0) - amount);
  bidder.credits = Number(bidder.credits || 0) + amount;
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

function isCurrentAssetAuctionWorld(world) {
  return Number(world?.version || 0) >= 15
    && Array.isArray(world?.assetAuctions)
    && !Object.hasOwn(world, 'collectibleAuctions')
    && !Object.hasOwn(world, 'collectibles')
    && !Object.hasOwn(world, 'collectibleOwnershipHistory')
    && world.assetAuctions.every((auction) => {
      if (!auction || !String(auction.id || '') || !Array.isArray(auction.items)) return false;
      if (auction.items.length < 1 || auction.items.length > MAX_AUCTION_ITEMS) return false;
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
  delete world.collectibleAuctions;
  delete world.collectibles;
  delete world.collectibleOwnershipHistory;
  world.version = 15;
  return world;
}

function releaseAuctionAsset(world, auction) {
  if (auction.escrowStatus !== 'held') return;
  releaseItems(world, auction.sellerId, auctionItems(auction));
  auction.escrowStatus = 'released';
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

function transferAuctionAsset(world, auction, bidder) {
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

function cancelBrokenAuction(world, auction, now) {
  releaseBid(world, auction);
  releaseAuctionAsset(world, auction);
  auction.status = 'cancelled';
  auction.settledAt = now;
}

function settleAuction(world, auction, now) {
  if (auction.status !== 'open') return;
  const seller = player(world, auction.sellerId);
  if (!seller) {
    cancelBrokenAuction(world, auction, now);
    return;
  }
  if (!auction.highestBidderId || !auction.highestBid) {
    releaseAuctionAsset(world, auction);
    auction.status = 'ended';
    auction.settledAt = now;
    return;
  }
  const bidder = player(world, auction.highestBidderId);
  if (!bidder || bidder.frozenCredits < auction.highestBid) {
    cancelBrokenAuction(world, auction, now);
    return;
  }
  const transferred = transferAuctionAsset(world, auction, bidder);
  if (!transferred.ok) {
    cancelBrokenAuction(world, auction, now);
    return;
  }
  bidder.frozenCredits -= auction.highestBid;
  seller.credits += auction.highestBid;
  auction.status = 'sold';
  auction.settledAt = now;
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

function holdAuctionItems(world, seller, userId, items) {
  const inventoriesBefore = structuredClone(seller.inventories || {});
  const facilityGroupsBefore = structuredClone(seller.facilityGroups || []);
  for (const item of items) {
    if (item.assetKind === 'commodity') {
      const inventory = inventoryFor(seller, item.assetId);
      inventory.available -= item.quantity;
      inventory.frozen += item.quantity;
    } else {
      const reserved = reserveFacilityAuctionQuantity(world, userId, item.assetId, item.quantity);
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
  const startingBid = integer(payload.startingBid, MAX_BID);
  const durationHours = integer(payload.durationHours, MAX_AUCTION_HOURS);
  const items = normalizeRequestedItems(payload);
  if (!startingBid || !durationHours || !items) return result(false, '拍卖资产包、起拍价或时长无效');
  const seller = player(world, userId);
  if (!seller) return result(false, '玩家不存在');
  const validation = validateAuctionItems(world, seller, userId, items);
  if (!validation.ok) return validation;
  const held = holdAuctionItems(world, seller, userId, items);
  if (!held.ok) return held;

  const auction = applyAuctionAliases({
    id: `asset-auction-${randomUUID()}`,
    items,
    sellerId: userId,
    sellerName: playerName(world, userId, `玩家 ${userId}`),
    startingBid,
    highestBid: null,
    highestBidderId: null,
    highestBidderName: null,
    status: 'open',
    escrowStatus: 'held',
    createdAt: now,
    endsAt: now + durationHours * 60 * 60 * 1_000,
    bids: [],
  });
  world.assetAuctions.push(auction);
  world.assetAuctions = world.assetAuctions.slice(-MAX_AUCTIONS);
  const label = items.length > 1 ? '资产包' : items[0].assetKind === 'commodity' ? '商品' : '工厂';
  return result(true, `${label}拍卖已发布，资产已冻结且继续计入总资产`);
}

function placeBid(world, userId, payload, now) {
  const auction = world.assetAuctions.find((item) => item.id === String(payload.auctionId || ''));
  if (!auction || auction.status !== 'open') return result(false, '拍卖不存在或已经结束');
  if (auction.endsAt <= now) {
    settleAuction(world, auction, now);
    return result(false, '拍卖已经结束');
  }
  if (auction.sellerId === userId) return result(false, '卖家不能竞拍自己的资产');
  const amount = integer(payload.amount, MAX_BID);
  const minimum = auction.highestBid ? auction.highestBid + 1 : auction.startingBid;
  if (!amount || amount < minimum) return result(false, `出价不得低于 ¤${minimum}`);
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
    const difference = amount - auction.highestBid;
    if (bidder.credits < difference) return result(false, '可用资金不足');
    bidder.credits -= difference;
    bidder.frozenCredits += difference;
  } else {
    if (bidder.credits < amount) return result(false, '可用资金不足');
    const previousBidder = auction.highestBidderId ? player(world, auction.highestBidderId) : null;
    if (previousBidder && auction.highestBid) {
      previousBidder.frozenCredits = Math.max(0, previousBidder.frozenCredits - auction.highestBid);
      previousBidder.credits += auction.highestBid;
    }
    bidder.credits -= amount;
    bidder.frozenCredits += amount;
  }

  auction.highestBid = amount;
  auction.highestBidderId = userId;
  auction.highestBidderName = bidder.playerName;
  auction.bids.push({ bidderId: userId, bidderName: bidder.playerName, amount, createdAt: now });
  auction.bids = auction.bids.slice(-100);
  return result(true, '竞拍出价已提交，资金已冻结');
}

function cancelAuction(world, userId, payload, now) {
  const auction = world.assetAuctions.find((item) => item.id === String(payload.auctionId || ''));
  if (!auction || auction.status !== 'open') return result(false, '拍卖不存在或已经结束');
  if (auction.sellerId !== userId) return result(false, '只能取消自己发起的拍卖');
  if (auction.highestBidderId) return result(false, '已有出价的拍卖不能取消');
  releaseAuctionAsset(world, auction);
  auction.status = 'cancelled';
  auction.settledAt = now;
  return result(true, '拍卖已取消，资产已解冻');
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
  return {
    ...auction,
    items: auctionItems(auction).map((item) => ({ ...item })),
    itemSummaries,
    itemCount: itemSummaries.length,
    isBundle: itemSummaries.length > 1,
    asset,
    isSeller: auction.sellerId === userId,
    isHighestBidder: auction.highestBidderId === userId,
    minimumBid: auction.highestBid ? auction.highestBid + 1 : auction.startingBid,
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
