import {
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { gameActions, GameApiError, getGameState, type GameActionResponse, type GameActionResult } from '../api/game';
import { logout } from '../api/auth';
import { type TabId } from '../config/navigation';
import type {
  AssetEvent,
  AuthUser,
  CommodityOrder,
  EconomyState,
  FacilityListing,
  FacilityStatus,
  FacilityStopReason,
  LeaderboardEntry,
  OrderSide,
  OrderStatus,
  ProductDefinition,
  ProductInventory,
  ProductMarketState,
  ProductionMode,
  TradeRecord,
} from '../types';
import {
  clearLocalActivity as clearLocalActivityStore,
  loadLocalActivity,
  syncLocalActivity,
  type LocalActivityAction,
  type LocalActivityView,
} from '../utils/localActivityStore';

export const facilityStatusNames: Record<FacilityStatus, string> = {
  constructing: '施工中',
  ready: '待启动',
  running: '运行中',
  paused: '已停止',
  full: '产成品已满',
  insufficient_funds: '资金不足',
  insufficient_input: '原料不足',
  listed: '挂牌中',
};

export const facilityStopReasonNames: Record<FacilityStopReason, string> = {
  manual: '手动停止',
  plan_complete: '计划完成',
  insufficient_funds: '运营资金不足',
  insufficient_input: '生产原料不足',
  output_full: '产成品仓库已满',
  listed: '正在挂牌出售',
  maintenance: '系统维护',
};

export const orderStatusNames: Record<OrderStatus, string> = {
  open: '等待成交',
  partial: '部分成交',
  filled: '全部成交',
  cancelled: '已取消',
};

export interface DerivedGameData {
  selectedProduct: ProductDefinition;
  selectedInventory: ProductInventory;
  selectedMarket: ProductMarketState;
  ownOpenOrders: CommodityOrder[];
  ownSelectedOpenOrders: CommodityOrder[];
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
  stoppedFacilities: number;
  blockedFacilities: number;
  averageCost: number;
  history: number[];
  marketTrend: number;
  inventoryUsed: number;
}

export type ActionResult = GameActionResult;

export interface LoadedGameViewModel {
  user: AuthUser;
  game: EconomyState;
  derived: DerivedGameData;
  localAssetEvents: AssetEvent[];
  localTrades: TradeRecord[];
  tab: TabId;
  setTab: Dispatch<SetStateAction<TabId>>;
  notice: string;
  selectedProductId: string;
  setSelectedProductId: Dispatch<SetStateAction<string>>;
  selectedFacilityTypeId: string;
  setSelectedFacilityTypeId: Dispatch<SetStateAction<string>>;
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
  showResult: (result: ActionResult | Promise<ActionResult>) => Promise<void>;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
  clearLocalActivity: () => void;
  signOut: () => Promise<void>;
  work: () => Promise<ActionResult>;
  buildFacility: (facilityTypeId?: string) => Promise<ActionResult>;
  startFacility: (facilityId: string) => Promise<ActionResult>;
  stopFacility: (facilityId: string) => Promise<ActionResult>;
  pauseFacility: (facilityId: string) => Promise<ActionResult>;
  setProductionPlan: (
    facilityId: string,
    mode: ProductionMode,
    targetQuantity?: number,
  ) => Promise<ActionResult>;
  collectFacility: (facilityId: string) => Promise<ActionResult>;
  listFacility: (facilityId: string, price: number) => Promise<ActionResult>;
  cancelFacilityListing: (listingId: string) => Promise<ActionResult>;
  buyFacility: (listingId: string) => Promise<ActionResult>;
  placeCommodityOrder: (
    side: OrderSide,
    quantity: number,
    price: number,
    productId?: string,
  ) => Promise<ActionResult>;
  cancelOrder: (orderId: string) => Promise<ActionResult>;
  renamePlayer: (name: string) => Promise<ActionResult>;
  reset: () => Promise<ActionResult>;
}

export type GameViewModelState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; model: LoadedGameViewModel };

function fallbackProduct(game: EconomyState): ProductDefinition {
  return game.products[0] ?? { id: 'grain', name: '粮食', category: 'raw', basePrice: 6 };
}

function fallbackMarket(product: ProductDefinition): ProductMarketState {
  return {
    productId: product.id,
    lastPrice: product.basePrice,
    priceHistory: [],
    demand: {
      cycleMs: 300_000,
      nextDemandAt: 0,
      lastBudget: 0,
      lastQuantity: 0,
      lastPrice: product.basePrice,
      satisfaction: 0,
    },
  };
}

function deriveGameData(
  game: EconomyState,
  requestedProductId: string,
  localTrades: TradeRecord[],
): DerivedGameData {
  const selectedProduct = game.products.find((product) => product.id === requestedProductId) ?? fallbackProduct(game);
  const selectedInventory = game.inventories[selectedProduct.id] ?? { available: 0, frozen: 0 };
  const selectedMarket = game.markets[selectedProduct.id] ?? fallbackMarket(selectedProduct);
  const ownOpenOrders = game.orders.filter(
    (order) => order.ownerId === game.userId && ['open', 'partial'].includes(order.status),
  );
  const ownSelectedOpenOrders = ownOpenOrders.filter((order) => order.productId === selectedProduct.id);
  const ownListings = game.facilityListings.filter((listing) => listing.ownerId === game.userId);
  const bids = game.orders
    .filter((order) => order.productId === selectedProduct.id && order.side === 'buy' && ['open', 'partial'].includes(order.status))
    .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt);
  const asks = game.orders
    .filter((order) => order.productId === selectedProduct.id && order.side === 'sell' && ['open', 'partial'].includes(order.status))
    .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt);
  const facilityValue = game.facilities.reduce((sum, facility) => {
    const outputPrice = game.markets[facility.outputProductId]?.lastPrice ?? 0;
    return sum + facility.systemValue + facility.internalGoods * outputPrice;
  }, 0);
  const commodityValue = game.products.reduce((sum, product) => {
    const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
    const price = game.markets[product.id]?.lastPrice ?? product.basePrice;
    return sum + (inventory.available + inventory.frozen) * price;
  }, 0);
  const cashValue = game.credits + game.frozenCredits;
  const totalAssets = cashValue + commodityValue + facilityValue;
  const currentRank = game.leaderboard.find((entry) => entry.isCurrentPlayer);
  const previousRank = currentRank
    ? game.leaderboard.find((entry) => entry.rank === currentRank.rank - 1) ?? null
    : null;
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;
  const pendingGoods = game.facilities.reduce((sum, facility) => sum + facility.internalGoods, 0);
  const runningFacilities = game.facilities.filter((facility) => facility.status === 'running').length;
  const constructingFacilities = game.facilities.filter((facility) => facility.status === 'constructing').length;
  const stoppedFacilities = game.facilities.filter((facility) => ['ready', 'paused'].includes(facility.status)).length;
  const blockedFacilities = game.facilities.filter((facility) => (
    ['full', 'insufficient_funds', 'insufficient_input'].includes(facility.status)
  )).length;
  const buyTrades = localTrades.filter((trade) => (
    trade.type === 'commodity' && trade.productId === selectedProduct.id && trade.side === 'buy'
  ));
  const boughtQuantity = buyTrades.reduce((sum, trade) => sum + trade.quantity, 0);
  const averageCost = boughtQuantity
    ? buyTrades.reduce((sum, trade) => sum + trade.total, 0) / boughtQuantity
    : 0;
  const history = selectedMarket.priceHistory.map((point) => point.price);
  const marketTrend = history.length > 1 ? history[history.length - 1] - history[0] : 0;
  const inventoryUsed = Object.values(game.inventories).reduce(
    (sum, inventory) => sum + inventory.available + inventory.frozen,
    0,
  );

  return {
    selectedProduct,
    selectedInventory,
    selectedMarket,
    ownOpenOrders,
    ownSelectedOpenOrders,
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
    stoppedFacilities,
    blockedFacilities,
    averageCost,
    history,
    marketTrend,
    inventoryUsed,
  };
}

function messageFromError(reason: unknown) {
  return reason instanceof Error ? reason.message : '游戏服务器请求失败';
}

export function useGameViewModel(user: AuthUser, onSignedOut: () => void): GameViewModelState {
  const [game, setGame] = useState<EconomyState | null>(null);
  const [localActivity, setLocalActivity] = useState<LocalActivityView>(() => loadLocalActivity(user.id));
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [tab, setTab] = useState<TabId>('home');
  const [notice, setNotice] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('grain');
  const [selectedFacilityTypeId, setSelectedFacilityTypeId] = useState('farm');
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(6);
  const [listingPrices, setListingPrices] = useState<Record<string, number>>({});
  const [playerName, setPlayerName] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [compactNumbers, setCompactNumbers] = useState(false);
  const [refreshRate, setRefreshRate] = useState('3');
  const [now, setNow] = useState(Date.now());
  const refreshing = useRef(false);

  const handleUnauthorized = useCallback(() => {
    setGame(null);
    onSignedOut();
  }, [onSignedOut]);

  const acceptState = useCallback((state: EconomyState, action: LocalActivityAction, message?: string) => {
    const activity = syncLocalActivity(user.id, state, { action, message, createdAt: Date.now() });
    setLocalActivity(activity);
    setGame(state);
  }, [user.id]);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const state = await getGameState();
      acceptState(state, 'refresh');
      setLoadError('');
    } catch (reason) {
      if (reason instanceof GameApiError && reason.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadError(messageFromError(reason));
    } finally {
      refreshing.current = false;
    }
  }, [acceptState, handleUnauthorized]);

  useEffect(() => {
    setLocalActivity(loadLocalActivity(user.id));
    void refresh();
  }, [refresh, reloadVersion, user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!game) return undefined;
    const interval = Math.max(1, Number(refreshRate)) * 1_000;
    const timer = window.setInterval(() => void refresh(), interval);
    return () => window.clearInterval(timer);
  }, [game, refresh, refreshRate]);

  useEffect(() => {
    if (!game) return;
    setPlayerName(game.playerName);
    if (!game.products.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(game.products[0]?.id ?? 'grain');
    }
    if (!game.facilityTypes.some((facility) => facility.id === selectedFacilityTypeId)) {
      setSelectedFacilityTypeId(game.facilityTypes[0]?.id ?? 'farm');
    }
  }, [game, selectedFacilityTypeId, selectedProductId]);

  useEffect(() => {
    if (!game) return;
    const market = game.markets[selectedProductId];
    if (market) setOrderPrice(market.lastPrice);
  }, [game?.markets, selectedProductId]);

  const runAction = useCallback(async (
    action: LocalActivityAction,
    operation: () => Promise<GameActionResponse>,
  ): Promise<ActionResult> => {
    try {
      const response = await operation();
      acceptState(response.state, action, response.result.message);
      setLoadError('');
      return response.result;
    } catch (reason) {
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();
      return { ok: false, message: messageFromError(reason) };
    }
  }, [acceptState, handleUnauthorized]);

  const derived = useMemo(
    () => (game ? deriveGameData(game, selectedProductId, localActivity.trades) : null),
    [game, localActivity.trades, selectedProductId],
  );

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3_000);
  }

  async function showResult(actionResult: ActionResult | Promise<ActionResult>) {
    const resolved = await actionResult;
    notify(resolved.message);
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      onSignedOut();
    }
  }

  if (!game || !derived) {
    if (loadError) {
      return {
        status: 'error',
        message: loadError,
        retry: () => {
          setLoadError('');
          setReloadVersion((current) => current + 1);
        },
      };
    }
    return { status: 'loading' };
  }

  const workRemaining = Math.max(0, game.work.cooldownUntil - now);
  const inventoryUsed = derived.inventoryUsed;
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

  const model: LoadedGameViewModel = {
    user,
    game,
    derived,
    localAssetEvents: localActivity.assetEvents,
    localTrades: localActivity.trades,
    tab,
    setTab,
    notice,
    selectedProductId,
    setSelectedProductId,
    selectedFacilityTypeId,
    setSelectedFacilityTypeId,
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
    refresh,
    clearLocalActivity: () => {
      setLocalActivity(clearLocalActivityStore(user.id, game));
      notify('本地活动记录已清除');
    },
    signOut,
    work: () => runAction('work', gameActions.work),
    buildFacility: (facilityTypeId = selectedFacilityTypeId) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId)),
    startFacility: (facilityId) => runAction('startFacility', () => gameActions.startFacility(facilityId)),
    stopFacility: (facilityId) => runAction('pauseFacility', () => gameActions.stopFacility(facilityId)),
    pauseFacility: (facilityId) => runAction('pauseFacility', () => gameActions.pauseFacility(facilityId)),
    setProductionPlan: (facilityId, mode, targetQuantity) => (
      runAction('setProductionPlan', () => gameActions.setProductionPlan(facilityId, mode, targetQuantity))
    ),
    collectFacility: (facilityId) => runAction('collectFacility', () => gameActions.collectFacility(facilityId)),
    listFacility: (facilityId, price) => runAction('listFacility', () => gameActions.listFacility(facilityId, price)),
    cancelFacilityListing: (listingId) => runAction('cancelFacilityListing', () => gameActions.cancelFacilityListing(listingId)),
    buyFacility: (listingId) => runAction('buyFacility', () => gameActions.buyFacility(listingId)),
    placeCommodityOrder: (side, quantity, price, productId = selectedProductId) => (
      runAction('placeOrder', () => gameActions.placeCommodityOrder(productId, side, quantity, price))
    ),
    cancelOrder: (orderId) => runAction('cancelOrder', () => gameActions.cancelOrder(orderId)),
    renamePlayer: (name) => runAction('renamePlayer', () => gameActions.renamePlayer(name)),
    reset: () => runAction('resetPlayer', gameActions.reset),
  };

  return { status: 'ready', model };
}
