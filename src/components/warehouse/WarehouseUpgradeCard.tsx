import { useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { ProductIconLabel } from '../icons/ProductIcons';
import { Button, Panel, StatusTag, WidgetHeading } from '../ui/layout';
import { formatCurrency } from '../../utils/formatters';

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
  const upgradeUnavailable = game.warehouseUpgradeCost === null || game.warehouseNextCapacityIncrease <= 0;
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

  async function upgrade() {
    if (submitting || upgradeUnavailable) return;
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
            <StatusTag tone="info">等级 {game.warehouseLevel}</StatusTag>
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
              <span>下一等级容量</span>
              <strong>{game.warehouseNextCapacity}</strong>
              <small>增加 {game.warehouseNextCapacityIncrease} 容量</small>
            </div>
            <div>
              <span>升级费用</span>
              <strong>{game.warehouseUpgradeCost === null ? '数值不可用' : `¤ ${formatCurrency(game.warehouseUpgradeCost)}`}</strong>
              <small>当前可用资金 ¤ {formatCurrency(game.credits)}</small>
            </div>
          </div>

          {overCapacity ? <p className="warehouse-capacity-warning">当前占用超过容量，释放库存或扩容前不能继续增加库存或新建买单。</p> : null}

          <Button
            block
            onClick={() => void upgrade()}
            disabled={submitting || upgradeUnavailable || !canAfford}
          >
            {submitting
              ? '正在扩容…'
              : upgradeUnavailable
                ? '扩容数值不可用'
                : canAfford
                  ? `支付 ¤ ${formatCurrency(game.warehouseUpgradeCost ?? 0)} 扩容`
                  : `资金不足 · 需要 ¤ ${formatCurrency(game.warehouseUpgradeCost ?? 0)}`}
          </Button>
        </section>

        <section className="warehouse-content" aria-label="仓库内容">
          <header className="warehouse-content-heading">
            <strong>仓库内容</strong>
          </header>

          {stockedProducts.length > 0 ? (
            <div className="warehouse-product-grid">
              {stockedProducts.map((product) => {
                const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
                return (
                  <button
                    type="button"
                    className="warehouse-product-card"
                    key={product.id}
                    aria-label={`前往${product.name}市场`}
                    onClick={() => selectMarketAsset('commodity', product.id)}
                  >
                    <ProductIconLabel productId={product.id} className="warehouse-product-card-title">
                      {product.name}
                    </ProductIconLabel>
                    <strong>可用 {inventory.available}</strong>
                    <small>冻结 {inventory.frozen}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state warehouse-content-empty">
              <strong>仓库中暂无商品</strong>
              <span>生产或买入商品后，商品会显示在这里。</span>
            </div>
          )}
        </section>
      </div>
    </Panel>
  );
}
