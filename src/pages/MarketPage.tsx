import type { LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import { PageLayout, Panel, WidgetHeading } from '../components/ui/layout';
import { formatCurrency } from '../utils/formatters';

export function MarketPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    derived,
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

  return (
    <PageLayout
      eyebrow="统一市场"
      title="市场"
      description="通过订单簿判断价格，与玩家和人口需求进行商品交易，或收购生产设施。"
    >
      <div className="market-stat-strip panel">
        <div><span>买一价</span><strong className="positive">¤ {derived.bestBid || '--'}</strong></div>
        <div><span>卖一价</span><strong className="negative">¤ {derived.bestAsk || '--'}</strong></div>
        <div><span>价差</span><strong>¤ {derived.spread}</strong></div>
        <div><span>玩家持仓</span><strong>{game.inventory}</strong></div>
        <div><span>平均成本</span><strong>{derived.averageCost ? `¤ ${derived.averageCost.toFixed(1)}` : '--'}</strong></div>
      </div>

      <div className="market-grid">
        <Panel className="widget order-entry">
          <p className="eyebrow">限价订单</p>
          <h2>{game.commodityName}限价订单</h2>
          <div className="segmented">
            <button className={orderSide === 'buy' ? 'active' : ''} onClick={() => setOrderSide('buy')}>买入</button>
            <button className={orderSide === 'sell' ? 'active sell-active' : ''} onClick={() => setOrderSide('sell')}>卖出</button>
          </div>
          <label>数量<input type="number" min="1" value={orderQuantity} onChange={(event) => setOrderQuantity(Number(event.target.value))} /></label>
          <label>限价<input type="number" min="1" value={orderPrice} onChange={(event) => setOrderPrice(Number(event.target.value))} /></label>
          <div className="order-summary"><span>订单总额</span><strong>¤ {formatCurrency(orderQuantity * orderPrice)}</strong></div>
          <div className="order-capacity"><span>可用资金 ¤ {formatCurrency(game.credits)}</span><span>可用库存 {game.inventory}</span></div>
          <button onClick={() => showResult(placeCommodityOrder(orderSide, orderQuantity, orderPrice))}>提交{orderSide === 'buy' ? '买单' : '卖单'}</button>
          <small>价格优先、同价时间优先，允许部分成交和撤销未成交部分。</small>
        </Panel>

        <Panel className="widget order-book">
          <WidgetHeading
            eyebrow="订单簿"
            title="商品订单簿"
            action={<div className="last-price"><span>最近成交</span><strong>¤ {game.marketPrice}</strong></div>}
          />
          <div className="book-columns">
            <div><h3>买盘</h3>{derived.bids.slice(0, 10).map((order) => <div className="book-row bid" key={order.id}><span>¤ {order.price}</span><span>{order.remaining}</span><small>{order.ownerName}</small></div>)}</div>
            <div><h3>卖盘</h3>{derived.asks.slice(0, 10).map((order) => <div className="book-row ask" key={order.id}><span>¤ {order.price}</span><span>{order.remaining}</span><small>{order.ownerName}</small></div>)}</div>
          </div>
        </Panel>

        <Panel className="widget market-chart-card">
          <WidgetHeading
            eyebrow="价格历史"
            title="近期成交曲线"
            action={<span className={derived.marketTrend >= 0 ? 'positive' : 'negative'}>{derived.marketTrend >= 0 ? '+' : ''}{derived.marketTrend}</span>}
          />
          <PriceSparkline values={derived.history} />
          <div className="chart-footer"><span>成交样本 {game.marketPriceHistory.length}</span><span>人口需求满足率 {Math.round(game.demand.satisfaction * 100)}%</span></div>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading eyebrow="设施挂牌" title="生产设施挂牌" action={<span className="muted">固定价格 · 即时产权交割</span>} />
          <div className="listing-grid">
            {game.facilityListings.map((listing) => (
              <article className="listing-card" key={listing.id}>
                <div>
                  <span className={listing.ownerId === game.userId ? 'status-chip status-listed' : 'status-chip'}>{listing.ownerId === game.userId ? '我的挂牌' : '可收购'}</span>
                  <h3>{listing.facility.name}</h3>
                  <p>{listing.ownerName} · 等级 {listing.facility.level}</p>
                </div>
                <div className="listing-specs">
                  <span>周期 {listing.facility.cycleMs / 1000} 秒</span><span>产量 {listing.facility.outputPerCycle}</span><span>运营费 ¤ {listing.facility.operatingCost}</span><span>容量 {listing.facility.internalCapacity}</span><span>累计产量 {listing.facility.lifetimeOutput}</span><span>参考估值 ¤ {listing.facility.systemValue}</span>
                </div>
                <div className="listing-price">
                  <strong>¤ {formatCurrency(listing.price)}</strong>
                  {listing.ownerId === game.userId
                    ? <button className="danger-button" onClick={() => cancelFacilityListing(listing.id)}>撤销</button>
                    : <button onClick={() => showResult(buyFacility(listing.id))}>立即收购</button>}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
