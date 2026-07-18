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

const AIC_API_BASE = 'https://api.artic.edu/api/v1/artworks';
const AIC_IIIF_BASE = 'https://www.artic.edu/iiif/2';
const MAX_BID = 1_000_000_000;
const MAX_AUCTION_HOURS = 168;
const MAX_AUCTION_QUANTITY = 1_000_000;
const MAX_AUCTION_ITEMS = 20;
const MAX_HISTORY = 5_000;
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
function imageUrl(imageId, width) { return `${AIC_IIIF_BASE}/${encodeURIComponent(imageId)}/full/${width},/0/default.jpg`; }
function inventoryFor(account, productId) {
  account.inventories ||= {};
  account.inventories[productId] ||= { available: 0, frozen: 0 };
  return account.inventories[productId];
}
function normalizeAuctionItem(raw) {
  const kind = raw?.assetKind === 'commodity' || raw?.assetKind === 'facility'
    ? raw.assetKind
    : 'collectible';
  const assetId = kind === 'commodity'
    ? String(raw?.assetId || raw?.productId || '')
    : kind === 'facility'
      ? String(raw?.assetId || raw?.facilityTypeId || '')
      : String(raw?.assetId || raw?.collectibleId || '');
  const quantity = kind === 'collectible' ? 1 : integer(raw?.quantity, MAX_AUCTION_QUANTITY);
  return assetId && quantity ? { assetKind: kind, assetId, quantity } : null;
}

function normalizeAuctionItems(source) {
  if (!Array.isArray(source) || source.length < 1 || source.length > MAX_AUCTION_ITEMS) return null;
  const normalized = [];
  const byKey = new Map();
  for (const raw of source) {
    const item = normalizeAuctionItem(raw);
    if (!item) return null;
    const key = `${item.assetKind}:${item.assetId}`;
    if (item.assetKind === 'collectible' && byKey.has(key)) return null;
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
  if (first.assetKind === 'collectible') auction.collectibleId = first.assetId;
  else delete auction.collectibleId;
  if (first.assetKind === 'commodity') auction.productId = first.assetId;
  else delete auction.productId;
  if (first.assetKind === 'facility') auction.facilityTypeId = first.assetId;
  else delete auction.facilityTypeId;
  return auction;
}

function openCollectibleAuction(world, collectibleId) {
  return world.collectibleAuctions.find((auction) => (
    auctionItems(auction).some((item) => item.assetKind === 'collectible' && item.assetId === collectibleId)
    && auction.status === 'open'
  ));
}

function normalizeAuction(auction, now) {
  const legacy = normalizeAuctionItem(auction);
  auction.items = normalizeAuctionItems(Array.isArray(auction.items) ? auction.items : legacy ? [legacy] : [])
    || (legacy ? [legacy] : []);
  if (auction.items.length === 0) auction.items = [{ assetKind: 'collectible', assetId: '', quantity: 1 }];
  applyAuctionAliases(auction);
  auction.sellerId = integer(auction.sellerId) || 0;
  auction.sellerName = text(auction.sellerName, 64, `玩家 ${auction.sellerId}`);
  auction.startingBid = integer(auction.startingBid, MAX_BID) || 1;
  auction.highestBid = auction.highestBid ? integer(auction.highestBid, MAX_BID) : null;
  auction.highestBidderId = auction.highestBidderId ? integer(auction.highestBidderId) : null;
  auction.highestBidderName = auction.highestBidderName ? text(auction.highestBidderName, 64) : null;
  auction.createdAt = Number(auction.createdAt || now);
  auction.endsAt = Number(auction.endsAt || now);
  auction.bids = Array.isArray(auction.bids) ? auction.bids.slice(-100) : [];
  auction.escrowStatus = ['held', 'released', 'transferred'].includes(auction.escrowStatus)
    ? auction.escrowStatus
    : auction.status === 'open' ? 'held' : auction.status === 'sold' ? 'transferred' : 'released';
  return auction;
}

export function migrateCollectibleWorld(world, now = Date.now()) {
  world.collectibles = Array.isArray(world.collectibles) ? world.collectibles : [];
  world.collectibleAuctions = Array.isArray(world.collectibleAuctions) ? world.collectibleAuctions : [];
  world.collectibleOwnershipHistory = Array.isArray(world.collectibleOwnershipHistory)
    ? world.collectibleOwnershipHistory
    : [];
  for (const item of world.collectibles) {
    item.source = 'art-institute-of-chicago';
    item.currentOwnerId = item.currentOwnerId === null || item.currentOwnerId === undefined
      ? null
      : integer(item.currentOwnerId);
    item.createdAt = Number(item.createdAt || now);
    item.createdBy = integer(item.createdBy) || 0;
    item.isPublicDomain = item.isPublicDomain === true;
  }
  world.collectibleAuctions = world.collectibleAuctions.map((auction) => normalizeAuction(auction, now)).slice(-2_000);
  world.collectibleOwnershipHistory = world.collectibleOwnershipHistory.slice(-MAX_HISTORY);
  return world;
}

function appendOwnership(world, collectible, fromOwnerId, toOwnerId, reason, now, details = {}) {
  world.collectibleOwnershipHistory.push({
    id: `collectible-owner-${randomUUID()}`,
    collectibleId: collectible.id,
    fromOwnerId,
    fromOwnerName: fromOwnerId ? playerName(world, fromOwnerId, `玩家 ${fromOwnerId}`) : '',
    toOwnerId,
    toOwnerName: toOwnerId ? playerName(world, toOwnerId, `玩家 ${toOwnerId}`) : '',
    reason,
    auctionId: details.auctionId,
    price: details.price,
    auctionTotalPrice: details.auctionTotalPrice,
    bundleItemCount: details.bundleItemCount,
    createdAt: now,
  });
  world.collectibleOwnershipHistory = world.collectibleOwnershipHistory.slice(-MAX_HISTORY);
}

function releaseBid(world, auction) {
  if (!auction.highestBidderId || !auction.highestBid) return;
  const bidder = player(world, auction.highestBidderId);
  if (!bidder) return;
  const amount = Math.min(Number(bidder.frozenCredits || 0), auction.highestBid);
  bidder.frozenCredits -= amount;
  bidder.credits += amount;
}

function releaseAuctionAsset(world, auction) {
  if (auction.escrowStatus !== 'held') return;
  const seller = player(world, auction.sellerId);
  for (const item of auctionItems(auction)) {
    if (item.assetKind === 'commodity' && seller) {
      const inventory = inventoryFor(seller, item.assetId);
      const quantity = Math.min(inventory.frozen, item.quantity);
      inventory.frozen -= quantity;
      inventory.available += quantity;
    } else if (item.assetKind === 'facility') {
      releaseFacilityAuctionQuantity(world, auction.sellerId, item.assetId, item.quantity);
    }
  }
  auction.escrowStatus = 'released';
}

function validateAuctionTransfer(world, auction, bidder) {
  const seller = player(world, auction.sellerId);
  if (!seller) return result(false, '卖家不存在');
  for (const item of auctionItems(auction)) {
    if (item.assetKind === 'collectible') {
      const collectible = world.collectibles.find((entry) => entry.id === item.assetId);
      if (!collectible || collectible.currentOwnerId !== auction.sellerId) return result(false, '藏品归属异常');
    } else if (item.assetKind === 'commodity') {
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
  const collectibleOwners = new Map(auctionItems(auction)
    .filter((item) => item.assetKind === 'collectible')
    .map((item) => [item.assetId, world.collectibles.find((entry) => entry.id === item.assetId)?.currentOwnerId]));
  const ownershipLength = world.collectibleOwnershipHistory.length;
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
      if (item.assetKind === 'collectible') {
        const collectible = world.collectibles.find((entry) => entry.id === item.assetId);
        const previousOwnerId = collectible.currentOwnerId;
        collectible.currentOwnerId = auction.highestBidderId;
        appendOwnership(world, collectible, previousOwnerId, auction.highestBidderId, 'auction', now, {
          auctionId: auction.id,
          price: auction.items.length === 1 ? auction.highestBid : undefined,
          auctionTotalPrice: auction.items.length > 1 ? auction.highestBid : undefined,
          bundleItemCount: auction.items.length > 1 ? auction.items.length : undefined,
        });
      } else if (item.assetKind === 'commodity') {
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
    for (const [collectibleId, ownerId] of collectibleOwners) {
      const collectible = world.collectibles.find((entry) => entry.id === collectibleId);
      if (collectible) collectible.currentOwnerId = ownerId;
    }
    world.collectibleOwnershipHistory.length = ownershipLength;
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
  const transferred = transferAuctionAsset(world, auction, bidder, now);
  if (!transferred.ok) {
    cancelBrokenAuction(world, auction, now);
    return;
  }
  bidder.frozenCredits -= auction.highestBid;
  seller.credits += auction.highestBid;
  auction.status = 'sold';
  auction.settledAt = now;
}

export function processCollectibleAuctions(world, now = Date.now()) {
  migrateCollectibleWorld(world, now);
  for (const auction of world.collectibleAuctions) {
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
    if (item.assetKind === 'collectible') {
      const collectible = world.collectibles.find((entry) => entry.id === item.assetId);
      if (!collectible) return result(false, '藏品不存在');
      if (collectible.currentOwnerId !== userId) return result(false, '只有当前持有人可以发起拍卖');
      if (openCollectibleAuction(world, collectible.id)) return result(false, '该藏品已经在拍卖中');
    } else if (item.assetKind === 'commodity') {
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
    } else if (item.assetKind === 'facility') {
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
  world.collectibleAuctions.push(auction);
  world.collectibleAuctions = world.collectibleAuctions.slice(-2_000);
  const label = items.length > 1
    ? '资产包'
    : items[0].assetKind === 'collectible' ? '藏品' : items[0].assetKind === 'commodity' ? '商品' : '工厂';
  return result(true, `${label}拍卖已发布，资产已冻结且继续计入总资产`);
}

function placeBid(world, userId, payload, now) {
  const auction = world.collectibleAuctions.find((item) => item.id === String(payload.auctionId || ''));
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
  const auction = world.collectibleAuctions.find((item) => item.id === String(payload.auctionId || ''));
  if (!auction || auction.status !== 'open') return result(false, '拍卖不存在或已经结束');
  if (auction.sellerId !== userId) return result(false, '只能取消自己发起的拍卖');
  if (auction.highestBidderId) return result(false, '已有出价的拍卖不能取消');
  releaseAuctionAsset(world, auction);
  auction.status = 'cancelled';
  auction.settledAt = now;
  return result(true, '拍卖已取消，资产已解冻');
}

export function applyCollectibleAction(world, user, action, payload = {}, now = Date.now()) {
  processCollectibleAuctions(world, now);
  const userId = Number(user.id);
  if (action === 'createAuction' || action === 'createCollectibleAuction') return createAuction(world, userId, payload, now);
  if (action === 'placeAuctionBid' || action === 'placeCollectibleBid') return placeBid(world, userId, payload, now);
  if (action === 'cancelAuction' || action === 'cancelCollectibleAuction') return cancelAuction(world, userId, payload, now);
  return result(false, '拍卖操作不存在');
}

function clientCollectible(world, item) {
  return {
    ...item,
    currentOwnerName: item.currentOwnerId ? playerName(world, item.currentOwnerId, `玩家 ${item.currentOwnerId}`) : '未分配',
    imageUrl: imageUrl(item.imageId, 843),
    thumbnailUrl: imageUrl(item.imageId, 400),
    sourceUrl: `https://www.artic.edu/artworks/${item.sourceArtworkId}`,
    apiUrl: `${AIC_API_BASE}/${item.sourceArtworkId}`,
    auctionId: openCollectibleAuction(world, item.id)?.id,
  };
}

function clientAuctionItem(world, item) {
  if (item.assetKind === 'collectible') {
    const collectible = world.collectibles.find((entry) => entry.id === item.assetId);
    if (!collectible) return null;
    const client = clientCollectible(world, collectible);
    return {
      kind: 'collectible',
      id: collectible.id,
      name: collectible.title,
      subtitle: `${collectible.artist}${collectible.dateDisplay ? ` · ${collectible.dateDisplay}` : ''}`,
      thumbnailUrl: client.thumbnailUrl,
      sourceUrl: client.sourceUrl,
      collectible: client,
      quantity: 1,
    };
  }
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

function clientAuction(world, auction, userId) {
  const itemSummaries = auctionItems(auction).map((item) => clientAuctionItem(world, item));
  if (itemSummaries.some((item) => !item)) return null;
  const asset = itemSummaries[0];
  return {
    ...auction,
    items: auctionItems(auction).map((item) => ({ ...item })),
    itemSummaries,
    itemCount: itemSummaries.length,
    isBundle: itemSummaries.length > 1,
    asset,
    collectible: itemSummaries.length === 1 ? asset.collectible : undefined,
    isSeller: auction.sellerId === userId,
    isHighestBidder: auction.highestBidderId === userId,
    minimumBid: auction.highestBid ? auction.highestBid + 1 : auction.startingBid,
  };
}

export function createCollectibleClientState(world, userId, now = Date.now()) {
  processCollectibleAuctions(world, now);
  const assetAuctions = world.collectibleAuctions
    .slice()
    .sort((left, right) => (left.status === 'open' ? 0 : 1) - (right.status === 'open' ? 0 : 1) || left.endsAt - right.endsAt)
    .slice(0, 200)
    .map((auction) => clientAuction(world, auction, userId))
    .filter(Boolean);
  return {
    collectibles: world.collectibles.map((item) => clientCollectible(world, item)),
    assetAuctions,
    collectibleAuctions: assetAuctions.filter((auction) => auction.itemCount === 1 && auction.assetKind === 'collectible'),
  };
}

function importRecord(record, userId, now) {
  const sourceArtworkId = integer(record.sourceArtworkId ?? record.id);
  const imageId = text(record.imageId ?? record.image_id, 128);
  const title = text(record.title, 180);
  if (!sourceArtworkId || !imageId || !title) {
    throw Object.assign(new Error('藏品记录缺少 sourceArtworkId、imageId 或 title'), { statusCode: 400 });
  }
  if (!(record.isPublicDomain === true || record.is_public_domain === true)) {
    throw Object.assign(new Error(`藏品 ${sourceArtworkId} 必须明确标记 isPublicDomain=true`), { statusCode: 400 });
  }
  if (!/^[A-Za-z0-9-]{8,128}$/.test(imageId)) {
    throw Object.assign(new Error(`藏品 ${sourceArtworkId} 的 imageId 格式无效`), { statusCode: 400 });
  }
  const initialOwnerId = record.initialOwnerId === null || record.initialOwnerId === undefined || record.initialOwnerId === ''
    ? null
    : integer(record.initialOwnerId);
  return {
    id: `collectible-${sourceArtworkId}-${randomUUID()}`,
    source: 'art-institute-of-chicago',
    sourceArtworkId,
    title,
    artist: text(record.artist ?? record.artist_title ?? record.artistTitle, 180, '佚名'),
    dateDisplay: text(record.dateDisplay ?? record.date_display, 120),
    mediumDisplay: text(record.mediumDisplay ?? record.medium_display, 240),
    dimensions: text(record.dimensions, 240),
    description: text(record.description, 1_000),
    imageId,
    isPublicDomain: true,
    currentOwnerId: initialOwnerId,
    createdAt: now,
    createdBy: userId,
  };
}

export function importCollectibles(world, user, payload, now = Date.now()) {
  migrateCollectibleWorld(world, now);
  const records = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  if (records.length < 1 || records.length > 100) {
    throw Object.assign(new Error('每次必须上传 1～100 条藏品记录'), { statusCode: 400 });
  }
  const imported = records.map((record) => importRecord(record, Number(user.id), now));
  const seen = new Set();
  for (const item of imported) {
    if (seen.has(item.sourceArtworkId) || world.collectibles.some((existing) => existing.sourceArtworkId === item.sourceArtworkId)) {
      throw Object.assign(new Error(`芝加哥艺术博物馆藏品 ${item.sourceArtworkId} 已存在`), { statusCode: 409 });
    }
    seen.add(item.sourceArtworkId);
    if (item.currentOwnerId && !player(world, item.currentOwnerId)) {
      throw Object.assign(new Error(`初始持有人 ${item.currentOwnerId} 不存在`), { statusCode: 400 });
    }
  }
  for (const item of imported) {
    world.collectibles.push(item);
    appendOwnership(world, item, null, item.currentOwnerId, item.currentOwnerId ? 'assigned' : 'created', now);
  }
  return { importedCount: imported.length, collectibles: imported.map((item) => clientCollectible(world, item)) };
}

export function listCollectiblesForAdmin(world, now = Date.now()) {
  processCollectibleAuctions(world, now);
  return world.collectibles.map((item) => ({
    ...clientCollectible(world, item),
    ownershipCount: world.collectibleOwnershipHistory.filter((entry) => entry.collectibleId === item.id).length,
  })).sort((left, right) => right.createdAt - left.createdAt);
}

export function collectibleOwnershipHistory(world, collectibleId, now = Date.now()) {
  migrateCollectibleWorld(world, now);
  if (!world.collectibles.some((item) => item.id === collectibleId)) {
    throw Object.assign(new Error('藏品不存在'), { statusCode: 404 });
  }
  return world.collectibleOwnershipHistory
    .filter((entry) => entry.collectibleId === collectibleId)
    .sort((left, right) => right.createdAt - left.createdAt);
}
