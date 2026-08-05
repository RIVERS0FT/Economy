import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import { creditPopulationEmployment } from './population-economy.js';

export const RESEARCH_WORLD_VERSION = 26;
export const GEM_RESEARCH_ACCELERATION_MS = 30 * 60 * 1000;
export const GEM_RESEARCH_ACCELERATION_COST = 1;
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
  player.stats.researchGemSpent = Math.max(0, Number(player.stats.researchGemSpent || 0));
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
  const duration = Math.max(1, levelFor(active.targetComplexity).durationMs);
  const remaining = Math.max(0, Number(active.completesAt) - Number(now));
  const effectiveElapsed = Math.max(0, Math.min(duration, duration - remaining));
  const targetReleased = Number(now) >= active.completesAt
    ? active.cost
    : Math.floor(active.cost * effectiveElapsed / duration);
  const release = Math.max(0, targetReleased - active.employmentReleased);
  if (release > 0) {
    creditPopulationEmployment(world, release, 'research');
    active.employmentReleased += release;
    player.stats ||= {};
    player.stats.researchPayroll = Number(player.stats.researchPayroll || 0) + release;
  }
  return release;
}

function completeResearchIfDue(world, player, now) {
  const active = player?.research?.active;
  if (!active || Number(now) < Number(active.completesAt)) return false;
  releaseResearchEmployment(world, player, now);
  const currentResearch = player.research;
  if (!currentResearch?.active) return false;
  currentResearch.unlockedComplexity = currentResearch.active.targetComplexity;
  currentResearch.completedAt = currentResearch.active.completesAt;
  currentResearch.active = null;
  return true;
}

export function processResearchWorld(world, now = Date.now()) {
  migrateResearchWorld(world, now);
  for (const player of Object.values(world.players || {})) {
    const research = ensurePlayerResearch(world, player, now);
    if (!research?.active) continue;
    releaseResearchEmployment(world, player, now);
    completeResearchIfDue(world, player, now);
  }
  return world;
}

function startResearch(world, player, payload, now) {
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

function accelerateResearch(world, player, now) {
  const research = ensurePlayerResearch(world, player, now);
  const active = research?.active;
  if (!active) return { ok: false, message: '当前没有正在进行的研发' };
  if (Number(player.gems || 0) < GEM_RESEARCH_ACCELERATION_COST) {
    return { ok: false, message: '宝石余额不足' };
  }

  const target = levelFor(active.targetComplexity);
  const remainingMsBefore = Math.max(0, Number(active.completesAt) - Number(now));
  if (remainingMsBefore <= 0) {
    completeResearchIfDue(world, player, now);
    return { ok: false, message: '研发已经完成，正在等待服务器确认' };
  }

  const previousCompletesAt = Number(active.completesAt);
  player.gems = Number(player.gems || 0) - GEM_RESEARCH_ACCELERATION_COST;
  active.completesAt = Math.max(Number(now), previousCompletesAt - GEM_RESEARCH_ACCELERATION_MS);
  const employmentReleased = releaseResearchEmployment(world, player, now);
  const completedImmediately = completeResearchIfDue(world, player, now);
  const remainingMsAfter = completedImmediately
    ? 0
    : Math.max(0, Number(player.research.active?.completesAt || now) - Number(now));
  player.stats ||= {};
  player.stats.researchGemSpent = Number(player.stats.researchGemSpent || 0) + GEM_RESEARCH_ACCELERATION_COST;

  return {
    ok: true,
    message: completedImmediately
      ? `已使用 1 宝石，${target.id} 研发立即完成`
      : `已使用 1 宝石，${target.id} 研发减少 30m`,
    targetComplexity: target.id,
    gemsSpent: GEM_RESEARCH_ACCELERATION_COST,
    balanceAfter: Number(player.gems || 0),
    reducedMs: Math.min(GEM_RESEARCH_ACCELERATION_MS, remainingMsBefore),
    remainingMsBefore,
    remainingMsAfter,
    completedImmediately,
    employmentReleased,
  };
}

export function applyResearchAction(world, user, action, payload = {}, now = Date.now()) {
  if (action !== 'startResearch' && action !== 'accelerateResearch') return null;
  processResearchWorld(world, now);
  const player = world.players?.[String(user?.id)];
  if (!player) return { ok: false, message: '玩家不存在' };
  return action === 'startResearch'
    ? startResearch(world, player, payload, now)
    : accelerateResearch(world, player, now);
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

export function createResearchClientState(world, player) {
  const fallback = {
    unlockedComplexity: levelForRank(legacyUnlockedRank(world, player)).id,
    completedAt: null,
    active: null,
  };
  const research = clone(player?.research && typeof player.research === 'object' ? player.research : fallback);
  if (research.active) {
    research.active.gemAccelerationMs = GEM_RESEARCH_ACCELERATION_MS;
    research.active.gemAccelerationCost = GEM_RESEARCH_ACCELERATION_COST;
  }
  return {
    researchLevels: clone(RESEARCH_LEVEL_CATALOG),
    research,
  };
}

export function nextResearchEmploymentAt(active) {
  if (!active) return null;
  const startedAt = Number(active.startedAt);
  const completesAt = Number(active.completesAt);
  const duration = Math.max(1, levelFor(active.targetComplexity).durationMs);
  const cost = Math.max(0, Math.floor(Number(active.cost || 0)));
  const released = Math.max(0, Math.floor(Number(active.employmentReleased || 0)));
  if (!Number.isFinite(startedAt) || !Number.isFinite(completesAt) || completesAt <= startedAt) return null;
  if (cost <= 0 || released >= cost) return completesAt;
  const effectiveStartedAt = completesAt - duration;
  return Math.min(completesAt, effectiveStartedAt + Math.ceil((released + 1) * duration / cost));
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
