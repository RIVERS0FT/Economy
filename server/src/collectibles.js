import { randomUUID } from 'node:crypto';

const AIC_API_BASE = 'https://api.artic.edu/api/v1/artworks';
const AIC_IIIF_BASE = 'https://www.artic.edu/iiif/2';
const MAX_BID = 1_000_000_000;
const MAX_AUCTION_HOURS = 168;
const MAX_HISTORY = 5_000;

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
function openAuction(world, collectibleId) {
  return world.collectibleAuctions.find((auction) => auction.collectibleId === collectibleId && auction.status === 'open');
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
  world.collectibleAuctions = world.collectibleAuctions.slice(-2_000);
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

function settleAuction(world, auction, now) {
  if (auction.status !== 'open') return;
  const collectible = world.collectibles.find((item) => item.id === auction.collectibleId);
  if (!collectible || collectible.currentOwnerId !== auction.sellerId) {
    releaseBid(world, auction);
    auction.status = 'cancelled';
    auction.settledAt = now;
    return;
  }
  if (!auction.highestBidderId || !auction.highestBid) {
    auction.status = 'ended';
    auction.settledAt = now;
    return;
  }
  const seller = player(world, auction.sellerId);
  const bidder = player(world, auction.highestBidderId);
  if (!seller || !bidder || bidder.frozenCredits < auction.highestBid) {
    releaseBid(world, auction);
    auction.status = 'cancelled';
    auction.settledAt = now;
    return;
  }
  bidder.frozenCredits -= auction.highestBid;
  seller.credits += auction.highestBid;
  const previousOwnerId = collectible.currentOwnerId;
  collectible.currentOwnerId = auction.highestBidderId;
  appendOwnership(world, collectible, previousOwnerId, auction.highestBidderId, 'auction', now, {
    auctionId: auction.id,
    price: auction.highestBid,
  });
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

function createAuction(world, userId, payload, now) {
  const collectible = world.collectibles.find((item) => item.id === String(payload.collectibleId || ''));
  if (!collectible) return result(false, '藏品不存在');
  if (collectible.currentOwnerId !== userId) return result(false, '只有当前持有人可以发起拍卖');
  if (openAuction(world, collectible.id)) return result(false, '该藏品已经在拍卖中');
  const startingBid = integer(payload.startingBid, MAX_BID);
  const durationHours = integer(payload.durationHours, MAX_AUCTION_HOURS);
  if (!startingBid || !durationHours) return result(false, '起拍价或拍卖时长无效');
  world.collectibleAuctions.push({
    id: `collectible-auction-${randomUUID()}`,
    collectibleId: collectible.id,
    sellerId: userId,
    sellerName: playerName(world, userId, `玩家 ${userId}`),
    startingBid,
    highestBid: null,
    highestBidderId: null,
    highestBidderName: null,
    status: 'open',
    createdAt: now,
    endsAt: now + durationHours * 60 * 60 * 1_000,
    bids: [],
  });
  world.collectibleAuctions = world.collectibleAuctions.slice(-2_000);
  return result(true, '藏品拍卖已发布');
}

function placeBid(world, userId, payload, now) {
  const auction = world.collectibleAuctions.find((item) => item.id === String(payload.auctionId || ''));
  if (!auction || auction.status !== 'open') return result(false, '拍卖不存在或已经结束');
  if (auction.endsAt <= now) {
    settleAuction(world, auction, now);
    return result(false, '拍卖已经结束');
  }
  if (auction.sellerId === userId) return result(false, '卖家不能竞拍自己的藏品');
  const amount = integer(payload.amount, MAX_BID);
  const minimum = auction.highestBid ? auction.highestBid + 1 : auction.startingBid;
  if (!amount || amount < minimum) return result(false, `出价不得低于 ¤${minimum}`);
  const bidder = player(world, userId);
  if (!bidder) return result(false, '玩家不存在');

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
  auction.status = 'cancelled';
  auction.settledAt = now;
  return result(true, '拍卖已取消');
}

export function applyCollectibleAction(world, user, action, payload = {}, now = Date.now()) {
  processCollectibleAuctions(world, now);
  const userId = Number(user.id);
  if (action === 'createCollectibleAuction') return createAuction(world, userId, payload, now);
  if (action === 'placeCollectibleBid') return placeBid(world, userId, payload, now);
  if (action === 'cancelCollectibleAuction') return cancelAuction(world, userId, payload, now);
  return result(false, '藏品操作不存在');
}

export function canResetCollectibles(world, userId, now = Date.now()) {
  processCollectibleAuctions(world, now);
  const active = world.collectibleAuctions.some((auction) => auction.status === 'open' && (
    auction.sellerId === userId || auction.highestBidderId === userId
  ));
  return active
    ? result(false, '存在进行中的藏品拍卖或竞拍，无法重置经济状态')
    : result(true, '可以重置');
}

function clientCollectible(world, item) {
  return {
    ...item,
    currentOwnerName: item.currentOwnerId ? playerName(world, item.currentOwnerId, `玩家 ${item.currentOwnerId}`) : '未分配',
    imageUrl: imageUrl(item.imageId, 843),
    thumbnailUrl: imageUrl(item.imageId, 400),
    sourceUrl: `https://www.artic.edu/artworks/${item.sourceArtworkId}`,
    apiUrl: `${AIC_API_BASE}/${item.sourceArtworkId}`,
    auctionId: openAuction(world, item.id)?.id,
  };
}

export function createCollectibleClientState(world, userId, now = Date.now()) {
  processCollectibleAuctions(world, now);
  return {
    collectibles: world.collectibles.map((item) => clientCollectible(world, item)),
    collectibleAuctions: world.collectibleAuctions
      .slice()
      .sort((left, right) => (left.status === 'open' ? 0 : 1) - (right.status === 'open' ? 0 : 1) || left.endsAt - right.endsAt)
      .slice(0, 200)
      .flatMap((auction) => {
        const collectible = world.collectibles.find((item) => item.id === auction.collectibleId);
        if (!collectible) return [];
        return [{
          ...auction,
          collectible: clientCollectible(world, collectible),
          isSeller: auction.sellerId === userId,
          isHighestBidder: auction.highestBidderId === userId,
          minimumBid: auction.highestBid ? auction.highestBid + 1 : auction.startingBid,
        }];
      }),
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
