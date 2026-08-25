from pathlib import Path

path = Path('scripts/verify-warehouse-expansion.mjs')
source = path.read_text(encoding='utf-8')
old = "requireText('src/pages/ProvincePage.tsx', '<WarehouseInventoryPanel model={model}');"
new = """for (const text of [
  '<WarehouseInventoryPanel',
  'model={model}',
  'onOpenProduct={openWarehouseProduct}',
]) requireText('src/pages/ProvincePage.tsx', text);"""
if old not in source:
    raise SystemExit('stale ProvincePage warehouse verifier token not found')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
