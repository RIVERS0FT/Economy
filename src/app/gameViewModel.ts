import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { gameActions, GameApiError, type GameActionResponse, type GameActionResult } from '../api/game';
import { logout } from '../api/auth';
import { type TabId } from '../config/navigation';
import type { AssetKind, AuthUser, EconomyState, OrderSide, TradeRecord } from '../types';
import { buildAssetAllocation } from '../utils/assetAllocation';
import { defaultOrderPrice } from '../utils/defaultOrderPrice';
import {
  clearLocalTrades as clearLocalTradesStore,
  type LocalActivityAction,
} from '../utils/localActivityStore';
import { deriveGameData, type DerivedGameData } from './gameDerivedData';
import {
  messageFromGameError,
  useAuthoritativeGameState,
  type RefreshOptions,
} from './useAuthoritativeGameState';

export { facilityStatusNames, facilityStatusReasonNames, orderStatusNames } from './gameViewModelLabels';
export type { DerivedGameData } from './gameDerivedData';
export type { RefreshMode, RefreshOptions } from './useAuthoritativeGameState';

export type ActionResult = GameActionResult;

export interface LoadedGameViewModel {
  user: AuthUser;
  game: EconomyState;
  derived: DerivedGameData;
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
  work: () => Promise<ActionResult>;
  checkIn: () => Promise<ActionResult>;
  bankDeposit: (amount: number) => Promise<ActionResult>;
  bankWithdraw: (amount: number) => Promise<ActionResult>;
  bankBorrow: (amount: number, collateral: Array<{ facilityTypeId: string; quantity: number }>, autoRepay?: boolean) => Promise<ActionResult>;
  bankRepay: (loanId: string, amount: number | 'all') => Promise<ActionResult>;
  bankSetAutoRepay: (loanId: string, enabled: boolean) => Promise<ActionResult>;
  upgradeWarehouse: () => Promise<ActionResult>;
  buildFacility: (facilityTypeId: string) => Promise<ActionResult>;
  startResearch: (targetComplexity: string) => Promise<ActionResult>;
  accelerateFacilityConstruction: () => Promise<ActionResult>;
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

export function useGameViewModel(user: AuthUser, onSignedOut: () => void): GameViewModelState {
  const [refreshRate, setRefreshRate] = useState('5');
  const authoritative = useAuthoritativeGameState(user, onSignedOut, refreshRate);
  const {
    game,
    localActivity,
    setLocalActivity,
    loadError,
    retry,
    refresh,
    beginAction,
    endAction,
    syncConfirmedAction,
    handleUnauthorized,
  } = authoritative;
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
  const [isWorking, setIsWorking] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const workPendingRef = useRef(false);
  const checkInPendingRef = useRef(false);
  const orderPendingRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!game) return;
    setPlayerName(game.playerName);
    if (!game.facilityTypes.some((facility) => facility.id === selectedFacilityTypeId)) {
      setSelectedFacilityTypeId(game.facilityTypes[0]?.id ?? 'farm');
    }
  }, [game, selectedFacilityTypeId]);

  useEffect(() => {
    if (!game) return;
    if (marketAssetKind === 'commodity') {
      const product = game.products.find((item) => item.id === marketAssetId) ?? game.products[0];
      if (product && product.id !== marketAssetId) setMarketAssetId(product.id);
      return;
    }
    const type = game.facilityTypes.find((item) => item.id === marketAssetId) ?? game.facilityTypes[0];
    if (type && type.id !== marketAssetId) setMarketAssetId(type.id);
  }, [game, marketAssetId, marketAssetKind]);

  const runAction = useCallback(async (
    action: LocalActivityAction,
    operation: () => Promise<GameActionResponse>,
  ): Promise<ActionResult> => {
    if (action === 'work' && workPendingRef.current) {
      return { ok: false, message: '工作正在处理中' };
    }
    if (action === 'checkIn' && checkInPendingRef.current) {
      return { ok: false, message: '签到正在处理中' };
    }
    beginAction();
    if (action === 'work') {
      workPendingRef.current = true;
      setIsWorking(true);
    }
    if (action === 'checkIn') {
      checkInPendingRef.current = true;
      setIsCheckingIn(true);
    }
    try {
      const response = await operation();
      await syncConfirmedAction(response, action);
      return response.result;
    } catch (reason) {
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();
      return { ok: false, message: messageFromGameError(reason) };
    } finally {
      endAction();
      if (action === 'work') {
        workPendingRef.current = false;
        setIsWorking(false);
      }
      if (action === 'checkIn') {
        checkInPendingRef.current = false;
        setIsCheckingIn(false);
      }
    }
  }, [beginAction, endAction, handleUnauthorized, syncConfirmedAction]);

  const placeAssetOrder = useCallback(async (
    assetKind: AssetKind,
    assetId: string,
    side: OrderSide,
    quantity: number,
    price: number,
  ): Promise<ActionResult> => {
    if (orderPendingRef.current) return { ok: false, message: '市场订单正在同步中，请勿重复提交' };
    orderPendingRef.current = true;
    beginAction();
    const finish = () => {
      endAction();
      orderPendingRef.current = false;
    };
    try {
      const response = await gameActions.placeAssetOrder(assetKind, assetId, side, quantity, price);
      void syncConfirmedAction(response, 'placeOrder').finally(finish);
      return response.result;
    } catch (reason) {
      finish();
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();
      return { ok: false, message: messageFromGameError(reason) };
    }
  }, [beginAction, endAction, handleUnauthorized, syncConfirmedAction]);

  const derived = useMemo(() => (game ? deriveGameData(game) : null), [game]);

  const notify = useCallback((message: string) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice('');
    }, 3_000);
  }, []);

  const showResult = useCallback(async (actionResult: ActionResult | Promise<ActionResult>) => {
    notify((await actionResult).message);
  }, [notify]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      onSignedOut();
    }
  }, [onSignedOut]);

  if (!game || !derived) {
    if (loadError) return { status: 'error', message: loadError, retry };
    return { status: 'loading' };
  }

  const loadedGame = game;
  const { cashShare, commodityShare, facilityShare } = buildAssetAllocation(
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
    user,
    game: loadedGame,
    derived,
    localTrades: localActivity.trades,
    tab,
    setTab,
    notice,
    selectedFacilityTypeId,
    setSelectedFacilityTypeId,
    marketAssetKind,
    marketAssetId,
    selectMarketAsset,
    orderSide,
    selectOrderSide,
    orderQuantity,
    setOrderQuantity,
    orderPrice,
    setOrderPrice,
    playerName,
    setPlayerName,
    compactNumbers,
    setCompactNumbers,
    refreshRate,
    setRefreshRate,
    isWorking,
    isCheckingIn,
    inventoryUsed: derived.inventoryUsed,
    cashShare,
    commodityShare,
    facilityShare,
    avatarText,
    showResult,
    notify,
    refresh,
    clearLocalTrades: () => {
      setLocalActivity(clearLocalTradesStore(user.id, loadedGame));
      notify('本地成交记录已清除');
    },
    signOut,
    work: () => runAction('work', gameActions.work),
    checkIn: () => runAction('checkIn', gameActions.checkIn),
    bankDeposit: (amount) => runAction('bankDeposit', () => gameActions.bankDeposit(amount)),
    bankWithdraw: (amount) => runAction('bankWithdraw', () => gameActions.bankWithdraw(amount)),
    bankBorrow: (amount, collateral, autoRepay = true) => (
      runAction('bankBorrow', () => gameActions.bankBorrow(amount, collateral, autoRepay))
    ),
    bankRepay: (loanId, amount) => runAction('bankRepay', () => gameActions.bankRepay(loanId, amount)),
    bankSetAutoRepay: (loanId, enabled) => (
      runAction('bankSetAutoRepay', () => gameActions.bankSetAutoRepay(loanId, enabled))
    ),
    upgradeWarehouse: () => runAction('upgradeWarehouse', gameActions.upgradeWarehouse),
    buildFacility: (facilityTypeId) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId)),
    startResearch: (targetComplexity) => (
      runAction('startResearch', () => gameActions.startResearch(targetComplexity))
    ),
    accelerateFacilityConstruction: () => runAction('buildFacility', gameActions.accelerateFacilityConstruction),
    startFacility: (facilityTypeId) => (
      runAction('startFacility', () => gameActions.startFacility(facilityTypeId))
    ),
    stopFacility: (facilityTypeId) => (
      runAction('pauseFacility', () => gameActions.stopFacility(facilityTypeId))
    ),
    pauseFacility: (facilityTypeId) => (
      runAction('pauseFacility', () => gameActions.pauseFacility(facilityTypeId))
    ),
    setFacilityRecipe: (facilityTypeId, recipeId) => (
      runAction('setFacilityRecipe', () => gameActions.setFacilityRecipe(facilityTypeId, recipeId))
    ),
    placeAssetOrder,
    cancelOrder: (orderId) => runAction('cancelOrder', () => gameActions.cancelOrder(orderId)),
    renamePlayer: (name) => runAction('renamePlayer', () => gameActions.renamePlayer(name)),
    redeemGift: (code) => runAction('redeemGift', () => gameActions.redeemGift(code)),
    exchangeGems: (gems) => runAction('exchangeGems', () => gameActions.exchangeGems(gems)),
  };
  return { status: 'ready', model };
}
