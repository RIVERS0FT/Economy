from pathlib import Path

# Keep the first-row drilldown as a full 44px interaction target without overlapping row 2.
css_path = Path('src/styles/global-operation-pages.css')
css = css_path.read_text(encoding='utf-8')
replacements = {
    '  --entity-list-row-height: 76px;\n  --global-facility-catalog-artwork-size: 52px;\n  --global-facility-catalog-main-row-size: 28px;\n': '  --entity-list-row-height: 96px;\n  --global-facility-catalog-artwork-size: 72px;\n  --global-facility-catalog-main-row-size: 44px;\n',
    '  padding-inline: var(--entity-list-inline-padding);\n  overflow: visible;': '  padding-inline: var(--entity-list-inline-padding);\n  border: 1px solid var(--color-border-subtle);\n  overflow: visible;',
    '    --entity-list-row-height: 70px;\n    --global-facility-catalog-artwork-size: 46px;\n    --global-facility-catalog-main-row-size: 28px;\n': '    --entity-list-row-height: 88px;\n    --global-facility-catalog-artwork-size: 68px;\n    --global-facility-catalog-main-row-size: 44px;\n',
    '    --entity-list-row-height: 68px;\n    --global-facility-catalog-artwork-size: 42px;\n    --global-facility-catalog-main-row-size: 27px;\n': '    --entity-list-row-height: 84px;\n    --global-facility-catalog-artwork-size: 66px;\n    --global-facility-catalog-main-row-size: 44px;\n',
}
for old, new in replacements.items():
    count = css.count(old)
    if count != 1:
        raise SystemExit(f'css geometry expected one occurrence, got {count}: {old!r}')
    css = css.replace(old, new, 1)
css_path.write_text(css, encoding='utf-8', newline='\n')

ui_path = Path('docs/UI_DESIGN_SYSTEM.md')
ui = ui_path.read_text(encoding='utf-8')
old = '登记为约 `76px / 70px / 68px` 的两行高度例外'
new = '登记为约 `96px / 88px / 84px` 的两行高度例外'
if ui.count(old) != 1:
    raise SystemExit(f'UI doc geometry expected one occurrence, got {ui.count(old)}')
ui_path.write_text(ui.replace(old, new, 1), encoding='utf-8', newline='\n')

facility_path = Path('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md')
facility = facility_path.read_text(encoding='utf-8')
anchor = '一级全局工厂目录是通用实体列表中明确登记的两行高度例外，条目自身四边必须统一使用同一个共享列表横向内边距令牌，禁止分别设置上下与左右内边距；地区工厂列表仍保持共享单行高度。'
replacement = '一级全局工厂目录是通用实体列表中明确登记的两行高度例外，第一行地区下钻保持至少 `44px` 可操作高度，整体响应式高度约为 `96px / 88px / 84px`；条目自身四边必须统一使用同一个共享列表横向内边距令牌，禁止分别设置上下与左右内边距；地区工厂列表仍保持共享单行高度。'
if facility.count(anchor) != 1:
    raise SystemExit(f'facility doc geometry expected one occurrence, got {facility.count(anchor)}')
facility_path.write_text(facility.replace(anchor, replacement, 1), encoding='utf-8', newline='\n')

verify_path = Path('scripts/verify-page-content.mjs')
verify = verify_path.read_text(encoding='utf-8')
legacy_height = "  '--entity-list-row-height: 76px;',"
if verify.count(legacy_height) != 1:
    raise SystemExit(f'legacy page verifier height expected one occurrence, got {verify.count(legacy_height)}')
verify = verify.replace(legacy_height, "  '--entity-list-row-height: 96px;',", 1)
old = "  'padding-inline: var(--entity-list-inline-padding);',\n  'grid-row: 1;',"
new = "  'padding-inline: var(--entity-list-inline-padding);',\n  'border: 1px solid var(--color-border-subtle);',\n  '--global-facility-catalog-main-row-size: 44px;',\n  'grid-row: 1;',"
if verify.count(old) != 1:
    raise SystemExit(f'page verifier geometry expected one occurrence, got {verify.count(old)}')
verify_path.write_text(verify.replace(old, new, 1), encoding='utf-8', newline='\n')

primary_path = Path('scripts/verify-primary-surface-insets.mjs')
primary = primary_path.read_text(encoding='utf-8')
old = "    'padding-inline: var(--entity-list-inline-padding);',\n    '.global-facility-catalog-row__open {',"
new = "    'padding-inline: var(--entity-list-inline-padding);',\n    'border: 1px solid var(--color-border-subtle);',\n    '--global-facility-catalog-main-row-size: 44px;',\n    '.global-facility-catalog-row__open {',"
if primary.count(old) != 1:
    raise SystemExit(f'primary verifier geometry expected one occurrence, got {primary.count(old)}')
primary_path.write_text(primary.replace(old, new, 1), encoding='utf-8', newline='\n')

print('Applied 44px first-row drilldown geometry and explicit row border')