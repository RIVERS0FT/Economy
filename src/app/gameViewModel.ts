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
  AssetKind,
  AssetOrder,
  AuthUser,
  EconomyState,
  FacilityStatus,
  FacilityStatusReason,
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
  running: '运行',
  stopped: '停止',
  error: '异常',
};

export const facilityStatusReasonNames: Record<FacilityStatusReason, string> = {
  manual: '手动停止',
  plan_complete: '定量计划已完成',
  plan_adjustment_required: '工厂数量变化，需要修改定量计划',
  insufficient_funds: '运营资金不足',
  insufficient_input: '生产原料不足',
  warehouse_full: '共享仓库空间不足',
  no_available_facility: '没有未冻结工厂可参与生产',
  maintenance: '系统维护',
}

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
  ownOpenOrders: AssetOrder[];
  ownSelectedOpenOrders: AssetOrder[];
  bids: AssetOrder[];
  asks: AssetOrder[];
  facilityValue: number;
  commodityValue: number;
  cashValue: number;
  totalAssets: number;
  currentRank?: LeaderboardEntry;
  previousRank: LeaderboardEntry | null;
  bestBid: number;
  bestAsk: number;
  spread: number;
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
  marketAssetKind: AssetKind;
  marketAssetId: string;
  selectMarketAsset: (kind: AssetKind, assetId: string) => void;
  orderSide: OrderSide;
  setOrderSide: Dispatch<SetStateAction<OrderSide>>;
  orderQuantity: number;
  setOrderQuantity: Dispatch<SetStateAction<number>>;
  orderPrice: number;
  setOrderPrice: Dispatch<SetStateAction<number>>;
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
  upgradeWarehouse: () => Promise<ActionResult>;
  buildFacility: (facilityTypeId?: string) => Promise<ActionResult>;
  startFacility: (facilityTypeId: string) => Promise<ActionResult>;
  stopFacility: (facilityTypeId: string) => Promise<ActionResult>;
  pauseFacility: (facilityTypeId: string) => Promise<ActionResult>;
  setProductionPlan: (facilityTypeId: string, mode: ProductionMode, targetQuantity?: number) => Promise<ActionResult>;
  placeAssetOrder: (assetKind: AssetKind, assetId: string, side: OrderSide, quantity: number, price: number) => Promise<ActionResult>;
  placeCommodityOrder: (side: OrderSide, quantity: number, price: number, productId?: string) => Promise<ActionResult>;
  cancelOrder: (orderId: string) => Promise<ActionResult>;
  renamePlayer: (name: string) => Promise<ActionResult>;
  redeemGift: (code: string) => Promise<ActionResult>;
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
    demand: { cycleMs: 300_000, nextDemandAt: 0, lastBudget: 0, lastQuantity: 0, lastPrice: product.basePrice, satisfaction: 0 },
  };
}

export function orderKind(order: AssetOrder): AssetKind {
  return order.assetKind ?? (order.facilityTypeId ? 'facility' : 'commodity');
}

export function orderAssetId(order: AssetOrder): string {
  return order.assetId ?? order.facilityTypeId ?? order.productId ?? 'grain';
}

function deriveGameData(game: EconomyState, requestedProductId: string, localTrades: TradeRecord[]): DerivedGameData {
  const selectedProduct = game.products.find((product) => product.id === requestedProductId) ?? fallbackProduct(game);
  const selectedInventory = game.inventories[selectedProduct.id] ?? { available: 0, frozen: 0 };
  const selectedMarket = game.markets[selectedProduct.id] ?? fallbackMarket(selectedProduct);
  const ownOpenOrders = game.orders.filter((order) => (
    order.ownerId === game.userId && ['open', 'partial'].includes(order.status)
  ));
  const ownSelectedOpenOrders = ownOpenOrders.filter((order) => (
    orderKind(order) === 'commodity' && orderAssetId(order) === selectedProduct.id
  ));
  const bids = game.orders
    .filter((order) => orderKind(order) === 'commodity' && orderAssetId(order) === selectedProduct.id && order.side === 'buy' && ['open', 'partial'].includes(order.status))
    .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt);
  const asks = game.orders
    .filter((order) => orderKind(order) === 'commodity' && orderAssetId(order) === selectedProduct.id && order.side === 'sell' && ['open', 'partial'].includes(order.status))
    .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt);
  const currentRank = game.leaderboard.find((entry) => entry.isCurrentPlayer);
  const previousRank = currentRank ? game.leaderboard.find((entry) => entry.rank === currentRank.rank - 1) ?? null : null;
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const buyTrades = localTrades.filter((trade) => trade.type === 'commodity' && trade.productId === selectedProduct.id && trade.side === 'buy');
  const boughtQuantity = buyTrades.reduce((sum, trade) => sum + trade.quantity, 0);
  const history = selectedMarket.priceHistory.map((point) => point.price);
  return {
    selectedProduct,
    selectedInventory,
    selectedMarket,
    ownOpenOrders,
    ownSelectedOpenOrders,
    bids,
    asks,
    facilityValue: game.assetSummary.facilityValue,
    commodityValue: game.assetSummary.commodityValue,
    cashValue: game.assetSummary.cashValue,
    totalAssets: game.assetSummary.totalAssets,
    currentRank,
    previousRank,
    bestBid,
    bestAsk,
    spread: bestBid && bestAsk ? bestAsk - bestBid : 0,
    runningFacilities: game.facilityGroups.reduce((sum, group) => sum + (group.status === 'running' ? group.participatingCount : 0), 0),
    constructingFacilities: game.facilityConstruction ? 1 : 0,
    stoppedFacilities: game.facilityGroups.reduce((sum, group) => sum + (group.status === 'stopped' ? group.count : 0), 0),
    blockedFacilities: game.facilityGroups.reduce((sum, group) => sum + (group.status === 'error' ? group.count : 0), 0),
    averageCost: boughtQuantity ? buyTrades.reduce((sum, trade) => sum + trade.total, 0) / boughtQuantity : 0,
    history,
    marketTrend: history.length > 1 ? history[history.length - 1] - history[0] : 0,
    inventoryUsed: game.warehouseStoredQuantity,
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
  const [marketAssetKind, setMarketAssetKind] = useState<AssetKind>('commodity');
  const [marketAssetId, setMarketAssetId] = useState('grain');
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(6);
  const [playerName, setPlayerName] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [compactNumbers, setCompactNumbers] = useState(false);
  const [refreshRate, setRefreshRate] = useState('3');
  const [now, setNow] = useState(Date.now());
  const refreshing = useRef(false);

  const handleUnauthorized = useCallback(() => { setGame(null); onSignedOut(); }, [onSignedOut]);
  const acceptState = useCallback((state: EconomyState, action: LocalActivityAction, message?: string) => {
    setLocalActivity(syncLocalActivity(user.id, state, { action, message, createdAt: Date.now() }));
    setGame(state);
  }, [user.id]);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try { acceptState(await getGameState(), 'refresh'); setLoadError(''); }
    catch (reason) {
      if (reason instanceof GameApiError && reason.status === 401) { handleUnauthorized(); return; }
      setLoadError(messageFromError(reason));
    } finally { refreshing.current = false; }
  }, [acceptState, handleUnauthorized]);

  useEffect(() => { setLocalActivity(loadLocalActivity(user.id)); void refresh(); }, [refresh, reloadVersion, user.id]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!game) return undefined;
    const timer = window.setInterval(() => void refresh(), Math.max(1, Number(refreshRate)) * 1_000);
    return () => window.clearInterval(timer);
  }, [game, refresh, refreshRate]);
  useEffect(() => {
    if (!game) return;
    setPlayerName(game.playerName);
    if (!game.products.some((product) => product.id === selectedProductId)) setSelectedProductId(game.products[0]?.id ?? 'grain');
    if (!game.facilityTypes.some((facility) => facility.id === selectedFacilityTypeId)) setSelectedFacilityTypeId(game.facilityTypes[0]?.id ?? 'farm');
  }, [game, selectedFacilityTypeId, selectedProductId]);
  useEffect(() => {
    if (!game) return;
    if (marketAssetKind === 'commodity') {
      const product = game.products.find((item) => item.id === marketAssetId) ?? game.products[0];
      const market = product ? game.markets[product.id] : undefined;
      if (product) setSelectedProductId(product.id);
      if (market) setOrderPrice(market.lastPrice);
    } else {
      const type = game.facilityTypes.find((item) => item.id === marketAssetId) ?? game.facilityTypes[0];
      const market = type ? game.facilityMarkets[type.id] : undefined;
      if (type) setSelectedFacilityTypeId(type.id);
      if (market) setOrderPrice(market.lastPrice);
    }
    setOrderQuantity(1);
  }, [game, marketAssetId, marketAssetKind]);

  const runAction = useCallback(async (action: LocalActivityAction, operation: () => Promise<GameActionResponse>): Promise<ActionResult> => {
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

  const derived = useMemo(() => (game ? deriveGameData(game, selectedProductId, localActivity.trades) : null), [game, localActivity.trades, selectedProductId]);
  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3_000); }
  async function showResult(actionResult: ActionResult | Promise<ActionResult>) { notify((await actionResult).message); }
  async function signOut() { try { await logout(); } finally { onSignedOut(); } }

  if (!game || !derived) {
    if (loadError) return { status: 'error', message: loadError, retry: () => { setLoadError(''); setReloadVersion((current) => current + 1); } };
    return { status: 'loading' };
  }

  const workRemaining = Math.max(0, game.work.cooldownUntil - now);
  const cashShare = derived.totalAssets ? Math.round((derived.cashValue / derived.totalAssets) * 100) : 0;
  const commodityShare = derived.totalAssets ? Math.round((derived.commodityValue / derived.totalAssets) * 100) : 0;
  const facilityShare = Math.max(0, 100 - cashShare - commodityShare);
  const cashEnd = cashShare * 3.6;
  const commodityEnd = (cashShare + commodityShare) * 3.6;
  const allocationStyle: CSSProperties = { background: `conic-gradient(var(--green) 0deg ${cashEnd}deg, var(--gold) ${cashEnd}deg ${commodityEnd}deg, var(--blue) ${commodityEnd}deg 360deg)` };
  const avatarText = (game.playerName || user.email).slice(0, 1).toUpperCase();
  const selectMarketAsset = (kind: AssetKind, assetId: string) => { setMarketAssetKind(kind); setMarketAssetId(assetId); setTab('market'); };

  const model: LoadedGameViewModel = {
    user, game, derived,
    localAssetEvents: localActivity.assetEvents,
    localTrades: localActivity.trades,
    tab, setTab, notice,
    selectedProductId, setSelectedProductId,
    selectedFacilityTypeId, setSelectedFacilityTypeId,
    marketAssetKind, marketAssetId, selectMarketAsset,
    orderSide, setOrderSide, orderQuantity, setOrderQuantity, orderPrice, setOrderPrice,
    playerName, setPlayerName, soundEnabled, setSoundEnabled, compactNumbers, setCompactNumbers, refreshRate, setRefreshRate,
    now, workRemaining, inventoryUsed: derived.inventoryUsed,
    cashShare, commodityShare, facilityShare, allocationStyle, avatarText,
    showResult, notify, refresh,
    clearLocalActivity: () => { setLocalActivity(clearLocalActivityStore(user.id, game)); notify('本地活动记录已清除'); },
    signOut,
    work: () => runAction('work', gameActions.work),
    upgradeWarehouse: () => runAction('upgradeWarehouse', gameActions.upgradeWarehouse),
    buildFacility: (facilityTypeId = selectedFacilityTypeId) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId)),
    startFacility: (facilityTypeId) => runAction('startFacility', () => gameActions.startFacility(facilityTypeId)),
    stopFacility: (facilityTypeId) => runAction('pauseFacility', () => gameActions.stopFacility(facilityTypeId)),
    pauseFacility: (facilityTypeId) => runAction('pauseFacility', () => gameActions.pauseFacility(facilityTypeId)),
    setProductionPlan: (facilityTypeId, mode, targetQuantity) => runAction('setProductionPlan', () => gameActions.setProductionPlan(facilityTypeId, mode, targetQuantity)),
    placeAssetOrder: (assetKind, assetId, side, quantity, price) => runAction('placeOrder', () => gameActions.placeAssetOrder(assetKind, assetId, side, quantity, price)),
    placeCommodityOrder: (side, quantity, price, productId = selectedProductId) => runAction('placeOrder', () => gameActions.placeCommodityOrder(productId, side, quantity, price)),
    cancelOrder: (orderId) => runAction('cancelOrder', () => gameActions.cancelOrder(orderId)),
    renamePlayer: (name) => runAction('renamePlayer', () => gameActions.renamePlayer(name)),
    redeemGift: (code) => runAction('redeemGift', () => gameActions.redeemGift(code)),
    reset: () => runAction('resetPlayer', gameActions.reset),
  };
  return { status: 'ready', model };
}
