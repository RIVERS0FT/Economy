import { applyAction, createClientState, processWorld } from './domain.js';
import { createWarehouseUsage, ensureWarehouse } from './warehouse.js';

const MAX_FACILITIES_PER_TICK = 10_000;
const MAX_CYCLES_PER_FACILITY = 50_000;

function result(ok, message) {
  return { ok, message };
}

function inventoryFor(player, productId) {
  player.inventories ||= {};
  player.inventories[productId] ||= { available: 0, frozen: 0 };
  return player.inventories[productId];
}

function findFacility(player, facilityId) {
  return (player.facilities || []).find((facility) => facility.id === facilityId);
}

function nextCycleNetStorage(facility) {
  return Math.max(0, Number(facility.outputPerCycle || 0) - Number(facility.inputPerCycle || 0));
}

function availableProductionCycles(world, player, facility, elapsedCycles) {
  const netStorage = nextCycleNetStorage(facility);
  if (netStorage <= 0) return elapsedCycles;
  const usage = createWarehouseUsage(world, player);
  return Math.max(0, Math.floor(usage.warehouseAvailableCapacity / netStorage));
}

function canFitNextCycle(world, player, facility) {
  const netStorage = nextCycleNetStorage(facility);
  if (netStorage <= 0) return true;
  return createWarehouseUsage(world, player).warehouseAvailableCapacity >= netStorage;
}

function stopFacility(facility, status, reason) {
  facility.status = status;
  facility.stopReason = reason;
  delete facility.cycleStartedAt;
}

function suppressLegacyRunningFacilities(world, callback) {
  const running = [];
  for (const player of Object.values(world.players || {})) {
    for (const facility of player.facilities || []) {
      if (facility.status !== 'running') continue;
      running.push({
        facility,
        status: facility.status,
        stopReason: facility.stopReason,
        cycleStartedAt: facility.cycleStartedAt,
      });
      facility.status = 'paused';
      facility.stopReason = 'manual';
      delete facility.cycleStartedAt;
    }
  }

  try {
    return callback();
  } finally {
    for (const snapshot of running) {
      snapshot.facility.status = snapshot.status;
      snapshot.facility.stopReason = snapshot.stopReason;
      if (snapshot.cycleStartedAt === undefined) delete snapshot.facility.cycleStartedAt;
      else snapshot.facility.cycleStartedAt = snapshot.cycleStartedAt;
    }
  }
}

function withTemporaryLegacyFields(world, callback) {
  const injected = [];
  for (const player of Object.values(world.players || {})) {
    for (const facility of player.facilities || []) {
      const hadGoods = Object.hasOwn(facility, 'internalGoods');
      const hadCapacity = Object.hasOwn(facility, 'internalCapacity');
      const goods = facility.internalGoods;
      const capacity = facility.internalCapacity;
      if (!hadGoods) facility.internalGoods = 0;
      if (!hadCapacity) facility.internalCapacity = 0;
      injected.push({ facility, hadGoods, hadCapacity, goods, capacity });
    }
  }

  try {
    return callback();
  } finally {
    for (const snapshot of injected) {
      if (snapshot.hadGoods) snapshot.facility.internalGoods = snapshot.goods;
      else delete snapshot.facility.internalGoods;
      if (snapshot.hadCapacity) snapshot.facility.internalCapacity = snapshot.capacity;
      else delete snapshot.facility.internalCapacity;
    }
  }
}

function sanitizeFacility(facility) {
  const { internalGoods: _internalGoods, internalCapacity: _internalCapacity, ...rest } = facility;
  return rest;
}

function sanitizeFacilityType(type) {
  const { internalCapacity: _internalCapacity, ...rest } = type;
  return rest;
}

function sanitizeListing(listing) {
  return {
    ...listing,
    facility: sanitizeFacility(listing.facility || {}),
  };
}

export function migrateDirectOutputWorld(world) {
  world.players ||= {};
  for (const player of Object.values(world.players)) {
    ensureWarehouse(player);
    player.facilities ||= [];
    for (const facility of player.facilities) {
      const legacyGoods = Math.max(0, Number(facility.internalGoods || 0));
      if (legacyGoods > 0 && facility.outputProductId) {
        inventoryFor(player, facility.outputProductId).available += legacyGoods;
      }
      delete facility.internalGoods;
      delete facility.internalCapacity;
      if (facility.status === 'full') {
        facility.status = 'paused';
        facility.stopReason = 'manual';
      }
    }
  }

  world.facilityListings ||= [];
  for (const listing of world.facilityListings) {
    if (!listing.facility) continue;
    delete listing.facility.internalGoods;
    delete listing.facility.internalCapacity;
  }
  return world;
}

export function stripFactoryStorageFields(world) {
  for (const player of Object.values(world.players || {})) {
    for (const facility of player.facilities || []) {
      delete facility.internalGoods;
      delete facility.internalCapacity;
    }
  }
  for (const listing of world.facilityListings || []) {
    if (!listing.facility) continue;
    delete listing.facility.internalGoods;
    delete listing.facility.internalCapacity;
  }
  return world;
}

export function processDirectProductionWorld(world, now = Date.now()) {
  migrateDirectOutputWorld(world);
  suppressLegacyRunningFacilities(world, () => processWorld(world, now));

  for (const player of Object.values(world.players || {})) {
    ensureWarehouse(player);
    for (const facility of (player.facilities || []).slice(0, MAX_FACILITIES_PER_TICK)) {
      if (facility.status !== 'running' || !facility.cycleStartedAt) continue;
      const elapsedCycles = Math.max(0, Math.floor((now - facility.cycleStartedAt) / facility.cycleMs));
      if (elapsedCycles < 1) continue;

      const fundsCycles = facility.operatingCost > 0
        ? Math.max(0, Math.floor(player.credits / facility.operatingCost))
        : elapsedCycles;
      const inputInventory = facility.inputProductId ? inventoryFor(player, facility.inputProductId) : null;
      const inputCycles = facility.inputPerCycle > 0
        ? Math.max(0, Math.floor(inputInventory.available / facility.inputPerCycle))
        : elapsedCycles;
      const targetRemaining = facility.productionMode === 'target'
        ? Math.max(0, Number(facility.targetQuantity || 0) - Number(facility.completedQuantity || 0))
        : Number.POSITIVE_INFINITY;
      const targetCycles = Number.isFinite(targetRemaining)
        ? Math.max(0, Math.floor(targetRemaining / facility.outputPerCycle))
        : elapsedCycles;
      const warehouseCycles = availableProductionCycles(world, player, facility, elapsedCycles);

      const completedCycles = Math.min(
        elapsedCycles,
        fundsCycles,
        inputCycles,
        targetCycles,
        warehouseCycles,
        MAX_CYCLES_PER_FACILITY,
      );

      if (completedCycles > 0) {
        const operationCost = completedCycles * facility.operatingCost;
        const outputQuantity = completedCycles * facility.outputPerCycle;
        const inputQuantity = completedCycles * facility.inputPerCycle;
        player.credits -= operationCost;
        player.stats.systemSinks += operationCost;
        if (inputInventory) inputInventory.available -= inputQuantity;
        inventoryFor(player, facility.outputProductId).available += outputQuantity;
        facility.lifetimeOutput += outputQuantity;
        facility.completedQuantity = Number(facility.completedQuantity || 0) + outputQuantity;
        facility.cycleStartedAt += completedCycles * facility.cycleMs;
      }

      if (facility.productionMode === 'target' && facility.completedQuantity >= facility.targetQuantity) {
        stopFacility(facility, 'paused', 'plan_complete');
        continue;
      }
      if (!canFitNextCycle(world, player, facility)) {
        stopFacility(facility, 'full', 'output_full');
        continue;
      }
      if (player.credits < facility.operatingCost) {
        stopFacility(facility, 'insufficient_funds', 'insufficient_funds');
        continue;
      }
      if (facility.inputProductId && inventoryFor(player, facility.inputProductId).available < facility.inputPerCycle) {
        stopFacility(facility, 'insufficient_input', 'insufficient_input');
      }
    }
  }

  stripFactoryStorageFields(world);
  world.lastProcessedAt = now;
  return world;
}

function startFacilityDirect(world, userId, payload, now) {
  const player = world.players[String(userId)];
  const facility = findFacility(player, payload.facilityId);
  if (!facility) return result(false, '生产设施不存在');
  if (facility.status === 'constructing' || facility.status === 'listed') return result(false, '当前状态不能启动生产');
  if (!canFitNextCycle(world, player, facility)) {
    facility.status = 'full';
    facility.stopReason = 'output_full';
    return result(false, '共享仓库空间不足，无法容纳下一个生产周期');
  }
  if (player.credits < facility.operatingCost) {
    facility.status = 'insufficient_funds';
    facility.stopReason = 'insufficient_funds';
    return result(false, '运营资金不足');
  }
  if (facility.inputProductId && inventoryFor(player, facility.inputProductId).available < facility.inputPerCycle) {
    facility.status = 'insufficient_input';
    facility.stopReason = 'insufficient_input';
    return result(false, '生产原料不足');
  }
  if (facility.productionMode === 'target' && facility.completedQuantity >= facility.targetQuantity) {
    facility.status = 'paused';
    facility.stopReason = 'plan_complete';
    return result(false, '生产计划已经完成，请先设置新计划');
  }
  facility.status = 'running';
  facility.stopReason = undefined;
  facility.cycleStartedAt = now;
  return result(true, `${facility.name}已手动启动，产成品将直接进入共享仓库`);
}

function pauseFacilityDirect(world, userId, payload) {
  const player = world.players[String(userId)];
  const facility = findFacility(player, payload.facilityId);
  if (!facility) return result(false, '生产设施不存在');
  if (facility.status !== 'running') return result(false, '生产设施当前未运行');
  stopFacility(facility, 'paused', 'manual');
  return result(true, `${facility.name}已手动停止`);
}

function validateLegacyAction(world, userId, action, payload) {
  const player = world.players[String(userId)];
  const facility = findFacility(player, payload.facilityId);
  if (action === 'setProductionPlan' && facility?.status === 'running') {
    return result(false, '请先停止工厂再修改生产计划');
  }
  if (action === 'listFacility' && facility?.status === 'running') {
    return result(false, '当前状态不能挂牌');
  }
  return null;
}

export function applyDirectProductionAction(world, user, action, payload = {}, now = Date.now()) {
  processDirectProductionWorld(world, now);
  const userId = Number(user.id);
  if (action === 'startFacility') return startFacilityDirect(world, userId, payload, now);
  if (action === 'pauseFacility') return pauseFacilityDirect(world, userId, payload);
  if (action === 'collectFacility') return result(false, '工厂产成品会直接进入共享仓库，无需领取');

  const validation = validateLegacyAction(world, userId, action, payload);
  if (validation) return validation;

  const actionResult = suppressLegacyRunningFacilities(
    world,
    () => applyAction(world, user, action, payload, now),
  );
  migrateDirectOutputWorld(world);
  stripFactoryStorageFields(world);
  return actionResult;
}

export function createDirectProductionClientState(world, userId, now = Date.now()) {
  const state = withTemporaryLegacyFields(world, () => createClientState(world, userId, now));
  return {
    ...state,
    facilities: (state.facilities || []).map(sanitizeFacility),
    facilityTypes: (state.facilityTypes || []).map(sanitizeFacilityType),
    facilityListings: (state.facilityListings || []).map(sanitizeListing),
  };
}
