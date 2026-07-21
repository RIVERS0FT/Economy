import { MARKET_DEMAND_GROUP_CATALOG, MARKET_DEMAND_MODEL_VERSION } from './catalog.js';
import { clamp } from './math.js';

export function createMarketDemandStateRuntime({ products, constants, marketFor, isOpenOrder }) {
  function normalizePlayerActivity(world, now) {
    world.players ||= {};
    const latestOrderAt = new Map();
    for (const order of world.orders || []) {
      if (order.ownerType !== 'player' || !Number.isFinite(Number(order.ownerId))) continue;
      const ownerId = String(order.ownerId);
      latestOrderAt.set(ownerId, Math.max(latestOrderAt.get(ownerId) || 0, Number(order.createdAt || 0)));
    }
    for (const [playerId, player] of Object.entries(world.players)) {
      if (Number.isFinite(Number(player.lastEconomicActivityAt)) && Number(player.lastEconomicActivityAt) > 0) continue;
      const tradeAt = (player.trades || []).reduce((latest, item) => Math.max(latest, Number(item.createdAt || 0)), 0);
      const ledgerAt = (player.ledger || []).reduce((latest, item) => Math.max(latest, Number(item.createdAt || 0)), 0);
      const inferred = Math.max(
        Number(player.registeredAt || 0),
        Number(player.work?.lastWorkedAt || 0),
        latestOrderAt.get(playerId) || 0,
        tradeAt,
        ledgerAt,
      );
      player.lastEconomicActivityAt = inferred > 0 ? inferred : now;
    }
  }

  function defaultGroupState(group, now) {
    return {
      marketDemandGroupId: group.id,
      demandGroupId: group.id,
      cycleMs: group.cycleMs,
      nextDemandAt: now,
      lastCycleId: Math.floor(now / group.cycleMs) - 1,
      lastCycleStartedAt: now,
      lastBudget: group.baseBudget,
      lastTargetBudget: 0,
      lastPlayerScaleBudget: group.baseBudget,
      lastActivePlayerCount: 0,
      lastTradeActivityFactor: 1,
      lastNeedPressure: 1,
      lastCommitted: 0,
      directCommitted: 0,
      derivedCommitted: 0,
      lastRetainedOrderValue: 0,
      lastOpenOrderValue: 0,
      satisfaction: group.targetSatisfaction,
      satisfactionEma: group.targetSatisfaction,
      lastCycleSettlement: {},
      lastProductService: {},
      lastClassService: {},
      lastClassShares: {},
      lastClassAllocation: {},
      lastAllocation: {},
      lastProductShares: {},
      previousDemandQuantities: structuredClone(group.seedDemandQuantities),
      recipeShares: {},
      lastInventoryBoost: 0,
      lastStockValue: 0,
    };
  }

  function defaultProductState(product, cycleId) {
    return {
      observedPrice: product.basePrice,
      costAnchor: null,
      downstreamValueAnchor: null,
      demandPressureAnchor: product.basePrice,
      targetPrice: product.basePrice,
      referencePrice: product.basePrice,
      lastUpdatedCycleId: cycleId,
    };
  }

  function defaultWorldState(now) {
    const cycleId = Math.floor(now / constants.demandCycleMs);
    return {
      modelVersion: MARKET_DEMAND_MODEL_VERSION,
      cycleMs: constants.demandCycleMs,
      groups: Object.fromEntries(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, defaultGroupState(group, now)])),
      priceTransmission: {
        cycleMs: constants.demandCycleMs,
        lastCycleId: cycleId,
        products: Object.fromEntries(products.map((product) => [product.id, defaultProductState(product, cycleId)])),
      },
      relations: {},
      productPressure: Object.fromEntries(products.map((product) => [product.id, 1])),
    };
  }

  function initializeWorld(world, now = Date.now()) {
    world.marketDemand = defaultWorldState(now);
    world.demandGroups = world.marketDemand.groups;
    world.priceTransmission = world.marketDemand.priceTransmission;
    return normalizeWorld(world, now);
  }

  function normalizeWorld(world, now = Date.now(), { forceRebuild = false } = {}) {
    normalizePlayerActivity(world, now);
    const legacyGroups = world.demandGroups && typeof world.demandGroups === 'object' ? world.demandGroups : {};
    const previousModel = world.marketDemand && typeof world.marketDemand === 'object' ? world.marketDemand : null;
    const isUpgrade = forceRebuild || Number(previousModel?.modelVersion || 0) < MARKET_DEMAND_MODEL_VERSION;
    const fallback = defaultWorldState(now);
    world.marketDemand = {
      ...fallback,
      ...(previousModel || {}),
      modelVersion: MARKET_DEMAND_MODEL_VERSION,
      cycleMs: constants.demandCycleMs,
      groups: {},
      priceTransmission: {},
      relations: previousModel?.relations && typeof previousModel.relations === 'object' ? previousModel.relations : {},
      productPressure: previousModel?.productPressure && typeof previousModel.productPressure === 'object'
        ? previousModel.productPressure
        : fallback.productPressure,
    };

    for (const group of MARKET_DEMAND_GROUP_CATALOG) {
      const previous = previousModel?.groups?.[group.id] || legacyGroups[group.id] || {};
      const state = { ...defaultGroupState(group, now), ...previous, marketDemandGroupId: group.id, demandGroupId: group.id };
      state.cycleMs = group.cycleMs;
      state.lastCycleStartedAt = Math.max(0, Number(state.lastCycleStartedAt || now));
      state.lastBudget = Math.max(0, Math.floor(Number(state.lastBudget ?? group.baseBudget)));
      state.lastTargetBudget = Math.max(0, Math.floor(Number(state.lastTargetBudget || 0)));
      state.lastPlayerScaleBudget = Math.max(0, Math.floor(Number(state.lastPlayerScaleBudget ?? group.baseBudget)));
      state.lastActivePlayerCount = Math.max(0, Math.floor(Number(state.lastActivePlayerCount || 0)));
      state.lastTradeActivityFactor = Number.isFinite(Number(state.lastTradeActivityFactor)) ? Number(state.lastTradeActivityFactor) : 1;
      state.lastNeedPressure = Number.isFinite(Number(state.lastNeedPressure)) ? Number(state.lastNeedPressure) : 1;
      state.lastRetainedOrderValue = Math.max(0, Math.floor(Number(state.lastRetainedOrderValue || 0)));
      state.lastOpenOrderValue = Math.max(0, Math.floor(Number(state.lastOpenOrderValue || 0)));
      state.satisfaction = clamp(0, 1, Number(state.satisfaction ?? group.targetSatisfaction));
      state.satisfactionEma = clamp(0, 1, Number(state.satisfactionEma ?? state.satisfaction));
      state.lastCycleSettlement = state.lastCycleSettlement && typeof state.lastCycleSettlement === 'object' ? state.lastCycleSettlement : {};
      state.lastProductService = state.lastProductService && typeof state.lastProductService === 'object' ? state.lastProductService : {};
      state.lastClassService = state.lastClassService && typeof state.lastClassService === 'object' ? state.lastClassService : {};
      state.lastClassShares = state.lastClassShares && typeof state.lastClassShares === 'object' ? state.lastClassShares : {};
      state.lastClassAllocation = state.lastClassAllocation && typeof state.lastClassAllocation === 'object' ? state.lastClassAllocation : {};
      state.lastAllocation = state.lastAllocation && typeof state.lastAllocation === 'object' ? state.lastAllocation : {};
      state.lastProductShares = state.lastProductShares && typeof state.lastProductShares === 'object' ? state.lastProductShares : {};
      state.previousDemandQuantities = state.previousDemandQuantities && typeof state.previousDemandQuantities === 'object'
        ? state.previousDemandQuantities
        : structuredClone(group.seedDemandQuantities);
      state.recipeShares = state.recipeShares && typeof state.recipeShares === 'object' ? state.recipeShares : {};
      state.lastInventoryBoost = 0;
      state.lastStockValue = 0;
      if (isUpgrade) {
        state.nextDemandAt = now;
        state.lastCycleId = Math.floor(now / group.cycleMs) - 1;
        state.lastTargetBudget = state.lastBudget;
        state.lastCycleStartedAt = now;
        state.lastRetainedOrderValue = 0;
        state.lastOpenOrderValue = 0;
        state.lastCommitted = 0;
        state.directCommitted = 0;
        state.derivedCommitted = 0;
        state.lastCycleSettlement = {};
        state.lastProductService = {};
        state.lastClassService = {};
        state.lastClassShares = {};
        state.lastAllocation = {};
        state.lastClassAllocation = {};
        state.lastProductShares = {};
        state.previousDemandQuantities = structuredClone(group.seedDemandQuantities);
        state.recipeShares = {};
      }
      world.marketDemand.groups[group.id] = state;
    }

    const previousTransmission = previousModel?.priceTransmission || world.priceTransmission || {};
    const transmission = {
      ...fallback.priceTransmission,
      ...previousTransmission,
      cycleMs: constants.demandCycleMs,
      products: {},
    };
    if (!Number.isFinite(Number(transmission.lastCycleId))) transmission.lastCycleId = fallback.priceTransmission.lastCycleId;
    for (const product of products) {
      const market = marketFor(world, product.id, now);
      const previous = previousTransmission.products?.[product.id] || {};
      const referenceFallback = Number(market.demand?.referencePrice || market.demand?.lastPrice || product.basePrice);
      const state = {
        ...defaultProductState(product, transmission.lastCycleId),
        ...previous,
        referencePrice: Number.isFinite(Number(previous.referencePrice)) ? Number(previous.referencePrice) : referenceFallback,
      };
      for (const key of ['observedPrice', 'demandPressureAnchor', 'targetPrice', 'referencePrice']) {
        if (!Number.isFinite(Number(state[key])) || Number(state[key]) <= 0) state[key] = product.basePrice;
      }
      for (const key of ['costAnchor', 'downstreamValueAnchor']) {
        if (state[key] !== null && (!Number.isFinite(Number(state[key])) || Number(state[key]) <= 0)) state[key] = null;
      }
      transmission.products[product.id] = state;
      market.demand ||= {};
      Object.assign(market.demand, {
        cycleMs: constants.demandCycleMs,
        referencePrice: state.referencePrice,
        observedPrice: state.observedPrice,
        costAnchor: state.costAnchor,
        downstreamValueAnchor: state.downstreamValueAnchor,
        demandPressureAnchor: state.demandPressureAnchor,
        targetPrice: state.targetPrice,
      });
    }
    world.marketDemand.priceTransmission = transmission;
    world.demandGroups = world.marketDemand.groups;
    world.priceTransmission = world.marketDemand.priceTransmission;

    if (isUpgrade) {
      for (const order of world.orders || []) {
        if (order.ownerType === 'population' && isOpenOrder(order)) order.status = 'cancelled';
      }
    }
    return world;
  }

  return { initializeWorld, normalizeWorld, defaultProductState };
}
