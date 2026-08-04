import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import { creditPopulationEmployment } from './population-economy.js';

export const RESEARCH_WORLD_VERSION = 22;
export const RESEARCH_LEVEL_CATALOG = Object.freeze([
  Object.freeze({ id: 'C1', rank: 1, cost: 0, durationMs: 0 }),
  Object.freeze({ id: 'C2', rank: 2, cost: 300, durationMs: 5 * 60_000 }),
  Object.freeze({ id: 'C3', rank: 3, cost: 700, durationMs: 20 * 60_000 }),
  Object.freeze({ id: 'C4', rank: 4, cost: 1_200, durationMs: 45 * 60_000 }),
  Object.freeze({ id: 'C5', rank: 5, cost: 2_400, durationMs: 90 * 60_000 }),
  Object.freeze({ id: 'C6', rank: 6, cost: 4_200, durationMs: 3 * 60 * 60_000 }),
  Object.freeze({ id: 'C7', rank: 7, cost: 6_700, durationMs: 6 * 60 * 60_000 }),
]);

const LEVEL_BY_ID = new Map(RESEARCH_LEVEL_CATALOG.map((level) => [level.id, level]));
const FACILITY_BY_ID = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));

function clone(value) { return structuredClone(value); }
function complexityRank(value) {
  const rank = Number(String(value || '').slice(1));
  return Number.isInteger(rank) && rank >= 1 && rank <= 7 ? rank : 1;
}
function levelForRank(rank) {
  return RESEARCH_LEVEL_CATALOG[Math.max(0, Math.min(6, Number(rank || 1) - 1))];
}
function levelFor(value) { return LEVEL_BY_ID.get(String(value || '')) || RESEARCH_LEVEL_CATALOG[0]; }
function facilityComplexity(facilityTypeId) {
  return FACILITY_BY_ID.get(String(facilityTypeId || ''))?.complexity || 'C1';
}
function isOpenOrder(order) {
  return Number(order?.remaining || 0) > 0 && (order?.status === 'open' || order?.status === 'partial');
}
function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) return auction.items;
  const assetId = String(auction?.assetId || auction?.facilityTypeId || '');
  return assetId ? [{ assetKind: auction?.assetKind, assetId, quantity: auction?.quantity }] : [];
}
function legacyUnlockedRank(world, player) {
  let rank = 1;
  const includeFacility = (facilityTypeId) => {
    rank = Math.max(rank, complexityRank(facilityComplexity(facilityTypeId)));
  };
  for (const group of player?.facilityGroups || []) {
    if (Number(group?.count || 0) > 0) includeFacility(group.facilityTypeId);
  }
  if (player?.facilityConstruction?.facilityTypeId) includeFacility(player.facilityConstruction.facilityTypeId);
  for (const order of world?.orders || []) {
    if (
      Number(order?.ownerId) === Number(player?.userId)
      && order?.side === 'buy'
      && (order?.assetKind === 'facility' || order?.facilityTypeId)
      && isOpenOrder(order)
    ) includeFacility(order.facilityTypeId || order.assetId);
  }
  for (const auction of world?.assetAuctions || []) {
    if (auction?.status !== 'open' || Number(auction?.highestBidderId) !== Number(player?.userId)) continue;
    for (const item of auctionItems(auction)) {
      if (item?.assetKind === 'facility') includeFacility(item.assetId || item.facilityTypeId);
    }
  }
  return rank;
}

export function ensurePlayerResearch(world, player, now = Date.now()) {
  if (!player || typeof player !== 'object') return null;
  const previous = player.research && typeof player.research === 'object' ? player.research : null;
  const inferredRank = legacyUnlockedRank(world, player);
  const storedRank = complexityRank(previous?.unlockedComplexity);
  const unlockedRank = Math.max(inferredRank, storedRank);
  const research = {
    unlockedComplexity: levelForRank(unlockedRank).id,
    completedAt: Number.isFinite(Number(previous?.completedAt)) ? Number(previous.completedAt) : null,
    active: null,
  };
  const active = previous?.active;
  if (active && typeof active === 'object') {
    const target = levelFor(active.targetComplexity);
    const startedAt = Number(active.startedAt);
    const completesAt = Number(active.completesAt);
    const cost = Math.max(0, Math.floor(Number(active.cost ?? target.cost)));
    if (
      target.rank === unlockedRank + 1
      && Number.isFinite(startedAt)
      && Number.isFinite(completesAt)
      && completesAt > startedAt
      && cost === target.cost
    ) {
      research.active = {
        targetComplexity: target.id,
        startedAt,
        completesAt,
        cost,
        employmentReleased: Math.min(cost, Math.max(0, Math.floor(Number(active.employmentReleased || 0)))),
      };
    }
  }
  player.research = research;
  player.stats ||= {};
  player.stats.researchPayroll = Math.max(0, Number(player.stats.researchPayroll || 0));
  return research;
}

export function migrateResearchWorld(world, now = Date.now()) {
  if (!world || typeof world !== 'object') return world;
  for (const player of Object.values(world.players || {})) ensurePlayerResearch(world, player, now);
  world.version = RESEARCH_WORLD_VERSION;
  return world;
}

export function releaseResearchEmployment(world, player, now = Date.now()) {
  const research = ensurePlayerResearch(world, player, now);
  const active = research?.active;
  if (!active) return 0;
  const duration = Math.max(1, active.completesAt - active.startedAt);
  const elapsed = Math.max(0, Math.min(duration, Number(now) - active.startedAt));
  const targetReleased = Number(now) >= active.completesAt
    ? active.cost
    : Math.floor(active.cost * elapsed / duration);
  const release = Math.max(0, targetReleased - active.employmentReleased);
  if (release > 0) {
    creditPopulationEmployment(world, release, 'research');
    active.employmentReleased += release;
    player.stats ||= {};
    player.stats.researchPayroll = Number(player.stats.researchPayroll || 0) + release;
  }
  return release;
}

export function processResearchWorld(world, now = Date.now()) {
  migrateResearchWorld(world, now);
  for (const player of Object.values(world.players || {})) {
    const research = ensurePlayerResearch(world, player, now);
    if (!research?.active) continue;
    releaseResearchEmployment(world, player, now);
    const currentResearch = player.research;
    if (currentResearch?.active && Number(now) >= currentResearch.active.completesAt) {
      currentResearch.unlockedComplexity = currentResearch.active.targetComplexity;
      currentResearch.completedAt = currentResearch.active.completesAt;
      currentResearch.active = null;
    }
  }
  return world;
}

export function applyResearchAction(world, user, action, payload = {}, now = Date.now()) {
  if (action !== 'startResearch') return null;
  processResearchWorld(world, now);
  const player = world.players?.[String(user?.id)];
  if (!player) return { ok: false, message: '玩家不存在' };
  const research = ensurePlayerResearch(world, player, now);
  if (research.active) return { ok: false, message: '已有研发项目正在进行' };
  const current = levelFor(research.unlockedComplexity);
  if (current.rank >= 7) return { ok: false, message: 'C1-C7 研发已经全部完成' };
  const target = levelFor(payload.targetComplexity);
  if (target.rank !== current.rank + 1) return { ok: false, message: '只能研发当前等级的下一级' };
  if (Number(player.credits || 0) < target.cost) return { ok: false, message: '可用资金不足' };
  player.credits = Number(player.credits || 0) - target.cost;
  player.research = {
    ...research,
    active: {
      targetComplexity: target.id,
      startedAt: Number(now),
      completesAt: Number(now) + target.durationMs,
      cost: target.cost,
      employmentReleased: 0,
    },
  };
  return { ok: true, message: `已开始研发 ${target.id}` };
}

function lockedResult(playerResearch, facilityTypeId) {
  const required = facilityComplexity(facilityTypeId);
  if (complexityRank(required) <= complexityRank(playerResearch.unlockedComplexity)) return null;
  return { ok: false, message: `需要先完成 ${required} 研发` };
}

export function validateResearchAccess(world, user, action, payload = {}, now = Date.now()) {
  if (!world?.players?.[String(user?.id)]) return null;
  processResearchWorld(world, now);
  const player = world.players[String(user.id)];
  const research = ensurePlayerResearch(world, player, now);
  let facilityTypeId = null;
  if (['buildFacility', 'startFacility', 'setFacilityRecipe'].includes(action)) {
    facilityTypeId = payload.facilityTypeId;
  } else if (action === 'placeOrder' && payload.assetKind === 'facility' && payload.side === 'buy') {
    facilityTypeId = payload.facilityTypeId || payload.assetId;
  } else if (action === 'buyFacility') {
    const listing = (world.facilityListings || []).find((item) => item.id === payload.listingId);
    facilityTypeId = listing?.facilityTypeId || listing?.facility?.facilityTypeId;
  }
  if (facilityTypeId) return lockedResult(research, facilityTypeId);
  if (action === 'placeAuctionBid') {
    const auction = (world.assetAuctions || []).find((item) => item.id === payload.auctionId);
    for (const item of auctionItems(auction)) {
      if (item?.assetKind !== 'facility') continue;
      const locked = lockedResult(research, item.assetId || item.facilityTypeId);
      if (locked) return locked;
    }
  }
  return null;
}

export function createResearchClientState(world, player, now = Date.now()) {
  processResearchWorld(world, now);
  return {
    researchLevels: clone(RESEARCH_LEVEL_CATALOG),
    research: clone(ensurePlayerResearch(world, player, now)),
  };
}

export function nextResearchEmploymentAt(active) {
  if (!active) return null;
  const startedAt = Number(active.startedAt);
  const completesAt = Number(active.completesAt);
  const cost = Math.max(0, Math.floor(Number(active.cost || 0)));
  const released = Math.max(0, Math.floor(Number(active.employmentReleased || 0)));
  if (!Number.isFinite(startedAt) || !Number.isFinite(completesAt) || completesAt <= startedAt) return null;
  if (cost <= 0 || released >= cost) return completesAt;
  return Math.min(completesAt, startedAt + Math.ceil((released + 1) * (completesAt - startedAt) / cost));
}

export function nextResearchDeadlineAt(world) {
  let deadline = null;
  for (const player of Object.values(world?.players || {})) {
    const active = player?.research?.active;
    if (!active) continue;
    const completesAt = Number(active.completesAt);
    const employmentAt = nextResearchEmploymentAt(active);
    if (Number.isFinite(completesAt)) deadline = deadline === null ? completesAt : Math.min(deadline, completesAt);
    if (Number.isFinite(employmentAt)) deadline = deadline === null ? employmentAt : Math.min(deadline, employmentAt);
  }
  return deadline;
}
