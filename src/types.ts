export interface AuthUser {
  id: number;
  email: string;
  name?: string | null;
  avatar?: string | null;
  role?: 'user' | 'admin';
}

export type ProductCategory = 'raw' | 'intermediate' | 'consumer' | 'industrial';
export type AssetKind = 'commodity' | 'facility';
export type FacilityComplexity = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7';

export interface ProductDefinition {
  id: string;
  name: string;
  category: ProductCategory;
  populationDemandGroupId?: 'food' | 'household';
  populationDemandTier?: 'raw' | 'intermediate' | 'final';
  basePrice: number;
}

export interface ProductInventory {
  available: number;
  frozen: number;
}

export interface FacilityRecipeItem {
  productId: string;
  quantity: number;
}

export type FacilityProductionMethodId =
  | 'standard'
  | 'rapid'
  | 'economical'
  | 'high-yield'
  | 'assisted'
  | 'intensive'
  | 'mechanized';

export interface FacilityProductionMethodPlan {
  recipeId: string;
  baseRecipeId: string;
  productionMethodId: FacilityProductionMethodId;
  cycleMs: number;
  operatingCost: number;
  inputs: FacilityRecipeItem[];
  input?: FacilityRecipeItem | null;
  output: FacilityRecipeItem;
}

export interface FacilityProductionMethodDefinition {
  id: FacilityProductionMethodId;
  name: string;
  description: string;
  tone: 'neutral' | 'warning' | 'success' | 'accent';
  plansByRecipeId: Record<string, FacilityProductionMethodPlan>;
}

export interface FacilityProductionMethodGroupDefinition {
  id: 'operation';
  name: string;
  defaultMethodId: FacilityProductionMethodId;
  methods: FacilityProductionMethodDefinition[];
}

export interface FacilityRecipeDefinition {
  id: string;
  name: string;
  baseRecipeId?: string;
  productionMethodId?: FacilityProductionMethodId;
  cycleMs: number;
  operatingCost: number;
  inputs: FacilityRecipeItem[];
  /** @deprecated Compatibility alias for older single-input states. */
  input?: FacilityRecipeItem | null;
  output: FacilityRecipeItem;
}

export interface FacilityTypeDefinition {
  id: string;
  name: string;
  category: 'raw' | 'processing' | 'consumer' | 'industrial';
  complexity: FacilityComplexity;
  buildCost: number;
  buildInputs?: FacilityRecipeItem[];
  /** @deprecated Instant construction returns 0 to compatible clients. */
  buildTimeMs: number;
  cycleMs: number;
  operatingCost: number;
  inputs: FacilityRecipeItem[];
  /** @deprecated Compatibility alias for older single-input states. */
  input?: FacilityRecipeItem | null;
  output: FacilityRecipeItem;
  defaultRecipeId: string;
  recipes: FacilityRecipeDefinition[];
  productionMethodGroups?: FacilityProductionMethodGroupDefinition[];
  systemValue: number;
}

export type FacilityStatus = 'running' | 'stopped' | 'error';

export type FacilityStatusReason =
  | 'manual'
  | 'insufficient_funds'
  | 'insufficient_input'
  | 'no_available_facility'
  | 'maintenance';

export interface FacilityGroup {
  facilityTypeId: string;
  count: number;
  participatingCount: number;
  /** Production-eligible factories after order-book and auction freezes. Mortgaged factories remain eligible. */
  productionAvailableCount?: number;
  /** Projected integer equivalent capacity if a new full cycle starts now. */
  projectedEffectiveCount?: number;
  listedCount: number;
  auctionedCount?: number;
  frozenCount?: number;
  mortgagedCount: number;
  contractCollateralCount?: number;
  leasedOutCount?: number;
  leasedInCount?: number;
  availableCount: number;
  enabled: boolean;
  status: FacilityStatus;
  statusReason?: FacilityStatusReason;
  /** Current projected cluster staffing rate in basis points, where 10000 = 100%. */
  staffingRateBps?: number;
  /** Server timestamp at which staffingRateBps was projected. */
  staffingUpdatedAt?: number;
  /** Fixed-point equivalent-capacity carry retained between completed cycles. */
  staffingBatchCarryBps?: number;
  cycleStartedAt?: number;
  lifetimeOutput: number;
  activeRecipeId: string;
}

export interface FacilityConstruction {
  facilityTypeId: string;
  startedAt: number;
  completesAt: number;
  buildCost?: number;
  employmentReleased?: number;
  gemAccelerationMs?: number;
  gemAccelerationCost?: number;
}

export interface ResearchLevelDefinition {
  id: FacilityComplexity;
  rank: number;
  cost: number;
  durationMs: number;
}

export interface ResearchTechnologyDefinition {
  id: string;
  name: string;
  stage: FacilityComplexity;
  rank: number;
  cost: number;
  durationMs: number;
  prerequisiteTechnologyIds: string[];
  unlockFacilityTypeIds: string[];
  description: string;
  initial?: boolean;
  legacy?: boolean;
}

export interface ActiveResearch {
  technologyId?: string;
  technologyName?: string;
  targetComplexity: FacilityComplexity;
  startedAt: number;
  completesAt: number;
  durationMs?: number;
  cost: number;
  employmentReleased: number;
  legacy?: boolean;
  grantTechnologyIds?: string[];
  gemAccelerationMs?: number;
  gemAccelerationCost?: number;
}

export interface ResearchState {
  unlockedComplexity: FacilityComplexity;
  completedTechnologyIds?: string[];
  completedAtByTechnologyId?: Record<string, number>;
  completedAt: number | null;
  active: ActiveResearch | null;
}

export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled';
export type OrderOwnerType = 'player' | 'population';

/** Public fill returned to ordinary players. Counterparties and order links stay server-internal. */
export interface OrderFill {
  id: string;
  quantity: number;
  price: number;
  total: number;
  /** Seller-side fee for this fill; buyers receive 0. */
  fee?: number;
  /** Seller proceeds after fee; buyers receive the gross total. */
  netTotal?: number;
  createdAt: number;
}

export interface AssetOrder {
  id: string;
  assetKind: AssetKind;
  assetId: string;
  productId?: string;
  facilityTypeId?: string;
  side: OrderSide;
  /** True only for the authenticated player's own order. */
  isOwn?: boolean;
  /** Server-internal ownership fields are omitted from ordinary player responses. */
  ownerType?: OrderOwnerType;
  ownerId?: number;
  ownerName?: string;
  demandGroupId?: 'food' | 'household';
  demandTier?: 'direct' | 'derived-liquidity' | 'liquidity-buy' | 'liquidity-sell';
  demandCycleId?: number;
  price: number;
  quantity: number;
  remaining: number;
  fills?: OrderFill[];
  status: OrderStatus;
  createdAt: number;
}

export type CommodityOrder = AssetOrder;

/** @deprecated Kept as an empty compatibility shape during the version 10 migration. */
export interface FacilityListing {
  id: string;
  facilityTypeId: string;
  ownerType: 'player' | 'market';
  ownerId?: number;
  ownerName: string;
  quantity: number;
  unitPrice: number;
  createdAt: number;
}

/** Browser-local only. Never included in EconomyState or persisted by the API. */
export interface TradeRecord {
  id: string;
  type: AssetKind;
  productId?: string;
  facilityTypeId?: string;
  side: OrderSide;
  quantity: number;
  price: number;
  total: number;
  fee?: number;
  netTotal?: number;
  createdAt: number;
  description: string;
}

export interface WorkState {
  cooldownUntil: number;
  lastWorkedAt: number;
  streak: number;
  totalClicks: number;
}

export interface DemandState {
  cycleMs: number;
  nextDemandAt: number;
  lastBudget: number;
  lastQuantity: number;
  lastPrice: number;
  satisfaction: number;
  referencePrice: number;
  observedPrice: number;
  costAnchor: number | null;
  downstreamValueAnchor: number | null;
  targetPrice: number;
}

export interface PricePoint {
  price: number;
  quantity: number;
  createdAt: number;
  takerSide?: OrderSide;
}

export interface ProductMarketState {
  productId: string;
  lastPrice: number;
  lastTradePrice: number | null;
  priceHistory: PricePoint[];
  demand: DemandState;
}

export interface FacilityMarketState {
  facilityTypeId: string;
  lastPrice: number;
  lastTradePrice: number | null;
  priceHistory: PricePoint[];
}

export interface EconomyStats {
  workIssued: number;
  populationIssued: number;
  systemSinks: number;
  commodityVolume: number;
  facilityVolume: number;
  workClicks: number;
  producedGoods: number;
  boughtGoods: number;
  soldGoods: number;
  giftIssued: number;
  gemExchangeCredits: number;
  populationIncome: number;
  employmentPayments: number;
  productionPayroll: number;
  constructionPayroll: number;
  facilitiesConstructed?: number;
  constructionMaterialsConsumed?: Record<string, number>;
  warehousePayroll: number;
  marketServiceFees: number;
  researchPayroll?: number;
  bankCreditIssued?: number;
  bankPrincipalRepaid?: number;
  bankInterestPaid?: number;
  bankDepositInterestEarned?: number;
  bankDepositInterestSubsidyIssued?: number;
  weeklyCashSettlementAssessed?: number;
  weeklyCashSettlementCollected?: number;
  weeklyCashSettlementBurned?: number;
  weeklyCashSettlementReserveTransferred?: number;
  bankDefaults?: number;
  bankFacilitiesSeized?: number;
  invitationGemsIssued: number;
  dailyCheckInGemsIssued?: number;
  weeklyFullAttendanceGemsIssued?: number;
  contractDeliveriesCompleted?: number;
  contractGoodsSupplied?: number;
  contractGoodsPurchased?: number;
  contractCreditsPaid?: number;
  contractCreditsReceived?: number;
  contractDefaults?: number;
}

export interface AssetSummary {
  cashValue: number;
  commodityValue: number;
  facilityValue: number;
  bankDepositValue: number;
  contractReceivableValue?: number;
  contractLiabilityValue?: number;
  contractLockedFacilityValue?: number;
  grossAssetValue: number;
  liabilityValue: number;
  netAssetValue: number;
  totalAssets: number;
  availableCashValue?: number;
  frozenCashValue?: number;
  availableCommodityValue?: number;
  frozenCommodityValue?: number;
  availableFacilityValue?: number;
  mortgagedFacilityValue?: number;
  frozenFacilityValue?: number;
  availableAssetValue?: number;
  frozenAssetValue?: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  totalAssets: number;
  cashAssets: number;
  facilityCount: number;
  weeklyChange: number;
  /** @deprecated Request-generation timestamps are no longer delivered in version 22. */
  updatedAt?: number;
  isCurrentPlayer?: boolean;
}

export interface DailyCheckInState {
  timeZone: 'Asia/Shanghai';
  todayKey: string;
  weekKey: string;
  weekStartsAt: number;
  weekEndsAt: number;
  nextResetAt: number;
  dateKeys: string[];
  claimedToday: boolean;
  claimedDateKeys: string[];
  weeklyClaimCount: number;
  weeklyBonusEarned: boolean;
  weeklyBonusEligible: boolean;
  dailyRewardGems: number;
  weeklyBonusGems: number;
}

export type BankLoanStatus = 'active' | 'grace';

export interface BankLoanCollateral {
  facilityTypeId: string;
  quantity: number;
  prudentUnitValue: number;
}

export interface BankLoan {
  id: string;
  status: BankLoanStatus;
  borrowedAt: number;
  dueAt: number;
  graceEndsAt: number;
  principalOriginal: number;
  principalOutstanding: number;
  interestOriginal: number;
  interestOutstanding: number;
  interestRateBps: number;
  collateral: BankLoanCollateral[];
  collateralValueAtOrigination: number;
  ltvBps: number;
  autoRepay: boolean;
}

export interface BankCollateralAvailability {
  facilityTypeId: string;
  totalQuantity: number;
  mortgagedQuantity: number;
  availableQuantity: number;
  prudentUnitValue: number;
}

export interface BankTransaction {
  id: string;
  type: string;
  amount: number;
  createdAt: number;
  description: string;
  loanId?: string;
  principalPaid?: number;
  interestPaid?: number;
  source?: 'cash' | 'deposit';
}

export interface BankAccountState {
  depositCredits: number;
  eligibleDepositCredits: number;
  depositInterestCarryMicros: number;
  totalDepositInterestEarned: number;
  lastDepositInterestEarned: number;
  repaidLoanCount: number;
  recentDefaultAt: number | null;
  activeLoan: BankLoan | null;
  recentTransactions: BankTransaction[];
  availableCollateral: BankCollateralAvailability[];
}

export interface WeeklyCashSettlementRecord {
  id: string;
  type: 'active_week' | 'returning_player';
  weekKey: string;
  closingCurrencyAssets: number;
  loanLiability: number;
  priorSettlementLiability: number;
  taxBase: number;
  rateBps: number;
  amountDue: number;
  amountCollected: number;
  amountOutstanding: number;
  assessedAt: number;
  appliedAt: number | null;
}

export interface WeeklyCashSettlementState {
  version: 1;
  timeZone: 'Asia/Shanghai';
  rateBps: number;
  currentWeekKey: string;
  weekStartsAt: number;
  weekEndsAt: number;
  nextCloseAt: number;
  interestActive: boolean;
  activatedAt: number | null;
  interestEligibleFrom: number | null;
  estimatedTaxBase: number;
  estimatedAssessment: number;
  outstandingCredits: number;
  pendingSettlement: WeeklyCashSettlementRecord | null;
  lastSettlement: WeeklyCashSettlementRecord | null;
}

export interface BankSummaryState {
  nextInterestSettlementAt: number;
  lastDailyInterestCredits: number;
  lastDailyRatePpm: number;
  sevenDayAverageRatePpm: number;
  dailyInterestCapBps: number;
  dailyInterestRateBps?: number;
  interestPoolCredits: number;
  weeklyCashSettlement: WeeklyCashSettlementState;
  loanTermMs: number;
  loanGraceMs: number;
  baseLoanToValueBps: number;
  depositBufferBonusBps: number;
  repaymentHistoryBonusBps: number;
  recentDefaultPenaltyBps: number;
  minimumLoanToValueBps: number;
  maximumLoanToValueBps: number;
}


export interface EconomicCalendarEvent {
  id: string;
  templateId: string;
  title: string;
  description: string;
  announcedAt: number;
  startsAt: number;
  endsAt: number;
  rampMs: number;
  classLabels: string[];
  productIds: string[];
}

export interface EconomicCalendarState {
  version: 2;
  timeZone: 'Asia/Shanghai';
  events: EconomicCalendarEvent[];
}

export interface EconomyState {
  version: 32;
  userId: number;
  playerName: string;
  registeredAt: number;
  saveEpoch: number;
  credits: number;
  frozenCredits: number;
  gems: number;
  checkIn: DailyCheckInState;
  bankAccount: BankAccountState;
  bankSummary: BankSummaryState;
  inventories: Record<string, ProductInventory>;
  warehouseStoredQuantity: number;
  facilityGroups: FacilityGroup[];
  facilityConstruction?: FacilityConstruction;
  researchLevels: ResearchLevelDefinition[];
  researchTechnologies?: ResearchTechnologyDefinition[];
  research: ResearchState;
  products: ProductDefinition[];
  facilityTypes: FacilityTypeDefinition[];
  markets: Record<string, ProductMarketState>;
  facilityMarkets: Record<string, FacilityMarketState>;
  orders: AssetOrder[];
  facilityListings: FacilityListing[];
  valuationPrices: Record<string, number>;
  assetSummary: AssetSummary;
  work: WorkState;
  stats: EconomyStats;
  leaderboard: LeaderboardEntry[];
  leaderboards?: import('./leaderboardTypes').RankedLeaderboardsState;
  economicCalendar?: EconomicCalendarState;
  lastProcessedAt: number;

  inventory: number;
  frozenInventory: number;
  commodityName: string;
  marketPrice: number;
  marketPriceHistory: PricePoint[];
  demand: DemandState;
}

export interface AdminSummary {
  playerCount: number;
  openOrderCount: number;
  commodityOrderCount: number;
  facilityOrderCount: number;
  worldVersion: number;
  revision: number;
  lastProcessedAt: number;
  apiStatus: string;
}

export interface GiftCodeAdminRecord {
  id: number;
  reward_credits: number;
  max_redemptions: number;
  redeemed_count: number;
  starts_at: number;
  expires_at: number | null;
  enabled: boolean;
  created_by: number;
  created_at: number;
  note: string;
}
