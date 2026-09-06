import { transportCyclePolicyForShipment } from '../../shared/transport-policy.js';
import {
  TRANSPORT_MODES,
  TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
  transportCycleCost,
  transportCycleDurationMs,
  transportTraversalStopIds,
} from '../utils/provinceLogistics.ts';
import { planTransportCycle, planTransportNode, transportOperationFingerprint } from './transportPlanner.js';

export function estimateTransportRoute(game, route, now, provinceById = new Map(game.provinces.map((province) => [province.id, province]))) {
  const cycle = transportCycleCost(route, route.mode, provinceById);
  const durationMs = transportCycleDurationMs(route, route.mode, provinceById);
  const capacity = TRANSPORT_MODES[route.mode]?.capacity ?? 0;
  const inTransitCount = (game.transportShipments ?? []).filter((shipment) => shipment.status === 'in-transit').length;
  return {
    ...cycle,
    durationMs,
    capacity,
    ...planTransportCycle({
      game, traversal: transportTraversalStopIds(route), capacity,
      cycleCost: cycle.transportFee, fuelQuantity: cycle.fuelPurchased, durationMs, now,
      atInTransitLimit: inTransitCount >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
    }),
  };
}

/** Final unloading, other docked vehicles, then new starts; each tier rotates. */
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
  const starts = [];
  for (const route of ordered) {
    const active = activeByRoute.get(route.id) ?? null;
    const traversal = transportTraversalStopIds(route);
    if (active) {
      if (active.status !== 'docked') continue;
      const finalVisit = Number(active.currentVisitIndex) >= traversal.length - 1;
      if (!finalVisit && !hasSlot) continue;
      const plan = planTransportNode({
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
    } else if (hasSlot && !route.deletionPending) {
      const estimate = estimateTransportRoute(game, route, now, provinceById);
      if (estimate.reason !== 'ready') continue;
      starts.push({
        kind: 'start', routeId: route.id, key: `start:${route.id}`,
        fingerprint: transportOperationFingerprint(game, traversal, null, inTransitCount),
        load: estimate.firstLoad,
      });
    }
  }
  return [...finalServices, ...services, ...starts];
}
