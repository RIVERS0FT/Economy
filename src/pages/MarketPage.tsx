import type { ChangeEvent } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import {
  Button,
  MetricCard,
  PageLayout,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import type { CommodityOrder, OrderSide } from '../types';
import { formatCurrency } from '../utils/formatters';

interface OrderBookLevel {
  price: number;
  remaining: number;
  orderCount: number;
}

function aggregateOrderBook(orders: CommodityOrder[], side: OrderSide): OrderBookLevel[] {
  const levels = new Map<number, OrderBookLevel>();

  for (const order of orders) {
    const level = levels.get(order.price);
    if (level) {
      level.remaining += order.remaining;
      level.orderCount += 1;
    } else {
      levels.set(order.price, {
        price: order.price,
        remaining: order.remaining,
        orderCount: 1,
      });
    }
  }

  return Array.from(levels.values()).sort((left, right) =>
    side === 'buy' ? right.price - left.price : left.price - right.price,
  );
}

export function MarketPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    derived,
    selectedProductId,
    setSelectedProductId,
    orderSide,
    setOrderSide,
    orderQuantity,
    setOrderQuantity,
    orderPrice,
    setOrderPrice,
    placeCommodityOrder,
    cancelFacilityListing,
    buyFacility,
    showResult,
  } = model;
  const bidLevels = aggregateOrderBook(derived.bids, 'buy').slice(0, 10);
  const askLevels = aggregateOrderBook(derived.asks, 'sell').slice(0, 10);
  const selectedProduct = derived.selectedProduct;
  const selectedInventory = derived.selectedInventory;
  const selectedMarket = derived.selectedMarket;

  function productName(productId?: string) {
    if (!productId) return '无';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
  }

  function facilityTypeName(typeId: string) {
    return game.facilityTypes.find((type) => type.id === typeId)?.name ?? typeId;
  }

  return (
    <PageLayout
      title="市场"
      description="每种商品拥有独立订单簿、价格历史和需求，产业链原料与产成品均可自由交易。"
    >
      <div className="product-tabs" role="tablist" aria-label="选择商品市场">
        {game.products.map((product) => {
          const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
          const market = game.markets[product.id];
          return (
            <button
              type="button"
              role="tab"
              aria-selected={product.id === selectedProductId}
              className={product.id === selectedProductId ? 'product-tab active' : 'product-tab'}
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
            >
              <strong>{product.name}</strong>
              <span>¤ {market?.lastPrice ?? product.basePrice}</span>
              <small>持仓 {inventory.available}</small>
            </button>
          );
        })}
      </div>

      <div className="market-stat-strip panel">
        <MetricCard tone="success" label="买一价" value={`¤ ${derived.bestBid || '--'}`} />
        <MetricCard tone="danger" label="卖一价" value={`¤ ${derived.bestAsk || '--'}`} />
        <MetricCard label="价差" value={`¤ ${derived.spread}`} />
        <MetricCard label="可用持仓" value={selectedInventory.available} detail={`冻结 ${selectedInventory.frozen}`} />
        <MetricCard label="平均成本" value={derived.averageCost ? `¤ ${derived.averageCost.toFixed(1)}` : '--'} />
      </div>

      <div className="market-grid">
        <Panel className="widget order-entry">
          <WidgetHeading title={`${selectedProduct.name}限价订单`} />
          <div className="ui-segmented" role="group" aria-label="订单方向">
            <Button
              variant="text"
              className={orderSide === 'buy' ? 'ui-segmented__button active' : 'ui-segmented__button'}
              aria-pressed={orderSide === 'buy'}
              onClick={() => setOrderSide('buy')}
            >
              买入
            </Button>
            <Button
              variant="text"
              className={orderSide === 'sell' ? 'ui-segmented__button active danger' : 'ui-segmented__button'}
              aria-pressed={orderSide === 'sell'}
              onClick={() => setOrderSide('sell')}
            >
              卖出
            </Button>
          </div>
          <label>
            数量
            <input
              type="number"
              min="1"
              value={orderQuantity}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setOrderQuantity(Number(event.target.value))}
            />
          </label>
          <label>
            限价
            <input
              type="number"
              min="1"
              value={orderPrice}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setOrderPrice(Number(event.target.value))}
            />
          </label>
          <div className="order-summary"><span>订单总额</span><strong>¤ {formatCurrency(orderQuantity * orderPrice)}</strong></div>
          <div className="order-capacity">
            <span>可用资金 ¤ {formatCurrency(game.credits)}</span>
            <span>可用{selectedProduct.name} {selectedInventory.available}</span>
          </div>
          <Button block onClick={() => void showResult(placeCommodityOrder(orderSide, orderQuantity, orderPrice))}>
            提交{selectedProduct.name}{orderSide === 'buy' ? '买单' : '卖单'}
          </Button>
          <small className="ui-helper-text">不同商品不会互相撮合；服务器按价格优先、同价时间优先完成原子结算。</small>
        </Panel>

        <Panel className="widget order-book">
          <WidgetHeading
            title={`${selectedProduct.name}订单簿`}
            action={<div className="last-price"><span>最近成交</span><strong>¤ {selectedMarket.lastPrice}</strong></div>}
          />
          <div className="book-columns">
            <div>
              <h3>买盘</h3>
              {bidLevels.map((level) => (
                <div className="book-row bid" key={`buy-${level.price}`}>
                  <span>¤ {level.price}</span>
                  <span>{level.remaining}</span>
                  <small>{level.orderCount} 笔</small>
                </div>
              ))}
              {bidLevels.length === 0 ? <p className="muted">暂无买单</p> : null}
            </div>
            <div>
              <h3>卖盘</h3>
              {askLevels.map((level) => (
                <div className="book-row ask" key={`sell-${level.price}`}>
                  <span>¤ {level.price}</span>
                  <span>{level.remaining}</span>
                  <small>{level.orderCount} 笔</small>
                </div>
              ))}
              {askLevels.length === 0 ? <p className="muted">暂无卖单</p> : null}
            </div>
          </div>
        </Panel>

        <Panel className="widget market-chart-card">
          <WidgetHeading
            title={`${selectedProduct.name}近期成交曲线`}
            action={
              <StatusTag tone={derived.marketTrend >= 0 ? 'success' : 'danger'}>
                {derived.marketTrend >= 0 ? '+' : ''}{derived.marketTrend}
              </StatusTag>
            }
          />
          <PriceSparkline values={derived.history} />
          <div className="chart-footer">
            <span>成交样本 {selectedMarket.priceHistory.length}</span>
            <span>需求满足率 {Math.round(selectedMarket.demand.satisfaction * 100)}%</span>
          </div>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading title="工厂挂牌" action={<span className="muted">工厂数量不受槽位限制，购买后需手动启动</span>} />
          <div className="listing-grid">
            {game.facilityListings.map((listing) => (
              <article className="listing-card" key={listing.id}>
                <div>
                  <StatusTag tone={listing.ownerId === game.userId ? 'info' : 'neutral'}>
                    {listing.ownerId === game.userId ? '我的挂牌' : '可收购'}
                  </StatusTag>
                  <h3>{listing.facility.name}</h3>
                  <p>{facilityTypeName(listing.facility.facilityTypeId)} · {listing.ownerName}</p>
                </div>
                <div className="listing-specs ui-spec-grid">
                  <span>配方 <strong>{listing.facility.inputProductId ? `${listing.facility.inputPerCycle} ${productName(listing.facility.inputProductId)} → ` : ''}{listing.facility.outputPerCycle} {productName(listing.facility.outputProductId)}</strong></span>
                  <span>周期 <strong>{listing.facility.cycleMs / 1000} 秒</strong></span>
                  <span>运营费 <strong>¤ {listing.facility.operatingCost}</strong></span>
                  <span>容量 <strong>{listing.facility.internalCapacity}</strong></span>
                  <span>累计产量 <strong>{listing.facility.lifetimeOutput}</strong></span>
                  <span>参考估值 <strong>¤ {listing.facility.systemValue}</strong></span>
                </div>
                <div className="listing-price">
                  <strong>¤ {formatCurrency(listing.price)}</strong>
                  {listing.ownerId === game.userId
                    ? <Button variant="danger" onClick={() => void showResult(cancelFacilityListing(listing.id))}>撤销</Button>
                    : <Button onClick={() => void showResult(buyFacility(listing.id))}>立即收购</Button>}
                </div>
              </article>
            ))}
            {game.facilityListings.length === 0 ? <p className="empty-state">暂无工厂挂牌。</p> : null}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
