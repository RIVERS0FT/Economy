import { CompactNumber } from '../ui/CompactNumber';
import { useMemo } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../../auto-trade/useOnlineAutoTrade';
import { formatNumber } from '../../utils/formatters';
import { ProductIcon } from '../icons/ProductIcons';
import { StatusTag, WidgetHeading } from '../ui/layout';

export function WarehouseInventoryGrid({
  model,
  onOpenProduct,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  onOpenProduct?: (productId: string) => void;
}) {
  const { game } = model;
  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
      return inventory.available > 0 || inventory.frozen > 0;
    }),
    [game.inventories, game.products],
  );

  return (
    <section className="warehouse-content" aria-label="仓库商品">
      <WidgetHeading
        title="仓库内容"
        action={<span>实物库存 {<CompactNumber value={game.warehouseStoredQuantity} />}</span>}
      />
      {stockedProducts.length > 0 ? (
        <div className="warehouse-product-grid">
          {stockedProducts.map((product) => {
            const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
            return (
              <button
                type="button"
                className="warehouse-product-card"
                data-ui-interactive="surface"
                key={product.id}
                aria-label={`打开${product.name}详情，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}`}
                onClick={() => onOpenProduct?.(product.id)}
              >
                <span className="warehouse-product-card-name">{product.name}</span>
                <span className="warehouse-product-card-icon" aria-hidden="true"><ProductIcon productId={product.id} /></span>
                <strong className="warehouse-product-card-available">可用 {<CompactNumber value={inventory.available} />}</strong>
                <small className="warehouse-product-card-frozen">冻结 {<CompactNumber value={inventory.frozen} />}</small>
              </button>
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
  );
}

export function WarehouseInventoryPanel({
  model,
  className = '',
  onOpenProduct,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  className?: string;
  onOpenProduct?: (productId: string) => void;
}) {
  return (
    <div className={`warehouse-inventory-panel ${className}`.trim()}>
      <div className="warehouse-heading-actions">
        <StatusTag tone="neutral">无限容量</StatusTag>
      </div>
      <WarehouseInventoryGrid model={model} onOpenProduct={onOpenProduct} />
    </div>
  );
}
