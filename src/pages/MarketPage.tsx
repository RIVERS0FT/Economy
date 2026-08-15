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
import { FacilityIcon } from '../components/icons/FacilityIcons';
import { FactoryIcon, WarehouseIcon } from '../components/icons/GameIcons';
import { ProductIcon, ProductIconLabel } from '../components/icons/ProductIcons';
import { ProvinceSelect } from '../components/provinces/ProvinceSelect';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, MoneyInput } from '../components/ui/FormControls';
import {
  Button,
  PageLayout,
  Panel,
  ScrollableTable,
  StatusTag,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import { ScrollArea } from '../components/ui/ScrollArea';
import { VirtualRecordTable } from '../components/ui/VirtualRecordTable';
import { economyConstants, openOrderLimitForCatalog } from '../config/economy';
import type { AssetKind, AssetOrder, OrderSide } from '../types';
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

export function MarketPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    localTrades,
    marketAssetKind,
    marketAssetId,
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
  const assetDirectoryRef = useRef<HTMLDivElement>(null);
  const orderEntryRef = useRef<MarketOrderEntryHandle>(null);
  const [mobileAccountView, setMobileAccountView] = useState<'orders' | 'trades'>('orders');

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

  const selectedProduct = marketAssetKind === 'commodity'
    ? productById.get(marketAssetId) ?? game.products[0]
    : undefined;
  const selectedFacility = marketAssetKind === 'facility'
    ? facilityTypeById.get(marketAssetId) ?? game.facilityTypes[0]
    : undefined;
  const selectedGroup = selectedFacility
    ? facilityGroupByTypeId.get(selectedFacility.id)
    : undefined;
  const selectedInventory = selectedProduct
    ? game.inventories[selectedProduct.id] ?? { available: 0, frozen: 0 }
    : { available: 0, frozen: 0 };
  const selectedMarket = selectedProduct
    ? game.markets[selectedProduct.id]
    : selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;
  const assetName = selectedProduct?.name ?? selectedFacility?.name ?? '资产';
  const assetId = selectedProduct?.id ?? selectedFacility?.id ?? marketAssetId;

  const orderIndex = useMemo(() => getClientOrderIndex(game.orders), [game.orders]);
  const selectedOrders = useMemo(
    () => openOrdersForAsset(orderIndex, marketAssetKind, assetId),
    [assetId, marketAssetKind, orderIndex],
  );
  const ownSelectedOrders = useMemo(
    () => selectedOrders.filter((order) => order.isOwn),
    [selectedOrders],
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
  const marketBuckets = useMemo(
    () => buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now),
    [marketFallbackPrice, marketHistory, now],
  );
  const marketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;
  const trendTone: StatusTone = marketTrend > 0 ? 'success' : marketTrend < 0 ? 'danger' : 'neutral';
  const availableAssetLabel = marketAssetKind === 'commodity' ? `可用${assetName}` : '可出售';
  const availableAssetQuantity = marketAssetKind === 'commodity'
    ? selectedInventory.available
    : selectedGroup?.availableCount ?? 0;

  useEffect(() => {
    const active = assetDirectoryRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [assetId, marketAssetKind]);

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

  function scrollAssetDirectory(direction: -1 | 1) {
    const directory = assetDirectoryRef.current;
    if (!directory) return;
    directory.scrollBy({ left: direction * directory.clientWidth * 0.82, behavior: 'smooth' });
  }

  return (
    <PageLayout
      title={`${model.selectedProvince?.name || '加利福尼亚州'}本地市场`}
      description="商品与工厂只和当前州级地区的订单撮合，继续使用价格优先和时间优先规则。"
      actions={(
        <ProvinceSelect
          provinces={game.provinces}
          value={model.selectedProvinceId}
          onChange={model.setSelectedProvinceId}
        />
      )}
    >
      <div className="market-page-surface">
        <div className="asset-directory-shell">
          <Button
            variant="compact"
            className="asset-directory-control asset-directory-control--previous"
            aria-label="向前浏览资产"
            onClick={() => scrollAssetDirectory(-1)}
          >‹</Button>
          <ScrollArea
            axis="x"
            className="asset-directory-scroll-area"
            viewportRef={assetDirectoryRef}
            viewportClassName="unified-asset-tabs"
            viewportRole="tablist"
            viewportAriaLabel="选择交易资产"
            scrollbarVisibility="adaptive"
          >
            <span className="asset-directory-divider" role="presentation" aria-hidden="true">商品</span>
            {game.products.map((product) => {
              const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
              const active = marketAssetKind === 'commodity' && product.id === assetId;
              const lastTradePrice = game.markets[product.id]?.lastTradePrice;
              const hasLastTradePrice = typeof lastTradePrice === 'number';
              const priceLabel = hasLastTradePrice ? formatCurrency(lastTradePrice) : '暂无成交';
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${product.name}，最近成交价 ${priceLabel}，可用库存 ${formatNumber(inventory.available)}${active ? '，当前选择' : ''}`}
                  className={active ? 'unified-asset-tab active' : 'unified-asset-tab'}
                  key={`commodity-${product.id}`}
                  onClick={() => selectMarketAsset('commodity', product.id)}
                >
                  <span className="market-asset-card__icon-layer" aria-hidden="true">
                    <ProductIcon productId={product.id} />
                  </span>
                  <span className="market-asset-card__data-layer" aria-hidden="true">
                    <strong className="market-asset-card__name">
                      <ProductIcon productId={product.id} className="market-asset-card__name-icon" />
                      <span>{product.name}</span>
                    </strong>
                    <span className="market-asset-card__price" title={`最近成交价：${priceLabel}`}>
                      <CurrencyAmount>{hasLastTradePrice ? formatCurrency(lastTradePrice) : '—'}</CurrencyAmount>
                    </span>
                    {active ? <span className="market-asset-card__current">当前</span> : null}
                    <span className="market-asset-card__inventory" title={`可用库存：${formatNumber(inventory.available)}`}>
                      <WarehouseIcon />
                      <span>{formatNumber(inventory.available)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
            <span className="asset-directory-divider asset-directory-divider--facility" role="presentation" aria-hidden="true">工厂</span>
            {game.facilityTypes.map((facility) => {
              const group = facilityGroupByTypeId.get(facility.id);
              const active = marketAssetKind === 'facility' && facility.id === assetId;
              const lastTradePrice = game.facilityMarkets[facility.id]?.lastTradePrice;
              const hasLastTradePrice = typeof lastTradePrice === 'number';
              const priceLabel = hasLastTradePrice ? formatCurrency(lastTradePrice) : '暂无成交';
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${facility.name}，最近成交价 ${priceLabel}，持有 ${formatNumber(group?.count ?? 0)}${active ? '，当前选择' : ''}`}
                  className={active ? 'unified-asset-tab facility active' : 'unified-asset-tab facility'}
                  key={`facility-${facility.id}`}
                  onClick={() => selectMarketAsset('facility', facility.id)}
                >
                  <span className="market-asset-card__icon-layer" aria-hidden="true">
                    <FacilityIcon facilityTypeId={facility.id} />
                  </span>
                  <span className="market-asset-card__data-layer" aria-hidden="true">
                    <strong className="market-asset-card__name">
                      <FactoryIcon className="market-asset-card__name-icon" />
                      <span>{facility.name}</span>
                    </strong>
                    <span className="market-asset-card__price" title={`最近成交价：${priceLabel}`}>
                      <CurrencyAmount>{hasLastTradePrice ? formatCurrency(lastTradePrice) : '—'}</CurrencyAmount>
                    </span>
                    {active ? <span className="market-asset-card__current">当前</span> : null}
                    <span className="market-asset-card__inventory" title={`持有数量：${formatNumber(group?.count ?? 0)}`}>
                      <FactoryIcon />
                      <span>{formatNumber(group?.count ?? 0)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </ScrollArea>
          <Button
            variant="compact"
            className="asset-directory-control asset-directory-control--next"
            aria-label="向后浏览资产"
            onClick={() => scrollAssetDirectory(1)}
          >›</Button>
        </div>

        <div className="market-grid unified-market-grid">
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
                <small>{availableAssetLabel}</small>
                <strong>{formatNumber(availableAssetQuantity)}</strong>
              </span>
            </div>
            <div className="market-trade-layout">
              <MarketOrderEntry
                key={`${marketAssetKind}:${assetId}:${orderSide}`}
                ref={orderEntryRef}
                assetKind={marketAssetKind}
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

            {ownSelectedOrders.length > 0 ? (
              <div className="inline-order-list market-trade-orders" aria-label={`我的${assetName}未完成订单`}>
                <h3>当前资产未完成订单</h3>
                {ownSelectedOrders.map((order) => (
                  <div key={order.id}>
                    <span>
                      <StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag>
                      <strong><CurrencyAmount>{formatCurrency(order.price)}</CurrencyAmount></strong>
                      <small>{formatNumber(order.remaining)}/{formatNumber(order.quantity)}</small>
                    </span>
                    <Button variant="compact" onClick={() => void showResult(cancelOrder(order.id))}>撤单</Button>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>

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

          <Panel className="widget span-3 market-account-panel">
            <WidgetHeading title="我的订单与成交" action={<StatusTag>{formatNumber(ownOpenOrders.length)}/{formatNumber(maxOpenOrders)} 笔未完成</StatusTag>} />
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
                <h3>未完成订单</h3>
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
                      {ownOpenOrders.map((order) => (
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
                      {ownOpenOrders.length === 0 ? <tr><td colSpan={7} className="empty-cell">暂无未完成订单。</td></tr> : null}
                    </tbody>
                  </table>
                </ScrollableTable>
              </section>

              <section className={`local-trades-section${mobileAccountView === 'trades' ? ' market-account-pane--active' : ''}`}>
                <div className="local-trades-heading">
                  <h3>本地成交记录</h3>
                  <Button variant="compact" onClick={clearLocalTrades} disabled={localTrades.length === 0}>清除本地成交</Button>
                </div>
                {localTrades.length === 0 ? <p className="muted">当前浏览器暂无成交记录。</p> : (
                  <VirtualRecordTable
                    items={localTrades}
                    getKey={localTradeKey}
                    estimateSize={54}
                    viewportHeight={520}
                    minViewportHeight={96}
                    overscan={6}
                    gap={0}
                    className="local-trades-scroll-area"
                    tableClassName="local-trades-virtual-table"
                    ariaLabel="本地成交记录"
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
    </PageLayout>
  );
}
