import { orderAssetId, orderKind, orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import { FactoryIcon } from '../components/icons/GameIcons';
import { ProductIconLabel } from '../components/icons/ProductIcons';
import {
  Button,
  DataList,
  DataRow,
  EmptyState,
  MetricCard,
  PageLayout,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { economyConstants } from '../config/economy';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';

function greetingForHour(hour: number) {
  if (hour < 5) return '凌晨好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function OverviewPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    derived,
    now,
    selectedProductId,
    setSelectedProductId,
    workRemaining,
    work,
    showResult,
    setTab,
    selectMarketAsset,
  } = model;
  const plannedGroups = game.facilityGroups.filter((group) => group.productionMode === 'target').length;
  const pendingPlans = game.facilityGroups.reduce((sum, group) => (
    group.productionMode === 'target' ? sum + Math.max(0, (group.targetQuantity || 0) - group.completedQuantity) : sum
  ), 0);
  const totalFacilities = game.facilityGroups.reduce((sum, group) => sum + group.count, 0);
  const pendingJoin = game.facilityGroups.reduce((sum, group) => sum + group.pendingJoinCount, 0);
  const greeting = greetingForHour(new Date(now).getHours());
  const ownOpenOrders = [...derived.ownOpenOrders].sort((left, right) => right.createdAt - left.createdAt);

  return (
    <PageLayout
      title={<>{greeting}，{game.playerName}</>}
      description="管理多商品产业链与工厂集群，并通过统一资产订单簿提高总资产排名。"
      actions={(
        <>
          <StatusTag>{`未完成订单 ${formatNumber(derived.ownOpenOrders.length)}/${formatNumber(economyConstants.maxOpenOrders)}`}</StatusTag>
          <Button onClick={() => setTab('market')}>进入市场</Button>
        </>
      )}
    >
      <div className="home-grid">
        <Panel className="widget work-widget">
          <WidgetHeading title="基础工作" action={<StatusTag tone="success">兜底收入</StatusTag>} />
          <p>每次有效工作获得 ¤1，工作冷却固定为 10 秒。</p>
          <Button block className="work-compact-button" disabled={workRemaining > 0} onClick={() => void showResult(work())}>
            <strong>{workRemaining > 0 ? formatDuration(workRemaining) : '开始工作'}</strong>
            <span>{workRemaining > 0 ? '等待冷却结束' : '获得 ¤ 1'}</span>
          </Button>
        </Panel>

        <Panel className="widget market-summary span-2">
          <WidgetHeading
            title={<ProductIconLabel productId={derived.selectedProduct.id}>{derived.selectedProduct.name}市场</ProductIconLabel>}
            action={(
              <label className="overview-market-select">
                <span>选择商品</span>
                <select
                  aria-label="选择概览商品市场"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                >
                  {game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
            )}
          />
          <div className="market-quote-grid">
            <MetricCard label="最近成交" value={`¤ ${formatCurrency(derived.selectedMarket.lastPrice)}`} />
            <MetricCard tone="success" label="最高买价" value={derived.bestBid ? `¤ ${formatCurrency(derived.bestBid)}` : '¤ --'} />
            <MetricCard tone="danger" label="最低卖价" value={derived.bestAsk ? `¤ ${formatCurrency(derived.bestAsk)}` : '¤ --'} />
            <MetricCard label="持仓" value={formatNumber(derived.selectedInventory.available)} detail={`冻结 ${formatNumber(derived.selectedInventory.frozen)}`} />
          </div>
          <PriceSparkline values={derived.history.slice(-24)} />
          <div className="overview-market-footer">
            <Button variant="text" onClick={() => selectMarketAsset('commodity', derived.selectedProduct.id)}>进入该商品市场 →</Button>
          </div>
        </Panel>

        <div className="overview-summary-row span-3">
          <Panel className="widget production-summary overview-summary-card">
            <WidgetHeading title="生产摘要" action={<Button variant="text" onClick={() => setTab('production')}>管理工厂</Button>} />
            <DataList>
              <DataRow label="工厂总数" value={formatNumber(totalFacilities)} tone="info" />
              <DataRow label="运行参与" value={formatNumber(derived.runningFacilities)} tone="success" />
              <DataRow label="停止工厂" value={formatNumber(derived.stoppedFacilities)} tone={derived.stoppedFacilities ? 'warning' : 'neutral'} />
              <DataRow label="下一周期加入" value={formatNumber(pendingJoin)} tone={pendingJoin ? 'warning' : 'neutral'} />
              <DataRow label="阻塞工厂" value={formatNumber(derived.blockedFacilities)} tone={derived.blockedFacilities ? 'danger' : 'neutral'} />
              <DataRow label="施工中的工厂" value={formatNumber(derived.constructingFacilities)} tone="warning" />
              <DataRow label="定量计划" value={`${formatNumber(plannedGroups)} 组 / 剩余 ${formatNumber(pendingPlans)}`} tone="info" />
              <DataRow label="共享仓库剩余" value={formatNumber(game.warehouseAvailableCapacity)} tone={game.warehouseAvailableCapacity > 0 ? 'success' : 'danger'} />
            </DataList>
          </Panel>

          <Panel className="widget wealth-summary overview-summary-card">
            <WidgetHeading title="财富构成" action={<StatusTag tone="warning">第 {derived.currentRank?.rank ?? '--'} 名</StatusTag>} />
            <MetricCard tone="success" className="wealth-total" label="当前总资产" value={`¤ ${formatCurrency(derived.totalAssets)}`} />
            <DataList className="compact">
              <DataRow label="现金资产" value={`¤ ${formatCurrency(derived.cashValue)}`} />
              <DataRow label="商品估值" value={`¤ ${formatCurrency(derived.commodityValue)}`} />
              <DataRow label="工厂估值" value={`¤ ${formatCurrency(derived.facilityValue)}`} />
            </DataList>
          </Panel>

          <Panel className="widget overview-summary-card overview-open-orders-card">
            <WidgetHeading
              title="当前挂单"
              action={<StatusTag>{formatNumber(ownOpenOrders.length)}/{formatNumber(economyConstants.maxOpenOrders)}</StatusTag>}
            />
            <div className="overview-open-orders-list">
              {ownOpenOrders.map((order) => {
                const assetId = orderAssetId(order);
                const facilityOrder = orderKind(order) === 'facility';
                const assetName = facilityOrder
                  ? game.facilityTypes.find((facility) => facility.id === assetId)?.name ?? assetId
                  : game.products.find((product) => product.id === assetId)?.name ?? assetId;
                return (
                  <div className="overview-open-order" key={order.id}>
                    <div className="overview-open-order-identity">
                      {facilityOrder ? (
                        <span className="overview-facility-label"><FactoryIcon /><strong>{assetName}</strong></span>
                      ) : (
                        <ProductIconLabel productId={assetId}>{assetName}</ProductIconLabel>
                      )}
                      <small>{facilityOrder ? '工厂' : '商品'} · {formatTime(order.createdAt)}</small>
                    </div>
                    <div className="overview-open-order-values">
                      <StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag>
                      <strong>¤ {formatCurrency(order.price)}</strong>
                      <small>{formatNumber(order.remaining)}/{formatNumber(order.quantity)} · {orderStatusNames[order.status]}</small>
                    </div>
                  </div>
                );
              })}
              {ownOpenOrders.length === 0 ? <EmptyState>当前没有未完成订单。</EmptyState> : null}
            </div>
            <Button variant="text" className="overview-open-orders-action" onClick={() => setTab('market')}>管理订单 →</Button>
          </Panel>
        </div>
      </div>
    </PageLayout>
  );
}
