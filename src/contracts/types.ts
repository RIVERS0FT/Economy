import type { EconomyState } from '../types';

export type ProductionContractRole = 'buyer' | 'supplier';
export type ProductionContractStatus = 'open' | 'active' | 'completed' | 'cancelled' | 'terminated' | 'expired';
export type ProductionContractRoundStatus = 'preparing' | 'ready' | 'grace';

export interface ProductionContract {
  id: string;
  publisherId: number;
  publisherName: string;
  publisherRole: ProductionContractRole;
  buyerId: number | null;
  buyerName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  productId: string;
  quantityPerDelivery: number;
  unitPrice: number;
  batchGross: number;
  deliveryIntervalMs: number;
  totalDeliveries: number;
  completedDeliveries: number;
  firstDeliveryDelayMs: number;
  createdAt: number;
  offerExpiresAt: number;
  acceptedAt?: number;
  nextDueAt: number | null;
  graceEndsAt?: number;
  status: ProductionContractStatus;
  roundStatus: ProductionContractRoundStatus;
  buyerEscrowCredits: number;
  supplierReservedQuantity: number;
  buyerBondCredits: number;
  supplierBondCredits: number;
  buyerAutoFund: boolean;
  supplierAutoReserve: boolean;
  terminationRequestedBy?: number;
  terminationReason?: string;
  endedAt?: number;
  completedAt?: number;
  issue: string | null;
  isPublisher: boolean;
  isBuyer: boolean;
  isSupplier: boolean;
}

export interface ProductionContractSummary {
  active: number;
  open: number;
  needsAttention: number;
  upcomingWithin24Hours: number;
}

export interface ProductionContractState {
  productionContracts: ProductionContract[];
  productionContractSummary: ProductionContractSummary;
}

const EMPTY_SUMMARY: ProductionContractSummary = {
  active: 0,
  open: 0,
  needsAttention: 0,
  upcomingWithin24Hours: 0,
};

export function productionContractStateFromGame(game: EconomyState): ProductionContractState {
  const state = game as EconomyState & Partial<ProductionContractState>;
  return {
    productionContracts: Array.isArray(state.productionContracts) ? state.productionContracts : [],
    productionContractSummary: state.productionContractSummary ?? EMPTY_SUMMARY,
  };
}
