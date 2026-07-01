export type ResourceId = 'grain' | 'ore' | 'textile' | 'energy';

export type Inventory = Record<ResourceId, number>;

export type GamePhase = 'lobby' | 'playing' | 'paused' | 'finished';

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'error';

export type UnitKind = 'scout' | 'carrier' | 'guard';

export type StructureKind = 'hq' | 'farm' | 'mine' | 'plant' | 'exchange';

export interface MarketGood {
  id: ResourceId;
  name: string;
  icon: string;
  price: number;
  trend: number;
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
  unitCap: number;
  defeated: boolean;
}

export interface MapNode {
  id: string;
  name: string;
  x: number;
  y: number;
  resource: ResourceId;
  ownerPlayerId?: string;
  capture: Record<string, number>;
}

export interface Unit {
  id: string;
  ownerPlayerId: string;
  kind: UnitKind;
  name: string;
  x: number;
  y: number;
  targetNodeId?: string;
  hp: number;
  speed: number;
  cargo: Inventory;
}

export interface Structure {
  id: string;
  ownerPlayerId: string;
  nodeId: string;
  kind: StructureKind;
  level: number;
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
  tick: number;
  status: TradeStatus;
}

export interface GameLogEntry {
  id: string;
  tick: number;
  text: string;
  tone: 'info' | 'success' | 'warning' | 'trade' | 'network' | 'combat';
}

export interface GameState {
  tick: number;
  elapsedSeconds: number;
  maxSeconds: number;
  targetReputation: number;
  phase: GamePhase;
  session: MultiplayerSession;
  players: Player[];
  market: MarketGood[];
  mapNodes: MapNode[];
  units: Unit[];
  structures: Structure[];
  tradeOffers: TradeOffer[];
  log: GameLogEntry[];
  winnerId?: string;
}
