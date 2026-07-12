import { useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { Button, Panel, StatusTag, WidgetHeading } from '../ui/layout';
import { formatCurrency } from '../../utils/formatters';

type WarehouseContentFilter = 'stocked' | 'all';

export function WarehouseUpgradeCard({
  model,
  className = '',
  compact = false,
}: {
  model: LoadedGameViewModel;
  className?: string;
  compact?: boolean;
}) {
  const { game, selectMarketAsset, showResult, upgradeWarehouse } = model;
  const [submitting, setSubmitting] = useState(false);
  const [contentFilter, setContentFilter] = useState<WarehouseContentFilter>('stocked');
  const atMaxLevel = game.warehouseLevel >= game.warehouseMaxLevel;
  const canAfford = game.warehouseUpgradeCost !== null && game.credits >= game.warehouseUpgradeCost;
  const overCapacity = game.warehouseUsedCapacity > game.inventoryCapacity;
  const usagePercent = game.inventoryCapacity > 0
    ? Math.min(100, Math.round((game.warehouseUsedCapacity / game.inventoryCapacity) * 100))
    : 0;
  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
      return inventory.available > 0 || inventory.frozen > 0;
    }),
    [game.inventories, game.products],
  );
  const visibleProducts = contentFilter === 'stocked' ? stockedProducts : game.products;

  async function upgrade() {
    if (submitting || atMaxLevel) return;
    setSubmitting(true);
    try {
      await showResult(upgradeWarehouse());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel className={`warehouse-upgrade-card ${compact ? 'compact' : ''} ${className}`.trim()}>
      <WidgetHeading
        title="共享仓库"
        action={(
          <div className="warehouse-heading-status">
            {overCapacity ? <StatusTag tone="danger">容量超限</StatusTag> : null}
            <StatusTag tone={atMaxLevel ? 'success' : 'info'}>等级 {game.warehouseLevel}/{game.warehouseMaxLevel}</StatusTag>
          </div>
        )}
      />

      <div className="warehouse-layout">
        <section className="warehouse-management" aria-label="仓库容量与升级">
          <div
            className="warehouse-capacity-progress"
            aria-label={`仓库已使用 ${game.warehouseUsedCapacity}/${game.inventoryCapacity}`}
          >
            <div>
              <span>已使用</span>
              <strong>{game.warehouseUsedCapacity}/{game.inventoryCapacity}</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${usagePercent}%` }} />
            </div>
            <small>{usagePercent}% 已使用 · 所有商品共用容量</small>
          </div>

          <dl className="warehouse-summary-list">
            <div><dt>当前容量</dt><dd>{game.inventoryCapacity}</dd></div>
            <div><dt>实物库存</dt><dd>{game.warehouseStoredQuantity}</dd></div>
            <div><dt>买单预占</dt><dd>{game.warehouseReservedQuantity}</dd></div>
            <div><dt>剩余容量</dt><dd className={game.warehouseAvailableCapacity > 0 ? 'positive' : 'negative'}>{game.warehouseAvailableCapacity}</dd></div>
          </dl>

          <div className="warehouse-upgrade-summary">
            <div>
              <span>{atMaxLevel ? '最高容量' : '下一等级容量'}</span>
              <strong>{atMaxLevel ? game.inventoryCapacity : game.warehouseNextCapacity}</strong>
              <small>{atMaxLevel ? '仓库已经达到最高等级' : `增加 ${game.warehouseNextCapacity - game.inventoryCapacity} 容量`}</small>
            </div>
            <div>
              <span>升级费用</span>
              <strong>{atMaxLevel ? '已满级' : `¤ ${formatCurrency(game.warehouseUpgradeCost ?? 0)}`}</strong>
              <small>{atMaxLevel ? '无需继续扩容' : `当前可用资金 ¤ ${formatCurrency(game.credits)}`}</small>
            </div>
          </div>

          {overCapacity ? <p className="warehouse-capacity-warning">当前占用超过容量，释放库存或扩容前不能继续增加库存或新建买单。</p> : null}

          <Button
            block
            onClick={() => void upgrade()}
            disabled={submitting || atMaxLevel || !canAfford}
          >
            {submitting
              ? '正在扩容…'
              : atMaxLevel
                ? '已达最高等级'
                : canAfford
                  ? `支付 ¤ ${formatCurrency(game.warehouseUpgradeCost ?? 0)} 扩容`
                  : `资金不足 · 需要 ¤ ${formatCurrency(game.warehouseUpgradeCost ?? 0)}`}
          </Button>
        </section>

        <section className="warehouse-content" aria-label="仓库内容">
          <header className="warehouse-content-heading">
            <div>
              <strong>仓库内容</strong>
              <small>{stockedProducts.length} 种商品有库存</small>
            </div>
            <div className="warehouse-content-filters" role="group" aria-label="筛选仓库商品">
              <Button
                variant="compact"
                className={contentFilter === 'stocked' ? 'active' : ''}
                aria-pressed={contentFilter === 'stocked'}
                onClick={() => setContentFilter('stocked')}
              >有库存</Button>
              <Button
                variant="compact"
                className={contentFilter === 'all' ? 'active' : ''}
                aria-pressed={contentFilter === 'all'}
                onClick={() => setContentFilter('all')}
              >全部商品</Button>
            </div>
          </header>

          {visibleProducts.length > 0 ? (
            <div className="warehouse-product-grid">
              {visibleProducts.map((product) => {
                const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
                const empty = inventory.available === 0 && inventory.frozen === 0;
                return (
                  <button
                    type="button"
                    className={`warehouse-product-card ${empty ? 'empty' : ''}`}
                    key={product.id}
                    aria-label={`前往${product.name}市场`}
                    onClick={() => selectMarketAsset('commodity', product.id)}
                  >
                    <strong>{product.name}</strong>
                    <span>可用库存 <b>{inventory.available}</b></span>
                    <span>冻结库存 <b>{inventory.frozen}</b></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state warehouse-content-empty">
              <strong>仓库中暂无商品</strong>
              <span>生产或买入商品后，商品会显示在这里。</span>
              <Button variant="compact" onClick={() => setContentFilter('all')}>查看全部商品</Button>
            </div>
          )}
        </section>
      </div>
    </Panel>
  );
}
