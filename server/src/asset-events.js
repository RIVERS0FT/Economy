import { randomUUID } from 'node:crypto';

const MAX_ASSET_EVENTS_PER_PLAYER = 480;

const LEGACY_CATEGORY_MAP = Object.freeze({
  work_income: 'work',
  population_income: 'trade',
  market_trade: 'trade',
  facility_trade: 'facility',
  facility_construction: 'facility',
  facility_operation: 'production',
  facility_sale: 'facility',
  inventory: 'inventory',
  system: 'system',
});

const ACTION_CATEGORY_MAP = Object.freeze({
  work: 'work',
  placeOrder: 'order',
  cancelOrder: 'order',
  buildFacility: 'facility',
  listFacility: 'facility',
  cancelFacilityListing: 'facility',
  buyFacility: 'facility',
  startFacility: 'production',
  pauseFacility: 'production',
  setProductionPlan: 'production',
  collectFacility: 'inventory',
  processWorld: 'production',
  resetPlayer: 'system',
});

function createId() {
  return `asset-event-${randomUUID()}`;
}

function clone(value) {
  return structuredClone(value);
}

function normalizeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeInventory(inventory) {
  return {
    available: normalizeNumber(inventory?.available),
    frozen: normalizeNumber(inventory?.frozen),
  };
}

function legacyEvent(entry) {
  const cashDelta = normalizeNumber(entry.amount);
  return {
    id: entry.id || createId(),
    category: LEGACY_CATEGORY_MAP[entry.category] || 'system',
    createdAt: normalizeNumber(entry.createdAt) || Date.now(),
    description: String(entry.description || '历史资产记录'),
    cashDelta,
    availableCashAfter: normalizeNumber(entry.balanceAfter),
    frozenCashDelta: 0,
    frozenCashAfter: 0,
    inventoryChanges: [],
    facilityChanges: [],
    productionChanges: [],
    sourceType: 'system',
    legacy: true,
  };
}

function ensurePlayerAssetEvents(player) {
  if (!Array.isArray(player.assetEvents)) {
    player.assetEvents = Array.isArray(player.ledger)
      ? player.ledger.map(legacyEvent)
      : [];
  }
  player.assetEvents = player.assetEvents.map((event) => ({
    cashDelta: 0,
    availableCashAfter: 0,
    frozenCashDelta: 0,
    frozenCashAfter: 0,
    inventoryChanges: [],
    facilityChanges: [],
    productionChanges: [],
    ...event,
  })).slice(0, MAX_ASSET_EVENTS_PER_PLAYER);
  return player.assetEvents;
}

export function migrateAssetEvents(world) {
  if (!world || typeof world !== 'object') return world;
  world.players ||= {};
  for (const player of Object.values(world.players)) ensurePlayerAssetEvents(player);
  world.version = 3;
  return world;
}

function ownOrders(world, userId) {
  return (world.orders || [])
    .filter((order) => Number(order.ownerId) === Number(userId))
    .map((order) => ({
      id: order.id,
      productId: order.productId,
      side: order.side,
      price: normalizeNumber(order.price),
      quantity: normalizeNumber(order.quantity),
      remaining: normalizeNumber(order.remaining),
      status: order.status,
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function ownListings(world, userId) {
  return (world.facilityListings || [])
    .filter((listing) => Number(listing.ownerId) === Number(userId))
    .map((listing) => ({ id: listing.id, facilityId: listing.facilityId, price: normalizeNumber(listing.price) }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

export function capturePlayerAssetSnapshot(world, userId) {
  const player = world.players?.[String(userId)];
  if (!player) return null;
  return clone({
    credits: normalizeNumber(player.credits),
    frozenCredits: normalizeNumber(player.frozenCredits),
    inventories: Object.fromEntries(
      Object.entries(player.inventories || {}).map(([productId, inventory]) => [productId, normalizeInventory(inventory)]),
    ),
    facilities: (player.facilities || []).map((facility) => ({
      id: facility.id,
      facilityTypeId: facility.facilityTypeId,
      name: facility.name,
      status: facility.status,
      stopReason: facility.stopReason,
      productionMode: facility.productionMode,
      targetQuantity: facility.targetQuantity,
      completedQuantity: normalizeNumber(facility.completedQuantity),
      internalGoods: normalizeNumber(facility.internalGoods),
      outputProductId: facility.outputProductId,
      outputPerCycle: normalizeNumber(facility.outputPerCycle),
      inputProductId: facility.inputProductId,
      inputPerCycle: normalizeNumber(facility.inputPerCycle),
    })),
    trades: (player.trades || []).map((trade) => ({ id: trade.id, createdAt: trade.createdAt })),
    orders: ownOrders(world, userId),
    listings: ownListings(world, userId),
  });
}

function diffInventories(before, after) {
  const productIds = new Set([
    ...Object.keys(before?.inventories || {}),
    ...Object.keys(after?.inventories || {}),
  ]);
  const changes = [];
  for (const productId of productIds) {
    const previous = normalizeInventory(before?.inventories?.[productId]);
    const current = normalizeInventory(after?.inventories?.[productId]);
    const availableDelta = current.available - previous.available;
    const frozenDelta = current.frozen - previous.frozen;
    if (!availableDelta && !frozenDelta) continue;
    changes.push({
      productId,
      availableDelta,
      frozenDelta,
      availableAfter: current.available,
      frozenAfter: current.frozen,
    });
  }
  return changes;
}

function facilityAction(action, previous, current) {
  if (!previous && current) return action === 'buyFacility' ? 'acquired' : 'construction_started';
  if (previous && !current) return action === 'buyFacility' ? 'sold' : 'removed';
  if (action === 'listFacility') return 'listed';
  if (action === 'cancelFacilityListing') return 'unlisted';
  if (action === 'setProductionPlan') return 'plan_updated';
  if (action === 'startFacility') return 'started';
  if (action === 'pauseFacility') return 'stopped';
  if (previous?.status === 'constructing' && current?.status === 'ready') return 'construction_completed';
  if (previous?.status !== current?.status) return 'status_changed';
  return 'updated';
}

function diffFacilities(before, after, action) {
  const previousById = new Map((before?.facilities || []).map((facility) => [facility.id, facility]));
  const currentById = new Map((after?.facilities || []).map((facility) => [facility.id, facility]));
  const facilityIds = new Set([...previousById.keys(), ...currentById.keys()]);
  const facilityChanges = [];
  const productionChanges = [];

  for (const facilityId of facilityIds) {
    const previous = previousById.get(facilityId);
    const current = currentById.get(facilityId);
    const stateChanged = !previous || !current
      || previous.status !== current.status
      || previous.stopReason !== current.stopReason
      || previous.productionMode !== current.productionMode
      || previous.targetQuantity !== current.targetQuantity;
    if (stateChanged) {
      const reference = current || previous;
      facilityChanges.push({
        facilityId,
        facilityTypeId: reference?.facilityTypeId,
        facilityName: reference?.name,
        action: facilityAction(action, previous, current),
        beforeStatus: previous?.status,
        afterStatus: current?.status,
      });
    }

    if (!previous || !current) continue;
    const internalGoodsDelta = current.internalGoods - previous.internalGoods;
    const completedQuantityDelta = current.completedQuantity - previous.completedQuantity;
    if (!internalGoodsDelta && !completedQuantityDelta) continue;
    const producedQuantity = Math.max(0, internalGoodsDelta);
    const collectedQuantity = Math.max(0, -internalGoodsDelta);
    const completedCycles = current.outputPerCycle > 0
      ? Math.max(0, Math.floor(producedQuantity / current.outputPerCycle))
      : 0;
    productionChanges.push({
      facilityId,
      facilityName: current.name,
      action: collectedQuantity > 0 ? 'collected' : 'produced',
      inputProductId: current.inputProductId,
      inputQuantity: completedCycles * current.inputPerCycle,
      outputProductId: current.outputProductId,
      outputQuantity: producedQuantity || collectedQuantity,
      internalGoodsDelta,
      completedQuantityDelta,
    });
  }

  return { facilityChanges, productionChanges };
}

function changedJson(left, right) {
  return JSON.stringify(left || []) !== JSON.stringify(right || []);
}

function inferSource(action, payload, before, after) {
  const beforeTradeIds = new Set((before?.trades || []).map((trade) => trade.id));
  const newTrade = (after?.trades || []).find((trade) => !beforeTradeIds.has(trade.id));
  if (newTrade) return { sourceType: 'trade', sourceId: newTrade.id };

  const beforeOrderIds = new Set((before?.orders || []).map((order) => order.id));
  const newOrder = (after?.orders || []).find((order) => !beforeOrderIds.has(order.id));
  if (newOrder) return { sourceType: 'order', sourceId: newOrder.id };

  if (payload?.orderId) return { sourceType: 'order', sourceId: payload.orderId };
  if (payload?.facilityId) return { sourceType: 'facility', sourceId: payload.facilityId };
  if (payload?.listingId) return { sourceType: 'facility', sourceId: payload.listingId };
  if (action === 'work') return { sourceType: 'work' };
  if (action === 'processWorld') return { sourceType: 'production' };
  return { sourceType: 'system' };
}

function hasMeaningfulChanges(event, before, after) {
  return Boolean(
    event.cashDelta
    || event.frozenCashDelta
    || event.inventoryChanges.length
    || event.facilityChanges.length
    || event.productionChanges.length
    || changedJson(before?.orders, after?.orders)
    || changedJson(before?.listings, after?.listings)
    || changedJson(before?.trades, after?.trades)
  );
}

export function appendAssetEventFromDiff(
  world,
  userId,
  before,
  { action, payload = {}, result, createdAt = Date.now(), description },
) {
  const player = world.players?.[String(userId)];
  if (!player || !before || result?.ok === false) return null;
  ensurePlayerAssetEvents(player);
  const after = capturePlayerAssetSnapshot(world, userId);
  const inventoryChanges = diffInventories(before, after);
  const { facilityChanges, productionChanges } = diffFacilities(before, after, action);
  const source = inferSource(action, payload, before, after);
  const hasNewTrade = changedJson(before?.trades, after?.trades);
  const event = {
    id: createId(),
    category: hasNewTrade ? 'trade' : (ACTION_CATEGORY_MAP[action] || 'system'),
    createdAt,
    description: String(description || result?.message || '资产状态已更新'),
    cashDelta: after.credits - before.credits,
    availableCashAfter: after.credits,
    frozenCashDelta: after.frozenCredits - before.frozenCredits,
    frozenCashAfter: after.frozenCredits,
    inventoryChanges,
    facilityChanges,
    productionChanges,
    ...source,
  };
  if (!hasMeaningfulChanges(event, before, after)) return null;
  player.assetEvents.unshift(event);
  player.assetEvents = player.assetEvents.slice(0, MAX_ASSET_EVENTS_PER_PLAYER);
  return event;
}