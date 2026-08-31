from pathlib import Path

css_path = Path('src/styles/global-operation-pages.css')
css = css_path.read_text(encoding='utf-8')
old = '''  row-gap: var(--global-facility-catalog-row-gap);\n  padding: var(--entity-list-inline-padding);\n  overflow: visible;'''
new = '''  row-gap: var(--global-facility-catalog-row-gap);\n  padding: var(--entity-list-inline-padding);\n  padding-block: var(--entity-list-inline-padding);\n  padding-inline: var(--entity-list-inline-padding);\n  overflow: visible;'''
if css.count(old) != 1:
    raise SystemExit(f'expected one global row padding anchor, got {css.count(old)}')
css_path.write_text(css.replace(old, new, 1), encoding='utf-8', newline='\n')

verify_path = Path('scripts/verify-page-content.mjs')
verify = verify_path.read_text(encoding='utf-8')
old_verify = "  'padding: var(--entity-list-inline-padding);',\n  'grid-row: 1;',"
new_verify = "  'padding: var(--entity-list-inline-padding);',\n  'padding-block: var(--entity-list-inline-padding);',\n  'padding-inline: var(--entity-list-inline-padding);',\n  'grid-row: 1;',"
if verify.count(old_verify) != 1:
    raise SystemExit(f'expected one page verifier padding anchor, got {verify.count(old_verify)}')
verify_path.write_text(verify.replace(old_verify, new_verify, 1), encoding='utf-8', newline='\n')

primary_path = Path('scripts/verify-primary-surface-insets.mjs')
primary = primary_path.read_text(encoding='utf-8')
old_primary = "    'padding: var(--entity-list-inline-padding);',\n    '.global-facility-catalog-row__open {',"
new_primary = "    'padding: var(--entity-list-inline-padding);',\n    'padding-block: var(--entity-list-inline-padding);',\n    'padding-inline: var(--entity-list-inline-padding);',\n    '.global-facility-catalog-row__open {',"
if primary.count(old_primary) != 1:
    raise SystemExit(f'expected one primary verifier padding anchor, got {primary.count(old_primary)}')
primary_path.write_text(primary.replace(old_primary, new_primary, 1), encoding='utf-8', newline='\n')

print('Applied equal four-side global facility row padding')
