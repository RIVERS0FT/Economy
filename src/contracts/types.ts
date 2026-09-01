import type { EconomyState } from '../types';

export type ProductionContractRole = 'buyer' | 'supplier';
export type ContractKind = 'supply' | 'loan' | 'facility_lease';
export type ContractPublisherSide = ProductionContractRole | 'lender' | 'borrower' | 'lessor' | 'lessee';
export type ProductionContractStatus = 'open' | 'active' | 'completed' | 'cancelled' | 'terminated' | 'expired';
export type ProductionContractRoundStatus = 'preparing' | 'ready' | 'grace';
export type ContractAuditCompleteness = 'full' | 'legacy_partial';

export interface ProductionContractNegotiationTerms {
  dailyMaxQuantity: number;
  unitPrice: number;
  durationDays: number | null;
  startDelayDays: number;
}
export interface ProductionContractNegotiation {
  id: string;
  revision: number;
  terms: ProductionContractNegotiationTerms;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  proposerName: string | null;
  isProposer: boolean;
  awaitingMyResponse: boolean;
}
export interface ProductionContractRenewalProposal {
  id: string;
  status: 'proposed' | 'accepted' | 'activated';
  revision: number;
  proposedBy: number;
  proposedAt: number;
  expiresAt: number;
  buyerApprovedAt?: number;
  supplierApprovedAt?: number;
  confirmedAt?: number;
  activatedAt?: number;
  activatedContractId?: string;
  isProposer?: boolean;
  buyerApproved?: boolean;
  supplierApproved?: boolean;
  approvedByMe?: boolean;
  awaitingMyApproval?: boolean;
  terms: {
    quantityPerDelivery: number;
    unitPrice: number;
    deliveryIntervalMs: number;
    totalDeliveries: number | null;
    firstDeliveryDelayMs: number;
  };
  buyerEscrowCredits: number;
  buyerBondCredits: number;
  supplierBondCredits: number;
  supplierReservedQuantity: number;
}
export interface SupplyPriorityCondition {
  enabled: boolean;
  minDailyProduction: number;
  minContractPrice: number;
}

export interface ProductionContract {
  id: string;
  kind: ContractKind;
  publisherSide: ContractPublisherSide;
  publisherId: number;
  publisherName: string;
  publisherType?: 'player' | 'market_reserve';
  fixedTerms?: boolean;
  publisherRole: ProductionContractRole;
  buyerId: number | null;
  buyerName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  provinceId?: string;
  productId: string;
  unitPrice: number;
  createdAt: number;
  offerExpiresAt: number;
  acceptedAt?: number;
  nextDueAt: number | null;
  graceEndsAt?: number;
  breachedAt?: number;
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
  isParticipant?: boolean;

  supplyMode?: 'daily';
  contractSchemaVersion?: number;
  dailyMaxQuantity?: number;
  dailyUsedQuantity?: number;
  dailyRemainingQuantity?: number;
  dailyGrossLimit?: number;
  totalDeliveredQuantity?: number;
  completedDeliveryEvents?: number;
  lastDeliveryQuantity?: number;
  durationDays?: number | null;
  startDelayDays?: number;
  startsAt?: number | null;
  endsAt?: number | null;
  prioritySupply?: SupplyPriorityCondition;
  negotiations?: ProductionContractNegotiation[];

  /** Legacy finite-batch supply compatibility. */
  quantityPerDelivery: number;
  batchGross: number;
  deliveryIntervalMs: number;
  totalDeliveries: number | null;
  completedDeliveries: number;
  firstDeliveryDelayMs: number;
  renewalProposal?: ProductionContractRenewalProposal | null;
  renewedFromContractId?: string;
  renewedToContractId?: string;
  renewalCancellationReason?: string;

  lenderId?: number | null;
  lenderName?: string | null;
  borrowerId?: number | null;
  borrowerName?: string | null;
  principal?: number;
  principalOutstanding?: number;
  interestRateBps?: number;
  interestDue?: number;
  termMs?: number;
  termDays?: number;
  dueAt?: number | null;
  collateralQuantity?: number;
  collateralUnitValue?: number;
  collateralTransferredQuantity?: number;
  defaultCollateralQuantity?: number;
  defaultCollateralUnitValue?: number;
  autoRepay?: boolean;
  isLender?: boolean;
  isBorrower?: boolean;

  lessorId?: number | null;
  lessorName?: string | null;
  lesseeId?: number | null;
  lesseeName?: string | null;
  facilityTypeId?: string;
  quantity?: number;
  rentPerPeriod?: number;
  periodMs?: number;
  periodDays?: number;
  totalPeriods?: number;
  completedPeriods?: number;
  firstPeriodDelayMs?: number;
  firstPeriodDelayDays?: number;
  lesseeEscrowCredits?: number;
  lesseeBondCredits?: number;
  lessorBondCredits?: number;
  autoFund?: boolean;
  isLessor?: boolean;
  isLessee?: boolean;
}

export type ContractCompletionUnit = 'delivery' | 'quantity' | 'repayment' | 'lease_period';
export interface ContractEndSettlementSummary {
  grossTotal: number;
  feeTotal: number;
  netTotal: number;
  goodsDelivered: number;
  loanPrincipalDisbursed: number;
  loanRepaid: number;
  leaseRentPaid: number;
  compensationPaidByMe: number;
  compensationReceivedByMe: number;
  refundedCreditsToMe: number;
  refundedGoodsToMe: number;
  collateralReceivedByMe: number;
  collateralReturnedToMe: number;
}
export interface ContractEndSummary {
  reasonCode: string;
  endedAt: number;
  completion: { completed: number; total: number | null; unit: ContractCompletionUnit; ratioBps: number | null };
  settlement: ContractEndSettlementSummary;
}
export interface ContractAuditHistoryItem extends Omit<ProductionContract, 'issue'> {
  issue: string | null;
  auditCompleteness: ContractAuditCompleteness;
  lastEventSequence: number;
  lastEventAt: number;
  grossTotal: number;
  feeTotal: number;
  netTotal: number;
  transferredGoods: number;
  compensationTotal: number;
  endSummary: ContractEndSummary;
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
export interface ContractAuditHistoryPage { items: ContractAuditHistoryItem[]; nextCursor: string | null }
export interface ContractPerformanceRecentItem { id: string; kind: ContractKind; status: ProductionContractStatus; endedAt: number; reasonCode: string; completionRatioBps: number }
export interface ContractPerformanceSummary { totalEnded: number; completed: number; abnormalEnded: number; defaulted: number; completionRateBps: number; compensationPaid: number; compensationReceived: number; recent: ContractPerformanceRecentItem[] }
export interface ContractAuditDetail { contract: ContractAuditHistoryItem; events: ContractAuditEvent[]; nextCursor: string | null }
export interface ProductionContractSummary { active: number; open: number; needsAttention: number; upcomingWithin24Hours: number }
export interface ProductionContractState { productionContracts: ProductionContract[]; productionContractSummary: ProductionContractSummary }

export function productionContractStateFromGame(game: EconomyState): ProductionContractState {
  return {
    productionContracts: game.productionContracts ?? [],
    productionContractSummary: game.productionContractSummary ?? { active: 0, open: 0, needsAttention: 0, upcomingWithin24Hours: 0 },
  };
}
