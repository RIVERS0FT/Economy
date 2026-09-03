import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  gameActions,
  GameApiError,
  getGameState,
  resetGameStateDelivery,
  type FacilityBuildProcurementOptions,
  type GameActionResponse,
  type GameActionResult,
  type TransportRouteInput,
} from '../api/game';
import { logout } from '../api/auth';
import { type TabId } from '../config/navigation';
import type {
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
  ProvinceDefinition,
} from '../types';
import { canAcceptRevision } from './revisionGate.js';
import type { StatePartitionName } from './stateDelivery.js';
import { getGameAuthoritySnapshot, useGameAuthorityState } from './gameAuthorityStore';
import { useDerivedGameData } from './useDerivedGameData';
import { buildAssetAllocation } from '../utils/assetAllocation';
import { defaultOrderPrice } from '../utils/defaultOrderPrice';
import { useServerDraft } from '../hooks/useServerDraft';
import {
  clearLocalTrades as clearLocalTradesStore,
  loadLocalActivity,
  syncLocalActivity,
  type LocalActivityAction,
  type LocalActivityView,
} from '../utils/localActivityStore';
import { DEFAULT_PROVINCE_ID, scopeEconomyState } from '../utils/provinceScope';

export const facilityStatusNames: Record<FacilityStatus, string> = {
  running: '运行',
  stopped: '停止',
  error: '异常',
};

export type MarketViewMode = 'catalog' | 'detail';

export const facilityStatusReasonNames: Record<FacilityStatusReason, string> = {
  manual: '手动停止',
  insufficient_funds: '运营资金不足',
  insufficient_input: '生产原料不足',
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
  localTrades: TradeRecord[];
  tab: TabId;
  setTab: (tab: TabId) => void;
  selectedProvinceId: string;
  selectedProvince: ProvinceDefinition;
  setSelectedProvinceId: (provinceId: string) => void;
  notice: string;
  selectedFacilityTypeId: string;
  setSelectedFacilityTypeId: Dispatch<SetStateAction<string>>;
  marketAssetKind: AssetKind;
  marketAssetId: string;
  marketViewMode: MarketViewMode;
  showMarketCatalog: () => void;
  selectMarketAsset: (kind: AssetKind, assetId: string, navigateToMarket?: boolean) => void;
  orderSide: OrderSide;
  selectOrderSide: (side: OrderSide) => void;
  orderQuantity: number;
  setOrderQuantity: Dispatch<SetStateAction<number>>;
  orderPrice: number;
  setOrderPrice: Dispatch<SetStateAction<number>>;
  playerName: string;
  setPlayerName: Dispatch<SetStateAction<string>>;
  refreshRate: string;
  setRefreshRate: Dispatch<SetStateAction<string>>;
  isCheckingIn: boolean;
  inventoryUsed: number;
  cashShare: number;
  commodityShare: number;
  facilityShare: number;
  avatarText: string;
  showResult: (result: ActionResult | Promise<ActionResult>) => Promise<void>;
  notify: (message: string) => void;
  refresh: (options?: RefreshOptions) => Promise<void>;
  clearLocalTrades: () => void;
  signOut: () => Promise<void>;
  checkIn: () => Promise<ActionResult>;
  createTransportRoute: (input: TransportRouteInput) => Promise<ActionResult>;
  updateTransportRoute: (routeId: string, input: TransportRouteInput) => Promise<ActionResult>;
  renameTransportRoute: (routeId: string, name: string) => Promise<ActionResult>;
  deleteTransportRoute: (routeId: string) => Promise<ActionResult>;
  bankDeposit: (amount: number) => Promise<ActionResult>;
  bankWithdraw: (amount: number) => Promise<ActionResult>;
  bankBorrow: (amount: number, collateral: Array<{ provinceId: string; facilityTypeId: string; quantity: number }>, autoRepay?: boolean) => Promise<ActionResult>;
  bankRepay: (loanId: string, amount: number | 'all') => Promise<ActionResult>;
  bankSetAutoRepay: (loanId: string, enabled: boolean) => Promise<ActionResult>;
  buildFacility: (facilityTypeId: string, quantity?: number, procurement?: FacilityBuildProcurementOptions) => Promise<ActionResult>;
  startResearch: (technologyId: string) => Promise<ActionResult>;
  accelerateResearch: () => Promise<ActionResult>;
  startFacility: (facilityTypeId: string) => Promise<ActionResult>;
  stopFacility: (facilityTypeId: string) => Promise<ActionResult>;
  pauseFacility: (facilityTypeId: string) => Promise<ActionResult>;
  setFacilityRecipe: (facilityTypeId: string, recipeId: string) => Promise<ActionResult>;
  setFacilityRecipes?: (targets: Array<{ provinceId: string; facilityTypeId: string; recipeId: string }>) => Promise<ActionResult>;
  placeAssetOrder: (assetKind: AssetKind, assetId: string, side: OrderSide, quantity: number, price: number) => Promise<ActionResult>;
  onlineAutoBuy: (productId: string, maxPrice: number, targetFreeInventory?: number) => Promise<ActionResult>;
  onlineAutoSell: (productId: string, price: number, minimumFreeInventory?: number) => Promise<ActionResult>;
  cancelOrder: (orderId: string) => Promise<ActionResult>;
  renamePlayer: (name: string) => Promise<ActionResult>;
  redeemGift: (code: string) => Promise<ActionResult>;
  exchangeGems: (gems: number) => Promise<ActionResult>;
}

export type GameViewModelState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; model: LoadedGameViewModel };

function messageFromError(reason: unknown) {
  return reason instanceof Error ? reason.message : '游戏服务器请求失败';
}

function shouldSyncLocalActivity(changedPartitions: readonly StatePartitionName[] | undefined) {
  if (!changedPartitions) return true;
  return changedPartitions.includes('catalog') || changedPartitions.includes('market');
}

export function useGameViewModel(user: AuthUser, onSignedOut: () => void): GameViewModelState {
  const authorityGame = useGameAuthorityState();
  const game = authorityGame?.userId === user.id ? authorityGame : null;
  const [localActivity, setLocalActivity] = useState<LocalActivityView>(() => loadLocalActivity(user.id));
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [tab, setActiveTab] = useState<TabId>('map');
  const provincePreferenceKey = `economy.selected-province.v1:${user.id}`;
  const [selectedProvinceId, setSelectedProvinceIdState] = useState(() => {
    try { return localStorage.getItem(provincePreferenceKey) || DEFAULT_PROVINCE_ID; } catch { return DEFAULT_PROVINCE_ID; }
  });
  const [notice, setNotice] = useState('');
  const [selectedFacilityTypeId, setSelectedFacilityTypeId] = useState('farm');
  const [marketAssetKind, setMarketAssetKind] = useState<AssetKind>('commodity');
  const [marketAssetId, setMarketAssetId] = useState('wheat');
  const [marketViewMode, setMarketViewMode] = useState<MarketViewMode>('catalog');
  const [orderSide, setOrderSideState] = useState<OrderSide>('buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(1);
  const [refreshRate, setRefreshRate] = useState('5');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const gameRef = useRef<EconomyState | null>(null);
  const revisionRef = useRef<number | null>(null);
  const refreshTaskRef = useRef<RefreshTask | null>(null);
  const actionsInFlightRef = useRef(0);
  const checkInPendingRef = useRef(false);
  const orderPendingRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);
  const onSignedOutRef = useRef(onSignedOut);
  const playerNameDraft = useServerDraft({
    serverValue: game?.playerName ?? '',
    serverRevision: game?.lastProcessedAt ?? 0,
    resetKey: user.id,
  });
  const scopedGame = useMemo(
    () => game ? scopeEconomyState(game, selectedProvinceId) : null,
    [game, selectedProvinceId],
  );

  useEffect(() => {
    onSignedOutRef.current = onSignedOut;
  }, [onSignedOut]);

  const handleUnauthorized = useCallback(() => {
    gameRef.current = null;
    revisionRef.current = null;
    resetGameStateDelivery();
    onSignedOutRef.current();
  }, []);
  const acceptState = useCallback((
    state: EconomyState,
    action: LocalActivityAction,
    message?: string,
    changedPartitions?: readonly StatePartitionName[],
  ) => {
    if (gameRef.current === state) return false;
    if (shouldSyncLocalActivity(changedPartitions)) {
      setLocalActivity(syncLocalActivity(user.id, state, { action, message, createdAt: Date.now() }));
    }
    gameRef.current = state;
    return true;
  }, [user.id]);
  const acceptVersionedState = useCallback((
    incomingRevision: number | undefined,
    state: EconomyState | undefined,
    action: LocalActivityAction,
    message?: string,
    changedPartitions?: readonly StatePartitionName[],
  ) => {
    const currentRevision = revisionRef.current;
    if (!canAcceptRevision(currentRevision, incomingRevision)) return false;
    if (typeof incomingRevision === 'number' && Number.isInteger(incomingRevision)) {
      revisionRef.current = incomingRevision;
    }
    if (state) acceptState(state, action, message, changedPartitions);
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
        acceptVersionedState(
          response.revision,
          response.state,
          'refresh',
          undefined,
          response.changedPartitions,
        );
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
    setLocalActivity(loadLocalActivity(user.id));

    const authoritySnapshot = getGameAuthoritySnapshot();
    const canReuseAuthority = reloadVersion === 0
      && authoritySnapshot.state?.userId === user.id
      && Number.isInteger(authoritySnapshot.revision);
    if (canReuseAuthority) {
      gameRef.current = authoritySnapshot.state;
      revisionRef.current = authoritySnapshot.revision;
      return;
    }

    gameRef.current = null;
    revisionRef.current = null;
    resetGameStateDelivery();
    void refresh();
  }, [refresh, reloadVersion, user.id]);
  useEffect(() => {
    if (!game) return;
    const normalized = game.provinces.some((province) => province.id === selectedProvinceId)
      ? selectedProvinceId
      : game.defaultProvinceId;
    if (normalized !== selectedProvinceId) setSelectedProvinceIdState(normalized);
    try { localStorage.setItem(provincePreferenceKey, normalized); } catch { /* preference is best-effort */ }
  }, [game, provincePreferenceKey, selectedProvinceId]);
  useEffect(() => () => {
    refreshTaskRef.current?.controller.abort();
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);
  useEffect(() => {
    if (!game) return undefined;
    const timer = window.setInterval(() => void refresh(), Math.max(1, Number(refreshRate)) * 1_000);
    return () => window.clearInterval(timer);
  }, [game, refresh, refreshRate]);
  const facilityTypes = game?.facilityTypes;
  useEffect(() => {
    if (!facilityTypes) return;
    if (!facilityTypes.some((facility) => facility.id === selectedFacilityTypeId)) {
      setSelectedFacilityTypeId(facilityTypes[0]?.id ?? 'farm');
    }
  }, [facilityTypes, selectedFacilityTypeId]);
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
  }, [game, marketAssetId, marketAssetKind]);

  const syncConfirmedAction = useCallback((
    response: GameActionResponse,
    action: LocalActivityAction,
  ) => {
    const authoritySnapshot = getGameAuthoritySnapshot();
    if (
      authoritySnapshot.state
      && typeof authoritySnapshot.revision === 'number'
      && authoritySnapshot.revision >= response.revision
    ) {
      acceptVersionedState(
        authoritySnapshot.revision,
        authoritySnapshot.state,
        action,
        response.result.message,
        authoritySnapshot.changedPartitions,
      );
      setLoadError('');
      return;
    }

    void (async () => {
      try {
        const stateResponse = await getGameState(revisionRef.current);
        if (stateResponse.revision < response.revision) {
          throw new Error('服务器状态同步落后于已确认操作');
        }
        acceptVersionedState(
          stateResponse.revision,
          stateResponse.state,
          action,
          response.result.message,
          stateResponse.changedPartitions,
        );
        setLoadError('');
      } catch (syncReason) {
        if (syncReason instanceof GameApiError && syncReason.status === 401) handleUnauthorized();
        else setLoadError(`操作已完成，但状态同步失败：${messageFromError(syncReason)}`);
      }
    })();
  }, [acceptVersionedState, handleUnauthorized]);

  const runAction = useCallback(async (action: LocalActivityAction, operation: () => Promise<GameActionResponse>): Promise<ActionResult> => {
    if (action === 'checkIn' && checkInPendingRef.current) {
      return { ok: false, message: '签到正在处理中' };
    }
    actionsInFlightRef.current += 1;
    refreshTaskRef.current?.controller.abort();
    if (action === 'checkIn') {
      checkInPendingRef.current = true;
      setIsCheckingIn(true);
    }
    const finish = () => {
      actionsInFlightRef.current = Math.max(0, actionsInFlightRef.current - 1);
      if (action === 'checkIn') {
        checkInPendingRef.current = false;
        setIsCheckingIn(false);
      }
    };
    try {
      const response = await operation();
      syncConfirmedAction(response, action);
      finish();
      return response.result;
    } catch (reason) {
      finish();
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();
      return { ok: false, message: messageFromError(reason) };
    }
  }, [handleUnauthorized, syncConfirmedAction]);

  const runAcknowledgedAction = useCallback(async (
    action: LocalActivityAction,
    operation: () => Promise<GameActionResponse>,
  ): Promise<ActionResult> => {
    actionsInFlightRef.current += 1;
    refreshTaskRef.current?.controller.abort();
    const finish = () => {
      actionsInFlightRef.current = Math.max(0, actionsInFlightRef.current - 1);
    };
    try {
      const response = await operation();
      syncConfirmedAction(response, action);
      finish();
      return response.result;
    } catch (reason) {
      finish();
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();
      return { ok: false, message: messageFromError(reason) };
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
      const response = await gameActions.placeAssetOrder(selectedProvinceId, assetKind, assetId, side, quantity, price);
      syncConfirmedAction(response, 'placeOrder');
      finish();
      return response.result;
    } catch (reason) {
      finish();
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();
      return { ok: false, message: messageFromError(reason) };
    }
  }, [handleUnauthorized, selectedProvinceId, syncConfirmedAction]);

  const derived = useDerivedGameData(game);
  function notify(message: string) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice('');
    }, 3_000);
  }
  async function showResult(actionResult: ActionResult | Promise<ActionResult>) { notify((await actionResult).message); }
  async function signOut() { try { await logout(); } finally { resetGameStateDelivery(); onSignedOutRef.current(); } }

  if (!game || !scopedGame || !derived) {
    if (loadError) return { status: 'error', message: loadError, retry: () => { setLoadError(''); setReloadVersion((current) => current + 1); } };
    return { status: 'loading' };
  }

  const loadedGame = scopedGame;
  const { cashShare, commodityShare, facilityShare } = buildAssetAllocation(
    derived.cashValue,
    derived.commodityValue,
    derived.facilityValue,
  );
  const avatarText = (loadedGame.playerName || user.email).slice(0, 1).toUpperCase();
  const selectedProvince = loadedGame.provinces.find((province) => province.id === selectedProvinceId)
    ?? loadedGame.provinces[0];
  const marketSummaryFor = (kind: AssetKind, assetId: string) => (
    kind === 'facility' ? loadedGame.facilityMarkets[assetId] : loadedGame.markets[assetId]
  );
  function setSelectedProvinceId(provinceId: string) {
    if (!loadedGame.provinces.some((province) => province.id === provinceId) || provinceId === selectedProvinceId) return;
    setSelectedProvinceIdState(provinceId);
    setOrderQuantity(1);
  }
  function setTab(nextTab: TabId) {
    if (nextTab === 'market') {
      setMarketViewMode('catalog');
      if (tab !== 'market') {
        setOrderPrice(defaultOrderPrice(
          loadedGame.orders,
          marketAssetKind,
          marketAssetId,
          orderSide,
          marketSummaryFor(marketAssetKind, marketAssetId),
        ));
        setOrderQuantity(1);
      }
    }
    setActiveTab(nextTab);
  }

  function selectMarketAsset(kind: AssetKind, assetId: string, navigateToMarket = true) {
    const changed = kind !== marketAssetKind || assetId !== marketAssetId;
    setMarketAssetKind(kind);
    setMarketAssetId(assetId);
    if (changed || tab !== 'market') {
      setOrderPrice(defaultOrderPrice(
        loadedGame.orders,
        kind,
        assetId,
        orderSide,
        marketSummaryFor(kind, assetId),
      ));
      setOrderQuantity(1);
    }
    setMarketViewMode('detail');
    if (navigateToMarket) setActiveTab('market');
  }

  function showMarketCatalog() {
    setMarketViewMode('catalog');
  }

  function selectOrderSide(side: OrderSide) {
    if (side === orderSide) return;
    setOrderSideState(side);
    setOrderPrice(defaultOrderPrice(
      loadedGame.orders,
      marketAssetKind,
      marketAssetId,
      side,
      marketSummaryFor(marketAssetKind, marketAssetId),
    ));
  }

  const model: LoadedGameViewModel = {
    user, game: loadedGame, derived,
    localTrades: localActivity.trades.filter((trade) => (
      (trade.provinceId || DEFAULT_PROVINCE_ID) === selectedProvinceId
    )),
    tab, setTab, notice,
    selectedProvinceId, selectedProvince, setSelectedProvinceId,
    selectedFacilityTypeId, setSelectedFacilityTypeId,
    marketAssetKind, marketAssetId, marketViewMode, showMarketCatalog, selectMarketAsset,
    orderSide, selectOrderSide, orderQuantity, setOrderQuantity, orderPrice, setOrderPrice,
    playerName: playerNameDraft.draft, setPlayerName: playerNameDraft.setDraft,
    refreshRate, setRefreshRate,
    isCheckingIn, inventoryUsed: derived.inventoryUsed,
    cashShare, commodityShare, facilityShare, avatarText,
    showResult, notify, refresh,
    clearLocalTrades: () => { setLocalActivity(clearLocalTradesStore(user.id, loadedGame)); notify('本地成交记录已清除'); },
    signOut,
    checkIn: () => runAction('checkIn', gameActions.checkIn),
    createTransportRoute: (input) => runAction('transportShip', () => gameActions.createTransportRoute(input)),
    updateTransportRoute: (routeId, input) => runAction('transportShip', () => gameActions.updateTransportRoute(routeId, input)),
    renameTransportRoute: (routeId, name) => runAction('transportShip', () => gameActions.renameTransportRoute(routeId, name)),
    deleteTransportRoute: (routeId) => runAction('transportShip', () => gameActions.deleteTransportRoute(routeId)),
    bankDeposit: (amount) => runAction('bankDeposit', () => gameActions.bankDeposit(amount)),
    bankWithdraw: (amount) => runAction('bankWithdraw', () => gameActions.bankWithdraw(amount)),
    bankBorrow: (amount, collateral, autoRepay = true) => runAction('bankBorrow', () => gameActions.bankBorrow(amount, collateral, autoRepay)),
    bankRepay: (loanId, amount) => runAction('bankRepay', () => gameActions.bankRepay(loanId, amount)),
    bankSetAutoRepay: (loanId, enabled) => runAction('bankSetAutoRepay', () => gameActions.bankSetAutoRepay(loanId, enabled)),
    buildFacility: (facilityTypeId, quantity = 1, procurement) => runAction('buildFacility', () => gameActions.buildFacility(selectedProvinceId, facilityTypeId, quantity, procurement)),
    startResearch: (technologyId) => runAction('startResearch', () => gameActions.startResearch(technologyId)),
    accelerateResearch: () => runAction('startResearch', gameActions.accelerateResearch),
    startFacility: (facilityTypeId) => runAction('startFacility', () => gameActions.startFacility(selectedProvinceId, facilityTypeId)),
    stopFacility: (facilityTypeId) => runAction('pauseFacility', () => gameActions.stopFacility(selectedProvinceId, facilityTypeId)),
    pauseFacility: (facilityTypeId) => runAction('pauseFacility', () => gameActions.pauseFacility(selectedProvinceId, facilityTypeId)),
    setFacilityRecipe: (facilityTypeId, recipeId) => runAcknowledgedAction(
      'setFacilityRecipe',
      () => gameActions.setFacilityRecipe(selectedProvinceId, facilityTypeId, recipeId),
    ),
    setFacilityRecipes: (targets) => runAcknowledgedAction(
      'setFacilityRecipe',
      () => gameActions.setFacilityRecipes(targets),
    ),
    placeAssetOrder,
    onlineAutoBuy: (productId, maxPrice, targetFreeInventory = 0) => runAction(
      'placeOrder',
      () => gameActions.autoBuyCommodity(selectedProvinceId, productId, maxPrice, targetFreeInventory),
    ),
    onlineAutoSell: (productId, price, minimumFreeInventory = 0) => runAction(
      'onlineAutoSell',
      () => gameActions.autoSellCommodity(selectedProvinceId, productId, price, minimumFreeInventory),
    ),
    cancelOrder: (orderId) => runAction('cancelOrder', () => gameActions.cancelOrder(orderId)),
    renamePlayer: (name) => runAction('renamePlayer', () => gameActions.renamePlayer(name)),
    redeemGift: (code) => runAction('redeemGift', () => gameActions.redeemGift(code)),
    exchangeGems: (gems) => runAction('exchangeGems', () => gameActions.exchangeGems(gems)),
  };
  return { status: 'ready', model };
}
