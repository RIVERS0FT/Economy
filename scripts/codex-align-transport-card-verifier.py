from pathlib import Path

path = Path('scripts/verify-provincial-unlock-transport.mjs')
source = path.read_text(encoding='utf-8')
old = "requireText(warehousePanel, 'warehouse-product-card-in-transit', '仓库商品卡必须显示在途数量。');"
new = """requireText(warehousePanel, 'warehouse-transport-panel', '跨州运输必须使用独立一级卡片。');
requireText(warehousePanel, 'transport-shipment-list', '独立跨州运输卡必须显示进行中的运输记录。');
requireText(warehousePanel, \"shipment.status === 'in-transit'\", '跨州运输卡必须读取真实在途状态。');
if (warehousePanel.includes('warehouse-product-card-in-transit')) failures.push('仓库商品卡不得显示在途数量；在途信息唯一归属跨州运输卡。');"""
if old not in source:
    raise SystemExit('stale warehouse in-transit card verifier token not found')
path.write_text(source.replace(old, new, 1), encoding='utf-8')

css_path = Path('src/styles/warehouse-expansion.css')
css = css_path.read_text(encoding='utf-8')
old_css = ".warehouse-product-card-in-transit {\n  color: var(--color-warning);\n}\n\n"
if old_css not in css:
    raise SystemExit('stale warehouse in-transit card css not found')
css_path.write_text(css.replace(old_css, '', 1), encoding='utf-8')
