import { transportCyclePolicyForShipment, transportFleetCost } from '../../shared/transport-policy.js';
import {
  TRANSPORT_MODES,
  transportCycleCost,
  transportCycleDurationMs,
  transportTraversalStopIds,
} from '../utils/provinceLogistics.ts';
import { planTransportCycle, planTransportNode, transportOperationFingerprint } from './transportPlanner.js';

function transportSlotState(game) {
  const value = game?.research?.transportSlots;
  return value && Array.isArray(value.slots) && Number.isSafeInteger(value.limit) ? value : null;
}

function activeTransportTrips(game) {
  return (game.transportShipments ?? []).filter((shipment) => shipment.status !== 'arrived');
}

function slotAvailability(game, mode) {
  const state = transportSlotState(game);
  if (!state) return { ready: true, slot: null, reason: '', activeCount: activeTransportTrips(game).length };
  const active = activeTransportTrips(game);
  if (active.length >= state.limit) return { ready: false, slot: null, reason: 'in-transit-limit', activeCount: active.length };
  const occupied = new Set(active.map((shipment) => String(shipment.slotId || '')).filter(Boolean));
  const matching = state.slots.filter((slot) => slot.mode === mode);
  if (matching.length === 0) return { ready: false, slot: null, reason: 'transport-tool-unavailable', activeCount: active.length };
  const slot = matching.find((candidate) => !occupied.has(String(candidate.id || ''))) ?? null;
  return slot
    ? { ready: true, slot, reason: '', activeCount: active.length }
    : { ready: false, slot: null, reason: 'in-transit-limit', activeCount: active.length };
}

function slotAdjustedDuration(durationMs, slot) {
  const bonusBps = Math.max(0, Number(slot?.speedBonusBps || 0));
  return bonusBps > 0 ? Math.max(1_000, Math.round(durationMs * 10_000 / (10_000 + bonusBps))) : durationMs;
}

export function estimateTransportRoute(game, route, now, provinceById = new Map(game.provinces.map((province) => [province.id, province]))) {
  const cycle = transportCycleCost(route, route.mode, provinceById);
  const baseDurationMs = transportCycleDurationMs(route, route.mode, provinceById);
  const unitCapacity = TRANSPORT_MODES[route.mode]?.capacity ?? 0;
  const traversal = transportTraversalStopIds(route);
  const availability = slotAvailability(game, route.mode);
  const cost = unitCapacity > 0 ? transportFleetCost(route.mode, cycle.distanceKm, 1) : cycle;
  const durationMs = slotAdjustedDuration(baseDurationMs, availability.slot);
  const planned = planTransportCycle({
    game,
    traversal,
    capacity: unitCapacity,
    cycleCost: cost.transportFee,
    fuelQuantity: cost.fuelPurchased,
    durationMs,
    now,
    atInTransitLimit: availability.reason === 'in-transit-limit',
  });
  const reason = !availability.ready && (planned.reason === 'ready' || planned.reason === 'in-transit-limit')
    ? availability.reason : planned.reason;
  return {
    ...cost,
    durationMs,
    capacity: unitCapacity,
    vehicleCount: 1,
    ownedVehicleCount: 1,
    transportSlotId: availability.slot?.id ?? null,
    transportToolLevel: availability.slot?.level ?? 1,
    ...planned,
    reason,
  };
}

/** Final unloading, other docks, custody maintenance, task starts, then trade; each tier rotates. */
export function transportMaintenanceCandidates(game, now, lastRouteId = null) {
  const routes = Array.isArray(game.transportRoutes) ? game.transportRoutes : [];
  const shipments = Array.isArray(game.transportShipments) ? game.transportShipments : [];
  const activeByRoute = new Map(shipments.filter((shipment) => shipment.status !== 'arrived')
    .map((shipment) => [shipment.routeId, shipment]));
  const activeCount = shipments.filter((shipment) => shipment.status !== 'arrived').length;
  const lastIndex = routes.findIndex((route) => route.id === lastRouteId);
  const ordered = [...routes.slice(lastIndex + 1), ...routes.slice(0, lastIndex + 1)];
  const provinceById = new Map(game.provinces.map((province) => [province.id, province]));
  const finalServices = [];
  const services = [];
  const maintenance = [];
  const taskStarts = [];
  const starts = [];
  for (const route of ordered) {
    const active = activeByRoute.get(route.id) ?? null;
    const traversal = transportTraversalStopIds(route);
    if (active) {
      if (active.status !== 'docked') continue;
      const finalVisit = Number(active.currentVisitIndex) >= traversal.length - 1;
      const plan = active.taskTrip
        ? { visitIndex: Number(active.currentVisitIndex), unload: [], load: [] }
        : planTransportNode({
          game, traversal, shipment: active,
          capacity: transportCyclePolicyForShipment(active).capacity, now,
        });
      const command = {
        kind: 'service', routeId: route.id,
        key: `service:${active.cycleId ?? active.id}:${plan.visitIndex}`,
        fingerprint: transportOperationFingerprint(game, traversal, active, activeCount),
        cycleId: active.cycleId ?? active.id,
        ...plan,
      };
      (finalVisit ? finalServices : services).push(command);
    } else if (!route.deletionPending) {
      const task = route.transportBusiness?.dispatch;
      if (task?.maintenanceRequired) {
        maintenance.push({ kind: 'task', operation: 'task-maintain', routeId: route.id,
          key: `task-maintain:${route.id}`, fingerprint: task.fingerprint });
        continue;
      }
      const availability = slotAvailability(game, route.mode);
      if (!availability.ready) continue;
      if (task?.ready) {
        taskStarts.push({ kind: 'task', operation: 'task-cycle-start', routeId: route.id,
          key: `task-start:${route.id}`, fingerprint: `${task.fingerprint}:${availability.slot?.id ?? 'compat'}:${activeCount}` });
        continue;
      }
      const estimate = estimateTransportRoute(game, route, now, provinceById);
      if (estimate.reason !== 'ready') continue;
      starts.push({
        kind: 'start', routeId: route.id, key: `start:${route.id}`,
        fingerprint: `${transportOperationFingerprint(game, traversal, null, activeCount, 1)}:${estimate.transportSlotId ?? 'compat'}:${estimate.transportToolLevel}`,
        load: estimate.firstLoad, vehicleCount: 1,
      });
    }
  }
  return [...finalServices, ...services, ...maintenance, ...taskStarts, ...starts];
}
