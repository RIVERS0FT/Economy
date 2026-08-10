import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  importLegacyOnlineAutoSellPolicies,
  saveOnlineAutoSellPolicy,
} from '../api/game';
import { productionContractStateFromGame } from '../contracts/types';
import type { EconomyState, FacilityGroup, FacilityRecipeItem } from '../types';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import {
  clearAutoSellPolicies,
  loadAutoSellPolicies,
  type AutoSellPolicy,
  type AutoSellPolicyMap,
} from './autoSellStorage';

export interface AutoSellProductStatus {
  availableInventory: number;
  productionReserved: number;
  contractReserved: number;
  minimumFreeInventory: number;
  eligibleQuantity: number;
  blockedByOwnBuy: boolean;
  hasCrossingBuyer: boolean;
  hasManagedOrder: boolean;
  reservationShortfall: boolean;
}

export interface OnlineAutoSellController {
  policies: AutoSellPolicyMap;
  busyProductId: string | null;
  policyFor: (productId: string) => AutoSellPolicy;
  statusFor: (productId: string) => AutoSellProductStatus;
  setPolicy: (productId: string, policy: AutoSellPolicy) => Promise<{ ok: boolean; message: string }>;
}

export type OnlineAutoSellAwareGameViewModel = TutorialAwareGameViewModel & {
  autoSell: OnlineAutoSellController;
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

function isOpenCommodityBuy(game: EconomyState, productId: string, own: boolean, minimumPrice: number) {
  return game.orders.some((order) => (
    order.assetKind === 'commodity'
    && order.assetId === productId
    && order.side === 'buy'
    && ['open', 'partial'].includes(order.status)
    && Number(order.remaining || 0) > 0
    && Number(order.price || 0) >= minimumPrice
    && Boolean(order.isOwn) === own
  ));
}

export function useOnlineAutoSell(
  model: LoadedGameViewModel,
  callbacks: {
    onPolicyEnabled?: (productId: string) => void;
    onSale?: (productId: string) => void;
  } = {},
): OnlineAutoSellController {
  const userId = model.user.id;
  const policies = model.game.onlineAutoSellPolicies ?? {};
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
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

  const policyFor = useCallback((productId: string): AutoSellPolicy => {
    const existing = policies[productId];
    if (existing) return existing;
    const product = model.game.products.find((candidate) => candidate.id === productId);
    return {
      enabled: false,
      price: Math.max(0.01, Number(product?.basePrice || 1)),
      minimumFreeInventory: 0,
    };
  }, [model.game.products, policies]);

  const statusFor = useCallback((productId: string): AutoSellProductStatus => {
    const policy = policyFor(productId);
    const availableInventory = nonNegativeInteger(model.game.inventories[productId]?.available);
    const production = nonNegativeInteger(productionReserved[productId]);
    const contract = contractReserved[productId] ?? { display: 0, availableHold: 0 };
    const minimumFreeInventory = nonNegativeInteger(policy.minimumFreeInventory);
    const managedOrderId = String(model.game.onlineAutoSellManagedOrderIds?.[productId] || '');
    const hasManagedOrder = Boolean(managedOrderId && model.game.orders.some((order) => (
      order.id === managedOrderId
      && order.isOwn === true
      && order.assetKind === 'commodity'
      && order.assetId === productId
      && order.side === 'sell'
      && ['open', 'partial'].includes(order.status)
      && Number(order.remaining || 0) > 0
    )));
    const requiredAvailable = production + nonNegativeInteger(contract.availableHold) + minimumFreeInventory;
    return {
      availableInventory,
      productionReserved: production,
      contractReserved: nonNegativeInteger(contract.display),
      minimumFreeInventory,
      eligibleQuantity: Math.max(0, availableInventory - requiredAvailable),
      blockedByOwnBuy: isOpenCommodityBuy(model.game, productId, true, policy.price),
      hasCrossingBuyer: isOpenCommodityBuy(model.game, productId, false, policy.price),
      hasManagedOrder,
      reservationShortfall: hasManagedOrder && availableInventory < requiredAvailable,
    };
  }, [contractReserved, model.game, policyFor, productionReserved]);

  const setPolicy = useCallback(async (productId: string, policy: AutoSellPolicy) => {
    const price = Math.round(Number(policy.price) * 100) / 100;
    const minimumFreeInventory = Number(policy.minimumFreeInventory);
    if (!Number.isFinite(price) || price < 0.01) return { ok: false, message: '最低自动出售价格无效' };
    if (!Number.isSafeInteger(minimumFreeInventory) || minimumFreeInventory < 0) {
      return { ok: false, message: '最低自由库存必须是不小于 0 的整数' };
    }
    const normalized = { enabled: policy.enabled === true, price, minimumFreeInventory };
    try {
      const response = await saveOnlineAutoSellPolicy(productId, normalized);
      if (!response.result.ok) return response.result;
      await model.refresh({ mode: 'authoritative' });
      clearAutoSellPolicies(userId);
      if (normalized.enabled) callbacks.onPolicyEnabled?.(productId);
      return response.result;
    } catch (reason) {
      return {
        ok: false,
        message: reason instanceof Error ? reason.message : '保存自动出售设置失败',
      };
    }
  }, [callbacks.onPolicyEnabled, model, userId]);

  useEffect(() => {
    if (busyRef.current) return;
    const candidate = model.game.products.find((product) => {
      const policy = policies[product.id];
      if (!policy?.enabled) return false;
      const status = statusFor(product.id);
      return !status.blockedByOwnBuy && (status.eligibleQuantity > 0 || status.reservationShortfall);
    });
    if (!candidate) return;
    const policy = policies[candidate.id];
    if (!policy) return;

    busyRef.current = true;
    setBusyProductId(candidate.id);
    void model.onlineAutoSell(candidate.id, policy.price, policy.minimumFreeInventory)
      .then((result) => {
        if (result.ok && result.message.includes('自动出售')) callbacks.onSale?.(candidate.id);
      })
      .finally(() => {
        busyRef.current = false;
        setBusyProductId(null);
      });
  }, [callbacks.onSale, model, policies, statusFor]);

  return useMemo(() => ({
    policies,
    busyProductId,
    policyFor,
    statusFor,
    setPolicy,
  }), [busyProductId, policies, policyFor, setPolicy, statusFor]);
}
