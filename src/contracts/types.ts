import type { EconomyState } from '../types';

export type ProductionContractRole = 'buyer' | 'supplier';
export type ProductionContractStatus = 'open' | 'active' | 'completed' | 'cancelled' | 'terminated' | 'expired';
export type ProductionContractRoundStatus = 'preparing' | 'ready' | 'grace';
export type ContractAuditCompleteness = 'full' | 'legacy_partial';


export interface ProductionContractRenewalProposal {
  id: string;
  status: 'proposed' | 'accepted' | 'activated';
  proposedBy: number;
  proposedAt: number;
  expiresAt: number;
  acceptedBy?: number;
  acceptedAt?: number;
  activatedAt?: number;
  activatedContractId?: string;
  isProposer?: boolean;
  terms: {
    quantityPerDelivery: number;
    unitPrice: number;
    deliveryIntervalMs: number;
    totalDeliveries: number;
    firstDeliveryDelayMs: number;
  };
  buyerEscrowCredits: number;
  buyerBondCredits: number;
  supplierBondCredits: number;
  supplierReservedQuantity: number;
}

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
  renewalProposal?: ProductionContractRenewalProposal | null;
  renewedFromContractId?: string;
  renewedToContractId?: string;
  renewalCancellationReason?: string;
  terminationRequestedBy?: number;
  terminationReason?: string;
  endedAt?: number;
  completedAt?: number;
  issue: string | null;
  isPublisher: boolean;
  isBuyer: boolean;
  isSupplier: boolean;
}

export interface ContractAuditHistoryItem extends Omit<ProductionContract, 'issue'> {
  issue?: string | null;
  auditCompleteness: ContractAuditCompleteness;
  lastEventSequence: number;
  lastEventAt: number;
  grossTotal: number;
  feeTotal: number;
  netTotal: number;
  transferredGoods: number;
  compensationTotal: number;
}

export interface ContractAuditTransfer {
  assetType: 'credits' | 'commodity';
  productId: string | null;
  quantity: number;
  fromType: string;
  fromId: number | null;
  fromAccount: string;
  toType: string;
  toId: number | null;
  toAccount: string;
  purpose: string;
}

export interface ContractAuditEvent {
  sequence: number;
  eventType: string;
  actorType: 'player' | 'system';
  actorUserId: number | null;
  triggerType: string;
  action: string | null;
  batchNumber: number | null;
  reasonCode: string | null;
  occurredAt: number;
  metadata: Record<string, unknown>;
  transfers: ContractAuditTransfer[];
}

export interface ContractAuditHistoryPage {
  items: ContractAuditHistoryItem[];
  nextCursor: string | null;
}

export interface ContractAuditDetail {
  contract: ContractAuditHistoryItem;
  events: ContractAuditEvent[];
  nextCursor: string | null;
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
