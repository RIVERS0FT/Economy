import { createOnlineAutoSellPolicyClientState } from './online-auto-sell-policy.js';

function storedQuantity(player) {
  return Object.values(player?.inventories || {}).reduce(
    (sum, inventory) => (
      sum
      + Math.max(0, Number(inventory?.available || 0))
      + Math.max(0, Number(inventory?.frozen || 0))
    ),
    0,
  );
}

export function ensureWarehouse(player) {
  if (!player || typeof player !== 'object') return player;
  delete player.inventoryCapacity;
  delete player.warehouseLevel;
  return player;
}

export function createWarehouseSummary(player) {
  ensureWarehouse(player);
  return {
    warehouseStoredQuantity: storedQuantity(player),
    ...createOnlineAutoSellPolicyClientState(player),
  };
}
