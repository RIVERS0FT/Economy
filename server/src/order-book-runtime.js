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

function compactClosedPrefix(record) {
  let closed = 0;
  while (closed < record.orders.length && !isOpenOrder(record.orders[closed])) closed += 1;
  if (closed > 0) record.orders.splice(0, closed);
  return record.orders;
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

function addOrder(state, order, sequence) {
  state.sequenceByOrder.set(order, sequence);
  const id = String(order?.id || '');
  if (id) state.byId.set(id, order);
  const kind = orderKind(order);
  const idValue = orderAssetId(order);
  const side = order?.side === 'sell' ? 'sell' : order?.side === 'buy' ? 'buy' : null;
  if (!idValue || !side) return;
  const key = assetKey(kind, idValue);
  let book = state.books.get(key);
  if (!book) {
    book = bookRecord();
    state.books.set(key, book);
  }
  insertSorted(state, book[side], side, order);

  if (order.ownerType === 'player' && Number.isFinite(Number(order.ownerId))) {
    const ownerId = Number(order.ownerId);
    const ownerOrders = state.ownerOrders.get(ownerId) || new Set();
    ownerOrders.add(order);
    state.ownerOrders.set(ownerId, ownerOrders);
    insertSorted(state, ownerBookFor(state, ownerId, key)[side], side, order);
  }

  if (order.demandGroupId) {
    const groupId = String(order.demandGroupId);
    const groupOrders = state.demandGroupOrders.get(groupId) || new Set();
    groupOrders.add(order);
    state.demandGroupOrders.set(groupId, groupOrders);
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
    books: new Map(),
    ownerBooks: new Map(),
    ownerOrders: new Map(),
    demandGroupOrders: new Map(),
  };
  for (let index = 0; index < orders.length; index += 1) addOrder(state, orders[index], index);
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
    for (let index = start; index < orders.length; index += 1) addOrder(state, orders[index], index);
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
  if (!book || (side !== 'buy' && side !== 'sell')) return null;
  return book[side];
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

export function getOrderBookSide(world, { assetKind = 'commodity', assetId, side }) {
  const record = recordFor(world, assetKind, assetId, side);
  return record ? compactClosedPrefix(record) : EMPTY_ORDERS;
}

export function getOwnerOrderBookSide(world, ownerId, { assetKind = 'commodity', assetId, side }) {
  const record = recordFor(world, assetKind, assetId, side, ownerId);
  return record ? compactClosedPrefix(record) : EMPTY_ORDERS;
}

export function orderById(world, orderId) {
  return runtimeFor(world).byId.get(String(orderId || '')) || null;
}

export function ordersForDemandGroup(world, groupId) {
  return [...(runtimeFor(world).demandGroupOrders.get(String(groupId || '')) || [])];
}

export function countOpenOrdersForOwner(world, ownerId) {
  const state = runtimeFor(world);
  const orders = state.ownerOrders.get(Number(ownerId));
  if (!orders) return 0;
  let count = 0;
  for (const order of orders) {
    if (isOpenOrder(order)) count += 1;
  }
  return count;
}

export function pendingCommodityBuyQuantityForOwner(world, ownerId) {
  const state = runtimeFor(world);
  const orders = state.ownerOrders.get(Number(ownerId));
  if (!orders) return 0;
  let quantity = 0;
  for (const order of orders) {
    if (orderKind(order) !== 'commodity' || order.side !== 'buy' || !isOpenOrder(order)) continue;
    quantity += Math.max(0, Number(order.remaining || 0));
  }
  return quantity;
}

export function facilitySellQuantityForOwner(world, ownerId, facilityTypeId) {
  return getOwnerOrderBookSide(world, ownerId, {
    assetKind: 'facility',
    assetId: facilityTypeId,
    side: 'sell',
  }).reduce((sum, order) => (
    isOpenOrder(order) ? sum + Math.max(0, Number(order.remaining || 0)) : sum
  ), 0);
}

export function bestSystemOrder(world, assetKind, assetId, side) {
  const orders = getOrderBookSide(world, { assetKind, assetId, side });
  let visited = 0;
  for (const order of orders) {
    visited += 1;
    if (isOpenOrder(order) && order.ownerType === 'population') {
      recordOrderBookVisit(world, visited);
      return order;
    }
  }
  recordOrderBookVisit(world, visited);
  return null;
}
