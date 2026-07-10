import {
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { logout } from '../api/auth';
import { type TabId } from '../config/navigation';
import { useGameStore } from '../store/gameStore';
import type {
  AuthUser,
  CommodityOrder,
  EconomyState,
  FacilityListing,
  FacilityStatus,
  LeaderboardEntry,
  OrderSide,
  OrderStatus,
} from '../types';

export const facilityStatusNames: Record<FacilityStatus, string> = {
  constructing: '施工中',
  ready: '待启用',
  running: '生产中',
  paused: '已暂停',
  full: '商品已满',
  insufficient_funds: '资金不足',
  listed: '挂牌中',
};

export const orderStatusNames: Record<OrderStatus, string> = {
  open: '等待成交',
  partial: '部分成交',
  filled: '全部成交',
  cancelled: '已取消',
};

export interface DerivedGameData {
  ownOpenOrders: CommodityOrder[];
  ownListings: FacilityListing[];
  bids: CommodityOrder[];
  asks: CommodityOrder[];
  facilityValue: number;
  commodityValue: number;
  cashValue: number;
  totalAssets: number;
  currentRank?: LeaderboardEntry;
  previousRank: LeaderboardEntry | null;
  bestBid: number;
  bestAsk: number;
  spread: number;
  pendingGoods: number;
  runningFacilities: number;
  constructingFacilities: number;
  averageCost: number;
  history: number[];
  marketTrend: number;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface LoadedGameViewModel {
  user: AuthUser;
  game: EconomyState;
  derived: DerivedGameData;
  tab: TabId;
  setTab: Dispatch<SetStateAction<TabId>>;
  notice: string;
  orderSide: OrderSide;
  setOrderSide: Dispatch<SetStateAction<OrderSide>>;
  orderQuantity: number;
  setOrderQuantity: Dispatch<SetStateAction<number>>;
  orderPrice: number;
  setOrderPrice: Dispatch<SetStateAction<number>>;
  listingPrices: Record<string, number>;
  setListingPrices: Dispatch<SetStateAction<Record<string, number>>>;
  playerName: string;
  setPlayerName: Dispatch<SetStateAction<string>>;
  soundEnabled: boolean;
  setSoundEnabled: Dispatch<SetStateAction<boolean>>;
  compactNumbers: boolean;
  setCompactNumbers: Dispatch<SetStateAction<boolean>>;
  refreshRate: string;
  setRefreshRate: Dispatch<SetStateAction<string>>;
  now: number;
  workRemaining: number;
  inventoryUsed: number;
  cashShare: number;
  commodityShare: number;
  facilityShare: number;
  allocationStyle: CSSProperties;
  avatarText: string;
  showResult: (result: ActionResult) => void;
  notify: (message: string) => void;
  signOut: () => Promise<void>;
  work: () => ActionResult;
  buildFacility: () => ActionResult;
  startFacility: (facilityId: string) => void;
  pauseFacility: (facilityId: string) => void;
  collectFacility: (facilityId: string) => ActionResult;
  listFacility: (facilityId: string, price: number) => ActionResult;
  cancelFacilityListing: (listingId: string) => void;
  buyFacility: (listingId: string) => ActionResult;
  placeCommodityOrder: (side: OrderSide, quantity: number, price: number) => ActionResult;
  cancelOrder: (orderId: string) => void;
  renamePlayer: (name: string) => void;
  reset: (user: AuthUser) => void;
}

function deriveGameData(game: EconomyState): DerivedGameData {
  const ownOpenOrders = game.orders.filter(
    (order) => order.ownerId === game.userId && ['open', 'partial'].includes(order.status),
  );
  const ownListings = game.facilityListings.filter((listing) => listing.ownerId === game.userId);
  const bids = game.orders
    .filter((order) => order.side === 'buy' && ['open', 'partial'].includes(order.status))
    .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt);
  const asks = game.orders
    .filter((order) => order.side === 'sell' && ['open', 'partial'].includes(order.status))
    .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt);
  const facilityValue = game.facilities.reduce(
    (sum, facility) => sum + facility.systemValue + facility.internalGoods * game.marketPrice,
    0,
  );
  const commodityValue = (game.inventory + game.frozenInventory) * game.marketPrice;
  const cashValue = game.credits + game.frozenCredits;
  const totalAssets = cashValue + commodityValue + facilityValue;
  const currentRank = game.leaderboard.find((entry) => entry.isCurrentPlayer);
  const previousRank = currentRank && currentRank.rank > 1 ? game.leaderboard[currentRank.rank - 2] : null;
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;
  const pendingGoods = game.facilities.reduce((sum, facility) => sum + facility.internalGoods, 0);
  const runningFacilities = game.facilities.filter((facility) => facility.status === 'running').length;
  const constructingFacilities = game.facilities.filter((facility) => facility.status === 'constructing').length;
  const buyTrades = game.trades.filter((trade) => trade.type === 'commodity' && trade.side === 'buy');
  const boughtQuantity = buyTrades.reduce((sum, trade) => sum + trade.quantity, 0);
  const averageCost = boughtQuantity
    ? buyTrades.reduce((sum, trade) => sum + trade.total, 0) / boughtQuantity
    : 0;
  const history = game.marketPriceHistory.map((point) => point.price);
  const marketTrend = history.length > 1 ? history[history.length - 1] - history[0] : 0;

  return {
    ownOpenOrders,
    ownListings,
    bids,
    asks,
    facilityValue,
    commodityValue,
    cashValue,
    totalAssets,
    currentRank,
    previousRank,
    bestBid,
    bestAsk,
    spread,
    pendingGoods,
    runningFacilities,
    constructingFacilities,
    averageCost,
    history,
    marketTrend,
  };
}

export function useGameViewModel(
  user: AuthUser,
  onSignedOut: () => void,
): LoadedGameViewModel | null {
  const {
    game,
    initialize,
    reloadFromStorage,
    process,
    reset,
    work,
    buildFacility,
    startFacility,
    pauseFacility,
    collectFacility,
    listFacility,
    cancelFacilityListing,
    buyFacility,
    placeCommodityOrder,
    cancelOrder,
    renamePlayer,
  } = useGameStore();
  const [tab, setTab] = useState<TabId>('home');
  const [notice, setNotice] = useState('');
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(7);
  const [listingPrices, setListingPrices] = useState<Record<string, number>>({});
  const [playerName, setPlayerName] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [compactNumbers, setCompactNumbers] = useState(false);
  const [refreshRate, setRefreshRate] = useState('1');
  const now = Date.now();

  useEffect(() => {
    initialize(user);
  }, [initialize, user]);

  useEffect(() => {
    const interval = Math.max(1, Number(refreshRate)) * 1_000;
    const timer = window.setInterval(process, interval);
    const handleStorage = (event: StorageEvent) => {
      if (event.key?.endsWith(`:${user.id}`)) reloadFromStorage(user.id);
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', handleStorage);
    };
  }, [process, refreshRate, reloadFromStorage, user.id]);

  useEffect(() => {
    if (game) setPlayerName(game.playerName);
  }, [game?.playerName]);

  const derived = useMemo(() => (game ? deriveGameData(game) : null), [game]);

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3_000);
  }

  function showResult(result: ActionResult) {
    notify(result.message);
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      onSignedOut();
    }
  }

  if (!game || !derived) return null;

  const workRemaining = Math.max(0, game.work.cooldownUntil - now);
  const inventoryUsed = game.inventory + game.frozenInventory;
  const cashShare = derived.totalAssets ? Math.round((derived.cashValue / derived.totalAssets) * 100) : 0;
  const commodityShare = derived.totalAssets
    ? Math.round((derived.commodityValue / derived.totalAssets) * 100)
    : 0;
  const facilityShare = Math.max(0, 100 - cashShare - commodityShare);
  const cashEnd = cashShare * 3.6;
  const commodityEnd = (cashShare + commodityShare) * 3.6;
  const allocationStyle: CSSProperties = {
    background: `conic-gradient(var(--green) 0deg ${cashEnd}deg, var(--gold) ${cashEnd}deg ${commodityEnd}deg, var(--blue) ${commodityEnd}deg 360deg)`,
  };
  const avatarText = (game.playerName || user.email).slice(0, 1).toUpperCase();

  return {
    user,
    game,
    derived,
    tab,
    setTab,
    notice,
    orderSide,
    setOrderSide,
    orderQuantity,
    setOrderQuantity,
    orderPrice,
    setOrderPrice,
    listingPrices,
    setListingPrices,
    playerName,
    setPlayerName,
    soundEnabled,
    setSoundEnabled,
    compactNumbers,
    setCompactNumbers,
    refreshRate,
    setRefreshRate,
    now,
    workRemaining,
    inventoryUsed,
    cashShare,
    commodityShare,
    facilityShare,
    allocationStyle,
    avatarText,
    showResult,
    notify,
    signOut,
    work,
    buildFacility,
    startFacility,
    pauseFacility,
    collectFacility,
    listFacility,
    cancelFacilityListing,
    buyFacility,
    placeCommodityOrder,
    cancelOrder,
    renamePlayer,
    reset,
  };
}
