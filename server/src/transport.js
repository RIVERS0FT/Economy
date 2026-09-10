import * as core from './transport-core.js';
import {
  TRANSPORT_MODE_POLICY,
  transportPolicyDurationMs,
  transportRouteVehicleCount,
} from '../../shared/transport-policy.js';
import { roundInternalMoney } from './money.js';
import {
  applyTransportTaskAction, isTransportTaskStart, startTransportTaskCycle,
  serviceTransportTaskNode, cancelTransportRouteTasks, transportTaskRouteState,
  transportTaskShipmentState,
} from './transport-tasks.js';

// Physical routes, inventory-fuel accounting and task custody remain in the
// existing core. This layer owns technology-gated concurrent slots and the
// selected transport tool's persistent proficiency.
export * from './transport-core.js';

export const TRANSPORT_SLOT_MODEL_VERSION = 1;
export const TRANSPORT_SLOT_LIMIT_BY_STAGE = Object.freeze({
  C1: 2,
  C2: 3,
  C3: 5,
  C4: 8,
  C5: 12,
  C6: 16,
  C7: 20,
});
export const TRANSPORT_TOOL_MAX_LEVEL = 10;
export const TRANSPORT_TOOL_SPEED_BONUS_BPS_PER_LEVEL = 300;
export const TRANSPORT_TOOL_LEVEL_EXPERIENCE = Object.freeze([0, 3, 8, 15, 25, 38, 54, 73, 95, 120]);

const DEFAULT_SLOT_MODES = Object.freeze(['road', 'rail', 'air']);
const success = (message, extra = {}) => ({ ok: true, message, ...extra });
const failure = (message) => ({ ok: false, message });

function validMode(value) {
  return typeof value === 'string' && Object.hasOwn(TRANSPORT_MODE_POLICY, value) ? value : null;
}

function playerStage(player) {
  const value = String(player?.research?.unlockedComplexity || 'C1');
  return Object.hasOwn(TRANSPORT_SLOT_LIMIT_BY_STAGE, value) ? value : 'C1';
}

function slotLimitFor(player) {
  return TRANSPORT_SLOT_LIMIT_BY_STAGE[playerStage(player)] ?? TRANSPORT_SLOT_LIMIT_BY_STAGE.C1;
}

function toolLevelForExperience(value) {
  const experience = Math.max(0, Math.floor(Number(value) || 0));
  let level = 1;
  for (let index = 1; index < TRANSPORT_TOOL_LEVEL_EXPERIENCE.length; index += 1) {
    if (experience < TRANSPORT_TOOL_LEVEL_EXPERIENCE[index]) break;
    level = index + 1;
  }
  return Math.min(TRANSPORT_TOOL_MAX_LEVEL, level);
}

function toolSpeedBonusBps(level) {
  return Math.max(0, Math.min(TRANSPORT_TOOL_MAX_LEVEL - 1, Number(level || 1) - 1))
    * TRANSPORT_TOOL_SPEED_BONUS_BPS_PER_LEVEL;
}

function toolExperienceForTrip(distanceKm) {
  const distance = Math.max(0, Number(distanceKm) || 0);
  return Math.max(1, Math.min(12, Math.ceil(distance / 500)));
}

function routeFor(player, routeId) {
  return (player?.transportRoutes ?? []).find((route) => String(route?.id || '') === String(routeId || '')) || null;
}

function activeTripsFor(world, userId) {
  return (world.transportShipments ?? []).filter((trip) => Number(trip.ownerId) === Number(userId) && trip.status !== 'arrived');
}

function activeTripForRoute(world, userId, routeId) {
  return activeTripsFor(world, userId).find((trip) => String(trip.routeId || '') === String(routeId || '')) || null;
}

function defaultSlotModes(player, limit) {
  const routeModes = (player?.transportRoutes ?? []).map((route) => validMode(route?.mode)).filter(Boolean);
  return Array.from({ length: limit }, (_, index) => routeModes[index] ?? DEFAULT_SLOT_MODES[index % DEFAULT_SLOT_MODES.length]);
}

function normalizedSlot(slot, index, fallbackMode) {
  const experience = Math.max(0, Math.floor(Number(slot?.experience) || 0));
  return {
    id: `transport-slot-${index + 1}`,
    mode: validMode(slot?.mode) ?? fallbackMode,
    experience,
    updatedAt: Math.max(0, Number(slot?.updatedAt) || 0),
  };
}

function slotProjection(world, player, storedState = player?.transportSlotState) {
  const stage = playerStage(player);
  const limit = slotLimitFor(player);
  const fallbackModes = defaultSlotModes(player, limit);
  const storedSlots = Array.isArray(storedState?.slots) ? storedState.slots : [];
  const active = activeTripsFor(world, player?.userId);
  const occupiedBySlotId = new Map(active.filter((trip) => trip.slotId).map((trip) => [String(trip.slotId), trip]));
  const slots = Array.from({ length: limit }, (_, index) => {
    const slot = normalizedSlot(storedSlots[index], index, fallbackModes[index]);
    const level = toolLevelForExperience(slot.experience);
    const nextLevelExperience = level >= TRANSPORT_TOOL_MAX_LEVEL
      ? null : TRANSPORT_TOOL_LEVEL_EXPERIENCE[level];
    const occupiedTrip = occupiedBySlotId.get(slot.id);
    return {
      ...slot,
      index: index + 1,
      level,
      nextLevelExperience,
      speedBonusBps: toolSpeedBonusBps(level),
      occupied: Boolean(occupiedTrip),
      ...(occupiedTrip?.routeId ? { routeId: String(occupiedTrip.routeId) } : {}),
    };
  });
  return {
    version: TRANSPORT_SLOT_MODEL_VERSION,
    stage,
    limit,
    used: active.length,
    slots,
  };
}

function syncSlotProjection(world, player) {
  if (!player?.research || typeof player.research !== 'object') return;
  player.research.transportSlots = slotProjection(world, player);
}

function migrateLegacyRouteFleet(player) {
  const state = player.transportSlotState && typeof player.transportSlotState === 'object'
    ? player.transportSlotState : {};
  if (Number(state.version || 0) >= TRANSPORT_SLOT_MODEL_VERSION) return state;
  let refund = 0;
  for (const route of player.transportRoutes ?? []) {
    const owned = transportRouteVehicleCount(route);
    const mode = validMode(route.mode);
    if (mode && owned > 1) refund += (owned - 1) * TRANSPORT_MODE_POLICY[mode].vehiclePurchaseCost;
    route.vehicleCount = 1;
  }
  if (refund > 0) {
    player.credits = roundInternalMoney(Number(player.credits || 0) + refund);
    player.stats ||= {};
    player.stats.transportFleetMigrationRefund = roundInternalMoney(
      Number(player.stats.transportFleetMigrationRefund || 0) + refund,
    );
  }
  return { ...state, version: TRANSPORT_SLOT_MODEL_VERSION, migrationRefund: roundInternalMoney(refund) };
}

function ensureTransportSlotState(world, player, now = Date.now()) {
  if (!player || typeof player !== 'object') return null;
  let state = migrateLegacyRouteFleet(player);
  const limit = slotLimitFor(player);
  const fallbackModes = defaultSlotModes(player, limit);
  const previous = Array.isArray(state.slots) ? state.slots : [];
  const slots = Array.from({ length: limit }, (_, index) => normalizedSlot(previous[index], index, fallbackModes[index]));
  state = {
    version: TRANSPORT_SLOT_MODEL_VERSION,
    slots,
    updatedAt: Math.max(0, Number(state.updatedAt) || Number(now) || 0),
    ...(Number(state.migrationRefund || 0) > 0 ? { migrationRefund: Number(state.migrationRefund) } : {}),
  };
  player.transportSlotState = state;
  for (const route of player.transportRoutes ?? []) route.vehicleCount = 1;
  syncSlotProjection(world, player);
  return state;
}

export function transportSlotClientState(world, userId) {
  const player = world.players?.[String(userId)];
  if (!player) return { version: TRANSPORT_SLOT_MODEL_VERSION, stage: 'C1', limit: 2, used: 0, slots: [] };
  return slotProjection(world, player);
}

function matchingSlot(world, player, mode) {
  const state = ensureTransportSlotState(world, player, world.lastProcessedAt || Date.now());
  const active = activeTripsFor(world, player.userId);
  const limit = slotLimitFor(player);
  if (active.length >= limit) return { error: '运输槽位已满' };
  const occupied = new Set(active.map((trip) => String(trip.slotId || '')).filter(Boolean));
  const matching = state.slots.filter((slot) => slot.mode === mode);
  if (matching.length === 0) {
    const name = TRANSPORT_MODE_POLICY[mode]?.vehicleName ?? '对应';
    return { error: `没有配置${name}的运输槽位` };
  }
  const slot = matching.find((candidate) => !occupied.has(candidate.id));
  return slot ? { slot } : { error: '该运输工具的槽位正在使用' };
}

function applySlotSpeedToTrip(trip, slot) {
  if (!trip?.policySnapshot || !slot) return;
  const level = toolLevelForExperience(slot.experience);
  const speedBonusBps = toolSpeedBonusBps(level);
  trip.slotId = slot.id;
  trip.transportToolLevel = level;
  trip.transportToolSpeedBonusBps = speedBonusBps;
  trip.policySnapshot.transportSlotId = slot.id;
  trip.policySnapshot.transportToolLevel = level;
  trip.policySnapshot.transportToolSpeedBonusBps = speedBonusBps;
  if (speedBonusBps > 0) {
    trip.policySnapshot.secondsPerKm *= 10_000 / (10_000 + speedBonusBps);
  }
  const leg = trip.currentLeg;
  if (leg && trip.status === 'in-transit') {
    const arrivesAt = Number(leg.departsAt) + transportPolicyDurationMs(trip.policySnapshot, Number(leg.distanceKm || 0));
    leg.arrivesAt = arrivesAt;
    trip.arrivesAt = arrivesAt;
    const historyLeg = trip.legHistory?.at(-1);
    if (historyLeg) historyLeg.arrivesAt = arrivesAt;
  }
}

function startCoreWithSlot(world, user, payload, now, slot) {
  const result = core.applyStartTransportCycle(world, user, { ...payload, vehicleCount: 1 }, now);
  if (!result.ok) return result;
  const trip = (world.transportShipments ?? []).find((entry) => String(entry.id || '') === String(result.cycleId || ''));
  applySlotSpeedToTrip(trip, slot);
  syncSlotProjection(world, world.players?.[String(user.id)]);
  return result;
}

function applyTransportSlotConfigure(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return failure('玩家状态无效');
  const state = ensureTransportSlotState(world, player, now);
  const slot = state.slots.find((candidate) => candidate.id === String(payload.slotId || ''));
  if (!slot) return failure('运输槽位不存在或尚未由科技解锁');
  const mode = validMode(payload.mode);
  if (!mode) return failure('运输工具无效');
  if (activeTripsFor(world, user.id).some((trip) => String(trip.slotId || '') === slot.id)) {
    return failure('运输中的槽位不能切换工具');
  }
  if (slot.mode === mode) return success('运输工具未变化', { transportSlots: transportSlotClientState(world, user.id) });
  slot.mode = mode;
  slot.experience = 0;
  slot.updatedAt = now;
  state.updatedAt = now;
  syncSlotProjection(world, player);
  return success(`槽位 ${Number(slot.id.split('-').at(-1)) || ''} 已切换为${TRANSPORT_MODE_POLICY[mode].vehicleName}，培养进度已重置`, {
    transportSlots: transportSlotClientState(world, user.id),
  });
}

function awardTripTraining(world, player, trip, result) {
  if (!result?.ok || !trip || trip.status !== 'arrived' || trip.transportTrainingAwarded === true || !trip.slotId) return result;
  const state = ensureTransportSlotState(world, player, trip.arrivedAt || Date.now());
  const slot = state.slots.find((candidate) => candidate.id === trip.slotId);
  if (!slot) return result;
  const previousLevel = toolLevelForExperience(slot.experience);
  const gained = toolExperienceForTrip(trip.cycleDistanceKm);
  slot.experience = Math.max(0, Math.floor(Number(slot.experience) || 0)) + gained;
  slot.updatedAt = Number(trip.arrivedAt || Date.now());
  trip.transportTrainingAwarded = true;
  trip.transportTrainingExperience = gained;
  const nextLevel = toolLevelForExperience(slot.experience);
  syncSlotProjection(world, player);
  if (nextLevel > previousLevel) {
    return { ...result, message: `${result.message}；槽位 ${Number(slot.id.split('-').at(-1)) || ''} 的${TRANSPORT_MODE_POLICY[slot.mode].vehicleName}提升至 Lv.${nextLevel}` };
  }
  return result;
}

function activeTaskTrip(world, userId, routeId) {
  return activeTripsFor(world, userId).find((trip) => trip.routeId === routeId && trip.taskTrip === true);
}

export function applyStartTransportCycle(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  const route = routeFor(player, payload.routeId);
  if (!player || !route) return failure('运输路线不存在');
  ensureTransportSlotState(world, player, now);
  const selected = matchingSlot(world, player, route.mode);
  if (!selected.slot) return failure(selected.error);
  return isTransportTaskStart(payload)
    ? startTransportTaskCycle(
        world,
        user,
        payload,
        now,
        (taskWorld, taskUser, taskPayload, taskNow) => startCoreWithSlot(taskWorld, taskUser, taskPayload, taskNow, selected.slot),
      )
    : startCoreWithSlot(world, user, payload, now, selected.slot);
}

function serviceWithLegacyLimitCompatibility(world, currentTrip, operation) {
  const moving = (world.transportShipments ?? []).filter((trip) => trip !== currentTrip && trip.status === 'in-transit');
  if (moving.length < core.TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) return operation();
  const borrowed = moving[0];
  borrowed.status = 'slot-held';
  try { return operation(); }
  finally { borrowed.status = 'in-transit'; }
}

export function applyServiceTransportNode(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  const route = routeFor(player, payload.routeId);
  const trip = activeTripForRoute(world, user.id, payload.routeId);
  if (!player || !route || !trip) return failure('运输路线或趟次不存在');
  ensureTransportSlotState(world, player, now);
  const result = serviceWithLegacyLimitCompatibility(world, trip, () => (
    activeTaskTrip(world, user.id, payload.routeId)
      ? serviceTransportTaskNode(world, user, payload, now, core.applyServiceTransportNode)
      : core.applyServiceTransportNode(world, user, payload, now)
  ));
  const trained = awardTripTraining(world, player, trip, result);
  syncSlotProjection(world, player);
  if (trained.ok && route?.deletionPending
    && !player.transportRoutes?.some((entry) => entry.id === route.id)) {
    cancelTransportRouteTasks(world, user.id, route, now);
  }
  return trained;
}

export function applyDeleteTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  const route = routeFor(player, payload.routeId);
  const result = core.applyDeleteTransportRoute(world, user, payload, now);
  if (result.ok && route && !player.transportRoutes.some((entry) => entry.id === route.id)) {
    cancelTransportRouteTasks(world, user.id, route, now);
  }
  syncSlotProjection(world, player);
  return result;
}

export function migrateTransportWorld(world, now = Date.now()) {
  core.migrateTransportWorld(world);
  for (const player of Object.values(world.players || {})) ensureTransportSlotState(world, player, now);
  return world;
}

export function processTransportWorld(world, now = Date.now()) {
  migrateTransportWorld(world, now);
  core.processTransportWorld(world, now);
  for (const player of Object.values(world.players || {})) syncSlotProjection(world, player);
  return world;
}

export function applyTransportShip(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (player) ensureTransportSlotState(world, player, now);
  if (payload.operation === 'slot-configure') return applyTransportSlotConfigure(world, user, payload, now);
  if (payload.operation === 'route-expand') {
    return failure('路线不再单独增购载具；请通过科技解锁运输槽位，并在槽位中选择运输工具');
  }
  const taskAction = applyTransportTaskAction(world, user, payload, now);
  if (taskAction) {
    if (player) syncSlotProjection(world, player);
    return taskAction;
  }
  if (payload.operation === 'task-cycle-start') return applyStartTransportCycle(world, user, { ...payload, taskDispatch: true }, now);
  if (payload.operation === 'cycle-start') return applyStartTransportCycle(world, user, payload, now);
  if (payload.operation === 'node-service') return applyServiceTransportNode(world, user, payload, now);
  if (payload.operation === 'route-delete') return applyDeleteTransportRoute(world, user, payload, now);
  const result = core.applyTransportShip(world, user, payload, now);
  if (player) {
    for (const route of player.transportRoutes ?? []) route.vehicleCount = 1;
    syncSlotProjection(world, player);
  }
  return result;
}

export function transportRouteClientState(world, userId) {
  const now = Number(world.lastProcessedAt || 0);
  const routes = new Map((world.players?.[String(userId)]?.transportRoutes ?? []).map((route) => [route.id, route]));
  return core.transportRouteClientState(world, userId).map((view) => ({ ...view,
    vehicleCount: 1,
    ...transportTaskRouteState(world, userId, routes.get(view.id), now),
  }));
}

export function transportShipmentClientState(world, userId) {
  const own = new Map((world.transportShipments ?? []).filter((trip) => Number(trip.ownerId) === Number(userId))
    .map((trip) => [String(trip.id), trip]));
  return core.transportShipmentClientState(world, userId).map((view) => {
    const trip = own.get(view.id);
    return {
      ...view,
      ...(trip?.slotId ? { slotId: String(trip.slotId) } : {}),
      ...(trip?.transportToolLevel ? { transportToolLevel: Number(trip.transportToolLevel) } : {}),
      ...(trip?.transportToolSpeedBonusBps ? { transportToolSpeedBonusBps: Number(trip.transportToolSpeedBonusBps) } : {}),
      ...(trip?.transportTrainingExperience ? { transportTrainingExperience: Number(trip.transportTrainingExperience) } : {}),
      ...transportTaskShipmentState(trip),
    };
  });
}
