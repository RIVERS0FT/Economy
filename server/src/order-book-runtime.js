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
  return {
    levels: new Map(),
    sortedPrices: [],
    openCount: 0,
  };
}

function bookRecord() {
  return { buy: sideRecord(), sell: sideRecord() };
}

function sequenceFor(state, order) {
  return Number(state.sequenceByOrder.get(order) ?? Number.MAX_SAFE_INTEGER);
}

function compareWithinLevel(state, left, right) {
  const leftCreatedAt = Number(left.createdAt || 0);
  const rightCreatedAt = Number(right.createdAt || 0);
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
  return sequenceFor(state, left) - sequenceFor(state, right);
}

function comparePrice(side, left, right) {
  return side === 'buy' ? right - left : left - right;
}

function insertPrice(record, side, price) {
  let low = 0;
  let high = record.sortedPrices.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (comparePrice(side, record.sortedPrices[middle], price) <= 0) low = middle + 1;
    else high = middle;
  }
  record.sortedPrices.splice(low, 0, price);
}

function ensureLevel(record, side, price, { sorted = true } = {}) {
  const normalizedPrice = Number(price || 0);
  let level = record.levels.get(normalizedPrice);
  if (level) return level;
  level = {
    price: normalizedPrice,
    head: null,
    tail: null,
    count: 0,
    totalQuantity: 0,
  };
  record.levels.set(normalizedPrice, level);
  if (sorted) insertPrice(record, side, normalizedPrice);
  else record.sortedPrices.push(normalizedPrice);
  return level;
}

function registerNode(state, order, node) {
  const nodes = state.nodesByOrder.get(order) || [];
  nodes.push(node);
  state.nodesByOrder.set(order, nodes);
}

function appendNode(level, node) {
  node.prev = level.tail;
  node.next = null;
  if (level.tail) level.tail.next = node;
  else level.head = node;
  level.tail = node;
  level.count += 1;
}

function insertNode(state, record, side, order, { sorted }) {
  const level = ensureLevel(record, side, order.price, { sorted });
  const node = { order, record, side, level, prev: null, next: null };
  const remaining = Math.max(0, Number(order.remaining || 0));
  level.totalQuantity += remaining;
  record.openCount += 1;

  if (!sorted || !level.tail || compareWithinLevel(state, level.tail.order, order) <= 0) {
    appendNode(level, node);
    registerNode(state, order, node);
    return node;
  }

  let cursor = level.tail;
  while (cursor && compareWithinLevel(state, cursor.order, order) > 0) cursor = cursor.prev;
  if (!cursor) {
    node.next = level.head;
    if (level.head) level.head.prev = node;
    else level.tail = node;
    level.head = node;
    level.count += 1;
  } else {
    node.prev = cursor;
    node.next = cursor.next;
    if (cursor.next) cursor.next.prev = node;
    else level.tail = node;
    cursor.next = node;
    level.count += 1;
  }
  registerNode(state, order, node);
  return node;
}

function removePrice(record, price) {
  const index = record.sortedPrices.indexOf(price);
  if (index >= 0) record.sortedPrices.splice(index, 1);
  record.levels.delete(price);
}

function unlinkNode(node, remainingToRemove = 0) {
  const { level, record } = node;
  if (!level || !record) return;
  if (node.prev) node.prev.next = node.next;
  else if (level.head === node) level.head = node.next;
  if (node.next) node.next.prev = node.prev;
  else if (level.tail === node) level.tail = node.prev;
  node.prev = null;
  node.next = null;
  level.count = Math.max(0, level.count - 1);
  level.totalQuantity = Math.max(0, Number(level.totalQuantity || 0) - Math.max(0, Number(remainingToRemove || 0)));
  record.openCount = Math.max(0, record.openCount - 1);
  if (level.count === 0) removePrice(record, level.price);
  node.level = null;
  node.record = null;
}

function sortLevel(state, level) {
  if (!level || level.count < 2) return;
  const nodes = [];
  for (let node = level.head; node; node = node.next) nodes.push(node);
  nodes.sort((left, right) => compareWithinLevel(state, left.order, right.order));
  level.head = nodes[0] || null;
  level.tail = nodes[nodes.length - 1] || null;
  for (let index = 0; index < nodes.length; index += 1) {
    nodes[index].prev = nodes[index - 1] || null;
    nodes[index].next = nodes[index + 1] || null;
  }
}

function sortRecord(state, record, side) {
  record.sortedPrices = [...new Set(record.sortedPrices)].sort((left, right) => comparePrice(side, left, right));
  for (const level of record.levels.values()) sortLevel(state, level);
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
  insertNode(state, book[side], side, order, { sorted });

  if (order.ownerType === 'player' && Number.isFinite(Number(order.ownerId))) {
    const ownerId = Number(order.ownerId);
    const ownerOrders = state.ownerOrders.get(ownerId) || new Set();
    ownerOrders.add(order);
    state.ownerOrders.set(ownerId, ownerOrders);
    adjustMapValue(state.ownerOpenOrderCounts, ownerId, 1);
    adjustOwnerQuantityAggregates(state, order, Math.max(0, Number(order.remaining || 0)));
    insertNode(state, ownerBookFor(state, ownerId, key)[side], side, order, { sorted });
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

function finalizeRuntimeBooks(state) {
  for (const book of state.books.values()) {
    sortRecord(state, book.buy, 'buy');
    sortRecord(state, book.sell, 'sell');
  }
  for (const assets of state.ownerBooks.values()) {
    for (const book of assets.values()) {
      sortRecord(state, book.buy, 'buy');
      sortRecord(state, book.sell, 'sell');
    }
  }
}

function retireOpenOrder(state, order, { quantityAlreadyAdjusted = false } = {}) {
  if (!state.openOrders.has(order)) return false;
  state.openOrders.delete(order);
  const remaining = quantityAlreadyAdjusted ? 0 : Math.max(0, Number(order.remaining || 0));
  for (const node of state.nodesByOrder.get(order) || []) unlinkNode(node, remaining);
  state.nodesByOrder.delete(order);

  if (order.ownerType === 'player' && Number.isFinite(Number(order.ownerId))) {
    const ownerId = Number(order.ownerId);
    adjustMapValue(state.ownerOpenOrderCounts, ownerId, -1);
    if (!quantityAlreadyAdjusted) adjustOwnerQuantityAggregates(state, order, -remaining);
    const ownerOrders = state.ownerOrders.get(ownerId);
    ownerOrders?.delete(order);
    if (ownerOrders?.size === 0) state.ownerOrders.delete(ownerId);
  }
  return true;
}

function compactOwnerOrders(state, ownerId) {
  const normalizedOwnerId = Number(ownerId);
  const orders = state.ownerOrders.get(normalizedOwnerId);
  if (!orders) return;
  for (const order of [...orders]) {
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
    nodesByOrder: new WeakMap(),
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

function* iterateRecord(state, record) {
  if (!record) return;
  for (const price of [...record.sortedPrices]) {
    const level = record.levels.get(price);
    if (!level) continue;
    let node = level.head;
    while (node) {
      const current = node;
      node = node.next;
      const order = current.order;
      if (!isOpenOrder(order)) {
        retireOpenOrder(state, order);
        continue;
      }
      yield order;
    }
  }
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
  if (reduction > 0) {
    adjustOwnerQuantityAggregates(state, order, -reduction);
    for (const node of state.nodesByOrder.get(order) || []) {
      if (node.level) node.level.totalQuantity = Math.max(0, Number(node.level.totalQuantity || 0) - reduction);
    }
  }
  if (!isOpenOrder(order)) retireOpenOrder(state, order, { quantityAlreadyAdjusted: true });
}

export function closeOrderInOrderBook(world, order) {
  retireOpenOrder(runtimeFor(world), order);
}

export function iterateOrderBookSide(world, { assetKind = 'commodity', assetId, side }) {
  const { state, record } = recordFor(world, assetKind, assetId, side);
  return iterateRecord(state, record);
}

export function getOrderBookSide(world, { assetKind = 'commodity', assetId, side }) {
  return [...iterateOrderBookSide(world, { assetKind, assetId, side })];
}

export function getOwnerOrderBookSide(world, ownerId, { assetKind = 'commodity', assetId, side }) {
  const { state, record } = recordFor(world, assetKind, assetId, side, ownerId);
  return record ? [...iterateRecord(state, record)] : EMPTY_ORDERS;
}

export function getOrderBookDepth(world, { assetKind = 'commodity', assetId, side, limit = 5 }) {
  const { state, record } = recordFor(world, assetKind, assetId, side);
  if (!record) return EMPTY_ORDERS;
  const levels = [];
  const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 5));
  for (const price of [...record.sortedPrices]) {
    const level = record.levels.get(price);
    if (!level) continue;
    let quantity = 0;
    let orderCount = 0;
    let node = level.head;
    while (node) {
      const current = node;
      node = node.next;
      if (!isOpenOrder(current.order)) {
        retireOpenOrder(state, current.order);
        continue;
      }
      quantity += Math.max(0, Number(current.order.remaining || 0));
      orderCount += 1;
    }
    if (orderCount > 0) levels.push({ price, quantity, orderCount });
    if (levels.length >= normalizedLimit) break;
  }
  return levels;
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
  let visited = 0;
  for (const order of iterateOrderBookSide(world, { assetKind, assetId, side })) {
    visited += 1;
    if (order.ownerType === 'population') {
      recordOrderBookVisit(world, visited);
      return order;
    }
  }
  recordOrderBookVisit(world, visited);
  return null;
}
