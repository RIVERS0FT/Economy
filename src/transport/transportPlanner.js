import { TRANSPORT_COST_MARGIN, TRANSPORT_FUEL_PRODUCT_ID, TRANSPORT_MIN_NET_GAIN } from '../../shared/transport-policy.js';

export const TRANSPORT_WAITING_LABELS = Object.freeze({
  ready: '可启动运输',
  'no-inventory': '无可运库存',
  'quotes-not-ready': '行情未就绪',
  'price-boundary': '等待调价',
  'insufficient-profit': '收益不足',
  'insufficient-funds': '资金不足',
  'insufficient-fuel': '燃料不足',
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

/** Compare retaining cargo with loading local stock by the gain from this stop onward.
 * Ties retain existing cargo; unknown cargo prices never force a speculative unload.
 * Both the whole-trip forecast and actual node service use this selection policy.
 */
export function selectTransportCargo({ productIds, cargo, stock, current, future, capacity, finalVisit = false }) {
  if (finalVisit) return {
    unload: [...cargo].filter(([, count]) => count > 0).map(([productId, count]) => ({ productId, quantity: count })),
    load: [],
  };
  const retained = new Map();
  const candidates = [];
  let reserved = 0;
  for (const productId of productIds) {
    const carried = quantity(cargo.get(productId));
    const price = current.get(productId)?.price;
    const best = future.get(productId);
    if (price === undefined || best === null || best === undefined) {
      if (carried > 0) {
        retained.set(productId, carried);
        reserved += carried;
      }
      continue;
    }
    const spread = best - price;
    if (spread <= 0) continue;
    if (carried > 0) candidates.push({ productId, available: carried, spread, carried: true });
    const available = quantity(stock.get(productId));
    if (available > 0) candidates.push({ productId, available, spread, carried: false });
  }
  candidates.sort((left, right) => right.spread - left.spread
    || Number(right.carried) - Number(left.carried)
    || left.productId.localeCompare(right.productId));
  let remaining = Math.max(0, capacity - reserved);
  const load = [];
  for (const candidate of candidates) {
    const count = Math.min(candidate.available, remaining);
    if (count < 1) break;
    if (candidate.carried) retained.set(candidate.productId, count);
    else load.push({ productId: candidate.productId, quantity: count });
    remaining -= count;
  }
  const unload = [...cargo].flatMap(([productId, count]) => {
    const removed = count - (retained.get(productId) ?? 0);
    return removed > 0 ? [{ productId, quantity: removed }] : [];
  });
  return { unload, load };
}

/** Estimate only; never buys, sells, freezes or mutates inventory.
 * cycleCost is cash freight, while fuelValue is an opportunity cost, not a cash debit.
 */
export function planTransportCycle({ game, traversal, capacity, cycleCost, fuelQuantity = 0, durationMs, now, atInTransitLimit = false }) {
  const fuelAvailable = quantity(game.provinceInventories?.[traversal[0]]?.[TRANSPORT_FUEL_PRODUCT_ID]?.available);
  const fuelQuote = fuelQuantity > 0 ? transportOfficialQuote(game, traversal[0], TRANSPORT_FUEL_PRODUCT_ID, now) : null;
  const fuelValue = fuelQuantity === 0 ? 0 : fuelQuote ? roundMoney(fuelQuantity * fuelQuote.price * 0.99) : null;
  const operatingCost = fuelValue === null ? null : roundMoney(cycleCost + fuelValue);
  const threshold = roundMoney(Math.max(TRANSPORT_MIN_NET_GAIN, (operatingCost ?? cycleCost) * TRANSPORT_COST_MARGIN));
  const result = {
    reason: 'invalid-route', firstLoad: [], grossGain: null, netGain: null,
    transportedQuantity: 0, peakLoad: 0, threshold, fuelRequired: fuelQuantity,
    fuelAvailable, fuelValue, operatingCost,
  };
  if (traversal.length < 2 || !Number.isSafeInteger(capacity) || capacity < 1
    || !Number.isFinite(cycleCost) || cycleCost < 0 || !Number.isFinite(durationMs) || durationMs <= 0
    || !Number.isSafeInteger(fuelQuantity) || fuelQuantity < 0
    || !Number.isFinite(now) || now <= 0) return result;
  if (fuelAvailable < fuelQuantity) return { ...result, reason: 'insufficient-fuel' };
  if (operatingCost === null) return { ...result, reason: 'quotes-not-ready' };

  // Reserve the origin's propulsion fuel before considering it as tradable cargo.
  const availableAt = (provinceId, productId) => Math.max(0,
    quantity(game.provinceInventories?.[provinceId]?.[productId]?.available)
    - (provinceId === traversal[0] && productId === TRANSPORT_FUEL_PRODUCT_ID ? fuelQuantity : 0));
  const productIds = game.products.map((product) => product.id).filter((productId) => traversal.some(
    (provinceId) => availableAt(provinceId, productId) > 0,
  ));
  if (productIds.length === 0) return { ...result, reason: 'no-inventory', grossGain: 0, netGain: -operatingCost };
  const { quotes, future } = referenceTable(game, traversal, productIds, now);
  let nextPriceAt = fuelQuote?.nextPriceAt ?? Number.POSITIVE_INFINITY;
  for (const row of quotes) {
    for (const quote of row.values()) {
      if (!quote) return { ...result, reason: 'quotes-not-ready' };
      nextPriceAt = Math.min(nextPriceAt, quote.nextPriceAt);
    }
  }

  // Repeated visits share one pool of original stock; simulated deliveries are
  // never reintroduced as new supply for a second forecast opportunity.
  const stocks = new Map([...new Set(traversal)].map((provinceId) => [provinceId, new Map(
    productIds.map((productId) => [productId, availableAt(provinceId, productId)]),
  )]));
  let cargo = [];
  let grossGain = 0;
  let transportedQuantity = 0;
  let peakLoad = 0;
  let firstLoad = [];
  for (let visitIndex = 0; visitIndex < traversal.length; visitIndex += 1) {
    const current = quotes[visitIndex];
    const stock = stocks.get(traversal[visitIndex]);
    const totals = new Map();
    for (const lot of cargo) totals.set(lot.productId, (totals.get(lot.productId) ?? 0) + lot.quantity);
    const { unload, load } = selectTransportCargo({
      productIds, cargo: totals, stock, current, future: future[visitIndex], capacity,
      finalVisit: visitIndex === traversal.length - 1,
    });
    for (const entry of unload) {
      let remaining = entry.quantity;
      for (const lot of cargo) {
        if (lot.productId !== entry.productId || remaining < 1) continue;
        const count = Math.min(lot.quantity, remaining);
        // Both alternatives are sales with the same 1% market service fee.
        grossGain += count * (current.get(lot.productId).price - lot.originPrice) * 0.99;
        lot.quantity -= count;
        remaining -= count;
      }
    }
    cargo = cargo.filter((lot) => lot.quantity > 0);
    if (visitIndex === 0) firstLoad = load;
    for (const entry of load) {
      stock.set(entry.productId, stock.get(entry.productId) - entry.quantity);
      cargo.push({ ...entry, originPrice: current.get(entry.productId).price });
      transportedQuantity += entry.quantity;
    }
    peakLoad = Math.max(peakLoad, cargo.reduce((sum, lot) => sum + lot.quantity, 0));
  }
  grossGain = roundMoney(grossGain);
  const netGain = roundMoney(grossGain - operatingCost);
  const reason = transportedQuantity < 1 || netGain < threshold ? 'insufficient-profit'
    : now + durationMs >= nextPriceAt ? 'price-boundary'
      : Number(game.credits) < cycleCost ? 'insufficient-funds'
        : atInTransitLimit ? 'in-transit-limit' : 'ready';
  return { ...result, reason, firstLoad, grossGain, netGain, transportedQuantity, peakLoad };
}

/** A paid trip always proceeds; missing quotes never prevent final unloading. */
export function planTransportNode({ game, traversal, shipment, capacity, now }) {
  const visitIndex = Math.max(0, Math.min(traversal.length - 1, Math.floor(Number(shipment.currentVisitIndex) || 0)));
  const cargo = cargoTotals(shipment);
  const inventory = game.provinceInventories?.[traversal[visitIndex]] ?? {};
  const productIds = [...new Set([...cargo.keys(), ...game.products.map((product) => product.id)
    .filter((productId) => quantity(inventory[productId]?.available) > 0)])];
  const { quotes, future } = referenceTable(game, traversal.slice(visitIndex), productIds, now);
  const stock = new Map(productIds.map((productId) => [productId, quantity(inventory[productId]?.available)]));
  return {
    visitIndex,
    ...selectTransportCargo({
      productIds, cargo, stock, current: quotes[0], future: future[0], capacity,
      finalVisit: visitIndex >= traversal.length - 1,
    }),
  };
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
