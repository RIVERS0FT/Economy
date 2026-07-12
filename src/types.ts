export interface AuthUser {
  id: number;
  email: string;
  name?: string | null;
  avatar?: string | null;
  role?: 'user' | 'admin';
}

export type ProductCategory = 'raw' | 'intermediate' | 'consumer' | 'industrial';
export type AssetKind = 'commodity' | 'facility';

export interface ProductDefinition {
  id: string;
  name: string;
  category: ProductCategory;
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

export interface FacilityTypeDefinition {
  id: string;
  name: string;
  category: 'raw' | 'processing' | 'consumer' | 'industrial';
  buildCost: number;
  buildTimeMs: number;
  cycleMs: number;
  operatingCost: number;
  input: FacilityRecipeItem | null;
  output: FacilityRecipeItem;
  systemValue: number;
}

export type FacilityStatus = 'running' | 'stopped' | 'error';

export type FacilityStatusReason =
  | 'manual'
  | 'plan_complete'
  | 'plan_adjustment_required'
  | 'insufficient_funds'
  | 'insufficient_input'
  | 'warehouse_full'
  | 'no_available_facility'
  | 'maintenance';

export interface PendingProductionPlan {
  mode: ProductionMode;
  targetQuantity?: number;
  requestedAt: number;
}

export type ProductionMode = 'continuous' | 'target';

export interface FacilityGroup {
  facilityTypeId: string;
  count: number;
  participatingCount: number;
  pendingJoinCount: number;
  listedCount: number;
  availableCount: number;
  nextCycleCount: number;
  enabled: boolean;
  status: FacilityStatus;
  statusReason?: FacilityStatusReason;
  cycleStartedAt?: number;
  productionMode: ProductionMode;
  targetQuantity?: number;
  completedQuantity: number;
  pendingProductionPlan?: PendingProductionPlan;
}

export interface FacilityConstruction {
  facilityTypeId: string;
  startedAt: number;
  completesAt: number;
}

export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled';
export type OrderOwnerType = 'player' | 'population' | 'market';

export interface OrderFill {
  id: string;
  quantity: number;
  price: number;
  total: number;
  counterparty: string;
  createdAt: number;
  makerOrderId: string;
  takerOrderId: string;
  liquidity: 'maker' | 'taker';
}

export interface AssetOrder {
  id: string;
  assetKind: AssetKind;
  assetId: string;
  productId?: string;
  facilityTypeId?: string;
  side: OrderSide;
  ownerType: OrderOwnerType;
  ownerId?: number;
  ownerName: string;
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
  counterparty: string;
  createdAt: number;
  description: string;
}

export type AssetEventCategory =
  | 'work'
  | 'order'
  | 'trade'
  | 'inventory'
  | 'warehouse'
  | 'facility'
  | 'production'
  | 'system';

export interface AssetInventoryChange {
  productId: string;
  availableDelta: number;
  frozenDelta: number;
  availableAfter: number;
  frozenAfter: number;
}

export interface AssetWarehouseChange {
  beforeLevel: number;
  afterLevel: number;
  beforeCapacity: number;
  afterCapacity: number;
  capacityDelta: number;
}

export interface AssetFacilityChange {
  facilityTypeId: string;
  facilityName?: string;
  action:
    | 'construction_started'
    | 'construction_completed'
    | 'acquired'
    | 'sold'
    | 'listed'
    | 'unlisted'
    | 'plan_updated'
    | 'started'
    | 'stopped'
    | 'status_changed'
    | 'removed'
    | 'updated';
  beforeStatus?: FacilityStatus;
  afterStatus?: FacilityStatus;
  beforeCount: number;
  afterCount: number;
  countDelta: number;
}

export interface AssetProductionChange {
  facilityTypeId: string;
  facilityName?: string;
  action: 'produced';
  inputProductId?: string;
  inputQuantity: number;
  outputProductId?: string;
  outputQuantity: number;
  completedQuantityDelta: number;
}

/** Browser-local only. Derived from two authoritative state snapshots. */
export interface AssetEvent {
  id: string;
  category: AssetEventCategory;
  createdAt: number;
  description: string;
  cashDelta: number;
  availableCashAfter: number;
  frozenCashDelta: number;
  frozenCashAfter?: number;
  inventoryChanges: AssetInventoryChange[];
  warehouseChange?: AssetWarehouseChange;
  facilityChanges: AssetFacilityChange[];
  productionChanges: AssetProductionChange[];
  sourceType?: 'order' | 'trade' | 'warehouse' | 'facility' | 'production' | 'work' | 'system';
  sourceId?: string;
  localOnly: true;
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
}

export interface PricePoint {
  price: number;
  quantity: number;
  createdAt: number;
}

export interface ProductMarketState {
  productId: string;
  lastPrice: number;
  priceHistory: PricePoint[];
  demand: DemandState;
}

export interface FacilityMarketState {
  facilityTypeId: string;
  lastPrice: number;
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
}

export interface AssetSummary {
  cashValue: number;
  commodityValue: number;
  facilityValue: number;
  totalAssets: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  totalAssets: number;
  cashAssets: number;
  facilityCount: number;
  weeklyChange: number;
  updatedAt: number;
  isCurrentPlayer?: boolean;
}

export interface EconomyState {
  version: 11;
  userId: number;
  playerName: string;
  registeredAt: number;
  credits: number;
  frozenCredits: number;
  inventories: Record<string, ProductInventory>;
  inventoryCapacity: number;
  warehouseLevel: number;
  warehouseUpgradeCost: number | null;
  warehouseNextCapacity: number;
  warehouseNextCapacityIncrease: number;
  warehouseStoredQuantity: number;
  warehouseReservedQuantity: number;
  warehouseUsedCapacity: number;
  warehouseAvailableCapacity: number;
  facilityGroups: FacilityGroup[];
  facilityConstruction?: FacilityConstruction;
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
