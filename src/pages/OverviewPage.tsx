import { useMemo, type ReactNode } from 'react';
import {
  facilityStatusReasonNames,
  orderAssetId,
  orderKind,
  orderStatusNames,
  type LoadedGameViewModel,
} from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import { FactoryIcon } from '../components/icons/GameIcons';
import { ProductIconLabel } from '../components/icons/ProductIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import {
  Button,
  DataList,
  DataRow,
  EmptyState,
  PageLayout,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';
import { buildMarketHistoryBuckets, summarizeMarketFlow } from '../utils/marketHistory';

function greetingForHour(hour: number) {
  if (hour < 5) return '凌晨好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

type OverviewPageProps = {
  model: LoadedGameViewModel;
  overviewProductId: string;
  onOverviewProductChange: (productId: string) => void;
};

type OverviewAlert = {
  id: string;
  tone: 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
};

function OverviewMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  return (
    <div className={`overview-metric overview-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function OverviewPage({ model, overviewProductId, onOverviewProductChange }: OverviewPageProps) {
  const {
    game,
    derived,
    localAssetEvents,
    now,
    workRemaining,
    isWorking,
    work,
    showResult,
    setTab,
    selectMarketAsset,
  } = model;
  const pendingRecipeChanges = game.facilityGroups.filter((group) => Boolean(group.pendingRecipeId)).length;
  const totalFacilities = game.facilityGroups.reduce((sum, group) => sum + group.count, 0);
  const pendingJoin = game.facilityGroups.reduce((sum, group) => sum + group.pendingJoinCount, 0);
  const greeting = greetingForHour(new Date(now).getHours());
  const ownOpenOrders = [...derived.ownOpenOrders].sort((left, right) => right.createdAt - left.createdAt);
  const buyOrderCount = ownOpenOrders.filter((order) => order.side === 'buy').length;
  const sellOrderCount = ownOpenOrders.length - buyOrderCount;

  const theoreticalDailyOutput = useMemo(() => game.facilityGroups.reduce((sum, group) => {
    if (group.status !== 'running' || group.participatingCount <= 0) return sum;
    const facilityType = game.facilityTypes.find((item) => item.id === group.facilityTypeId);
    const recipe = facilityType?.recipes.find((item) => item.id === group.activeRecipeId)
      ?? facilityType?.recipes[0];
    if (!recipe || recipe.cycleMs <= 0) return sum;
    return sum + Math.floor((86_400_000 / recipe.cycleMs) * recipe.output.quantity * group.participatingCount);
  }, 0), [game.facilityGroups, game.facilityTypes]);

  const overviewMarket = useMemo(() => {
    const product = game.products.find((item) => item.id === overviewProductId) ?? game.products[0];
    if (!product) return null;

    const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
    const market = game.markets[product.id];
    const lastPrice = market?.lastPrice ?? product.basePrice;
    const history = market?.priceHistory ?? [];
    const buckets = buildMarketHistoryBuckets(history, lastPrice, now);
    let bestBid = 0;
    let bestAsk = 0;

    for (const order of game.orders) {
      if (!['open', 'partial'].includes(order.status)) continue;
      if (orderKind(order) !== 'commodity' || orderAssetId(order) !== product.id) continue;
      if (order.side === 'buy') bestBid = Math.max(bestBid, order.price);
      else if (!bestAsk || order.price < bestAsk) bestAsk = order.price;
    }

    return {
      product,
      inventory,
      lastPrice,
      buckets,
      flow: summarizeMarketFlow(buckets),
      bestBid,
      bestAsk,
      hasMarketActivity: history.length > 0 || bestBid > 0 || bestAsk > 0,
    };
  }, [game, now, overviewProductId]);

  const businessAlerts = useMemo(() => {
    const alerts: OverviewAlert[] = [];
    const productionAction = () => setTab('production');

    if (game.warehouseAvailableCapacity <= 0) {
      alerts.push({
        id: 'warehouse-full',
        tone: 'danger',
        title: '共享仓库已满',
        detail: '生产无法继续入库，请扩容、出售库存或取消占用容量的买单。',
        actionLabel: '处理仓库',
        onAction: productionAction,
      });
    } else if (game.warehouseAvailableCapacity <= Math.max(25, Math.ceil(game.inventoryCapacity * 0.1))) {
      alerts.push({
        id: 'warehouse-low',
        tone: 'warning',
        title: '共享仓库空间偏低',
        detail: `当前仅剩 ${formatNumber(game.warehouseAvailableCapacity)} 容量，建议提前处理库存。`,
        actionLabel: '查看仓库',
        onAction: productionAction,
      });
    }

    for (const group of game.facilityGroups.filter((item) => item.status === 'error').slice(0, 2)) {
      const facilityName = game.facilityTypes.find((item) => item.id === group.facilityTypeId)?.name ?? group.facilityTypeId;
      alerts.push({
        id: `facility-error-${group.facilityTypeId}`,
        tone: 'danger',
        title: `${facilityName}生产受阻`,
        detail: facilityStatusReasonNames[group.statusReason ?? 'maintenance'],
        actionLabel: '管理工厂',
        onAction: productionAction,
      });
    }

    if (ownOpenOrders.length > 0) {
      alerts.push({
        id: 'open-orders',
        tone: 'info',
        title: `有 ${formatNumber(ownOpenOrders.length)} 笔挂单等待处理`,
        detail: `买单 ${formatNumber(buyOrderCount)} 笔，卖单 ${formatNumber(sellOrderCount)} 笔。`,
        actionLabel: '管理订单',
        onAction: () => setTab('market'),
      });
    }

    if (derived.stoppedFacilities > 0) {
      alerts.push({
        id: 'stopped-facilities',
        tone: 'warning',
        title: `${formatNumber(derived.stoppedFacilities)} 座工厂处于停止状态`,
        detail: '确认是否需要恢复生产，或继续保留为主动停工。',
        actionLabel: '查看工厂',
        onAction: productionAction,
      });
    }

    if (game.facilityConstruction) {
      const facilityName = game.facilityTypes.find((item) => item.id === game.facilityConstruction?.facilityTypeId)?.name ?? '工厂';
      alerts.push({
        id: 'facility-construction',
        tone: 'info',
        title: `${facilityName}正在施工`,
        detail: `预计 ${formatDuration(Math.max(0, game.facilityConstruction.completesAt - now))} 后完成。`,
        actionLabel: '查看施工',
        onAction: productionAction,
      });
    }

    return alerts;
  }, [buyOrderCount, derived.stoppedFacilities, game, now, ownOpenOrders.length, sellOrderCount, setTab]);

  const visibleAlerts = businessAlerts.slice(0, 3);
  const primaryAction = ownOpenOrders.length > 0
    ? { label: '处理订单', onClick: () => setTab('market') }
    : businessAlerts.some((alert) => alert.id !== 'open-orders')
      ? { label: '查看经营提醒', onClick: () => setTab('production') }
      : { label: '进入市场', onClick: () => setTab('market') };

  const recentAssetEvents = useMemo(() => localAssetEvents
    .filter((event) => event.createdAt >= now - 7 * 86_400_000)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 3), [localAssetEvents, now]);

  return (
    <PageLayout
      title={<>{greeting}，{game.playerName}</>}
      description="优先处理生产、仓库与订单提醒，再根据市场快照调整经营决策。"
      actions={(
        <>
          <StatusTag tone={businessAlerts.length > 0 ? 'warning' : 'success'}>
            {businessAlerts.length > 0 ? `待处理事项 ${formatNumber(businessAlerts.length)}` : '经营状态正常'}
          </StatusTag>
          <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
        </>
      )}
    >
      <div className="home-grid">
        <div className="overview-primary-grid">
          <Panel className="widget overview-today-panel">
            <WidgetHeading
              title="今日经营"
              action={<StatusTag tone="success">工作收益 <CurrencyAmount>{formatCurrency(1)}</CurrencyAmount></StatusTag>}
            />
            <div className="overview-work-strip">
              <div className="overview-work-copy">
                <strong>基础工作</strong>
                <span>固定 10s 冷却，为产业调整提供兜底资金。</span>
              </div>
              <Button
                variant="secondary"
                className="overview-work-button"
                disabled={isWorking || workRemaining > 0}
                onClick={() => void showResult(work())}
              >
                {isWorking ? '处理中…' : workRemaining > 0 ? formatDuration(workRemaining) : '开始工作'}
              </Button>
            </div>

            <div className="overview-alert-heading">
              <div>
                <strong>经营提醒</strong>
                <span>按仓库、生产、订单和停工优先级排列</span>
              </div>
              <StatusTag tone={businessAlerts.length > 0 ? 'warning' : 'success'}>{formatNumber(businessAlerts.length)}</StatusTag>
            </div>
            <div className="overview-alert-list">
              {visibleAlerts.map((alert) => (
                <div className={`overview-alert overview-alert--${alert.tone}`} key={alert.id}>
                  <div>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </div>
                  <Button variant="text" onClick={alert.onAction}>{alert.actionLabel} →</Button>
                </div>
              ))}
              {visibleAlerts.length === 0 ? (
                <EmptyState className="overview-alert-empty">当前没有需要立即处理的经营异常。</EmptyState>
              ) : null}
            </div>
          </Panel>

          <Panel className="widget market-summary">
            <WidgetHeading
              title={overviewMarket
                ? <ProductIconLabel productId={overviewMarket.product.id}>{overviewMarket.product.name}市场</ProductIconLabel>
                : '商品市场'}
              action={(
                <label className="overview-market-select">
                  <span>选择商品</span>
                  <select
                    aria-label="选择概览商品市场"
                    value={overviewMarket?.product.id ?? ''}
                    disabled={game.products.length === 0}
                    onChange={(event) => onOverviewProductChange(event.target.value)}
                  >
                    {game.products.length > 0
                      ? game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)
                      : <option value="">暂无商品</option>}
                  </select>
                </label>
              )}
            />
            {overviewMarket ? (
              <>
                <div className="overview-market-metrics">
                  <OverviewMetric label="最近成交" value={<CurrencyAmount>{formatCurrency(overviewMarket.lastPrice)}</CurrencyAmount>} />
                  <OverviewMetric
                    tone="success"
                    label="最高买价"
                    value={overviewMarket.bestBid ? <CurrencyAmount>{formatCurrency(overviewMarket.bestBid)}</CurrencyAmount> : '暂无'}
                  />
                  <OverviewMetric
                    tone="danger"
                    label="最低卖价"
                    value={overviewMarket.bestAsk ? <CurrencyAmount>{formatCurrency(overviewMarket.bestAsk)}</CurrencyAmount> : '暂无'}
                  />
                  <OverviewMetric
                    label="当前持仓"
                    value={formatNumber(overviewMarket.inventory.available)}
                    detail={`冻结 ${formatNumber(overviewMarket.inventory.frozen)}`}
                  />
                </div>
                {overviewMarket.hasMarketActivity ? (
                  <>
                    <PriceSparkline buckets={overviewMarket.buckets} variant="compact" />
                    <div className="overview-market-footer">
                      <small>{overviewMarket.flow.netVolume > 0
                        ? `↑ 24h 净主动买入 ${formatNumber(overviewMarket.flow.netVolume)}`
                        : overviewMarket.flow.netVolume < 0
                          ? `↓ 24h 净主动卖出 ${formatNumber(Math.abs(overviewMarket.flow.netVolume))}`
                          : '→ 24h 主动买卖均衡／方向未知'}</small>
                      <Button variant="text" onClick={() => selectMarketAsset('commodity', overviewMarket.product.id)}>打开该商品市场 →</Button>
                    </div>
                  </>
                ) : (
                  <div className="overview-market-empty" data-testid="overview-market-empty">
                    <div>
                      <strong>暂无有效挂单或近期成交</strong>
                      <span>当前参考价：<CurrencyAmount>{formatCurrency(overviewMarket.lastPrice)}</CurrencyAmount></span>
                      <small>建立第一笔买单或卖单后，这里将展示近 24h 价格与成交量趋势。</small>
                    </div>
                    <Button variant="secondary" onClick={() => selectMarketAsset('commodity', overviewMarket.product.id)}>前往该商品市场</Button>
                  </div>
                )}
              </>
            ) : <EmptyState>服务器当前没有可展示的商品。</EmptyState>}
          </Panel>
        </div>

        <div className="overview-summary-row">
          <Panel className="widget production-summary overview-summary-card">
            <WidgetHeading title="生产摘要" action={<Button variant="text" onClick={() => setTab('production')}>管理工厂</Button>} />
            <DataList className="compact overview-core-data">
              <DataRow label="工厂总数" value={formatNumber(totalFacilities)} tone="info" />
              <DataRow label="正在运行" value={formatNumber(derived.runningFacilities)} tone="success" />
              <DataRow label="生产受阻" value={formatNumber(derived.blockedFacilities)} tone={derived.blockedFacilities ? 'danger' : 'neutral'} />
              <DataRow label="主动停工" value={formatNumber(derived.stoppedFacilities)} tone={derived.stoppedFacilities ? 'warning' : 'neutral'} />
              <DataRow label="理论日产量" value={formatNumber(theoreticalDailyOutput)} tone="info" />
            </DataList>
            <div className="overview-production-footnote">
              <span>施工 {formatNumber(derived.constructingFacilities)}</span>
              <span>下一周期加入 {formatNumber(pendingJoin)}</span>
              <span>待改种 {formatNumber(pendingRecipeChanges)} 组</span>
            </div>
          </Panel>

          <Panel className="widget overview-summary-card overview-assets-card">
            <WidgetHeading title="资产构成" action={<Button variant="text" onClick={() => setTab('assets')}>查看资产</Button>} />
            <DataList className="compact overview-core-data">
              <DataRow label="现金资产" value={<CurrencyAmount>{formatCurrency(derived.cashValue)}</CurrencyAmount>} />
              <DataRow label="商品估值" value={<CurrencyAmount>{formatCurrency(derived.commodityValue)}</CurrencyAmount>} />
              <DataRow label="工厂估值" value={<CurrencyAmount>{formatCurrency(derived.facilityValue)}</CurrencyAmount>} />
              <DataRow label="冻结资金" value={<CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount>} tone={game.frozenCredits > 0 ? 'warning' : 'neutral'} />
            </DataList>
            <div className="overview-subsection-heading">
              <strong>本周资金变化</strong>
              <span>当前浏览器记录</span>
            </div>
            <div className="overview-asset-events">
              {recentAssetEvents.map((event) => (
                <div key={event.id}>
                  <span><strong>{event.description}</strong><small>{formatTime(event.createdAt)}</small></span>
                  {event.cashDelta !== 0 ? (
                    <CurrencyAmount className={event.cashDelta > 0 ? 'positive' : 'negative'} sign={event.cashDelta > 0 ? '+' : undefined}>
                      {formatCurrency(event.cashDelta)}
                    </CurrencyAmount>
                  ) : <small>资产状态更新</small>}
                </div>
              ))}
              {recentAssetEvents.length === 0 ? <EmptyState className="overview-compact-empty">本周暂无本地资金变化记录。</EmptyState> : null}
            </div>
          </Panel>

          <Panel className="widget overview-summary-card overview-open-orders-card">
            <WidgetHeading title="当前挂单" action={<Button variant="text" onClick={() => setTab('market')}>管理订单</Button>} />
            <DataList className="compact overview-order-summary">
              <DataRow label="买单" value={`${formatNumber(buyOrderCount)} 笔`} tone={buyOrderCount ? 'success' : 'neutral'} />
              <DataRow label="卖单" value={`${formatNumber(sellOrderCount)} 笔`} tone={sellOrderCount ? 'danger' : 'neutral'} />
              <DataRow label="冻结资金" value={<CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount>} tone={game.frozenCredits ? 'warning' : 'neutral'} />
            </DataList>
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
                      <strong><CurrencyAmount>{formatCurrency(order.price)}</CurrencyAmount></strong>
                      <small>{formatNumber(order.remaining)}/{formatNumber(order.quantity)} · {orderStatusNames[order.status]}</small>
                    </div>
                  </div>
                );
              })}
              {ownOpenOrders.length === 0 ? <EmptyState className="overview-compact-empty">当前没有未完成订单。</EmptyState> : null}
            </div>
          </Panel>
        </div>
      </div>
    </PageLayout>
  );
}
