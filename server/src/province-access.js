import { DEFAULT_PROVINCE_ID, normalizeProvinceId, PROVINCE_CATALOG } from './provinces.js';

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

export function isProvinceUnlocked(player, provinceId) {
  if (!player) return false;
  return PROVINCE_IDS.has(normalizeProvinceId(provinceId));
}

export function provinceUnlockError(player, provinceId) {
  if (!player) return '玩家状态无效';
  return PROVINCE_IDS.has(normalizeProvinceId(provinceId)) ? null : '州级地区无效';
}

export function applyChooseStartingProvince(world, user) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  normalizeProvinceAccess(player);
  return { ok: false, message: '起始州选择已取消，连续 48 州均可直接经营' };
}

export function applyUnlockProvince(world, user) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  normalizeProvinceAccess(player);
  return { ok: false, message: '地区解锁已取消，连续 48 州均可直接经营' };
}

export function normalizeProvinceAccess(player) {
  if (!player) return player;
  if (!PROVINCE_IDS.has(String(player.startingProvinceId || ''))) {
    player.startingProvinceId = DEFAULT_PROVINCE_ID;
  }
  player.startingProvinceChosen = true;
  player.unlockedProvinces = PROVINCE_CATALOG.map((province) => province.id);
  return player;
}

export function migrateProvinceAccess(world) {
  for (const player of Object.values(world.players || {})) normalizeProvinceAccess(player);
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
