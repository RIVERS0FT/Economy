export interface AuthUser {
  id: number;
  email: string;
  name?: string | null;
  avatar?: string | null;
  role?: 'user' | 'admin';
}

export type FactoryStatus =
  | 'constructing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'full'
  | 'insufficient_funds'
  | 'listed';

export interface Factory {
  id: string;
  name: string;
  ownerId: number;
  level: number;
  status: FactoryStatus;
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

export interface FactoryListing {
  id: string;
  factoryId: string;
  ownerType: 'player' | 'market';
  ownerId?: number;
  ownerName: string;
  price: number;
  createdAt: number;
  factory: Pick<Factory, 'name' | 'level' | 'cycleMs' | 'outputPerCycle' | 'operatingCost' | 'internalCapacity' | 'lifetimeOutput' | 'systemValue'>;
}

export interface TradeRecord {
  id: string;
  type: 'commodity' | 'factory';
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
  | 'factory_trade'
  | 'factory_construction'
  | 'factory_operation'
  | 'factory_sale'
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

export interface PopulationState {
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
  factoryVolume: number;
}

export interface EconomyState {
  version: 2;
  userId: number;
  companyName: string;
  credits: number;
  frozenCredits: number;
  inventory: number;
  frozenInventory: number;
  warehouseCapacity: number;
  factorySlots: number;
  factories: Factory[];
  commodityName: string;
  orders: CommodityOrder[];
  factoryListings: FactoryListing[];
  trades: TradeRecord[];
  ledger: LedgerEntry[];
  work: WorkState;
  population: PopulationState;
  stats: EconomyStats;
  marketPrice: number;
  lastProcessedAt: number;
}
