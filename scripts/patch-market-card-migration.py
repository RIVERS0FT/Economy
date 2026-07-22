from pathlib import Path

path = Path('scripts/apply-market-card-artwork-sizing.py')
source = path.read_text(encoding='utf-8')
anchor = "replace_once('scripts/verify-market-page-layout.mjs', verify_anchor, verify_anchor + '\\n' + verify_lines)"
addition = '''replace_once(
    'scripts/verify-market-page-layout.mjs',
    "requireText(marketStyles, 'z-index: 1;\\\\n  inset: 18px 0;', '市场商品图标层必须位于下层并保持居中安全区。');",
    "requireText(marketStyles, 'z-index: 1;\\\\n  inset: 14px 0;', '市场商品图标层必须位于下层并保持 64px 主视觉居中安全区。');",
)

'''
if addition.strip() not in source:
    if anchor not in source:
        raise SystemExit('market verifier insertion anchor was not found')
    source = source.replace(anchor, addition + anchor, 1)
path.write_text(source, encoding='utf-8')
