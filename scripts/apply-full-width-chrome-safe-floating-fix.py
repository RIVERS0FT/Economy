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

shell_design_path = Path('docs/LIQUID_GLASS_CHROME_DESIGN.md')
shell_design = shell_design_path.read_text(encoding='utf-8')
design_anchor = '- `.page-scroll-area` 与 `.page-scroll` 直接铺满下方工作区，不得再使用“工作栏高度 + 双沟槽”的顶部 padding 模拟避让；页面 sticky 内容只允许使用工作区内部沟槽作为偏移。'
design_replacement = design_anchor + '\n- 游戏端与管理员端继续共享这一个页面主 `ScrollArea`；不得为管理员创建第二个原生主滚动容器。'
if design_anchor not in shell_design:
    raise SystemExit('Shared scroll ownership design anchor missing')
shell_design_path.write_text(shell_design.replace(design_anchor, design_replacement, 1), encoding='utf-8')

print('Fixed generated verifier quoting and restored shared page-scroll ownership authority.')
