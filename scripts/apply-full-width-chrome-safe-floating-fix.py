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
shell_design = shell_design.replace(design_anchor, design_replacement, 1)

photography_anchor = '- 玩家端和管理员端必须共享这套 DOM、CSS 变量、折叠行为和浏览器几何测试，不得分别创建第二套根外壳。'
photography_rules = photography_anchor + '\n- 页面和状态切换只修改 `data-app-backdrop` 与 `data-app-tone`；不得重建根级摄影节点。生产认证态继续使用 `-2 / -1` 负层级，游戏与管理员登录态保持非负根层级。\n- `#root` 是全应用唯一允许同时包围摄影层、氛围层与液态玻璃的 `isolation:isolate` 根；新增的 `.signed-in-shell__body`、`.signed-in-shell__chrome` 与 `.workspace-floating-layer` 在桌面和移动端都必须保持 `isolation:auto`、`filter:none` 与 `transform:none`，不得在登录后外壳祖先上建立第二个隔离根。\n- 桌面玩家、桌面管理员、移动玩家和移动管理员四种场景保持开放的背景采样链；不得通过状态栏专属填充、描边或氛围副本掩盖根级采样失败。`verify-open-glass-sampling.mjs` 与 `open-glass-sampling.spec.ts` 必须覆盖新增祖先。'
if photography_anchor not in shell_design:
    raise SystemExit('Persistent photography design anchor missing')
shell_design = shell_design.replace(photography_anchor, photography_rules, 1)
shell_design_path.write_text(shell_design, encoding='utf-8')

open_verify_path = Path('scripts/verify-open-glass-sampling.mjs')
open_verify = open_verify_path.read_text(encoding='utf-8')
old_chain = '''  const openChainSelectors = `.signed-in-shell,
.workspace,
.mobile-page-overlay,
.mobile-chrome-overlay,
.page-scroll-area,
.page-scroll {
  isolation: auto;
  filter: none;
  transform: none;
}`;'''
new_chain = '''  const openChainSelectors = `.signed-in-shell,
.signed-in-shell__body,
.signed-in-shell__chrome,
.workspace,
.mobile-page-overlay,
.mobile-chrome-overlay,
.workspace-floating-layer,
.page-scroll-area,
.page-scroll {
  isolation: auto;
  filter: none;
  transform: none;
}`;'''
if old_chain not in open_verify:
    raise SystemExit('Open glass sampling selector anchor missing')
open_verify_path.write_text(open_verify.replace(old_chain, new_chain, 1), encoding='utf-8')

overview_verify_path = Path('scripts/verify-overview-content.mjs')
overview_verify = overview_verify_path.read_text(encoding='utf-8')
overview_verify = overview_verify.replace(
    "  sidebarStyle: 'src/styles/desktop-sidebar.css',\n",
    "  sidebarStyle: 'src/styles/desktop-sidebar.css',\n  shellLayoutStyle: 'src/styles/game-shell-layout.css',\n",
    1,
)
old_sidebar_requirement = "  'grid-template-columns: var(--sidebar-column-width) minmax(0, 1fr);',\n"
if old_sidebar_requirement not in overview_verify:
    raise SystemExit('Overview legacy sidebar grid requirement anchor missing')
overview_verify = overview_verify.replace(old_sidebar_requirement, '', 1)
insert_anchor = "forbidAll(paths.sidebarStyle, ['right: -11px;']);"
insert_rule = "requireAll(paths.shellLayoutStyle, ['.signed-in-shell__body {', 'grid-template-columns:', 'var(--sidebar-column-width)']);\n" + insert_anchor
if insert_anchor not in overview_verify:
    raise SystemExit('Overview shell layout verifier insertion anchor missing')
overview_verify = overview_verify.replace(insert_anchor, insert_rule, 1)
overview_verify_path.write_text(overview_verify, encoding='utf-8')

print('Fixed generated verifier quoting and updated shared scroll, photography, sampling and lower-body layout authority.')
