from pathlib import Path

css_path = Path('src/styles/strategic-game-shell.css')
css = css_path.read_text(encoding='utf-8')
old_css = """.strategic-map-stage .province-map-echart .economy-chart__canvas {\n  touch-action: none;\n  overscroll-behavior: contain;\n}\n"""
new_css = """.strategic-map-stage .province-map-echart .economy-chart__canvas {\n  touch-action: none;\n}\n"""
if css.count(old_css) != 1:
    raise SystemExit(f'expected exactly one map canvas interaction block, found {css.count(old_css)}')
css_path.write_text(css.replace(old_css, new_css, 1), encoding='utf-8')

verify_path = Path('scripts/verify-provincial-economy.mjs')
verify = verify_path.read_text(encoding='utf-8')
old_verify = "  'touch-action: none;',\n  'overscroll-behavior: contain;',\n"
new_verify = "  'touch-action: none;',\n"
if verify.count(old_verify) != 1:
    raise SystemExit(f'expected exactly one overscroll verifier fragment, found {verify.count(old_verify)}')
verify_path.write_text(verify.replace(old_verify, new_verify, 1), encoding='utf-8')
