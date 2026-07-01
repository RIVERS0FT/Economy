export type ResourceId = 'grain' | 'ore' | 'textile' | 'energy';

export type Inventory = Record<ResourceId, number>;

export type GamePhase = 'lobby' | 'planning' | 'trade' | 'contract' | 'roundEnd' | 'finished';

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'error';

export interface MarketGood {
  id: ResourceId;
  name: string;
  icon: string;
  price: number;
  trend: number;
}

export interface Contract {
  id: string;
  title: string;
  description: string;
  requirements: Partial<Inventory>;
  rewardCredits: number;
  rewardReputation: number;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isLocal: boolean;
  online: boolean;
  credits: number;
  reputation: number;
  inventory: Inventory;
  contractsCompleted: number;
  productionFocus: ResourceId;
}

export interface MultiplayerSession {
  roomCode: string;
  serverUrl: string;
  status: ConnectionStatus;
  localPlayerId: string;
  hostPlayerId: string;
  lastSyncedAt?: number;
  error?: string;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  giveCredits: number;
  receiveCredits: number;
  giveItems: Partial<Inventory>;
  receiveItems: Partial<Inventory>;
  message: string;
  round: number;
  status: TradeStatus;
}

export interface GameLogEntry {
  id: string;
  round: number;
  text: string;
  tone: 'info' | 'success' | 'warning' | 'trade' | 'network';
}

export interface GameState {
  round: number;
  maxRounds: number;
  targetReputation: number;
  phase: GamePhase;
  session: MultiplayerSession;
  players: Player[];
  market: MarketGood[];
  contracts: Contract[];
  tradeOffers: TradeOffer[];
  log: GameLogEntry[];
  winnerId?: string;
}
