import { GlobalBuildingsPage } from '../../src/pages/GlobalBuildingsPage';
import { GlobalMarketPage } from '../../src/pages/GlobalMarketPage';
import { CommercePage } from '../../src/pages/CommercePage';
import type { CommercialBuildingGroup } from '../../src/types/commercial';
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
import { ScrollArea } from '../../src/components/ui/ScrollArea';
import { AuctionPage } from '../../src/pages/AuctionPage';
import { ContractPage } from '../../src/pages/ContractPage';
import { GemShopPage } from '../../src/pages/GemShopPage';
import { LeaderboardPage } from '../../src/pages/LeaderboardPage';
import { MarketPage } from '../../src/pages/MarketPage';
import { OverviewPage } from '../../src/pages/OverviewPage';
import { MapPage } from '../../src/pages/MapPage';
import { ProvincePage } from '../../src/pages/ProvincePage';
import { BuildingsPage } from '../../src/pages/BuildingsPage';
import { ResearchPage } from '../../src/pages/ResearchPage';
import { FacilityRecipeProfitMarketsProvider } from '../../src/components/facilities/FacilityRecipeProfitContext';
import { SettingsPage } from '../../src/pages/SettingsPage';
import type { TabId } from '../../src/config/navigation';
import type { AssetKind, ProductMarketState } from '../../src/types';
import { formatCurrency, formatNumber, formatRank } from '../../src/utils/formatters';
import { loadLocalActivity } from '../../src/utils/localActivityStore';
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
import provinces from '../../shared/provinces.json';

const localActivityResult = loadLocalActivity(123);
Object.assign(window, { __localActivityResult: localActivityResult });

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'settings';
const scenario = params.get('scenario') ?? 'empty';
const fixedNow = new Date(2026, 6, 17, 22, 30, 0).getTime();

const auctionBidHistoryFetches: string[] = [];
const productionRecipeRequests: string[] = [];
Object.assign(window, {
  __auctionBidHistoryFetches: auctionBidHistoryFetches,
  __productionRecipeRequests: productionRecipeRequests,
});
if (view === 'auction') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/economy-api/game/auctions/auction-runtime-1/bids') && (!init?.method || init.method === 'GET')) {
      auctionBidHistoryFetches.push(url);
      return new Response(JSON.stringify({
        history: {
          auctionId: 'auction-runtime-1',
          bidCount: 12,
          latestBidAt: fixedNow - 30_000,
          bids: Array.from({ length: 10 }, (_, index) => ({
            bidderLabel: `竞买人 A${String((index % 2) + 1).padStart(2, '0')}`,
            amount: 122 - index * 2,
            createdAt: fixedNow - (index + 1) * 30_000,
            isMine: index % 3 === 0,
          })),
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(input, init);
  };
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

document.documentElement.dataset.appSurface = ['overview', 'map', 'commerce', 'unified-buildings', 'regional-buildings', 'production', 'research', 'contracts', 'auction', 'gem-shop', 'scroll-ownership'].includes(view) ? 'game' : 'auth';

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

function MapHarness() {
  const [tab, setTab] = useState<TabId>(scenario === 'locked-province' ? 'province' : 'map');
  const [provinceId, setProvinceId] = useState(scenario === 'locked-province' ? 'US-TX' : '110000');
  const [marketAssetKind, setMarketAssetKind] = useState<AssetKind>('commodity');
  const [marketAssetId, setMarketAssetId] = useState('machinery');
  const [marketViewMode, setMarketViewMode] = useState<'catalog' | 'detail'>('catalog');
  const model = useMemo(() => {
    const next = buildOverviewModel(tab, setTab);
    const game = scenario === 'locked-province'
      ? {
          ...next.game,
          startingProvinceId: '110000',
          startingProvinceChosen: false,
          unlockedProvinces: ['110000'],
        }
      : next.game;
    return {
      ...next,
      game,
      selectedProvinceId: provinceId,
      selectedProvince: provinces.find((province) => province.id === provinceId) || provinces[0],
      setSelectedProvinceId: setProvinceId,
      marketAssetKind,
      marketAssetId,
      marketViewMode,
      showMarketCatalog: () => setMarketViewMode('catalog'),
      selectMarketAsset: (kind: AssetKind, assetId: string, navigateToMarket = true) => {
        setMarketAssetKind(kind);
        setMarketAssetId(assetId);
        setMarketViewMode('detail');
        Object.assign(window, { __lastSelectedAsset: assetId });
        if (navigateToMarket) {
          Object.assign(window, { __lastSelectedTab: 'market' });
          setTab('market');
        }
      },
    };
  }, [marketAssetId, marketAssetKind, marketViewMode, provinceId, tab]);
  const page = tab === 'province'
    ? <ProvincePage model={model} />
    : tab === 'market'
      ? <MarketPage model={model} />
      : tab === 'buildings'
        ? (
            <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
              <BuildingsPage model={model} />
            </FacilityRecipeProfitMarketsProvider>
          )
        : <MapPage model={model} />;
  return (
    <GameShell model={model}>
      {page}
    </GameShell>
  );
}

function SettingsHarness() {
  const [playerName, setPlayerName] = useState('测试玩家');
  const [refreshRate, setRefreshRate] = useState('5');
  const model = {
    user: { id: 123, email: 'runtime@example.com', role: 'user' },
    game: {
      playerName: '测试玩家',
      registeredAt: Date.UTC(2026, 6, 17),
      stats: {
        producedGoods: 34,
        boughtGoods: 56,
        soldGoods: 78,
      },
    },
    avatarText: '测',
    playerName,
    setPlayerName,
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
  const model = useMemo(() => buildOverviewModel(tab, setTab), [tab]);
  const weeklyChange = model.derived.currentRank?.weeklyChange ?? 0;
  const weeklyMagnitude = Math.abs(weeklyChange);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '净资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: <span className="negative" aria-label={`本周净资产下降 ${formatCurrency(weeklyMagnitude)}`}>↓ 本周 <CurrencyAmount>{formatCurrency(weeklyMagnitude)}</CurrencyAmount></span>, emphasis: 'primary', onClick: () => model.setTab('bank') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(model.game.warehouseStoredQuantity), detail: '无限容量 · 实物库存总量' },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <OverviewPage model={model} />
    </GameShell>
  );
}

function LeaderboardHarness() {
  const [tab, setTab] = useState<TabId>('leaderboard');
  const model = useMemo(() => {
    const next = buildOverviewModel(tab, setTab);
    const entries = (
      scores: number[],
      details: string[],
      rewards: number[] = [],
    ) => scores.map((score, index) => ({
      rank: index + 1,
      playerName: ['Atlas 集团', 'MEVIUS', 'Riversoft 实业'][index],
      score,
      secondary: Math.max(0, Math.round(score * 0.38)),
      detail: details[index],
      isCurrentPlayer: index === 1,
      rewardGems: rewards[index],
    }));
    const wealth = entries([128_600, 96_786, 82_420], ['24 座工厂', '18 座工厂', '15 座工厂']);
    const growth = entries([12_800, 9_460, 7_920], ['本周增长', '本周增长', '本周增长'], [50, 30, 20]);
    const production = entries([4_820, 3_560, 2_940], ['商品产出', '商品产出', '商品产出'], [50, 30, 20]);
    const trading = entries([18_600, 14_250, 11_980], ['成交额', '成交额', '成交额'], [50, 30, 20]);
    next.game.leaderboards = {
      period: {
        key: '2026-W29',
        startsAt: fixedNow - 4 * 86_400_000,
        endsAt: fixedNow + 3 * 86_400_000,
        partial: false,
        rewardEnabled: true,
        rewards: [50, 30, 20],
        timeZone: 'Asia/Shanghai',
      },
      boards: {
        wealth: {
          id: 'wealth',
          title: '财富榜',
          description: '按实时净资产排名',
          unit: 'currency',
          rewarded: false,
          entries: wealth,
          currentPlayer: wealth[1],
          totalPlayers: 128,
          personalBest: { score: 92_400, periodKey: '2026-W28', currentIsRecord: true },
        },
        growth: {
          id: 'growth',
          title: '增长榜',
          description: '本周净资产增长',
          unit: 'currency',
          rewarded: true,
          entries: growth,
          currentPlayer: growth[1],
          totalPlayers: 128,
          personalBest: { score: 8_900, periodKey: '2026-W28', currentIsRecord: true },
        },
        production: {
          id: 'production',
          title: '生产榜',
          description: '本周服务器确认的商品产出数量',
          unit: 'quantity',
          rewarded: true,
          entries: production,
          currentPlayer: production[1],
          totalPlayers: 128,
          personalBest: { score: 3_220, periodKey: '2026-W28', currentIsRecord: true },
        },
        trading: {
          id: 'trading',
          title: '交易榜',
          description: '本周订单簿成交额',
          unit: 'currency',
          rewarded: true,
          entries: trading,
          currentPlayer: trading[1],
          totalPlayers: 128,
          personalBest: { score: 13_900, periodKey: '2026-W28', currentIsRecord: true },
        },
      },
    };
    return next;
  }, [tab]);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '净资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: '服务器实时估值', emphasis: 'primary', onClick: () => model.setTab('bank') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: '#2', detail: '当前排名' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(model.game.warehouseStoredQuantity), detail: '无限容量 · 实物库存总量' },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <LeaderboardPage model={model} />
    </GameShell>
  );
}

function ProductionHarness() {
  const [tab, setTab] = useState<TabId>('buildings');
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
    if (scenario === 'production-methods') {
      const baseType = next.game.facilityTypes[0];
      const baseRecipe = baseType.recipes[0];
      next.game.facilityTypes = [{
        ...baseType,
        productionMethodGroups: [{
          id: 'operation',
          name: '作业制度',
          defaultMethodId: 'machining-assembly',
          methods: [
            {
              id: 'machining-assembly', name: '机加装配', iconId: 'gear', description: '按机加与装配工序制造机械。', tone: 'neutral',
              plansByRecipeId: {
                [baseRecipe.id]: {
                  recipeId: baseRecipe.id,
                  baseRecipeId: baseRecipe.id,
                  productionMethodId: 'machining-assembly',
                  cycleMs: baseRecipe.cycleMs,
                  operatingCost: baseRecipe.operatingCost,
                  inputs: baseRecipe.inputs,
                  output: baseRecipe.output,
                },
              },
            },
            {
              id: 'precision-machining', name: '精密机加', iconId: 'precision-machine', description: '精密机加并加快工序周转。', tone: 'warning',
              plansByRecipeId: {
                [baseRecipe.id]: {
                  recipeId: `${baseRecipe.id}--precision-machining`,
                  baseRecipeId: baseRecipe.id,
                  productionMethodId: 'precision-machining',
                  cycleMs: 60_000,
                  operatingCost: 12,
                  inputs: baseRecipe.inputs,
                  output: baseRecipe.output,
                },
              },
            },
            {
              id: 'cellular-manufacturing', name: '单元制造', iconId: 'factory-cell', description: '按制造单元组织生产。', tone: 'success',
              plansByRecipeId: {
                [baseRecipe.id]: {
                  recipeId: `${baseRecipe.id}--cellular-manufacturing`,
                  baseRecipeId: baseRecipe.id,
                  productionMethodId: 'cellular-manufacturing',
                  cycleMs: 180_000,
                  operatingCost: 4,
                  inputs: baseRecipe.inputs,
                  output: baseRecipe.output,
                },
              },
            },
            {
              id: 'automated-assembly', name: '自动装配线', iconId: 'robot-arm', description: '自动组织双倍装配批次。', tone: 'accent',
              plansByRecipeId: {
                [baseRecipe.id]: {
                  recipeId: `${baseRecipe.id}--automated-assembly`,
                  baseRecipeId: baseRecipe.id,
                  productionMethodId: 'automated-assembly',
                  cycleMs: baseRecipe.cycleMs,
                  operatingCost: 16,
                  inputs: baseRecipe.inputs.map((input) => ({ ...input, quantity: input.quantity * 2 })),
                  output: { ...baseRecipe.output, quantity: baseRecipe.output.quantity * 2 },
                },
              },
            },
          ],
        }],
      }];
      next.game.facilityGroups = [{
        ...next.game.facilityGroups[0],
        activeRecipeId: `${baseRecipe.id}--precision-machining`,
        staffingRateBps: 8_000,
      }];
    }
    if (scenario === 'production-crops') {
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
    if (scenario === 'decimal-profit') {
      const markets = next.game.markets as Record<string, ProductMarketState>;
      markets.steel = {
        ...markets.machinery,
        productId: 'steel',
        lastPrice: 29,
        officialPrice: 28.75,
        lastTradePrice: 28.75,
        priceHistory: [],
      };
      markets.machinery = {
        ...markets.machinery,
        officialPrice: 76.25,
        lastTradePrice: 76.25,
      };
    }
    if (scenario === 'facility-card-profit') {
      const markets = next.game.markets as Record<string, ProductMarketState>;
      markets.steel = {
        ...markets.machinery,
        productId: 'steel',
        lastPrice: 29,
        officialPrice: 28.75,
        lastTradePrice: 28.75,
        priceHistory: [],
      };
      markets.machinery = {
        ...markets.machinery,
        officialPrice: 76.25,
        lastTradePrice: 76.25,
      };
      const baseType = next.game.facilityTypes[0];
      const baseGroup = next.game.facilityGroups[0];
      const lossRecipe = {
        id: 'sawmill-loss-recipe',
        name: '测试亏损配方',
        cycleMs: 120_000,
        operatingCost: 8,
        inputs: [{ productId: 'steel', quantity: 3 }],
        output: { productId: 'machinery', quantity: 1 },
      };
      next.game.facilityTypes = [
        baseType,
        {
          ...baseType,
          id: 'sawmill',
          name: '锯木厂',
          defaultRecipeId: lossRecipe.id,
          inputs: lossRecipe.inputs,
          output: lossRecipe.output,
          recipes: [lossRecipe],
        },
      ];
      next.game.facilityGroups = [
        baseGroup,
        {
          ...baseGroup,
          facilityTypeId: 'sawmill',
          count: 7,
          participatingCount: 7,
          availableCount: 7,
          productionAvailableCount: 7,
          projectedEffectiveCount: 7,
          activeRecipeId: lossRecipe.id,
        },
      ];
    }
    if (scenario === 'facility-order') {
      const baseType = next.game.facilityTypes[0];
      const baseGroup = next.game.facilityGroups[0];
      const orderedTypes = [
        { id: 'farm', name: '农场', complexity: 'C1' },
        { id: 'orchard', name: '果园', complexity: 'C1' },
        { id: 'ranch', name: '畜牧场', complexity: 'C1' },
        { id: 'fishery', name: '渔场', complexity: 'C1' },
        { id: 'mine', name: '矿场', complexity: 'C2' },
        { id: 'steelworks', name: '冶炼厂', complexity: 'C3' },
        { id: 'refinery', name: '炼油厂', complexity: 'C4' },
        { id: 'machine-factory', name: '机械厂', complexity: 'C5' },
        { id: 'electronics-factory', name: '电子厂', complexity: 'C6' },
        { id: 'appliance-factory', name: '家电厂', complexity: 'C7' },
      ];
      next.game.facilityTypes = orderedTypes.map((type) => ({ ...baseType, ...type }));
      next.game.facilityGroups = [...orderedTypes].reverse().map((type, index) => ({
        ...baseGroup,
        facilityTypeId: type.id,
        count: index + 1,
        participatingCount: index + 1,
        availableCount: index + 1,
        productionAvailableCount: index + 1,
        projectedEffectiveCount: index + 1,
      }));
    }
    if (scenario === 'cluster-summary') {
      const baseType = next.game.facilityTypes[0];
      const baseGroup = next.game.facilityGroups[0];
      next.game.facilityTypes = [
        baseType,
        { ...baseType, id: 'sawmill', name: '锯木厂' },
        { ...baseType, id: 'flour-mill', name: '磨坊' },
        { ...baseType, id: 'electronics-factory', name: '电子厂' },
      ];
      next.game.facilityGroups = [
        baseGroup,
        {
          ...baseGroup,
          facilityTypeId: 'sawmill',
          count: 7,
          participatingCount: 7,
          productionAvailableCount: 7,
          projectedEffectiveCount: 7,
          availableCount: 7,
          status: 'running',
          statusReason: undefined,
        },
        {
          ...baseGroup,
          facilityTypeId: 'flour-mill',
          count: 4,
          participatingCount: 0,
          productionAvailableCount: 4,
          projectedEffectiveCount: 4,
          availableCount: 4,
          enabled: false,
          status: 'stopped',
          statusReason: 'manual',
        },
        {
          ...baseGroup,
          facilityTypeId: 'electronics-factory',
          count: 3,
          participatingCount: 0,
          productionAvailableCount: 3,
          projectedEffectiveCount: 3,
          availableCount: 3,
          status: 'error',
          statusReason: 'insufficient_input',
        },
      ];
      next.game.facilityConstruction = {
        facilityTypeId: 'machine-factory',
        startedAt: fixedNow - 10_000,
        completesAt: fixedNow + 50_000,
        buildCost: 500,
      };
      next.derived.constructingFacilities = 1;
    }
    Object.assign(next, {
      buildFacility: async () => ({ ok: true, message: '测试建设完成' }),
      startFacility: async () => ({ ok: true, message: '测试启动完成' }),
      stopFacility: async () => ({ ok: true, message: '测试停止完成' }),
      setFacilityRecipe: async (facilityTypeId: string, recipeId: string) => {
        productionRecipeRequests.push(`${facilityTypeId}:${recipeId}`);
        return { ok: true, message: '测试配方完成' };
      },
    });
    return next;
  }, [tab]);
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
        <BuildingsPage model={model} />
      </FacilityRecipeProfitMarketsProvider>
    </GameShell>
  );
}


function ResearchHarness() {
  const [tab, setTab] = useState<TabId>('research');
  const model = useMemo(() => {
    const next = buildOverviewModel(tab, setTab);
    const baseType = next.game.facilityTypes[0];
    const facilityCatalog = [
      { id: 'farm', name: '农场', complexity: 'C1' },
      { id: 'orchard', name: '果园', complexity: 'C1' },
      { id: 'mine', name: '矿场', complexity: 'C2' },
      { id: 'sawmill', name: '锯木厂', complexity: 'C2' },
      { id: 'steelworks', name: '冶炼厂', complexity: 'C3' },
      { id: 'food-factory', name: '食品厂', complexity: 'C3' },
      { id: 'refinery', name: '炼油厂', complexity: 'C4' },
      { id: 'machine-factory', name: '机械厂', complexity: 'C5' },
      { id: 'electronics-factory', name: '电子厂', complexity: 'C6' },
      { id: 'appliance-factory', name: '家电厂', complexity: 'C7' },
    ] as const;
    next.game.facilityTypes = facilityCatalog.map((facility) => ({
      ...baseType,
      ...facility,
    }));
    next.game.researchLevels = [
      {
            "id": "C1",
            "rank": 1,
            "cost": 0,
            "durationMs": 0
      },
      {
            "id": "C2",
            "rank": 2,
            "cost": 2100,
            "durationMs": 1740000
      },
      {
            "id": "C3",
            "rank": 3,
            "cost": 3100,
            "durationMs": 5280000
      },
      {
            "id": "C4",
            "rank": 4,
            "cost": 6800,
            "durationMs": 15000000
      },
      {
            "id": "C5",
            "rank": 5,
            "cost": 4400,
            "durationMs": 9900000
      },
      {
            "id": "C6",
            "rank": 6,
            "cost": 4500,
            "durationMs": 11700000
      },
      {
            "id": "C7",
            "rank": 7,
            "cost": 7000,
            "durationMs": 18900000
      }
];
    Object.assign(next.game, { researchTechnologies: [
      {
            "id": "basic-crops",
            "name": "基础种植",
            "stage": "C1",
            "rank": 1,
            "cost": 0,
            "durationMs": 0,
            "initial": true,
            "prerequisiteTechnologyIds": [],
            "unlockFacilityTypeIds": [
                  "farm",
                  "orchard"
            ],
            "description": "掌握基础农作物与果树种植。"
      },
      {
            "id": "basic-livestock",
            "name": "基础养殖",
            "stage": "C1",
            "rank": 1,
            "cost": 0,
            "durationMs": 0,
            "initial": true,
            "prerequisiteTechnologyIds": [],
            "unlockFacilityTypeIds": [
                  "ranch",
                  "fishery"
            ],
            "description": "掌握基础畜牧与渔业生产。"
      },
      {
            "id": "forestry-development",
            "name": "林业开发",
            "stage": "C2",
            "rank": 2,
            "cost": 300,
            "durationMs": 240000,
            "prerequisiteTechnologyIds": [
                  "basic-crops"
            ],
            "unlockFacilityTypeIds": [
                  "logging-camp"
            ],
            "description": "建立规模化木材采伐能力。"
      },
      {
            "id": "mineral-exploration",
            "name": "矿产勘探",
            "stage": "C2",
            "rank": 2,
            "cost": 350,
            "durationMs": 300000,
            "prerequisiteTechnologyIds": [
                  "basic-crops"
            ],
            "unlockFacilityTypeIds": [
                  "mine"
            ],
            "description": "建立铁矿与铜矿勘探开采能力。"
      },
      {
            "id": "petroleum-exploration",
            "name": "石油勘探",
            "stage": "C2",
            "rank": 2,
            "cost": 400,
            "durationMs": 360000,
            "prerequisiteTechnologyIds": [
                  "basic-crops"
            ],
            "unlockFacilityTypeIds": [
                  "oil-field"
            ],
            "description": "建立原油勘探与开采能力。"
      },
      {
            "id": "grain-processing",
            "name": "粮食加工",
            "stage": "C2",
            "rank": 2,
            "cost": 300,
            "durationMs": 180000,
            "prerequisiteTechnologyIds": [
                  "basic-crops"
            ],
            "unlockFacilityTypeIds": [
                  "mill"
            ],
            "description": "掌握粮食与糖料初级加工。"
      },
      {
            "id": "wood-processing",
            "name": "木材加工",
            "stage": "C2",
            "rank": 2,
            "cost": 400,
            "durationMs": 360000,
            "prerequisiteTechnologyIds": [
                  "forestry-development"
            ],
            "unlockFacilityTypeIds": [
                  "sawmill"
            ],
            "description": "将原木加工为标准木板。"
      },
      {
            "id": "feed-processing",
            "name": "饲料加工",
            "stage": "C2",
            "rank": 2,
            "cost": 350,
            "durationMs": 300000,
            "prerequisiteTechnologyIds": [
                  "basic-crops"
            ],
            "unlockFacilityTypeIds": [
                  "feed-factory"
            ],
            "description": "生产标准化配合饲料。"
      },
      {
            "id": "tool-operation",
            "name": "工具作业",
            "stage": "C2",
            "rank": 2,
            "cost": 300,
            "durationMs": 21600000,
            "prerequisiteTechnologyIds": ["basic-crops"],
            "unlockFacilityTypeIds": [],
            "kind": "operation",
            "operationProductIds": ["tools"],
            "description": "掌握使用工业工具的作业能力，不提供工具制造能力。"
      },
      {
            "id": "feed-husbandry",
            "name": "饲料饲养",
            "stage": "C2",
            "rank": 2,
            "cost": 200,
            "durationMs": 21600000,
            "prerequisiteTechnologyIds": ["basic-livestock"],
            "unlockFacilityTypeIds": [],
            "kind": "operation",
            "operationProductIds": ["feed"],
            "description": "掌握使用配合饲料的作业能力，不提供饲料生产能力。"
      },
      {
            "id": "pulp-technology",
            "name": "制浆技术",
            "stage": "C3",
            "rank": 3,
            "cost": 550,
            "durationMs": 900000,
            "prerequisiteTechnologyIds": [
                  "forestry-development"
            ],
            "unlockFacilityTypeIds": [
                  "pulp-mill"
            ],
            "description": "将木材转化为工业纸浆。"
      },
      {
            "id": "metallurgy",
            "name": "冶金技术",
            "stage": "C3",
            "rank": 3,
            "cost": 700,
            "durationMs": 1200000,
            "prerequisiteTechnologyIds": [
                  "mineral-exploration"
            ],
            "unlockFacilityTypeIds": [
                  "steelworks"
            ],
            "description": "冶炼钢材与铜材。"
      },
      {
            "id": "textile-technology",
            "name": "纺织技术",
            "stage": "C3",
            "rank": 3,
            "cost": 600,
            "durationMs": 1080000,
            "prerequisiteTechnologyIds": [
                  "grain-processing",
                  "basic-livestock"
            ],
            "unlockFacilityTypeIds": [
                  "textile-mill"
            ],
            "description": "建立棉纺与毛纺生产体系。"
      },
      {
            "id": "food-industry",
            "name": "食品工业",
            "stage": "C3",
            "rank": 3,
            "cost": 550,
            "durationMs": 900000,
            "prerequisiteTechnologyIds": [
                  "grain-processing"
            ],
            "unlockFacilityTypeIds": [
                  "food-factory"
            ],
            "description": "建立规模化食品与预制餐生产。"
      },
      {
            "id": "papermaking",
            "name": "造纸技术",
            "stage": "C3",
            "rank": 3,
            "cost": 700,
            "durationMs": 1200000,
            "prerequisiteTechnologyIds": [
                  "pulp-technology"
            ],
            "unlockFacilityTypeIds": [
                  "paper-mill"
            ],
            "description": "将纸浆加工为终端纸品。"
      },
      {
            "id": "fertilizer-application", "name": "化肥施用", "stage": "C3", "rank": 3, "cost": 400, "durationMs": 21600000,
            "prerequisiteTechnologyIds": ["basic-crops"], "unlockFacilityTypeIds": [], "kind": "operation", "operationProductIds": ["fertilizer"], "description": "掌握化肥施用能力。"
      },
      {
            "id": "veterinary-application", "name": "药剂精养", "stage": "C3", "rank": 3, "cost": 450, "durationMs": 21600000,
            "prerequisiteTechnologyIds": ["feed-husbandry"], "unlockFacilityTypeIds": [], "kind": "operation", "operationProductIds": ["veterinary-medicine"], "description": "掌握养殖药剂使用能力。"
      },
      {
            "id": "industrial-fuel-operation", "name": "工业动力作业", "stage": "C3", "rank": 3, "cost": 450, "durationMs": 21600000,
            "prerequisiteTechnologyIds": ["tool-operation"], "unlockFacilityTypeIds": [], "kind": "operation", "operationProductIds": ["industrial-fuel"], "description": "掌握工业动力作业能力。"
      },
      {
            "id": "industrial-chemical-operation", "name": "工业化学作业", "stage": "C3", "rank": 3, "cost": 500, "durationMs": 21600000,
            "prerequisiteTechnologyIds": ["tool-operation"], "unlockFacilityTypeIds": [], "kind": "operation", "operationProductIds": ["industrial-chemicals"], "description": "掌握化工作业能力。"
      },
      {
            "id": "oil-refining",
            "name": "石油炼化",
            "stage": "C4",
            "rank": 4,
            "cost": 950,
            "durationMs": 1800000,
            "prerequisiteTechnologyIds": [
                  "petroleum-exploration"
            ],
            "unlockFacilityTypeIds": [
                  "refinery"
            ],
            "description": "从原油生产塑料等基础化工材料。"
      },
      {
            "id": "fertilizer-engineering",
            "name": "化肥工程",
            "stage": "C4",
            "rank": 4,
            "cost": 1000,
            "durationMs": 2100000,
            "prerequisiteTechnologyIds": [
                  "oil-refining"
            ],
            "unlockFacilityTypeIds": [
                  "fertilizer-factory"
            ],
            "description": "建立工业化肥生产能力。"
      },
      {
            "id": "veterinary-medicine",
            "name": "养殖药剂",
            "stage": "C4",
            "rank": 4,
            "cost": 1250,
            "durationMs": 2700000,
            "prerequisiteTechnologyIds": [
                  "feed-processing",
                  "fertilizer-engineering"
            ],
            "unlockFacilityTypeIds": [
                  "veterinary-medicine-factory"
            ],
            "description": "生产专业养殖药剂。"
      },
      {
            "id": "beverage-industry",
            "name": "饮料工业",
            "stage": "C4",
            "rank": 4,
            "cost": 850,
            "durationMs": 1800000,
            "prerequisiteTechnologyIds": [
                  "grain-processing",
                  "basic-livestock"
            ],
            "unlockFacilityTypeIds": [
                  "beverage-factory"
            ],
            "description": "建立乳制与果汁饮料生产线。"
      },
      {
            "id": "furniture-manufacturing",
            "name": "家具制造",
            "stage": "C4",
            "rank": 4,
            "cost": 800,
            "durationMs": 1800000,
            "prerequisiteTechnologyIds": [
                  "wood-processing"
            ],
            "unlockFacilityTypeIds": [
                  "furniture-factory"
            ],
            "description": "将标准木板加工为家具。"
      },
      {
            "id": "garment-manufacturing",
            "name": "成衣制造",
            "stage": "C4",
            "rank": 4,
            "cost": 900,
            "durationMs": 2100000,
            "prerequisiteTechnologyIds": [
                  "textile-technology"
            ],
            "unlockFacilityTypeIds": [
                  "garment-factory"
            ],
            "description": "将纺织品加工为成衣。"
      },
      {
            "id": "tool-manufacturing",
            "name": "工具制造",
            "stage": "C4",
            "rank": 4,
            "cost": 1050,
            "durationMs": 2700000,
            "prerequisiteTechnologyIds": [
                  "metallurgy",
                  "wood-processing"
            ],
            "unlockFacilityTypeIds": [
                  "tool-workshop"
            ],
            "description": "生产工业工具并奠定机械工业基础。"
      },
      {
            "id": "machinery-operation", "name": "机械化作业", "stage": "C4", "rank": 4, "cost": 700, "durationMs": 21600000,
            "prerequisiteTechnologyIds": ["tool-operation"], "unlockFacilityTypeIds": [], "kind": "operation", "operationProductIds": ["machinery"], "description": "掌握机械化作业能力。"
      },
      {
            "id": "tractor-operation", "name": "拖拉机作业", "stage": "C4", "rank": 4, "cost": 800, "durationMs": 21600000,
            "prerequisiteTechnologyIds": ["machinery-operation"], "unlockFacilityTypeIds": [], "kind": "operation", "operationProductIds": ["tractor"], "description": "掌握拖拉机农业作业能力。"
      },
      {
            "id": "mechanical-engineering",
            "name": "机械工程",
            "stage": "C5",
            "rank": 5,
            "cost": 2500,
            "durationMs": 5400000,
            "prerequisiteTechnologyIds": [
                  "tool-manufacturing",
                  "metallurgy"
            ],
            "unlockFacilityTypeIds": [
                  "machine-factory"
            ],
            "description": "建立通用机械制造体系。"
      },
      {
            "id": "agricultural-machinery",
            "name": "农业机械",
            "stage": "C5",
            "rank": 5,
            "cost": 1900,
            "durationMs": 4500000,
            "prerequisiteTechnologyIds": [
                  "mechanical-engineering",
                  "fertilizer-engineering"
            ],
            "unlockFacilityTypeIds": [
                  "tractor-factory"
            ],
            "description": "将机械工程应用于拖拉机制造。"
      },
      {
            "id": "electronics-engineering",
            "name": "电子工程",
            "stage": "C6",
            "rank": 6,
            "cost": 4500,
            "durationMs": 11700000,
            "prerequisiteTechnologyIds": [
                  "mechanical-engineering",
                  "oil-refining",
                  "metallurgy"
            ],
            "unlockFacilityTypeIds": [
                  "electronics-factory"
            ],
            "description": "建立电子元件与电子产品制造体系。"
      },
      {
            "id": "appliance-engineering",
            "name": "家电工程",
            "stage": "C7",
            "rank": 7,
            "cost": 7000,
            "durationMs": 18900000,
            "prerequisiteTechnologyIds": [
                  "electronics-engineering",
                  "mechanical-engineering"
            ],
            "unlockFacilityTypeIds": [
                  "appliance-factory"
            ],
            "description": "综合机械与电子技术生产家电。"
      }
] });
    next.game.credits = 5_000;
    next.game.gems = 4;
    next.game.research = scenario === 'research-active'
      ? {
          unlockedComplexity: 'C1',
          completedTechnologyIds: ['basic-crops', 'basic-livestock', 'mineral-exploration'],
          completedAtByTechnologyId: {
            'basic-crops': fixedNow - 60_000,
            'basic-livestock': fixedNow - 60_000,
            'mineral-exploration': fixedNow - 60_000,
          },
          completedAt: fixedNow - 60_000,
          active: {
            technologyId: 'metallurgy',
            technologyName: '冶金技术',
            targetComplexity: 'C3',
            startedAt: fixedNow - 5 * 60_000,
            completesAt: fixedNow + 15 * 60_000,
            durationMs: 20 * 60_000,
            cost: 700,
            employmentReleased: 175,
            gemAccelerationMs: 30 * 60_000,
            gemAccelerationCost: 1,
          },
        }
      : scenario === 'research-accelerated'
        ? {
            unlockedComplexity: 'C4',
            completedTechnologyIds: [
              'basic-crops', 'basic-livestock', 'forestry-development', 'mineral-exploration',
              'petroleum-exploration', 'grain-processing', 'wood-processing', 'feed-processing',
              'pulp-technology', 'metallurgy', 'textile-technology', 'food-industry', 'papermaking',
              'oil-refining', 'fertilizer-engineering', 'veterinary-medicine', 'beverage-industry',
              'furniture-manufacturing', 'garment-manufacturing', 'tool-manufacturing',
            ],
            completedAtByTechnologyId: {},
            completedAt: fixedNow - 60_000,
            active: {
              technologyId: 'mechanical-engineering',
              technologyName: '机械工程',
              targetComplexity: 'C5',
              startedAt: fixedNow - 60 * 60_000,
              completesAt: fixedNow + 30 * 60_000,
              durationMs: 90 * 60_000,
              cost: 2_500,
              employmentReleased: 1_667,
              gemAccelerationMs: 30 * 60_000,
              gemAccelerationCost: 1,
            },
          }
        : {
            unlockedComplexity: 'C1',
            completedTechnologyIds: ['basic-crops', 'basic-livestock'],
            completedAtByTechnologyId: {},
            completedAt: fixedNow - 60_000,
            active: null,
          };
    Object.assign(next, {
      startResearch: async () => ({ ok: true, message: '测试研发开始' }),
      accelerateResearch: async () => ({ ok: true, message: '测试研发加速' }),
    });
    return next;
  }, [tab]);

  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '净资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: '服务器实时估值', emphasis: 'primary', onClick: () => model.setTab('bank') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(model.game.warehouseStoredQuantity), detail: '无限容量 · 实物库存总量' },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <ResearchPage model={model} />
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
    { id: 'assets', icon: <AssetsIcon />, label: '净资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: '服务器实时估值', emphasis: 'primary', onClick: () => model.setTab('bank') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(model.game.warehouseStoredQuantity), detail: '无限容量 · 实物库存总量' },
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
          kind: 'supply',
          publisherSide: 'supplier',
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
          completedDeliveries: 10,
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
          renewalProposal: {
            id: 'renewal-awaiting-buyer',
            status: 'proposed',
            revision: 1,
            proposedBy: 456,
            proposedAt: fixedNow - 10 * 60_000,
            expiresAt: fixedNow + 23 * 60 * 60_000,
            supplierApprovedAt: fixedNow - 5 * 60_000,
            buyerApproved: false,
            supplierApproved: true,
            approvedByMe: false,
            awaitingMyApproval: true,
            isProposer: false,
            terms: {
              quantityPerDelivery: 120,
              unitPrice: 48,
              deliveryIntervalMs: 3 * 60 * 60_000,
              totalDeliveries: 8,
              firstDeliveryDelayMs: 60 * 60_000,
            },
            buyerEscrowCredits: 0,
            buyerBondCredits: 0,
            supplierBondCredits: 0,
            supplierReservedQuantity: 0,
          },
          issue: '采购方货款不足，请补充本批货款。',
          isPublisher: false,
          isBuyer: true,
          isSupplier: false,
        },
        {
          id: 'contract-active-normal',
          kind: 'supply',
          supplyMode: 'daily',
          provinceId: '110000',
          dailyMaxQuantity: 60,
          dailyUsedQuantity: 20,
          dailyRemainingQuantity: 40,
          totalDeliveredQuantity: 120,
          completedDeliveryEvents: 2,
          durationDays: 30,
          startDelayDays: 0,
          publisherSide: 'supplier',
          publisherId: 654,
          publisherName: '稳定供应商',
          publisherRole: 'supplier',
          buyerId: 123,
          buyerName: 'MEVIUS',
          supplierId: 654,
          supplierName: '稳定供应商',
          productId: 'machinery',
          quantityPerDelivery: 60,
          unitPrice: 46,
          batchGross: 2_760,
          deliveryIntervalMs: 3 * 60 * 60_000,
          totalDeliveries: 10,
          completedDeliveries: 2,
          firstDeliveryDelayMs: 60 * 60_000,
          createdAt: fixedNow - 3 * 86_400_000,
          offerExpiresAt: fixedNow + 3 * 86_400_000,
          acceptedAt: fixedNow - 2 * 86_400_000,
          nextDueAt: fixedNow + 2 * 60 * 60_000,
          status: 'active',
          roundStatus: 'ready',
          buyerEscrowCredits: 2_760,
          supplierReservedQuantity: 60,
          buyerBondCredits: 552,
          supplierBondCredits: 552,
          buyerAutoFund: true,
          supplierAutoReserve: true,
          issue: null,
          isPublisher: false,
          isBuyer: true,
          isSupplier: false,
        },
        {
          id: 'contract-open',
          kind: 'supply',
          supplyMode: 'daily',
          provinceId: '110000',
          dailyMaxQuantity: 80,
          dailyUsedQuantity: 0,
          dailyRemainingQuantity: 80,
          totalDeliveredQuantity: 0,
          completedDeliveryEvents: 0,
          durationDays: 30,
          startDelayDays: 0,
          publisherSide: 'buyer',
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
          kind: 'supply',
          publisherSide: 'buyer',
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
        active: 2,
        open: 0,
        needsAttention: 1,
        upcomingWithin24Hours: 1,
      },
    });
    return next;
  }, [tab]);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>{formatCurrency(model.game.frozenCredits)}</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '净资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: '服务器实时估值', emphasis: 'primary', onClick: () => model.setTab('bank') },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(model.game.warehouseStoredQuantity), detail: '无限容量 · 实物库存总量' },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <ContractPage model={model} />
    </GameShell>
  );
}


function AuctionHarness() {
  const [tab, setTab] = useState<TabId>('auction');
  const model = useMemo(() => {
    const next = buildOverviewModel(tab, setTab);
    next.game.credits = 5_000;
    next.game.assetAuctions = [{
      id: 'auction-runtime-1',
      items: [{ assetKind: 'commodity', assetId: 'machinery', quantity: 5 }],
      itemSummaries: [{ kind: 'commodity', id: 'machinery', name: '机械', subtitle: '商品资产', quantity: 5 }],
      itemCount: 1,
      isBundle: false,
      assetKind: 'commodity',
      assetId: 'machinery',
      productId: 'machinery',
      quantity: 5,
      asset: { kind: 'commodity', id: 'machinery', name: '机械', subtitle: '商品资产' },
      sellerName: '匿名卖家',
      startingBid: 100,
      highestBid: 122,
      highestBidderLabel: '竞买人 A02',
      status: 'open',
      escrowStatus: 'held',
      settlementReason: null,
      createdAt: fixedNow - 60 * 60_000,
      originalEndsAt: fixedNow + 30 * 60_000,
      endsAt: fixedNow + 32 * 60_000,
      extensionCount: 1,
      maxExtendedEndsAt: fixedNow + 60 * 60_000,
      minimumIncrement: 2,
      minimumBid: 124,
      hasBids: true,
      bidCount: 12,
      latestBidAt: fixedNow - 30_000,
      hasHiddenReserve: true,
      reserveMet: true,
      sellerFeeBps: 100,
      buyerFeeBps: 0,
      isSeller: false,
      isHighestBidder: false,
    }];
    return next;
  }, [tab]);
  return (
    <GameShell model={model}>
      <AuctionPage model={model} />
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

function CommerceHarness({ scope = 'commercial' }: { scope?: 'commercial' | 'regional' | 'global' }) {
  const [tab, setTab] = useState<TabId>(scope === 'global' ? 'buildings' : 'province');
  const [provinceId, setProvinceId] = useState('110000');
  const [marketAssetId, setMarketAssetId] = useState('food');
  const [marketViewMode, setMarketViewMode] = useState<'catalog' | 'detail'>('catalog');
  const fixtureNow = useMemo(() => Date.now(), []);
  const base = useMemo(() => buildOverviewModel(tab, setTab), [tab]);
  const types = [
    { id: 'convenience-store', name: '便利店', profitPerCycle: 2.5, consumptionInputs: [{ productId: 'food', quantity: 1 }, { productId: 'beverage', quantity: 1 }] },
    { id: 'fresh-market', name: '生鲜超市', profitPerCycle: 3.2, consumptionInputs: [{ productId: 'fruit', quantity: 2 }] },
    { id: 'restaurant', name: '餐厅', profitPerCycle: 4.5, consumptionInputs: [{ productId: 'prepared-meal', quantity: 2 }] },
    { id: 'clothing-store', name: '服装店', profitPerCycle: 5, consumptionInputs: [{ productId: 'clothing', quantity: 1 }] },
    { id: 'furniture-showroom', name: '家具商场', profitPerCycle: 6, consumptionInputs: [{ productId: 'furniture', quantity: 1 }] },
    { id: 'appliance-store', name: '家电卖场', profitPerCycle: 8, consumptionInputs: [{ productId: 'appliance', quantity: 1 }] },
  ].map((type) => ({ ...type, name: scenario === 'commercial-long' ? `${type.name}超长名称移动端边界验证` : type.name,
    description: '', buildCost: 120, operatingCost: 1.5, cycleMs: 300_000, systemValue: 120 }));
  const [groups, setGroups] = useState<CommercialBuildingGroup[]>(() => {
    if (scenario === 'empty') return [];
    const current: CommercialBuildingGroup[] = types.map((type, index) => ({
      commercialTypeId: type.id, provinceId: '110000',
      staffingRateBps: 10000, staffingUpdatedAt: fixtureNow, staffingBatchCarryBps: 0, count: scenario === 'commercial-long' ? 1_234_567 : 3,
      participatingCount: index === 0 ? 2 : 0, enabled: index !== 1,
      status: index === 0 ? 'running' : index === 1 ? 'stopped' : 'error',
      statusReason: index > 1 ? 'insufficient_input' : undefined,
      cycleStartedAt: index === 0 ? fixtureNow - 180_000 : undefined,
      cycleCompletesAt: index === 0 ? fixtureNow + 120_000 : undefined,
      pendingEffectiveCount: index === 0 ? 2 : undefined,
      pendingStaffingRateBps: index === 0 ? 10000 : undefined,
      pendingRevenue: index === 0 ? 101.25 : undefined,
      pendingProfit: index === 0 ? 5 : undefined,
      pendingGoodsConsumed: index === 0 ? 4 : undefined,
      pendingOperatingCost: index === 0 ? 3 : undefined,
      pendingInputValue: index === 0 ? 93.25 : undefined,
      pendingInputs: index === 0 ? type.consumptionInputs.map((input) => ({ ...input, quantity: input.quantity * 2 })) : undefined,
      lifetimeRevenue: 200, lifetimeProfit: 25, lifetimeGoodsConsumed: 40,
    }));
    return [...current, { ...current[0], provinceId: '120000', count: 7 }];
  });
  Object.assign(window, {
    __setCommercialProvince: setProvinceId,
    __updateCommercialGroup: (commercialTypeId: string, patch: Partial<CommercialBuildingGroup>) => {
      setGroups((previous) => previous.map((group) => group.commercialTypeId === commercialTypeId && group.provinceId === provinceId ? { ...group, ...patch } : group));
    },
  });
  const industrialGroups = scenario === 'empty' ? [] : base.game.facilityGroups;
  const provinceFacilityGroups = { '110000': industrialGroups,
    '120000': industrialGroups.map((group) => ({ ...group, provinceId: '120000', count: 5, participatingCount: 5 })) };
  const products = [...base.game.products,
    { id: 'food', name: '食品', category: 'consumer', basePrice: 15 },
    { id: 'beverage', name: '饮料', category: 'consumer', basePrice: 18 },
    { id: 'steel', name: '钢材', category: 'industrial', basePrice: 5 },
  ];
  const markets = Object.fromEntries(products.map((product) => [product.id, {
    ...base.game.markets.machinery, productId: product.id,
    lastPrice: product.basePrice, officialPrice: product.basePrice, priceHistory: [],
  }]));
  const inventory = (available: number) => ({ available, frozen: 0, inTransit: 0 });
  const provinceInventories = {
    '110000': { machinery: inventory(580), food: inventory(1), beverage: inventory(0), steel: inventory(100) },
    '120000': { machinery: inventory(10), food: inventory(50), beverage: inventory(50), steel: inventory(20) },
  };
  const model = { ...base, selectedProvinceId: provinceId, selectedProvince: provinces.find((province) => province.id === provinceId) ?? provinces[0],
    setSelectedProvinceId: setProvinceId, marketAssetId, marketViewMode,
    showMarketCatalog: () => setMarketViewMode('catalog'),
    selectMarketAsset: (_kind: AssetKind, productId: string, navigate = true) => {
      setMarketAssetId(productId); setMarketViewMode('detail');
      Object.assign(window, { __lastSelectedAsset: productId });
      if (navigate) setTab('market');
    },
    buildFacility: async () => ({ ok: true, message: '测试建设' }),
    startFacilityGroup: async () => ({ ok: true, message: '测试开工' }),
    stopFacilityGroup: async () => ({ ok: true, message: '测试停工' }),
    setFacilityRecipes: async () => ({ ok: true, message: '测试配置' }),
    game: { ...base.game, credits: 10_000, lastProcessedAt: fixtureNow, commercialBuildingTypes: scenario === 'missing-commercial-catalog' ? [] : types,
      commercialBuildingGroups: groups, products, markets, provinceMarkets: { '110000': markets, '120000': markets },
      facilityGroups: provinceFacilityGroups[provinceId as keyof typeof provinceFacilityGroups] ?? [], provinceFacilityGroups,
      inventories: provinceInventories[provinceId as keyof typeof provinceInventories] ?? {}, provinceInventories,
    },
  } as TutorialAwareGameViewModel;
  const page = scope === 'commercial' ? <CommercePage model={model} />
    : tab === 'buildings' ? <GlobalBuildingsPage model={model} />
      : tab === 'province' ? <ProvincePage model={model} />
        : tab === 'market' ? <GlobalMarketPage model={model} /> : <MapPage model={model} />;
  if (scenario === 'no-navigation') {
    return <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>{page}</FacilityRecipeProfitMarketsProvider>;
  }
  return <GameShell model={model}><FacilityRecipeProfitMarketsProvider markets={model.game.markets}>{page}</FacilityRecipeProfitMarketsProvider></GameShell>;
}

const runtimeView = view === 'unified-buildings' ? <CommerceHarness scope="global" />
  : view === 'regional-buildings' ? <CommerceHarness scope="regional" /> : view === 'commerce' ? <CommerceHarness /> : view === 'overview'
    ? <OverviewHarness />
    : view === 'map'
      ? <MapHarness />
    : view === 'production'
      ? <ProductionHarness />
      : view === 'research'
      ? <ResearchHarness />
    : view === 'contracts'
      ? <ContractHarness />
      : view === 'auction'
        ? <AuctionHarness />
      : view === 'gem-shop'
        ? <GemShopHarness />
      : view === 'leaderboard'
        ? <LeaderboardHarness />
        : view === 'scroll-ownership'
          ? <ScrollOwnershipHarness />
          : <SettingsHarness />;

createRoot(document.getElementById('root') as HTMLElement).render(
  <ApplicationLayerRoot>{runtimeView}</ApplicationLayerRoot>,
);
