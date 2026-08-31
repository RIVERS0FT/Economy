from pathlib import Path

path = Path('scripts/verify-page-content.mjs')
content = path.read_text(encoding='utf-8')

replacements = [
    (
        "  '.global-facility-region-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger {',",
        '  ".global-facility-region-row__quick-selector .ui-rich-select[data-variant=\'production-config\'] .ui-rich-select__trigger {",',
    ),
    (
        "  '第二行只在工厂身份列内显示“当前生产产物”和“当前作业制度”两个方形图标',",
        "  '第二行显示“当前生产产物”和“当前作业制度”两个方形生产方案槽',",
    ),
    (
        "  '两个图标分别作为紧凑富内容下拉选择器的触发面',",
        "  '两个方案槽必须直接复用建筑详情页 `FacilityProductionProductSelect` / `FacilityProductionMethodSelect` 与 `production-config` 视觉',",
    ),
    (
        '    "onValueChange={(value) => void applyQuickProduction(row, \'product\', value)}",',
        '    "onProductChange={(value) => void applyQuickProduction(row, \'product\', value)}",',
    ),
    (
        '    "onValueChange={(value) => void applyRegionalQuickProduction(row, \'product\', value)}",',
        '    "onProductChange={(value) => void applyRegionalQuickProduction(row, \'product\', value)}",',
    ),
    (
        '    "onValueChange={(value) => void applyRegionalQuickProduction(row, \'method\', value)}",',
        '    "onMethodChange={(value) => void applyRegionalQuickProduction(row, \'method\', value)}",',
    ),
]

for old, new in replacements:
    if old not in content:
        raise SystemExit(f'missing verifier fragment: {old}')
    content = content.replace(old, new, 1)

path.write_text(content, encoding='utf-8')
print('Fixed production-config verifier quoting and shared-selector assertions')
