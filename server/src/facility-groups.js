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

function recipesFor(type) {
  if (Array.isArray(type?.recipes) && type.recipes.length > 0) return type.recipes;
  return type ? [{
    id: `${type.id}-default`,
    name: type.name,
    cycleMs: type.cycleMs,
    operatingCost: type.operatingCost,
    inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
    output: type.output,
  }] : [];
}

function recipeFor(type, recipeId) {
  const recipes = recipesFor(type);
  return recipes.find((recipe) => recipe.id === recipeId)
    || recipes.find((recipe) => recipe.id === type?.defaultRecipeId)
    || recipes[0];
}

function activeRecipeFor(type, group) {
  return recipeFor(type, group?.activeRecipeId);
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
    : String(order.assetId || order.productId || 'wheat');
}

function normalizeOrder(order) {
  const kind = orderKind(order);
  const assetId = orderAssetId(order);
  order.assetKind = kind;
  order.assetId = assetId;
  if (kind === 'facility') order.facilityTypeId = assetId;
  else order.productId = assetId;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
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

function normalizeStatusReason(value, enabled) {
  const raw = String(value || '');
  const mapped = raw === 'output_full' ? 'warehouse_full' : raw === 'listed' ? 'no_available_facility' : raw;
  const allowed = new Set([
    'manual', 'insufficient_funds',
    'insufficient_input', 'warehouse_full', 'no_available_facility', 'maintenance',
  ]);
  if (!allowed.has(mapped)) return enabled ? undefined : 'manual';
  if (!enabled && mapped !== 'manual') return 'manual';
  return mapped;
}

function createGroup(typeId, overrides = {}) {
  const type = typeFor(typeId);
  const legacyStatus = String(overrides.status || 'stopped');
  const legacyPlanComplete = legacyStatus === 'plan_complete' || overrides.statusReason === 'plan_complete';
  const enabled = legacyPlanComplete
    ? false
    : typeof overrides.enabled === 'boolean'
    ? overrides.enabled
    : legacyStatus === 'running' || legacyStatus === 'error'
      || ['full', 'insufficient_funds', 'insufficient_input'].includes(legacyStatus);
  const status = legacyStatus === 'running'
    ? 'running'
    : enabled
      ? 'error'
      : 'stopped';
  return {
    facilityTypeId: typeId,
    count: Math.max(0, Number(overrides.count || 0)),
    participatingCount: Math.max(0, Number(overrides.participatingCount || 0)),
    pendingJoinCount: Math.max(0, Number(overrides.pendingJoinCount || 0)),
    enabled,
    status,
    statusReason: normalizeStatusReason(overrides.statusReason || overrides.stopReason, enabled),
    cycleStartedAt: overrides.cycleStartedAt,
    lifetimeOutput: Math.max(0, Number(overrides.lifetimeOutput ?? overrides.completedQuantity ?? 0)),
    activeRecipeId: recipeFor(type, overrides.activeRecipeId)?.id,
    pendingRecipeId: recipesFor(type).some((recipe) => recipe.id === overrides.pendingRecipeId)
      ? overrides.pendingRecipeId
      : undefined,
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
  if (!normalized.enabled || normalized.status !== 'running') {
    normalized.participatingCount = 0;
    normalized.pendingJoinCount = 0;
    delete normalized.cycleStartedAt;
    normalized.status = normalized.enabled ? 'error' : 'stopped';
  }
  delete normalized.stopReason;
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

function recordFacilityPrice(world, typeId, price, quantity, takerSide, createdAt) {
  const market = facilityMarketFor(world, typeId, createdAt);
  if (!market) return;
  market.lastPrice = price;
  market.priceHistory.push({ price, quantity, createdAt, takerSide });
  market.priceHistory = market.priceHistory.slice(-MAX_PRICE_POINTS);
}

function migrateLegacyListings(world) {
  world.orders ||= [];
  for (const order of world.orders) normalizeOrder(order);
  const legacyListings = Array.isArray(world.facilityListings) ? world.facilityListings : [];
  for (const listing of legacyListings) {
    const typeId = String(listing.facilityTypeId || listing.facility?.facilityTypeId || 'farm');
    const type = typeFor(typeId);
    if (!type || listing.ownerType !== 'player' || world.orders.some((order) => order.id === listing.id)) continue;
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

export function removeSystemFacilityOrders(world) {
  world.orders = (world.orders || []).filter((order) => !(
    orderKind(order) === 'facility' && order.ownerType === 'market'
  ));
  return world;
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
      existing.count = facilities.length;
      existing.enabled = allRunning;
      existing.status = allRunning ? 'running' : 'stopped';
      existing.statusReason = allRunning ? undefined : 'manual';
      existing.participatingCount = allRunning ? facilities.length : 0;
      existing.pendingJoinCount = 0;
      existing.cycleStartedAt = allRunning ? now : undefined;
      existing.activeRecipeId = recipeFor(type)?.id;
    }
  }

  player.facilityGroups = player.facilityGroups.map(normalizeGroup).filter(Boolean);
  delete player.facilities;
}

export function migrateFacilityGroupWorld(world, now = Date.now()) {
  world.players ||= {};
  world.orders ||= [];
  migrateLegacyListings(world);
  removeSystemFacilityOrders(world);
  world.facilityMarkets ||= {};
  for (const type of FACILITY_TYPE_CATALOG) facilityMarketFor(world, type.id, now);
  for (const player of Object.values(world.players)) migrateLegacyPlayer(player, now);

  for (const player of Object.values(world.players)) {
    player.facilityGroups = (player.facilityGroups || []).map(normalizeGroup).filter(Boolean);
    for (const group of player.facilityGroups) {
      const listed = listedQuantity(world, player.userId, group.facilityTypeId);
      const available = Math.max(0, group.count - listed);
      if (group.status === 'running') {
        group.participatingCount = Math.min(group.participatingCount, available);
        group.pendingJoinCount = Math.min(
          group.pendingJoinCount,
          Math.max(0, available - group.participatingCount),
        );
        if (group.participatingCount < 1) setGroupError(group, 'no_available_facility');
      }
      reconcileFacilityGroup(world, player, group, now);
    }
  }

  world.version = 12;
  return world;
}

export function stripLegacyFacilityInstances(world) {
  for (const player of Object.values(world.players || {})) delete player.facilities;
  world.facilityListings = [];
  world.version = 12;
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

function clearGroupRuntime(group) {
  group.participatingCount = 0;
  group.pendingJoinCount = 0;
  delete group.cycleStartedAt;
}

function setGroupStopped(group, reason = 'manual') {
  group.enabled = false;
  group.status = 'stopped';
  group.statusReason = reason;
  clearGroupRuntime(group);
}

function setGroupError(group, reason) {
  group.enabled = true;
  group.status = 'error';
  group.statusReason = reason;
  clearGroupRuntime(group);
}

function startGroupRuntime(group, count, now) {
  group.enabled = true;
  group.status = 'running';
  delete group.statusReason;
  group.participatingCount = count;
  group.pendingJoinCount = 0;
  group.cycleStartedAt = now;
}

function recipeInputs(recipe) {
  const items = Array.isArray(recipe?.inputs) ? recipe.inputs : recipe?.input ? [recipe.input] : [];
  const quantities = new Map();
  for (const item of items) {
    const productId = String(item?.productId || '');
    const quantity = Math.max(0, Number(item?.quantity || 0));
    if (!productId || quantity <= 0) continue;
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

function groupRequirements(recipe, count) {
  const participating = Math.max(0, Number(count || 0));
  const inputs = recipeInputs(recipe).map((item) => ({
    productId: item.productId,
    quantity: item.quantity * participating,
  }));
  const output = recipe.output.quantity * participating;
  const inputTotal = inputs.reduce((sum, item) => sum + item.quantity, 0);
  return {
    output,
    inputs,
    inputTotal,
    cost: recipe.operatingCost * participating,
    netStorage: Math.max(0, output - inputTotal),
  };
}

function blockReason(world, player, group, type, count) {
  const recipe = activeRecipeFor(type, group);
  const requirements = groupRequirements(recipe, count);
  if (count <= 0) return { reason: 'no_available_facility', message: '没有可参与生产的工厂' };
  if (requirements.netStorage > createWarehouseUsage(world, player).warehouseAvailableCapacity) {
    return { reason: 'warehouse_full', message: '共享仓库空间不足' };
  }
  if (requirements.cost > player.credits) {
    return { reason: 'insufficient_funds', message: '运营资金不足' };
  }
  if (requirements.inputs.some((item) => inventoryFor(player, item.productId).available < item.quantity)) {
    return { reason: 'insufficient_input', message: '生产原料不足' };
  }
  return null;
}

function applyPendingRecipe(group) {
  if (!group.pendingRecipeId) return false;
  group.activeRecipeId = group.pendingRecipeId;
  delete group.pendingRecipeId;
  return true;
}

function availableGroupCount(world, player, group) {
  return Math.max(0, group.count - listedQuantity(world, player.userId, group.facilityTypeId));
}

function reconcileFacilityGroup(world, player, group, now) {
  const type = typeFor(group.facilityTypeId);
  if (!type) return;

  if (!group.enabled) {
    setGroupStopped(group, 'manual');
    return;
  }

  if (group.status !== 'running') applyPendingRecipe(group);

  const available = availableGroupCount(world, player, group);
  if (group.status === 'running') {
    group.participatingCount = Math.min(group.participatingCount, available);
    group.pendingJoinCount = Math.min(
      group.pendingJoinCount,
      Math.max(0, available - group.participatingCount),
    );
    if (group.participatingCount < 1) {
      setGroupError(group, 'no_available_facility');
      return;
    }
    const blocked = blockReason(world, player, group, type, group.participatingCount);
    if (!blocked) return;
    setGroupError(group, blocked.reason);
    return;
  }

  const blocked = blockReason(world, player, group, type, available);
  if (!blocked) {
    startGroupRuntime(group, available, now);
    return;
  }
  setGroupError(group, blocked.reason);
}

function executeCycle(player, group, type, count) {
  const recipe = activeRecipeFor(type, group);
  const requirements = groupRequirements(recipe, count);
  player.credits -= requirements.cost;
  player.stats.systemSinks += requirements.cost;
  player.stats.producedGoods = Number(player.stats.producedGoods || 0) + requirements.output;
  for (const item of requirements.inputs) inventoryFor(player, item.productId).available -= item.quantity;
  inventoryFor(player, recipe.output.productId).available += requirements.output;
  group.lifetimeOutput += requirements.output;
  group.cycleStartedAt += recipe.cycleMs;
}

function finishConstruction(player, now) {
  const construction = player.facilityConstruction;
  if (!construction || now < construction.completesAt) return;
  const group = groupFor(player, construction.facilityTypeId, true);
  group.count += 1;
  if (group.status === 'running') group.pendingJoinCount += 1;
  delete player.facilityConstruction;
}

function processGroup(world, player, group, now) {
  reconcileFacilityGroup(world, player, group, now);
  const type = typeFor(group.facilityTypeId);
  if (!type || group.status !== 'running' || !group.cycleStartedAt) return;

  let processed = 0;
  while (processed < MAX_CYCLES_PER_GROUP && group.status === 'running') {
    const recipe = activeRecipeFor(type, group);
    if (now - group.cycleStartedAt < recipe.cycleMs) break;
    const blocked = blockReason(world, player, group, type, group.participatingCount);
    if (blocked) {
      setGroupError(group, blocked.reason);
      break;
    }

    executeCycle(player, group, type, group.participatingCount);
    processed += 1;

    if (group.pendingJoinCount > 0) {
      group.participatingCount += group.pendingJoinCount;
      group.pendingJoinCount = 0;
    }

    applyPendingRecipe(group);

    const nextBlocked = blockReason(world, player, group, type, group.participatingCount);
    if (nextBlocked) {
      setGroupError(group, nextBlocked.reason);
      break;
    }
  }
}

function reconcileAllFacilityGroups(world, now) {
  for (const player of Object.values(world.players || {})) {
    ensureWarehouse(player);
    for (const group of player.facilityGroups || []) reconcileFacilityGroup(world, player, group, now);
  }
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

function appendPlayerOrderFill(order, fill) {
  if (order.ownerType !== 'player') return;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  order.fills.push(fill);
  order.fills = order.fills.slice(-120);
}

function addPurchasedGroup(player, typeId, quantity) {
  const group = groupFor(player, typeId, true);
  group.count += quantity;
  if (group.status === 'running') group.pendingJoinCount += quantity;
  return group;
}

function executeFacilityTrade(world, incoming, resting, quantity, createdAt) {
  const buy = incoming.side === 'buy' ? incoming : resting;
  const sell = incoming.side === 'sell' ? incoming : resting;
  const typeId = orderAssetId(incoming);
  const price = resting.price;
  const fillId = `facility-order-fill-${crypto.randomUUID()}`;
  const fillBase = {
    id: fillId,
    quantity,
    price,
    total: quantity * price,
    createdAt,
    makerOrderId: resting.id,
    takerOrderId: incoming.id,
  };

  incoming.remaining -= quantity;
  resting.remaining -= quantity;
  incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
  resting.status = resting.remaining === 0 ? 'filled' : 'partial';
  appendPlayerOrderFill(buy, {
    ...fillBase,
    counterparty: describeCounterparty(sell),
    liquidity: buy.id === resting.id ? 'maker' : 'taker',
  });
  appendPlayerOrderFill(sell, {
    ...fillBase,
    counterparty: describeCounterparty(buy),
    liquidity: sell.id === resting.id ? 'maker' : 'taker',
  });

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

  recordFacilityPrice(world, typeId, price, quantity, incoming.side, createdAt);
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

export function processFacilityGroupWorld(world, now = Date.now()) {
  removeSystemFacilityOrders(world);
  migrateFacilityGroupWorld(world, now);
  withLegacyFacilitiesSuppressed(world, () => processWorld(world, now));
  migrateFacilityGroupWorld(world, now);
  removeSystemFacilityOrders(world);
  for (const player of Object.values(world.players || {})) {
    ensureWarehouse(player);
    finishConstruction(player, now);
    for (const group of player.facilityGroups || []) processGroup(world, player, group, now);
  }
  reconcileAllFacilityGroups(world, now);
  stripLegacyFacilityInstances(world);
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
  group.enabled = true;
  reconcileFacilityGroup(world, player, group, now);
  if (group.status === 'running') {
    return result(true, `${type.name}已开启生产，${group.participatingCount} 座未冻结工厂参与当前周期`);
  }
  const reason = blockReason(world, player, group, type, availableGroupCount(world, player, group));
  return result(true, `${type.name}已开启自动运行，当前${reason?.message || '等待条件恢复'}，条件满足后将自动恢复生产`);
}

function pauseFacilityGroup(world, userId, payload) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id) : null;
  if (!group) return result(false, '工厂集群不存在');
  applyPendingRecipe(group);
  setGroupStopped(group, 'manual');
  return result(true, `${type.name}已停止生产并关闭自动恢复`);
}

function setGroupRecipe(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id) : null;
  if (!group) return result(false, '工厂集群不存在');
  const recipes = recipesFor(type);
  const recipe = recipes.find((candidate) => candidate.id === payload.recipeId);
  if (!recipe) return result(false, '生产配方不存在');
  if (recipes.length < 2) {
    group.activeRecipeId = recipe.id;
    delete group.pendingRecipeId;
    reconcileFacilityGroup(world, player, group, now);
    return result(true, `${type.name}使用固定生产配方`);
  }

  if (group.status === 'running') {
    if (group.activeRecipeId === recipe.id) {
      if (group.pendingRecipeId) {
        delete group.pendingRecipeId;
        return result(true, `${type.name}已取消下一周期配方切换，继续使用${recipe.name}`);
      }
      return result(true, `${type.name}已经使用${recipe.name}`);
    }
    group.pendingRecipeId = recipe.id;
    return result(true, `${type.name}将在下一周期切换为${recipe.name}`);
  }

  group.activeRecipeId = recipe.id;
  delete group.pendingRecipeId;
  reconcileFacilityGroup(world, player, group, now);
  return result(true, group.enabled
    ? `${type.name}已改为${recipe.name}，并重新检查自动运行条件`
    : `${type.name}已改为${recipe.name}`);
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
    setGroupError(group, 'no_available_facility');
    return;
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
  let actionResult;

  if (action === 'buildFacility') actionResult = buildFacilityGroup(world, userId, payload, now);
  else if (action === 'startFacility') actionResult = startFacilityGroup(world, userId, payload, now);
  else if (action === 'pauseFacility') actionResult = pauseFacilityGroup(world, userId, payload);
  else if (action === 'setFacilityRecipe') actionResult = setGroupRecipe(world, userId, payload, now);
  else if (action === 'placeOrder' && payload.assetKind === 'facility') actionResult = placeFacilityOrder(world, userId, payload, now);
  else if (action === 'listFacility') actionResult = placeFacilityOrder(world, userId, {
    assetKind: 'facility',
    assetId: payload.facilityTypeId,
    side: 'sell',
    quantity: payload.quantity,
    price: payload.unitPrice ?? payload.price,
  }, now);
  else if (action === 'cancelOrder') {
    const order = (world.orders || []).find((item) => item.id === payload.orderId && item.ownerId === userId && isOpenOrder(item));
    actionResult = order && orderKind(order) === 'facility'
      ? cancelFacilityOrder(world, userId, order)
      : withLegacyFacilitiesSuppressed(world, () => applyAction(world, user, action, payload, now));
  } else if (action === 'cancelFacilityListing') {
    const order = (world.orders || []).find((item) => item.id === payload.listingId && item.ownerId === userId && isOpenOrder(item));
    actionResult = order && orderKind(order) === 'facility'
      ? cancelFacilityOrder(world, userId, order)
      : result(false, '工厂卖单不存在');
  } else if (action === 'buyFacility') {
    const listing = (world.orders || []).find((item) => item.id === payload.listingId && isOpenOrder(item) && orderKind(item) === 'facility' && item.side === 'sell');
    actionResult = listing
      ? placeFacilityOrder(world, userId, {
        assetKind: 'facility', assetId: orderAssetId(listing), side: 'buy',
        quantity: payload.quantity || 1, price: listing.price,
      }, now)
      : result(false, '工厂卖单不存在');
  } else {
    actionResult = withLegacyFacilitiesSuppressed(world, () => applyAction(world, user, action, payload, now));
  }

  migrateFacilityGroupWorld(world, now);
  if (action === 'renamePlayer' && actionResult.ok) renameFacilityOrders(world, userId);
  if (action === 'resetPlayer' && actionResult.ok) resetFacilityGroups(world, userId);
  reconcileAllFacilityGroups(world, now);
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
    version: 14,
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
