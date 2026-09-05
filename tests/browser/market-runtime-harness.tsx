import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CURRENT_CLIENT_STATE_VERSION } from '../../server/shared/economy-state-version.js';
import '../../src/app/interactionBootstrap';
import type { LoadedGameViewModel, MarketViewMode } from '../../src/app/gameViewModel';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../../src/components/icons/GameIcons';
import { GemIcon } from '../../src/components/icons/GemIcon';
import { GameShell } from '../../src/components/shell/GameShell';
import { ApplicationLayerRoot } from '../../src/components/visual/ApplicationLayerRoot';
import type { StatusBarItem } from '../../src/components/shell/StatusBar';
import { CurrencyAmount } from '../../src/components/ui/CurrencyAmount';
import { MarketPage } from '../../src/pages/MarketPage';
import type { TabId } from '../../src/config/navigation';
import type { MarketDetail } from '../../src/types';
import { formatCurrency, formatNumber, formatRank } from '../../src/utils/formatters';
import '../../src/styles/globals.css';
import '../../src/styles/charts.css';
import '../../src/styles/desktop-sidebar.css';
import '../../src/styles/viewport.css';
import '../../src/styles/scrollbars.css';
import '../../src/styles/card-system.css';
import '../../src/styles/frosted-glass-chrome.css';
import '../../src/styles/mobile-status-navigation.css';
import '../../src/styles/mobile-status-layout.css';
import '../../src/styles/icon-system.css';
import '../../src/styles/mobile-detail-sheet.css';
import '../../src/styles/market-funds.css';
import '../../src/styles/market-account-table.css';
import '../../src/styles/warehouse-expansion.css';
import '../../src/styles/unified-market-admin.css';
import '../../src/styles/virtual-list.css';
import '../../src/styles/market-page-polish.css';
import '../../src/styles/product-artwork.css';
import '../../src/styles/facility-artwork.css';
import '../../src/styles/design-system.css';
import '../../src/styles/interaction-states.css';
import '../../src/styles/primary-surfaces.css';
import '../../src/styles/form-controls.css';
import '../../src/styles/financial-backdrop.css';
import '../../src/styles/province-map.css';
import '../../src/styles/strategic-game-shell.css';
import '../../src/styles/market-detail-direct-flow.css';

const params = new URLSearchParams(window.location.search);
const scenario = params.get('scenario') ?? 'active';
const fixedNow = new Date(2026, 6, 18, 0, 30, 0).getTime();
document.documentElement.dataset.appSurface = 'game';

function marketDetailFixture(url: URL): MarketDetail | null {
  if (url.pathname !== '/economy-api/game/market-detail') return null;
  const provinceId = url.searchParams.get('provinceId') || '110000';
  const assetKind = url.searchParams.get('assetKind') === 'facility' ? 'facility' : 'commodity';
  const assetId = url.searchParams.get('assetId') || 'wheat';
  const zeroTrend = scenario === 'zero-trend';
  const priceHistory = assetId === 'wheat'
    ? [
        ...Array.from({ length: 5 }, (_, index) => ({
          price: zeroTrend ? 12 : 10,
          quantity: 1,
          createdAt: fixedNow - (30 + index) * 60 * 60_000,
          takerSide: index % 2 === 0 ? 'buy' as const : 'sell' as const,
        })),
        { price: zeroTrend ? 12 : 10, quantity: 2, createdAt: fixedNow - 3 * 60 * 60_000, takerSide: 'buy' as const },
        { price: zeroTrend ? 12 : 11, quantity: 3, createdAt: fixedNow - 2 * 60 * 60_000, takerSide: 'sell' as const },
        { price: 12, quantity: 4, createdAt: fixedNow - 30 * 60_000, takerSide: 'buy' as const },
      ]
    : [];
  const market = assetKind === 'commodity'
    ? {
        productId: assetId,
        provinceId,
        lastPrice: assetId === 'wheat' ? 12 : 10,
        lastTradePrice: assetId === 'wheat' ? 2 : null,
        officialPrice: assetId === 'wheat' ? 11 : 10,
        priceDateKey: '2026-07-18',
        nextPriceAt: fixedNow + (23 * 60 + 30) * 60_000,
        todayBuyQuantity: assetId === 'wheat' ? 5 : 0,
        todaySellQuantity: assetId === 'wheat' ? 4 : 0,
        previousDayBuyQuantity: assetId === 'wheat' ? 3 : 0,
        previousDaySellQuantity: assetId === 'wheat' ? 2 : 0,
        lastImbalance: 0,
        lastPriceChangeBps: 0,
        priceHistory,
        priceChange24h: zeroTrend ? 0 : 2,
        tradeVolume24h: assetId === 'wheat' ? 9 : 0,
        tradeCount24h: assetId === 'wheat' ? 3 : 0,
        previousTradePrice: assetId === 'wheat' ? 11 : null,
        buyVolume: assetId === 'wheat' ? 5 : 0,
        sellVolume: assetId === 'wheat' ? 4 : 0,
        buyOrderCount: assetId === 'wheat' ? 5 : 0,
        sellOrderCount: assetId === 'wheat' ? 2 : 0,
        bestBid: assetId === 'wheat' ? 2 : null,
        bestAsk: assetId === 'wheat' ? 13 : null,
        demand: {
          cycleMs: 300_000,
          nextDemandAt: fixedNow + 60_000,
          lastBudget: 0,
          lastQuantity: 0,
          lastPrice: assetId === 'wheat' ? 12 : 10,
          satisfaction: 1,
          referencePrice: assetId === 'wheat' ? 12 : 10,
          observedPrice: assetId === 'wheat' ? 12 : 10,
          costAnchor: null,
          downstreamValueAnchor: null,
          targetPrice: assetId === 'wheat' ? 12 : 10,
        },
      }
    : {
        facilityTypeId: assetId,
        provinceId,
        lastPrice: 500,
        lastTradePrice: null,
        priceHistory,
        priceChange24h: null,
        tradeVolume24h: 0,
        tradeCount24h: 0,
        previousTradePrice: null,
        buyVolume: 0,
        sellVolume: 0,
        buyOrderCount: 0,
        sellOrderCount: 0,
        bestBid: null,
        bestAsk: null,
      };
  return {
    provinceId,
    assetKind,
    assetId,
    revision: `market-runtime:${provinceId}:${assetKind}:${assetId}`,
    market,
    orderBook: {
      asks: assetId === 'wheat'
        ? [{ side: 'sell', price: 13, remaining: 4, orderCount: 2 }]
        : [],
      bids: assetId === 'wheat'
        ? [{ side: 'buy', price: 2, remaining: 5, orderCount: 5 }]
        : [],
    },
  };
}

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const requestUrl = new URL(
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    window.location.href,
  );
  const marketDetail = marketDetailFixture(requestUrl);
  if (!marketDetail) return nativeFetch(input, init);
  return new Response(JSON.stringify({
    revision: 1,
    serverNow: fixedNow,
    marketDetailRevision: marketDetail.revision,
    unchanged: false,
    marketDetail,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const productNames = [
  '小麦', '水稻', '棉花', '木材', '铁矿石', '铜矿石', '原油', '肉', '蛋', '奶', '毛',
  '面粉', '纺织品', '木板', '钢材', '铜材', '塑料', '食品', '服装', '家具', '机械', '电子产品',
];
const facilityNames = [
  '农场', '伐木场', '矿场', '油井', '畜牧场', '面粉厂', '纺织厂', '木板厂',
  '冶炼厂', '塑料厂', '食品厂', '服装厂', '家具厂', '机械工厂', '电子厂',
];

function MarketHarness() {
  const [freezeExtra, setFreezeExtra] = useState(0);
  useEffect(() => {
    window.__updateFreezeFixture = () => setFreezeExtra((value) => value + 5);
    return () => { delete window.__updateFreezeFixture; };
  }, []);
  const [tab, setTab] = useState<TabId>('market');
  const [marketAssetKind, setMarketAssetKind] = useState<'commodity' | 'facility'>('commodity');
  const [marketAssetId, setMarketAssetId] = useState('wheat');
  const [marketViewMode, setMarketViewMode] = useState<MarketViewMode>(params.get('view') === 'catalog' ? 'catalog' : 'detail');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>(scenario === 'sell-empty' ? 'sell' : 'buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(2);

  const model = useMemo(() => {
    const products = productNames.map((name, index) => ({
      id: index === 0 ? 'wheat' : `product-${index + 1}`,
      name,
      category: (['raw', 'intermediate', 'consumer', 'industrial'] as const)[index % 4],
      basePrice: index === 0 ? 12 : index + 2,
    }));
    const facilityTypes = facilityNames.map((name, index) => ({
      id: index === facilityNames.length - 2 ? 'machine-factory' : `facility-${index + 1}`,
      name,
      category: (['raw', 'processing', 'consumer', 'industrial'] as const)[index % 4],
      complexity: 'C1',
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
    const inventoryAvailable = scenario === 'sell-empty' ? 0 : 8;
    const credits = scenario === 'funds-empty' ? 0 : 1000;
    const orders = [];
    const inventories = Object.fromEntries(products.map((product) => [
      product.id,
      { available: product.id === 'wheat' ? inventoryAvailable : 0, frozen: product.id === 'wheat' && scenario.startsWith('freeze') ? 320 + freezeExtra : 0 },
    ]));
    const facilityGroups = facilityTypes.map((facility) => ({
      facilityTypeId: facility.id,
      count: facility.id === 'machine-factory' ? 18 : 0,
      participatingCount: 0,
      productionAvailableCount: facility.id === 'machine-factory' ? 18 : 0,
      projectedEffectiveCount: 0,
      listedCount: 0,
      availableCount: facility.id === 'machine-factory' ? 18 : 0,
      staffingRateBps: 10_000,
      staffingUpdatedAt: fixedNow,
      staffingBatchCarryBps: 0,
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
        lastTradePrice: product.id === 'wheat' ? 2 : null,
        officialPrice: product.id === 'wheat' ? 11 : product.basePrice,
        priceDateKey: '2026-07-18',
        nextPriceAt: fixedNow + (23 * 60 + 30) * 60_000,
        todayBuyQuantity: product.id === 'wheat' ? 5 : 0,
        todaySellQuantity: product.id === 'wheat' ? 4 : 0,
        previousDayBuyQuantity: product.id === 'wheat' ? 3 : 0,
        previousDaySellQuantity: product.id === 'wheat' ? 2 : 0,
        lastImbalance: 0,
        lastPriceChangeBps: 0,
        priceChange24h: product.id === 'wheat' ? (isZeroTrend ? 0 : 2) : null,
        tradeVolume24h: product.id === 'wheat' ? 9 : 0,
        tradeCount24h: product.id === 'wheat' ? 3 : 0,
        previousTradePrice: product.id === 'wheat' ? 11 : null,
        buyVolume: product.id === 'wheat' ? 5 : 0,
        sellVolume: product.id === 'wheat' ? 4 : 0,
        buyOrderCount: product.id === 'wheat' ? 5 : 0,
        sellOrderCount: product.id === 'wheat' ? 2 : 0,
        bestBid: product.id === 'wheat' ? 2 : null,
        bestAsk: product.id === 'wheat' ? 13 : null,
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
      version: CURRENT_CLIENT_STATE_VERSION,
      lastProcessedAt: fixedNow,
      userId: 123,
      playerName: 'MEVIUS',
      registeredAt: fixedNow - 60 * 86_400_000,
      credits,
      frozenCredits: 0,
      gems: 0,
      inventories,
      inventoryFreezeDetails: scenario === 'freeze-long' ? { wheat: Array.from({ length: 80 }, (_, index) => ({
        kind: 'contract', sourceId: `long-${index}`, label: `供货合同 ${index} · 跨地区长期原材料采购与供应来源明细`, quantity: index === 0 ? 4 + freezeExtra : 4,
      })) } : scenario === 'freeze-details' ? { wheat: [
        { kind: 'production', sourceId: '110000:mill', label: '磨坊', quantity: 120 + freezeExtra },
        { kind: 'production', sourceId: '110000:feed-factory', label: '饲料厂', quantity: 80 },
        { kind: 'commercial', sourceId: '110000:fresh-market', label: '生鲜市场', quantity: 30 },
        { kind: 'contract', sourceId: 'supply-123', label: '供货合同 supply-123', quantity: 70 },
        { kind: 'auction', sourceId: 'auction-456', label: '拍卖 auction-456', quantity: 20 },
      ] } : undefined,
      warehouseStoredQuantity: inventoryAvailable,
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
        populationIssued: 0,
        systemSinks: 0,
        commodityVolume: 0,
        facilityVolume: 0,
        producedGoods: 0,
        boughtGoods: 0,
        soldGoods: 0,
        giftIssued: 0,
        invitationGemsIssued: 0,
      },
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
      inventoryUsed: game.warehouseStoredQuantity,
    };

    return {
      user: { id: 123, email: 'runtime@example.com', role: 'user' },
      game,
      derived,
      localTrades: Array.from({ length: 80 }, (_, index) => {
        const side = index % 2 === 0 ? 'buy' as const : 'sell' as const;
        const quantity = (index % 5) + 1;
        const price = 2 + (index % 4);
        const total = quantity * price;
        const fee = side === 'sell' ? 1 : 0;
        return {
          id: 'trade-' + (index + 1),
          type: 'commodity' as const,
          productId: 'wheat',
          side,
          description: (side === 'buy' ? '买入 ' : '卖出 ') + '小麦',
          quantity,
          price,
          total,
          fee,
          netTotal: total - fee,
          createdAt: fixedNow - index * 60_000,
        };
      }),
      tab,
      setTab,
      notice: '',
      selectedProvinceId: '110000',
      selectedProvince: { id: '110000', name: '加利福尼亚州' },
      setSelectedProvinceId: () => {},
      selectedFacilityTypeId: 'machine-factory',
      setSelectedFacilityTypeId: () => {},
      marketAssetKind,
      marketAssetId,
      marketViewMode,
      showMarketCatalog: () => setMarketViewMode('catalog'),
      selectMarketAsset: (kind: 'commodity' | 'facility', assetId: string) => {
        setMarketAssetKind(kind);
        setMarketAssetId(assetId);
        setMarketViewMode('detail');
      },
      orderSide,
      selectOrderSide: setOrderSide,
      orderQuantity,
      setOrderQuantity,
      orderPrice,
      setOrderPrice,
      playerName: 'MEVIUS',
      setPlayerName: () => {},
      refreshRate: '5',
      setRefreshRate: () => {},
      inventoryUsed: game.warehouseStoredQuantity,
      cashShare: 0,
      commodityShare: 100,
      facilityShare: 0,
      avatarText: 'M',
      showResult: async () => {},
      notify: () => {},
      refresh: async () => {},
      clearLocalTrades: () => {},
      signOut: async () => {},
      placeAssetOrder: async () => ({ ok: true, message: '测试订单已提交' }),
      cancelOrder: async () => ({ ok: true, message: '测试订单已撤销' }),
    } as unknown as LoadedGameViewModel;
  }, [
    freezeExtra,
    marketAssetId,
    marketAssetKind,
    marketViewMode,
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
    { id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(model.game.warehouseStoredQuantity), detail: '无限容量 · 实物库存总量' },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <MarketPage model={model} />
    </GameShell>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <ApplicationLayerRoot><MarketHarness /></ApplicationLayerRoot>,
);

declare global {
  interface Window { __updateFreezeFixture?: () => void; }
}
