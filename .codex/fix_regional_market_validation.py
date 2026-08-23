from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'{path}: missing expected text: {old[:120]}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')

replace(
    'docs/WAREHOUSE_EXPANSION_DESIGN.md',
    '州级仓库每张商品卡只展示名称、PNG 插画、可用数量和冻结数量，不响应点击；库存显示条件仍为 `available > 0 或 frozen > 0`。',
    '州级仓库每张商品卡只展示名称、PNG 插画、可用数量和冻结数量，不响应点击；州级仓库分区的库存卡在所有宽度保持只读；库存显示条件仍为 `available > 0 或 frozen > 0`。',
)

replace(
    'docs/UI_DESIGN_SYSTEM.md',
    '市场自动交易详情继续复用统一商品选择器、采购／出售页签和既有仓库表单信息层级，并把原子保存动作放在唯一 Host 的固定底栏。',
    '地区商品自动交易详情固定当前商品，继续复用采购／出售页签和既有仓库表单信息层级，不显示全商品选择器；原子保存动作仍放在唯一 Host 的固定底栏。',
)

replace(
    'scripts/verify-warehouse-expansion.mjs',
    "  '市场自动交易活跃商品条件',\n",
    "  '不得通过组件内部选择器切换到其他商品',\n",
)
replace(
    'scripts/verify-warehouse-expansion.mjs',
    "  '市场在线自动采购／自动出售',\n  '商品自动交易卡和商品网格密度',\n",
    "  '地区商品详情在线自动采购／自动出售',\n  '移动自动交易抽屉与仓库商品网格密度',\n",
)
replace(
    'scripts/verify-warehouse-expansion.mjs',
    "  '自动采购／自动出售正文布局',\n",
    "  '地区商品详情自动交易控制',\n",
)
replace(
    'scripts/verify-warehouse-expansion.mjs',
    "  '统一商品选择器、采购／出售页签',\n",
    "  '固定当前商品，继续复用采购／出售页签',\n",
)

print('follow-up regional market validation fixes applied')
