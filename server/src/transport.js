import * as core from './transport-core.js';
import {
  applyTransportTaskAction, isTransportTaskStart, startTransportTaskCycle,
  serviceTransportTaskNode, cancelTransportRouteTasks, transportTaskRouteState,
  transportTaskShipmentState,
} from './transport-tasks.js';

// Physical routes, inventory-fuel accounting, migration and one-leg deadlines
// retain their existing implementation. Task cargo has separate custody.
export * from './transport-core.js';

function activeTaskTrip(world, userId, routeId) {
  return (world.transportShipments ?? []).find((trip) => Number(trip.ownerId) === Number(userId)
    && trip.routeId === routeId && trip.status !== 'arrived' && trip.taskTrip === true);
}

export function applyStartTransportCycle(world, user, payload = {}, now = Date.now()) {
  return isTransportTaskStart(payload)
    ? startTransportTaskCycle(world, user, payload, now, core.applyStartTransportCycle)
    : core.applyStartTransportCycle(world, user, payload, now);
}

export function applyServiceTransportNode(world, user, payload = {}, now = Date.now()) {
  const route = world.players?.[String(user.id)]?.transportRoutes?.find((entry) => entry.id === payload.routeId);
  const result = activeTaskTrip(world, user.id, payload.routeId)
    ? serviceTransportTaskNode(world, user, payload, now, core.applyServiceTransportNode)
    : core.applyServiceTransportNode(world, user, payload, now);
  if (result.ok && route?.deletionPending
    && !world.players?.[String(user.id)]?.transportRoutes?.some((entry) => entry.id === route.id)) {
    cancelTransportRouteTasks(world, user.id, route, now);
  }
  return result;
}

export function applyDeleteTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  const route = player?.transportRoutes?.find((entry) => entry.id === payload.routeId);
  const result = core.applyDeleteTransportRoute(world, user, payload, now);
  if (result.ok && route && !player.transportRoutes.some((entry) => entry.id === route.id)) {
    cancelTransportRouteTasks(world, user.id, route, now);
  }
  return result;
}

export function applyTransportShip(world, user, payload = {}, now = Date.now()) {
  const taskAction = applyTransportTaskAction(world, user, payload, now);
  if (taskAction) return taskAction;
  if (payload.operation === 'task-cycle-start') return applyStartTransportCycle(world, user, { ...payload, taskDispatch: true }, now);
  if (payload.operation === 'cycle-start') return applyStartTransportCycle(world, user, payload, now);
  if (payload.operation === 'node-service') return applyServiceTransportNode(world, user, payload, now);
  if (payload.operation === 'route-delete') return applyDeleteTransportRoute(world, user, payload, now);
  return core.applyTransportShip(world, user, payload, now);
}

export function transportRouteClientState(world, userId) {
  const now = Number(world.lastProcessedAt || 0);
  const routes = new Map((world.players?.[String(userId)]?.transportRoutes ?? []).map((route) => [route.id, route]));
  return core.transportRouteClientState(world, userId).map((view) => ({ ...view,
    ...transportTaskRouteState(world, userId, routes.get(view.id), now),
  }));
}

export function transportShipmentClientState(world, userId) {
  const own = new Map((world.transportShipments ?? []).filter((trip) => Number(trip.ownerId) === Number(userId))
    .map((trip) => [String(trip.id), trip]));
  return core.transportShipmentClientState(world, userId).map((view) => ({ ...view,
    ...transportTaskShipmentState(own.get(view.id)),
  }));
}
