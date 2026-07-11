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

function listingsFor(world, ownerId, typeId) {
  return (world.facilityListings || []).filter((listing) => (
    listing.ownerId === ownerId && listing.facilityTypeId === typeId
  ));
}

function listedQuantity(world, ownerId, typeId) {
  return listingsFor(world, ownerId, typeId).reduce(
    (sum, listing) => sum + Math.max(0, Number(listing.quantity || 0)),
    0,
  );
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

function migrateLegacyListings(world) {
  world.facilityListings ||= [];
  const migrated = [];
  for (const listing of world.facilityListings) {
    const facilityTypeId = listing.facilityTypeId || listing.facility?.facilityTypeId || 'farm';
    const type = typeFor(facilityTypeId);
    if (!type) continue;
    migrated.push({
      id: String(listing.id || `facility-listing-${facilityTypeId}-${migrated.length}`),
      facilityTypeId: type.id,
      ownerType: listing.ownerType === 'player' ? 'player' : 'market',
      ownerId: listing.ownerId,
      ownerName: String(listing.ownerName || '系统资产市场'),
      quantity: Math.max(1, Math.floor(Number(listing.quantity || 1))),
      unitPrice: Math.max(1, Math.floor(Number(listing.unitPrice || listing.price || type.systemValue))),
      createdAt: Number(listing.createdAt || Date.now()),
    });
  }
  world.facilityListings = migrated;
}

function migrateLegacyPlayer(player, world, now) {
  ensureWarehouse(player);
  player.facilityGroups ||= [];

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
  migrateLegacyListings(world);
  for (const player of Object.values(world.players)) migrateLegacyPlayer(player, world, now);

  for (const player of Object.values(world.players)) {
    for (const group of player.facilityGroups || []) {
      const listed = listedQuantity(world, player.userId, group.facilityTypeId);
      if (listed > 0 && group.status !== 'running') {
        group.status = 'listed';
        group.stopReason = 'listed';
      } else if (listed === 0 && group.status === 'listed') {
        group.status = 'paused';
        group.stopReason = 'manual';
      }
    }
  }

  world.version = 4;
  return world;
}

export function stripLegacyFacilityInstances(world) {
  for (const player of Object.values(world.players || {})) delete player.facilities;
  for (const listing of world.facilityListings || []) {
    delete listing.facility;
    delete listing.facilityId;
    delete listing.price;
  }
  world.version = 4;
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
    world.facilityListings = listings;
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
  if (group.status === 'running') {
    group.pendingJoinCount += 1;
  } else if (group.status !== 'listed') {
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
    const cycles = maxExecutableCycles(
      world,
      player,
      group,
      type,
      group.participatingCount,
      elapsedCycles,
    );
    executeCycles(player, group, type, group.participatingCount, cycles);
    elapsedCycles -= cycles;
  }

  if (group.productionMode === 'target' && group.completedQuantity >= group.targetQuantity) {
    stopGroup(group, 'paused', 'plan_complete');
    return;
  }

  const blocked = blockReason(world, player, group, type, group.participatingCount);
  if (elapsedCycles > 0 || blocked) {
    stopGroup(group, blocked?.status || 'paused', blocked?.reason || 'maintenance');
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
  if (listedQuantity(world, userId, type.id) > 0) return result(false, '存在挂牌数量时不能启动该工厂集群');
  if (group.status === 'running') return result(false, '工厂集群已经运行');
  const blocked = blockReason(world, player, group, type, group.count);
  if (blocked) {
    group.status = blocked.status;
    group.stopReason = blocked.reason;
    return result(false, blocked.message);
  }
  group.status = 'running';
  group.stopReason = undefined;
  group.participatingCount = group.count;
  group.pendingJoinCount = 0;
  group.cycleStartedAt = now;
  return result(true, `${type.name}集群已统一启动，共 ${group.count} 座参与生产`);
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
  if (listedQuantity(world, userId, type.id) > 0) return result(false, '存在挂牌数量时不能修改生产计划');
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
  const cycleOutput = type.output.quantity * group.count;
  if (!targetQuantity || targetQuantity % cycleOutput !== 0) {
    return result(false, `计划产量必须是集群周期产量 ${cycleOutput} 的整数倍`);
  }
  group.productionMode = 'target';
  group.targetQuantity = targetQuantity;
  if (group.status !== 'ready') group.status = 'paused';
  return result(true, `${type.name}集群已设置定量计划：${targetQuantity}`);
}

function listFacilityGroup(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id) : null;
  const quantity = normalizePositiveInteger(payload.quantity, 1_000_000);
  const unitPrice = normalizePositiveInteger(payload.unitPrice ?? payload.price, 1_000_000);
  if (!type || !group) return result(false, '工厂集群不存在');
  if (group.status === 'running') return result(false, '请先统一停止该工厂集群');
  if (!quantity || quantity > group.count - listedQuantity(world, userId, type.id)) {
    return result(false, '可挂牌工厂数量不足');
  }
  if (!unitPrice || unitPrice < type.systemValue * 0.5 || unitPrice > type.systemValue * 2) {
    return result(false, '单座挂牌价必须在系统估值的 50%～200% 之间');
  }

  const existing = world.facilityListings.find((listing) => (
    listing.ownerId === userId
    && listing.facilityTypeId === type.id
    && listing.unitPrice === unitPrice
  ));
  if (existing) existing.quantity += quantity;
  else {
    world.facilityListings.push({
      id: `facility-listing-${crypto.randomUUID()}`,
      facilityTypeId: type.id,
      ownerType: 'player',
      ownerId: userId,
      ownerName: player.playerName,
      quantity,
      unitPrice,
      createdAt: now,
    });
  }
  group.status = 'listed';
  group.stopReason = 'listed';
  group.participatingCount = 0;
  group.pendingJoinCount = 0;
  delete group.cycleStartedAt;
  return result(true, `${quantity} 座${type.name}已按单价 ¤${unitPrice} 挂牌`);
}

function cancelGroupListing(world, userId, payload) {
  const listing = world.facilityListings.find((item) => item.id === payload.listingId && item.ownerId === userId);
  if (!listing) return result(false, '工厂挂牌不存在');
  world.facilityListings = world.facilityListings.filter((item) => item.id !== listing.id);
  const player = getPlayer(world, userId);
  const group = groupFor(player, listing.facilityTypeId);
  if (group && listedQuantity(world, userId, listing.facilityTypeId) === 0) {
    group.status = 'paused';
    group.stopReason = 'manual';
  }
  return result(true, `已撤销 ${listing.quantity} 座${typeFor(listing.facilityTypeId)?.name || '工厂'}挂牌`);
}

function addPurchasedGroup(player, typeId, quantity) {
  const group = groupFor(player, typeId, true);
  group.count += quantity;
  if (group.status === 'running') group.pendingJoinCount += quantity;
  else if (group.status !== 'listed') {
    group.status = group.count === quantity ? 'ready' : 'paused';
    group.stopReason = 'manual';
  }
  return group;
}

function buyFacilityGroup(world, userId, payload, now) {
  const buyer = getPlayer(world, userId);
  const listing = world.facilityListings.find((item) => item.id === payload.listingId);
  const quantity = normalizePositiveInteger(payload.quantity || 1, 1_000_000);
  if (!listing || listing.ownerId === userId) return result(false, '无法购买该挂牌');
  if (!quantity || quantity > listing.quantity) return result(false, '购买数量超过挂牌数量');
  const total = quantity * listing.unitPrice;
  if (buyer.credits < total) return result(false, '购买资金不足');

  if (listing.ownerType === 'player') {
    const seller = getPlayer(world, listing.ownerId);
    const sellerGroup = groupFor(seller, listing.facilityTypeId);
    if (!sellerGroup || sellerGroup.count < quantity) return result(false, '卖方工厂数量不足');
    sellerGroup.count -= quantity;
    seller.credits += total;
    seller.stats.facilityVolume += total;
    if (sellerGroup.count === 0) {
      seller.facilityGroups = seller.facilityGroups.filter((group) => group !== sellerGroup);
    }
  }

  buyer.credits -= total;
  buyer.stats.facilityVolume += total;
  addPurchasedGroup(buyer, listing.facilityTypeId, quantity);
  listing.quantity -= quantity;
  if (listing.quantity === 0) world.facilityListings = world.facilityListings.filter((item) => item.id !== listing.id);

  if (listing.ownerType === 'player') {
    const seller = getPlayer(world, listing.ownerId);
    const sellerGroup = groupFor(seller, listing.facilityTypeId);
    if (sellerGroup && listedQuantity(world, seller.userId, listing.facilityTypeId) === 0) {
      sellerGroup.status = 'paused';
      sellerGroup.stopReason = 'manual';
    }
  }

  const type = typeFor(listing.facilityTypeId);
  return result(true, `已收购 ${quantity} 座${type?.name || '工厂'}，总价 ¤${total}`);
}

function renameListings(world, userId) {
  const player = getPlayer(world, userId);
  for (const listing of world.facilityListings || []) {
    if (listing.ownerId === userId) listing.ownerName = player.playerName;
  }
}

function resetFacilityGroups(world, userId) {
  world.facilityListings = (world.facilityListings || []).filter((listing) => listing.ownerId !== userId);
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
  if (action === 'listFacility') return listFacilityGroup(world, userId, payload, now);
  if (action === 'cancelFacilityListing') return cancelGroupListing(world, userId, payload);
  if (action === 'buyFacility') return buyFacilityGroup(world, userId, payload, now);

  const listings = world.facilityListings;
  const actionResult = withLegacyFacilitiesSuppressed(
    world,
    () => applyAction(world, user, action, payload, now),
  );
  world.facilityListings = listings;
  migrateFacilityGroupWorld(world, now);
  if (action === 'renamePlayer' && actionResult.ok) renameListings(world, userId);
  if (action === 'resetPlayer' && actionResult.ok) resetFacilityGroups(world, userId);
  stripLegacyFacilityInstances(world);
  return actionResult;
}

function totalAssets(world, player) {
  const inventoryValue = PRODUCT_CATALOG.reduce((sum, product) => {
    const inventory = inventoryFor(player, product.id);
    const price = Number(world.markets?.[product.id]?.lastPrice || product.basePrice);
    return sum + (inventory.available + inventory.frozen) * price;
  }, 0);
  const facilityValue = (player.facilityGroups || []).reduce((sum, group) => {
    const type = typeFor(group.facilityTypeId);
    return sum + group.count * Number(type?.systemValue || 0);
  }, 0);
  return player.credits + player.frozenCredits + inventoryValue + facilityValue;
}

function createLeaderboard(world, currentUserId, now) {
  return Object.values(world.players || {})
    .map((player) => ({
      playerName: player.playerName,
      totalAssets: totalAssets(world, player),
      cashAssets: player.credits + player.frozenCredits,
      facilityCount: (player.facilityGroups || []).reduce((sum, group) => sum + group.count, 0),
      weeklyChange: player.stats.workIssued + player.stats.populationIssued - player.stats.systemSinks,
      updatedAt: now,
      isCurrentPlayer: player.userId === currentUserId,
    }))
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
  return {
    ...withoutFacilities,
    version: 8,
    facilityGroups: (player.facilityGroups || []).map((group) => clientGroup(world, player, group)),
    facilityConstruction: player.facilityConstruction ? clone(player.facilityConstruction) : undefined,
    facilityTypes: FACILITY_TYPE_CATALOG.map(({ internalCapacity: _internalCapacity, ...type }) => clone(type)),
    facilityListings: clone(world.facilityListings || []),
    leaderboard: createLeaderboard(world, userId, now),
  };
}
