from pathlib import Path

p = Path('src/styles/research-page.css')
text = p.read_text(encoding='utf-8')
text = text.replace('--research-trunk-color: color-mix(in srgb, var(--color-border-strong) 78%, transparent);', '--research-trunk-color: color-mix(in srgb, var(--color-border-strong) 78%, transparent);\n  --research-focus-color: var(--color-accent-violet);', 1)
text = text.replace('  transform: translate(-50%, -50%);', '  translate: -50% -50%;\n  transform: none;', 1)
text = text.replace(".research-tree-edge[data-highlighted='true'] {\n  stroke: var(--color-accent);\n  stroke-width: 3;\n  opacity: 0.95;\n}\n\n.research-tree-edge[data-related='true'] {\n  stroke: color-mix(in srgb, var(--color-accent) 62%, var(--color-border-strong));\n  opacity: 0.76;\n}", ".research-tree-edge[data-related='true'] {\n  stroke: color-mix(in srgb, var(--research-focus-color) 62%, var(--color-border-strong));\n  opacity: 0.76;\n}\n\n.research-tree-edge[data-highlighted='true'] {\n  stroke: var(--research-focus-color);\n  stroke-width: 3;\n  opacity: 0.95;\n}", 1)
text = text.replace('var(--color-accent)', 'var(--research-focus-color)')
p.write_text(text, encoding='utf-8')

p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
text = p.read_text(encoding='utf-8')
old = '选中科技后固定高亮其完整上游前置路径，并以较弱强调显示直接后继及其连线，不得用颜色作为唯一关系表达。'
new = old + '科技节点的结构定位不得复用 `transform` 承担中心校正，结构中心校正必须与 hover／active 的交互变换分离，悬浮和按压不得改变节点所属树坐标或造成大距离位移。选中科技只能改变节点和连接线的强调状态，所有既有依赖线必须继续可见；高亮色必须引用设计系统中实际存在的令牌，且完整上游高亮规则的级联优先级必须高于较弱的直接后继强调。'
if text.count(old) != 1:
    raise SystemExit('design marker mismatch')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
