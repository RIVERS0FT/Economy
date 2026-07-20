import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../../src/components/icons/GameIcons';
import { GemIcon } from '../../src/components/icons/GemIcon';
import { GameShell } from '../../src/components/shell/GameShell';
import type { StatusBarItem } from '../../src/components/shell/StatusBar';
import { CurrencyAmount } from '../../src/components/ui/CurrencyAmount';
import { MarketPage } from '../../src/pages/MarketPage';
import type { TabId } from '../../src/config/navigation';
import { formatCurrency, formatNumber, formatRank } from '../../src/utils/formatters';
import '../../src/styles/globals.css';
import '../../src/styles/desktop-sidebar.css';
import '../../src/styles/viewport.css';
import '../../src/styles/card-system.css';
import '../../src/styles/liquid-glass-chrome.css';
import '../../src/styles/mobile-status-navigation.css';
import '../../src/styles/mobile-status-layout.css';
import '../../src/styles/icon-system.css';
import '../../src/styles/market-funds.css';
import '../../src/styles/unified-market-admin.css';
import '../../src/styles/virtual-list.css';
import '../../src/styles/design-system.css';
import '../../src/styles/market-page-polish.css';

const params = new URLSearchParams(window.location.search);
const scenario = params.get('scenario') ?? 'active';
const fixedNow = new Date(2026, 6, 18, 0, 30, 0).getTime();
document.documentElement.dataset.appSurface = 'game';

const productNames = [
  '小麦', '水稻', '棉花', '木材', '铁矿石', '铜矿石', '原油', '肉', '蛋', '奶', '毛',
  '面粉', '纺织品', '木板', '钢材', '铜材', '塑料', '食品', '服装', '家具', '机械', '电子产品',
];
const facilityNames = [
  '农场', '伐木场', '矿场', '油井', '畜牧场', '面粉厂', '纺织厂', '木板厂',
  '冶炼厂', '塑料厂', '食品厂', '服装厂', '家具厂', '机械工厂', '电子工厂',
];

function MarketHarness() {
  const [tab, setTab] = useState<TabId>('market');
  const [marketAssetKind, setMarketAssetKind] = useState<'commodity' | 'facility'>('commodity');
  const [marketAssetId, setMarketAssetId] = useState('wheat');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>(scenario === 'sell-empty' ? 'sell' : 'buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(2);

  const model = useMemo(() => {
    const products = productNames.map((name, index) => ({
      id: index === 0 ? 'wheat' : `product-${index + 1}`,
      name,
      category: 'runtime',
      basePrice: index === 0 ? 12 : index + 2,
    }));
    const facilityTypes = facilityNames.map((name, index) => ({
      id: index === facilityNames.length - 2 ? 'machinery-plant' : `facility-${index + 1}`,
      name,
      category: 'runtime',
      buildCost: 500 + index,
      buildTimeMs: 60_000,
      cycleMs: 120_000,
      operatingCost: 8,
      inputs: [],
      output: { productId: 'wheat', quantity: 1 },
      defaultRecipeId: `recipe-${index + 1}`,
      recipes: [{
        id: `recipe-${index + 1}`,
        name: `${name}配方`,
        cycleMs: 120_000,
        operatingCost: 8,
        inputs: [],
        output: { productId: 'wheat', quantity: 1 },
      }],
      systemValue: 500 + index,
    }));
    const isZeroTrend = scenario === 'zero-trend';
    const oldPrices = Array.from({ length: 5 }, (_, index) => ({
      price: isZeroTrend ? 12 : 10,
      quantity: 1,
      createdAt: fixedNow - (30 + index) * 60 * 60_000,
      takerSide: index % 2 === 0 ? 'buy' : 'sell',
    }));
    const currentPrices = [
      { price: isZeroTrend ? 12 : 10, quantity: 2, createdAt: fixedNow - 3 * 60 * 60_000, takerSide: 'buy' },
      { price: isZeroTrend ? 12 : 11, quantity: 3, createdAt: fixedNow - 2 * 60 * 60_000, takerSide: 'sell' },
      { price: 12, quantity: 4, createdAt: fixedNow - 30 * 60_000, takerSide: 'buy' },
    ];
    const inventoryAvailable = scenario === 'sell-empty' ? 0 : 8;
    const warehouseAvailableCapacity = scenario === 'warehouse-full' ? 0 : 1311;
    const credits = scenario === 'funds-empty' ? 0 : 1000;
    const orders = [
      {
        id: 'ask-1',
        assetKind: 'commodity',
        assetId: 'wheat',
        productId: 'wheat',
        side: 'sell',
        ownerType: 'population',
        ownerName: '人口',
        isOwn: false,
        price: 13,
        quantity: 8,
        remaining: 1,
        status: 'open',
        createdAt: fixedNow - 15 * 60_000,
      },
      {
        id: 'ask-2',
        assetKind: 'commodity',
        assetId: 'wheat',
        productId: 'wheat',
        side: 'sell',
        ownerType: 'player',
        ownerName: '匿名玩家',
        isOwn: false,
        price: 13,
        quantity: 9,
        remaining: 3,
        status: 'partial',
        createdAt: fixedNow - 14 * 60_000,
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `bid-${index + 1}`,
        assetKind: 'commodity',
        assetId: 'wheat',
        productId: 'wheat',
        side: 'buy',
        ownerType: index % 2 === 0 ? 'population' : 'player',
        ownerName: index % 2 === 0 ? '人口' : '匿名玩家',
        isOwn: false,
        price: 2,
        quantity: 10 + index,
        remaining: 1,
        status: index === 1 ? 'partial' : 'open',
        createdAt: fixedNow - (10 - index) * 60_000,
      })),
    ];
    const inventories = Object.fromEntries(products.map((product) => [
      product.id,
      { available: product.id === 'wheat' ? inventoryAvailable : 0, frozen: 0 },
    ]));
    const facilityGroups = facilityTypes.map((facility) => ({
      facilityTypeId: facility.id,
      count: facility.id === 'machinery-plant' ? 18 : 0,
      participatingCount: 0,
      pendingJoinCount: 0,
      listedCount: 0,
      availableCount: facility.id === 'machinery-plant' ? 18 : 0,
      nextCycleCount: 0,
      enabled: false,
      status: 'stopped',
      cycleStartedAt: null,
      lifetimeOutput: 0,
      activeRecipeId: facility.defaultRecipeId,
    }));
    const markets = Object.fromEntries(products.map((product) => [
      product.id,
      {
        productId: product.id,
        lastPrice: product.id === 'wheat' ? 12 : product.basePrice,
        priceHistory: product.id === 'wheat' ? [...oldPrices, ...currentPrices] : [],
        demand: {
          cycleMs: 300_000,
          nextDemandAt: fixedNow + 60_000,
          lastBudget: 0,
          lastQuantity: 0,
          lastPrice: product.basePrice,
          satisfaction: 1,
          referencePrice: product.basePrice,
          observedPrice: product.basePrice,
          costAnchor: null,
          downstreamValueAnchor: null,
          targetPrice: product.basePrice,
        },
      },
    ]));
    const game = {
      version: 15,
      userId: 123,
      playerName: 'MEVIUS',
      registeredAt: fixedNow - 60 * 86_400_000,
      credits,
      frozenCredits: 0,
      gems: 0,
      inventories,
      inventoryCapacity: 6650,
      warehouseLevel: 12,
      warehouseUpgradeCost: 2400,
      warehouseNextCapacity: 7000,
      warehouseNextCapacityIncrease: 350,
      warehouseStoredQuantity: 6650 - warehouseAvailableCapacity,
      warehouseReservedQuantity: 0,
      warehouseUsedCapacity: 6650 - warehouseAvailableCapacity,
      warehouseAvailableCapacity,
      facilityGroups,
      products,
      facilityTypes,
      markets,
      facilityMarkets: {},
      orders,
      valuationPrices: { 'commodity:wheat': 2 },
      leaderboard: [{
        rank: 1,
        playerName: 'MEVIUS',
        totalAssets: 97_354,
        cashAssets: credits,
        facilityCount: 18,
        weeklyChange: -116_545,
        updatedAt: fixedNow,
        isCurrentPlayer: true,
      }],
      assetSummary: {
        cashValue: credits,
        commodityValue: 97_354 - credits,
        facilityValue: 0,
        totalAssets: 97_354,
      },
      stats: {
        workIssued: 0,
        populationIssued: 0,
        systemSinks: 0,
        commodityVolume: 0,
        facilityVolume: 0,
        workClicks: 0,
        producedGoods: 0,
        boughtGoods: 0,
        soldGoods: 0,
        giftIssued: 0,
        invitationGemsIssued: 0,
      },
      work: { cooldownUntil: 0, lastWorkedAt: fixedNow - 20_000, streak: 0, totalClicks: 0 },
    };
    const derived = {
      ownOpenOrders: [],
      facilityValue: 0,
      commodityValue: 97_354 - credits,
      cashValue: credits,
      totalAssets: 97_354,
      currentRank: game.leaderboard[0],
      previousRank: null,
      runningFacilities: 0,
      constructingFacilities: 0,
      stoppedFacilities: 18,
      blockedFacilities: 0,
      inventoryUsed: game.warehouseUsedCapacity,
    };

    return {
      user: { id: 123, email: 'runtime@example.com', role: 'user' },
      game,
      derived,
      localAssetEvents: [],
      localTrades: [],
      tab,
      setTab,
      notice: '',
      selectedFacilityTypeId: 'machinery-plant',
      setSelectedFacilityTypeId: () => {},
      marketAssetKind,
      marketAssetId,
      selectMarketAsset: (kind: 'commodity' | 'facility', assetId: string) => {
        setMarketAssetKind(kind);
        setMarketAssetId(assetId);
      },
      orderSide,
      selectOrderSide: setOrderSide,
      orderQuantity,
      setOrderQuantity,
      orderPrice,
      setOrderPrice,
      playerName: 'MEVIUS',
      setPlayerName: () => {},
      compactNumbers: false,
      setCompactNumbers: () => {},
      refreshRate: '5',
      setRefreshRate: () => {},
      isWorking: false,
      inventoryUsed: game.warehouseUsedCapacity,
      cashShare: 0,
      commodityShare: 100,
      facilityShare: 0,
      allocationStyle: {},
      avatarText: 'M',
      showResult: async () => {},
      notify: () => {},
      refresh: async () => {},
      clearLocalActivity: () => {},
      signOut: async () => {},
      work: async () => ({ ok: true, message: '工作完成' }),
      placeAssetOrder: async () => ({ ok: true, message: '测试订单已提交' }),
      cancelOrder: async () => ({ ok: true, message: '测试订单已撤销' }),
    } as unknown as LoadedGameViewModel;
  }, [
    marketAssetId,
    marketAssetKind,
    orderPrice,
    orderQuantity,
    orderSide,
    scenario,
    tab,
  ]);

  const weeklyMagnitude = Math.abs(model.derived.currentRank?.weeklyChange ?? 0);
  const statusItems: StatusBarItem[] = [
    { id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>, detail: <>冻结 <CurrencyAmount>0</CurrencyAmount></> },
    { id: 'assets', icon: <AssetsIcon />, label: '总资产', value: <CurrencyAmount>{formatCurrency(model.derived.totalAssets)}</CurrencyAmount>, detail: <span className="negative">↓ 本周 <CurrencyAmount>{formatCurrency(weeklyMagnitude)}</CurrencyAmount></span>, emphasis: 'primary' },
    { id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(model.game.gems), detail: '邀请好友可获得宝石' },
    { id: 'rank', icon: <RankIcon />, label: '排行榜', value: formatRank(model.derived.currentRank?.rank), detail: '当前位于榜首' },
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库剩余', value: formatNumber(model.game.warehouseAvailableCapacity), detail: `已用 ${formatNumber(model.game.warehouseUsedCapacity)}/${formatNumber(model.game.inventoryCapacity)}` },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <MarketPage model={model} />
    </GameShell>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<MarketHarness />);
