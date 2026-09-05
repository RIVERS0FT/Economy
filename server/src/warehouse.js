import {
  createFactoryAutoOperationClientState,
  createFactoryAutoTradeExecutionClientState,
} from './factory-auto-operation.js';
import { createInventoryFreezeClientState } from './inventory-freezes.js';
import { createOnlineAutoBuyPolicyClientState } from './online-auto-buy-policy.js';
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
  return createWarehouseSummaryReadOnly(player);
}

export function createWarehouseSummaryReadOnly(player) {
  const buyState = createOnlineAutoBuyPolicyClientState(player);
  const sellState = createOnlineAutoSellPolicyClientState(player);
  const executionState = createFactoryAutoTradeExecutionClientState(player);
  return {
    warehouseStoredQuantity: storedQuantity(player),
    onlineAutoBuyPolicies: executionState.onlineAutoBuyPolicies,
    onlineAutoSellPolicies: executionState.onlineAutoSellPolicies,
    onlineAutoBuyManagedOrderIds: buyState.onlineAutoBuyManagedOrderIds,
    onlineAutoSellManagedOrderIds: sellState.onlineAutoSellManagedOrderIds,
    ...createFactoryAutoOperationClientState(player),
    ...createInventoryFreezeClientState(player),
  };
}
