import { useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { ProductIconLabel } from '../components/icons/ProductIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
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
import { VirtualList } from '../components/ui/VirtualList';
import type { AssetEvent, AssetEventCategory } from '../types';
import { formatCurrency, formatNumber, formatTime } from '../utils/formatters';

type AssetEventFilter = 'all' | 'cash' | 'inventory' | 'warehouse' | 'facility' | 'production' | 'order';

const eventCategoryNames: Record<AssetEventCategory, string> = {
  work: '工作',
  order: '订单',
  trade: '交易',
  inventory: '商品',
  warehouse: '仓库',
  facility: '工厂',
  production: '生产',
  system: '系统',
};

const eventFilters: Array<{ id: AssetEventFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'cash', label: '资金' },
  { id: 'inventory', label: '商品' },
  { id: 'warehouse', label: '仓库' },
  { id: 'facility', label: '工厂' },
  { id: 'production', label: '生产' },
  { id: 'order', label: '订单冻结' },
];

const facilityActionNames: Record<string, string> = {
  construction_started: '开始施工',
  construction_completed: '施工完成',
  acquired: '数量增加',
  sold: '数量减少',
  listed: '挂牌',
  unlisted: '撤销挂牌',
  recipe_updated: '配方修改',
  started: '统一启动',
  stopped: '统一停止',
  status_changed: '状态变化',
  removed: '集群移除',
  updated: '集群更新',
};

function signedCurrency(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : undefined;
  return <CurrencyAmount sign={sign}>{formatCurrency(Math.abs(value))}</CurrencyAmount>;
}

function signedQuantity(value: number) {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatNumber(Math.abs(value))}`;
}

function matchesFilter(event: AssetEvent, filter: AssetEventFilter) {
  if (filter === 'all') return true;
  if (filter === 'cash') return Boolean(event.cashDelta || event.frozenCashDelta || ['work', 'trade'].includes(event.category));
  if (filter === 'inventory') return event.inventoryChanges.length > 0 || event.category === 'inventory';
  if (filter === 'warehouse') return Boolean(event.warehouseChange) || event.category === 'warehouse';
  if (filter === 'facility') return event.facilityChanges.length > 0 || event.category === 'facility';
  if (filter === 'production') return event.productionChanges.length > 0 || event.category === 'production';
  return event.category === 'order';
}

export function AssetsPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    derived,
    localAssetEvents,
    clearLocalActivity,
    cashShare,
    commodityShare,
    facilityShare,
    allocationStyle,
  } = model;
  const [eventFilter, setEventFilter] = useState<AssetEventFilter>('all');
  const frozenInventory = Object.values(game.inventories).reduce((sum, inventory) => sum + inventory.frozen, 0);
  const totalFacilities = game.facilityGroups.reduce((sum, group) => sum + group.count, 0);
  const filteredEvents = useMemo(
    () => localAssetEvents.filter((event) => matchesFilter(event, eventFilter)),
    [eventFilter, localAssetEvents],
  );

  function productName(productId?: string) {
    if (!productId) return '商品';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
  }

  return (
    <PageLayout
      title="资产"
      description="查看现金、商品、工厂资产与当前浏览器中的资产变化记录。"
    >
      <div className="funds-summary-grid">
        <MetricCard label="可用资金" value={<CurrencyAmount>{formatCurrency(game.credits)}</CurrencyAmount>} tone="success" />
        <MetricCard label="冻结资金" value={<CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount>} detail="用于未完成买单" tone="warning" />
        <MetricCard label="当前总资产" value={<CurrencyAmount>{formatCurrency(derived.totalAssets)}</CurrencyAmount>} tone="success" />
        <MetricCard label="商品资产" value={<CurrencyAmount>{formatCurrency(derived.commodityValue)}</CurrencyAmount>} detail={`冻结商品 ${formatNumber(frozenInventory)}`} />
        <MetricCard label="工厂资产" value={<CurrencyAmount>{formatCurrency(derived.facilityValue)}</CurrencyAmount>} detail={`${formatNumber(totalFacilities)} 座工厂`} tone="info" />
      </div>

      <div className="asset-overview-grid">
        <Panel className="widget allocation-card">
          <WidgetHeading title="资产配置" action={<strong><CurrencyAmount>{formatCurrency(derived.totalAssets)}</CurrencyAmount></strong>} />
          <div className="allocation-visual" style={allocationStyle}><div><strong>{cashShare}%</strong><span>现金占比</span></div></div>
          <div className="allocation-legend">
            <span><i className="cash-dot" />现金 <strong>{cashShare}%</strong></span>
            <span><i className="commodity-dot" />商品 <strong>{commodityShare}%</strong></span>
            <span><i className="facility-dot" />工厂 <strong>{facilityShare}%</strong></span>
          </div>
        </Panel>

        <Panel className="widget asset-breakdown span-2">
          <WidgetHeading title="资产估值明细" action={<span className="muted">商品和工厂均按订单簿最高有效买入价估值</span>} />
          <div className="asset-card-grid">
            <MetricCard label="可用现金" value={<CurrencyAmount>{formatCurrency(game.credits)}</CurrencyAmount>} detail="可用于建设、运营和交易" tone="success" />
            <MetricCard label="冻结资金" value={<CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount>} detail="未成交买单的服务器冻结额" tone="warning" />
            <MetricCard
              label="全部商品估值"
              value={<CurrencyAmount>{formatCurrency(derived.commodityValue)}</CurrencyAmount>}
              detail={`可用与冻结商品合计 ${formatNumber(game.warehouseStoredQuantity)}`}
            />
            <MetricCard label="工厂资产估值" value={<CurrencyAmount>{formatCurrency(derived.facilityValue)}</CurrencyAmount>} detail={`${formatNumber(totalFacilities)} 座，按各类型最高有效买价计算`} tone="info" />
          </div>
        </Panel>

        <Panel className="widget span-3 asset-event-panel">
          <WidgetHeading
            title="本地资产变动"
            action={
              <div className="ui-inline-actions">
                <StatusTag>{formatNumber(localAssetEvents.length)} 条</StatusTag>
                <Button variant="compact" onClick={clearLocalActivity} disabled={localAssetEvents.length === 0}>清除本地记录</Button>
              </div>
            }
          />
          <p className="ui-helper-text">这些记录不上传服务器。更换设备、无痕模式或清除网站数据后不会恢复。</p>
          <div className="asset-event-filters" role="group" aria-label="筛选资产变动">
            {eventFilters.map((filter) => (
              <Button
                key={filter.id}
                variant="text"
                className={eventFilter === filter.id ? 'active' : ''}
                aria-pressed={eventFilter === filter.id}
                onClick={() => setEventFilter(filter.id)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          <VirtualList
            key={eventFilter}
            items={filteredEvents}
            getKey={(event) => event.id}
            estimateSize={190}
            viewportHeight={720}
            minViewportHeight={128}
            overscan={3}
            gap={8}
            className="asset-event-virtual-list"
            ariaLabel="本地资产变动列表"
            empty={<EmptyState>当前浏览器在该筛选条件下暂无资产变化。</EmptyState>}
            renderItem={(event) => (
              <article className="asset-event-card">
                <header>
                  <div>
                    <strong>{event.description}</strong>
                    <small>{formatTime(event.createdAt)} · 本地记录</small>
                  </div>
                  <StatusTag
                    tone={event.category === 'trade'
                      ? 'success'
                      : event.category === 'order'
                        ? 'warning'
                        : event.category === 'warehouse'
                          ? 'info'
                          : 'neutral'}
                  >
                    {eventCategoryNames[event.category]}
                  </StatusTag>
                </header>

                <div className="asset-event-changes">
                  {event.cashDelta ? (
                    <span className={event.cashDelta > 0 ? 'positive' : 'negative'}>
                      可用资金 <strong>{signedCurrency(event.cashDelta)}</strong>
                      <small>余额 <CurrencyAmount>{formatCurrency(event.availableCashAfter)}</CurrencyAmount></small>
                    </span>
                  ) : null}
                  {event.frozenCashDelta ? (
                    <span className={event.frozenCashDelta > 0 ? 'negative' : 'positive'}>
                      冻结资金 <strong>{signedCurrency(event.frozenCashDelta)}</strong>
                      <small>冻结后 <CurrencyAmount>{formatCurrency(event.frozenCashAfter ?? 0)}</CurrencyAmount></small>
                    </span>
                  ) : null}
                  {event.inventoryChanges.map((change) => (
                    <span key={`${event.id}-${change.productId}`}>
                      <ProductIconLabel productId={change.productId}>{productName(change.productId)}</ProductIconLabel>
                      <strong>
                        {change.availableDelta ? `可用 ${signedQuantity(change.availableDelta)}` : ''}
                        {change.availableDelta && change.frozenDelta ? ' · ' : ''}
                        {change.frozenDelta ? `冻结 ${signedQuantity(change.frozenDelta)}` : ''}
                      </strong>
                      <small>当前 {formatNumber(change.availableAfter)} · 冻结 {formatNumber(change.frozenAfter)}</small>
                    </span>
                  ))}
                  {event.warehouseChange ? (
                    <span>
                      共享仓库
                      <strong>等级 {formatNumber(event.warehouseChange.beforeLevel)} → {formatNumber(event.warehouseChange.afterLevel)}</strong>
                      <small>
                        容量 {formatNumber(event.warehouseChange.beforeCapacity)} → {formatNumber(event.warehouseChange.afterCapacity)}
                        {event.warehouseChange.capacityDelta ? ` · ${signedQuantity(event.warehouseChange.capacityDelta)}` : ''}
                      </small>
                    </span>
                  ) : null}
                  {event.facilityChanges.map((change) => (
                    <span key={`${event.id}-${change.facilityTypeId}-${change.action}`}>
                      工厂集群 <strong>{change.facilityName ?? change.facilityTypeId}</strong>
                      <small>
                        {facilityActionNames[change.action] ?? change.action}
                        {change.countDelta ? ` · 数量 ${signedQuantity(change.countDelta)}` : ''}
                        {change.afterStatus ? ` · ${change.afterStatus}` : ''}
                      </small>
                    </span>
                  ))}
                  {event.productionChanges.map((change) => (
                    <span key={`${event.id}-${change.facilityTypeId}-${change.action}`}>
                      <ProductIconLabel productId={change.output.productId}>{productName(change.output.productId)}</ProductIconLabel>
                      <strong>{change.facilityName ?? '生产'} · 产出入仓 {formatNumber(change.output.quantity)}</strong>
                      <small>
                        {change.inputs.length > 0
                          ? `消耗 ${change.inputs.map((item) => `${formatNumber(item.quantity)} ${productName(item.productId)}`).join(' + ')} · `
                          : ''}
                        已直接进入共享仓库
                      </small>
                    </span>
                  ))}
                  {!event.cashDelta
                    && !event.frozenCashDelta
                    && !event.inventoryChanges.length
                    && !event.warehouseChange
                    && !event.facilityChanges.length
                    && !event.productionChanges.length ? <span><strong>状态已更新</strong></span> : null}
                </div>
              </article>
            )}
          />
        </Panel>
      </div>
    </PageLayout>
  );
}
