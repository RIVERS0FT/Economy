export interface AuthUser {
  id: number;
  email: string;
  name?: string | null;
  avatar?: string | null;
  role?: 'user' | 'admin';
}

export type FacilityStatus =
  | 'constructing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'full'
  | 'insufficient_funds'
  | 'listed';

export interface ProductionFacility {
  id: string;
  name: string;
  ownerId: number;
  level: number;
  status: FacilityStatus;
  builtAt: number;
  constructionCompletesAt?: number;
  cycleStartedAt?: number;
  cycleMs: number;
  outputPerCycle: number;
  operatingCost: number;
  internalGoods: number;
  internalCapacity: number;
  lifetimeOutput: number;
  systemValue: number;
  listedOrderId?: string;
}

export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled';
export type OrderOwnerType = 'player' | 'population' | 'market';

export interface CommodityOrder {
  id: string;
  side: OrderSide;
  ownerType: OrderOwnerType;
  ownerId?: number;
  ownerName: string;
  price: number;
  quantity: number;
  remaining: number;
  status: OrderStatus;
  createdAt: number;
}

export interface FacilityListing {
  id: string;
  facilityId: string;
  ownerType: 'player' | 'market';
  ownerId?: number;
  ownerName: string;
  price: number;
  createdAt: number;
  facility: Pick<
    ProductionFacility,
    'name' | 'level' | 'cycleMs' | 'outputPerCycle' | 'operatingCost' | 'internalCapacity' | 'lifetimeOutput' | 'systemValue'
  >;
}

export interface TradeRecord {
  id: string;
  type: 'commodity' | 'facility';
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  counterparty: string;
  createdAt: number;
  description: string;
}

export type LedgerCategory =
  | 'work_income'
  | 'population_income'
  | 'market_trade'
  | 'facility_trade'
  | 'facility_construction'
  | 'facility_operation'
  | 'facility_sale'
  | 'inventory'
  | 'system';

export interface LedgerEntry {
  id: string;
  category: LedgerCategory;
  amount: number;
  balanceAfter: number;
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
  population: number;
  cycleMs: number;
  nextDemandAt: number;
  lastBudget: number;
  lastQuantity: number;
  lastPrice: number;
  satisfaction: number;
}

export interface EconomyStats {
  workIssued: number;
  populationIssued: number;
  systemSinks: number;
  commodityVolume: number;
  facilityVolume: number;
}

export interface PricePoint {
  price: number;
  quantity: number;
  createdAt: number;
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
  version: 3;
  userId: number;
  playerName: string;
  registeredAt: number;
  credits: number;
  frozenCredits: number;
  inventory: number;
  frozenInventory: number;
  inventoryCapacity: number;
  facilitySlots: number;
  facilities: ProductionFacility[];
  commodityName: string;
  orders: CommodityOrder[];
  facilityListings: FacilityListing[];
  trades: TradeRecord[];
  ledger: LedgerEntry[];
  work: WorkState;
  demand: DemandState;
  stats: EconomyStats;
  marketPrice: number;
  marketPriceHistory: PricePoint[];
  leaderboard: LeaderboardEntry[];
  lastProcessedAt: number;
}
