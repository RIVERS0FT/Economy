import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  importLegacyOnlineAutoSellPolicies,
  saveOnlineAutoTradePolicy,
} from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { productionContractStateFromGame } from '../contracts/types';
import type { AssetOrder, EconomyState, FacilityGroup, FacilityRecipeItem } from '../types';
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

function isOpenCommodityOrder(
  game: EconomyState,
  productId: string,
  side: 'buy' | 'sell',
  own: boolean,
  crosses: (price: number) => boolean,
) {
  return game.orders.some((order) => (
    order.assetKind === 'commodity'
    && order.assetId === productId
    && order.side === side
    && ['open', 'partial'].includes(order.status)
    && Number(order.remaining || 0) > 0
    && crosses(Number(order.price || 0))
    && Boolean(order.isOwn) === own
  ));
}

function managedOrder(
  game: EconomyState,
  orderId: string | undefined,
  productId: string,
  side: 'buy' | 'sell',
): AssetOrder | null {
  if (!orderId) return null;
  return game.orders.find((order) => (
    order.id === orderId
    && order.isOwn === true
    && order.assetKind === 'commodity'
    && order.assetId === productId
    && order.side === side
    && ['open', 'partial'].includes(order.status)
    && Number(order.remaining || 0) > 0
  )) ?? null;
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

export function useOnlineAutoTrade(
  model: LoadedGameViewModel,
  callbacks: {
    onAutoSellPolicyEnabled?: (productId: string) => void;
    onSale?: (productId: string) => void;
  } = {},
): OnlineAutoTradeController {
  const userId = model.user.id;
  const buyPolicies = model.game.onlineAutoBuyPolicies ?? {};
  const sellPolicies = model.game.onlineAutoSellPolicies ?? {};
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [busySide, setBusySide] = useState<'buy' | 'sell' | null>(null);
  const busyRef = useRef(false);
  const legacyMigrationUserRef = useRef<number | null>(null);
  const productionReserved = useMemo(() => productionReservations(model.game), [model.game]);
  const contractReserved = useMemo(() => contractReservations(model.game), [model.game]);

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

  const buyPolicyFor = useCallback((productId: string): AutoBuyPolicy => {
    const existing = buyPolicies[productId];
    if (existing) return existing;
    const product = model.game.products.find((candidate) => candidate.id === productId);
    return {
      enabled: false,
      maxPrice: Math.max(0.01, Number(product?.basePrice || 1)),
      targetFreeInventory: 0,
    };
  }, [buyPolicies, model.game.products]);

  const sellPolicyFor = useCallback((productId: string): AutoSellPolicy => {
    const existing = sellPolicies[productId];
    if (existing) return existing;
    const product = model.game.products.find((candidate) => candidate.id === productId);
    return {
      enabled: false,
      price: Math.max(0.01, Number(product?.basePrice || 1)),
      minimumFreeInventory: 0,
    };
  }, [model.game.products, sellPolicies]);

  const statusFor = useCallback((productId: string): AutoTradeProductStatus => {
    const buyPolicy = buyPolicyFor(productId);
    const sellPolicy = sellPolicyFor(productId);
    const availableInventory = nonNegativeInteger(model.game.inventories[productId]?.available);
    const production = nonNegativeInteger(productionReserved[productId]);
    const contract = contractReserved[productId] ?? { display: 0, availableHold: 0 };
    const contractHold = nonNegativeInteger(contract.availableHold);
    const currentFreeInventory = Math.max(0, availableInventory - production - contractHold);

    const buyManaged = managedOrder(
      model.game,
      model.game.onlineAutoBuyManagedOrderIds?.[productId],
      productId,
      'buy',
    );
    const buyDesiredQuantity = Math.max(
      0,
      production + contractHold + nonNegativeInteger(buyPolicy.targetFreeInventory) - availableInventory,
    );
    const buyEligibleQuantity = affordableBuyQuantity(
      model.game.credits,
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

    const sellManaged = managedOrder(
      model.game,
      model.game.onlineAutoSellManagedOrderIds?.[productId],
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

    return {
      availableInventory,
      productionReserved: production,
      contractReserved: nonNegativeInteger(contract.display),
      currentFreeInventory,
      buyDesiredQuantity,
      buyEligibleQuantity,
      buyFundingLimited: buyEligibleQuantity < buyDesiredQuantity,
      blockedBuyByOwnSell: isOpenCommodityOrder(
        model.game,
        productId,
        'sell',
        true,
        (price) => price <= buyPolicy.maxPrice,
      ),
      hasCrossingSeller: isOpenCommodityOrder(
        model.game,
        productId,
        'sell',
        false,
        (price) => price <= buyPolicy.maxPrice,
      ),
      hasManagedBuyOrder: Boolean(buyManaged),
      buyNeedsMaintenance,
      sellEligibleQuantity,
      blockedSellByOwnBuy: isOpenCommodityOrder(
        model.game,
        productId,
        'buy',
        true,
        (price) => price >= sellPolicy.price,
      ),
      hasCrossingBuyer: isOpenCommodityOrder(
        model.game,
        productId,
        'buy',
        false,
        (price) => price >= sellPolicy.price,
      ),
      hasManagedSellOrder: Boolean(sellManaged),
      sellNeedsMaintenance,
    };
  }, [buyPolicyFor, contractReserved, model.game, productionReserved, sellPolicyFor]);

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
      const response = await saveOnlineAutoTradePolicy(productId, normalized);
      if (!response.result.ok) return response.result;
      await model.refresh({ mode: 'authoritative' });
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

  useEffect(() => {
    if (busyRef.current) return;

    const sellCandidate = model.game.products.find((product) => {
      const policy = sellPolicies[product.id];
      if (!policy?.enabled) return false;
      const status = statusFor(product.id);
      return status.sellNeedsMaintenance
        || (status.blockedSellByOwnBuy && status.hasManagedSellOrder);
    });
    const buyCandidate = sellCandidate ? null : model.game.products.find((product) => {
      const policy = buyPolicies[product.id];
      if (!policy?.enabled) return false;
      const status = statusFor(product.id);
      return status.buyNeedsMaintenance
        || (status.blockedBuyByOwnSell && status.hasManagedBuyOrder);
    });
    const candidate = sellCandidate ?? buyCandidate;
    if (!candidate) return;
    const side = sellCandidate ? 'sell' : 'buy';
    const sellPolicy = sellPolicies[candidate.id];
    const buyPolicy = buyPolicies[candidate.id];

    busyRef.current = true;
    setBusyProductId(candidate.id);
    setBusySide(side);
    const operation = side === 'sell'
      ? model.onlineAutoSell(candidate.id, sellPolicy?.price ?? 0.01, sellPolicy?.minimumFreeInventory ?? 0)
      : model.onlineAutoBuy(candidate.id, buyPolicy?.maxPrice ?? 0.01, buyPolicy?.targetFreeInventory ?? 0);
    void operation
      .then((result) => {
        if (side === 'sell' && result.ok && result.message.includes('自动出售')) {
          callbacks.onSale?.(candidate.id);
        }
      })
      .finally(() => {
        busyRef.current = false;
        setBusyProductId(null);
        setBusySide(null);
      });
  }, [buyPolicies, callbacks.onSale, model, sellPolicies, statusFor]);

  return useMemo(() => ({
    buyPolicies,
    sellPolicies,
    busyProductId,
    busySide,
    buyPolicyFor,
    sellPolicyFor,
    statusFor,
    setPolicy,
  }), [
    buyPolicies,
    busyProductId,
    busySide,
    buyPolicyFor,
    sellPolicies,
    sellPolicyFor,
    setPolicy,
    statusFor,
  ]);
}
