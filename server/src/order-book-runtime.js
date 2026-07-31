import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';

const runtimeByWorld = new WeakMap();
const diagnosticsByWorld = new WeakMap();
const EMPTY_ORDERS = Object.freeze([]);

function diagnosticsFor(world) {
  const current = diagnosticsByWorld.get(world) || {
    builds: 0,
    tailAppends: 0,
    sideQueries: 0,
    ordersVisited: 0,
  };
  diagnosticsByWorld.set(world, current);
  return current;
}

function assetKey(assetKind, assetId) {
  const kind = assetKind === 'facility' ? 'facility' : 'commodity';
  return `${kind}:${String(assetId || (kind === 'commodity' ? 'wheat' : ''))}`;
}

function sideRecord() {
  return { orders: [] };
}

function bookRecord() {
  return { buy: sideRecord(), sell: sideRecord() };
}

function sequenceFor(state, order) {
  return Number(state.sequenceByOrder.get(order) ?? Number.MAX_SAFE_INTEGER);
}

function compareForSide(state, side, left, right) {
  const leftPrice = Number(left.price || 0);
  const rightPrice = Number(right.price || 0);
  if (leftPrice !== rightPrice) return side === 'buy' ? rightPrice - leftPrice : leftPrice - rightPrice;
  const leftCreatedAt = Number(left.createdAt || 0);
  const rightCreatedAt = Number(right.createdAt || 0);
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
  return sequenceFor(state, left) - sequenceFor(state, right);
}

function insertSorted(state, record, side, order) {
  let low = 0;
  let high = record.orders.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (compareForSide(state, side, record.orders[middle], order) <= 0) low = middle + 1;
    else high = middle;
  }
  record.orders.splice(low, 0, order);
}

function ownerBookFor(state, ownerId, key) {
  const normalizedOwnerId = Number(ownerId);
  let assets = state.ownerBooks.get(normalizedOwnerId);
  if (!assets) {
    assets = new Map();
    state.ownerBooks.set(normalizedOwnerId, assets);
  }
  let book = assets.get(key);
  if (!book) {
    book = bookRecord();
    assets.set(key, book);
  }
  return book;
}

function adjustMapValue(map, key, delta) {
  const next = Math.max(0, Number(map.get(key) || 0) + Number(delta || 0));
  if (next > 0) map.set(key, next);
  else map.delete(key);
  return next;
}

function facilityQuantityMapFor(state, ownerId) {
  const normalizedOwnerId = Number(ownerId);
  let quantities = state.ownerFacilitySellQuantities.get(normalizedOwnerId);
  if (!quantities) {
    quantities = new Map();
    state.ownerFacilitySellQuantities.set(normalizedOwnerId, quantities);
  }
  return quantities;
}

function adjustOwnerQuantityAggregates(state, order, delta) {
  if (order.ownerType !== 'player' || !Number.isFinite(Number(order.ownerId))) return;
  const ownerId = Number(order.ownerId);
  if (orderKind(order) === 'commodity' && order.side === 'buy') {
    adjustMapValue(state.ownerPendingCommodityBuyQuantities, ownerId, delta);
  }
  if (orderKind(order) === 'facility' && order.side === 'sell') {
    const quantities = facilityQuantityMapFor(state, ownerId);
    adjustMapValue(quantities, String(orderAssetId(order) || ''), delta);
    if (quantities.size === 0) state.ownerFacilitySellQuantities.delete(ownerId);
  }
}

function addOpenOrder(state, order, { sorted }) {
  if (!isOpenOrder(order)) return;
  const kind = orderKind(order);
  const idValue = orderAssetId(order);
  const side = order?.side === 'sell' ? 'sell' : order?.side === 'buy' ? 'buy' : null;
  if (!idValue || !side) return;

  state.openOrders.add(order);
  const key = assetKey(kind, idValue);
  let book = state.books.get(key);
  if (!book) {
    book = bookRecord();
    state.books.set(key, book);
  }
  if (sorted) insertSorted(state, book[side], side, order);
  else book[side].orders.push(order);

  if (order.ownerType === 'player' && Number.isFinite(Number(order.ownerId))) {
    const ownerId = Number(order.ownerId);
    const ownerOrders = state.ownerOrders.get(ownerId) || new Set();
    ownerOrders.add(order);
    state.ownerOrders.set(ownerId, ownerOrders);
    adjustMapValue(state.ownerOpenOrderCounts, ownerId, 1);
    adjustOwnerQuantityAggregates(state, order, Math.max(0, Number(order.remaining || 0)));
    const ownerRecord = ownerBookFor(state, ownerId, key)[side];
    if (sorted) insertSorted(state, ownerRecord, side, order);
    else ownerRecord.orders.push(order);
  }

}

function addOrder(state, order, sequence, { sorted }) {
  state.sequenceByOrder.set(order, sequence);
  const id = String(order?.id || '');
  if (id) state.byId.set(id, order);
  if (order.demandGroupId) {
    const groupId = String(order.demandGroupId);
    const groupOrders = state.demandGroupOrders.get(groupId) || new Set();
    groupOrders.add(order);
    state.demandGroupOrders.set(groupId, groupOrders);
  }
  addOpenOrder(state, order, { sorted });
}

function sortBook(state, book) {
  book.buy.orders.sort((left, right) => compareForSide(state, 'buy', left, right));
  book.sell.orders.sort((left, right) => compareForSide(state, 'sell', left, right));
}

function finalizeRuntimeBooks(state) {
  for (const book of state.books.values()) sortBook(state, book);
  for (const assets of state.ownerBooks.values()) {
    for (const book of assets.values()) sortBook(state, book);
  }
}

function retireOpenOrder(state, order, { quantityAlreadyAdjusted = false } = {}) {
  if (!state.openOrders.has(order)) return false;
  state.openOrders.delete(order);

  if (order.ownerType === 'player' && Number.isFinite(Number(order.ownerId))) {
    const ownerId = Number(order.ownerId);
    adjustMapValue(state.ownerOpenOrderCounts, ownerId, -1);
    if (!quantityAlreadyAdjusted) {
      adjustOwnerQuantityAggregates(state, order, -Math.max(0, Number(order.remaining || 0)));
    }
    const ownerOrders = state.ownerOrders.get(ownerId);
    ownerOrders?.delete(order);
    if (ownerOrders?.size === 0) state.ownerOrders.delete(ownerId);
  }

  return true;
}

function compactClosedOrders(state, record) {
  if (!record || record.orders.length === 0) return record?.orders || EMPTY_ORDERS;
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < record.orders.length; readIndex += 1) {
    const order = record.orders[readIndex];
    if (!isOpenOrder(order)) {
      retireOpenOrder(state, order);
      continue;
    }
    record.orders[writeIndex] = order;
    writeIndex += 1;
  }
  if (writeIndex !== record.orders.length) record.orders.length = writeIndex;
  return record.orders;
}

function compactOwnerOrders(state, ownerId) {
  const normalizedOwnerId = Number(ownerId);
  const orders = state.ownerOrders.get(normalizedOwnerId);
  if (!orders) return;
  for (const order of orders) {
    if (!isOpenOrder(order)) retireOpenOrder(state, order);
  }
}

function buildRuntime(world) {
  const orders = world.orders || (world.orders = []);
  const state = {
    ordersRef: orders,
    indexedLength: 0,
    lastIndexedOrder: null,
    sequenceByOrder: new WeakMap(),
    byId: new Map(),
    openOrders: new WeakSet(),
    books: new Map(),
    ownerBooks: new Map(),
    ownerOrders: new Map(),
    ownerOpenOrderCounts: new Map(),
    ownerPendingCommodityBuyQuantities: new Map(),
    ownerFacilitySellQuantities: new Map(),
    demandGroupOrders: new Map(),
  };
  for (let index = 0; index < orders.length; index += 1) {
    addOrder(state, orders[index], index, { sorted: false });
  }
  finalizeRuntimeBooks(state);
  state.indexedLength = orders.length;
  state.lastIndexedOrder = orders.length > 0 ? orders[orders.length - 1] : null;
  runtimeByWorld.set(world, state);
  diagnosticsFor(world).builds += 1;
  return state;
}

function runtimeFor(world) {
  const orders = world.orders || (world.orders = []);
  let state = runtimeByWorld.get(world);
  const prefixChanged = state
    && state.ordersRef === orders
    && state.indexedLength > 0
    && state.lastIndexedOrder !== orders[state.indexedLength - 1];
  if (
    !state
    || state.ordersRef !== orders
    || state.indexedLength > orders.length
    || prefixChanged
  ) return buildRuntime(world);

  if (state.indexedLength < orders.length) {
    const start = state.indexedLength;
    for (let index = start; index < orders.length; index += 1) {
      addOrder(state, orders[index], index, { sorted: true });
    }
    state.indexedLength = orders.length;
    state.lastIndexedOrder = orders[orders.length - 1];
    diagnosticsFor(world).tailAppends += orders.length - start;
  }
  return state;
}

function recordFor(world, assetKind, assetId, side, ownerId = null) {
  const state = runtimeFor(world);
  const key = assetKey(assetKind, assetId);
  diagnosticsFor(world).sideQueries += 1;
  const book = ownerId === null
    ? state.books.get(key)
    : state.ownerBooks.get(Number(ownerId))?.get(key);
  if (!book || (side !== 'buy' && side !== 'sell')) return { state, record: null };
  return { state, record: book[side] };
}

export function invalidateOrderBookRuntime(world) {
  runtimeByWorld.delete(world);
}

export function resetOrderBookRuntimeDiagnostics(world, { invalidate = true } = {}) {
  diagnosticsByWorld.set(world, { builds: 0, tailAppends: 0, sideQueries: 0, ordersVisited: 0 });
  if (invalidate) invalidateOrderBookRuntime(world);
}

export function getOrderBookRuntimeDiagnostics(world) {
  return { ...diagnosticsFor(world) };
}

export function recordOrderBookVisit(world, count = 1) {
  diagnosticsFor(world).ordersVisited += Math.max(0, Number(count) || 0);
}

export function recordOrderBookReduction(world, order, quantity) {
  const state = runtimeFor(world);
  if (!state.openOrders.has(order)) return;
  const reduction = Math.max(0, Number(quantity) || 0);
  if (reduction > 0) adjustOwnerQuantityAggregates(state, order, -reduction);
  if (!isOpenOrder(order)) retireOpenOrder(state, order, { quantityAlreadyAdjusted: true });
}

export function closeOrderInOrderBook(world, order) {
  retireOpenOrder(runtimeFor(world), order);
}

export function getOrderBookSide(world, { assetKind = 'commodity', assetId, side }) {
  const { state, record } = recordFor(world, assetKind, assetId, side);
  return record ? compactClosedOrders(state, record) : EMPTY_ORDERS;
}

export function getOwnerOrderBookSide(world, ownerId, { assetKind = 'commodity', assetId, side }) {
  const { state, record } = recordFor(world, assetKind, assetId, side, ownerId);
  return record ? compactClosedOrders(state, record) : EMPTY_ORDERS;
}

export function orderById(world, orderId) {
  return runtimeFor(world).byId.get(String(orderId || '')) || null;
}

export function ordersForDemandGroup(world, groupId) {
  return [...(runtimeFor(world).demandGroupOrders.get(String(groupId || '')) || [])];
}

export function countOpenOrdersForOwner(world, ownerId) {
  const state = runtimeFor(world);
  compactOwnerOrders(state, ownerId);
  return Number(state.ownerOpenOrderCounts.get(Number(ownerId)) || 0);
}

export function pendingCommodityBuyQuantityForOwner(world, ownerId) {
  const state = runtimeFor(world);
  compactOwnerOrders(state, ownerId);
  return Number(state.ownerPendingCommodityBuyQuantities.get(Number(ownerId)) || 0);
}

export function facilitySellQuantityForOwner(world, ownerId, facilityTypeId) {
  const state = runtimeFor(world);
  compactOwnerOrders(state, ownerId);
  return Number(
    state.ownerFacilitySellQuantities.get(Number(ownerId))?.get(String(facilityTypeId || '')) || 0,
  );
}

export function bestSystemOrder(world, assetKind, assetId, side) {
  const orders = getOrderBookSide(world, { assetKind, assetId, side });
  let visited = 0;
  for (const order of orders) {
    visited += 1;
    if (order.ownerType === 'population') {
      recordOrderBookVisit(world, visited);
      return order;
    }
  }
  recordOrderBookVisit(world, visited);
  return null;
}
