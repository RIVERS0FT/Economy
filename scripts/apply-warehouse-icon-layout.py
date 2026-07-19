from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    content = path.read_text(encoding="utf-8")
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{relative_path}: expected one match, found {count}\n--- old ---\n{old}")
    path.write_text(content.replace(old, new, 1), encoding="utf-8")


component = "src/components/warehouse/WarehouseUpgradeCard.tsx"
replace_once(
    component,
    "import { ProductIconLabel } from '../icons/ProductIcons';",
    "import { ProductIcon } from '../icons/ProductIcons';",
)
replace_once(
    component,
    '''                    aria-label={`前往${product.name}市场`}
                    onClick={() => selectMarketAsset('commodity', product.id)}
                  >
                    <ProductIconLabel productId={product.id} className="warehouse-product-card-title">
                      {product.name}
                    </ProductIconLabel>
                    <strong>可用 {formatNumber(inventory.available)}</strong>
                    <small>冻结 {formatNumber(inventory.frozen)}</small>
                  </button>''',
    '''                    aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}，前往市场`}
                    onClick={() => selectMarketAsset('commodity', product.id)}
                  >
                    <span className="warehouse-product-card-name">{product.name}</span>
                    <span className="warehouse-product-card-icon">
                      <ProductIcon productId={product.id} />
                    </span>
                    <strong className="warehouse-product-card-available">
                      可用 {formatNumber(inventory.available)}
                    </strong>
                    <small className="warehouse-product-card-frozen">
                      冻结 {formatNumber(inventory.frozen)}
                    </small>
                  </button>''',
)

css = "src/styles/warehouse-expansion.css"
replace_once(
    css,
    '''.warehouse-capacity-progress strong,
.warehouse-upgrade-summary strong,
.warehouse-summary-list dd,
.warehouse-product-card > strong {''',
    '''.warehouse-capacity-progress strong,
.warehouse-upgrade-summary strong,
.warehouse-summary-list dd,
.warehouse-product-card-available {''',
)
replace_once(
    css,
    '''.warehouse-product-card {
  min-width: 0;
  min-height: 84px;
  display: grid;
  align-content: start;
  gap: var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  color: var(--color-text-primary);
  background: var(--color-surface-inset);
  text-align: left;
}

.warehouse-product-card:hover:not(:disabled),
.warehouse-product-card:focus-visible {
  transform: none;
  filter: none;
  border-color: rgba(123, 228, 158, 0.38);
  background: var(--color-surface-hover);
}

.warehouse-product-card-title {
  width: 100%;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 850;
}

.warehouse-product-card-title > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.warehouse-product-card > strong {
  overflow: hidden;
  font-size: var(--font-size-xl);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.warehouse-product-card > small {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}''',
    '''.warehouse-product-card {
  position: relative;
  min-width: 0;
  min-height: 112px;
  display: grid;
  grid-template-rows: minmax(44px, 1fr) auto auto;
  place-items: center;
  align-content: stretch;
  gap: 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 30px var(--space-2) var(--space-2);
  color: var(--color-text-primary);
  background: var(--color-surface-inset);
  text-align: center;
}

.warehouse-product-card:hover:not(:disabled),
.warehouse-product-card:focus-visible {
  transform: none;
  filter: none;
  border-color: rgba(123, 228, 158, 0.38);
  background: var(--color-surface-hover);
}

.warehouse-product-card-name {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  right: var(--space-2);
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 850;
  line-height: var(--line-height-tight);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.warehouse-product-card-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  align-self: center;
  color: var(--color-text-secondary);
}

.warehouse-product-card-icon .product-icon {
  width: 44px;
  height: 44px;
}

.warehouse-product-card-available,
.warehouse-product-card-frozen {
  max-width: 100%;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.warehouse-product-card-available {
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
}

.warehouse-product-card-frozen {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}''',
)
replace_once(
    css,
    '''@container (min-width: 360px) {''',
    '''@container (max-width: 359px) {
  .warehouse-product-card-icon {
    width: 42px;
    height: 42px;
  }

  .warehouse-product-card-icon .product-icon {
    width: 38px;
    height: 38px;
  }

  .warehouse-product-card-available {
    font-size: var(--font-size-md);
  }
}

@container (min-width: 360px) {''',
)

warehouse_doc = "docs/WAREHOUSE_EXPANSION_DESIGN.md"
replace_once(warehouse_doc, "> 更新时间：2026-07-17", "> 更新时间：2026-07-19")
replace_once(
    warehouse_doc,
    '''每张商品卡采用固定三层信息结构，但不显示库存总量或估值：

1. 统一 `ProductIconLabel` 商品 SVG 与商品名称；
2. 醒目的“可用 N”，沿用原库存主值字号；
3. 弱化的“冻结 N”，沿用原第三层辅助文字字号。

冻结数量为零时仍显示“冻结 0”，保证商品卡结构和高度一致。整张卡进入对应商品市场。不得显示“库存 N”总量行、估值、买一价、最近成交价、单项容量、买单预占或直接出售表单。''',
    '''每张商品卡采用固定的图标主导结构，但不显示库存总量或估值：

1. 商品名称固定在卡片左上角，使用次级文字色并保持单行省略；
2. 中央直接使用统一 `ProductIcon` 商品 SVG，常规尺寸为 `44px`，最窄两列容器可降为 `38px`，作为卡片第一视觉元素；
3. 图标下方居中显示醒目的“可用 N”，沿用库存主值字号；
4. 最底部居中显示弱化的“冻结 N”，沿用辅助文字字号。

冻结数量为零时仍显示“冻结 0”，保证商品卡结构和高度一致。整张卡进入对应商品市场。不得把图标恢复为商品名称旁的 `1em` 小图标，也不得显示“库存 N”总量行、估值、买一价、最近成交价、单项容量、买单预占或直接出售表单。''',
)
replace_once(
    warehouse_doc,
    '''即正式密度为 2／3／4／5／6 列。商品卡最小高度为 `84px`，卡片内边距为 `8px`，网格间距为 `8px`。商品名称、可用数量和冻结数量均保持单行省略，不得造成横向溢出。''',
    '''即正式密度为 2／3／4／5／6 列。商品卡最小高度为 `112px`，卡片内边距为 `8px`，网格间距为 `8px`。商品名称、可用数量和冻结数量均保持单行省略，不得造成横向溢出；名称的左上角锚点和图标的视觉中心必须在所有卡片中保持一致。''',
)
replace_once(
    warehouse_doc,
    '''- 删除 2／3／4／5／6 列容器查询，或把商品卡恢复到 `92px` 高和 `12px` 内边距；''',
    '''- 删除 2／3／4／5／6 列容器查询、把商品卡最小高度降到 `112px` 以下，或恢复 `12px` 内边距；
- 把商品名称移出左上角、把商品图标恢复为名称旁的小图标，或取消居中大图标主体结构；''',
)

ui_doc = "docs/UI_DESIGN_SYSTEM.md"
replace_once(ui_doc, "> 更新时间：2026-07-18", "> 更新时间：2026-07-19")
replace_once(
    ui_doc,
    '''- 仓库商品卡使用 `ProductIconLabel`，固定采用“图标与名称／可用主值／冻结辅助值”的三层紧凑结构；不得显示独立库存总量行。
- “可用 N”沿用原库存主值字号，“冻结 N”沿用原第三层辅助文字字号；冻结为零时仍显示。
- 仓库商品网格使用容器查询，根据 `.warehouse-content` 宽度依次显示 2／3／4／5／6 列；断点为 360、560、760、960px。商品卡最小高度 `84px`，内边距和网格间距均为 `8px`。不得恢复宽屏四列、桌面三列或移动固定两列。''',
    '''- 仓库商品卡直接使用 `ProductIcon`，固定采用“左上名称／居中大图标／可用主值／冻结辅助值”的图标主导结构；不得显示独立库存总量行。
- 商品名称使用次级文字色并固定在左上角；商品 SVG 常规尺寸为 `44px`，最窄两列容器可降为 `38px`，图标必须成为卡片第一视觉元素。“可用 N”沿用库存主值字号，“冻结 N”沿用辅助文字字号；冻结为零时仍显示。
- 仓库商品网格使用容器查询，根据 `.warehouse-content` 宽度依次显示 2／3／4／5／6 列；断点为 360、560、760、960px。商品卡最小高度 `112px`，内边距和网格间距均为 `8px`。不得恢复宽屏四列、桌面三列或移动固定两列。''',
)
replace_once(
    ui_doc,
    '''- 删除仓库商品网格的 2／3／4／5／6 列容器查询，或恢复移动固定两列；''',
    '''- 删除仓库商品网格的 2／3／4／5／6 列容器查询，或恢复移动固定两列；
- 把仓库商品名称移出左上角、把商品图标恢复为名称旁的小图标、取消居中大图标主体结构，或把商品卡最小高度降到 `112px` 以下；''',
)

page_doc = "docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md"
replace_once(page_doc, "> 更新时间：2026-07-18", "> 更新时间：2026-07-19")
replace_once(
    page_doc,
    '''仓库不再提供“有库存／全部商品”筛选，只展示可用或冻结数量大于零的商品。“仓库内容”标题不显示商品种类统计。商品卡必须显示统一商品 SVG、商品名称、醒目的可用数量以及弱化的冻结数量，不显示独立库存总量行。''',
    '''仓库不再提供“有库存／全部商品”筛选，只展示可用或冻结数量大于零的商品。“仓库内容”标题不显示商品种类统计。商品卡必须把商品名称固定在左上角，以居中大尺寸统一商品 SVG 作为视觉主体，并在图标下方依次显示醒目的可用数量和弱化的冻结数量；不得显示独立库存总量行。''',
)

verify = "scripts/verify-warehouse-expansion.mjs"
replace_once(
    verify,
    '''  "import { ProductIconLabel } from '../icons/ProductIcons'",''',
    '''  "import { ProductIcon } from '../icons/ProductIcons'",''',
)
replace_once(
    verify,
    '''  '<strong>可用 {formatNumber(inventory.available)}</strong>',
  '<small>冻结 {formatNumber(inventory.frozen)}</small>',
  "selectMarketAsset('commodity', product.id)",''',
    '''  'warehouse-product-card-name',
  'warehouse-product-card-icon',
  'warehouse-product-card-available',
  'warehouse-product-card-frozen',
  '<ProductIcon productId={product.id} />',
  '可用 {formatNumber(inventory.available)}',
  '冻结 {formatNumber(inventory.frozen)}',
  "selectMarketAsset('commodity', product.id)",''',
)
replace_once(
    verify,
    '''for (const forbidden of ['warehouseMaxLevel', '已达最高等级', '种商品有库存', '<strong>库存 {total}</strong>']) {''',
    '''for (const forbidden of ['warehouseMaxLevel', '已达最高等级', '种商品有库存', '<strong>库存 {total}</strong>', 'ProductIconLabel']) {''',
)
replace_once(verify, "  'min-height: 84px;',", "  'min-height: 112px;',")
replace_once(
    verify,
    '''  'padding: var(--space-2);',
  '@media (max-width: 960px)',
]) requireText(css, text);''',
    '''  'padding: 30px var(--space-2) var(--space-2);',
  '.warehouse-product-card-name',
  'position: absolute;',
  '.warehouse-product-card-icon .product-icon',
  'width: 44px;',
  'height: 44px;',
  '@container (max-width: 359px)',
  'width: 38px;',
  'height: 38px;',
  '@media (max-width: 960px)',
]) requireText(css, text);''',
)
replace_once(
    verify,
    '''  '84px',
  '8px',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);''',
    '''  '112px',
  '8px',
  '商品名称固定在卡片左上角',
  '居中大图标主体结构',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);''',
)
replace_once(
    verify,
    '''for (const text of ['仓库商品网格按内容区宽度', '建设卡不显示生产周期、单座产量和单座成本']) {''',
    '''for (const text of ['仓库商品网格按内容区宽度', '商品名称固定在左上角', '居中大尺寸统一商品 SVG', '建设卡不显示生产周期、单座产量和单座成本']) {''',
)
replace_once(
    verify,
    '''for (const text of ['仓库商品网格使用容器查询', '生产配方是配置展示，不是运行统计']) {''',
    '''for (const text of ['仓库商品网格使用容器查询', '左上名称／居中大图标／可用主值／冻结辅助值', '商品卡最小高度 `112px`', '生产配方是配置展示，不是运行统计']) {''',
)
replace_once(
    verify,
    '''console.log('仓库无限扩容、容量线性定价、商品卡 2 至 6 列容器密度、建设卡精简和固定单座配方验证通过。');''',
    '''console.log('仓库无限扩容、容量线性定价、商品卡图标主导布局、2 至 6 列容器密度、建设卡精简和固定单座配方验证通过。');''',
)

# The workflow removes these one-time migration files before committing the result.
print("Warehouse icon-led card layout applied.")
