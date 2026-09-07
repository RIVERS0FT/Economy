import type { OnlineAutoTradeAwareGameViewModel } from '../../src/auto-trade/useOnlineAutoTrade';
import { GlobalBuildingsPage } from '../../src/pages/GlobalBuildingsPage';
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import type { GameTutorialController, TutorialAwareGameViewModel } from '../../src/game-guide/useGameTutorial';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../../src/components/icons/GameIcons';
import { GemIcon } from '../../src/components/icons/GemIcon';
import { GameShell } from '../../src/components/shell/GameShell';
import { ApplicationLayerRoot } from '../../src/components/visual/ApplicationLayerRoot';
import type { StatusBarItem } from '../../src/components/shell/StatusBar';
import { CurrencyAmount } from '../../src/components/ui/CurrencyAmount';
import { BuildingsPage } from '../../src/pages/BuildingsPage';
import { FacilityRecipeProfitMarketsProvider } from '../../src/components/facilities/FacilityRecipeProfitContext';
import type { TabId } from '../../src/config/navigation';
import { formatCurrency, formatNumber, formatRank } from '../../src/utils/formatters';
import provinces from '../../shared/provinces.json';
import '../../src/styles/globals.css';
import '../../src/styles/charts.css';
import '../../src/styles/desktop-sidebar.css';
import '../../src/styles/viewport.css';
import '../../src/styles/card-system.css';
import '../../src/styles/frosted-glass-chrome.css';
import '../../src/styles/mobile-status-navigation.css';
import '../../src/styles/mobile-status-layout.css';
import '../../src/styles/icon-system.css';
import '../../src/styles/product-artwork.css';
import '../../src/styles/industry-system.css';
import '../../src/styles/facility-production-formula.css';
import '../../src/styles/facility-group-card-grid.css';
import '../../src/styles/research-page.css';
import '../../src/styles/mobile-detail-sheet.css';
import '../../src/styles/warehouse-expansion.css';
import '../../src/styles/production-surface.css';
import '../../src/styles/regional-entity-page-title.css';
import '../../src/styles/contracts.css';
import '../../src/styles/asset-auctions.css';
import '../../src/styles/auction-card-layers.css';
import '../../src/styles/facility-artwork.css';
import '../../src/styles/gem-shop.css';
import '../../src/styles/overview.css';
import '../../src/styles/market-funds.css';
import '../../src/styles/market-account-table.css';
import '../../src/styles/market-page-polish.css';
import '../../src/styles/market-desktop-cleanup.css';
import '../../src/styles/province-page.css';
import '../../src/styles/design-system.css';
import '../../src/styles/interaction-states.css';
import '../../src/styles/primary-surfaces.css';
import '../../src/styles/form-controls.css';
import '../../src/styles/overview-polish.css';
import '../../src/styles/leaderboards.css';
import '../../src/styles/game-guide.css';
import '../../src/styles/financial-backdrop.css';
import '../../src/styles/province-map.css';
import '../../src/styles/strategic-game-shell.css';
import '../../src/styles/scrolling-page-sections.css';

const params = new URLSearchParams(window.location.search);
const view = 'production';
const scenario = params.get('scenario') ?? 'configuration-response-detail';
const fixedNow = new Date(2026, 6, 17, 22, 30, 0).getTime();

const auctionBidHistoryFetches: string[] = [];
const productionRecipeRequests: string[] = [];
const productionConfigurationBatches: Array<Array<{ provinceId: string; facilityTypeId: string; recipeId: string }>> = [];
const productionConfigurationGates: Array<(value: { ok: boolean; message: string }) => void> = [];
const productionConfigurationNotices: string[] = [];
const slowConfiguration = true;
Object.assign(window, {
  __auctionBidHistoryFetches: auctionBidHistoryFetches,
  __productionRecipeRequests: productionRecipeRequests,
  __productionConfigurationBatches: productionConfigurationBatches,
  __productionConfigurationNotices: productionConfigurationNotices,
  __confirmProductionConfiguration: (index: number, ok = true) => productionConfigurationGates[index]?.({ ok, message: ok ? '配置已确认' : '服务器拒绝配置' }),
});
const completedTutorial: GameTutorialController = {
  ready: true,
  run: null,
  isActive: false,
  isVisible: false,
  isCompleted: true,
  currentStep: null,
  currentStepIndex: 0,
  totalSteps: 9,
  statusLabel: '已完成当前版本教程',
  restart: () => {},
  hide: () => {},
  show: () => {},
  openCurrentTarget: () => {},
  recordBuildSubmit: () => {},
  recordFacilityStartClick: () => {},
  recordSellOrderSubmit: () => {},
  recordResearchStart: () => {},
  recordBankDeposit: () => {},
};

const activeTutorial: GameTutorialController = {
  ...completedTutorial,
  isActive: true,
  isVisible: true,
  isCompleted: false,
  currentStep: {
    id: 'build-facility',
    title: '建设一座工厂',
    description: '前往建筑页选择工厂并成功建设。',
    actionLabel: '前往建设',
    targetTab: 'buildings',
  },
  currentStepIndex: 1,
  statusLabel: '进行中 · 步骤 1/9',
};

document.documentElement.dataset.appSurface = ['overview', 'map', 'commerce', 'trade-confirmation', 'unified-buildings', 'regional-buildings', 'production', 'research', 'contracts', 'auction', 'gem-shop', 'scroll-ownership'].includes(view) ? 'game' : 'auth';

function buildOverviewModel(tab: TabId, setTabState: (tab: TabId) => void) {
  const hasActivity = ['activity', 'two-sided', 'many-orders'].includes(scenario);
  const hasAlerts = scenario === 'alerts';
  const hasTwoSidedOrders = scenario === 'two-sided';
  const hasManyOrders = scenario === 'many-orders';
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

  const game = {
    version: 34,
    lastProcessedAt: fixedNow,
    userId: 123,
    playerName: 'MEVIUS',
    registeredAt: fixedNow - 60 * 86_400_000,
    credits: 2,
    frozenCredits: orders.length > 0 ? 368 : 0,
    gems: scenario === 'check-in-complete' ? 12 : 4,
    checkIn: {
      timeZone: 'Asia/Shanghai',
      todayKey: scenario === 'check-in-complete' ? '2026-07-19' : '2026-07-17',
      weekKey: '2026-07-13',
      weekStartsAt: Date.UTC(2026, 6, 12, 16, 0, 0),
      weekEndsAt: Date.UTC(2026, 6, 19, 16, 0, 0),
      nextResetAt: Date.UTC(2026, 6, 17, 16, 0, 0),
      dateKeys: ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19'],
      claimedToday: scenario === 'check-in-complete',
      claimedDateKeys: scenario === 'check-in-complete'
        ? ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19']
        : ['2026-07-13', '2026-07-14', '2026-07-16'],
      weeklyClaimCount: scenario === 'check-in-complete' ? 7 : 3,
      weeklyBonusEarned: scenario === 'check-in-complete',
      weeklyBonusEligible: scenario !== 'check-in-partial',
      dailyRewardGems: 1,
      weeklyBonusGems: 5,
    },
    inventories: { machinery: { available: 580, frozen: 0 } },
    defaultProvinceId: '110000',
    provinces,
    provinceInventories: { '110000': { machinery: { available: 580, frozen: 0 } } },
    provinceAssetSummaries: Object.fromEntries(provinces.map((province) => [province.id, {
      provinceId: province.id,
      storedQuantity: province.id === '110000' ? 580 : 0,
      facilityCount: province.id === '110000' ? 18 : 0,
      runningFacilityCount: province.id === '110000' ? 12 : 0,
      blockedFacilityCount: 0,
      openOrderCount: province.id === '110000' ? orders.length : 0,
    }])),
    warehouseStoredQuantity: 580,
    facilityGroups: [{
      provinceId: '110000',
      facilityTypeId: 'machine-factory',
      count: 18,
      participatingCount: hasAlerts ? 0 : 12,
      listedCount: 0,
      availableCount: 18,
      productionAvailableCount: 18,
      projectedEffectiveCount: 18,
      enabled: true,
      status: facilityStatus,
      statusReason: facilityStatusReason,
      cycleStartedAt: fixedNow - 30_000,
      lifetimeOutput: 3200,
      activeRecipeId: 'machinery-recipe',
    }],
    products: [{ id: 'machinery', name: '机械', category: 'industrial', basePrice: 47 }],
    facilityTypes: [{
      id: 'machine-factory',
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
    provinceFacilityGroups: {},
    provinceMarkets: {},
    provinceFacilityMarkets: {},
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
      populationIssued: 0,
      systemSinks: 0,
      commodityVolume: 0,
      facilityVolume: 0,
      producedGoods: 34,
      boughtGoods: 56,
      soldGoods: 78,
      giftIssued: 0,
      invitationGemsIssued: 0,
    },
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



  return {
    user: { id: 123, email: 'runtime@example.com', role: 'user' },
    game,
    derived,
    localTrades: [],
    tab,
    setTab: (nextTab: TabId) => {
      Object.assign(window, { __lastSelectedTab: nextTab });
      setTabState(nextTab);
    },
    notice: '',
    selectedProvinceId: '110000',
    selectedProvince: provinces[0],
    setSelectedProvinceId: () => {},
    selectedFacilityTypeId: 'machine-factory',
    setSelectedFacilityTypeId: () => {},
    marketAssetKind: 'commodity',
    marketAssetId: 'machinery',
    selectMarketAsset: (_kind: string, assetId: string, navigateToMarket = true) => {
      Object.assign(window, { __lastSelectedAsset: assetId });
      if (navigateToMarket) {
        Object.assign(window, { __lastSelectedTab: 'market' });
        setTabState('market');
      }
    },
    orderSide: 'buy',
    selectOrderSide: () => {},
    orderQuantity: 1,
    setOrderQuantity: () => {},
    orderPrice: 47,
    setOrderPrice: () => {},
    playerName: 'MEVIUS',
    setPlayerName: () => {},
    refreshRate: '5',
    setRefreshRate: () => {},
    isCheckingIn: false,
    inventoryUsed: game.warehouseStoredQuantity,
    cashShare: 0,
    commodityShare: 28,
    facilityShare: 72,
    avatarText: 'M',
    showResult: async () => {},
    notify: () => {},
    refresh: async () => {},
    clearLocalTrades: () => {},
    signOut: async () => {},
    checkIn: async () => ({ ok: true, message: '签到成功，获得 1 宝石' }),
    exchangeGems: async () => ({ ok: true, message: '兑换成功' }),
    tutorial: scenario === 'tutorial' ? activeTutorial : completedTutorial,
  } as unknown as TutorialAwareGameViewModel;
}

function ProductionHarness() {
  const [tab, setTab] = useState<TabId>('buildings');
  const [configurationProvinceId, setConfigurationProvinceId] = useState('110000');
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
    if (scenario === 'production-crops' || slowConfiguration) {
      const baseType = next.game.facilityTypes[0];
      const baseGroup = next.game.facilityGroups[0];
      const cropRecipes = [
        { id: 'wheat-crop', name: '种植小麦', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'wheat', quantity: 1 } },
        { id: 'rice-crop', name: '种植水稻', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'rice', quantity: 1 } },
        { id: 'cotton-crop', name: '种植棉花', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'cotton', quantity: 1 } },
        { id: 'sugarcane-crop', name: '种植甘蔗', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'sugarcane', quantity: 1 } },
      ];
      const plansFor = (methodId: string) => Object.fromEntries(cropRecipes.map((recipe) => [recipe.id, {
        recipeId: methodId === 'open-field' ? recipe.id : `${recipe.id}--${methodId}`,
        baseRecipeId: recipe.id,
        productionMethodId: methodId,
        cycleMs: recipe.cycleMs,
        operatingCost: recipe.operatingCost,
        inputs: recipe.inputs,
        output: recipe.output,
      }]));
      next.game.products = [
        { id: 'wheat', name: '小麦', category: 'raw', basePrice: 4 },
        { id: 'rice', name: '水稻', category: 'raw', basePrice: 5 },
        { id: 'cotton', name: '棉花', category: 'raw', basePrice: 6 },
        { id: 'sugarcane', name: '甘蔗', category: 'raw', basePrice: 5 },
        ...next.game.products,
      ];
      next.game.facilityTypes = [{
        ...baseType,
        id: 'farm',
        name: '农场',
        defaultRecipeId: 'wheat-crop',
        recipes: cropRecipes,
        productionMethodGroups: [{
          id: 'operation',
          name: '作业制度',
          defaultMethodId: 'open-field',
          methods: [
            { id: 'open-field', name: '露天轮作', iconId: 'seedling', tone: 'neutral', plansByRecipeId: plansFor('open-field') },
            { id: 'tool-tillage', name: '工具耕作', iconId: 'tool', tone: 'success', plansByRecipeId: plansFor('tool-tillage') },
          ],
        }],
      }];
      next.game.facilityGroups = [{
        ...baseGroup,
        facilityTypeId: 'farm',
        activeRecipeId: 'wheat-crop',
      }];
    }
    Object.assign(next, {
      buildFacility: async () => ({ ok: true, message: '测试建设完成' }),
      startFacility: async () => ({ ok: true, message: '测试启动完成' }),
      stopFacility: async () => ({ ok: true, message: '测试停止完成' }),
      setFacilityRecipe: async (facilityTypeId: string, recipeId: string) => {
        productionRecipeRequests.push(`${facilityTypeId}:${recipeId}`);
        if (slowConfiguration) {
          productionConfigurationBatches.push([{ provinceId: configurationProvinceId, facilityTypeId, recipeId }]);
          return new Promise<{ ok: boolean; message: string }>((resolve) => productionConfigurationGates.push(resolve));
        }
        return { ok: true, message: '测试配方完成' };
      },
    });
    if (slowConfiguration) {
      const localGroups = next.game.facilityGroups.map((group) => ({ ...group, provinceId: '110000' }));
      next.game.provinceFacilityGroups = {
        '110000': localGroups,
        '120000': localGroups.map((group) => ({ ...group, provinceId: '120000' })),
      };
      next.game.facilityGroups = next.game.provinceFacilityGroups[configurationProvinceId];
      next.selectedProvinceId = configurationProvinceId;
      next.selectedProvince = next.game.provinces.find((province) => province.id === configurationProvinceId)!;
      next.setSelectedProvinceId = setConfigurationProvinceId;
      next.setFacilityRecipes = async (targets) => {
        productionConfigurationBatches.push(targets.map((target) => ({ ...target })));
        return new Promise<{ ok: boolean; message: string }>((resolve) => productionConfigurationGates.push(resolve));
      };
      next.showResult = async (result) => { productionConfigurationNotices.push((await result).message); };
      Object.assign(window, { __productionConfigurationAuthority: next.game });
    }
    return next;
  }, [tab, configurationProvinceId]);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '净资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: '服务器实时估值', emphasis: 'primary', onClick: () => model.setTab('bank') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(model.game.warehouseStoredQuantity), detail: '无限容量 · 实物库存总量' },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
        {scenario === 'configuration-response-global'
          ? <GlobalBuildingsPage model={model as OnlineAutoTradeAwareGameViewModel} />
          : <BuildingsPage model={model} />}
      </FacilityRecipeProfitMarketsProvider>
    </GameShell>
  );
}


createRoot(document.getElementById('root') as HTMLElement).render(
  <ApplicationLayerRoot><ProductionHarness /></ApplicationLayerRoot>,
);
