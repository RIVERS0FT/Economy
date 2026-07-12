export const WAREHOUSE_BASE_CAPACITY = 500;
export const WAREHOUSE_CAPACITY_STEP = 250;
export const WAREHOUSE_MAX_LEVEL = 12;
export const WAREHOUSE_BASE_UPGRADE_COST = 150;

function clampLevel(value) {
  const level = Math.floor(Number(value || 1));
  return Math.min(WAREHOUSE_MAX_LEVEL, Math.max(1, Number.isFinite(level) ? level : 1));
}

function isOpenOrder(order) {
  return order?.status === 'open' || order?.status === 'partial';
}

function storedQuantity(player) {
  return Object.values(player.inventories || {}).reduce(
    (sum, inventory) => (
      sum
      + Math.max(0, Number(inventory?.available || 0))
      + Math.max(0, Number(inventory?.frozen || 0))
    ),
    0,
  );
}

function reservedBuyQuantity(world, userId) {
  return (world?.orders || []).reduce((sum, order) => {
    if (
      Number(order?.ownerId) !== Number(userId)
      || order?.assetKind === 'facility'
      || order?.side !== 'buy'
      || !isOpenOrder(order)
    ) return sum;
    return sum + Math.max(0, Number(order.remaining || 0));
  }, 0);
}

export function warehouseCapacityForLevel(level) {
  const normalized = clampLevel(level);
  return WAREHOUSE_BASE_CAPACITY + (normalized - 1) * WAREHOUSE_CAPACITY_STEP;
}

export function warehouseUpgradeCostForLevel(level) {
  const normalized = clampLevel(level);
  if (normalized >= WAREHOUSE_MAX_LEVEL) return null;
  return WAREHOUSE_BASE_UPGRADE_COST * normalized * normalized;
}

export function ensureWarehouse(player) {
  const existingCapacity = Math.max(WAREHOUSE_BASE_CAPACITY, Number(player.inventoryCapacity || 0));
  const inferredLevel = Math.ceil((existingCapacity - WAREHOUSE_BASE_CAPACITY) / WAREHOUSE_CAPACITY_STEP) + 1;
  player.warehouseLevel = clampLevel(player.warehouseLevel || inferredLevel);
  player.inventoryCapacity = Math.max(existingCapacity, warehouseCapacityForLevel(player.warehouseLevel));
  return player;
}

export function createWarehouseUsage(world, player) {
  ensureWarehouse(player);
  const stored = storedQuantity(player);
  const reserved = reservedBuyQuantity(world, player.userId);
  const used = stored + reserved;
  return {
    warehouseStoredQuantity: stored,
    warehouseReservedQuantity: reserved,
    warehouseUsedCapacity: used,
    warehouseAvailableCapacity: Math.max(0, player.inventoryCapacity - used),
  };
}

export function createWarehouseSummary(world, player) {
  ensureWarehouse(player);
  const level = player.warehouseLevel;
  const nextLevel = Math.min(WAREHOUSE_MAX_LEVEL, level + 1);
  return {
    warehouseLevel: level,
    warehouseMaxLevel: WAREHOUSE_MAX_LEVEL,
    warehouseUpgradeCost: warehouseUpgradeCostForLevel(level),
    warehouseNextCapacity: warehouseCapacityForLevel(nextLevel),
    ...createWarehouseUsage(world, player),
  };
}

export function upgradeWarehouse(player) {
  ensureWarehouse(player);
  if (player.warehouseLevel >= WAREHOUSE_MAX_LEVEL) {
    return { ok: false, message: '仓库已达到最高等级' };
  }

  const cost = warehouseUpgradeCostForLevel(player.warehouseLevel);
  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: false, message: '仓库扩容费用无效' };
  }
  if (player.credits < cost) {
    return { ok: false, message: `资金不足，需要 ¤${cost}` };
  }

  player.credits -= cost;
  player.warehouseLevel += 1;
  player.inventoryCapacity = warehouseCapacityForLevel(player.warehouseLevel);
  player.stats ||= {};
  player.stats.systemSinks = Number(player.stats.systemSinks || 0) + cost;
  return {
    ok: true,
    message: `仓库已扩容至 ${player.inventoryCapacity}，等级 ${player.warehouseLevel}`,
  };
}
