import { buildingAvailableInput, buildingFreezeSource, reconcileBuildingInputFreezes } from './building-input-freezes.js';
import { consumeBuildingCommodity } from './commodity-freezes.js';
import { bootstrapBuildingAutoOperation, completeBuildingCycleAutoOperation } from './cycle-auto-operation.js';
import { commercialExpansionStaffingRate, commercialStaffingCapacity, hasCommercialCycle, projectCommercialStaffingRate } from '../../shared/commercial-staffing.js';
import { normalizeCommercialAutoOperationPolicy } from '../../shared/commercial-auto-operation.js';
import {
  COMMERCIAL_PROMOTION_CYCLES,
  commercialCycleFootfall,
  commercialPopularityAfterCycle,
  commercialPopularityChange,
  commercialStarRating,
  normalizeCommercialPopularity,
  normalizeCommercialServiceLevel,
} from '../../shared/commercial-popularity.js';
import { multiplyMoneyByInteger, roundInternalMoney } from './money.js';
import { PRODUCT_CATALOG } from './product-catalog.js';
import { validateCommercialResearchAccess } from './research.js';
import {
  DEFAULT_PROVINCE_ID,
  PROVINCE_CATALOG,
  inventoryForProvince,
  normalizeProvinceId,
  provinceScopedKey,
} from './provinces.js';

import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';
export { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';

const MAX_BUILD_QUANTITY = 100;
const MAX_CATCH_UP_CYCLES = 10_000;

const TYPE_BY_ID = new Map(COMMERCIAL_BUILDING_TYPE_CATALOG.map((type) => [type.id, type]));
const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function result(ok, message) {
  return { ok, message };
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= max ? value : null;
}

function normalizeNonNegativeMoney(value) {
  const normalized = roundInternalMoney(value);
  return normalized === null ? 0 : Math.max(0, normalized);
}

function typeFor(typeId) {
  return TYPE_BY_ID.get(String(typeId || '')) || null;
}

function officialPriceFor(world, productId, provinceId) {
  const market = world.markets?.[provinceScopedKey(provinceId, productId)];
  const price = Number(market?.officialPrice ?? market?.lastPrice ?? PRODUCT_BY_ID.get(productId)?.basePrice ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function normalizeGroup(group, now = Date.now()) {
  if (!group || typeof group !== 'object') return null;
  const type = typeFor(group.commercialTypeId);
  if (!type) return null;
  group.commercialTypeId = type.id;
  group.provinceId = normalizeProvinceId(group.provinceId || DEFAULT_PROVINCE_ID);
  group.count = Math.max(0, Math.floor(Number(group.count || 0)));
  group.participatingCount = Math.max(0, Math.min(group.count, Math.floor(Number(group.participatingCount || 0))));
  group.enabled = group.enabled === true;
  if (group.autoOperationPolicy !== undefined) {
    const policy = normalizeCommercialAutoOperationPolicy(group.autoOperationPolicy);
    if (policy) group.autoOperationPolicy = policy;
    else delete group.autoOperationPolicy;
  }
  group.status = ['running', 'stopped', 'error'].includes(group.status)
    ? group.status
    : group.enabled ? 'error' : 'stopped';
  group.statusReason = ['manual', 'insufficient_funds', 'insufficient_input'].includes(group.statusReason)
    ? group.statusReason
    : group.status === 'stopped' ? 'manual' : undefined;
  group.lifetimeRevenue = normalizeNonNegativeMoney(group.lifetimeRevenue);
  group.lifetimeProfit = normalizeNonNegativeMoney(group.lifetimeProfit);
  group.lifetimeGoodsConsumed = Math.max(0, Math.floor(Number(group.lifetimeGoodsConsumed || 0)));
  group.popularity = normalizeCommercialPopularity(group.popularity);
  group.serviceLevel = normalizeCommercialServiceLevel(group.serviceLevel) || 'standard';
  group.popularityProtectionCycles = Math.max(0, Math.min(2, Math.floor(Number(group.popularityProtectionCycles || 0))));
  group.promotionCyclesRemaining = Math.max(0, Math.min(
    COMMERCIAL_PROMOTION_CYCLES,
    Math.floor(Number(group.promotionCyclesRemaining || 0)),
  ));
  group.promotionCoveredCount = group.promotionCyclesRemaining > 0
    ? Math.max(0, Math.min(group.count, Math.floor(Number(group.promotionCoveredCount || 0))))
    : 0;
  group.lifetimeFootfall = Math.max(0, Math.floor(Number(group.lifetimeFootfall || 0)));
  if (group.lastFootfall !== undefined) group.lastFootfall = Math.max(0, Math.floor(Number(group.lastFootfall || 0)));
  if (group.lastTargetFootfall !== undefined) group.lastTargetFootfall = Math.max(0, Math.floor(Number(group.lastTargetFootfall || 0)));
  if (group.lastPopularityChange !== undefined) {
    group.lastPopularityChange = Math.max(-2, Math.min(3, Math.floor(Number(group.lastPopularityChange || 0))));
  }
  group.pendingRevenue = normalizeNonNegativeMoney(group.pendingRevenue);
  group.pendingProfit = normalizeNonNegativeMoney(group.pendingProfit);
  group.pendingGoodsConsumed = Math.max(0, Math.floor(Number(group.pendingGoodsConsumed || 0)));
  if (hasCommercialCycle(group)) {
    if (group.pendingOperatingCost !== undefined) group.pendingOperatingCost = normalizeNonNegativeMoney(group.pendingOperatingCost);
    if (group.pendingServiceCost !== undefined) group.pendingServiceCost = normalizeNonNegativeMoney(group.pendingServiceCost);
    if (group.pendingInputValue !== undefined) group.pendingInputValue = normalizeNonNegativeMoney(group.pendingInputValue);
    if (group.pendingPopularity !== undefined) group.pendingPopularity = normalizeCommercialPopularity(group.pendingPopularity);
    if (group.pendingStarRating !== undefined) {
      const starRating = Number(group.pendingStarRating);
      if (Number.isInteger(starRating) && starRating >= 1 && starRating <= 5) group.pendingStarRating = starRating;
      else delete group.pendingStarRating;
    }
    for (const key of ['pendingFootfall', 'pendingTargetFootfall']) {
      const value = Number(group[key]);
      if (group[key] !== undefined && Number.isSafeInteger(value) && value >= 0) group[key] = value;
      else if (group[key] !== undefined) delete group[key];
    }
    if (group.pendingPopularityChange !== undefined) {
      const change = Number(group.pendingPopularityChange);
      if (Number.isInteger(change) && change >= -2 && change <= 3) group.pendingPopularityChange = change;
      else delete group.pendingPopularityChange;
    }
    if (group.pendingServiceLevel !== undefined) {
      const pendingServiceLevel = normalizeCommercialServiceLevel(group.pendingServiceLevel);
      if (pendingServiceLevel) group.pendingServiceLevel = pendingServiceLevel;
      else delete group.pendingServiceLevel;
    }
    if (group.pendingPromotionActive !== undefined) group.pendingPromotionActive = group.pendingPromotionActive === true;
    group.cycleActive = true;
    group.cycleStartedAt = Math.max(0, Number(group.cycleStartedAt || now));
    group.cycleCompletesAt = Math.max(group.cycleStartedAt, Number(group.cycleCompletesAt || (group.cycleStartedAt + type.cycleMs)));
    group.status = 'running';
    delete group.statusReason;
  } else {
    delete group.cycleStartedAt;
    delete group.cycleCompletesAt;
    delete group.pendingRevenue;
    delete group.pendingProfit;
    delete group.pendingGoodsConsumed;
    delete group.pendingOperatingCost;
    delete group.pendingInputValue;
    delete group.pendingInputs;
    delete group.cycleActive;
    delete group.pendingStaffingRateBps;
    delete group.pendingEffectiveCount;
    delete group.pendingPopularity;
    delete group.pendingStarRating;
    delete group.pendingFootfall;
    delete group.pendingTargetFootfall;
    delete group.pendingPopularityChange;
    delete group.pendingServiceLevel;
    delete group.pendingServiceCost;
    delete group.pendingPromotionActive;
    group.participatingCount = 0;
    if (!group.enabled) {
      group.status = 'stopped';
      group.statusReason = 'manual';
    }
  }
  if (!Number.isInteger(group.staffingRateBps) || group.staffingRateBps < 0 || group.staffingRateBps > 10_000
    || !Number.isFinite(group.staffingUpdatedAt) || group.staffingUpdatedAt < 0) {
    // Establish the migration baseline now; never apply decay retroactively to old saves.
    group.staffingRateBps = 10_000;
    group.staffingUpdatedAt = Math.max(0, Number(now) || 0);
  }
  if (!Number.isInteger(group.staffingBatchCarryBps) || group.staffingBatchCarryBps < 0 || group.staffingBatchCarryBps >= 10_000) group.staffingBatchCarryBps = 0;
  return group.count > 0 ? group : null;
}

export function ensureCommercialPlayer(player, now = Date.now()) {
  player.commercialBuildingGroups = (player.commercialBuildingGroups || [])
    .map((group) => normalizeGroup(group, now))
    .filter(Boolean);
  player.stats ||= {};
  player.stats.commercialGrossRevenueIssued = normalizeNonNegativeMoney(player.stats.commercialGrossRevenueIssued);
  player.stats.commercialProfitIssued = normalizeNonNegativeMoney(player.stats.commercialProfitIssued);
  player.stats.commercialOperatingCosts = normalizeNonNegativeMoney(player.stats.commercialOperatingCosts);
  player.stats.commercialServiceCosts = normalizeNonNegativeMoney(player.stats.commercialServiceCosts);
  player.stats.commercialPromotionCosts = normalizeNonNegativeMoney(player.stats.commercialPromotionCosts);
  player.stats.commercialGoodsConsumed = Math.max(0, Math.floor(Number(player.stats.commercialGoodsConsumed || 0)));
  player.stats.commercialFootfall = Math.max(0, Math.floor(Number(player.stats.commercialFootfall || 0)));
  player.stats.commercialBuildingsConstructed = Math.max(0, Math.floor(Number(player.stats.commercialBuildingsConstructed || 0)));
  return player;
}

export function migrateCommercialWorld(world, now = Date.now()) {
  for (const player of Object.values(world.players || {})) ensureCommercialPlayer(player, now);
  return world;
}

function groupFor(player, commercialTypeId, provinceId, create = false, now = Date.now()) {
  ensureCommercialPlayer(player, now);
  const normalizedProvinceId = normalizeProvinceId(provinceId);
  let group = player.commercialBuildingGroups.find((candidate) => (
    candidate.commercialTypeId === commercialTypeId && candidate.provinceId === normalizedProvinceId
  ));
  if (!group && create) {
    group = {
      commercialTypeId,
      provinceId: normalizedProvinceId,
      count: 0,
      participatingCount: 0,
      enabled: false,
      status: 'stopped',
      statusReason: 'manual',
      staffingRateBps: 10_000,
      staffingUpdatedAt: now,
      staffingBatchCarryBps: 0,
      popularity: 0,
      popularityProtectionCycles: 2,
      serviceLevel: 'standard',
      promotionCyclesRemaining: 0,
      promotionCoveredCount: 0,
      lifetimeRevenue: 0,
      lifetimeProfit: 0,
      lifetimeGoodsConsumed: 0,
      lifetimeFootfall: 0,
    };
    player.commercialBuildingGroups.push(group);
  }
  return group || null;
}

function profitPerCycleForStar(type, starRating) {
  const starProfit = type.profitPerCycleByStar?.[starRating - 1];
  return normalizeNonNegativeMoney(starProfit ?? type.profitPerCycle);
}

function cycleRequirements(type, participatingCount, starRating, serviceLevel) {
  const inputs = type.consumptionInputs.map((item) => ({
    productId: item.productId,
    quantity: item.quantity * participatingCount,
  }));
  const operatingCost = multiplyMoneyByInteger(type.operatingCost, participatingCount);
  const serviceCost = multiplyMoneyByInteger(
    serviceLevel === 'premium' ? type.premiumServiceCostPerCycle : 0,
    participatingCount,
  );
  const profit = multiplyMoneyByInteger(profitPerCycleForStar(type, starRating), participatingCount);
  return {
    inputs,
    operatingCost: operatingCost ?? Number.POSITIVE_INFINITY,
    serviceCost: serviceCost ?? Number.POSITIVE_INFINITY,
    profit: profit ?? Number.POSITIVE_INFINITY,
  };
}

function commitCommercialStaffing(group, now) {
  const at = Math.max(Number(group.staffingUpdatedAt) || 0, Number(now) || 0);
  const rate = projectCommercialStaffingRate(group, at);
  group.staffingRateBps = rate ?? 10_000;
  group.staffingUpdatedAt = at;
  return group.staffingRateBps;
}

function setBlocked(group, reason, now) {
  if (group.status !== 'error') commitCommercialStaffing(group, now);
  group.status = 'error';
  group.statusReason = reason;
  group.participatingCount = 0;
}

function startCycle(world, player, group, type, startedAt) {
  if (!group.enabled || group.count < 1 || hasCommercialCycle(group)) return false;
  const participatingCount = group.count;
  const rate = projectCommercialStaffingRate(group, startedAt) ?? 10_000;
  const capacity = commercialStaffingCapacity(participatingCount, rate, group.staffingBatchCarryBps);
  const popularity = normalizeCommercialPopularity(group.popularity);
  const starRating = commercialStarRating(popularity);
  const serviceLevel = normalizeCommercialServiceLevel(group.serviceLevel) || 'standard';
  const promotionCoveredCount = group.promotionCyclesRemaining > 0 ? group.promotionCoveredCount : 0;
  const traffic = commercialCycleFootfall({
    count: participatingCount,
    effectiveCount: capacity.effectiveCount,
    popularity,
    serviceLevel,
    promotionCoveredCount,
  });
  const naturalPopularityChange = commercialPopularityChange(traffic.footfall, traffic.targetFootfall);
  const popularityProtected = group.popularityProtectionCycles > 0 && naturalPopularityChange < 0;
  const popularityChange = popularityProtected ? 0 : naturalPopularityChange;
  const requirements = cycleRequirements(type, capacity.effectiveCount, starRating, serviceLevel);
  const requiredCredits = roundInternalMoney(requirements.operatingCost + requirements.serviceCost);
  if (requiredCredits === null || requiredCredits > player.credits) {
    setBlocked(group, 'insufficient_funds', startedAt);
    return false;
  }
  for (const input of requirements.inputs) {
    if (buildingAvailableInput(player, group, input.productId, 'commercial') < input.quantity) {
      setBlocked(group, 'insufficient_input', startedAt);
      return false;
    }
  }

  const inputValue = requirements.inputs.reduce((sum, input) => (
    sum + input.quantity * officialPriceFor(world, input.productId, group.provinceId)
  ), 0);
  const revenue = roundInternalMoney(inputValue + requirements.operatingCost + requirements.profit);
  if (revenue === null || !Number.isFinite(revenue)) {
    setBlocked(group, 'insufficient_funds', startedAt);
    return false;
  }

  player.credits = roundInternalMoney(player.credits - requiredCredits) ?? 0;
  player.stats.systemSinks = normalizeNonNegativeMoney(Number(player.stats.systemSinks || 0) + requiredCredits);
  player.stats.commercialOperatingCosts = normalizeNonNegativeMoney(
    Number(player.stats.commercialOperatingCosts || 0) + requirements.operatingCost,
  );
  player.stats.commercialServiceCosts = normalizeNonNegativeMoney(
    Number(player.stats.commercialServiceCosts || 0) + requirements.serviceCost,
  );
  let goodsConsumed = 0;
  for (const input of requirements.inputs) {
    const inventory = inventoryForProvince(player, input.productId, group.provinceId);
    consumeBuildingCommodity(inventory, 'commercial', buildingFreezeSource(group, 'commercial'), input.quantity);
    goodsConsumed += input.quantity;
  }

  delete group.autoOperationBootstrapPending;
  group.staffingRateBps = rate;
  group.staffingUpdatedAt = Math.max(Number(group.staffingUpdatedAt) || 0, startedAt);
  group.staffingBatchCarryBps = capacity.carryBps;
  group.popularityProtectionCycles = Math.max(0, group.popularityProtectionCycles - 1);
  if (capacity.effectiveCount > 0 && promotionCoveredCount > 0) {
    group.promotionCyclesRemaining = Math.max(0, group.promotionCyclesRemaining - 1);
    if (group.promotionCyclesRemaining === 0) group.promotionCoveredCount = 0;
  }
  group.cycleActive = true;
  group.pendingStaffingRateBps = rate;
  group.pendingEffectiveCount = capacity.effectiveCount;
  group.participatingCount = participatingCount;
  group.status = 'running';
  delete group.statusReason;
  group.cycleStartedAt = startedAt;
  group.cycleCompletesAt = startedAt + type.cycleMs;
  group.pendingRevenue = revenue;
  group.pendingOperatingCost = requirements.operatingCost;
  group.pendingServiceCost = requirements.serviceCost;
  group.pendingInputValue = roundInternalMoney(inputValue);
  group.pendingInputs = requirements.inputs.map((input) => ({ ...input }));
  group.pendingProfit = requirements.profit;
  group.pendingGoodsConsumed = goodsConsumed;
  group.pendingPopularity = popularity;
  group.pendingStarRating = starRating;
  group.pendingFootfall = traffic.footfall;
  group.pendingTargetFootfall = traffic.targetFootfall;
  group.pendingPopularityChange = popularityChange;
  group.pendingServiceLevel = serviceLevel;
  group.pendingPromotionActive = capacity.effectiveCount > 0 && promotionCoveredCount > 0;
  return true;
}

function settleCycle(player, group) {
  const revenue = normalizeNonNegativeMoney(group.pendingRevenue);
  const profit = normalizeNonNegativeMoney(group.pendingProfit);
  const goodsConsumed = Math.max(0, Math.floor(Number(group.pendingGoodsConsumed || 0)));
  const footfall = Number.isSafeInteger(group.pendingFootfall) && group.pendingFootfall >= 0
    ? group.pendingFootfall : null;
  const targetFootfall = Number.isSafeInteger(group.pendingTargetFootfall) && group.pendingTargetFootfall >= 0
    ? group.pendingTargetFootfall : null;
  const popularityChange = Number.isInteger(group.pendingPopularityChange)
    ? Math.max(-2, Math.min(3, group.pendingPopularityChange)) : null;
  player.credits = roundInternalMoney(Number(player.credits || 0) + revenue) ?? Number(player.credits || 0);
  player.stats.commercialGrossRevenueIssued = normalizeNonNegativeMoney(
    Number(player.stats.commercialGrossRevenueIssued || 0) + revenue,
  );
  player.stats.commercialProfitIssued = normalizeNonNegativeMoney(
    Number(player.stats.commercialProfitIssued || 0) + profit,
  );
  player.stats.commercialGoodsConsumed = Math.max(0, Math.floor(Number(player.stats.commercialGoodsConsumed || 0) + goodsConsumed));
  if (footfall !== null) {
    player.stats.commercialFootfall = Math.max(0, Math.floor(Number(player.stats.commercialFootfall || 0) + footfall));
  }
  group.lifetimeRevenue = normalizeNonNegativeMoney(Number(group.lifetimeRevenue || 0) + revenue);
  group.lifetimeProfit = normalizeNonNegativeMoney(Number(group.lifetimeProfit || 0) + profit);
  group.lifetimeGoodsConsumed = Math.max(0, Math.floor(Number(group.lifetimeGoodsConsumed || 0) + goodsConsumed));
  if (footfall !== null && targetFootfall !== null && popularityChange !== null) {
    group.popularity = commercialPopularityAfterCycle(group.popularity, popularityChange);
    group.lifetimeFootfall = Math.max(0, Math.floor(Number(group.lifetimeFootfall || 0) + footfall));
    group.lastFootfall = footfall;
    group.lastTargetFootfall = targetFootfall;
    group.lastPopularityChange = popularityChange;
  }
  group.participatingCount = 0;
  delete group.cycleStartedAt;
  delete group.cycleCompletesAt;
  delete group.pendingRevenue;
  delete group.pendingProfit;
  delete group.pendingGoodsConsumed;
  delete group.pendingOperatingCost;
  delete group.pendingServiceCost;
  delete group.pendingInputValue;
  delete group.pendingInputs;
  delete group.cycleActive;
  delete group.pendingStaffingRateBps;
  delete group.pendingEffectiveCount;
  delete group.pendingPopularity;
  delete group.pendingStarRating;
  delete group.pendingFootfall;
  delete group.pendingTargetFootfall;
  delete group.pendingPopularityChange;
  delete group.pendingServiceLevel;
  delete group.pendingPromotionActive;
}

function processGroup(world, player, group, now, { allowInitialBootstrap = true, allowCycleStart = true } = {}) {
  const type = typeFor(group.commercialTypeId);
  if (!type) return;
  let cycles = 0;
  let lastCompletedAt = 0;
  while (hasCommercialCycle(group) && Number(group.cycleCompletesAt || Number.POSITIVE_INFINITY) <= now) {
    const completedAt = Number(group.cycleCompletesAt);
    settleCycle(player, group);
    lastCompletedAt = completedAt;
    cycles += 1;
    if (!group.enabled || !allowCycleStart || cycles >= MAX_CATCH_UP_CYCLES) break;
    if (!startCycle(world, player, group, type, completedAt)) break;
  }
  if (lastCompletedAt > 0) completeBuildingCycleAutoOperation(world, player, group, 'commercial', lastCompletedAt, now);
  if (hasCommercialCycle(group)) return;
  if (!group.enabled) {
    group.status = 'stopped';
    group.statusReason = 'manual';
    group.participatingCount = 0;
    return;
  }
  if (cycles < MAX_CATCH_UP_CYCLES && allowCycleStart) {
    if (allowInitialBootstrap && group.autoOperationBootstrapPending === true) {
      bootstrapBuildingAutoOperation(world, player, now, group.provinceId);
    }
    startCycle(world, player, group, type, now);
  }
}

export function processCommercialWorld(world, now = Date.now()) {
  for (const player of Object.values(world.players || {})) {
    ensureCommercialPlayer(player, now);
    for (const group of player.commercialBuildingGroups) processGroup(world, player, group, now);
    if (player.commercialBuildingGroups.length > 0) reconcileBuildingInputFreezes(world, player, now);
  }
  return world;
}

function buildCommercialBuilding(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  if (!player) return result(false, '玩家不存在');
  const type = typeFor(payload.commercialTypeId);
  if (!type) return result(false, '商业建筑类型不存在');
  const quantity = normalizePositiveInteger(payload.quantity, MAX_BUILD_QUANTITY);
  if (!quantity) return result(false, `建造数量必须为 1 到 ${MAX_BUILD_QUANTITY} 的整数`);
  const researchLocked = validateCommercialResearchAccess(world, player, type.id, now);
  if (researchLocked) return researchLocked;
  const provinceId = normalizeProvinceId(payload.provinceId);
  const existingGroup = groupFor(player, type.id, provinceId, false, now);
  const firstBuild = !existingGroup || existingGroup.count < 1;
  if (existingGroup) processGroup(world, player, existingGroup, now);
  if (!Number.isSafeInteger((existingGroup?.count ?? 0) + quantity)) return result(false, '建筑数量超出系统可表示范围');
  const totalCost = multiplyMoneyByInteger(type.buildCost, quantity);
  if (totalCost === null) return result(false, '建造资金超出系统可表示范围');
  if (player.credits < totalCost) return result(false, '建造资金不足');
  player.credits = roundInternalMoney(player.credits - totalCost) ?? 0;
  player.stats.systemSinks = normalizeNonNegativeMoney(Number(player.stats.systemSinks || 0) + totalCost);
  player.stats.commercialBuildingsConstructed = Math.max(
    0,
    Math.floor(Number(player.stats.commercialBuildingsConstructed || 0) + quantity),
  );
  const group = groupFor(player, type.id, provinceId, true, now);
  const previousCount = group.count;
  const rate = commitCommercialStaffing(group, now);
  group.count += quantity;
  group.staffingRateBps = commercialExpansionStaffingRate(rate, previousCount, group.count);
  group.popularityProtectionCycles = Math.max(group.popularityProtectionCycles, firstBuild ? 2 : 1);
  if (firstBuild) {
    group.autoOperationBootstrapPending = true;
    group.enabled = true;
    processGroup(world, player, group, now);
    return result(
      true,
      hasCommercialCycle(group)
        ? `${quantity} 座${type.name}已建成并默认开启营业`
        : `${quantity} 座${type.name}已建成并默认开启营业意图，当前条件不足，满足后将自动启动`,
    );
  }
  return result(true, `${quantity} 座${type.name}已建成并加入同类商业建筑集群`);
}

function startCommercialBuilding(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!player || !type || !group || group.count < 1) return result(false, '商业建筑集群不存在');
  const researchLocked = validateCommercialResearchAccess(world, player, type.id, now);
  if (researchLocked) return researchLocked;
  processGroup(world, player, group, now);
  if (!group.enabled) commitCommercialStaffing(group, now);
  group.enabled = true;
  if (hasCommercialCycle(group)) return result(true, `${type.name}已保持营业，当前周期继续进行`);
  if (group.autoOperationBootstrapPending === true) bootstrapBuildingAutoOperation(world, player, now, group.provinceId);
  if (startCycle(world, player, group, type, now)) {
    return result(true, `${type.name}已开始营业，${group.participatingCount} 座建筑参与当前周期`);
  }
  return result(
    true,
    `${type.name}已开启自动营业，当前${group.statusReason === 'insufficient_funds' ? '运营资金不足' : '消费商品不足'}，条件满足后将自动恢复`,
  );
}

function stopCommercialBuilding(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!player || !type || !group) return result(false, '商业建筑集群不存在');
  processGroup(world, player, group, now, { allowInitialBootstrap: false });
  if (group.enabled) commitCommercialStaffing(group, now);
  group.enabled = false;
  if (hasCommercialCycle(group)) {
    return result(true, `${type.name}已关闭自动续营，当前已投入周期结算后停止`);
  }
  group.status = 'stopped';
  group.statusReason = 'manual';
  group.participatingCount = 0;
  return result(true, `${type.name}已停止营业`);
}

function setCommercialAutoOperation(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!group || group.count < 1) return result(false, '商业建筑集群不存在');
  const policy = normalizeCommercialAutoOperationPolicy(payload.policy);
  if (!policy) return result(false, '自动经营策略无效');
  processGroup(world, player, group, now, { allowInitialBootstrap: false });
  group.autoOperationPolicy = policy;
  return result(true, policy.enabled ? '商业自动经营策略已保存' : '商业自动经营已关闭');
}

function setCommercialServiceLevel(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!group || group.count < 1) return result(false, '商业建筑集群不存在');
  const serviceLevel = normalizeCommercialServiceLevel(payload.serviceLevel);
  if (!serviceLevel) return result(false, '服务方案无效');
  processGroup(world, player, group, now, { allowInitialBootstrap: false, allowCycleStart: false });
  group.serviceLevel = serviceLevel;
  if (group.enabled && !hasCommercialCycle(group)) startCycle(world, player, group, type, now);
  return result(true, serviceLevel === 'premium' ? '精品服务已启用，将从下一营业周期生效' : '已恢复标准服务，将从下一营业周期生效');
}

function startCommercialPromotion(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!group || group.count < 1) return result(false, '商业建筑集群不存在');
  processGroup(world, player, group, now, { allowInitialBootstrap: false, allowCycleStart: false });
  if (group.promotionCyclesRemaining > 0) return result(false, '当前推广活动尚未结束');
  const promotionCost = multiplyMoneyByInteger(type.promotionCostPerBuilding, group.count);
  if (promotionCost === null) return result(false, '推广费用超出系统可表示范围');
  if (player.credits < promotionCost) return result(false, '推广资金不足');
  player.credits = roundInternalMoney(player.credits - promotionCost) ?? 0;
  player.stats.systemSinks = normalizeNonNegativeMoney(Number(player.stats.systemSinks || 0) + promotionCost);
  player.stats.commercialPromotionCosts = normalizeNonNegativeMoney(
    Number(player.stats.commercialPromotionCosts || 0) + promotionCost,
  );
  group.promotionCyclesRemaining = COMMERCIAL_PROMOTION_CYCLES;
  group.promotionCoveredCount = group.count;
  if (group.enabled && !hasCommercialCycle(group)) startCycle(world, player, group, type, now);
  return result(true, `${type.name}推广活动已启动，覆盖 ${group.count} 座店铺的 ${COMMERCIAL_PROMOTION_CYCLES} 个有效营业周期`);
}

export function applyCommercialBuildingAction(world, user, payload = {}, now = Date.now()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return result(false, '商业建筑参数无效');
  if (typeof payload.provinceId !== 'string' || !PROVINCE_CATALOG.some((province) => province.id === payload.provinceId)) {
    return result(false, '必须指定有效的商业建筑地区');
  }
  const operation = String(payload.operation || '');
  const userId = Number(user.id);
  ensureCommercialPlayer(world.players?.[String(userId)] || {}, now);
  const handler = {
    build: buildCommercialBuilding,
    start: startCommercialBuilding,
    stop: stopCommercialBuilding,
    'auto-operation': setCommercialAutoOperation,
    'service-level': setCommercialServiceLevel,
    promote: startCommercialPromotion,
  }[operation];
  if (!handler) return result(false, '不支持的商业建筑操作');
  const applied = handler(world, userId, payload, now);
  if (applied.ok) reconcileBuildingInputFreezes(world, world.players[String(userId)], now, payload.provinceId);
  return applied;
}
