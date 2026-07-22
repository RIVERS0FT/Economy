import { isOpenOrder, orderKind } from './order-identity.js';
import { creditPopulationEmploymentForPlayer } from './population-economy.js';

export const WAREHOUSE_BASE_CAPACITY = 500;
export const WAREHOUSE_CAPACITY_STEP = 250;
export const WAREHOUSE_CAPACITY_STEP_GROWTH = 50;
export const WAREHOUSE_BASE_UPGRADE_COST = 150;
export const WAREHOUSE_COST_SLOPE_NUMERATOR = 3;
export const WAREHOUSE_COST_SLOPE_DENOMINATOR = 5;

function normalizeLevel(value) {
  const level = Math.floor(Number(value || 1));
  return Number.isSafeInteger(level) && level >= 1 ? level : 1;
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
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

function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) return auction.items;
  const kind = auction?.assetKind || (auction?.collectibleId ? 'collectible' : undefined);
  const assetId = String(auction?.assetId || auction?.productId || auction?.facilityTypeId || auction?.collectibleId || '');
  return kind && assetId ? [{ assetKind: kind, assetId, quantity: Math.max(1, Number(auction.quantity || 1)) }] : [];
}

function auctionCommodityQuantity(auction) {
  return auctionItems(auction).reduce((sum, item) => (
    item.assetKind === 'commodity' ? sum + Math.max(0, Number(item.quantity || 0)) : sum
  ), 0);
}

function reservedBuyQuantity(world, userId) {
  const orderReserved = (world?.orders || []).reduce((sum, order) => {
    if (
      Number(order?.ownerId) !== Number(userId)
      || orderKind(order) === 'facility'
      || order?.side !== 'buy'
      || !isOpenOrder(order)
    ) return sum;
    return sum + Math.max(0, Number(order.remaining || 0));
  }, 0);
  const auctionReserved = (world?.collectibleAuctions || []).reduce((sum, auction) => {
    if (
      Number(auction?.highestBidderId) !== Number(userId)
      || auction?.status !== 'open'
      || auction?.escrowStatus === 'released'
      || auction?.escrowStatus === 'transferred'
    ) return sum;
    return sum + auctionCommodityQuantity(auction);
  }, 0);
  return orderReserved + auctionReserved;
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

export function warehouseUpgradeCostForCapacity(capacity) {
  const numericCapacity = Math.floor(Number(capacity || 0));
  if (!Number.isSafeInteger(numericCapacity)) return null;
  const normalizedCapacity = Math.max(WAREHOUSE_BASE_CAPACITY, numericCapacity);
  const excessCapacity = normalizedCapacity - WAREHOUSE_BASE_CAPACITY;
  const wholeSteps = Math.floor(excessCapacity / WAREHOUSE_COST_SLOPE_DENOMINATOR);
  const remainder = excessCapacity % WAREHOUSE_COST_SLOPE_DENOMINATOR;
  const wholeCost = wholeSteps * WAREHOUSE_COST_SLOPE_NUMERATOR;
  if (!Number.isSafeInteger(wholeCost)) return null;
  const variableCost = wholeCost + Math.ceil(
    (remainder * WAREHOUSE_COST_SLOPE_NUMERATOR) / WAREHOUSE_COST_SLOPE_DENOMINATOR,
  );
  return safeInteger(WAREHOUSE_BASE_UPGRADE_COST + variableCost);
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
  const validStoredLevel = Number.isSafeInteger(storedLevel) && storedLevel >= 1 ? storedLevel : 1;
  const level = Math.max(validStoredLevel, inferLevelForCapacity(existingCapacity));
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
  const capacityIncrease = warehouseCapacityIncreaseForLevel(level);
  const nextCapacity = capacityIncrease === null
    ? null
    : safeInteger(player.inventoryCapacity + capacityIncrease);
  return {
    warehouseLevel: level,
    warehouseUpgradeCost: nextCapacity === null
      ? null
      : warehouseUpgradeCostForCapacity(player.inventoryCapacity),
    warehouseNextCapacity: nextCapacity ?? player.inventoryCapacity,
    warehouseNextCapacityIncrease: nextCapacity === null ? 0 : capacityIncrease,
    ...createWarehouseUsage(world, player),
  };
}

export function upgradeWarehouse(player) {
  ensureWarehouse(player);
  const currentLevel = player.warehouseLevel;
  const nextLevel = currentLevel + 1;
  const cost = warehouseUpgradeCostForCapacity(player.inventoryCapacity);
  const capacityIncrease = warehouseCapacityIncreaseForLevel(currentLevel);
  const nextCapacity = capacityIncrease === null
    ? null
    : safeInteger(player.inventoryCapacity + capacityIncrease);
  if (
    !Number.isSafeInteger(nextLevel)
    || !Number.isFinite(cost)
    || cost <= 0
    || !Number.isFinite(nextCapacity)
  ) {
    return { ok: false, message: '仓库扩容数值超出安全范围' };
  }
  if (player.credits < cost) {
    return { ok: false, message: `资金不足，需要 ¤${cost}` };
  }

  player.credits -= cost;
  player.warehouseLevel = nextLevel;
  player.inventoryCapacity = nextCapacity;
  player.stats ||= {};
  if (!creditPopulationEmploymentForPlayer(player, cost, 'warehouse')) {
    throw new Error('仓库扩容无法连接人口经济账户');
  }
  player.stats.warehousePayroll = Number(player.stats.warehousePayroll || 0) + cost;
  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + cost;
  return {
    ok: true,
    message: `仓库已扩容至 ${player.inventoryCapacity}，等级 ${player.warehouseLevel}`,
  };
}
