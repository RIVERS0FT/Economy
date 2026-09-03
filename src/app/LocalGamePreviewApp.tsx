import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LoadedGameViewModel, MarketViewMode } from './gameViewModel';
import { deriveGameDataSnapshot } from './useDerivedGameData';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { GameShell } from '../components/shell/GameShell';
import type { TabId } from '../config/navigation';
import { installLocalGamePreviewFetch } from '../dev/localGamePreviewFetch';
import previewFixtureJson from '../dev/generated/local-game-preview-state.json';
import type { GameTutorialController } from '../game-guide/useGameTutorial';
import { PageRouter } from '../pages/PageRouter';
import type {
  AssetKind,
  EconomyState,
  OrderSide,
  TradeRecord,
} from '../types';
import { provinceFor, scopeEconomyState } from '../utils/provinceScope';
import regionCatalog from '../../shared/provinces.json';

installLocalGamePreviewFetch();

const PREVIEW_ACTION_MESSAGE = '免登录游戏模式使用本地模拟数据，不会提交真实操作。';
const previewFixture = previewFixtureJson as unknown as {
  generatedAt: number;
  state: EconomyState;
};
const previewProvinceNameById = new Map(regionCatalog.map((province) => [province.id, province.name]));

function rebaseEpochTimestamps(value: unknown, delta: number): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry) => rebaseEpochTimestamps(entry, delta));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' && entry >= 1_000_000_000_000 && entry <= 3_000_000_000_000) {
      (value as Record<string, unknown>)[key] = entry + delta;
    } else {
      rebaseEpochTimestamps(entry, delta);
    }
  }
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function shanghaiTodayKey(now: number) {
  return formatDateKey(now + 8 * 60 * 60_000);
}

function rebaseCheckInDateKeys(game: EconomyState, now: number) {
  const sourceTodayKey = game.checkIn.todayKey;
  const targetTodayKey = shanghaiTodayKey(now);
  const sourceToday = parseDateKey(sourceTodayKey);
  const targetToday = parseDateKey(targetTodayKey);
  const rebaseDateKey = (dateKey: string) => formatDateKey(
    targetToday + (parseDateKey(dateKey) - sourceToday),
  );
  game.checkIn.todayKey = targetTodayKey;
  game.checkIn.dateKeys = game.checkIn.dateKeys.map(rebaseDateKey);
  game.checkIn.claimedDateKeys = game.checkIn.claimedDateKeys.map(rebaseDateKey);
  game.checkIn.weekKey = game.checkIn.dateKeys[0] || targetTodayKey;
  game.checkIn.claimedToday = game.checkIn.claimedDateKeys.includes(targetTodayKey);
}

function createPreviewGameState() {
  const game = structuredClone(previewFixture.state);
  const now = Date.now();
  rebaseEpochTimestamps(game, now - previewFixture.generatedAt);
  rebaseCheckInDateKeys(game, now);
  game.provinces = game.provinces.map((province) => ({
    ...province,
    name: previewProvinceNameById.get(province.id) || province.name,
  }));
  return game;
}

const completedTutorial: GameTutorialController = {
  ready: true,
  run: null,
  isActive: false,
  isVisible: false,
  isCompleted: true,
  currentStep: null,
  currentStepIndex: 0,
  totalSteps: 9,
  statusLabel: '本地预览已跳过教程',
  restart: () => {},
  hide: () => {},
  show: () => {},
  openCurrentTarget: () => {},
  recordBuildSubmit: () => {},
  recordFacilityStartClick: () => {},
  recordAutoSellCompletion: () => {},
  recordResearchStart: () => {},
  recordBankDeposit: () => {},
};

const emptyAutoTradeStatus = {
  availableInventory: 0,
  productionReserved: 0,
  contractReserved: 0,
  currentFreeInventory: 0,
  buyDesiredQuantity: 0,
  buyEligibleQuantity: 0,
  buyFundingLimited: false,
  blockedBuyByOwnSell: false,
  hasCrossingSeller: false,
  hasManagedBuyOrder: false,
  buyNeedsMaintenance: false,
  sellEligibleQuantity: 0,
  blockedSellByOwnBuy: false,
  hasCrossingBuyer: false,
  hasManagedSellOrder: false,
  sellNeedsMaintenance: false,
};

const previewTrades: TradeRecord[] = [
  {
    id: 'preview-trade-1', type: 'commodity', productId: 'wheat', provinceId: '110000', side: 'buy',
    quantity: 80, price: 3.2, total: 256, createdAt: Date.now() - 55 * 60_000, description: '本地模拟成交',
  },
  {
    id: 'preview-trade-2', type: 'commodity', productId: 'steel', provinceId: '110000', side: 'sell',
    quantity: 12, price: 22.4, total: 268.8, fee: 2.688, netTotal: 266.112,
    createdAt: Date.now() - 3 * 60 * 60_000, description: '本地模拟成交',
  },
];

export function LocalGamePreviewApp() {
  const [authorityGame, setAuthorityGame] = useState(createPreviewGameState);
  const [tab, setTabState] = useState<TabId>('map');
  const [selectedProvinceId, setSelectedProvinceIdState] = useState(authorityGame.defaultProvinceId);
  const [selectedFacilityTypeId, setSelectedFacilityTypeId] = useState('farm');
  const [marketAssetKind, setMarketAssetKind] = useState<AssetKind>('commodity');
  const [marketAssetId, setMarketAssetId] = useState('wheat');
  const [marketViewMode, setMarketViewMode] = useState<MarketViewMode>('catalog');
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(3.4);
  const [playerName, setPlayerName] = useState(authorityGame.playerName);
  const [refreshRate, setRefreshRate] = useState('5');
  const [notice, setNotice] = useState('本地免登录游戏模式：模拟数据不会保存或提交。');
  const [localTrades, setLocalTrades] = useState(previewTrades);
  const noticeTimerRef = useRef<number | null>(null);

  const game = useMemo(
    () => scopeEconomyState(authorityGame, selectedProvinceId),
    [authorityGame, selectedProvinceId],
  );
  const selectedProvince = useMemo(
    () => provinceFor(authorityGame, selectedProvinceId),
    [authorityGame, selectedProvinceId],
  );
  const derived = useMemo(() => deriveGameDataSnapshot(game), [game]);

  useLayoutEffect(() => {
    const previousTitle = document.title;
    document.title = 'Economy 免登录游戏模式';
    document.documentElement.dataset.appSurface = 'game';
    document.documentElement.dataset.appBackdrop = 'game';
    document.documentElement.dataset.appTone = 'normal';
    document.documentElement.dataset.localGamePreview = 'true';
    return () => {
      document.title = previousTitle;
      delete document.documentElement.dataset.localGamePreview;
    };
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  const notify = useCallback((message: string) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice('');
    }, 3_000);
  }, []);

  const localOnlyAction = useCallback(async () => ({ ok: false, message: PREVIEW_ACTION_MESSAGE }), []);
  const showResult = useCallback(async (result: ReturnType<typeof localOnlyAction>) => {
    notify((await result).message);
  }, [notify]);
  const setTab = useCallback((nextTab: TabId) => {
    if (nextTab === 'market') setMarketViewMode('catalog');
    setTabState(nextTab);
  }, []);
  const setSelectedProvinceId = useCallback((provinceId: string) => {
    if (!authorityGame.provinces.some((province) => province.id === provinceId)) return;
    setSelectedProvinceIdState(provinceId);
    setOrderQuantity(1);
  }, [authorityGame.provinces]);
  const selectMarketAsset = useCallback((kind: AssetKind, assetId: string, navigateToMarket = true) => {
    setMarketAssetKind(kind);
    setMarketAssetId(assetId);
    setOrderQuantity(1);
    const nextPrice = kind === 'commodity'
      ? game.markets[assetId]?.lastPrice
      : game.facilityMarkets[assetId]?.lastPrice;
    setOrderPrice(Math.max(0.01, Number(nextPrice || 1)));
    setMarketViewMode('detail');
    if (navigateToMarket) setTabState('market');
  }, [game.facilityMarkets, game.markets]);
  const showMarketCatalog = useCallback(() => setMarketViewMode('catalog'), []);
  const renamePlayer = useCallback(async (name: string) => {
    const normalized = name.trim().slice(0, 32);
    if (!normalized) return { ok: false, message: '昵称不能为空' };
    setPlayerName(normalized);
    setAuthorityGame((current) => ({ ...current, playerName: normalized }));
    return { ok: true, message: '昵称仅在当前免登录预览中更新，刷新后恢复。' };
  }, []);

  const autoTrade = useMemo<OnlineAutoTradeAwareGameViewModel['autoTrade']>(() => ({
    buyPolicies: {},
    sellPolicies: {},
    busyProductId: null,
    busySide: null,
    buyPolicyFor: (productId) => ({
      enabled: false,
      maxPrice: Math.max(0.01, Number(game.markets[productId]?.lastPrice || 1)),
      targetFreeInventory: 0,
    }),
    sellPolicyFor: (productId) => ({
      enabled: false,
      price: Math.max(0.01, Number(game.markets[productId]?.lastPrice || 1)),
      minimumFreeInventory: 0,
    }),
    statusFor: (productId) => ({
      ...emptyAutoTradeStatus,
      availableInventory: Math.max(0, Number(game.inventories[productId]?.available || 0)),
      currentFreeInventory: Math.max(0, Number(game.inventories[productId]?.available || 0)),
    }),
    setPolicy: localOnlyAction,
  }), [game.inventories, game.markets, localOnlyAction]);

  if (!derived) return null;
  const totalAssets = Math.max(1, derived.totalAssets);
  const cashShare = Math.round(derived.cashValue / totalAssets * 100);
  const commodityShare = Math.round(derived.commodityValue / totalAssets * 100);
  const facilityShare = Math.max(0, 100 - cashShare - commodityShare);
  const model: OnlineAutoTradeAwareGameViewModel = {
    user: { id: authorityGame.userId, email: 'preview@local.invalid', name: playerName, role: 'user' },
    game,
    derived,
    localTrades: localTrades.filter((trade) => trade.provinceId === selectedProvinceId),
    tab,
    setTab,
    selectedProvinceId,
    selectedProvince,
    setSelectedProvinceId,
    notice,
    selectedFacilityTypeId,
    setSelectedFacilityTypeId,
    marketAssetKind,
    marketAssetId,
    marketViewMode,
    showMarketCatalog,
    selectMarketAsset,
    orderSide,
    selectOrderSide: setOrderSide,
    orderQuantity,
    setOrderQuantity,
    orderPrice,
    setOrderPrice,
    playerName,
    setPlayerName,
    refreshRate,
    setRefreshRate,
    isWorking: false,
    isCheckingIn: false,
    inventoryUsed: derived.inventoryUsed,
    cashShare,
    commodityShare,
    facilityShare,
    avatarText: playerName.slice(0, 1).toUpperCase(),
    showResult,
    notify,
    refresh: async () => {},
    clearLocalTrades: () => {
      setLocalTrades([]);
      notify('本地模拟成交记录已清除，刷新页面后恢复。');
    },
    signOut: async () => notify('免登录游戏模式没有登录会话；关闭页面即可退出。'),
    work: localOnlyAction,
    checkIn: localOnlyAction,
    createTransportRoute: localOnlyAction,
    updateTransportRoute: localOnlyAction,
    renameTransportRoute: localOnlyAction,
    deleteTransportRoute: localOnlyAction,
    bankDeposit: localOnlyAction,
    bankWithdraw: localOnlyAction,
    bankBorrow: localOnlyAction,
    bankRepay: localOnlyAction,
    bankSetAutoRepay: localOnlyAction,
    buildFacility: localOnlyAction,
    startResearch: localOnlyAction,
    accelerateResearch: localOnlyAction,
    startFacility: localOnlyAction,
    stopFacility: localOnlyAction,
    pauseFacility: localOnlyAction,
    setFacilityRecipe: localOnlyAction,
    placeAssetOrder: localOnlyAction,
    onlineAutoBuy: localOnlyAction,
    onlineAutoSell: localOnlyAction,
    cancelOrder: localOnlyAction,
    renamePlayer,
    redeemGift: localOnlyAction,
    exchangeGems: localOnlyAction,
    tutorial: completedTutorial,
    autoTrade,
  } as LoadedGameViewModel & OnlineAutoTradeAwareGameViewModel;

  return (
    <GameShell model={model} offline>
      <PageRouter model={model} />
    </GameShell>
  );
}
