import {
  applyAction,
  createClientState,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
  processWorld,
} from './domain.js';
import { createWarehouseUsage, ensureWarehouse } from './warehouse.js';

const TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const MAX_CYCLES_PER_GROUP = 50_000;
const MAX_FACILITY_ORDER_QUANTITY = 1_000_000;
const MAX_ORDER_PRICE = 1_000_000;
const MAX_OPEN_ORDERS = 10;
const MAX_PRICE_POINTS = 288;

function result(ok, message) {
  return { ok, message };
}

function clone(value) {
  return structuredClone(value);
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = Math.floor(number);
  return normalized < 1 || normalized > max ? null : normalized;
}

function inventoryFor(player, productId) {
  player.inventories ||= {};
  player.inventories[productId] ||= { available: 0, frozen: 0 };
  return player.inventories[productId];
}

function typeFor(typeId) {
  return TYPES.get(String(typeId || ''));
}

function isOpenOrder(order) {
  return order?.remaining > 0 && (order.status === 'open' || order.status === 'partial');
}

function orderKind(order) {
  return order?.assetKind === 'facility' || order?.facilityTypeId ? 'facility' : 'commodity';
}

function orderAssetId(order) {
  return orderKind(order) === 'facility'
    ? String(order.assetId || order.facilityTypeId || '')
    : String(order.assetId || order.productId || 'grain');
}

function normalizeOrder(order) {
  const kind = orderKind(order);
  const assetId = orderAssetId(order);
  order.assetKind = kind;
  order.assetId = assetId;
  if (kind === 'facility') order.facilityTypeId = assetId;
  else order.productId = assetId;
  return order;
}

function facilityOrders(world, typeId) {
  return (world.orders || []).filter((order) => (
    orderKind(order) === 'facility' && orderAssetId(order) === typeId
  ));
}

function listedQuantity(world, ownerId, typeId) {
  return facilityOrders(world, typeId).reduce((sum, order) => {
    if (Number(order.ownerId) !== Number(ownerId) || order.side !== 'sell' || !isOpenOrder(order)) return sum;
    return sum + Math.max(0, Number(order.remaining || 0));
  }, 0);
}

function createGroup(typeId, overrides = {}) {
  return {
    facilityTypeId: typeId,
    count: Math.max(0, Number(overrides.count || 0)),
    participatingCount: Math.max(0, Number(overrides.participatingCount || 0)),
    pendingJoinCount: Math.max(0, Number(overrides.pendingJoinCount || 0)),
    status: overrides.status || 'paused',
    stopReason: overrides.stopReason,
    cycleStartedAt: overrides.cycleStartedAt,
    productionMode: overrides.productionMode === 'target' ? 'target' : 'continuous',
    targetQuantity: overrides.targetQuantity,
    completedQuantity: Math.max(0, Number(overrides.completedQuantity || 0)),
  };
}

function normalizeGroup(group) {
  const type = typeFor(group.facilityTypeId);
  if (!type) return null;
  const normalized = createGroup(type.id, group);
  normalized.count = Math.max(0, Math.floor(normalized.count));
  normalized.participatingCount = Math.min(normalized.count, Math.floor(normalized.participatingCount));
  normalized.pendingJoinCount = Math.min(
    normalized.count - normalized.participatingCount,
    Math.floor(normalized.pendingJoinCount),
  );
  if (normalized.status !== 'running') {
    normalized.participatingCount = 0;
    normalized.pendingJoinCount = 0;
    delete normalized.cycleStartedAt;
  }
  return normalized;
}

function groupFor(player, typeId, create = false) {
  player.facilityGroups ||= [];
  let group = player.facilityGroups.find((item) => item.facilityTypeId === typeId);
  if (!group && create) {
    group = createGroup(typeId);
    player.facilityGroups.push(group);
  }
  return group;
}

function seedFacilityHistory(type, now) {
  const offsets = [-4, -2, 0, 2, 1, 3, 0, -1, 2, 0, 1, 0];
  return offsets.map((offset, index) => ({
    price: Math.max(1, type.systemValue + offset),
    quantity: 1 + (index % 3),
    createdAt: now - 120_000 * (offsets.length - index),
  }));
}

function createFacilityMarket(type, now) {
  return {
    facilityTypeId: type.id,
    lastPrice: type.systemValue,
    priceHistory: seedFacilityHistory(type, now),
  };
}

function facilityMarketFor(world, typeId, now = Date.now()) {
  const type = typeFor(typeId);
  if (!type) return null;
  world.facilityMarkets ||= {};
  world.facilityMarkets[type.id] ||= createFacilityMarket(type, now);
  return world.facilityMarkets[type.id];
}

function recordFacilityPrice(world, typeId, price, quantity, createdAt) {
  const market = facilityMarketFor(world, typeId, createdAt);
  if (!market) return;
  market.lastPrice = price;
  market.priceHistory.push({ price, quantity, createdAt });
  market.priceHistory = market.priceHistory.slice(-MAX_PRICE_POINTS);
}

function migrateLegacyListings(world) {
  world.orders ||= [];
  for (const order of world.orders) normalizeOrder(order);
  const legacyListings = Array.isArray(world.facilityListings) ? world.facilityListings : [];
  for (const listing of legacyListings) {
    const typeId = String(listing.facilityTypeId || listing.facility?.facilityTypeId || 'farm');
    const type = typeFor(typeId);
    if (!type || world.orders.some((order) => order.id === listing.id)) continue;
    const quantity = Math.max(1, Math.floor(Number(listing.quantity || 1)));
    world.orders.push({
      id: String(listing.id || `facility-order-${type.id}-${world.orders.length}`),
      assetKind: 'facility',
      assetId: type.id,
      facilityTypeId: type.id,
      side: 'sell',
      ownerType: listing.ownerType === 'player' ? 'player' : 'market',
      ownerId: listing.ownerId,
      ownerName: String(listing.ownerName || '系统资产市场'),
      price: Math.max(1, Math.floor(Number(listing.unitPrice || listing.price || type.systemValue))),
      quantity,
      remaining: quantity,
      status: 'open',
      createdAt: Number(listing.createdAt || Date.now()),
    });
  }
  world.facilityListings = [];
}

function migrateLegacyPlayer(player, now) {
  ensureWarehouse(player);
  player.facilityGroups ||= [];
  player.stats ||= {};
  player.stats.workClicks = Number(player.stats.workClicks ?? player.work?.totalClicks ?? 0);
  player.stats.producedGoods = Number(player.stats.producedGoods || 0);
  player.stats.boughtGoods = Number(player.stats.boughtGoods || 0);
  player.stats.soldGoods = Number(player.stats.soldGoods || 0);
  player.stats.giftIssued = Number(player.stats.giftIssued || 0);

  if (Array.isArray(player.facilities) && player.facilities.length > 0) {
    const byType = new Map();
    for (const facility of player.facilities) {
      const type = typeFor(facility.facilityTypeId || 'farm');
      if (!type) continue;
      const legacyGoods = Math.max(0, Number(facility.internalGoods || 0));
      if (legacyGoods > 0) inventoryFor(player, type.output.productId).available += legacyGoods;
      if (facility.status === 'constructing') {
        if (!player.facilityConstruction) {
          player.facilityConstruction = {
            facilityTypeId: type.id,
            startedAt: Math.max(0, Number(facility.constructionCompletesAt || now) - type.buildTimeMs),
            completesAt: Number(facility.constructionCompletesAt || now),
          };
        }
        continue;
      }
      const bucket = byType.get(type.id) || [];
      bucket.push(facility);
      byType.set(type.id, bucket);
    }
    for (const [typeId, facilities] of byType) {
      const existing = groupFor(player, typeId, true);
      if (existing.count > 0) continue;
      const allRunning = facilities.every((facility) => facility.status === 'running');
      const sameMode = facilities.every((facility) => (
        (facility.productionMode || 'continuous') === (facilities[0].productionMode || 'continuous')
      ));
      existing.count = facilities.length;
      existing.status = allRunning ? 'running' : 'paused';
      existing.stopReason = allRunning ? undefined : 'manual';
      existing.participatingCount = allRunning ? facilities.length : 0;
      existing.pendingJoinCount = 0;
      existing.cycleStartedAt = allRunning ? now : undefined;
      existing.productionMode = sameMode && facilities[0].productionMode === 'target' ? 'target' : 'continuous';
      existing.targetQuantity = existing.productionMode === 'target' ? facilities[0].targetQuantity : undefined;
      existing.completedQuantity = facilities.reduce(
        (sum, facility) => sum + Math.max(0, Number(facility.completedQuantity || 0)),
        0,
      );
    }
  }

  player.facilityGroups = player.facilityGroups.map(normalizeGroup).filter(Boolean);
  delete player.facilities;
}

export function migrateFacilityGroupWorld(world, now = Date.now()) {
  world.players ||= {};
  world.orders ||= [];
  migrateLegacyListings(world);
  world.facilityMarkets ||= {};
  for (const type of FACILITY_TYPE_CATALOG) facilityMarketFor(world, type.id, now);
  for (const player of Object.values(world.players)) migrateLegacyPlayer(player, now);

  for (const player of Object.values(world.players)) {
    for (const group of player.facilityGroups || []) {
      const listed = listedQuantity(world, player.userId, group.facilityTypeId);
      const available = Math.max(0, group.count - listed);
      if (group.status === 'listed' || group.stopReason === 'listed') {
        group.status = group.count === 1 ? 'ready' : 'paused';
        group.stopReason = 'manual';
      }
      if (group.status === 'running') {
        group.participatingCount = Math.min(group.participatingCount, available);
        group.pendingJoinCount = Math.min(
          group.pendingJoinCount,
          Math.max(0, available - group.participatingCount),
        );
        if (group.participatingCount < 1) {
          group.status = 'paused';
          group.stopReason = listed > 0 ? 'listed' : 'manual';
          group.participatingCount = 0;
          group.pendingJoinCount = 0;
          delete group.cycleStartedAt;
        }
      }
    }
  }

  world.version = 5;
  return world;
}

export function stripLegacyFacilityInstances(world) {
  for (const player of Object.values(world.players || {})) delete player.facilities;
  world.facilityListings = [];
  world.version = 5;
  return world;
}

function withLegacyFacilitiesSuppressed(world, callback) {
  const playerSnapshots = [];
  for (const player of Object.values(world.players || {})) {
    playerSnapshots.push({ player, facilities: player.facilities });
    player.facilities = [];
  }
  const listings = world.facilityListings;
  world.facilityListings = [];
  try {
    return callback();
  } finally {
    world.facilityListings = listings || [];
    for (const snapshot of playerSnapshots) {
      if (snapshot.facilities === undefined) delete snapshot.player.facilities;
      else snapshot.player.facilities = snapshot.facilities;
    }
  }
}

function stopGroup(group, status, reason) {
  group.status = status;
  group.stopReason = reason;
  group.participatingCount = 0;
  group.pendingJoinCount = 0;
  delete group.cycleStartedAt;
}

function groupRequirements(type, count) {
  const participating = Math.max(0, Number(count || 0));
  const output = type.output.quantity * participating;
  const input = (type.input?.quantity || 0) * participating;
  return {
    output,
    input,
    cost: type.operatingCost * participating,
    netStorage: Math.max(0, output - input),
  };
}

function blockReason(world, player, group, type, count) {
  const requirements = groupRequirements(type, count);
  if (count <= 0) return { status: 'paused', reason: 'manual', message: '没有可参与生产的工厂' };
  if (group.productionMode === 'target') {
    const remaining = Math.max(0, Number(group.targetQuantity || 0) - group.completedQuantity);
    if (remaining === 0) return { status: 'paused', reason: 'plan_complete', message: '生产计划已经完成' };
    if (remaining < requirements.output || remaining % requirements.output !== 0) {
      return { status: 'paused', reason: 'plan_adjustment_required', message: '工厂数量变化后，剩余计划无法按完整周期生产' };
    }
  }
  if (requirements.netStorage > createWarehouseUsage(world, player).warehouseAvailableCapacity) {
    return { status: 'full', reason: 'output_full', message: '共享仓库空间不足' };
  }
  if (requirements.cost > player.credits) {
    return { status: 'insufficient_funds', reason: 'insufficient_funds', message: '运营资金不足' };
  }
  if (type.input && inventoryFor(player, type.input.productId).available < requirements.input) {
    return { status: 'insufficient_input', reason: 'insufficient_input', message: '生产原料不足' };
  }
  return null;
}

function maxExecutableCycles(world, player, group, type, count, requestedCycles) {
  const requirements = groupRequirements(type, count);
  let allowed = Math.max(0, Math.min(requestedCycles, MAX_CYCLES_PER_GROUP));
  if (requirements.cost > 0) allowed = Math.min(allowed, Math.floor(player.credits / requirements.cost));
  if (type.input && requirements.input > 0) {
    allowed = Math.min(allowed, Math.floor(inventoryFor(player, type.input.productId).available / requirements.input));
  }
  if (requirements.netStorage > 0) {
    allowed = Math.min(
      allowed,
      Math.floor(createWarehouseUsage(world, player).warehouseAvailableCapacity / requirements.netStorage),
    );
  }
  if (group.productionMode === 'target') {
    const remaining = Math.max(0, Number(group.targetQuantity || 0) - group.completedQuantity);
    allowed = Math.min(allowed, Math.floor(remaining / requirements.output));
  }
  return Math.max(0, allowed);
}

function executeCycles(player, group, type, count, cycles) {
  if (cycles <= 0) return;
  const requirements = groupRequirements(type, count);
  const outputQuantity = requirements.output * cycles;
  const inputQuantity = requirements.input * cycles;
  const cost = requirements.cost * cycles;
  player.credits -= cost;
  player.stats.systemSinks += cost;
  player.stats.producedGoods = Number(player.stats.producedGoods || 0) + outputQuantity;
  if (type.input) inventoryFor(player, type.input.productId).available -= inputQuantity;
  inventoryFor(player, type.output.productId).available += outputQuantity;
  group.completedQuantity += outputQuantity;
  group.cycleStartedAt += type.cycleMs * cycles;
}

function finishConstruction(player, now) {
  const construction = player.facilityConstruction;
  if (!construction || now < construction.completesAt) return;
  const group = groupFor(player, construction.facilityTypeId, true);
  group.count += 1;
  if (group.status === 'running') group.pendingJoinCount += 1;
  else {
    group.status = group.count === 1 ? 'ready' : 'paused';
    group.stopReason = 'manual';
  }
  delete player.facilityConstruction;
}

function processGroup(world, player, group, now) {
  const type = typeFor(group.facilityTypeId);
  if (!type || group.status !== 'running' || !group.cycleStartedAt) return;
  let elapsedCycles = Math.max(0, Math.floor((now - group.cycleStartedAt) / type.cycleMs));
  if (elapsedCycles < 1) return;

  if (group.pendingJoinCount > 0) {
    const currentCount = group.participatingCount;
    const firstAllowed = maxExecutableCycles(world, player, group, type, currentCount, 1);
    if (firstAllowed < 1) {
      const blocked = blockReason(world, player, group, type, currentCount);
      stopGroup(group, blocked?.status || 'paused', blocked?.reason || 'manual');
      return;
    }
    executeCycles(player, group, type, currentCount, 1);
    elapsedCycles -= 1;
    group.participatingCount += group.pendingJoinCount;
    group.pendingJoinCount = 0;

    if (group.productionMode === 'target' && group.completedQuantity >= group.targetQuantity) {
      stopGroup(group, 'paused', 'plan_complete');
      return;
    }
    const adjustedBlock = blockReason(world, player, group, type, group.participatingCount);
    if (adjustedBlock?.reason === 'plan_adjustment_required') {
      stopGroup(group, adjustedBlock.status, adjustedBlock.reason);
      return;
    }
  }

  if (elapsedCycles > 0) {
    const cycles = maxExecutableCycles(world, player, group, type, group.participatingCount, elapsedCycles);
    executeCycles(player, group, type, group.participatingCount, cycles);
    elapsedCycles -= cycles;
  }

  if (group.productionMode === 'target' && group.completedQuantity >= group.targetQuantity) {
    stopGroup(group, 'paused', 'plan_complete');
    return;
  }

  const blocked = blockReason(world, player, group, type, group.participatingCount);
  if (elapsedCycles > 0 || blocked) stopGroup(group, blocked?.status || 'paused', blocked?.reason || 'maintenance');
}

function sortCandidates(orders, incomingSide) {
  return [...orders].sort((left, right) => {
    if (left.price !== right.price) return incomingSide === 'buy' ? left.price - right.price : right.price - left.price;
    return left.createdAt - right.createdAt;
  });
}

function describeCounterparty(order) {
  return order.ownerName || (order.ownerType === 'market' ? '系统资产市场' : '玩家');
}

function addPurchasedGroup(player, typeId, quantity) {
  const group = groupFor(player, typeId, true);
  group.count += quantity;
  if (group.status === 'running') group.pendingJoinCount += quantity;
  else {
    group.status = group.count === quantity ? 'ready' : 'paused';
    group.stopReason = 'manual';
  }
  return group;
}

function executeFacilityTrade(world, incoming, resting, quantity, createdAt) {
  const buy = incoming.side === 'buy' ? incoming : resting;
  const sell = incoming.side === 'sell' ? incoming : resting;
  const typeId = orderAssetId(incoming);
  const price = resting.price;

  incoming.remaining -= quantity;
  resting.remaining -= quantity;
  incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
  resting.status = resting.remaining === 0 ? 'filled' : 'partial';

  if (buy.ownerType === 'player') {
    const buyer = world.players[String(buy.ownerId)];
    if (!buyer) throw new Error(`Missing facility buyer ${buy.ownerId}`);
    const reserved = quantity * buy.price;
    const actual = quantity * price;
    buyer.frozenCredits -= reserved;
    buyer.credits += reserved - actual;
    buyer.stats.facilityVolume = Number(buyer.stats.facilityVolume || 0) + actual;
    addPurchasedGroup(buyer, typeId, quantity);
  }

  if (sell.ownerType === 'player') {
    const seller = world.players[String(sell.ownerId)];
    if (!seller) throw new Error(`Missing facility seller ${sell.ownerId}`);
    const group = groupFor(seller, typeId);
    if (!group || group.count < quantity) throw new Error('卖方工厂数量不足');
    group.count -= quantity;
    seller.credits += quantity * price;
    seller.stats.facilityVolume = Number(seller.stats.facilityVolume || 0) + quantity * price;
    if (group.count === 0) seller.facilityGroups = seller.facilityGroups.filter((item) => item !== group);
  }

  recordFacilityPrice(world, typeId, price, quantity, createdAt);
}

function matchFacilityOrder(world, incoming, createdAt) {
  const opposite = incoming.side === 'buy' ? 'sell' : 'buy';
  const typeId = orderAssetId(incoming);
  const candidates = sortCandidates(
    facilityOrders(world, typeId).filter((order) => (
      order.id !== incoming.id
      && order.side === opposite
      && isOpenOrder(order)
      && !(order.ownerType === 'player' && incoming.ownerType === 'player' && order.ownerId === incoming.ownerId)
      && (incoming.side === 'buy' ? order.price <= incoming.price : order.price >= incoming.price)
    )),
    incoming.side,
  );
  for (const candidate of candidates) {
    if (!isOpenOrder(incoming)) break;
    executeFacilityTrade(world, incoming, candidate, Math.min(incoming.remaining, candidate.remaining), createdAt);
  }
}

function refreshFacilityLiquidity(world, now) {
  for (const type of FACILITY_TYPE_CATALOG) {
    const market = facilityMarketFor(world, type.id, now);
    const openBuy = facilityOrders(world, type.id).filter((order) => (
      order.ownerType === 'market' && order.side === 'buy' && isOpenOrder(order)
    ));
    const openSell = facilityOrders(world, type.id).filter((order) => (
      order.ownerType === 'market' && order.side === 'sell' && isOpenOrder(order)
    ));
    if (openBuy.length < 1) {
      const order = {
        id: `facility-market-buy-${type.id}-${crypto.randomUUID()}`,
        assetKind: 'facility',
        assetId: type.id,
        facilityTypeId: type.id,
        side: 'buy',
        ownerType: 'market',
        ownerName: '系统资产采购',
        price: Math.max(1, Math.floor(market.lastPrice * 0.9)),
        quantity: 3,
        remaining: 3,
        status: 'open',
        createdAt: now,
      };
      world.orders.push(order);
      matchFacilityOrder(world, order, now);
    }
    if (openSell.length < 1) {
      const order = {
        id: `facility-market-sell-${type.id}-${crypto.randomUUID()}`,
        assetKind: 'facility',
        assetId: type.id,
        facilityTypeId: type.id,
        side: 'sell',
        ownerType: 'market',
        ownerName: '系统资产供给',
        price: Math.max(1, Math.ceil(market.lastPrice * 1.1)),
        quantity: 2,
        remaining: 2,
        status: 'open',
        createdAt: now,
      };
      world.orders.push(order);
      matchFacilityOrder(world, order, now);
    }
  }
}

export function processFacilityGroupWorld(world, now = Date.now()) {
  migrateFacilityGroupWorld(world, now);
  withLegacyFacilitiesSuppressed(world, () => processWorld(world, now));
  migrateFacilityGroupWorld(world, now);
  for (const player of Object.values(world.players || {})) {
    ensureWarehouse(player);
    finishConstruction(player, now);
    for (const group of player.facilityGroups || []) processGroup(world, player, group, now);
  }
  refreshFacilityLiquidity(world, now);
  stripLegacyFacilityInstances(world);
  world.lastProcessedAt = now;
  return world;
}

function getPlayer(world, userId) {
  const player = world.players[String(userId)];
  if (!player) throw new Error(`Missing player ${userId}`);
  return player;
}

function buildFacilityGroup(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  if (!type) return result(false, '工厂类型不存在');
  if (player.facilityConstruction) return result(false, '同时只能施工一座工厂');
  if (player.credits < type.buildCost) return result(false, '建造资金不足');
  player.credits -= type.buildCost;
  player.stats.systemSinks += type.buildCost;
  player.facilityConstruction = {
    facilityTypeId: type.id,
    startedAt: now,
    completesAt: now + type.buildTimeMs,
  };
  return result(true, `${type.name}开始施工，建成后将在下一生产周期加入同类工厂集群`);
}

function startFacilityGroup(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id) : null;
  if (!type || !group || group.count < 1) return result(false, '工厂集群不存在');
  if (group.status === 'running') return result(false, '工厂集群已经运行');
  const availableCount = Math.max(0, group.count - listedQuantity(world, userId, type.id));
  if (availableCount < 1) return result(false, '没有未冻结工厂可启动');
  const blocked = blockReason(world, player, group, type, availableCount);
  if (blocked) {
    group.status = blocked.status;
    group.stopReason = blocked.reason;
    return result(false, blocked.message);
  }
  group.status = 'running';
  group.stopReason = undefined;
  group.participatingCount = availableCount;
  group.pendingJoinCount = 0;
  group.cycleStartedAt = now;
  return result(true, `${type.name}集群已启动，${availableCount} 座未冻结工厂参与生产`);
}

function pauseFacilityGroup(world, userId, payload) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id) : null;
  if (!group) return result(false, '工厂集群不存在');
  if (group.status !== 'running') return result(false, '工厂集群当前未运行');
  stopGroup(group, 'paused', 'manual');
  return result(true, `${type.name}集群已统一停止`);
}

function setGroupPlan(world, userId, payload) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id) : null;
  if (!group) return result(false, '工厂集群不存在');
  if (group.status === 'running') return result(false, '请先停止工厂集群再修改生产计划');
  const availableCount = Math.max(0, group.count - listedQuantity(world, userId, type.id));
  if (availableCount < 1) return result(false, '没有未冻结工厂可设置生产计划');
  const mode = payload.mode === 'target' ? 'target' : payload.mode === 'continuous' ? 'continuous' : null;
  if (!mode) return result(false, '生产模式无效');
  group.completedQuantity = 0;
  group.stopReason = 'manual';
  if (mode === 'continuous') {
    group.productionMode = 'continuous';
    delete group.targetQuantity;
    if (group.status !== 'ready') group.status = 'paused';
    return result(true, `${type.name}集群已设置为持续生产`);
  }
  const targetQuantity = normalizePositiveInteger(payload.targetQuantity, 10_000_000);
  const cycleOutput = type.output.quantity * availableCount;
  if (!targetQuantity || targetQuantity % cycleOutput !== 0) {
    return result(false, `计划产量必须是集群周期产量 ${cycleOutput} 的整数倍`);
  }
  group.productionMode = 'target';
  group.targetQuantity = targetQuantity;
  if (group.status !== 'ready') group.status = 'paused';
  return result(true, `${type.name}集群已设置定量计划：${targetQuantity}`);
}

function reduceRunningGroupForSellOrder(group, type, quantity) {
  if (group.status !== 'running') return;
  let remaining = quantity;
  const activeReduction = Math.min(group.participatingCount, remaining);
  group.participatingCount -= activeReduction;
  remaining -= activeReduction;
  if (remaining > 0) {
    const pendingReduction = Math.min(group.pendingJoinCount, remaining);
    group.pendingJoinCount -= pendingReduction;
  }
  if (group.participatingCount < 1) {
    stopGroup(group, 'paused', 'listed');
    return;
  }
  if (group.productionMode === 'target') {
    const cycleOutput = type.output.quantity * group.participatingCount;
    const remainingTarget = Math.max(0, Number(group.targetQuantity || 0) - group.completedQuantity);
    if (remainingTarget < cycleOutput || remainingTarget % cycleOutput !== 0) {
      stopGroup(group, 'paused', 'plan_adjustment_required');
    }
  }
}

function placeFacilityOrder(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const side = payload.side === 'buy' ? 'buy' : payload.side === 'sell' ? 'sell' : null;
  const typeId = String(payload.assetId || payload.facilityTypeId || '');
  const type = typeFor(typeId);
  const quantity = normalizePositiveInteger(payload.quantity, MAX_FACILITY_ORDER_QUANTITY);
  const price = normalizePositiveInteger(payload.price ?? payload.unitPrice, MAX_ORDER_PRICE);
  if (!side || !type || !quantity || !price) return result(false, '工厂订单参数无效');
  const openOrders = (world.orders || []).filter((order) => Number(order.ownerId) === userId && isOpenOrder(order));
  if (openOrders.length >= MAX_OPEN_ORDERS) return result(false, '未完成订单数量已达上限');
  if (price < Math.ceil(type.systemValue * 0.5) || price > type.systemValue * 2) {
    return result(false, '工厂订单价格必须在系统参考价的 50%～200% 之间');
  }

  if (side === 'buy') {
    const total = quantity * price;
    if (player.credits < total) return result(false, '可用资金不足');
    player.credits -= total;
    player.frozenCredits += total;
  } else {
    const group = groupFor(player, type.id);
    const available = group ? Math.max(0, group.count - listedQuantity(world, userId, type.id)) : 0;
    if (!group || quantity > available) return result(false, '可出售工厂数量不足');
    reduceRunningGroupForSellOrder(group, type, quantity);
  }

  const order = {
    id: `facility-order-${crypto.randomUUID()}`,
    assetKind: 'facility',
    assetId: type.id,
    facilityTypeId: type.id,
    side,
    ownerType: 'player',
    ownerId: userId,
    ownerName: player.playerName,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt: now,
  };
  world.orders.push(order);
  matchFacilityOrder(world, order, now);
  return result(true, order.status === 'filled' ? '工厂订单已全部成交' : order.status === 'partial' ? '工厂订单已部分成交' : '工厂订单已进入订单簿');
}

function cancelFacilityOrder(world, userId, order) {
  const player = getPlayer(world, userId);
  if (order.side === 'buy') {
    const release = order.remaining * order.price;
    player.frozenCredits -= release;
    player.credits += release;
  } else {
    const group = groupFor(player, orderAssetId(order));
    if (group?.status === 'running') group.pendingJoinCount += order.remaining;
    else if (group && group.stopReason === 'listed') {
      group.status = group.count === 1 ? 'ready' : 'paused';
      group.stopReason = 'manual';
    }
  }
  order.status = 'cancelled';
  return result(true, '订单已撤销，冻结资产已释放');
}

function renameFacilityOrders(world, userId) {
  const player = getPlayer(world, userId);
  for (const order of world.orders || []) if (order.ownerId === userId) order.ownerName = player.playerName;
}

function resetFacilityGroups(world, userId) {
  const player = getPlayer(world, userId);
  player.facilityGroups = [];
  delete player.facilityConstruction;
  delete player.facilities;
}

export function applyFacilityGroupAction(world, user, action, payload = {}, now = Date.now()) {
  processFacilityGroupWorld(world, now);
  const userId = Number(user.id);
  if (action === 'buildFacility') return buildFacilityGroup(world, userId, payload, now);
  if (action === 'startFacility') return startFacilityGroup(world, userId, payload, now);
  if (action === 'pauseFacility') return pauseFacilityGroup(world, userId, payload);
  if (action === 'setProductionPlan') return setGroupPlan(world, userId, payload);
  if (action === 'placeOrder' && payload.assetKind === 'facility') return placeFacilityOrder(world, userId, payload, now);
  if (action === 'listFacility') return placeFacilityOrder(world, userId, {
    assetKind: 'facility',
    assetId: payload.facilityTypeId,
    side: 'sell',
    quantity: payload.quantity,
    price: payload.unitPrice ?? payload.price,
  }, now);
  if (action === 'cancelOrder') {
    const order = (world.orders || []).find((item) => item.id === payload.orderId && item.ownerId === userId && isOpenOrder(item));
    if (order && orderKind(order) === 'facility') return cancelFacilityOrder(world, userId, order);
  }
  if (action === 'cancelFacilityListing') {
    const order = (world.orders || []).find((item) => item.id === payload.listingId && item.ownerId === userId && isOpenOrder(item));
    if (order && orderKind(order) === 'facility') return cancelFacilityOrder(world, userId, order);
    return result(false, '工厂卖单不存在');
  }
  if (action === 'buyFacility') {
    const listing = (world.orders || []).find((item) => item.id === payload.listingId && isOpenOrder(item) && orderKind(item) === 'facility' && item.side === 'sell');
    if (!listing) return result(false, '工厂卖单不存在');
    return placeFacilityOrder(world, userId, {
      assetKind: 'facility', assetId: orderAssetId(listing), side: 'buy',
      quantity: payload.quantity || 1, price: listing.price,
    }, now);
  }

  const actionResult = withLegacyFacilitiesSuppressed(world, () => applyAction(world, user, action, payload, now));
  migrateFacilityGroupWorld(world, now);
  if (action === 'renamePlayer' && actionResult.ok) renameFacilityOrders(world, userId);
  if (action === 'resetPlayer' && actionResult.ok) resetFacilityGroups(world, userId);
  stripLegacyFacilityInstances(world);
  return actionResult;
}

function bestBidFor(world, kind, assetId, excludedUserId) {
  return (world.orders || [])
    .filter((order) => (
      orderKind(order) === kind
      && orderAssetId(order) === assetId
      && order.side === 'buy'
      && isOpenOrder(order)
      && Number(order.ownerId) !== Number(excludedUserId)
    ))
    .reduce((best, order) => Math.max(best, Number(order.price || 0)), 0);
}

function assetSummaryFor(world, player) {
  const commodityValue = PRODUCT_CATALOG.reduce((sum, product) => {
    const inventory = inventoryFor(player, product.id);
    const price = bestBidFor(world, 'commodity', product.id, player.userId);
    return sum + (inventory.available + inventory.frozen) * price;
  }, 0);
  const facilityValue = (player.facilityGroups || []).reduce((sum, group) => (
    sum + group.count * bestBidFor(world, 'facility', group.facilityTypeId, player.userId)
  ), 0);
  const cashValue = player.credits + player.frozenCredits;
  return { cashValue, commodityValue, facilityValue, totalAssets: cashValue + commodityValue + facilityValue };
}

function valuationPricesFor(world, player) {
  return {
    ...Object.fromEntries(PRODUCT_CATALOG.map((product) => [
      `commodity:${product.id}`,
      bestBidFor(world, 'commodity', product.id, player.userId),
    ])),
    ...Object.fromEntries(FACILITY_TYPE_CATALOG.map((type) => [
      `facility:${type.id}`,
      bestBidFor(world, 'facility', type.id, player.userId),
    ])),
  };
}

function createLeaderboard(world, currentUserId, now) {
  return Object.values(world.players || {})
    .map((player) => {
      const summary = assetSummaryFor(world, player);
      return {
        playerName: player.playerName,
        totalAssets: summary.totalAssets,
        cashAssets: summary.cashValue,
        facilityCount: (player.facilityGroups || []).reduce((sum, group) => sum + group.count, 0),
        weeklyChange: Number(player.stats.workIssued || 0) + Number(player.stats.populationIssued || 0) + Number(player.stats.giftIssued || 0) - Number(player.stats.systemSinks || 0),
        updatedAt: now,
        isCurrentPlayer: player.userId === currentUserId,
      };
    })
    .sort((left, right) => right.totalAssets - left.totalAssets || left.playerName.localeCompare(right.playerName))
    .slice(0, 100)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

function clientGroup(world, player, group) {
  const listedCount = listedQuantity(world, player.userId, group.facilityTypeId);
  const availableCount = Math.max(0, group.count - listedCount);
  return {
    ...clone(group),
    listedCount,
    availableCount,
    nextCycleCount: group.status === 'running'
      ? group.participatingCount + group.pendingJoinCount
      : availableCount,
  };
}

export function createFacilityGroupClientState(world, userId, now = Date.now()) {
  migrateFacilityGroupWorld(world, now);
  const base = withLegacyFacilitiesSuppressed(world, () => createClientState(world, userId, now));
  const player = getPlayer(world, userId);
  const { facilities: _legacyFacilities, ...withoutFacilities } = base;
  const normalizedOrders = (world.orders || []).map((order) => clone(normalizeOrder(order)));
  return {
    ...withoutFacilities,
    version: 9,
    facilityGroups: (player.facilityGroups || []).map((group) => clientGroup(world, player, group)),
    facilityConstruction: player.facilityConstruction ? clone(player.facilityConstruction) : undefined,
    facilityTypes: FACILITY_TYPE_CATALOG.map(({ internalCapacity: _internalCapacity, ...type }) => clone(type)),
    orders: normalizedOrders,
    facilityListings: [],
    facilityMarkets: clone(world.facilityMarkets || {}),
    valuationPrices: valuationPricesFor(world, player),
    assetSummary: assetSummaryFor(world, player),
    leaderboard: createLeaderboard(world, userId, now),
  };
}
