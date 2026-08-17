import { useMemo } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../../auto-trade/useOnlineAutoTrade';
import { formatNumber } from '../../utils/formatters';
import { ProductIcon } from '../icons/ProductIcons';
import { Panel, StatusTag, WidgetHeading } from '../ui/layout';

export function WarehouseInventoryPanel({
  model,
  className = '',
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  className?: string;
}) {
  const { game } = model;
  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
      return inventory.available > 0 || inventory.frozen > 0;
    }),
    [game.inventories, game.products],
  );

  return (
    <Panel className={`production-surface warehouse-inventory-panel warehouse-only-panel ${className}`.trim()}>
      <WidgetHeading
        title="共享仓库"
        action={<StatusTag tone="neutral">无限容量</StatusTag>}
      />
      <section className="warehouse-content" aria-label="仓库内容">
        <header className="warehouse-content-heading">
          <strong>仓库内容</strong>
          <span>实物库存 {formatNumber(game.warehouseStoredQuantity)}</span>
        </header>
        {stockedProducts.length > 0 ? (
          <div className="warehouse-product-grid">
            {stockedProducts.map((product) => {
              const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
              return (
                <article
                  className="warehouse-product-card warehouse-product-card--readonly"
                  key={product.id}
                  aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}`}
                >
                  <span className="warehouse-product-card-name">{product.name}</span>
                  <span className="warehouse-product-card-icon" aria-hidden="true"><ProductIcon productId={product.id} /></span>
                  <strong className="warehouse-product-card-available">可用 {formatNumber(inventory.available)}</strong>
                  <small className="warehouse-product-card-frozen">冻结 {formatNumber(inventory.frozen)}</small>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state warehouse-content-empty">
            <strong>仓库中暂无商品</strong>
            <span>通过生产或市场交易获得商品后，会在这里按州级库存显示。</span>
          </div>
        )}
      </section>
    </Panel>
  );
}
