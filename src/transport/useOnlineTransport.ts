import { useCallback, useEffect, useRef } from 'react';
import { gameActions } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  getStateAuthoritySnapshot,
  subscribeStateAuthorityDependencies,
} from '../app/stateDelivery.js';
import type { EconomyState, TransportRoute, TransportShipment } from '../types';
import {
  TRANSPORT_MODES,
  transportTraversalStopIds,
} from '../utils/provinceLogistics';

type CargoEntry = { productId: string; quantity: number };
type RuntimeShipment = Omit<TransportShipment, 'status'> & {
  status: 'in-transit' | 'docked' | 'arrived';
  cycleId?: string;
  currentProvinceId?: string;
  currentVisitIndex?: number;
};

function nonNegativeInteger(value: unknown) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function marketReferencePrice(game: EconomyState, provinceId: string, productId: string) {
  const product = game.products.find((candidate) => candidate.id === productId);
  const market = game.provinceMarkets?.[provinceId]?.[productId]
    ?? (provinceId === game.defaultProvinceId ? game.markets?.[productId] : undefined);
  const candidates = [market?.bestBid, market?.lastTradePrice, market?.officialPrice, market?.lastPrice, product?.basePrice];
  const selected = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  return selected === undefined ? 0 : Number(selected);
}

function cargoByProduct(shipment: RuntimeShipment | null) {
  const result = new Map<string, number>();
  for (const entry of shipment?.manifest ?? []) {
    const quantity = nonNegativeInteger(entry.quantity);
    if (quantity > 0) result.set(entry.productId, (result.get(entry.productId) ?? 0) + quantity);
  }
  return result;
}

function futureBestReference(game: EconomyState, traversal: string[], visitIndex: number, productId: string) {
  let best = 0;
  for (let index = visitIndex + 1; index < traversal.length; index += 1) {
    best = Math.max(best, marketReferencePrice(game, traversal[index], productId));
  }
  return best;
}

function planUnload(game: EconomyState, traversal: string[], visitIndex: number, shipment: RuntimeShipment) {
  const currentProvinceId = traversal[visitIndex];
  const finalVisit = visitIndex >= traversal.length - 1;
  const unload: CargoEntry[] = [];
  for (const [productId, quantity] of cargoByProduct(shipment)) {
    if (finalVisit) {
      unload.push({ productId, quantity });
      continue;
    }
    const currentReference = marketReferencePrice(game, currentProvinceId, productId);
    const futureReference = futureBestReference(game, traversal, visitIndex, productId);
    if (currentReference >= futureReference) unload.push({ productId, quantity });
  }
  return unload;
}

function planLoad(
  game: EconomyState,
  route: TransportRoute,
  traversal: string[],
  visitIndex: number,
  occupiedAfterUnload: number,
  unloadProductIds: Set<string>,
) {
  if (visitIndex >= traversal.length - 1) return [];
  const currentProvinceId = traversal[visitIndex];
  const capacity = TRANSPORT_MODES[route.mode]?.capacity ?? 0;
  let remainingCapacity = Math.max(0, capacity - occupiedAfterUnload);
  if (remainingCapacity < 1) return [];

  const inventory = game.provinceInventories?.[currentProvinceId] ?? {};
  const candidates = game.products.flatMap((product) => {
    if (unloadProductIds.has(product.id)) return [];
    const available = nonNegativeInteger(inventory[product.id]?.available);
    if (available < 1) return [];
    const currentReference = marketReferencePrice(game, currentProvinceId, product.id);
    const futureReference = futureBestReference(game, traversal, visitIndex, product.id);
    const spread = futureReference - currentReference;
    return spread > 0 ? [{ productId: product.id, available, spread }] : [];
  }).sort((left, right) => right.spread - left.spread || left.productId.localeCompare(right.productId));

  const load: CargoEntry[] = [];
  for (const candidate of candidates) {
    if (remainingCapacity < 1) break;
    const quantity = Math.min(candidate.available, remainingCapacity);
    if (quantity < 1) continue;
    load.push({ productId: candidate.productId, quantity });
    remainingCapacity -= quantity;
  }
  return load;
}

function routeHasFutureOpportunity(game: EconomyState, route: TransportRoute) {
  const traversal = transportTraversalStopIds(route);
  for (let visitIndex = 0; visitIndex < traversal.length - 1; visitIndex += 1) {
    const provinceId = traversal[visitIndex];
    const inventory = game.provinceInventories?.[provinceId] ?? {};
    for (const product of game.products) {
      if (nonNegativeInteger(inventory[product.id]?.available) < 1) continue;
      if (futureBestReference(game, traversal, visitIndex, product.id) > marketReferencePrice(game, provinceId, product.id)) {
        return true;
      }
    }
  }
  return false;
}

function nodePlan(game: EconomyState, route: TransportRoute, shipment: RuntimeShipment) {
  const traversal = transportTraversalStopIds(route);
  const visitIndex = Math.max(0, Math.min(
    traversal.length - 1,
    Math.floor(Number(shipment.currentVisitIndex ?? 0)),
  ));
  const cargo = cargoByProduct(shipment);
  const unload = planUnload(game, traversal, visitIndex, shipment);
  const unloadIds = new Set(unload.map((entry) => entry.productId));
  const unloadedQuantity = unload.reduce((total, entry) => total + entry.quantity, 0);
  const occupiedAfterUnload = [...cargo.values()].reduce((total, quantity) => total + quantity, 0) - unloadedQuantity;
  const load = planLoad(game, route, traversal, visitIndex, occupiedAfterUnload, unloadIds);
  return { visitIndex, unload, load };
}

function firstCycleLoad(game: EconomyState, route: TransportRoute) {
  const traversal = transportTraversalStopIds(route);
  return planLoad(game, route, traversal, 0, 0, new Set());
}

export function useOnlineTransport(model: LoadedGameViewModel) {
  const busyRef = useRef(false);
  const userId = model.user.id;

  const maintainTransport = useCallback(() => {
    if (busyRef.current) return;
    const authorityGame = getStateAuthoritySnapshot().state;
    if (
      !authorityGame
      || authorityGame.userId !== userId
      || authorityGame.saveEpoch !== model.game.saveEpoch
    ) return;

    const routes = Array.isArray(authorityGame.transportRoutes) ? authorityGame.transportRoutes : [];
    const shipments = (Array.isArray(authorityGame.transportShipments) ? authorityGame.transportShipments : []) as RuntimeShipment[];
    let operation: Promise<{ result: { ok: boolean; message: string } }> | null = null;

    for (const route of routes) {
      const active = shipments.find((shipment) => shipment.routeId === route.id && shipment.status !== 'arrived') ?? null;
      if (!active) {
        const load = firstCycleLoad(authorityGame, route);
        if (load.length === 0 && !routeHasFutureOpportunity(authorityGame, route)) continue;
        operation = gameActions.startTransportCycle(route.id, load);
        break;
      }
      if (active.status !== 'docked') continue;
      const plan = nodePlan(authorityGame, route, active);
      operation = gameActions.serviceTransportNode(
        route.id,
        active.cycleId ?? active.id,
        plan.visitIndex,
        plan.unload,
        plan.load,
      );
      break;
    }

    if (!operation) return;
    busyRef.current = true;
    void operation
      .then((response) => {
        if (response.result.ok) return model.refresh({ mode: 'authoritative' });
        return undefined;
      })
      .finally(() => {
        busyRef.current = false;
      });
  }, [model, userId]);

  useEffect(() => {
    maintainTransport();
    return subscribeStateAuthorityDependencies(
      ['catalog', 'player.assets', 'player.misc', 'market.quotes'],
      maintainTransport,
    );
  }, [maintainTransport]);
}
