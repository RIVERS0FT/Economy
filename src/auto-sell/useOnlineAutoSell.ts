import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { productionContractStateFromGame } from '../contracts/types';
import type { EconomyState, FacilityGroup, FacilityRecipeItem } from '../types';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import {
  loadAutoSellPolicies,
  saveAutoSellPolicies,
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
}

export interface OnlineAutoSellController {
  policies: AutoSellPolicyMap;
  busyProductId: string | null;
  policyFor: (productId: string) => AutoSellPolicy;
  statusFor: (productId: string) => AutoSellProductStatus;
  setPolicy: (productId: string, policy: AutoSellPolicy) => void;
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
      || contract.completedDeliveries >= contract.totalDeliveries
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
  const [policies, setPolicies] = useState<AutoSellPolicyMap>(() => loadAutoSellPolicies(userId));
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const productionReserved = useMemo(() => productionReservations(model.game), [model.game]);
  const contractReserved = useMemo(() => contractReservations(model.game), [model.game]);

  useEffect(() => {
    setPolicies(loadAutoSellPolicies(userId));
  }, [userId]);

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
    return {
      availableInventory,
      productionReserved: production,
      contractReserved: nonNegativeInteger(contract.display),
      minimumFreeInventory,
      eligibleQuantity: Math.max(
        0,
        availableInventory - production - nonNegativeInteger(contract.availableHold) - minimumFreeInventory,
      ),
      blockedByOwnBuy: isOpenCommodityBuy(model.game, productId, true, policy.price),
      hasCrossingBuyer: isOpenCommodityBuy(model.game, productId, false, policy.price),
    };
  }, [contractReserved, model.game, policyFor, productionReserved]);

  const setPolicy = useCallback((productId: string, policy: AutoSellPolicy) => {
    const price = Math.round(Number(policy.price) * 100) / 100;
    const minimumFreeInventory = Number(policy.minimumFreeInventory);
    if (!Number.isFinite(price) || price < 0.01) return;
    if (!Number.isSafeInteger(minimumFreeInventory) || minimumFreeInventory < 0) return;
    const normalized = { enabled: policy.enabled === true, price, minimumFreeInventory };
    setPolicies((current) => {
      const next = { ...current, [productId]: normalized };
      saveAutoSellPolicies(userId, next);
      return next;
    });
    if (normalized.enabled) callbacks.onPolicyEnabled?.(productId);
  }, [callbacks.onPolicyEnabled, userId]);

  useEffect(() => {
    if (busyRef.current) return;
    const candidate = model.game.products.find((product) => {
      const policy = policies[product.id];
      if (!policy?.enabled) return false;
      const status = statusFor(product.id);
      return status.eligibleQuantity > 0 && !status.blockedByOwnBuy && status.hasCrossingBuyer;
    });
    if (!candidate) return;
    const policy = policies[candidate.id];
    if (!policy) return;

    busyRef.current = true;
    setBusyProductId(candidate.id);
    void model.onlineAutoSell(candidate.id, policy.price, policy.minimumFreeInventory)
      .then((result) => {
        if (result.ok) callbacks.onSale?.(candidate.id);
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
