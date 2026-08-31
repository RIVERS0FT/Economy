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
        "  '--global-facility-catalog-artwork-size: 72px;',",
        "  '--global-facility-catalog-artwork-size: 80px;',",
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

css_path = Path('src/styles/global-operation-pages.css')
css_content = css_path.read_text(encoding='utf-8')
for old_artwork, new_artwork in [
    ('  --global-facility-catalog-artwork-size: 72px;', '  --global-facility-catalog-artwork-size: 80px;'),
    ('    --global-facility-catalog-artwork-size: 68px;', '    --global-facility-catalog-artwork-size: 80px;'),
]:
    if old_artwork not in css_content:
        raise SystemExit(f'missing global facility artwork size: {old_artwork}')
    css_content = css_content.replace(old_artwork, new_artwork, 1)
css_path.write_text(css_content, encoding='utf-8')

design_path = Path('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md')
design_content = design_path.read_text(encoding='utf-8')
old_design_artwork = '桌面约 `72×72`'
new_design_artwork = '桌面约 `80×80`'
if old_design_artwork not in design_content:
    raise SystemExit('missing global facility artwork design size')
design_path.write_text(design_content.replace(old_design_artwork, new_design_artwork, 1), encoding='utf-8')

browser_path = Path('tests/browser/global-operation-pages.spec.ts')
browser_content = browser_path.read_text(encoding='utf-8')
for old, new in [
    (
        "  const regionTriggerStyle = await regionProductSelect.evaluate((element) => {",
        "  await page.mouse.move(0, 0);\n  const regionTriggerStyle = await regionProductSelect.evaluate((element) => {",
    ),
    (
        "  const detailTriggerStyle = await detailProductSelect.evaluate((element) => {",
        "  await page.mouse.move(0, 0);\n  const detailTriggerStyle = await detailProductSelect.evaluate((element) => {",
    ),
]:
    if old not in browser_content:
        raise SystemExit(f'missing browser style comparison fragment: {old}')
    browser_content = browser_content.replace(old, new, 1)
browser_path.write_text(browser_content, encoding='utf-8')

print('Fixed shared production selector verifiers, compact-row artwork span, and hover-neutral style comparison')
