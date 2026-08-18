import { DEFAULT_PROVINCE_ID, normalizeProvinceId, PROVINCE_CATALOG, splitProvinceScopedKey } from './provinces.js';
import { roundInternalMoney } from './money.js';

export const PROVINCE_UNLOCK_BASE_COST = 1500;
export const PROVINCE_UNLOCK_COST_PER_500_KM = 300;
export const PROVINCE_UNLOCK_MAX_COST = 20000;

const PROVINCE_IDS = new Set(PROVINCE_CATALOG.map((province) => province.id));
const PROVINCE_BY_ID = new Map(PROVINCE_CATALOG.map((province) => [province.id, province]));
const DISTANCE_CACHE = new Map();

function toRadians(value) {
  return Number(value) * Math.PI / 180;
}

export function provinceDistanceKm(leftId, rightId) {
  const left = normalizeProvinceId(leftId);
  const right = normalizeProvinceId(rightId);
  if (left === right) return 0;
  const key = left < right ? `${left}:${right}` : `${right}:${left}`;
  const cached = DISTANCE_CACHE.get(key);
  if (cached !== undefined) return cached;
  const leftProvince = PROVINCE_BY_ID.get(left);
  const rightProvince = PROVINCE_BY_ID.get(right);
  if (!leftProvince || !rightProvince) return 0;
  const earthRadiusKm = 6371;
  const lat1 = toRadians(leftProvince.latitude);
  const lat2 = toRadians(rightProvince.latitude);
  const dLat = toRadians(Number(rightProvince.latitude) - Number(leftProvince.latitude));
  const dLon = toRadians(Number(rightProvince.longitude) - Number(leftProvince.longitude));
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const distance = 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
  DISTANCE_CACHE.set(key, distance);
  return distance;
}

export function provinceUnlockCost(provinceId, startingProvinceId) {
  const distanceKm = provinceDistanceKm(provinceId, startingProvinceId);
  const cost = PROVINCE_UNLOCK_BASE_COST
    + PROVINCE_UNLOCK_COST_PER_500_KM * Math.floor(distanceKm / 500);
  return Math.min(PROVINCE_UNLOCK_MAX_COST, cost);
}

export function isProvinceUnlocked(player, provinceId) {
  const id = normalizeProvinceId(provinceId);
  if (!player || !PROVINCE_IDS.has(id)) return false;
  if (String(player.startingProvinceId || '') === id) return true;
  return Array.isArray(player.unlockedProvinces) && player.unlockedProvinces.includes(id);
}

export function provinceUnlockError(player, provinceId) {
  const id = normalizeProvinceId(provinceId);
  if (!PROVINCE_IDS.has(id)) return '州级地区无效';
  if (!player?.startingProvinceChosen) return null;
  if (isProvinceUnlocked(player, id)) return null;
  return '该州尚未解锁，请先完成解锁';
}

function provinceName(provinceId) {
  return PROVINCE_BY_ID.get(normalizeProvinceId(provinceId))?.name || '该州';
}

function hasEconomicFootprint(player, world) {
  if ((player.facilities && player.facilities.length > 0)
    || (player.facilityGroups && player.facilityGroups.length > 0)) return true;
  if ((player.trades && player.trades.length > 0)
    || (player.ledger && player.ledger.some((entry) => String(entry.category || '') !== 'system'))) return true;
  const stats = player.stats || {};
  const activityKeys = [
    'workIssued', 'populationIssued', 'commodityVolume', 'facilityVolume',
    'soldGoods', 'boughtGoods', 'giftIssued', 'gemExchangeCredits',
    'contractCreditsPaid', 'contractCreditsReceived', 'populationIncome',
  ];
  if (activityKeys.some((key) => Number(stats[key] || 0) > 0)) return true;
  return (world.orders || []).some((order) => (
    Number(order.ownerId) === Number(player.userId)
    && (order.status === 'open' || order.status === 'partial')
  ));
}

export function applyChooseStartingProvince(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const provinceId = normalizeProvinceId(payload.provinceId);
  if (!PROVINCE_IDS.has(provinceId)) return { ok: false, message: '州级地区无效' };
  if (player.startingProvinceChosen) return { ok: false, message: '起始州已选定，不能更换' };
  if (hasEconomicFootprint(player, world)) return { ok: false, message: '已开始经营，不能更换起始州' };
  player.startingProvinceId = provinceId;
  player.startingProvinceChosen = true;
  player.unlockedProvinces = [provinceId];
  return { ok: true, message: `起始州已选定为${provinceName(provinceId)}` };
}

export function applyUnlockProvince(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const provinceId = normalizeProvinceId(payload.provinceId);
  if (!PROVINCE_IDS.has(provinceId)) return { ok: false, message: '州级地区无效' };
  if (isProvinceUnlocked(player, provinceId)) return { ok: false, message: '该州已经解锁' };
  if (!player.startingProvinceChosen || !player.startingProvinceId) {
    return { ok: false, message: '请先选择起始州' };
  }
  const cost = provinceUnlockCost(provinceId, player.startingProvinceId);
  if (Number(player.credits || 0) < cost) {
    return { ok: false, message: `解锁资金不足，需要 ${cost} 货币` };
  }
  player.credits = roundInternalMoney(player.credits - cost) || 0;
  player.stats ||= {};
  player.stats.systemSinks = Number(player.stats.systemSinks || 0) + cost;
  player.unlockedProvinces = [...(player.unlockedProvinces || []), provinceId];
  return { ok: true, message: `已解锁${provinceName(provinceId)}，支出 ${cost} 货币` };
}

export function normalizeProvinceAccess(player) {
  if (!player) return player;
  if (!PROVINCE_IDS.has(String(player.startingProvinceId || ''))) {
    player.startingProvinceId = DEFAULT_PROVINCE_ID;
  }
  if (!Array.isArray(player.unlockedProvinces)) player.unlockedProvinces = [];
  if (!player.unlockedProvinces.includes(player.startingProvinceId)) {
    player.unlockedProvinces = [...player.unlockedProvinces, player.startingProvinceId];
  }
  player.startingProvinceChosen = player.startingProvinceChosen !== false;
  return player;
}

export function migrateProvinceAccess(world, now = Date.now()) {
  for (const player of Object.values(world.players || {})) {
    normalizeProvinceAccess(player);
    const ids = new Set(player.unlockedProvinces || []);
    ids.add(player.startingProvinceId);
    for (const [key, inventory] of Object.entries(player.inventories || {})) {
      const { provinceId } = splitProvinceScopedKey(key);
      if (Number(inventory?.available || 0) > 0
        || Number(inventory?.frozen || 0) > 0
        || Number(inventory?.inTransit || 0) > 0) ids.add(provinceId);
    }
    for (const group of player.facilityGroups || []) ids.add(normalizeProvinceId(group.provinceId));
    for (const order of world.orders || []) {
      if (Number(order.ownerId) === Number(player.userId)
        && (order.status === 'open' || order.status === 'partial')) ids.add(normalizeProvinceId(order.provinceId));
    }
    for (const auction of world.assetAuctions || []) {
      const participant = Number(auction.sellerId) === Number(player.userId)
        || Number(auction.highestBidderId) === Number(player.userId)
        || Number(auction.highestBid?.bidderId) === Number(player.userId);
      if (!participant) continue;
      for (const item of auction.items || []) ids.add(normalizeProvinceId(item.provinceId));
    }
    for (const contract of world.productionContracts || []) {
      const participant = [contract.buyerId, contract.supplierId, contract.lenderId, contract.lesseeId, contract.lessorId]
        .some((id) => Number(id) === Number(player.userId));
      if (participant && contract.provinceId) ids.add(normalizeProvinceId(contract.provinceId));
    }
    player.unlockedProvinces = [...ids];
  }
  return world;
}

export function provinceAccessCatalog() {
  return PROVINCE_CATALOG.map((province) => ({
    id: province.id,
    name: province.name,
    shortName: province.shortName,
    mapName: province.mapName,
  }));
}
