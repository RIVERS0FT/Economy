import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../../src/components/icons/GameIcons';
import { GemIcon } from '../../src/components/icons/GemIcon';
import { GameShell } from '../../src/components/shell/GameShell';
import type { StatusBarItem } from '../../src/components/shell/StatusBar';
import { CurrencyAmount } from '../../src/components/ui/CurrencyAmount';
import { OverviewPage } from '../../src/pages/OverviewPage';
import { SettingsPage } from '../../src/pages/SettingsPage';
import type { TabId } from '../../src/config/navigation';
import { formatCurrency, formatNumber, formatRank } from '../../src/utils/formatters';
import { loadLocalActivity } from '../../src/utils/localActivityStore';
import '../../src/styles/globals.css';
import '../../src/styles/desktop-sidebar.css';
import '../../src/styles/viewport.css';
import '../../src/styles/card-system.css';
import '../../src/styles/liquid-glass-chrome.css';
import '../../src/styles/mobile-status-navigation.css';
import '../../src/styles/mobile-status-layout.css';
import '../../src/styles/icon-system.css';
import '../../src/styles/overview.css';
import '../../src/styles/design-system.css';
import '../../src/styles/overview-polish.css';

const localActivityResult = loadLocalActivity(123);
Object.assign(window, { __localActivityResult: localActivityResult });

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'settings';
const scenario = params.get('scenario') ?? 'empty';
const fixedNow = new Date(2026, 6, 17, 22, 30, 0).getTime();

document.documentElement.dataset.appSurface = view === 'overview' ? 'game' : 'auth';

function buildOverviewModel(tab: TabId, setTabState: (tab: TabId) => void) {
  const hasActivity = ['activity', 'two-sided', 'many-orders'].includes(scenario);
  const hasAlerts = scenario === 'alerts';
  const hasTwoSidedOrders = scenario === 'two-sided';
  const hasManyOrders = scenario === 'many-orders';
  const hasThreeCashEvents = scenario === 'cash-three';
  const hasCashMovement = scenario !== 'cash-empty';
  const baseOrder = {
    assetKind: 'commodity',
    assetId: 'machinery',
    productId: 'machinery',
    isOwn: true,
    quantity: 20,
    remaining: 8,
    status: 'partial',
  };
  const orders = hasManyOrders
    ? Array.from({ length: 6 }, (_, index) => ({
        ...baseOrder,
        id: `order-${index + 1}`,
        side: index % 2 === 0 ? 'buy' : 'sell',
        price: index % 2 === 0 ? 46 - index : 50 + index,
        createdAt: fixedNow - (index + 1) * 10 * 60_000,
      }))
    : hasTwoSidedOrders
      ? [
          { ...baseOrder, id: 'order-buy', side: 'buy', price: 46, createdAt: fixedNow - 20 * 60_000 },
          { ...baseOrder, id: 'order-sell', side: 'sell', price: 50, createdAt: fixedNow - 10 * 60_000 },
        ]
      : hasActivity || hasAlerts
        ? [{ ...baseOrder, id: 'order-1', side: 'buy', price: 46, createdAt: fixedNow - 20 * 60_000 }]
        : [];
  const priceHistory = hasActivity ? [
    { price: 44, quantity: 4, createdAt: fixedNow - 3 * 60 * 60_000, takerSide: 'buy' },
    { price: 46, quantity: 2, createdAt: fixedNow - 2 * 60 * 60_000, takerSide: 'sell' },
    { price: 47, quantity: 6, createdAt: fixedNow - 30 * 60_000, takerSide: 'buy' },
  ] : [];
  const facilityStatus = hasAlerts ? 'error' : 'running';
  const facilityStatusReason = hasAlerts ? 'insufficient_input' : undefined;
  const warehouseAvailableCapacity = hasAlerts ? 12 : 1335;
  const inventoryCapacity = 6650;

  const game = {
    version: 15,
    userId: 123,
    playerName: 'MEVIUS',
    registeredAt: fixedNow - 60 * 86_400_000,
    credits: 2,
    frozenCredits: orders.length > 0 ? 368 : 0,
    gems: 0,
    inventories: { machinery: { available: 580, frozen: 0 } },
    inventoryCapacity,
    warehouseLevel: 12,
    warehouseUpgradeCost: 2400,
    warehouseNextCapacity: 7000,
    warehouseNextCapacityIncrease: 350,
    warehouseStoredQuantity: inventoryCapacity - warehouseAvailableCapacity,
    warehouseReservedQuantity: 0,
    warehouseUsedCapacity: inventoryCapacity - warehouseAvailableCapacity,
    warehouseAvailableCapacity,
    facilityGroups: [{
      facilityTypeId: 'machinery-plant',
      count: 18,
      participatingCount: hasAlerts ? 0 : 12,
      pendingJoinCount: 0,
      listedCount: 0,
      availableCount: 18,
      nextCycleCount: 12,
      enabled: true,
      status: facilityStatus,
      statusReason: facilityStatusReason,
      cycleStartedAt: fixedNow - 30_000,
      lifetimeOutput: 3200,
      activeRecipeId: 'machinery-recipe',
    }],
    products: [{ id: 'machinery', name: '机械', category: 'industrial', basePrice: 47 }],
    facilityTypes: [{
      id: 'machinery-plant',
      name: '机械工厂',
      category: 'industrial',
      buildCost: 500,
      buildTimeMs: 60_000,
      cycleMs: 120_000,
      operatingCost: 8,
      inputs: [{ productId: 'steel', quantity: 2 }],
      output: { productId: 'machinery', quantity: 1 },
      defaultRecipeId: 'machinery-recipe',
      recipes: [{
        id: 'machinery-recipe',
        name: '机械制造',
        cycleMs: 120_000,
        operatingCost: 8,
        inputs: [{ productId: 'steel', quantity: 2 }],
        output: { productId: 'machinery', quantity: 1 },
      }],
      systemValue: 500,
    }],
    markets: {
      machinery: {
        productId: 'machinery',
        lastPrice: 47,
        priceHistory,
        demand: {
          cycleMs: 300_000,
          nextDemandAt: fixedNow + 60_000,
          lastBudget: 0,
          lastQuantity: 0,
          lastPrice: 47,
          satisfaction: 1,
          referencePrice: 47,
          observedPrice: 47,
          costAnchor: null,
          downstreamValueAnchor: null,
          targetPrice: 47,
        },
      },
    },
    facilityMarkets: {},
    orders,
    leaderboard: [{
      rank: 1,
      playerName: 'MEVIUS',
      totalAssets: 96_786,
      cashAssets: 2,
      facilityCount: 18,
      weeklyChange: -116_543,
      updatedAt: fixedNow,
      isCurrentPlayer: true,
    }],
    assetSummary: {
      cashValue: 370,
      commodityValue: 27_260,
      facilityValue: 69_156,
      totalAssets: 96_786,
    },
    stats: {
      workIssued: 20,
      populationIssued: 0,
      systemSinks: 0,
      commodityVolume: 0,
      facilityVolume: 0,
      workClicks: 12,
      producedGoods: 34,
      boughtGoods: 56,
      soldGoods: 78,
      giftIssued: 0,
      invitationGemsIssued: 0,
    },
    work: { cooldownUntil: 0, lastWorkedAt: fixedNow - 20_000, streak: 0, totalClicks: 12 },
  };

  const derived = {
    ownOpenOrders: orders,
    facilityValue: 69_156,
    commodityValue: 27_260,
    cashValue: 370,
    totalAssets: 96_786,
    currentRank: game.leaderboard[0],
    previousRank: null,
    runningFacilities: hasAlerts ? 0 : 12,
    constructingFacilities: 0,
    stoppedFacilities: 0,
    blockedFacilities: hasAlerts ? 18 : 0,
    inventoryUsed: game.warehouseStoredQuantity,
  };

  const syncEvent = {
    id: 'asset-event-sync',
    category: 'system',
    createdAt: fixedNow - 60 * 60_000,
    description: '服务器资产状态已同步',
    cashDelta: 0,
    availableCashAfter: 2,
    frozenCashDelta: 0,
    inventoryChanges: [],
    facilityChanges: [],
    productionChanges: [],
    sourceType: 'sync',
    localOnly: true,
  };
  const cashEvents = hasCashMovement
    ? Array.from({ length: hasThreeCashEvents ? 3 : 1 }, (_, index) => ({
        id: `asset-event-${index + 1}`,
        category: 'facility',
        createdAt: fixedNow - (index + 2) * 60 * 60_000,
        description: index === 0 ? '购置机械工厂' : `经营现金变动 ${index + 1}`,
        cashDelta: index === 1 ? 8_420 : -(80_000 + index * 1_000),
        availableCashAfter: 2,
        frozenCashDelta: 0,
        inventoryChanges: [],
        facilityChanges: [],
        productionChanges: [],
        sourceType: 'facility',
        localOnly: true,
      }))
    : [];
  const localAssetEvents = [syncEvent, ...cashEvents];

  return {
    user: { id: 123, email: 'runtime@example.com', role: 'user' },
    game,
    derived,
    localAssetEvents,
    localTrades: [],
    tab,
    setTab: (nextTab: TabId) => {
      Object.assign(window, { __lastSelectedTab: nextTab });
      setTabState(nextTab);
    },
    notice: '',
    selectedFacilityTypeId: 'machinery-plant',
    setSelectedFacilityTypeId: () => {},
    marketAssetKind: 'commodity',
    marketAssetId: 'machinery',
    selectMarketAsset: (_kind: string, assetId: string) => {
      Object.assign(window, { __lastSelectedTab: 'market', __lastSelectedAsset: assetId });
      setTabState('market');
    },
    orderSide: 'buy',
    selectOrderSide: () => {},
    orderQuantity: 1,
    setOrderQuantity: () => {},
    orderPrice: 47,
    setOrderPrice: () => {},
    playerName: 'MEVIUS',
    setPlayerName: () => {},
    compactNumbers: false,
    setCompactNumbers: () => {},
    refreshRate: '5',
    setRefreshRate: () => {},
    now: fixedNow,
    workRemaining: 0,
    isWorking: false,
    inventoryUsed: game.warehouseStoredQuantity,
    cashShare: 0,
    commodityShare: 28,
    facilityShare: 72,
    allocationStyle: {},
    avatarText: 'M',
    showResult: async () => {},
    notify: () => {},
    refresh: async () => {},
    clearLocalActivity: () => {},
    signOut: async () => {},
    work: async () => ({ ok: true, message: '工作完成' }),
  } as unknown as LoadedGameViewModel;
}

function SettingsHarness() {
  const [playerName, setPlayerName] = useState('测试玩家');
  const [compactNumbers, setCompactNumbers] = useState(false);
  const [refreshRate, setRefreshRate] = useState('5');
  const model = {
    user: { id: 123, email: 'runtime@example.com', role: 'user' },
    game: {
      playerName: '测试玩家',
      registeredAt: Date.UTC(2026, 6, 17),
      stats: {
        workClicks: 12,
        producedGoods: 34,
        boughtGoods: 56,
        soldGoods: 78,
      },
    },
    avatarText: '测',
    playerName,
    setPlayerName,
    compactNumbers,
    setCompactNumbers,
    refreshRate,
    setRefreshRate,
    renamePlayer: async () => ({ ok: true, message: '昵称已保存' }),
    redeemGift: async () => ({ ok: false, message: '测试环境不兑换礼品' }),
    showResult: async () => {},
    notify: () => {},
    signOut: async () => {},
    reset: async () => ({ ok: true, message: '测试环境已重置' }),
  } as unknown as LoadedGameViewModel;

  return <SettingsPage model={model} />;
}

function OverviewHarness() {
  const [tab, setTab] = useState<TabId>('home');
  const [overviewProductId, setOverviewProductId] = useState('machinery');
  const model = useMemo(() => buildOverviewModel(tab, setTab), [tab]);
  const weeklyChange = model.derived.currentRank?.weeklyChange ?? 0;
  const weeklyMagnitude = Math.abs(weeklyChange);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '总资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: <span className="negative" aria-label={`本周资产下降 ${formatCurrency(weeklyMagnitude)}`}>↓ 本周 <CurrencyAmount>{formatCurrency(weeklyMagnitude)}</CurrencyAmount></span>, emphasis: 'primary', onClick: () => model.setTab('assets') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库剩余', value: formatNumber(model.game.warehouseAvailableCapacity), detail: `已用 ${formatNumber(model.game.warehouseUsedCapacity)}/${formatNumber(model.game.inventoryCapacity)}` },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <OverviewPage model={model} overviewProductId={overviewProductId} onOverviewProductChange={setOverviewProductId} />
    </GameShell>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  view === 'overview' ? <OverviewHarness /> : <SettingsHarness />,
);
