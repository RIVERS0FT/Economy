import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  importLegacyOnlineAutoSellPolicies,
  saveOnlineAutoTradePolicy,
} from '../api/game';
import {
  getClientOrderIndex,
  hasCrossingCommodityOrder,
  managedCommodityOrder,
} from '../app/clientOrderIndex';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  getStateAuthoritySnapshot,
  subscribeStateAuthorityDependencies,
} from '../app/stateDelivery.js';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { productionContractStateFromGame } from '../contracts/types';
import type { AssetOrder, EconomyState, FacilityGroup, FacilityRecipeItem } from '../types';
import { scopeEconomyState } from '../utils/provinceScope';
import {
  clearAutoSellPolicies,
  loadAutoSellPolicies,
  type AutoSellPolicy,
  type AutoSellPolicyMap,
} from '../auto-sell/autoSellStorage';
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

function nonNegativeInteger(value: unknown) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function activeRecipeInputs(game: EconomyState, group: FacilityGroup): FacilityRecipeItem[] {
  const type = game.facilityTypes.find((candidate) => candidate.id === group.facilityTypeId);
  if (!type) return [];
  const directRecipe = type.recipes.find((recipe) => recipe.id === group.activeRecipeId);
  if (directRecipe) return directRecipe.inputs;
  for (const methodGroup of type.productionMethodGroups ?? []) {
    for (const method of methodGroup.methods) {
      for (const plan of Object.values(method.plansByRecipeId)) {
        if (plan.recipeId === group.activeRecipeId) return plan.inputs;
      }
    }
  }
  return type.inputs;
}

function productionReservations(game: EconomyState) {
  const reserved: Record<string, number> = {};
  for (const group of game.facilityGroups) {
    if (!group.enabled) continue;
    const physicalCount = group.status === 'running'
      ? nonNegativeInteger(group.participatingCount)
      : nonNegativeInteger(group.productionAvailableCount ?? group.count);
    if (physicalCount < 1) continue;
    for (const input of activeRecipeInputs(game, group)) {
      const quantity = nonNegativeInteger(input.quantity) * physicalCount;
      if (quantity > 0) reserved[input.productId] = (reserved[input.productId] ?? 0) + quantity;
    }
  }
  return reserved;
}

let cachedProductionGroups: EconomyState['facilityGroups'] | null = null;
let cachedProductionTypes: EconomyState['facilityTypes'] | null = null;
let cachedProductionReservations: Record<string, number> = {};

function currentProductionReservations(game: EconomyState) {
  if (cachedProductionGroups === game.facilityGroups && cachedProductionTypes === game.facilityTypes) {
    return cachedProductionReservations;
  }
  cachedProductionGroups = game.facilityGroups;
  cachedProductionTypes = game.facilityTypes;
  cachedProductionReservations = productionReservations(game);
  return cachedProductionReservations;
}

interface ContractReservation {
  display: number;
  availableHold: number;
}

function contractReservations(game: EconomyState) {
  const reserved: Record<string, ContractReservation> = {};
  const contracts = productionContractStateFromGame(game).productionContracts;
  const add = (productId: string, display: number, availableHold: number) => {
    const current = reserved[productId] ?? { display: 0, availableHold: 0 };
    current.display += nonNegativeInteger(display);
    current.availableHold += nonNegativeInteger(availableHold);
    reserved[productId] = current;
  };
  for (const contract of contracts) {
    if (
      contract.kind !== 'supply'
      || contract.status !== 'active'
      || !contract.isSupplier
      || (contract.totalDeliveries !== null && contract.completedDeliveries >= contract.totalDeliveries)
    ) continue;
    const quantity = nonNegativeInteger(contract.quantityPerDelivery);
    const frozen = Math.min(quantity, nonNegativeInteger(contract.supplierReservedQuantity));
    if (contract.supplierAutoReserve !== false) add(contract.productId, quantity, Math.max(0, quantity - frozen));
    else add(contract.productId, frozen, 0);

    const proposal = contract.renewalProposal;
    if (proposal?.status === 'accepted') {
      const renewalQuantity = nonNegativeInteger(proposal.terms.quantityPerDelivery);
      const renewalFrozen = Math.min(renewalQuantity, nonNegativeInteger(proposal.supplierReservedQuantity));
      if (contract.supplierAutoReserve !== false) {
        add(contract.productId, renewalQuantity, Math.max(0, renewalQuantity - renewalFrozen));
      } else {
        add(contract.productId, renewalFrozen, 0);
      }
    }
  }
  return reserved;
}

let cachedContractSource: unknown = null;
let cachedContractReservations: Record<string, ContractReservation> = {};

function currentContractReservations(game: EconomyState) {
  const source = game.productionContracts;
  if (cachedContractSource === source) return cachedContractReservations;
  cachedContractSource = source;
  cachedContractReservations = contractReservations(game);
  return cachedContractReservations;
}

function affordableBuyQuantity(
  credits: number,
  policy: AutoBuyPolicy,
  order: AssetOrder | null,
  desired: number,
) {
  if (policy.maxPrice <= 0) return 0;
  const reusable = order
    ? nonNegativeInteger(order.remaining) * Math.max(0, Number(order.price || 0))
    : 0;
  const affordable = Math.floor((Math.max(0, Number(credits || 0)) + reusable) / policy.maxPrice);
  return Math.max(0, Math.min(desired, Number.isSafeInteger(affordable) ? affordable : Number.MAX_SAFE_INTEGER));
}

interface StatusCache {
  sources: readonly unknown[];
  values: Map<string, AutoTradeProductStatus>;
}

function sameSources(left: readonly unknown[], right: readonly unknown[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buyPolicyForGame(game: EconomyState, productId: string): AutoBuyPolicy {
  const existing = game.onlineAutoBuyPolicies?.[productId];
  if (existing) return existing;
  const product = game.products.find((candidate) => candidate.id === productId);
  return {
    enabled: false,
    maxPrice: Math.max(0.01, Number(product?.basePrice || 1)),
    targetFreeInventory: 0,
  };
}

function sellPolicyForGame(game: EconomyState, productId: string): AutoSellPolicy {
  const existing = game.onlineAutoSellPolicies?.[productId];
  if (existing) return existing;
  const product = game.products.find((candidate) => candidate.id === productId);
  return {
    enabled: false,
    price: Math.max(0.01, Number(product?.basePrice || 1)),
    minimumFreeInventory: 0,
  };
}

export function useOnlineAutoTrade(
  model: LoadedGameViewModel,
  callbacks: {
    onAutoSellPolicyEnabled?: (productId: string) => void;
    onSale?: (productId: string) => void;
  } = {},
): OnlineAutoTradeController {
  const userId = model.user.id;
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [busySide, setBusySide] = useState<'buy' | 'sell' | null>(null);
  const busyRef = useRef(false);
  const legacyMigrationUserRef = useRef<number | null>(null);
  const statusCacheRef = useRef<StatusCache>({ sources: [], values: new Map() });

  useEffect(() => {
    if (legacyMigrationUserRef.current === userId) return;
    legacyMigrationUserRef.current = userId;
    const legacyPolicies = loadAutoSellPolicies(userId);
    if (Object.keys(legacyPolicies).length === 0) return;
    if (model.game.saveEpoch > 0) {
      clearAutoSellPolicies(userId);
      return;
    }

    void (async () => {
      try {
        const response = await importLegacyOnlineAutoSellPolicies(legacyPolicies);
        if (!response.result.ok) return;
        await model.refresh({ mode: 'authoritative' });
        clearAutoSellPolicies(userId);
      } catch {
        // Keep legacy browser data intact so a later session can retry the atomic import.
      }
    })();
  }, [model, userId]);

  const buyPolicyFor = useCallback((productId: string): AutoBuyPolicy => (
    buyPolicyForGame(model.game, productId)
  ), [model]);

  const sellPolicyFor = useCallback((productId: string): AutoSellPolicy => (
    sellPolicyForGame(model.game, productId)
  ), [model]);

  const statusFor = useCallback((
    productId: string,
    sourceGame?: EconomyState,
  ): AutoTradeProductStatus => {
    const game = sourceGame ?? model.game;
    const productionReserved = currentProductionReservations(game);
    const contractReserved = currentContractReservations(game);
    const sources = [
      game.orders,
      game.markets,
      game.inventories,
      game.credits,
      game.onlineAutoBuyPolicies,
      game.onlineAutoSellPolicies,
      game.onlineAutoBuyManagedOrderIds,
      game.onlineAutoSellManagedOrderIds,
      game.facilityGroups,
      game.facilityTypes,
      game.productionContracts,
    ];
    if (!sameSources(statusCacheRef.current.sources, sources)) {
      statusCacheRef.current = { sources, values: new Map() };
    }
    const cached = statusCacheRef.current.values.get(productId);
    if (cached) return cached;

    const orderIndex = getClientOrderIndex(game.orders);
    const buyPolicy = buyPolicyForGame(game, productId);
    const sellPolicy = sellPolicyForGame(game, productId);
    const market = game.markets[productId];
    const bestAsk = typeof market?.bestAsk === 'number' ? market.bestAsk : null;
    const bestBid = typeof market?.bestBid === 'number' ? market.bestBid : null;
    const availableInventory = nonNegativeInteger(game.inventories[productId]?.available);
    const production = nonNegativeInteger(productionReserved[productId]);
    const contract = contractReserved[productId] ?? { display: 0, availableHold: 0 };
    const contractHold = nonNegativeInteger(contract.availableHold);
    const currentFreeInventory = Math.max(0, availableInventory - production - contractHold);

    const buyManaged = managedCommodityOrder(
      orderIndex,
      game.onlineAutoBuyManagedOrderIds?.[productId],
      productId,
      'buy',
    );
    const buyDesiredQuantity = Math.max(
      0,
      production + contractHold + nonNegativeInteger(buyPolicy.targetFreeInventory) - availableInventory,
    );
    const buyEligibleQuantity = affordableBuyQuantity(
      game.credits,
      buyPolicy,
      buyManaged,
      buyDesiredQuantity,
    );
    const buyManagedRemaining = nonNegativeInteger(buyManaged?.remaining);
    const buyNeedsMaintenance = Boolean(
      buyPolicy.enabled
      && (
        (buyEligibleQuantity > 0 && !buyManaged)
        || (buyManaged && (
          buyManagedRemaining !== buyEligibleQuantity
          || Number(buyManaged.price || 0) !== Number(buyPolicy.maxPrice)
        ))
      ),
    );

    const sellManaged = managedCommodityOrder(
      orderIndex,
      game.onlineAutoSellManagedOrderIds?.[productId],
      productId,
      'sell',
    );
    const sellManagedRemaining = nonNegativeInteger(sellManaged?.remaining);
    const sellEligibleQuantity = Math.max(
      0,
      availableInventory
        + sellManagedRemaining
        - production
        - contractHold
        - nonNegativeInteger(sellPolicy.minimumFreeInventory),
    );
    const sellNeedsMaintenance = Boolean(
      sellPolicy.enabled
      && (
        (sellEligibleQuantity > 0 && !sellManaged)
        || (sellManaged && (
          sellManagedRemaining !== sellEligibleQuantity
          || Number(sellManaged.price || 0) !== Number(sellPolicy.price)
        ))
      ),
    );

    const status: AutoTradeProductStatus = {
      availableInventory,
      productionReserved: production,
      contractReserved: nonNegativeInteger(contract.display),
      currentFreeInventory,
      buyDesiredQuantity,
      buyEligibleQuantity,
      buyFundingLimited: buyEligibleQuantity < buyDesiredQuantity,
      blockedBuyByOwnSell: hasCrossingCommodityOrder(
        orderIndex,
        productId,
        'sell',
        true,
        buyPolicy.maxPrice,
      ),
      hasCrossingSeller: bestAsk !== null && bestAsk <= buyPolicy.maxPrice,
      hasManagedBuyOrder: Boolean(buyManaged),
      buyNeedsMaintenance,
      sellEligibleQuantity,
      blockedSellByOwnBuy: hasCrossingCommodityOrder(
        orderIndex,
        productId,
        'buy',
        true,
        sellPolicy.price,
      ),
      hasCrossingBuyer: bestBid !== null && bestBid >= sellPolicy.price,
      hasManagedSellOrder: Boolean(sellManaged),
      sellNeedsMaintenance,
    };
    statusCacheRef.current.values.set(productId, status);
    return status;
  }, [model]);

  const setPolicy = useCallback(async (productId: string, policy: AutoTradePolicyInput) => {
    const buyMaxPrice = Math.round(Number(policy.buy.maxPrice) * 100) / 100;
    const buyTarget = Number(policy.buy.targetFreeInventory);
    const sellPrice = Math.round(Number(policy.sell.price) * 100) / 100;
    const sellMinimum = Number(policy.sell.minimumFreeInventory);
    if (!Number.isFinite(buyMaxPrice) || buyMaxPrice < 0.01) {
      return { ok: false, message: '最高自动采购价格无效' };
    }
    if (!Number.isSafeInteger(buyTarget) || buyTarget < 0) {
      return { ok: false, message: '目标自由库存必须是不小于 0 的整数' };
    }
    if (!Number.isFinite(sellPrice) || sellPrice < 0.01) {
      return { ok: false, message: '最低自动出售价格无效' };
    }
    if (!Number.isSafeInteger(sellMinimum) || sellMinimum < 0) {
      return { ok: false, message: '最低自由库存必须是不小于 0 的整数' };
    }

    const normalized: AutoTradePolicyInput = {
      buy: { enabled: policy.buy.enabled === true, maxPrice: buyMaxPrice, targetFreeInventory: buyTarget },
      sell: { enabled: policy.sell.enabled === true, price: sellPrice, minimumFreeInventory: sellMinimum },
    };
    if (normalized.buy.enabled && normalized.sell.enabled) {
      if (normalized.buy.targetFreeInventory > normalized.sell.minimumFreeInventory) {
        return { ok: false, message: '自动采购目标自由库存不能高于自动出售最低自由库存' };
      }
      if (normalized.buy.maxPrice >= normalized.sell.price) {
        return { ok: false, message: '最高自动采购价格必须低于最低自动出售价格' };
      }
    }

    try {
      const response = await saveOnlineAutoTradePolicy(model.selectedProvinceId, productId, normalized);
      if (!response.result.ok) return response.result;
      void model.refresh({ mode: 'authoritative' });
      clearAutoSellPolicies(userId);
      if (normalized.sell.enabled) callbacks.onAutoSellPolicyEnabled?.(productId);
      return response.result;
    } catch (reason) {
      return {
        ok: false,
        message: reason instanceof Error ? reason.message : '保存自动交易设置失败',
      };
    }
  }, [callbacks.onAutoSellPolicyEnabled, model, userId]);

  const maintainAutoTrade = useCallback(() => {
    if (busyRef.current) return;
    const authorityGame = getStateAuthoritySnapshot().state;
    if (
      !authorityGame
      || authorityGame.userId !== userId
      || authorityGame.saveEpoch !== model.game.saveEpoch
    ) return;
    const game = scopeEconomyState(authorityGame, model.selectedProvinceId);
    const sellPolicies = game.onlineAutoSellPolicies ?? {};
    const buyPolicies = game.onlineAutoBuyPolicies ?? {};
    const productOrder = new Map(game.products.map((product, index) => [product.id, index]));
    const byCatalogOrder = (left: string, right: string) => (
      (productOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (productOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
    );
    const enabledSellProductIds = Object.entries(sellPolicies)
      .filter(([, policy]) => policy?.enabled)
      .map(([productId]) => productId);
    const enabledBuyProductIds = Object.entries(buyPolicies)
      .filter(([, policy]) => policy?.enabled)
      .map(([productId]) => productId);
    // Legacy managed links remain maintenance candidates even when factory-derived policy is now disabled.
    // The server re-derives authority and commits cancellation before these links can influence the new strategy.
    const sellProductIds = [...new Set([
      ...enabledSellProductIds,
      ...Object.keys(game.onlineAutoSellManagedOrderIds ?? {}),
    ])].sort(byCatalogOrder);
    const buyProductIds = [...new Set([
      ...enabledBuyProductIds,
      ...Object.keys(game.onlineAutoBuyManagedOrderIds ?? {}),
    ])].sort(byCatalogOrder);

    const sellProductId = sellProductIds.find((productId) => {
      const status = statusFor(productId, game);
      const policy = sellPolicies[productId];
      if (!policy?.enabled) return status.hasManagedSellOrder;
      return (!status.blockedSellByOwnBuy && status.sellNeedsMaintenance)
        || (status.blockedSellByOwnBuy && status.hasManagedSellOrder);
    });
    const buyProductId = sellProductId ? undefined : buyProductIds.find((productId) => {
      const status = statusFor(productId, game);
      const policy = buyPolicies[productId];
      if (!policy?.enabled) return status.hasManagedBuyOrder;
      return (!status.blockedBuyByOwnSell && status.buyNeedsMaintenance)
        || (status.blockedBuyByOwnSell && status.hasManagedBuyOrder);
    });
    const productId = sellProductId ?? buyProductId;
    if (!productId) return;
    const side = sellProductId ? 'sell' : 'buy';
    const sellPolicy = sellPolicies[productId];
    const buyPolicy = buyPolicies[productId];

    busyRef.current = true;
    setBusyProductId(productId);
    setBusySide(side);
    const operation = side === 'sell'
      ? model.onlineAutoSell(productId, sellPolicy?.price ?? 0.01, sellPolicy?.minimumFreeInventory ?? 0)
      : model.onlineAutoBuy(productId, buyPolicy?.maxPrice ?? 0.01, buyPolicy?.targetFreeInventory ?? 0);
    void operation
      .then((result) => {
        if (side === 'sell' && result.ok && result.message.includes('自动出售')) {
          callbacks.onSale?.(productId);
        }
      })
      .finally(() => {
        busyRef.current = false;
        setBusyProductId(null);
        setBusySide(null);
      });
  }, [callbacks.onSale, model, statusFor, userId]);

  useEffect(() => {
    maintainAutoTrade();
    return subscribeStateAuthorityDependencies(
      ['catalog', 'player.assets', 'player.production', 'market.orders', 'market.quotes', 'contract'],
      maintainAutoTrade,
    );
  }, [busyProductId, busySide, maintainAutoTrade]);

  return useMemo(() => ({
    get buyPolicies() {
      return model.game.onlineAutoBuyPolicies ?? {};
    },
    get sellPolicies() {
      return model.game.onlineAutoSellPolicies ?? {};
    },
    busyProductId,
    busySide,
    buyPolicyFor,
    sellPolicyFor,
    statusFor,
    setPolicy,
  }), [
    busyProductId,
    busySide,
    buyPolicyFor,
    model,
    sellPolicyFor,
    setPolicy,
    statusFor,
  ]);
}
