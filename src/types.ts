import type { CommercialStateFields } from './types/commercial';
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

export interface ProvinceDefinition {
  id: string;
  name: string;
  shortName: string;
  mapName: string;
  longitude: number;
  latitude: number;
  capitalName: string;
  capitalMapName: string;
  capitalLongitude: number;
  capitalLatitude: number;
}

export interface ProvinceAssetSummary {
  provinceId: string;
  storedQuantity: number;
  facilityCount: number;
  runningFacilityCount: number;
  blockedFacilityCount: number;
  openOrderCount: number;
}

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
  /** Quantity currently in transit from this state to another unlocked state. */
  inTransit: number;
}

export interface FacilityRecipeItem {
  productId: string;
  quantity: number;
}

export type FacilityProductionMethodId = string;
export type FacilityProductionMethodIconId = string;

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
  iconId: FacilityProductionMethodIconId;
  description: string;
  tone: 'neutral' | 'warning' | 'success' | 'accent';
  requiredTechnologyIds?: string[];
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
  provinceId: string;
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
  /** Raw authoritative staffing rate used only to construct a production settlement proposal. */
  productionSettlementStaffingRateBps?: number;
  /** Raw authoritative staffing timestamp used only to construct a production settlement proposal. */
  productionSettlementStaffingUpdatedAt?: number;
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
  kind?: 'production' | 'operation';
  operationProductIds?: string[];
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

export type TransportModeId = 'road' | 'rail' | 'air';
export type TransportShipmentStatus = 'in-transit' | 'docked' | 'arrived';
export type TransportTripType = 'round' | 'one-way';

export interface TransportStopPlanEntry {
  provinceId: string;
  arrivesAt: number;
  deliveredAt?: number | null;
}

export interface TransportManifestItem {
  productId: string;
  destinationProvinceId: string;
  quantity: number;
}

export interface TransportLegPlanEntry {
  fromProvinceId: string;
  toProvinceId: string;
  departsAt: number;
  arrivesAt: number;
  remainingLoad: number;
}

export interface TransportRoute {
  id: string;
  name: string;
  setupCost: number;
  sourceProvinceId: string;
  destinationProvinceId: string;
  viaProvinceIds?: string[];
  tripType?: TransportTripType;
  mode: TransportModeId;
  cycleDistanceKm?: number;
  cycleTransportFee?: number;
  cycleFuelCost?: number;
  cycleCost?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TransportShipment {
  id: string;
  cycleId?: string;
  routeId?: string;
  routeName?: string;
  sourceProvinceId: string;
  destinationProvinceId: string;
  viaProvinceIds?: string[];
  tripType?: TransportTripType;
  stopPlan: TransportStopPlanEntry[];
  legPlan: TransportLegPlanEntry[];
  manifest: TransportManifestItem[];
  mode: TransportModeId;
  cost: number;
  transportFee?: number;
  fuelCost?: number;
  fuelPurchased?: number;
  fuelConsumed?: number;
  cycleDistanceKm?: number;
  currentProvinceId?: string;
  currentVisitIndex?: number;
  departsAt: number;
  arrivesAt: number;
  status: TransportShipmentStatus;
  createdAt: number;
  arrivedAt?: number;
}

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
  provinceId: string;
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
  provinceId?: string;
  side: OrderSide;
  quantity: number;
  price: number;
  total: number;
  fee?: number;
  netTotal?: number;
  createdAt: number;
  description: string;
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

export interface MarketDailyHistoryPoint {
  dateKey: string;
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  neutralVolume?: number;
}

export interface ProductMarketState {
  productId: string;
  provinceId?: string;
  lastPrice: number;
  lastTradePrice: number | null;
  /** Current state-product daily official price used for immediate player trades. */
  officialPrice?: number;
  /** Server timestamp of the next Beijing-midnight daily price adjustment. */
  nextPriceAt?: number;
  /** Quantity the system sold to players during the current Beijing calendar day. */
  todayBuyQuantity?: number;
  /** Quantity the system bought from players during the current Beijing calendar day. */
  todaySellQuantity?: number;
  /** @deprecated Server-only five-minute migration alias; not shipped in normal market summaries. */
  cycleBuyQuantity?: number;
  /** @deprecated Server-only five-minute migration alias; not shipped in normal market summaries. */
  cycleSellQuantity?: number;
  /** @deprecated Server-side pricing diagnostic; normal client summaries omit it. */
  lastImbalance?: number;
  /** Last daily official price change in signed basis points. */
  lastPriceChangeBps?: number;
  /** Full history is loaded only for the actively viewed market in client state version 38. */
  priceHistory?: PricePoint[];
  /** Fixed Beijing-calendar-day trend history for the latest 30 days. */
  dailyHistory?: MarketDailyHistoryPoint[];
  demand?: Partial<DemandState>;
  priceChange24h?: number | null;
  tradeVolume24h?: number;
  tradeCount24h?: number;
  previousTradePrice?: number | null;
  lastTradeAt?: number | null;
  buyVolume?: number;
  sellVolume?: number;
  buyOrderCount?: number;
  sellOrderCount?: number;
  bestBid?: number | null;
  bestAsk?: number | null;
  eventTradeWindows?: Record<string, {
    tradeCount: number;
    volume: number;
    firstPrice: number | null;
    lastPrice: number | null;
  }>;
}

export interface FacilityMarketState {
  facilityTypeId: string;
  provinceId?: string;
  lastPrice: number;
  lastTradePrice: number | null;
  /** Full history is loaded only for the actively viewed market in client state version 38. */
  priceHistory?: PricePoint[];
  /** Fixed Beijing-calendar-day trend history for the latest 30 days. */
  dailyHistory?: MarketDailyHistoryPoint[];
  priceChange24h?: number | null;
  tradeVolume24h?: number;
  tradeCount24h?: number;
  previousTradePrice?: number | null;
  lastTradeAt?: number | null;
  buyVolume?: number;
  sellVolume?: number;
  buyOrderCount?: number;
  sellOrderCount?: number;
  bestBid?: number | null;
  bestAsk?: number | null;
}

export interface MarketOrderBookLevel {
  side: OrderSide;
  price: number;
  remaining: number;
  orderCount: number;
}

export interface MarketDetail {
  provinceId: string;
  assetKind: AssetKind;
  assetId: string;
  revision: string;
  market: ProductMarketState | FacilityMarketState;
  orderBook: {
    bids: MarketOrderBookLevel[];
    asks: MarketOrderBookLevel[];
  };
}

export interface EconomyStats {
  populationIssued: number;
  systemSinks: number;
  commodityVolume: number;
  facilityVolume: number;
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
  commercialValue?: number;
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
  provinceId: string;
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
  provinceId: string;
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

export interface EconomyState extends CommercialStateFields {
  version: 40;
  userId: number;
  playerName: string;
  startingProvinceId: string;
  startingProvinceChosen: boolean;
  unlockedProvinces: string[];
  registeredAt: number;
  saveEpoch: number;
  credits: number;
  frozenCredits: number;
  gems: number;
  checkIn: DailyCheckInState;
  bankAccount: BankAccountState;
  bankSummary: BankSummaryState;
  inventories: Record<string, ProductInventory>;
  provinces: ProvinceDefinition[];
  defaultProvinceId: string;
  provinceInventories: Record<string, Record<string, ProductInventory>>;
  provinceAssetSummaries: Record<string, ProvinceAssetSummary>;
  warehouseStoredQuantity: number;
  facilityGroups: FacilityGroup[];
  provinceFacilityGroups: Record<string, FacilityGroup[]>;
  facilityConstruction?: FacilityConstruction;
  researchLevels: ResearchLevelDefinition[];
  researchTechnologies?: ResearchTechnologyDefinition[];
  research: ResearchState;
  products: ProductDefinition[];
  facilityTypes: FacilityTypeDefinition[];
  markets: Record<string, ProductMarketState>;
  provinceMarkets: Record<string, Record<string, ProductMarketState>>;
  facilityMarkets: Record<string, FacilityMarketState>;
  provinceFacilityMarkets: Record<string, Record<string, FacilityMarketState>>;
  orders: AssetOrder[];
  transportRoutes?: TransportRoute[];
  transportShipments: TransportShipment[];
  facilityListings: FacilityListing[];
  valuationPrices: Record<string, number>;
  assetSummary: AssetSummary;
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
