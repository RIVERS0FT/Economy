from pathlib import Path

path = Path('scripts/verify-page-content.mjs')
content = path.read_text(encoding='utf-8')
old = "  '.global-facility-region-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger {',"
new = '  ".global-facility-region-row__quick-selector .ui-rich-select[data-variant=\'production-config\'] .ui-rich-select__trigger {",'
if old not in content:
    raise SystemExit('missing malformed production-config verifier string')
path.write_text(content.replace(old, new, 1), encoding='utf-8')
print('Fixed production-config verifier string quoting')
