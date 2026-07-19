from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'scripts/verify-page-content.mjs'
content = path.read_text(encoding='utf-8')

old = '''for (const text of [
  'const stockedProducts = useMemo',
  'inventory.available > 0 || inventory.frozen > 0',
  'ProductIconLabel',
  '<strong>可用 {formatNumber(inventory.available)}</strong>',
  '<small>冻结 {formatNumber(inventory.frozen)}</small>',
  '等级 {formatNumber(game.warehouseLevel)}',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);'''
new = '''for (const text of [
  'const stockedProducts = useMemo',
  'inventory.available > 0 || inventory.frozen > 0',
  'ProductIcon',
  'warehouse-product-card-name',
  'warehouse-product-card-icon',
  'warehouse-product-card-available',
  'warehouse-product-card-frozen',
  '<ProductIcon productId={product.id} />',
  '可用 {formatNumber(inventory.available)}',
  '冻结 {formatNumber(inventory.frozen)}',
  '等级 {formatNumber(game.warehouseLevel)}',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);'''
if content.count(old) != 1:
    raise RuntimeError('verify-page-content warehouse requirement block mismatch')
content = content.replace(old, new, 1)

old = '''  '<strong>库存 {total}</strong>',
]) forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);'''
new = '''  '<strong>库存 {total}</strong>',
  'ProductIconLabel',
]) forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);'''
if content.count(old) != 1:
    raise RuntimeError('verify-page-content warehouse forbidden block mismatch')
content = content.replace(old, new, 1)

path.write_text(content, encoding='utf-8')
print('Warehouse page-content verifier updated.')
