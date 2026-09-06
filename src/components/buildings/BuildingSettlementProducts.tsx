import { WarehouseIcon } from '../icons/GameIcons';
import { ProductArtwork } from '../products/ProductArtwork';
import { CompactNumber } from '../ui/CompactNumber';
import type { ProductInventory } from '../../types';
import { formatNumber } from '../../utils/formatters';

export function BuildingSettlementProducts({ items, productNames, inventories, multiplier, groupClassName,
  itemClassName, onOpenProductMarket, quantityLabel = '生产数量', requiredForNextCycle, usableForNextCycle }: {
  items: { productId: string; quantity: number }[];
  productNames: Map<string, string>;
  inventories: Record<string, ProductInventory>;
  multiplier: number;
  groupClassName: string;
  itemClassName: string;
  onOpenProductMarket: (productId: string) => void;
  quantityLabel?: string;
  requiredForNextCycle?: Record<string, number>;
  usableForNextCycle?: Record<string, number | null>;
}) {
  return (
    <div className={groupClassName}>
      {items.map((item, index) => {
        const productName = productNames.get(item.productId) ?? item.productId;
        const quantity = item.quantity * multiplier;
        const warehouseQuantity = inventories[item.productId]?.available ?? 0;
        const usableQuantity = usableForNextCycle === undefined ? warehouseQuantity : usableForNextCycle[item.productId];
        const shortage = requiredForNextCycle !== undefined && usableQuantity != null
          && usableQuantity < (requiredForNextCycle[item.productId] ?? 0);
        return (
          <button type="button" className="facility-formula-item-card facility-formula-item-group" data-ui-interactive="surface"
            data-shortage={shortage || undefined} key={`${item.productId}-${index}`}
            aria-label={`查看${productName}本地商品详情，${quantityLabel} ${formatNumber(quantity)}，仓库可用 ${formatNumber(warehouseQuantity)}${shortage ? '，下一周期库存不足' : ''}`}
            title={`查看${productName}本地商品详情 · ${quantityLabel} ${formatNumber(quantity)} · 仓库可用 ${formatNumber(warehouseQuantity)}`}
            onClick={() => onOpenProductMarket(item.productId)}>
            <span className={itemClassName}>
              <ProductArtwork productId={item.productId} className="facility-formula-product-artwork" />
              <strong><CompactNumber value={quantity} /></strong>
              <span className="facility-formula-inventory" title={`${productName}仓库可用数量`}>
                <WarehouseIcon className="facility-formula-meta-icon" /><span><CompactNumber value={warehouseQuantity} /></span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
