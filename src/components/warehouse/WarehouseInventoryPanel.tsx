import { useMemo } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { formatNumber } from '../../utils/formatters';
import { ProductIcon } from '../icons/ProductIcons';
import { Panel, StatusTag, WidgetHeading } from '../ui/layout';

export function WarehouseInventoryPanel({
  model,
  className = '',
}: {
  model: LoadedGameViewModel;
  className?: string;
}) {
  const { game, selectMarketAsset } = model;
  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
      return inventory.available > 0 || inventory.frozen > 0;
    }),
    [game.inventories, game.products],
  );

  return (
    <Panel className={`production-surface warehouse-inventory-panel ${className}`.trim()}>
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
                <button
                  type="button"
                  className="warehouse-product-card"
                  key={product.id}
                  aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}，前往市场`}
                  onClick={() => selectMarketAsset('commodity', product.id)}
                >
                  <span className="warehouse-product-card-name">{product.name}</span>
                  <span className="warehouse-product-card-icon">
                    <ProductIcon productId={product.id} />
                  </span>
                  <strong className="warehouse-product-card-available">可用 {formatNumber(inventory.available)}</strong>
                  <small className="warehouse-product-card-frozen">冻结 {formatNumber(inventory.frozen)}</small>
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
    </Panel>
  );
}
