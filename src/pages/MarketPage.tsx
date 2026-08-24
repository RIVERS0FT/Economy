import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { getClientOrderIndex, openOrdersForAsset } from '../app/clientOrderIndex';
import { orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import { MarketAutoTradePanel } from '../components/market/MarketAutoTradePanel';
import { MarketBalanceBar } from '../components/market/MarketBalanceBar';
import { MarketCommodityRow } from '../components/market/MarketCommodityRow';
import { FacilityIcon } from '../components/icons/FacilityIcons';
import { FactoryIcon } from '../components/icons/GameIcons';
import { ProductIcon, ProductIconLabel } from '../components/icons/ProductIcons';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import { IntegerInput, MoneyInput, SelectInput } from '../components/ui/FormControls';
import {
  Button,
  MetricCard,
  PageLayout,
  Panel,
  ScrollableTable,
  StatusTag,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import { VirtualRecordTable } from '../components/ui/VirtualRecordTable';
import { economyConstants, openOrderLimitForCatalog } from '../config/economy';
import { AUTO_SELL_PANEL_EVENT, consumeAutoSellPanelRequest } from '../auto-sell/autoSellStorage';
import type { AssetKind, AssetOrder, OrderSide, ProductCategory } from '../types';
import { formatCurrency, formatNumber, formatTime } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import { parseMoneyDraft } from '../utils/moneyDraft';
import { buildMarketHistoryBuckets } from '../utils/marketHistory';
import { buildOrderBookLevels } from '../utils/orderBookLevels';
import { orderAssetId, orderKind } from '../utils/orderIdentity';

function localTradeKey(trade: { id: string }) { return trade.id; }

function orderTone(status: AssetOrder['status']): StatusTone {
  if (status === 'filled') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

function localTradeAssetName(trade: { description: string; side: 'buy' | 'sell' }) {
  const historicalPrefix = trade.side === 'buy' ? '买入' : '卖出';
  return trade.description.replace(new RegExp(`^${historicalPrefix}\\s+`), '').trim() || '资产';
}

type MarketCatalogStatus = 'all' | 'traded' | 'buy' | 'sell' | 'unmet-demand' | 'own-order';
type MarketCatalogSort = 'catalog' | 'name' | 'price' | 'trend' | 'buy-volume' | 'sell-volume';

const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  raw: '原材料',
  intermediate: '中间品',
  consumer: '消费品',
  industrial: '工业品',
};

const FACILITY_CATEGORY_LABELS = {
  raw: '原料产业',
  processing: '加工产业',
  consumer: '消费产业',
  industrial: '工业产业',
} as const;

interface MarketCatalogEntry {
  kind: 'commodity';
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  lastTradePrice?: number;
  marketPrice?: number;
  trend?: number;
  bestBid?: number;
  bestAsk?: number;
  ownOrderCount: number;
  buyVolume: number;
  sellVolume: number;
  demandSatisfaction: number | null;
}

function trendForMarket(
  history: Parameters<typeof buildMarketHistoryBuckets>[0],
  now: number,
) {
  const windowStart = now - (24 * 60 * 60 * 1_000);
  const realTrades = history
    .filter((point) => point.createdAt >= windowStart && point.createdAt <= now)
    .sort((left, right) => left.createdAt - right.createdAt);
  return realTrades.length > 1
    ? realTrades[realTrades.length - 1].price - realTrades[0].price
    : undefined;
}

interface MarketOrderEntryHandle {
  fillPrice: (price: number) => void;
}

interface MarketOrderEntryProps {
  assetKind: AssetKind;
  assetId: string;
  assetName: string;
  orderSide: OrderSide;
  selectOrderSide: (side: OrderSide) => void;
  orderPrice: number;
  orderQuantity: number;
  credits: number;
  availableQuantity: number;
  ownOpenOrderCount: number;
  maxOpenOrders: number;
  placeAssetOrder: LoadedGameViewModel['placeAssetOrder'];
  showResult: LoadedGameViewModel['showResult'];
}

const MarketOrderEntry = memo(forwardRef<MarketOrderEntryHandle, MarketOrderEntryProps>(function MarketOrderEntry({
  assetKind,
  assetId,
  assetName,
  orderSide,
  selectOrderSide,
  orderPrice,
  orderQuantity,
  credits,
  availableQuantity,
  ownOpenOrderCount,
  maxOpenOrders,
  placeAssetOrder,
  showResult,
}, ref) {
  const [priceDraft, setPriceDraft] = useState(String(orderPrice));
  const [quantityDraft, setQuantityDraft] = useState(String(orderQuantity));

  const parsedOrderPrice = parseMoneyDraft(priceDraft, { min: 0.01, max: economyConstants.maxOrderPrice });
  const effectiveOrderPrice = parsedOrderPrice ?? 0;
  const maxBuyByFunds = effectiveOrderPrice > 0
    ? Math.max(0, Math.floor(credits / effectiveOrderPrice))
    : 0;
  const maxSellQuantity = availableQuantity;
  const maxTradeQuantity = Math.min(
    orderSide === 'buy' ? maxBuyByFunds : maxSellQuantity,
    economyConstants.maxOrderQuantity,
  );
  const parsedOrderQuantity = parseIntegerDraft(quantityDraft, { min: 1 });
  const orderTotal = Math.max(0, (parsedOrderQuantity ?? 0) * effectiveOrderPrice);
  const estimatedSellFee = orderSide === 'sell' && orderTotal > 0
    ? Math.floor(orderTotal * 10_000) / 1_000_000
    : 0;
  const estimatedNetTotal = Math.max(0, orderTotal - estimatedSellFee);
  const priceStepBase = parsedOrderPrice ?? orderPrice;
  const quantityStepBase = parsedOrderQuantity ?? orderQuantity;
  const canDecreasePrice = priceStepBase > 0.01;
  const canIncreasePrice = priceStepBase < economyConstants.maxOrderPrice;
  const canDecreaseQuantity = maxTradeQuantity >= 1 && quantityStepBase > 1;
  const canIncreaseQuantity = maxTradeQuantity >= 1 && quantityStepBase < maxTradeQuantity;

  const priceReason = parsedOrderPrice === null
    ? '请输入不低于 0.01 的金额；超过两位小数会自动向下截断。'
    : undefined;
  const availabilityReason = parsedOrderPrice === null
    ? undefined
    : orderSide === 'buy'
      ? credits < parsedOrderPrice
        ? `可用资金不足，当前价格至少需要 ${formatCurrency(parsedOrderPrice)}。`
        : undefined
      : availableQuantity < 1
        ? '暂无可售库存。'
        : undefined;
  const quantityReason = priceReason === undefined && availabilityReason === undefined
    ? parsedOrderQuantity === null
      ? '数量必须是不低于 1 的整数。'
      : parsedOrderQuantity > maxTradeQuantity
        ? orderSide === 'buy'
          ? `当前价格下最多可买 ${formatNumber(maxTradeQuantity)}。`
          : '数量超过可售范围。'
        : undefined
    : undefined;
  const orderLimitReason = ownOpenOrderCount >= maxOpenOrders
    ? `未完成订单数量已达上限（${formatNumber(maxOpenOrders)} 笔）。`
    : undefined;
  const orderDisabledReason = orderLimitReason ?? priceReason ?? availabilityReason ?? quantityReason;
  const orderActionLabel = orderDisabledReason
    ? orderLimitReason
      ? '订单已达上限'
      : priceReason
        ? `价格无效，无法${orderSide === 'buy' ? '买入' : '卖出'}${assetName}`
        : availabilityReason
          ? orderSide === 'buy'
            ? `资金不足，无法买入${assetName}`
            : `暂无${assetName}可卖`
          : `数量超出范围，无法${orderSide === 'buy' ? '买入' : '卖出'}${assetName}`
    : orderSide === 'buy'
      ? `买入${assetName}`
      : `卖出${assetName}`;

  function updatePriceDraft(value: string) {
    const parsed = parseMoneyDraft(value, { min: 0.01, max: economyConstants.maxOrderPrice });
    setPriceDraft(parsed !== null && parsed !== parsedOrderPrice ? String(parsed) : value);
  }

  function updateQuantityDraft(value: string) {
    setQuantityDraft(value);
  }

  const setPriceValue = useCallback((value: number) => {
    const normalized = Math.min(
      economyConstants.maxOrderPrice,
      Math.max(0.01, Math.round(value * 100) / 100),
    );
    setPriceDraft(String(normalized));
  }, []);

  useImperativeHandle(ref, () => ({ fillPrice: setPriceValue }), [setPriceValue]);

  function adjustPrice(deltaCents: number) {
    const nextCents = Math.round(priceStepBase * 100) + deltaCents;
    setPriceValue(nextCents / 100);
  }

  function adjustQuantity(delta: number) {
    if (maxTradeQuantity < 1) return;
    const normalized = Math.min(maxTradeQuantity, Math.max(1, Math.floor(quantityStepBase + delta)));
    setQuantityDraft(String(normalized));
  }

  function quickQuantity(fraction: number) {
    if (maxTradeQuantity <= 0) return 0;
    if (fraction >= 1) return maxTradeQuantity;
    const quantityBase = orderSide === 'buy' ? maxBuyByFunds : maxSellQuantity;
    return Math.min(maxTradeQuantity, Math.max(1, Math.floor(quantityBase * fraction)));
  }

  function fillQuickQuantity(fraction: number) {
    const quantity = quickQuantity(fraction);
    if (quantity > 0) setQuantityDraft(String(quantity));
  }

  function submitOrder() {
    if (orderDisabledReason || parsedOrderPrice === null || parsedOrderQuantity === null) return;
    void showResult(placeAssetOrder(assetKind, assetId, orderSide, parsedOrderQuantity, parsedOrderPrice));
  }

  return (
    <section className="order-entry market-trade-entry" aria-labelledby="market-order-entry-title">
      <h3 id="market-order-entry-title" className="market-trade-section-title">下单</h3>
      <div className="ui-segmented market-side-switch" role="group" aria-label="订单方向">
        <Button
          variant="text"
          className={orderSide === 'buy' ? 'ui-segmented__button active' : 'ui-segmented__button'}
          aria-pressed={orderSide === 'buy'}
          onClick={() => selectOrderSide('buy')}
        >买入</Button>
        <Button
          variant="text"
          className={orderSide === 'sell' ? 'ui-segmented__button active danger' : 'ui-segmented__button'}
          aria-pressed={orderSide === 'sell'}
          onClick={() => selectOrderSide('sell')}
        >卖出</Button>
      </div>
      <div className="market-stepper-block">
        <div className="market-stepper" role="group" aria-label="调整订单价格">
          <Button
            variant="compact"
            className="market-stepper__button"
            aria-label="价格减少 0.01"
            disabled={!canDecreasePrice}
            onClick={() => adjustPrice(-1)}
          >−</Button>
          <MoneyInput
            id="market-order-price"
            label="价格"
            fieldClassName="market-stepper__field"
            className="market-stepper__input"
            value={priceDraft}
            fallbackValue={orderPrice}
            min={0.01}
            max={economyConstants.maxOrderPrice}
            wheelStep={0.01}
            aria-invalid={Boolean(priceReason)}
            aria-describedby={priceReason ? 'market-order-price-error' : undefined}
            onValueChange={updatePriceDraft}
            onKeyDown={(event) => { if (event.key === 'Enter') submitOrder(); }}
          />
          <Button
            variant="compact"
            className="market-stepper__button"
            aria-label="价格增加 0.01"
            disabled={!canIncreasePrice}
            onClick={() => adjustPrice(1)}
          >＋</Button>
        </div>
        {priceReason ? <small id="market-order-price-error" className="ui-form-field__error" role="alert">{priceReason}</small> : null}
      </div>
      <div className="market-stepper-block">
        <div className="market-stepper" role="group" aria-label="调整订单数量">
          <Button
            variant="compact"
            className="market-stepper__button"
            aria-label="数量减少 1"
            disabled={!canDecreaseQuantity}
            onClick={() => adjustQuantity(-1)}
          >−</Button>
          <IntegerInput
            id="market-order-quantity"
            label="数量"
            fieldClassName="market-stepper__field"
            className="market-stepper__input"
            value={quantityDraft}
            fallbackValue={Math.min(Math.max(1, orderQuantity), Math.max(1, maxTradeQuantity))}
            min={1}
            max={maxTradeQuantity > 0 ? maxTradeQuantity : undefined}
            disabled={maxTradeQuantity < 1}
            aria-invalid={Boolean(quantityReason)}
            aria-describedby={quantityReason ? 'market-order-quantity-error' : undefined}
            onValueChange={updateQuantityDraft}
            onKeyDown={(event) => { if (event.key === 'Enter') submitOrder(); }}
          />
          <Button
            variant="compact"
            className="market-stepper__button"
            aria-label="数量增加 1"
            disabled={!canIncreaseQuantity}
            onClick={() => adjustQuantity(1)}
          >＋</Button>
        </div>
        {quantityReason ? <small id="market-order-quantity-error" className="ui-form-field__error" role="alert">{quantityReason}</small> : null}
      </div>
      <div className="order-quick-fill" role="group" aria-label="快捷填写交易数量">
        <Button variant="compact" aria-label="填写四分之一可交易数量" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.25)}>25%</Button>
        <Button variant="compact" aria-label="填写二分之一可交易数量" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.5)}>50%</Button>
        <Button variant="compact" aria-label="填写最大可交易数量" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(1)}>最大</Button>
      </div>
      <div className="market-order-summary-grid">
        <span><small>订单总额</small><strong><CurrencyAmount>{formatCurrency(orderTotal)}</CurrencyAmount></strong></span>
        {orderSide === 'sell'
          ? <span><small>预计到账</small><strong><CurrencyAmount>{formatCurrency(estimatedNetTotal)}</CurrencyAmount></strong></span>
          : <span><small>可用资金</small><strong><CurrencyAmount>{formatCurrency(credits)}</CurrencyAmount></strong></span>}
      </div>
      <Button
        block
        className="market-submit-order"
        disabled={Boolean(orderDisabledReason)}
        aria-label={orderActionLabel}
        onClick={submitOrder}
      >
        {orderActionLabel}
      </Button>
    </section>
  );
}));

export function MarketPage({
  model,
  embedded = false,
  facilityAssetId,
  onBackFromFacilityAsset,
}: {
  model: LoadedGameViewModel;
  embedded?: boolean;
  facilityAssetId?: string;
  onBackFromFacilityAsset?: () => void;
}) {
  const {
    game,
    localTrades,
    marketAssetKind,
    marketAssetId,
    marketViewMode,
    showMarketCatalog,
    selectMarketAsset,
    orderSide,
    selectOrderSide,
    orderQuantity,
    orderPrice,
    placeAssetOrder,
    cancelOrder,
    clearLocalTrades,
    showResult,
  } = model;
  const now = game.lastProcessedAt;
  const orderEntryRef = useRef<MarketOrderEntryHandle>(null);
  const [mobileAccountView, setMobileAccountView] = useState<'orders' | 'trades'>('orders');
  const [requestedAutoTradeProductId, setRequestedAutoTradeProductId] = useState<string | null>(null);
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [catalogStatus, setCatalogStatus] = useState<MarketCatalogStatus>('all');
  const [catalogSort, setCatalogSort] = useState<MarketCatalogSort>('catalog');

  useEffect(() => {
    const openRequestedAutoTrade = (productId: string) => {
      if (!game.products.some((product) => product.id === productId)) return;
      setRequestedAutoTradeProductId(productId);
      selectMarketAsset('commodity', productId, !embedded);
    };
    const requested = consumeAutoSellPanelRequest(model.user.id);
    if (requested) openRequestedAutoTrade(requested);
    const handlePanelRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: number; productId?: string }>).detail;
      if (Number(detail?.userId) !== Number(model.user.id) || !detail?.productId) return;
      openRequestedAutoTrade(detail.productId);
    };
    window.addEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
    return () => window.removeEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
  }, [embedded, game.products, model.user.id, selectMarketAsset]);

  const productById = useMemo(
    () => new Map(game.products.map((product) => [product.id, product])),
    [game.products],
  );
  const facilityTypeById = useMemo(
    () => new Map(game.facilityTypes.map((facility) => [facility.id, facility])),
    [game.facilityTypes],
  );
  const facilityGroupByTypeId = useMemo(
    () => new Map(game.facilityGroups.map((group) => [group.facilityTypeId, group])),
    [game.facilityGroups],
  );

  const activeAssetKind: AssetKind = facilityAssetId ? 'facility' : marketAssetKind;
  const activeAssetId = facilityAssetId ?? marketAssetId;
  const selectedProduct = activeAssetKind === 'commodity'
    ? productById.get(activeAssetId) ?? game.products[0]
    : undefined;
  const selectedFacility = activeAssetKind === 'facility'
    ? facilityTypeById.get(activeAssetId) ?? game.facilityTypes[0]
    : undefined;
  const selectedGroup = selectedFacility
    ? facilityGroupByTypeId.get(selectedFacility.id)
    : undefined;
  const selectedInventory = selectedProduct
    ? game.inventories[selectedProduct.id] ?? { available: 0, frozen: 0, inTransit: 0 }
    : { available: 0, frozen: 0, inTransit: 0 };
  const selectedMarket = selectedProduct
    ? game.markets[selectedProduct.id]
    : selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;
  const selectedProductMarket = selectedProduct ? game.markets[selectedProduct.id] : undefined;
  const assetName = selectedProduct?.name ?? selectedFacility?.name ?? '资产';
  const assetId = selectedProduct?.id ?? selectedFacility?.id ?? activeAssetId;

  const orderIndex = useMemo(() => getClientOrderIndex(game.orders), [game.orders]);
  const selectedOrders = useMemo(
    () => openOrdersForAsset(orderIndex, activeAssetKind, assetId),
    [activeAssetKind, assetId, orderIndex],
  );
  const ownSelectedOrders = useMemo(
    () => selectedOrders.filter((order) => order.isOwn),
    [selectedOrders],
  );
  const selectedLocalTrades = useMemo(
    () => localTrades.filter((trade) => (
      trade.type === activeAssetKind
      && (activeAssetKind === 'commodity' ? trade.productId : trade.facilityTypeId) === assetId
    )),
    [activeAssetKind, assetId, localTrades],
  );
  const ownOpenOrders = orderIndex.ownOpenOrders;
  const maxOpenOrders = openOrderLimitForCatalog(game.products.length, game.facilityTypes.length);
  const bestAsks = useMemo(
    () => buildOrderBookLevels(selectedOrders, 'sell').reverse(),
    [selectedOrders],
  );
  const bestBids = useMemo(
    () => buildOrderBookLevels(selectedOrders, 'buy'),
    [selectedOrders],
  );
  const selectedBuyVolume = bestBids.reduce((sum, level) => sum + Math.max(0, level.remaining), 0);
  const selectedSellVolume = bestAsks.reduce((sum, level) => sum + Math.max(0, level.remaining), 0);
  const selectedBalance = selectedSellVolume - selectedBuyVolume;
  const maxBookDepth = Math.max(
    1,
    ...bestAsks.map((level) => level.remaining),
    ...bestBids.map((level) => level.remaining),
  );
  const selectedLastTradePrice = selectedMarket?.lastTradePrice;
  const marketHistory = selectedMarket?.priceHistory ?? [];
  const marketFallbackPrice = selectedMarket?.lastPrice
    ?? selectedProduct?.basePrice
    ?? selectedFacility?.systemValue
    ?? 1;
  const selectedMarketPrice = selectedProductMarket?.officialPrice ?? marketFallbackPrice;
  const selectedBaseDeviationPercent = selectedProduct && selectedProduct.basePrice > 0
    ? ((selectedMarketPrice / selectedProduct.basePrice) - 1) * 100
    : undefined;
  const marketBuckets = useMemo(
    () => buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now),
    [marketFallbackPrice, marketHistory, now],
  );
  const marketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;
  const marketVolume24h = useMemo(() => {
    const windowStart = now - (24 * 60 * 60 * 1_000);
    return marketHistory
      .filter((point) => point.createdAt >= windowStart && point.createdAt <= now)
      .reduce((sum, point) => sum + Math.max(0, Number(point.quantity || 0)), 0);
  }, [marketHistory, now]);
  const trendTone: StatusTone = marketTrend > 0 ? 'success' : marketTrend < 0 ? 'danger' : 'neutral';
  const availableAssetLabel = activeAssetKind === 'commodity' ? `可用${assetName}` : '可出售';
  const availableAssetQuantity = activeAssetKind === 'commodity'
    ? selectedInventory.available
    : selectedGroup?.availableCount ?? 0;
  const producerFacilities = useMemo(() => {
    if (!selectedProduct) return [];
    return game.facilityTypes.filter((facility) => {
      const recipes = facility.recipes.length > 0 ? facility.recipes : [facility];
      return recipes.some((recipe) => recipe.output.productId === selectedProduct.id);
    });
  }, [game.facilityTypes, selectedProduct]);
  const consumerFacilities = useMemo(() => {
    if (!selectedProduct) return [];
    return game.facilityTypes.filter((facility) => {
      const recipes = facility.recipes.length > 0 ? facility.recipes : [facility];
      return recipes.some((recipe) => recipe.inputs.some((input) => input.productId === selectedProduct.id));
    });
  }, [game.facilityTypes, selectedProduct]);

  const catalogEntries = useMemo(() => {
    const entries: MarketCatalogEntry[] = game.products.map((product) => {
      const market = game.markets[product.id];
      const orders = openOrdersForAsset(orderIndex, 'commodity', product.id);
      const buyVolume = orders
        .filter((order) => order.side === 'buy')
        .reduce((sum, order) => sum + Math.max(0, order.remaining), 0);
      const sellVolume = orders
        .filter((order) => order.side === 'sell')
        .reduce((sum, order) => sum + Math.max(0, order.remaining), 0);
      const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined;
      return {
        kind: 'commodity',
        id: product.id,
        name: product.name,
        category: product.category,
        categoryLabel: PRODUCT_CATEGORY_LABELS[product.category],
        lastTradePrice: typeof market?.lastTradePrice === 'number' ? market.lastTradePrice : undefined,
        marketPrice,
        trend: trendForMarket(market?.priceHistory ?? [], now),
        bestBid: buildOrderBookLevels(orders, 'buy')[0]?.price,
        bestAsk: buildOrderBookLevels(orders, 'sell')[0]?.price,
        ownOrderCount: orders.filter((order) => order.isOwn).length,
        buyVolume,
        sellVolume,
        demandSatisfaction: (market?.demand?.lastQuantity ?? 0) > 0
          ? Math.max(0, Math.min(1, market?.demand?.satisfaction ?? 0))
          : null,
      };
    });
    const filtered = entries.filter((entry) => {
      if (catalogCategory !== 'all' && entry.category !== catalogCategory) return false;
      if (catalogStatus === 'traded' && typeof entry.lastTradePrice !== 'number') return false;
      if (catalogStatus === 'buy' && typeof entry.bestBid !== 'number') return false;
      if (catalogStatus === 'sell' && typeof entry.bestAsk !== 'number') return false;
      if (catalogStatus === 'unmet-demand' && !(entry.demandSatisfaction !== null && entry.demandSatisfaction < 1)) return false;
      if (catalogStatus === 'own-order' && entry.ownOrderCount <= 0) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      if (catalogSort === 'name') return left.name.localeCompare(right.name, 'zh-CN');
      if (catalogSort === 'price') return (right.marketPrice ?? -Infinity) - (left.marketPrice ?? -Infinity);
      if (catalogSort === 'trend') return (right.trend ?? -Infinity) - (left.trend ?? -Infinity);
      if (catalogSort === 'buy-volume') return right.buyVolume - left.buyVolume;
      if (catalogSort === 'sell-volume') return right.sellVolume - left.sellVolume;
      return 0;
    });
  }, [
    catalogCategory,
    catalogSort,
    catalogStatus,
    game.markets,
    game.products,
    now,
    orderIndex,
  ]);

  function fillOrderPrice(price: number) {
    orderEntryRef.current?.fillPrice(price);
  }

  function assetLabel(order: AssetOrder) {
    const id = orderAssetId(order);
    if (orderKind(order) === 'facility') {
      const facilityName = facilityTypeById.get(id)?.name ?? id;
      return <span className="product-icon-label facility-icon-label"><FactoryIcon />{facilityName}</span>;
    }
    const productName = productById.get(id)?.name ?? id;
    return <ProductIconLabel productId={id}>{productName}</ProductIconLabel>;
  }

  function selectedAssetTitle(label: string) {
    return selectedProduct
      ? <ProductIconLabel productId={selectedProduct.id}>{label}</ProductIconLabel>
      : label;
  }

  function bookDepthStyle(remaining: number) {
    return {
      '--market-depth': `${Math.max(8, Math.round((remaining / maxBookDepth) * 100))}%`,
    } as CSSProperties;
  }

  function resetCatalogFilters() {
    setCatalogCategory('all');
    setCatalogStatus('all');
    setCatalogSort('catalog');
  }

  function returnToCatalog() {
    if (facilityAssetId && onBackFromFacilityAsset) {
      onBackFromFacilityAsset();
      return;
    }
    showMarketCatalog();
  }

  const provinceName = model.selectedProvince?.name || '加利福尼亚州';
  const catalogCategoryOptions = Object.entries(PRODUCT_CATEGORY_LABELS);
  if (!facilityAssetId && marketViewMode === 'catalog') {
    const activeCatalogFilterCount = Number(catalogCategory !== 'all')
      + Number(catalogStatus !== 'all')
      + Number(catalogSort !== 'catalog');
    const catalogContent = (
      <div className="market-page-surface market-catalog-surface">
        <details className="market-catalog-filter-disclosure">
          <summary>
            <span>筛选与排序</span>
            <small>{activeCatalogFilterCount > 0 ? `${activeCatalogFilterCount} 项已启用` : '默认折叠'}</small>
          </summary>
          <div className="market-catalog-filters" aria-label="市场列表筛选">
            <SelectInput
              label="分类"
              value={catalogCategory}
              onChange={(event) => setCatalogCategory(event.currentTarget.value)}
            >
              <option value="all">全部分类</option>
              {catalogCategoryOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectInput>
            <SelectInput
              label="市场状态"
              value={catalogStatus}
              onChange={(event) => setCatalogStatus(event.currentTarget.value as MarketCatalogStatus)}
            >
              <option value="all">全部状态</option>
              <option value="traded">有真实成交</option>
              <option value="buy">有买盘</option>
              <option value="sell">有卖盘</option>
              <option value="unmet-demand">消费需求未满足</option>
              <option value="own-order">有我的订单</option>
            </SelectInput>
            <SelectInput
              label="排序"
              value={catalogSort}
              onChange={(event) => setCatalogSort(event.currentTarget.value as MarketCatalogSort)}
            >
              <option value="catalog">目录顺序</option>
              <option value="name">名称</option>
              <option value="price">市场价</option>
              <option value="trend">24h 变化</option>
              <option value="buy-volume">买单量</option>
              <option value="sell-volume">卖单量</option>
            </SelectInput>
          </div>
        </details>
        <ul className="market-catalog-list" aria-label="商品市场列表">
          {catalogEntries.map((entry) => (
            <li className="market-catalog-item" key={`${entry.kind}:${entry.id}`}>
              <MarketCommodityRow
                productId={entry.id}
                productName={entry.name}
                categoryLabel={entry.categoryLabel}
                sellVolume={entry.sellVolume}
                buyVolume={entry.buyVolume}
                marketPrice={entry.marketPrice}
                trend={entry.trend}
                ariaLabel={`查看${entry.name}详情`}
                onClick={() => selectMarketAsset(entry.kind, entry.id, !embedded)}
              />
            </li>
          ))}
          {catalogEntries.length === 0 ? (
            <li className="market-catalog-empty">
              <p>没有符合当前筛选条件的商品。</p>
              <Button variant="secondary" onClick={resetCatalogFilters}>清除筛选</Button>
            </li>
          ) : null}
        </ul>
      </div>
    );
    return embedded
      ? catalogContent
      : <PageLayout title={`${provinceName}市场`}>{catalogContent}</PageLayout>;
  }

  const detailContent = (
    <>
      {embedded && facilityAssetId ? (
        <div className="province-embedded-section-navigation">
          <Button variant="secondary" onClick={returnToCatalog}>
            {facilityAssetId ? '返回建筑详情' : '返回商品列表'}
          </Button>
        </div>
      ) : null}
      <div className="market-page-surface market-detail-surface">
        <Panel className="widget market-detail-hero">
          <span className="market-detail-hero__artwork" aria-hidden="true">
            {selectedProduct
              ? <ProductArtwork productId={selectedProduct.id} />
              : selectedFacility ? <FacilityIcon facilityTypeId={selectedFacility.id} /> : <FactoryIcon />}
          </span>
          <span className="market-detail-hero__identity">
            <strong>{assetName}</strong>
            <small>{selectedProduct
              ? PRODUCT_CATEGORY_LABELS[selectedProduct.category]
              : selectedFacility ? FACILITY_CATEGORY_LABELS[selectedFacility.category] : '市场资产'}</small>
          </span>
          {selectedProduct ? (
            <>
              <span className="market-detail-hero__metric market-detail-hero__market-price">
                <small>市场价</small>
                <strong><CurrencyAmount>{formatCurrency(selectedMarketPrice)}</CurrencyAmount></strong>
              </span>
              <span className="market-detail-hero__metric">
                <small>基准偏离</small>
                <strong className={(selectedBaseDeviationPercent ?? 0) > 0 ? 'market-value-warning' : (selectedBaseDeviationPercent ?? 0) < 0 ? 'market-value-info' : ''}>
                  {typeof selectedBaseDeviationPercent === 'number' ? (selectedBaseDeviationPercent > 0 ? '+' : '') + selectedBaseDeviationPercent.toFixed(1) + '%' : '—'}
                </strong>
              </span>
              <span className="market-detail-hero__metric">
                <small>24h 变化</small>
                <strong className={marketTrend > 0 ? 'market-value-positive' : marketTrend < 0 ? 'market-value-negative' : ''}>
                  <CurrencyAmount sign={marketTrend > 0 ? '+' : undefined}>{formatCurrency(marketTrend)}</CurrencyAmount>
                </strong>
              </span>
            </>
          ) : (
            <>
              <span><small>可用</small><strong>{formatNumber(availableAssetQuantity)}</strong></span>
              <span><small>冻结</small><strong>{formatNumber(selectedGroup?.frozenCount ?? 0)}</strong></span>
              <span><small>已有订单</small><strong>{formatNumber(ownSelectedOrders.length)}</strong></span>
            </>
          )}
        </Panel>
        {selectedProduct && selectedProductMarket ? (
          <div className="market-fundamentals-grid">
            <Panel className="widget market-fundamentals-card">
              <WidgetHeading title="商品基本面" action={<StatusTag tone="info">服务器数据</StatusTag>} />
              <div className="market-fundamentals-metrics">
                <MetricCard
                  label="官方系统价"
                  value={<CurrencyAmount>{formatCurrency(selectedMarketPrice)}</CurrencyAmount>}
                  detail={typeof selectedBaseDeviationPercent === 'number' ? '相对基础价 ' + (selectedBaseDeviationPercent > 0 ? '+' : '') + selectedBaseDeviationPercent.toFixed(1) + '%' : undefined}
                  tone={(selectedBaseDeviationPercent ?? 0) > 0 ? 'warning' : (selectedBaseDeviationPercent ?? 0) < 0 ? 'info' : 'neutral'}
                />
                <MetricCard label="卖单量" value={formatNumber(selectedSellVolume)} />
                <MetricCard label="买单量" value={formatNumber(selectedBuyVolume)} />
                <MetricCard
                  label="挂单差额"
                  value={(selectedBalance > 0 ? '+' : '') + formatNumber(selectedBalance)}
                  detail="卖单量 − 买单量"
                  tone={selectedBalance > 0 ? 'info' : selectedBalance < 0 ? 'warning' : 'neutral'}
                />
                <MetricCard
                  label="需求满足率"
                  value={selectedProductMarket.demand.lastQuantity > 0 ? (selectedProductMarket.demand.satisfaction * 100).toFixed(1) + '%' : '无直接需求'}
                  tone={selectedProductMarket.demand.lastQuantity > 0 && selectedProductMarket.demand.satisfaction < 1 ? 'warning' : 'neutral'}
                />
                <MetricCard label="参考价" value={<CurrencyAmount>{formatCurrency(selectedProductMarket.demand.referencePrice)}</CurrencyAmount>} />
                <MetricCard label="上轮需求" value={formatNumber(selectedProductMarket.demand.lastQuantity)} detail={'预算 ' + formatCurrency(selectedProductMarket.demand.lastBudget)} />
                <MetricCard
                  label="周期系统买卖量"
                  value={formatNumber(selectedProductMarket.cycleSellQuantity ?? 0) + ' 卖 / ' + formatNumber(selectedProductMarket.cycleBuyQuantity ?? 0) + ' 买'}
                />
              </div>
              <div className="market-fundamentals-balance" aria-label="当前订单簿失衡程度">
                <span><small>订单簿失衡</small><strong>{selectedBalance > 0 ? '卖单较多' : selectedBalance < 0 ? '买单较多' : selectedBuyVolume + selectedSellVolume > 0 ? '数量均衡' : '无挂单'}</strong></span>
                <MarketBalanceBar buyVolume={selectedBuyVolume} sellVolume={selectedSellVolume} />
              </div>
              <p className="market-authority-note">挂单量来自当前公开订单簿；消费需求来自服务器上一周期结算。库存和理论产量不计作供给或需求。</p>
            </Panel>
            <Panel className="widget market-flow-card">
              <WidgetHeading title="生产者与消费者" />
              <div className="market-flow-groups">
                <section>
                  <h3>生产建筑</h3>
                  <div>{producerFacilities.length > 0
                    ? producerFacilities.map((facility) => <StatusTag key={facility.id} tone="success">{facility.name}</StatusTag>)
                    : <span className="muted">没有生产该商品的建筑</span>}</div>
                </section>
                <section>
                  <h3>消费建筑</h3>
                  <div>{consumerFacilities.length > 0
                    ? consumerFacilities.map((facility) => <StatusTag key={facility.id} tone="warning">{facility.name}</StatusTag>)
                    : <span className="muted">没有以该商品为投入的建筑</span>}</div>
                </section>
              </div>
            </Panel>
          </div>
        ) : null}
        <div className="market-grid unified-market-grid">
          <Panel className="widget market-chart-card">
            <WidgetHeading
              title={selectedAssetTitle(`${assetName}近 24h 成交趋势`)}
              action={(
                <StatusTag tone={trendTone} className="market-trend-tag">
                  <CurrencyAmount sign={marketTrend > 0 ? '+' : undefined}>{formatCurrency(marketTrend)}</CurrencyAmount>
                </StatusTag>
              )}
            />
            <PriceSparkline buckets={marketBuckets} variant="full" />
          </Panel>

          <Panel className="widget market-trade-card">
            <WidgetHeading
              title={selectedAssetTitle(`${assetName}交易`)}
              action={<StatusTag>{formatNumber(ownSelectedOrders.length)} 笔未完成</StatusTag>}
            />
            <div className="market-trade-summary" aria-label={`${assetName}交易摘要`}>
              <span>
                <small>最近成交</small>
                <strong className="market-trade-summary__price"><CurrencyAmount>{typeof selectedLastTradePrice === 'number' ? formatCurrency(selectedLastTradePrice) : '—'}</CurrencyAmount></strong>
              </span>
              <span>
                <small>24h 变化</small>
                <StatusTag tone={trendTone} className="market-trend-tag">
                  <CurrencyAmount sign={marketTrend > 0 ? '+' : undefined}>{formatCurrency(marketTrend)}</CurrencyAmount>
                </StatusTag>
              </span>
              <span>
                <small>{selectedProduct ? '24h 成交量' : availableAssetLabel}</small>
                <strong>{formatNumber(selectedProduct ? marketVolume24h : availableAssetQuantity)}</strong>
              </span>
            </div>
            <div className="market-trade-layout">
              <MarketOrderEntry
                key={`${activeAssetKind}:${assetId}:${orderSide}`}
                ref={orderEntryRef}
                assetKind={activeAssetKind}
                assetId={assetId}
                assetName={assetName}
                orderSide={orderSide}
                selectOrderSide={selectOrderSide}
                orderPrice={orderPrice}
                orderQuantity={orderQuantity}
                credits={game.credits}
                availableQuantity={availableAssetQuantity}
                ownOpenOrderCount={ownOpenOrders.length}
                maxOpenOrders={maxOpenOrders}
                placeAssetOrder={placeAssetOrder}
                showResult={showResult}
              />

              <section className="order-book single-order-book market-trade-book" aria-labelledby="market-order-book-title">
                <div className="market-trade-section-heading">
                  <h3 id="market-order-book-title">订单簿</h3>
                  <small>实时五档 · 点击填价</small>
                </div>
                <div className="order-book-stack" aria-label={`${assetName}买卖盘`}>
                  {bestAsks.map((level, index) => {
                    const levelName = `卖${bestAsks.length - index}`;
                    return (
                      <button
                        type="button"
                        className="book-order-row market-book-price-button ask"
                        key={`sell-${level.price}`}
                        aria-label={`${levelName}，价格 ${formatCurrency(level.price)}，合计剩余 ${formatNumber(level.remaining)}，点击填入价格`}
                        data-order-count={level.orderCount}
                        style={bookDepthStyle(level.remaining)}
                        onClick={() => fillOrderPrice(level.price)}
                      >
                        <span className="market-book-level">{levelName}</span>
                        <strong><CurrencyAmount>{formatCurrency(level.price)}</CurrencyAmount></strong>
                        <span>{formatNumber(level.remaining)}</span>
                      </button>
                    );
                  })}
                  {bestAsks.length === 0 ? <p className="muted order-book-empty">暂无卖单</p> : null}
                  {bestBids.map((level, index) => {
                    const levelName = `买${index + 1}`;
                    return (
                      <button
                        type="button"
                        className="book-order-row market-book-price-button bid"
                        key={`buy-${level.price}`}
                        aria-label={`${levelName}，价格 ${formatCurrency(level.price)}，合计剩余 ${formatNumber(level.remaining)}，点击填入价格`}
                        data-order-count={level.orderCount}
                        style={bookDepthStyle(level.remaining)}
                        onClick={() => fillOrderPrice(level.price)}
                      >
                        <span className="market-book-level">{levelName}</span>
                        <strong><CurrencyAmount>{formatCurrency(level.price)}</CurrencyAmount></strong>
                        <span>{formatNumber(level.remaining)}</span>
                      </button>
                    );
                  })}
                  {bestBids.length === 0 ? <p className="muted order-book-empty">暂无买单</p> : null}
                </div>
              </section>
            </div>

          </Panel>

          {selectedProduct ? (
            <MarketAutoTradePanel
              model={model}
              fixedProductId={selectedProduct.id}
              requestedProductId={requestedAutoTradeProductId}
              className="market-detail-auto-trade"
            />
          ) : null}

          <Panel className="widget span-3 market-account-panel">
            <WidgetHeading title={`我的${assetName}订单与成交`} action={<StatusTag>{formatNumber(ownSelectedOrders.length)} 笔未完成</StatusTag>} />
            <div className="market-account-view-switch ui-segmented" role="group" aria-label="我的订单与成交视图">
              <Button
                variant="text"
                className={mobileAccountView === 'orders' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={mobileAccountView === 'orders'}
                onClick={() => setMobileAccountView('orders')}
              >挂单</Button>
              <Button
                variant="text"
                className={mobileAccountView === 'trades' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={mobileAccountView === 'trades'}
                onClick={() => setMobileAccountView('trades')}
              >成交</Button>
            </div>
            <div className="market-account-grid">
              <section className={mobileAccountView === 'orders' ? 'market-account-pane--active' : ''}>
                <h3>已有订单</h3>
                <ScrollableTable className="own-open-orders-table-wrap">
                  <table className="own-open-orders-table">
                    <thead>
                      <tr>
                        <th>资产</th>
                        <th className="order-side-cell">方向</th>
                        <th className="numeric-cell">价格</th>
                        <th className="numeric-cell">剩余/原始</th>
                        <th>状态</th>
                        <th>时间</th>
                        <th className="order-action-cell"><span className="visually-hidden">操作</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownSelectedOrders.map((order) => (
                        <tr key={order.id}>
                          <td><strong>{assetLabel(order)}</strong></td>
                          <td className="order-side-cell"><StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag></td>
                          <td className="numeric-cell"><CurrencyAmount>{formatCurrency(order.price)}</CurrencyAmount></td>
                          <td className="numeric-cell">{formatNumber(order.remaining)}/{formatNumber(order.quantity)}</td>
                          <td><StatusTag tone={orderTone(order.status)}>{orderStatusNames[order.status]}</StatusTag></td>
                          <td>{formatTime(order.createdAt)}</td>
                          <td className="order-action-cell"><Button variant="compact" onClick={() => void showResult(cancelOrder(order.id))}>撤单</Button></td>
                        </tr>
                      ))}
                      {ownSelectedOrders.length === 0 ? <tr><td colSpan={7} className="empty-cell">当前资产暂无未完成订单。</td></tr> : null}
                    </tbody>
                  </table>
                </ScrollableTable>
              </section>

              <section className={`local-trades-section${mobileAccountView === 'trades' ? ' market-account-pane--active' : ''}`}>
                <div className="local-trades-heading">
                  <h3>本地成交</h3>
                  <Button variant="compact" onClick={clearLocalTrades} disabled={localTrades.length === 0}>清除全部本地成交</Button>
                </div>
                {selectedLocalTrades.length === 0 ? <p className="muted">当前浏览器暂无该资产成交记录。</p> : (
                  <VirtualRecordTable
                    items={selectedLocalTrades}
                    getKey={localTradeKey}
                    estimateSize={54}
                    viewportHeight={520}
                    minViewportHeight={96}
                    overscan={6}
                    gap={0}
                    className="local-trades-scroll-area"
                    tableClassName="local-trades-virtual-table"
                    ariaLabel={`${assetName}本地成交`}
                    header={(
                      <>
                        <span role="columnheader">资产</span>
                        <span role="columnheader" className="trade-side-cell">方向</span>
                        <span role="columnheader" className="numeric-cell">数量</span>
                        <span role="columnheader" className="numeric-cell">价格</span>
                        <span role="columnheader" className="numeric-cell">总额</span>
                        <span role="columnheader" className="numeric-cell">手续费 / 实收</span>
                        <span role="columnheader">时间</span>
                      </>
                    )}
                    renderRow={(trade) => (
                      <div className="virtual-record-row" role="row">
                        <span role="cell">{trade.type === 'commodity' && trade.productId
                          ? <ProductIconLabel productId={trade.productId}>{localTradeAssetName(trade)}</ProductIconLabel>
                          : <span className="product-icon-label facility-icon-label"><FactoryIcon />{localTradeAssetName(trade)}</span>}</span>
                        <span role="cell" className="trade-side-cell"><StatusTag tone={trade.side === 'buy' ? 'success' : 'danger'}>{trade.side === 'buy' ? '买入' : '卖出'}</StatusTag></span>
                        <span role="cell" className="numeric-cell">{formatNumber(trade.quantity)}</span>
                        <span role="cell" className="numeric-cell"><CurrencyAmount>{formatCurrency(trade.price)}</CurrencyAmount></span>
                        <span role="cell" className="numeric-cell"><CurrencyAmount>{formatCurrency(trade.total)}</CurrencyAmount></span>
                        <span role="cell" className="numeric-cell">{trade.side === 'sell' ? <><CurrencyAmount>{formatCurrency(trade.fee ?? 0)}</CurrencyAmount> / <CurrencyAmount>{formatCurrency(trade.netTotal ?? trade.total)}</CurrencyAmount></> : '—'}</span>
                        <span role="cell">{formatTime(trade.createdAt)}</span>
                      </div>
                    )}
                  />
                )}
              </section>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
  return embedded ? detailContent : (
    <PageLayout
      title={<RegionalEntityPageTitle entityName={assetName} regionName={provinceName} />}
      backAction={{
        label: facilityAssetId ? '返回建筑详情' : '返回商品列表',
        onClick: returnToCatalog,
      }}
    >
      {detailContent}
    </PageLayout>
  );
}
