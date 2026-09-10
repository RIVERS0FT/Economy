import { transportCyclePolicyForShipment, transportFleetCost, transportRouteVehicleCount } from '../../shared/transport-policy.js';
import {
  TRANSPORT_MODES,
  TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
  transportCycleCost,
  transportCycleDurationMs,
  transportTraversalStopIds,
} from '../utils/provinceLogistics.ts';
import { planTransportCycle, planTransportNode, transportOperationFingerprint, transportOfficialQuote } from './transportPlanner.js';

/** A loose capacity bound: only original stock that could gain value matters.
 * Repeated visits share stock; future production and simulated deliveries do not
 * justify extra vehicles. Missing prices keep a conservative upper bound.
 */
function fleetCandidateLimit(game, traversal, unitCapacity, owned, now) {
  const provinces = [...new Set(traversal)];
  const maximum = unitCapacity * owned;
  let total = 0;
  for (const { id } of game.products) {
    const quotes = provinces.map((provinceId) => transportOfficialQuote(game, provinceId, id, now));
    const highest = Math.max(0, ...quotes.map((quote) => quote?.price ?? 0));
    for (let index = 0; index < provinces.length; index += 1) {
      if (quotes[index] && quotes[index].price >= highest && quotes.every(Boolean)) continue;
      const stock = Number(game.provinceInventories?.[provinces[index]]?.[id]?.available);
      if (Number.isSafeInteger(stock) && stock > 0) total = Math.min(maximum, total + stock);
      if (total >= maximum) return owned;
    }
  }
  return Math.max(1, Math.ceil(total / unitCapacity));
}

export function estimateTransportRoute(game, route, now, provinceById = new Map(game.provinces.map((province) => [province.id, province]))) {
  const cycle = transportCycleCost(route, route.mode, provinceById);
  const durationMs = transportCycleDurationMs(route, route.mode, provinceById);
  const unitCapacity = TRANSPORT_MODES[route.mode]?.capacity ?? 0;
  const ownedVehicleCount = transportRouteVehicleCount(route);
  const traversal = transportTraversalStopIds(route);
  const inTransitCount = (game.transportShipments ?? []).filter((shipment) => shipment.status === 'in-transit').length;
  const candidate = (vehicleCount) => {
    const cost = unitCapacity > 0 ? transportFleetCost(route.mode, cycle.distanceKm, vehicleCount) : cycle;
    const capacity = unitCapacity * vehicleCount;
    return {
      ...cost, durationMs, capacity, vehicleCount, ownedVehicleCount,
      ...planTransportCycle({
        game, traversal, capacity,
        cycleCost: cost.transportFee, fuelQuantity: cost.fuelPurchased, durationMs, now,
        atInTransitLimit: inTransitCount >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
      }),
    };
  };
  let best = candidate(1);
  if (unitCapacity < 1 || ownedVehicleCount === 1) return best;
  const limit = fleetCandidateLimit(game, traversal, unitCapacity, ownedVehicleCount, now);
  for (let count = 2; count <= limit; count += 1) {
    const estimate = candidate(count);
    // Affordable, fueled and profitable smaller fleets win over blocked larger
    // fleets. Equal gains keep the earlier (smaller) count. No full-load gate.
    if (best.reason === 'ready' && estimate.reason !== 'ready') continue;
    if ((estimate.reason === 'ready' && best.reason !== 'ready')
      || (estimate.netGain !== null && (best.netGain === null || estimate.netGain > best.netGain))) best = estimate;
  }
  return best;
}

/** Final unloading, other docks, custody maintenance, task starts, then trade; each tier rotates. */
export function transportMaintenanceCandidates(game, now, lastRouteId = null) {
  const routes = Array.isArray(game.transportRoutes) ? game.transportRoutes : [];
  const shipments = Array.isArray(game.transportShipments) ? game.transportShipments : [];
  const activeByRoute = new Map(shipments.filter((shipment) => shipment.status !== 'arrived')
    .map((shipment) => [shipment.routeId, shipment]));
  const inTransitCount = shipments.filter((shipment) => shipment.status === 'in-transit').length;
  const hasSlot = inTransitCount < TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER;
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
      if (!finalVisit && !hasSlot) continue;
      // Confirmed tasks have fixed destinations and separate escrow. Never pass
      // their cargo through the speculative trade selector or trust client quantities.
      const plan = active.taskTrip
        ? { visitIndex: Number(active.currentVisitIndex), unload: [], load: [] }
        : planTransportNode({
          game, traversal, shipment: active,
          capacity: transportCyclePolicyForShipment(active).capacity, now,
        });
      const command = {
        kind: 'service', routeId: route.id,
        key: `service:${active.cycleId ?? active.id}:${plan.visitIndex}`,
        fingerprint: transportOperationFingerprint(game, traversal, active, inTransitCount),
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
      if (!hasSlot) continue;
      if (task?.ready) {
        taskStarts.push({ kind: 'task', operation: 'task-cycle-start', routeId: route.id,
          key: `task-start:${route.id}`, fingerprint: `${task.fingerprint}:${inTransitCount}` });
        continue;
      }
      const estimate = estimateTransportRoute(game, route, now, provinceById);
      if (estimate.reason !== 'ready') continue;
      starts.push({
        kind: 'start', routeId: route.id, key: `start:${route.id}`,
        fingerprint: transportOperationFingerprint(game, traversal, null, inTransitCount, estimate.vehicleCount),
        load: estimate.firstLoad, vehicleCount: estimate.vehicleCount,
      });
    }
  }
  return [...finalServices, ...services, ...maintenance, ...taskStarts, ...starts];
}
