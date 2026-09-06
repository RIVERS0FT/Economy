import { TRANSPORT_COST_MARGIN, TRANSPORT_MIN_NET_GAIN } from '../../shared/transport-policy.js';

export const TRANSPORT_WAITING_LABELS = Object.freeze({
  ready: '可启动运输',
  'no-inventory': '无可运库存',
  'quotes-not-ready': '行情未就绪',
  'price-boundary': '等待调价',
  'insufficient-profit': '收益不足',
  'insufficient-funds': '资金不足',
  'in-transit-limit': '在途名额已满',
  'invalid-route': '路线数据待同步',
});

function quantity(value) {
  const parsed = Math.floor(Number(value));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function roundMoney(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function marketFor(game, provinceId, productId) {
  return game.provinceMarkets?.[provinceId]?.[productId]
    ?? (provinceId === game.defaultProvinceId ? game.markets?.[productId] : undefined);
}

export function transportOfficialQuote(game, provinceId, productId, now) {
  const market = marketFor(game, provinceId, productId);
  const price = Number(market?.officialPrice);
  const nextPriceAt = Number(market?.nextPriceAt);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(nextPriceAt) || nextPriceAt <= now) return null;
  return { price, nextPriceAt };
}

function cargoTotals(shipment) {
  const result = new Map();
  for (const entry of shipment?.manifest ?? []) {
    const count = quantity(entry.quantity);
    if (count > 0) result.set(entry.productId, (result.get(entry.productId) ?? 0) + count);
  }
  return result;
}

function referenceTable(game, traversal, productIds, now) {
  const quotes = traversal.map((provinceId) => new Map(productIds.map((productId) => [
    productId, transportOfficialQuote(game, provinceId, productId, now),
  ])));
  const future = traversal.map(() => new Map());
  for (const productId of productIds) {
    let best = 0;
    let known = true;
    for (let index = traversal.length - 1; index >= 0; index -= 1) {
      future[index].set(productId, known ? best : null);
      const quote = quotes[index].get(productId);
      if (!quote) known = false;
      else best = Math.max(best, quote.price);
    }
  }
  return { quotes, future };
}

function loadPlan(productIds, stock, current, future, remainingCapacity, unloadedIds) {
  let remaining = Math.max(0, remainingCapacity);
  const candidates = productIds.flatMap((productId) => {
    if (unloadedIds.has(productId)) return [];
    const available = quantity(stock.get(productId));
    const price = current.get(productId)?.price;
    const best = future.get(productId);
    if (!available || price === undefined || best === null || best === undefined || best <= price) return [];
    return [{ productId, available, spread: best - price }];
  }).sort((left, right) => right.spread - left.spread || left.productId.localeCompare(right.productId));
  const load = [];
  for (const candidate of candidates) {
    const count = Math.min(candidate.available, remaining);
    if (count < 1) break;
    load.push({ productId: candidate.productId, quantity: count });
    remaining -= count;
  }
  return load;
}

/** Estimate only; this function never buys, sells, freezes or mutates inventory. */
export function planTransportCycle({ game, traversal, capacity, cycleCost, durationMs, now, atInTransitLimit = false }) {
  const threshold = roundMoney(Math.max(TRANSPORT_MIN_NET_GAIN, cycleCost * TRANSPORT_COST_MARGIN));
  const result = {
    reason: 'invalid-route', firstLoad: [], grossGain: null, netGain: null,
    transportedQuantity: 0, peakLoad: 0, threshold,
  };
  if (traversal.length < 2 || !Number.isSafeInteger(capacity) || capacity < 1
    || !Number.isFinite(cycleCost) || cycleCost < 0 || !Number.isFinite(durationMs) || durationMs <= 0
    || !Number.isFinite(now) || now <= 0) return result;

  const productIds = game.products.map((product) => product.id).filter((productId) => traversal.some(
    (provinceId) => quantity(game.provinceInventories?.[provinceId]?.[productId]?.available) > 0,
  ));
  if (productIds.length === 0) return { ...result, reason: 'no-inventory', grossGain: 0, netGain: -cycleCost };
  const { quotes, future } = referenceTable(game, traversal, productIds, now);
  let nextPriceAt = Number.POSITIVE_INFINITY;
  for (const row of quotes) {
    for (const quote of row.values()) {
      if (!quote) return { ...result, reason: 'quotes-not-ready' };
      nextPriceAt = Math.min(nextPriceAt, quote.nextPriceAt);
    }
  }

  // Repeated visits share one pool of the original stock. Unloaded goods are
  // deliberately not put back into this pool, so one batch cannot fund two plans.
  const stocks = new Map([...new Set(traversal)].map((provinceId) => [provinceId, new Map(
    productIds.map((productId) => [productId, quantity(game.provinceInventories?.[provinceId]?.[productId]?.available)]),
  )]));
  let cargo = [];
  let grossGain = 0;
  let transportedQuantity = 0;
  let peakLoad = 0;
  let firstLoad = [];
  for (let visitIndex = 0; visitIndex < traversal.length; visitIndex += 1) {
    const finalVisit = visitIndex === traversal.length - 1;
    const current = quotes[visitIndex];
    const unloadedIds = new Set();
    cargo = cargo.filter((lot) => {
      const price = current.get(lot.productId).price;
      if (!finalVisit && price < future[visitIndex].get(lot.productId)) return true;
      // Both alternatives are sales, each with the current 1% market service fee.
      grossGain += lot.quantity * (price - lot.originPrice) * 0.99;
      unloadedIds.add(lot.productId);
      return false;
    });
    if (finalVisit) continue;
    const stock = stocks.get(traversal[visitIndex]);
    const occupied = cargo.reduce((sum, lot) => sum + lot.quantity, 0);
    const load = loadPlan(productIds, stock, current, future[visitIndex], capacity - occupied, unloadedIds);
    if (visitIndex === 0) firstLoad = load;
    for (const entry of load) {
      stock.set(entry.productId, stock.get(entry.productId) - entry.quantity);
      cargo.push({ ...entry, originPrice: current.get(entry.productId).price });
      transportedQuantity += entry.quantity;
    }
    peakLoad = Math.max(peakLoad, cargo.reduce((sum, lot) => sum + lot.quantity, 0));
  }
  grossGain = roundMoney(grossGain);
  const netGain = roundMoney(grossGain - cycleCost);
  const reason = transportedQuantity < 1 || netGain < threshold ? 'insufficient-profit'
    : now + durationMs >= nextPriceAt ? 'price-boundary'
      : Number(game.credits) < cycleCost ? 'insufficient-funds'
        : atInTransitLimit ? 'in-transit-limit' : 'ready';
  return { reason, firstLoad, grossGain, netGain, transportedQuantity, peakLoad, threshold };
}

/** A paid cycle always proceeds; unavailable quotes never prevent final unloading. */
export function planTransportNode({ game, traversal, shipment, capacity, now }) {
  const visitIndex = Math.max(0, Math.min(traversal.length - 1, Math.floor(Number(shipment.currentVisitIndex) || 0)));
  const cargo = cargoTotals(shipment);
  const finalVisit = visitIndex >= traversal.length - 1;
  if (finalVisit) return {
    visitIndex, unload: [...cargo].map(([productId, count]) => ({ productId, quantity: count })), load: [],
  };
  const inventory = game.provinceInventories?.[traversal[visitIndex]] ?? {};
  const productIds = [...new Set([...cargo.keys(), ...game.products.map((product) => product.id)
    .filter((productId) => quantity(inventory[productId]?.available) > 0)])];
  const { quotes, future } = referenceTable(game, traversal.slice(visitIndex), productIds, now);
  const unload = [];
  for (const [productId, count] of cargo) {
    const price = quotes[0].get(productId)?.price;
    const best = future[0].get(productId);
    if (price !== undefined && best !== null && best !== undefined && price >= best) {
      unload.push({ productId, quantity: count });
    }
  }
  const occupied = [...cargo.values()].reduce((sum, count) => sum + count, 0)
    - unload.reduce((sum, entry) => sum + entry.quantity, 0);
  const stock = new Map(productIds.map((productId) => [productId, quantity(inventory[productId]?.available)]));
  const load = loadPlan(productIds, stock, quotes[0], future[0], capacity - occupied,
    new Set(unload.map((entry) => entry.productId)));
  return { visitIndex, unload, load };
}

/** Fingerprint only inputs that can change the outcome of this route's operation. */
export function transportOperationFingerprint(game, traversal, shipment, inTransitCount) {
  const provinces = [...new Set(traversal)];
  return JSON.stringify([
    game.userId, game.saveEpoch, game.credits, inTransitCount,
    provinces.map((provinceId) => [provinceId, game.products.map(({ id }) => [
      id, quantity(game.provinceInventories?.[provinceId]?.[id]?.available),
      marketFor(game, provinceId, id)?.officialPrice, marketFor(game, provinceId, id)?.nextPriceAt,
    ])]),
    shipment ? [shipment.id, shipment.currentVisitIndex, shipment.status, shipment.manifest, shipment.policySnapshot] : null,
  ]);
}
