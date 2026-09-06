import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { getStateAuthoritySnapshot, subscribeStateAuthorityDependencies } from '../app/stateDelivery.js';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import type { AutoSellPolicy, AutoSellPolicyMap } from '../auto-sell/autoSellStorage';
import type { AutoBuyPolicy, AutoBuyPolicyMap, AutoTradePolicyInput } from './types';

export interface AutoTradeProductStatus {
  availableInventory: number;
  productionReserved: number;
  contractReserved: number;
  currentFreeInventory: number;
  buyDesiredQuantity: number;
  buyEligibleQuantity: number;
  buyFundingLimited: boolean;
  blockedBuyByOwnSell: boolean;
  hasCrossingSeller: boolean;
  hasManagedBuyOrder: boolean;
  buyNeedsMaintenance: boolean;
  sellEligibleQuantity: number;
  blockedSellByOwnBuy: boolean;
  hasCrossingBuyer: boolean;
  hasManagedSellOrder: boolean;
  sellNeedsMaintenance: boolean;
}

export interface OnlineAutoTradeController {
  buyPolicies: AutoBuyPolicyMap;
  sellPolicies: AutoSellPolicyMap;
  busyProductId: string | null;
  busySide: 'buy' | 'sell' | null;
  buyPolicyFor: (productId: string) => AutoBuyPolicy;
  sellPolicyFor: (productId: string) => AutoSellPolicy;
  statusFor: (productId: string) => AutoTradeProductStatus;
  setPolicy: (productId: string, policy: AutoTradePolicyInput) => Promise<{ ok: boolean; message: string }>;
}

export type OnlineAutoTradeAwareGameViewModel = TutorialAwareGameViewModel & {
  autoTrade: OnlineAutoTradeController;
};

/** Compatibility view and server-sale tutorial notifications only; never submits a trade. */
export function useOnlineAutoTrade(
  model: LoadedGameViewModel,
  callbacks: {
    onAutoSellPolicyEnabled?: (productId: string) => void;
    onSale?: (productId: string, provinceId?: string) => void;
  } = {},
): OnlineAutoTradeController {
  const latest = useRef({ model, callbacks });
  latest.current = { model, callbacks };
  const userId = model.user.id;
  const saveEpoch = model.game.saveEpoch;
  useEffect(() => {
    const initial = getStateAuthoritySnapshot().state;
    let counts = initial?.userId === userId && initial.saveEpoch === saveEpoch
      ? { ...initial.cycleAutoSaleCounts } : null;
    return subscribeStateAuthorityDependencies(['player.assets'], () => {
      const state = getStateAuthoritySnapshot().state;
      if (!state || state.userId !== userId || state.saveEpoch !== saveEpoch) return;
      const next = state.cycleAutoSaleCounts || {};
      const previous = counts;
      counts = { ...next };
      if (!previous) return; // Initial synchronization is not a new sale.
      const { callbacks: handlers } = latest.current;
      for (const [key, quantity] of Object.entries(next)) {
        const separator = key.indexOf(':');
        if (separator > 0 && quantity > (previous[key] || 0)) {
          handlers.onSale?.(key.slice(separator + 1), key.slice(0, separator));
        }
      }
    });
  }, [userId, saveEpoch]);

  const buyPolicyFor = useCallback((): AutoBuyPolicy => ({ enabled: false, maxPrice: 0.01, targetFreeInventory: 0 }), []);
  const sellPolicyFor = useCallback((): AutoSellPolicy => ({ enabled: false, price: 0.01, minimumFreeInventory: 0 }), []);
  const statusFor = useCallback((productId: string): AutoTradeProductStatus => {
    const available = Math.max(0, Number(model.game.inventories[productId]?.available || 0));
    return {
      availableInventory: available, productionReserved: 0, contractReserved: 0,
      currentFreeInventory: available, buyDesiredQuantity: 0, buyEligibleQuantity: 0,
      buyFundingLimited: false, blockedBuyByOwnSell: false, hasCrossingSeller: false,
      hasManagedBuyOrder: false, buyNeedsMaintenance: false, sellEligibleQuantity: available,
      blockedSellByOwnBuy: false, hasCrossingBuyer: false, hasManagedSellOrder: false,
      sellNeedsMaintenance: false,
    };
  }, [model.game.inventories]);
  const setPolicy = useCallback(async () => ({ ok: false, message: '请在建筑详情设置周期自动经营' }), []);
  return useMemo(() => ({ buyPolicies: {}, sellPolicies: {}, busyProductId: null, busySide: null,
    buyPolicyFor, sellPolicyFor, statusFor, setPolicy }), [buyPolicyFor, sellPolicyFor, statusFor, setPolicy]);
}
