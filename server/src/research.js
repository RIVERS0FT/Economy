import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import {
  isLegacyProductionMethodRecipeId,
  migrateLegacyProductionMethodRecipeId,
} from './legacy-production-methods.js';
import { creditPopulationEmployment } from './population-economy.js';
import {
  RESEARCH_DURATION_MS,
  RESEARCH_LEVEL_CATALOG,
  RESEARCH_TECHNOLOGY_CATALOG,
  RESEARCH_TECHNOLOGY_BY_ID,
  researchTechnologiesForStage,
  researchTechnologyClosure,
  researchTechnologyFor,
  researchTechnologyForFacility,
} from './research-catalog.js';

export { RESEARCH_DURATION_MS, RESEARCH_LEVEL_CATALOG, RESEARCH_TECHNOLOGY_CATALOG };

export const RESEARCH_WORLD_VERSION = 29;
export const GEM_RESEARCH_ACCELERATION_MS = 30 * 60 * 1000;
export const GEM_RESEARCH_ACCELERATION_COST = 1;

const LEGACY_LEVELS = Object.freeze({
  C1: Object.freeze({ cost: 0, durationMs: 0 }),
  C2: Object.freeze({ cost: 300, durationMs: 5 * 60_000 }),
  C3: Object.freeze({ cost: 700, durationMs: 20 * 60_000 }),
  C4: Object.freeze({ cost: 1_200, durationMs: 45 * 60_000 }),
  C5: Object.freeze({ cost: 2_400, durationMs: 90 * 60_000 }),
  C6: Object.freeze({ cost: 4_200, durationMs: 3 * 60 * 60_000 }),
  C7: Object.freeze({ cost: 6_700, durationMs: 6 * 60 * 60_000 }),
});
const STAGE_BY_ID = new Map(RESEARCH_LEVEL_CATALOG.map((stage) => [stage.id, stage]));
const FACILITY_BY_ID = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const TECHNOLOGY_ORDER = new Map(RESEARCH_TECHNOLOGY_CATALOG.map((technology, index) => [technology.id, index]));
const LEGACY_OPERATION_TECHNOLOGY_GRANTS = Object.freeze({
  'tool-manufacturing': Object.freeze(['tool-operation']),
  'fertilizer-engineering': Object.freeze(['fertilizer-application']),
  'feed-processing': Object.freeze(['feed-husbandry']),
  'veterinary-medicine': Object.freeze(['veterinary-application']),
  'oil-refining': Object.freeze(['industrial-fuel-operation', 'industrial-chemical-operation']),
  'mechanical-engineering': Object.freeze(['machinery-operation']),
  'agricultural-machinery': Object.freeze(['tractor-operation']),
});

function clone(value) { return structuredClone(value); }
function complexityRank(value) {
  const rank = Number(String(value || '').slice(1));
  return Number.isInteger(rank) && rank >= 1 && rank <= 7 ? rank : 1;
}
function stageForRank(rank) {
  return RESEARCH_LEVEL_CATALOG[Math.max(0, Math.min(6, Number(rank || 1) - 1))];
}
function stageFor(value) { return STAGE_BY_ID.get(String(value || '')) || RESEARCH_LEVEL_CATALOG[0]; }
function isOpenOrder(order) {
  return Number(order?.remaining || 0) > 0 && (order?.status === 'open' || order?.status === 'partial');
}
function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) return auction.items;
  const assetId = String(auction?.assetId || auction?.facilityTypeId || '');
  return assetId ? [{ assetKind: auction?.assetKind, assetId, quantity: auction?.quantity }] : [];
}
function sortedTechnologyIds(values) {
  return [...new Set(values || [])]
    .filter((technologyId) => RESEARCH_TECHNOLOGY_BY_ID.has(technologyId))
    .sort((left, right) => (TECHNOLOGY_ORDER.get(left) ?? 999) - (TECHNOLOGY_ORDER.get(right) ?? 999));
}
function grantTechnologyClosure(completed, technologyIds) {
  for (const technologyId of researchTechnologyClosure(technologyIds)) completed.add(technologyId);
}
function grantLegacyOperationTechnologies(completed) {
  for (const [productionTechnologyId, operationTechnologyIds] of Object.entries(LEGACY_OPERATION_TECHNOLOGY_GRANTS)) {
    if (completed.has(productionTechnologyId)) grantTechnologyClosure(completed, operationTechnologyIds);
  }
}
function activeResearchWithLegacyOperationGrants(previousActive) {
  if (!previousActive || typeof previousActive !== 'object') return previousActive;
  const additional = LEGACY_OPERATION_TECHNOLOGY_GRANTS[String(previousActive.technologyId || '')];
  if (!additional) return previousActive;
  return {
    ...previousActive,
    grantTechnologyIds: sortedTechnologyIds([
      previousActive.technologyId,
      ...(Array.isArray(previousActive.grantTechnologyIds) ? previousActive.grantTechnologyIds : []),
      ...additional,
    ]),
  };
}
function productionMethodGroupForFacility(facility) {
  return facility?.productionMethodGroups?.find((group) => group.id === 'operation')
    || facility?.productionMethodGroups?.[0]
    || null;
}
function productionMethodForRecipe(facility, recipe) {
  const group = productionMethodGroupForFacility(facility);
  if (!group || !recipe) return null;
  const methodId = String(recipe.productionMethodId || group.defaultMethodId || '');
  return group.methods.find((method) => method.id === methodId) || null;
}
function defaultRecipeForFacility(facility, recipeId) {
  if (!facility) return null;
  const baseRecipeId = String(recipeId || '').split('--')[0];
  const defaultMethodId = productionMethodGroupForFacility(facility)?.defaultMethodId;
  return facility.recipes.find((recipe) => (
    recipe.id === baseRecipeId
    && recipe.productionMethodId === defaultMethodId
  )) || facility.recipes.find((recipe) => (
    recipe.baseRecipeId === baseRecipeId
    && recipe.productionMethodId === defaultMethodId
  )) || facility.recipes.find((recipe) => recipe.id === facility.defaultRecipeId) || facility.recipes[0] || null;
}
function normalizeProductionMethodAccess(player, completed, now) {
  for (const group of player?.facilityGroups || []) {
    const facility = FACILITY_BY_ID.get(String(group?.facilityTypeId || ''));
    if (!facility) continue;
    const storedRecipeId = String(group?.activeRecipeId || facility.defaultRecipeId || '');
    const recipeId = migrateLegacyProductionMethodRecipeId(facility.id, storedRecipeId);
    if (recipeId !== storedRecipeId) group.activeRecipeId = recipeId;
    const recipe = facility.recipes.find((candidate) => candidate.id === recipeId);
    const method = productionMethodForRecipe(facility, recipe);
    const requiredTechnologyIds = method?.requiredTechnologyIds || [];
    const lacksRequiredTechnology = requiredTechnologyIds.some((technologyId) => !completed.has(technologyId));
    if (!lacksRequiredTechnology && method) continue;
    const defaultRecipe = defaultRecipeForFacility(facility, recipe?.baseRecipeId || recipeId);
    if (!defaultRecipe || defaultRecipe.id === group.activeRecipeId) continue;
    group.activeRecipeId = defaultRecipe.id;
    if (group.enabled && group.status === 'running') group.cycleStartedAt = Number(now);
  }
}
function collectLegacyFacilityTypeIds(world, player) {
  const facilityTypeIds = new Set();
  const include = (facilityTypeId) => {
    if (FACILITY_BY_ID.has(String(facilityTypeId || ''))) facilityTypeIds.add(String(facilityTypeId));
  };
  for (const group of player?.facilityGroups || []) {
    if (Number(group?.count || 0) > 0) include(group.facilityTypeId);
  }
  include(player?.facilityConstruction?.facilityTypeId);
  for (const order of world?.orders || []) {
    if (
      Number(order?.ownerId) === Number(player?.userId)
      && order?.side === 'buy'
      && (order?.assetKind === 'facility' || order?.facilityTypeId)
      && isOpenOrder(order)
    ) include(order.facilityTypeId || order.assetId);
  }
  for (const auction of world?.assetAuctions || []) {
    if (auction?.status !== 'open' || Number(auction?.highestBidderId) !== Number(player?.userId)) continue;
    for (const item of auctionItems(auction)) {
      if (item?.assetKind === 'facility') include(item.assetId || item.facilityTypeId);
    }
  }
  return [...facilityTypeIds];
}
function deriveUnlockedComplexity(completed) {
  let rank = 1;
  for (let candidateRank = 1; candidateRank <= 7; candidateRank += 1) {
    const stageTechnologies = RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.rank === candidateRank);
    if (!stageTechnologies.every((technology) => completed.has(technology.id))) break;
    rank = candidateRank;
  }
  return stageForRank(rank).id;
}
function normalizeCompletedAtMap(previous, completed, now) {
  const source = previous?.completedAtByTechnologyId && typeof previous.completedAtByTechnologyId === 'object'
    ? previous.completedAtByTechnologyId
    : {};
  const fallback = Number.isFinite(Number(previous?.completedAt)) ? Number(previous.completedAt) : Number(now);
  return Object.fromEntries(sortedTechnologyIds(completed).map((technologyId) => {
    const value = Number(source[technologyId]);
    return [technologyId, Number.isFinite(value) && value >= 0 ? value : fallback];
  }));
}
function normalizeFixedResearchTiming(startedAt, completesAt, previousDurationMs) {
  // Paid research owns its deadline; changing the catalog must not reprice elapsed work or gem acceleration.
  const previousDuration = Number(previousDurationMs);
  return {
    durationMs: Number.isSafeInteger(previousDuration) && previousDuration > 0
      ? previousDuration : Math.max(1, Math.ceil(completesAt - startedAt)),
    completesAt,
  };
}
function normalizeActiveResearch(previousActive, completed) {
  if (!previousActive || typeof previousActive !== 'object') return null;
  const startedAt = Number(previousActive.startedAt);
  const completesAt = Number(previousActive.completesAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(completesAt) || completesAt <= startedAt) return null;

  const technology = researchTechnologyFor(previousActive.technologyId);
  if (technology && !completed.has(technology.id)) {
    const cost = Math.max(0, Math.floor(Number(previousActive.cost ?? technology.cost)));
    if (cost !== technology.cost) return null;
    const timing = normalizeFixedResearchTiming(
      startedAt,
      completesAt,
      previousActive.durationMs ?? (completesAt - startedAt),
    );
    const grantTechnologyIds = Array.isArray(previousActive.grantTechnologyIds)
      ? sortedTechnologyIds(previousActive.grantTechnologyIds).filter((technologyId) => !completed.has(technologyId))
      : [];
    return {
      technologyId: technology.id,
      technologyName: technology.name,
      targetComplexity: technology.stage,
      startedAt,
      completesAt: timing.completesAt,
      durationMs: timing.durationMs,
      cost,
      employmentReleased: Math.min(cost, Math.max(0, Math.floor(Number(previousActive.employmentReleased || 0)))),
      ...(grantTechnologyIds.length > 0 ? { grantTechnologyIds } : {}),
    };
  }

  const legacyTechnologyId = String(previousActive.technologyId || '');
  const targetComplexity = legacyTechnologyId.startsWith('legacy-stage-')
    ? legacyTechnologyId.slice('legacy-stage-'.length)
    : previousActive.targetComplexity;
  const target = stageFor(targetComplexity);
  if (target.rank <= 1) return null;
  const requestedGrantIds = Array.isArray(previousActive.grantTechnologyIds)
    ? previousActive.grantTechnologyIds
    : researchTechnologiesForStage(target.id).map((technologyItem) => technologyItem.id);
  const grantTechnologyIds = sortedTechnologyIds(requestedGrantIds).filter((technologyId) => !completed.has(technologyId));
  if (grantTechnologyIds.length === 0) return null;
  const legacy = LEGACY_LEVELS[target.id] || target;
  const cost = Math.max(0, Math.floor(Number(previousActive.cost ?? legacy.cost)));
  const timing = normalizeFixedResearchTiming(
    startedAt,
    completesAt,
    previousActive.durationMs ?? legacy.durationMs ?? (completesAt - startedAt),
  );
  return {
    technologyId: `legacy-stage-${target.id}`,
    technologyName: `${target.id} 旧版阶段研发`,
    targetComplexity: target.id,
    legacy: true,
    grantTechnologyIds,
    startedAt,
    completesAt: timing.completesAt,
    durationMs: timing.durationMs,
    cost,
    employmentReleased: Math.min(cost, Math.max(0, Math.floor(Number(previousActive.employmentReleased || 0)))),
  };
}

export function ensurePlayerResearch(world, player, now = Date.now(), migrationOptions = null) {
  if (!player || typeof player !== 'object') return null;
  const previous = player.research && typeof player.research === 'object' ? player.research : null;
  const completed = new Set();
  const hasNodeState = Array.isArray(previous?.completedTechnologyIds);
  if (hasNodeState) {
    for (const technologyId of previous.completedTechnologyIds) {
      if (RESEARCH_TECHNOLOGY_BY_ID.has(String(technologyId))) completed.add(String(technologyId));
    }
  } else {
    const legacyRank = complexityRank(previous?.unlockedComplexity);
    for (const technology of RESEARCH_TECHNOLOGY_CATALOG) {
      if (technology.rank <= legacyRank) completed.add(technology.id);
    }
  }
  for (const technology of RESEARCH_TECHNOLOGY_CATALOG) {
    if (technology.initial) completed.add(technology.id);
  }
  for (const facilityTypeId of collectLegacyFacilityTypeIds(world, player)) {
    const technology = researchTechnologyForFacility(facilityTypeId);
    if (technology) grantTechnologyClosure(completed, [technology.id]);
  }
  if (migrationOptions?.grantLegacyOperationAccess) grantLegacyOperationTechnologies(completed);

  const completedTechnologyIds = sortedTechnologyIds(completed);
  const completedAtByTechnologyId = normalizeCompletedAtMap(previous, completedTechnologyIds, now);
  const activeSource = migrationOptions?.grantLegacyOperationAccess
    ? activeResearchWithLegacyOperationGrants(previous?.active)
    : previous?.active;
  const active = normalizeActiveResearch(activeSource, completed);
  const completedAtValues = Object.values(completedAtByTechnologyId).map(Number).filter(Number.isFinite);
  const completedAt = completedAtValues.length > 0 ? Math.max(...completedAtValues) : null;
  const research = {
    unlockedComplexity: deriveUnlockedComplexity(completed),
    completedTechnologyIds,
    completedAtByTechnologyId,
    completedAt,
    active,
  };
  player.research = research;
  normalizeProductionMethodAccess(player, completed, now);
  player.stats ||= {};
  player.stats.researchPayroll = Math.max(0, Number(player.stats.researchPayroll || 0));
  player.stats.researchGemSpent = Math.max(0, Number(player.stats.researchGemSpent || 0));
  return research;
}

export function migrateResearchWorld(world, now = Date.now()) {
  if (!world || typeof world !== 'object') return world;
  const grantLegacyOperationAccess = Number(world.version || 0) < RESEARCH_WORLD_VERSION;
  for (const player of Object.values(world.players || {})) {
    ensurePlayerResearch(world, player, now, { grantLegacyOperationAccess });
  }
  world.version = Math.max(Number(world.version || 0), RESEARCH_WORLD_VERSION);
  return world;
}

export function releaseResearchEmployment(world, player, now = Date.now()) {
  const research = ensurePlayerResearch(world, player, now);
  const active = research?.active;
  if (!active) return 0;
  const duration = Math.max(1, Number(active.durationMs || (active.completesAt - active.startedAt)));
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
  const currentActive = currentResearch?.active;
  if (!currentActive) return false;
  const completed = new Set(currentResearch.completedTechnologyIds || []);
  const grantTechnologyIds = Array.isArray(currentActive.grantTechnologyIds)
    ? currentActive.grantTechnologyIds
    : [currentActive.technologyId];
  grantTechnologyClosure(completed, grantTechnologyIds);
  currentResearch.completedTechnologyIds = sortedTechnologyIds(completed);
  currentResearch.completedAtByTechnologyId ||= {};
  for (const technologyId of grantTechnologyIds) {
    if (RESEARCH_TECHNOLOGY_BY_ID.has(technologyId)) {
      currentResearch.completedAtByTechnologyId[technologyId] = Number(currentActive.completesAt);
    }
  }
  currentResearch.unlockedComplexity = deriveUnlockedComplexity(completed);
  currentResearch.completedAt = Number(currentActive.completesAt);
  currentResearch.active = null;
  normalizeProductionMethodAccess(player, completed, now);
  return true;
}

export function processPlayerResearch(world, player, now = Date.now()) {
  const research = ensurePlayerResearch(world, player, now);
  if (!research?.active) return research;
  releaseResearchEmployment(world, player, now);
  completeResearchIfDue(world, player, now);
  return player.research;
}

export function processResearchWorld(world, now = Date.now()) {
  migrateResearchWorld(world, now);
  for (const player of Object.values(world.players || {})) processPlayerResearch(world, player, now);
  return world;
}

function startTechnologyResearch(world, player, technologyId, now) {
  const research = ensurePlayerResearch(world, player, now);
  if (research.active) return { ok: false, message: '已有研发项目正在进行' };
  const technology = researchTechnologyFor(technologyId);
  if (!technology || technology.initial) return { ok: false, message: '科技节点不存在或已初始掌握' };
  const completed = new Set(research.completedTechnologyIds || []);
  if (completed.has(technology.id)) return { ok: false, message: `「${technology.name}」已经完成` };
  const missing = technology.prerequisiteTechnologyIds
    .map((prerequisiteId) => researchTechnologyFor(prerequisiteId))
    .filter((prerequisite) => prerequisite && !completed.has(prerequisite.id));
  if (missing.length > 0) return { ok: false, message: `需要先完成「${missing.map((item) => item.name).join('」「')}」` };
  if (Number(player.credits || 0) < technology.cost) return { ok: false, message: '可用资金不足' };
  player.credits = Number(player.credits || 0) - technology.cost;
  player.research = {
    ...research,
    active: {
      technologyId: technology.id,
      technologyName: technology.name,
      targetComplexity: technology.stage,
      startedAt: Number(now),
      completesAt: Number(now) + technology.durationMs,
      durationMs: technology.durationMs,
      cost: technology.cost,
      employmentReleased: 0,
    },
  };
  return { ok: true, message: `已开始研发「${technology.name}」` };
}

function startLegacyStageResearch(world, player, targetComplexity, now) {
  const research = ensurePlayerResearch(world, player, now);
  if (research.active) return { ok: false, message: '已有研发项目正在进行' };
  const current = stageFor(research.unlockedComplexity);
  const target = stageFor(targetComplexity);
  if (current.rank >= 7) return { ok: false, message: '全部研发已经完成' };
  if (target.rank !== current.rank + 1) return { ok: false, message: '旧版客户端只能研发当前完整阶段的下一级' };
  const completed = new Set(research.completedTechnologyIds || []);
  const grantTechnologyIds = researchTechnologiesForStage(target.id)
    .map((technology) => technology.id)
    .filter((technologyId) => !completed.has(technologyId));
  if (grantTechnologyIds.length === 0) return { ok: false, message: `${target.id} 阶段已经完成` };
  const cost = grantTechnologyIds.reduce((sum, technologyId) => sum + researchTechnologyFor(technologyId).cost, 0);
  if (Number(player.credits || 0) < cost) return { ok: false, message: '可用资金不足' };
  player.credits = Number(player.credits || 0) - cost;
  player.research = {
    ...research,
    active: {
      technologyId: `legacy-stage-${target.id}`,
      technologyName: `${target.id} 阶段研发`,
      targetComplexity: target.id,
      legacy: true,
      grantTechnologyIds,
      startedAt: Number(now),
      completesAt: Number(now) + target.durationMs,
      durationMs: target.durationMs,
      cost,
      employmentReleased: 0,
    },
  };
  return { ok: true, message: `已开始研发 ${target.id} 阶段` };
}

function startResearch(world, player, payload, now) {
  if (payload?.technologyId) return startTechnologyResearch(world, player, payload.technologyId, now);
  return startLegacyStageResearch(world, player, payload?.targetComplexity, now);
}

function accelerateResearch(world, player, now) {
  const research = ensurePlayerResearch(world, player, now);
  const active = research?.active;
  if (!active) return { ok: false, message: '当前没有正在进行的研发' };
  if (Number(player.gems || 0) < GEM_RESEARCH_ACCELERATION_COST) {
    return { ok: false, message: '宝石余额不足' };
  }
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
  const technologyName = String(active.technologyName || active.targetComplexity || '研发');

  return {
    ok: true,
    message: completedImmediately
      ? `已使用 1 宝石，「${technologyName}」立即完成`
      : `已使用 1 宝石，「${technologyName}」减少 30m`,
    technologyId: active.technologyId,
    targetComplexity: active.targetComplexity,
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
  const player = world.players?.[String(user?.id)];
  if (!player) return { ok: false, message: '玩家不存在' };
  if (Number(world.version || 0) < RESEARCH_WORLD_VERSION) processResearchWorld(world, now);
  else processPlayerResearch(world, player, now);
  return action === 'startResearch'
    ? startResearch(world, player, payload, now)
    : accelerateResearch(world, player, now);
}

export function hasResearchAccessForFacility(world, player, facilityTypeId, now = Date.now()) {
  const technology = researchTechnologyForFacility(facilityTypeId);
  if (!technology) return false;
  const research = ensurePlayerResearch(world, player, now);
  return Boolean(research?.completedTechnologyIds?.includes(technology.id));
}

function lockedResult(world, player, facilityTypeId, now) {
  const technology = researchTechnologyForFacility(facilityTypeId);
  if (!technology) return { ok: false, message: '该工厂没有配置研发科技' };
  if (hasResearchAccessForFacility(world, player, facilityTypeId, now)) return null;
  return { ok: false, message: `需要先完成「${technology.name}」研发` };
}

function productionMethodLockedResult(world, player, facilityTypeId, recipeId, now) {
  const facility = FACILITY_BY_ID.get(String(facilityTypeId || ''));
  if (!facility) return null;
  if (isLegacyProductionMethodRecipeId(recipeId)) return { ok: false, message: '该旧作业制度已退役，请选择当前作业制度' };
  const recipe = facility.recipes.find((candidate) => candidate.id === String(recipeId || ''));
  if (!recipe) return null;
  const method = productionMethodForRecipe(facility, recipe);
  if (!method) return { ok: false, message: '该旧作业制度已退役，请选择当前作业制度' };
  const research = ensurePlayerResearch(world, player, now);
  const completed = new Set(research?.completedTechnologyIds || []);
  const missing = (method.requiredTechnologyIds || [])
    .map((technologyId) => researchTechnologyFor(technologyId))
    .filter((technology) => technology && !completed.has(technology.id));
  return missing.length > 0
    ? { ok: false, message: `需要先完成「${missing.map((technology) => technology.name).join('」「')}」研发` }
    : null;
}

export function validateResearchAccess(world, user, action, payload = {}, now = Date.now()) {
  if (!world?.players?.[String(user?.id)]) return null;
  const player = world.players[String(user.id)];
  if (Number(world.version || 0) < RESEARCH_WORLD_VERSION) processResearchWorld(world, now);
  else processPlayerResearch(world, player, now);
  if (action === 'setFacilityRecipes') {
    const targets = Array.isArray(payload?.targets) ? payload.targets : [];
    for (const target of targets) {
      const facilityTypeId = String(target?.facilityTypeId || '');
      if (!facilityTypeId) continue;
      const facilityLocked = lockedResult(world, player, facilityTypeId, now);
      if (facilityLocked) return facilityLocked;
      const methodLocked = productionMethodLockedResult(
        world,
        player,
        facilityTypeId,
        target?.recipeId,
        now,
      );
      if (methodLocked) return methodLocked;
    }
    return null;
  }
  let facilityTypeId = null;
  if (['buildFacility', 'startFacility', 'setFacilityRecipe'].includes(action)) {
    facilityTypeId = payload.facilityTypeId;
  } else if (action === 'placeOrder' && payload.assetKind === 'facility' && payload.side === 'buy') {
    facilityTypeId = payload.facilityTypeId || payload.assetId;
  } else if (action === 'buyFacility') {
    const listing = (world.facilityListings || []).find((item) => item.id === payload.listingId);
    facilityTypeId = listing?.facilityTypeId || listing?.facility?.facilityTypeId;
  }
  if (facilityTypeId) {
    const facilityLocked = lockedResult(world, player, facilityTypeId, now);
    if (facilityLocked) return facilityLocked;
    if (action === 'setFacilityRecipe') {
      return productionMethodLockedResult(world, player, facilityTypeId, payload.recipeId, now);
    }
    return null;
  }
  if (action === 'placeAuctionBid') {
    const auction = (world.assetAuctions || []).find((item) => item.id === payload.auctionId);
    for (const item of auctionItems(auction)) {
      if (item?.assetKind !== 'facility') continue;
      const locked = lockedResult(world, player, item.assetId || item.facilityTypeId, now);
      if (locked) return locked;
    }
  }
  return null;
}

export function createResearchClientState(_world, player) {
  const research = clone(
    player?.research && typeof player.research === 'object'
      ? player.research
      : {
          unlockedComplexity: 'C1',
          completedTechnologyIds: RESEARCH_TECHNOLOGY_CATALOG
            .filter((technology) => technology.initial)
            .map((technology) => technology.id),
          completedAtByTechnologyId: {},
          completedAt: null,
          active: null,
        },
  );
  if (research.active) {
    research.active.gemAccelerationMs = GEM_RESEARCH_ACCELERATION_MS;
    research.active.gemAccelerationCost = GEM_RESEARCH_ACCELERATION_COST;
  }
  return {
    researchLevels: clone(RESEARCH_LEVEL_CATALOG),
    researchTechnologies: clone(RESEARCH_TECHNOLOGY_CATALOG),
    research,
  };
}

export function nextResearchEmploymentAt(active) {
  if (!active) return null;
  const startedAt = Number(active.startedAt);
  const completesAt = Number(active.completesAt);
  const duration = Math.max(1, Number(active.durationMs || (completesAt - startedAt)));
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
