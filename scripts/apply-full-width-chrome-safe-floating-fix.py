from pathlib import Path

path = Path('scripts/verify-game-shell-layout.mjs')
content = path.read_text(encoding='utf-8')
quote_old = '  "role="tooltip"", \'floatingLayer.getBoundingClientRect()\','
quote_new = '  \'role="tooltip"\', \'floatingLayer.getBoundingClientRect()\','
if quote_old not in content:
    raise SystemExit('Generated tooltip verifier quote anchor missing')
content = content.replace(quote_old, quote_new, 1)

multiline_old = "  'left: 0;\n    width: auto;\n    height: var(--desktop-asset-bar-height);',"
multiline_new = "  `left: 0;\n    width: auto;\n    height: var(--desktop-asset-bar-height);`,"
if multiline_old not in content:
    raise SystemExit('Generated legacy layout verifier multiline anchor missing')
content = content.replace(multiline_old, multiline_new, 1)

join_old = "failures.join('\n- ')"
join_new = "failures.join('\\n- ')"
if join_old not in content:
    raise SystemExit('Generated failure summary join anchor missing')
content = content.replace(join_old, join_new, 1)

path.write_text(content, encoding='utf-8')
print('Fixed SafeTooltip, multiline legacy-layout and failure-summary verifier quoting.')
