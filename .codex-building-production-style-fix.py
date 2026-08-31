from pathlib import Path

page_path = Path('scripts/verify-page-content.mjs')
page_content = page_path.read_text(encoding='utf-8')

page_replacements = [
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

for old, new in page_replacements:
    if old not in page_content:
        raise SystemExit(f'missing page verifier fragment: {old}')
    page_content = page_content.replace(old, new, 1)
page_path.write_text(page_content, encoding='utf-8')

shared_aria_replacements = [
    (
        "  'aria-label={`${typeName}生产产物`}',",
        "  'aria-label={ariaLabel ?? `${typeName}生产产物`}',",
    ),
    (
        "  'aria-label={`${typeName}生产方式`}',",
        "  'aria-label={ariaLabel ?? `${typeName}生产方式`}',",
    ),
]
for verifier in [
    'scripts/verify-production-methods.mjs',
    'scripts/verify-facility-groups.mjs',
    'scripts/verify-production-settlement-layout.mjs',
    'scripts/verify-unified-factory-recipes-grid.mjs',
]:
    verifier_path = Path(verifier)
    verifier_content = verifier_path.read_text(encoding='utf-8')
    replaced = 0
    for old, new in shared_aria_replacements:
        if old in verifier_content:
            verifier_content = verifier_content.replace(old, new, 1)
            replaced += 1
    if replaced == 0:
        raise SystemExit(f'no shared aria verifier fragment found in {verifier}')
    verifier_path.write_text(verifier_content, encoding='utf-8')

primary_path = Path('scripts/verify-primary-surface-insets.mjs')
primary_content = primary_path.read_text(encoding='utf-8')
old_message = '地区工厂列表保持共享单行密度'
new_message = '地区工厂列表同步两行生产配置密度'
if old_message not in primary_content:
    raise SystemExit(f'missing primary verifier status text: {old_message}')
primary_path.write_text(primary_content.replace(old_message, new_message, 1), encoding='utf-8')

print('Fixed all applicable shared production selector verifier assertions and two-line status text')
