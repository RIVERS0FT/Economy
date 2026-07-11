import { useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
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
import type { AssetEvent, AssetEventCategory } from '../types';
import { formatCurrency, formatTime } from '../utils/formatters';

type AssetEventFilter = 'all' | 'cash' | 'inventory' | 'facility' | 'production' | 'order';

const eventCategoryNames: Record<AssetEventCategory, string> = {
  work: '工作',
  order: '订单',
  trade: '交易',
  inventory: '商品',
  facility: '工厂',
  production: '生产',
  system: '系统',
};

const eventFilters: Array<{ id: AssetEventFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'cash', label: '资金' },
  { id: 'inventory', label: '商品' },
  { id: 'facility', label: '工厂' },
  { id: 'production', label: '生产' },
  { id: 'order', label: '订单冻结' },
];

function signedCurrency(value: number) {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}¤ ${formatCurrency(Math.abs(value))}`;
}

function signedQuantity(value: number) {
  return `${value > 0 ? '+' : ''}${value}`;
}

function matchesFilter(event: AssetEvent, filter: AssetEventFilter) {
  if (filter === 'all') return true;
  if (filter === 'cash') return Boolean(event.cashDelta || event.frozenCashDelta || ['work', 'trade'].includes(event.category));
  if (filter === 'inventory') return (event.inventoryChanges ?? []).length > 0 || event.category === 'inventory';
  if (filter === 'facility') return (event.facilityChanges ?? []).length > 0 || event.category === 'facility';
  if (filter === 'production') return (event.productionChanges ?? []).length > 0 || event.category === 'production';
  return event.category === 'order';
}

export function AssetsPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    derived,
    cashShare,
    commodityShare,
    facilityShare,
    allocationStyle,
    inventoryUsed,
    setSelectedProductId,
    setTab,
  } = model;
  const [eventFilter, setEventFilter] = useState<AssetEventFilter>('all');
  const frozenInventory = Object.values(game.inventories).reduce((sum, inventory) => sum + inventory.frozen, 0);
  const filteredEvents = useMemo(
    () => game.assetEvents.filter((event) => matchesFilter(event, eventFilter)),
    [eventFilter, game.assetEvents],
  );

  function productName(productId?: string) {
    if (!productId) return '商品';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
  }

  return (
    <PageLayout
      title="资金与资产"
      description="统一查看现金、冻结资产、商品、工厂估值，以及每次服务器事务产生的复合资产变化。"
    >
      <div className="funds-summary-grid">
        <MetricCard label="可用资金" value={`¤ ${formatCurrency(game.credits)}`} tone="success" />
        <MetricCard label="冻结资金" value={`¤ ${formatCurrency(game.frozenCredits)}`} detail="用于未完成买单" tone="warning" />
        <MetricCard label="当前总资产" value={`¤ ${formatCurrency(derived.totalAssets)}`} tone="success" />
        <MetricCard label="商品资产" value={`¤ ${formatCurrency(derived.commodityValue)}`} detail={`冻结商品 ${frozenInventory}`} />
        <MetricCard label="工厂资产" value={`¤ ${formatCurrency(derived.facilityValue)}`} detail={`${game.facilities.length} 座工厂`} tone="info" />
        <MetricCard label="仓库使用" value={`${inventoryUsed}/${game.inventoryCapacity}`} />
      </div>

      <div className="asset-overview-grid">
        <Panel className="widget allocation-card">
          <WidgetHeading title="资产配置" action={<strong>¤ {formatCurrency(derived.totalAssets)}</strong>} />
          <div className="allocation-visual" style={allocationStyle}><div><strong>{cashShare}%</strong><span>现金占比</span></div></div>
          <div className="allocation-legend">
            <span><i className="cash-dot" />现金 <strong>{cashShare}%</strong></span>
            <span><i className="commodity-dot" />商品 <strong>{commodityShare}%</strong></span>
            <span><i className="facility-dot" />工厂 <strong>{facilityShare}%</strong></span>
          </div>
        </Panel>

        <Panel className="widget asset-breakdown span-2">
          <WidgetHeading title="资产估值明细" action={<span className="muted">按各商品最近成交价和工厂系统估值计算</span>} />
          <div className="asset-card-grid">
            <MetricCard label="可用现金" value={`¤ ${formatCurrency(game.credits)}`} detail="可用于建设、运营和交易" tone="success" />
            <MetricCard label="冻结资金" value={`¤ ${formatCurrency(game.frozenCredits)}`} detail="未成交买单的服务器冻结额" tone="warning" />
            <MetricCard label="全部商品估值" value={`¤ ${formatCurrency(derived.commodityValue)}`} detail={`仓库 ${inventoryUsed}/${game.inventoryCapacity}`} />
            <MetricCard label="工厂资产估值" value={`¤ ${formatCurrency(derived.facilityValue)}`} detail={`${game.facilities.length} 座工厂及内部产成品`} tone="info" />
          </div>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading title="商品库存与估值" action={<span className="muted">点击商品进入对应市场</span>} />
          <div className="product-asset-grid">
            {game.products.map((product) => {
              const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
              const price = game.markets[product.id]?.lastPrice ?? product.basePrice;
              const value = (inventory.available + inventory.frozen) * price;
              return (
                <button
                  type="button"
                  className="product-asset-card"
                  key={product.id}
                  onClick={() => {
                    setSelectedProductId(product.id);
                    setTab('market');
                  }}
                >
                  <span>{product.name}</span>
                  <strong>¤ {formatCurrency(value)}</strong>
                  <small>可用 {inventory.available} · 冻结 {inventory.frozen} · 参考价 ¤ {price}</small>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="widget">
          <WidgetHeading title="货币发行与回收" />
          <DataList>
            <DataRow label="工作发行" value={`+¤ ${game.stats.workIssued}`} tone="success" />
            <DataRow label="需求发行" value={`+¤ ${game.stats.populationIssued}`} tone="success" />
            <DataRow label="系统回收" value={`-¤ ${game.stats.systemSinks}`} tone="danger" />
            <DataRow label="当前净变化" value={`¤ ${formatCurrency(game.stats.workIssued + game.stats.populationIssued - game.stats.systemSinks)}`} />
          </DataList>
        </Panel>

        <Panel className="widget span-2 asset-event-panel">
          <WidgetHeading title="资金与资产变动" action={<StatusTag>{game.assetEvents.length} 条</StatusTag>} />
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

          <div className="asset-event-list">
            {filteredEvents.map((event) => (
              <article className="asset-event-card" key={event.id}>
                <header>
                  <div>
                    <strong>{event.description}</strong>
                    <small>{formatTime(event.createdAt)}{event.legacy ? ' · 历史流水迁移' : ''}</small>
                  </div>
                  <StatusTag tone={event.category === 'trade' ? 'success' : event.category === 'order' ? 'warning' : 'neutral'}>
                    {eventCategoryNames[event.category]}
                  </StatusTag>
                </header>

                <div className="asset-event-changes">
                  {event.cashDelta ? (
                    <span className={event.cashDelta > 0 ? 'positive' : 'negative'}>
                      可用资金 <strong>{signedCurrency(event.cashDelta)}</strong>
                      <small>余额 ¤ {formatCurrency(event.availableCashAfter)}</small>
                    </span>
                  ) : null}
                  {event.frozenCashDelta ? (
                    <span className={event.frozenCashDelta > 0 ? 'negative' : 'positive'}>
                      冻结资金 <strong>{signedCurrency(event.frozenCashDelta)}</strong>
                      <small>冻结后 ¤ {formatCurrency(event.frozenCashAfter ?? 0)}</small>
                    </span>
                  ) : null}
                  {(event.inventoryChanges ?? []).map((change) => (
                    <span key={`${event.id}-${change.productId}`}>
                      {productName(change.productId)}
                      <strong>
                        {change.availableDelta ? `可用 ${signedQuantity(change.availableDelta)}` : ''}
                        {change.availableDelta && change.frozenDelta ? ' · ' : ''}
                        {change.frozenDelta ? `冻结 ${signedQuantity(change.frozenDelta)}` : ''}
                      </strong>
                      <small>当前 {change.availableAfter} · 冻结 {change.frozenAfter}</small>
                    </span>
                  ))}
                  {(event.facilityChanges ?? []).map((change) => (
                    <span key={`${event.id}-${change.facilityId}-${change.action}`}>
                      工厂 <strong>{change.facilityName ?? change.facilityId}</strong>
                      <small>{change.action}{change.afterStatus ? ` · ${change.afterStatus}` : ''}</small>
                    </span>
                  ))}
                  {(event.productionChanges ?? []).map((change) => (
                    <span key={`${event.id}-${change.facilityId}-${change.action}`}>
                      {change.facilityName ?? '生产'}
                      <strong>
                        {change.action === 'collected' ? '领取' : '产出'} {change.outputQuantity} {productName(change.outputProductId)}
                      </strong>
                      <small>{change.inputQuantity > 0 ? `消耗 ${change.inputQuantity} ${productName(change.inputProductId)} · ` : ''}内部变化 {signedQuantity(change.internalGoodsDelta)}</small>
                    </span>
                  ))}
                  {!event.cashDelta
                    && !event.frozenCashDelta
                    && !(event.inventoryChanges ?? []).length
                    && !(event.facilityChanges ?? []).length
                    && !(event.productionChanges ?? []).length ? <span><strong>状态已更新</strong></span> : null}
                </div>
              </article>
            ))}
            {filteredEvents.length === 0 ? <EmptyState>当前筛选条件下暂无资产变化。</EmptyState> : null}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}