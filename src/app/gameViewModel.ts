import {
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
  TradeRecord,
} from '../types';
import { canAcceptRevision } from './revisionGate.js';
import { buildAssetAllocation } from '../utils/assetAllocation';
import { defaultOrderPrice } from '../utils/defaultOrderPrice';
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
  insufficient_funds: '运营资金不足',
  insufficient_input: '生产原料不足',
  warehouse_full: '共享仓库空间不足',
  no_available_facility: '没有未冻结工厂可参与生产',
  maintenance: '系统维护',
};

export const orderStatusNames: Record<OrderStatus, string> = {
  open: '等待成交',
  partial: '部分成交',
  filled: '全部成交',
  cancelled: '已取消',
};

export interface DerivedGameData {
  ownOpenOrders: AssetOrder[];
  facilityValue: number;
  commodityValue: number;
  cashValue: number;
  totalAssets: number;
  currentRank?: LeaderboardEntry;
  previousRank: LeaderboardEntry | null;
  runningFacilities: number;
  constructingFacilities: number;
  stoppedFacilities: number;
  blockedFacilities: number;
  inventoryUsed: number;
}

export type ActionResult = GameActionResult;
export type RefreshMode = 'normal' | 'authoritative';
export interface RefreshOptions {
  mode?: RefreshMode;
  expectedDeadline?: number;
}

interface RefreshTask {
  controller: AbortController;
  startedAt: number;
  mode: RefreshMode;
  expectedDeadline?: number;
  promise: Promise<void>;
}

export interface LoadedGameViewModel {
  user: AuthUser;
  game: EconomyState;
  derived: DerivedGameData;
  localAssetEvents: AssetEvent[];
  localTrades: TradeRecord[];
  tab: TabId;
  setTab: (tab: TabId) => void;
  notice: string;
  selectedFacilityTypeId: string;
  setSelectedFacilityTypeId: Dispatch<SetStateAction<string>>;
  marketAssetKind: AssetKind;
  marketAssetId: string;
  selectMarketAsset: (kind: AssetKind, assetId: string) => void;
  orderSide: OrderSide;
  selectOrderSide: (side: OrderSide) => void;
  orderQuantity: number;
  setOrderQuantity: Dispatch<SetStateAction<number>>;
  orderPrice: number;
  setOrderPrice: Dispatch<SetStateAction<number>>;
  playerName: string;
  setPlayerName: Dispatch<SetStateAction<string>>;
  compactNumbers: boolean;
  setCompactNumbers: Dispatch<SetStateAction<boolean>>;
  refreshRate: string;
  setRefreshRate: Dispatch<SetStateAction<string>>;
  isWorking: boolean;
  inventoryUsed: number;
  cashShare: number;
  commodityShare: number;
  facilityShare: number;
  allocationStyle: ReturnType<typeof buildAssetAllocation>['allocationStyle'];
  avatarText: string;
  showResult: (result: ActionResult | Promise<ActionResult>) => Promise<void>;
  notify: (message: string) => void;
  refresh: (options?: RefreshOptions) => Promise<void>;
  clearLocalActivity: () => void;
  signOut: () => Promise<void>;
  work: () => Promise<ActionResult>;
  upgradeWarehouse: () => Promise<ActionResult>;
  buildFacility: (facilityTypeId?: string) => Promise<ActionResult>;
  startFacility: (facilityTypeId: string) => Promise<ActionResult>;
  stopFacility: (facilityTypeId: string) => Promise<ActionResult>;
  pauseFacility: (facilityTypeId: string) => Promise<ActionResult>;
  setFacilityRecipe: (facilityTypeId: string, recipeId: string) => Promise<ActionResult>;
  placeAssetOrder: (assetKind: AssetKind, assetId: string, side: OrderSide, quantity: number, price: number) => Promise<ActionResult>;
  cancelOrder: (orderId: string) => Promise<ActionResult>;
  renamePlayer: (name: string) => Promise<ActionResult>;
  redeemGift: (code: string) => Promise<ActionResult>;
  exchangeGems: (gems: number) => Promise<ActionResult>;
}

export type GameViewModelState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; model: LoadedGameViewModel };

function deriveGameData(game: EconomyState): DerivedGameData {
  const ownOpenOrders = game.orders.filter((order) => (
    order.isOwn && ['open', 'partial'].includes(order.status)
  ));
  const currentRank = game.leaderboard.find((entry) => entry.isCurrentPlayer);
  const previousRank = currentRank ? game.leaderboard.find((entry) => entry.rank === currentRank.rank - 1) ?? null : null;
  return {
    ownOpenOrders,
    facilityValue: game.assetSummary.facilityValue,
    commodityValue: game.assetSummary.commodityValue,
    cashValue: game.assetSummary.cashValue,
    totalAssets: game.assetSummary.totalAssets,
    currentRank,
    previousRank,
    runningFacilities: game.facilityGroups.reduce((sum, group) => sum + (group.status === 'running' ? group.participatingCount : 0), 0),
    constructingFacilities: game.facilityConstruction ? 1 : 0,
    stoppedFacilities: game.facilityGroups.reduce((sum, group) => sum + (group.status === 'stopped' ? group.count : 0), 0),
    blockedFacilities: game.facilityGroups.reduce((sum, group) => sum + (group.status === 'error' ? group.count : 0), 0),
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
  const [tab, setActiveTab] = useState<TabId>('home');
  const [notice, setNotice] = useState('');
  const [selectedFacilityTypeId, setSelectedFacilityTypeId] = useState('farm');
  const [marketAssetKind, setMarketAssetKind] = useState<AssetKind>('commodity');
  const [marketAssetId, setMarketAssetId] = useState('wheat');
  const [orderSide, setOrderSideState] = useState<OrderSide>('buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(1);
  const [playerName, setPlayerName] = useState('');
  const [compactNumbers, setCompactNumbers] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  ));
  const [refreshRate, setRefreshRate] = useState('5');
  const [isWorking, setIsWorking] = useState(false);
  const revisionRef = useRef<number | null>(null);
  const refreshTaskRef = useRef<RefreshTask | null>(null);
  const actionsInFlightRef = useRef(0);
  const workPendingRef = useRef(false);
  const orderPendingRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);

  const handleUnauthorized = useCallback(() => { setGame(null); onSignedOut(); }, [onSignedOut]);
  const acceptState = useCallback((state: EconomyState, action: LocalActivityAction, message?: string) => {
    setLocalActivity(syncLocalActivity(user.id, state, { action, message, createdAt: Date.now() }));
    setGame(state);
  }, [user.id]);
  const acceptVersionedState = useCallback((
    incomingRevision: number | undefined,
    state: EconomyState | undefined,
    action: LocalActivityAction,
    message?: string,
  ) => {
    const currentRevision = revisionRef.current;
    if (!canAcceptRevision(currentRevision, incomingRevision)) return false;
    if (typeof incomingRevision === 'number' && Number.isInteger(incomingRevision)) {
      revisionRef.current = incomingRevision;
    }
    if (state) acceptState(state, action, message);
    return true;
  }, [acceptState]);

  const refresh = useCallback((options: RefreshOptions = {}) => {
    const mode = options.mode ?? 'normal';
    if (mode === 'normal' && actionsInFlightRef.current > 0) return Promise.resolve();

    const existing = refreshTaskRef.current;
    if (existing) {
      if (mode === 'normal' || existing.mode === 'authoritative') return existing.promise;
      existing.controller.abort();
    }

    const controller = new AbortController();
    const promise = (async () => {
      try {
        const response = await getGameState(revisionRef.current, controller.signal);
        if (mode === 'normal' && actionsInFlightRef.current > 0) return;
        acceptVersionedState(response.revision, response.state, 'refresh');
        setLoadError('');
      } catch (reason) {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        if (reason instanceof GameApiError && reason.status === 401) { handleUnauthorized(); return; }
        setLoadError(messageFromError(reason));
      } finally {
        if (refreshTaskRef.current?.controller === controller) refreshTaskRef.current = null;
      }
    })();
    refreshTaskRef.current = {
      controller,
      startedAt: Date.now(),
      mode,
      expectedDeadline: options.expectedDeadline,
      promise,
    };
    return promise;
  }, [acceptVersionedState, handleUnauthorized]);

  useEffect(() => {
    refreshTaskRef.current?.controller.abort();
    refreshTaskRef.current = null;
    revisionRef.current = null;
    setLocalActivity(loadLocalActivity(user.id));
    void refresh();
  }, [refresh, reloadVersion, user.id]);
  useEffect(() => () => {
    refreshTaskRef.current?.controller.abort();
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);
  useEffect(() => {
    if (!game) return undefined;
    const timer = window.setInterval(() => void refresh(), Math.max(1, Number(refreshRate)) * 1_000);
    return () => window.clearInterval(timer);
  }, [game, refresh, refreshRate]);
  useEffect(() => {
    if (!game) return;
    setPlayerName(game.playerName);
    if (!game.facilityTypes.some((facility) => facility.id === selectedFacilityTypeId)) setSelectedFacilityTypeId(game.facilityTypes[0]?.id ?? 'farm');
  }, [game, selectedFacilityTypeId]);
  useEffect(() => {
    if (!game) return;
    if (marketAssetKind === 'commodity') {
      const product = game.products.find((item) => item.id === marketAssetId) ?? game.products[0];
      if (!product) return;
      if (product.id !== marketAssetId) setMarketAssetId(product.id);
      return;
    }
    const type = game.facilityTypes.find((item) => item.id === marketAssetId) ?? game.facilityTypes[0];
    if (!type) return;
    if (type.id !== marketAssetId) setMarketAssetId(type.id);
    if (type.id !== selectedFacilityTypeId) setSelectedFacilityTypeId(type.id);
  }, [game, marketAssetId, marketAssetKind, selectedFacilityTypeId]);

  const syncConfirmedAction = useCallback(async (
    response: GameActionResponse,
    action: LocalActivityAction,
  ) => {
    try {
      const stateResponse = await getGameState(revisionRef.current);
      if (stateResponse.revision < response.revision) {
        throw new Error('服务器状态同步落后于已确认操作');
      }
      acceptVersionedState(stateResponse.revision, stateResponse.state, action, response.result.message);
      setLoadError('');
    } catch (syncReason) {
      if (syncReason instanceof GameApiError && syncReason.status === 401) handleUnauthorized();
      else setLoadError(`操作已完成，但状态同步失败：${messageFromError(syncReason)}`);
    }
  }, [acceptVersionedState, handleUnauthorized]);

  const runAction = useCallback(async (action: LocalActivityAction, operation: () => Promise<GameActionResponse>): Promise<ActionResult> => {
    if (action === 'work' && workPendingRef.current) {
      return { ok: false, message: '工作正在处理中' };
    }
    actionsInFlightRef.current += 1;
    refreshTaskRef.current?.controller.abort();
    if (action === 'work') {
      workPendingRef.current = true;
      setIsWorking(true);
    }
    try {
      const response = await operation();
      await syncConfirmedAction(response, action);
      return response.result;
    } catch (reason) {
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();
      return { ok: false, message: messageFromError(reason) };
    } finally {
      actionsInFlightRef.current = Math.max(0, actionsInFlightRef.current - 1);
      if (action === 'work') {
        workPendingRef.current = false;
        setIsWorking(false);
      }
    }
  }, [handleUnauthorized, syncConfirmedAction]);

  const placeAssetOrder = useCallback(async (
    assetKind: AssetKind,
    assetId: string,
    side: OrderSide,
    quantity: number,
    price: number,
  ): Promise<ActionResult> => {
    if (orderPendingRef.current) return { ok: false, message: '市场订单正在同步中，请勿重复提交' };
    orderPendingRef.current = true;
    actionsInFlightRef.current += 1;
    refreshTaskRef.current?.controller.abort();
    const finish = () => {
      actionsInFlightRef.current = Math.max(0, actionsInFlightRef.current - 1);
      orderPendingRef.current = false;
    };
    try {
      const response = await gameActions.placeAssetOrder(assetKind, assetId, side, quantity, price);
      void syncConfirmedAction(response, 'placeOrder').finally(finish);
      return response.result;
    } catch (reason) {
      finish();
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();
      return { ok: false, message: messageFromError(reason) };
    }
  }, [handleUnauthorized, syncConfirmedAction]);

  const derived = useMemo(() => (game ? deriveGameData(game) : null), [game]);
  function notify(message: string) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice('');
    }, 3_000);
  }
  async function showResult(actionResult: ActionResult | Promise<ActionResult>) { notify((await actionResult).message); }
  async function signOut() { try { await logout(); } finally { onSignedOut(); } }

  if (!game || !derived) {
    if (loadError) return { status: 'error', message: loadError, retry: () => { setLoadError(''); setReloadVersion((current) => current + 1); } };
    return { status: 'loading' };
  }

  const loadedGame = game;
  const { cashShare, commodityShare, facilityShare, allocationStyle } = buildAssetAllocation(
    derived.cashValue,
    derived.commodityValue,
    derived.facilityValue,
  );
  const avatarText = (loadedGame.playerName || user.email).slice(0, 1).toUpperCase();

  function setTab(nextTab: TabId) {
    if (nextTab === 'market' && tab !== 'market') {
      setOrderPrice(defaultOrderPrice(loadedGame.orders, marketAssetKind, marketAssetId, orderSide));
      setOrderQuantity(1);
    }
    setActiveTab(nextTab);
  }

  function selectMarketAsset(kind: AssetKind, assetId: string) {
    const changed = kind !== marketAssetKind || assetId !== marketAssetId;
    setMarketAssetKind(kind);
    setMarketAssetId(assetId);
    if (kind === 'facility') setSelectedFacilityTypeId(assetId);
    if (changed || tab !== 'market') {
      setOrderPrice(defaultOrderPrice(loadedGame.orders, kind, assetId, orderSide));
      setOrderQuantity(1);
    }
    setActiveTab('market');
  }

  function selectOrderSide(side: OrderSide) {
    if (side === orderSide) return;
    setOrderSideState(side);
    setOrderPrice(defaultOrderPrice(loadedGame.orders, marketAssetKind, marketAssetId, side));
  }

  const model: LoadedGameViewModel = {
    user, game: loadedGame, derived,
    localAssetEvents: localActivity.assetEvents,
    localTrades: localActivity.trades,
    tab, setTab, notice,
    selectedFacilityTypeId, setSelectedFacilityTypeId,
    marketAssetKind, marketAssetId, selectMarketAsset,
    orderSide, selectOrderSide, orderQuantity, setOrderQuantity, orderPrice, setOrderPrice,
    playerName, setPlayerName, compactNumbers, setCompactNumbers, refreshRate, setRefreshRate,
    isWorking, inventoryUsed: derived.inventoryUsed,
    cashShare, commodityShare, facilityShare, allocationStyle, avatarText,
    showResult, notify, refresh,
    clearLocalActivity: () => { setLocalActivity(clearLocalActivityStore(user.id, loadedGame)); notify('本地活动记录已清除'); },
    signOut,
    work: () => runAction('work', gameActions.work),
    upgradeWarehouse: () => runAction('upgradeWarehouse', gameActions.upgradeWarehouse),
    buildFacility: (facilityTypeId = selectedFacilityTypeId) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId)),
    startFacility: (facilityTypeId) => runAction('startFacility', () => gameActions.startFacility(facilityTypeId)),
    stopFacility: (facilityTypeId) => runAction('pauseFacility', () => gameActions.stopFacility(facilityTypeId)),
    pauseFacility: (facilityTypeId) => runAction('pauseFacility', () => gameActions.pauseFacility(facilityTypeId)),
    setFacilityRecipe: (facilityTypeId, recipeId) => runAction('setFacilityRecipe', () => gameActions.setFacilityRecipe(facilityTypeId, recipeId)),
    placeAssetOrder,
    cancelOrder: (orderId) => runAction('cancelOrder', () => gameActions.cancelOrder(orderId)),
    renamePlayer: (name) => runAction('renamePlayer', () => gameActions.renamePlayer(name)),
    redeemGift: (code) => runAction('redeemGift', () => gameActions.redeemGift(code)),
    exchangeGems: (gems) => runAction('exchangeGems', () => gameActions.exchangeGems(gems)),
  };
  return { status: 'ready', model };
}
