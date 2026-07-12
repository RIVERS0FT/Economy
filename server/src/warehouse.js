export const WAREHOUSE_BASE_CAPACITY = 500;
export const WAREHOUSE_CAPACITY_STEP = 250;
export const WAREHOUSE_CAPACITY_STEP_GROWTH = 50;
export const WAREHOUSE_BASE_UPGRADE_COST = 150;

function normalizeLevel(value) {
  const level = Math.floor(Number(value || 1));
  return Number.isSafeInteger(level) && level >= 1 ? level : 1;
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
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

export function warehouseCapacityIncreaseForLevel(level) {
  const normalized = normalizeLevel(level);
  return safeInteger(
    WAREHOUSE_CAPACITY_STEP + WAREHOUSE_CAPACITY_STEP_GROWTH * (normalized - 1),
  );
}

export function warehouseCapacityForLevel(level) {
  const normalized = normalizeLevel(level);
  const completedUpgrades = normalized - 1;
  return safeInteger(
    WAREHOUSE_BASE_CAPACITY
    + WAREHOUSE_CAPACITY_STEP * completedUpgrades
    + (WAREHOUSE_CAPACITY_STEP_GROWTH * completedUpgrades * (completedUpgrades - 1)) / 2,
  );
}

export function warehouseUpgradeCostForLevel(level) {
  const normalized = normalizeLevel(level);
  return safeInteger(WAREHOUSE_BASE_UPGRADE_COST * normalized * normalized);
}

function inferLevelForCapacity(capacity) {
  const target = Math.max(WAREHOUSE_BASE_CAPACITY, Number(capacity || 0));
  let low = 1;
  let high = 2;
  while ((warehouseCapacityForLevel(high) ?? Number.POSITIVE_INFINITY) < target) {
    low = high;
    high *= 2;
    if (!Number.isSafeInteger(high)) return low;
  }
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const middleCapacity = warehouseCapacityForLevel(middle);
    if (middleCapacity !== null && middleCapacity >= target) high = middle;
    else low = middle + 1;
  }
  return low;
}

export function ensureWarehouse(player) {
  const existingCapacity = Math.max(WAREHOUSE_BASE_CAPACITY, Number(player.inventoryCapacity || 0));
  const storedLevel = Number(player.warehouseLevel);
  const level = Number.isSafeInteger(storedLevel) && storedLevel >= 1
    ? storedLevel
    : inferLevelForCapacity(existingCapacity);
  const formulaCapacity = warehouseCapacityForLevel(level);
  player.warehouseLevel = level;
  player.inventoryCapacity = Math.max(existingCapacity, formulaCapacity ?? existingCapacity);
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
  const nextCapacity = warehouseCapacityForLevel(level + 1) ?? player.inventoryCapacity;
  return {
    warehouseLevel: level,
    warehouseUpgradeCost: warehouseUpgradeCostForLevel(level),
    warehouseNextCapacity: nextCapacity,
    warehouseNextCapacityIncrease: Math.max(0, nextCapacity - player.inventoryCapacity),
    ...createWarehouseUsage(world, player),
  };
}

export function upgradeWarehouse(player) {
  ensureWarehouse(player);
  const currentLevel = player.warehouseLevel;
  const nextLevel = currentLevel + 1;
  const cost = warehouseUpgradeCostForLevel(currentLevel);
  const nextCapacity = warehouseCapacityForLevel(nextLevel);
  if (!Number.isSafeInteger(nextLevel) || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(nextCapacity)) {
    return { ok: false, message: '仓库扩容数值超出安全范围' };
  }
  if (player.credits < cost) {
    return { ok: false, message: `资金不足，需要 ¤${cost}` };
  }

  player.credits -= cost;
  player.warehouseLevel = nextLevel;
  player.inventoryCapacity = Math.max(player.inventoryCapacity, nextCapacity);
  player.stats ||= {};
  player.stats.systemSinks = Number(player.stats.systemSinks || 0) + cost;
  return {
    ok: true,
    message: `仓库已扩容至 ${player.inventoryCapacity}，等级 ${player.warehouseLevel}`,
  };
}
