import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { GameTutorialController, TutorialAwareGameViewModel } from '../../src/game-guide/useGameTutorial';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../../src/components/icons/GameIcons';
import { GemIcon } from '../../src/components/icons/GemIcon';
import { GameShell } from '../../src/components/shell/GameShell';
import type { StatusBarItem } from '../../src/components/shell/StatusBar';
import { CurrencyAmount } from '../../src/components/ui/CurrencyAmount';
import { ScrollArea } from '../../src/components/ui/ScrollArea';
import { ContractPage } from '../../src/pages/ContractPage';
import { GemShopPage } from '../../src/pages/GemShopPage';
import { OverviewPage } from '../../src/pages/OverviewPage';
import { ProductionPage } from '../../src/pages/ProductionPage';
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
import '../../src/styles/industry-system.css';
import '../../src/styles/facility-production-formula.css';
import '../../src/styles/facility-group-card-grid.css';
import '../../src/styles/facility-detail-sheet.css';
import '../../src/styles/warehouse-expansion.css';
import '../../src/styles/production-surface.css';
import '../../src/styles/contracts.css';
import '../../src/styles/gem-shop.css';
import '../../src/styles/overview.css';
import '../../src/styles/design-system.css';
import '../../src/styles/primary-surfaces.css';
import '../../src/styles/form-controls.css';
import '../../src/styles/overview-polish.css';
import '../../src/styles/game-guide.css';

const localActivityResult = loadLocalActivity(123);
Object.assign(window, { __localActivityResult: localActivityResult });

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'settings';
const scenario = params.get('scenario') ?? 'empty';
const fixedNow = new Date(2026, 6, 17, 22, 30, 0).getTime();

const completedTutorial: GameTutorialController = {
  ready: true,
  run: null,
  isActive: false,
  isVisible: false,
  isCompleted: true,
  currentStep: null,
  currentStepIndex: 0,
  totalSteps: 6,
  statusLabel: '已完成当前版本教程',
  restart: () => {},
  hide: () => {},
  show: () => {},
  openCurrentTarget: () => {},
  recordWorkClick: () => {},
  recordBuildSubmit: () => {},
  recordFacilityStartClick: () => {},
  recordSellOrderSubmit: () => {},
};

document.documentElement.dataset.appSurface = ['overview', 'production', 'contracts', 'gem-shop', 'scroll-ownership'].includes(view) ? 'game' : 'auth';

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
    version: 17,
    lastProcessedAt: fixedNow,
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
    exchangeGems: async () => ({ ok: true, message: '兑换成功' }),
    tutorial: completedTutorial,
  } as unknown as TutorialAwareGameViewModel;
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
    tutorial: completedTutorial,
  } as unknown as TutorialAwareGameViewModel;

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

function ProductionHarness() {
  const [tab, setTab] = useState<TabId>('production');
  const model = useMemo(() => {
    const next = buildOverviewModel(tab, setTab);
    next.game.credits = 10_000;
    next.game.inventories = {
      ...next.game.inventories,
      steel: { available: 200, frozen: 0 },
    };
    next.game.products = [
      { id: 'steel', name: '钢材', category: 'industrial', basePrice: 29 },
      ...next.game.products,
    ];
    Object.assign(next, {
      buildFacility: async () => ({ ok: true, message: '测试建设完成' }),
      startFacility: async () => ({ ok: true, message: '测试启动完成' }),
      stopFacility: async () => ({ ok: true, message: '测试停止完成' }),
      setFacilityRecipe: async () => ({ ok: true, message: '测试配方完成' }),
      upgradeWarehouse: async () => ({ ok: true, message: '测试扩容完成' }),
    });
    return next;
  }, [tab]);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '总资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: '服务器实时估值', emphasis: 'primary', onClick: () => model.setTab('assets') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库剩余', value: formatNumber(model.game.warehouseAvailableCapacity), detail: `已用 ${formatNumber(model.game.warehouseUsedCapacity)}/${formatNumber(model.game.inventoryCapacity)}` },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <ProductionPage model={model} />
    </GameShell>
  );
}

function GemShopHarness() {
  const [tab, setTab] = useState<TabId>('gem-shop');
  const model = useMemo(() => {
    const next = buildOverviewModel(tab, setTab);
    next.game.gems = 40;
    next.game.credits = 23_594;
    return next;
  }, [tab]);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '总资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: '服务器实时估值', emphasis: 'primary', onClick: () => model.setTab('assets') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库剩余', value: formatNumber(model.game.warehouseAvailableCapacity), detail: `已用 ${formatNumber(model.game.warehouseUsedCapacity)}/${formatNumber(model.game.inventoryCapacity)}` },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <GemShopPage model={model} />
    </GameShell>
  );
}

function ContractHarness() {
  const [tab, setTab] = useState<TabId>('contracts');
  const model = useMemo(() => {
    const next = buildOverviewModel(tab, setTab);
    Object.assign(next.game, {
      productionContracts: [
        {
          id: 'contract-active',
          publisherId: 456,
          publisherName: '机械供应商',
          publisherRole: 'supplier',
          buyerId: 123,
          buyerName: 'MEVIUS',
          supplierId: 456,
          supplierName: '机械供应商',
          productId: 'machinery',
          quantityPerDelivery: 100,
          unitPrice: 47,
          batchGross: 4_700,
          deliveryIntervalMs: 60 * 60_000,
          totalDeliveries: 12,
          completedDeliveries: 4,
          firstDeliveryDelayMs: 60 * 60_000,
          createdAt: fixedNow - 4 * 86_400_000,
          offerExpiresAt: fixedNow + 3 * 86_400_000,
          acceptedAt: fixedNow - 3 * 86_400_000,
          nextDueAt: fixedNow + 45 * 60_000,
          status: 'active',
          roundStatus: 'preparing',
          buyerEscrowCredits: 2_000,
          supplierReservedQuantity: 100,
          buyerBondCredits: 940,
          supplierBondCredits: 940,
          buyerAutoFund: false,
          supplierAutoReserve: true,
          issue: '采购方货款不足，请补充本批货款。',
          isPublisher: false,
          isBuyer: true,
          isSupplier: false,
        },
        {
          id: 'contract-open',
          publisherId: 789,
          publisherName: '长期采购商',
          publisherRole: 'buyer',
          buyerId: 789,
          buyerName: '长期采购商',
          supplierId: null,
          supplierName: null,
          productId: 'machinery',
          quantityPerDelivery: 80,
          unitPrice: 49,
          batchGross: 3_920,
          deliveryIntervalMs: 3 * 60 * 60_000,
          totalDeliveries: 10,
          completedDeliveries: 0,
          firstDeliveryDelayMs: 60 * 60_000,
          createdAt: fixedNow - 30 * 60_000,
          offerExpiresAt: fixedNow + 3 * 86_400_000,
          nextDueAt: null,
          status: 'open',
          roundStatus: 'preparing',
          buyerEscrowCredits: 0,
          supplierReservedQuantity: 0,
          buyerBondCredits: 0,
          supplierBondCredits: 0,
          buyerAutoFund: false,
          supplierAutoReserve: false,
          issue: null,
          isPublisher: false,
          isBuyer: false,
          isSupplier: false,
        },
        {
          id: 'contract-history',
          publisherId: 123,
          publisherName: 'MEVIUS',
          publisherRole: 'buyer',
          buyerId: 123,
          buyerName: 'MEVIUS',
          supplierId: 456,
          supplierName: '历史供应商',
          productId: 'machinery',
          quantityPerDelivery: 60,
          unitPrice: 45,
          batchGross: 2_700,
          deliveryIntervalMs: 6 * 60 * 60_000,
          totalDeliveries: 8,
          completedDeliveries: 8,
          firstDeliveryDelayMs: 60 * 60_000,
          createdAt: fixedNow - 20 * 86_400_000,
          offerExpiresAt: fixedNow - 17 * 86_400_000,
          acceptedAt: fixedNow - 19 * 86_400_000,
          nextDueAt: null,
          status: 'completed',
          roundStatus: 'ready',
          buyerEscrowCredits: 0,
          supplierReservedQuantity: 0,
          buyerBondCredits: 0,
          supplierBondCredits: 0,
          buyerAutoFund: true,
          supplierAutoReserve: true,
          completedAt: fixedNow - 86_400_000,
          issue: null,
          isPublisher: true,
          isBuyer: true,
          isSupplier: false,
        },
      ],
      productionContractSummary: {
        active: 1,
        open: 0,
        needsAttention: 1,
        upcomingWithin24Hours: 1,
      },
    });
    return next;
  }, [tab]);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '总资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: '服务器实时估值', emphasis: 'primary', onClick: () => model.setTab('assets') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库剩余', value: formatNumber(model.game.warehouseAvailableCapacity), detail: `已用 ${formatNumber(model.game.warehouseUsedCapacity)}/${formatNumber(model.game.inventoryCapacity)}` },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <ContractPage model={model} />
    </GameShell>
  );
}

function ScrollOwnershipHarness() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, padding: 24 }}>
      <ScrollArea
        axis="y"
        className="scroll-ownership-custom-outer"
        viewportClassName="scroll-ownership-custom-outer-viewport"
        viewportStyle={{ height: 220, overflowY: 'auto' }}
        verticalAutoHide={false}
      >
        <ScrollArea
          axis="y"
          className="scroll-ownership-custom-inner"
          viewportClassName="scroll-ownership-custom-inner-viewport"
          viewportStyle={{ height: 120, overflowY: 'auto' }}
          verticalAutoHide={false}
        >
          <div style={{ height: 560 }} aria-hidden="true" />
        </ScrollArea>
        <div style={{ height: 760 }} aria-hidden="true" />
      </ScrollArea>

      <ScrollArea
        axis="y"
        className="scroll-ownership-native-outer"
        viewportClassName="scroll-ownership-native-outer-viewport"
        viewportStyle={{ height: 220, overflowY: 'auto' }}
        verticalAutoHide={false}
      >
        <div
          className="scroll-ownership-native-inner"
          style={{ height: 120, overflowY: 'auto' }}
          tabIndex={0}
        >
          <div style={{ height: 560 }} aria-hidden="true" />
        </div>
        <div style={{ height: 760 }} aria-hidden="true" />
      </ScrollArea>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  view === 'overview'
    ? <OverviewHarness />
    : view === 'production'
      ? <ProductionHarness />
      : view === 'contracts'
      ? <ContractHarness />
      : view === 'gem-shop'
        ? <GemShopHarness />
        : view === 'scroll-ownership'
          ? <ScrollOwnershipHarness />
          : <SettingsHarness />,
);
