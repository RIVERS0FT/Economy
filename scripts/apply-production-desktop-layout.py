from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding='utf-8')
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:120]!r}')
    file_path.write_text(content.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/styles/game-shell-layout.css',
    '''    --desktop-status-gap: var(--desktop-layout-gutter);\n    --layout-gutter: var(--desktop-layout-gutter);\n\n    width: 100%;''',
    '''    --desktop-status-gap: var(--desktop-layout-gutter);\n    --layout-gutter: var(--desktop-layout-gutter);\n    --desktop-page-top-offset: calc(\n      var(--desktop-layout-gutter)\n      + var(--desktop-asset-bar-height)\n      + var(--desktop-layout-gutter)\n    );\n\n    width: 100%;''',
)
replace_once(
    'src/styles/game-shell-layout.css',
    '''    padding-top: calc(\n      var(--desktop-layout-gutter)\n      + var(--desktop-asset-bar-height)\n      + var(--desktop-layout-gutter)\n    );\n    padding-right: 0;\n    padding-left: 0;\n    scroll-padding-top: calc(\n      var(--desktop-layout-gutter)\n      + var(--desktop-asset-bar-height)\n      + var(--desktop-layout-gutter)\n    );''',
    '''    padding-top: var(--desktop-page-top-offset);\n    padding-right: 0;\n    padding-left: 0;\n    scroll-padding-top: var(--desktop-page-top-offset);''',
)

replace_once(
    'src/styles/industry-system.css',
    '''  position: sticky;\n  top: var(--space-3);\n  align-self: start;''',
    '''  position: sticky;\n  top: var(--desktop-page-top-offset);\n  align-self: start;''',
)
replace_once(
    'src/styles/industry-system.css',
    '''  max-height: calc(100dvh - var(--space-6));\n  overflow-y: auto;''',
    '''  max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));\n  overflow-y: auto;''',
)

replace_once(
    'src/styles/facility-group-card-grid.css',
    '''.facility-cluster-detail-shell {\n  grid-area: detail;\n  min-width: 0;\n  display: flex;\n  align-self: stretch;\n  container-type: inline-size;\n}''',
    '''.facility-cluster-detail-shell {\n  grid-area: detail;\n  min-width: 0;\n  display: flex;\n  align-self: start;\n  container-type: inline-size;\n}''',
)
replace_once(
    'src/styles/facility-group-card-grid.css',
    '''.facility-cluster-detail-card {\n  width: 100%;\n  min-width: 0;\n  min-height: 100%;\n}''',
    '''.facility-cluster-detail-card {\n  width: 100%;\n  min-width: 0;\n  min-height: 0;\n}''',
)
replace_once(
    'src/styles/facility-group-card-grid.css',
    '''  display: grid;\n  grid-template-rows: auto auto auto minmax(0, 1fr) auto;\n  grid-auto-rows: auto;\n  align-content: stretch;\n  align-items: start;''',
    '''  display: grid;\n  grid-template-rows: auto;\n  grid-auto-rows: auto;\n  align-content: start;\n  align-items: start;''',
)
replace_once(
    'src/styles/facility-group-card-grid.css',
    '''.facility-card-spacer {\n  min-height: 0;\n}\n\n''',
    '',
)
replace_once(
    'src/styles/facility-group-card-grid.css',
    '''\n  .facility-card-spacer {\n    display: none;\n  }\n''',
    '\n',
)
replace_once(
    'src/styles/facility-group-card-grid.css',
    '''@media (min-width: 961px) and (max-width: 1380px) {''',
    '''@media (min-width: 1600px) {\n  .production-workspace {\n    grid-template-columns: minmax(280px, 320px) minmax(440px, 520px) minmax(480px, 680px);\n    justify-content: start;\n  }\n\n  .facility-cluster-selector-list {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n}\n\n@media (min-width: 961px) and (max-width: 1380px) {''',
)

replace_once(
    'src/pages/ProductionPage.tsx',
    '''      <div className="facility-card-spacer" aria-hidden="true" />\n''',
    '',
)

replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '''- 使用 `position: sticky`，只在生产管理区范围内常驻。\n- 低于 960px 恢复普通文档流并位于工厂集群选择之前。''',
    '''- 使用 `position: sticky`，只在生产管理区范围内常驻；固定后的顶部偏移必须读取 `--desktop-page-top-offset`，不得使用独立 `--space-*` 或像素值重复计算状态栏避让。\n- sticky 最大高度必须扣除 `--desktop-page-top-offset` 与底部 `--desktop-layout-gutter`，使卡片上下均保留同一个桌面间隔。\n- 低于 960px 恢复普通文档流并位于工厂集群选择之前。''',
)
replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '''- 大于 `1380px` 时生产管理区使用三列：建设卡 `280px–320px`、工厂集群选择 `260px–300px`、当前工厂详情最小 `480px` 并占据剩余宽度。\n- `961px–1380px` 时使用两列：建设卡位于左列，工厂选择和当前详情在右列上下排列。\n- `721px–960px` 时恢复单列文档流，顺序为建设卡、工厂选择、当前详情；详情仍直接显示，不使用悬浮框。\n- 桌面和平板只渲染一个当前工厂的完整详情，不再同时铺开所有完整工厂卡。''',
    '''- 大于等于 `1600px` 时使用紧凑三列：建设卡 `280px–320px`、工厂集群选择 `440px–520px` 并固定两列选择卡、当前工厂详情 `480px–680px`；三列从左侧开始排列，详情不得继续吞占全部剩余宽度。\n- `1381px–1599px` 时保持原三列：建设卡 `280px–320px`、工厂集群选择 `260px–300px`、当前工厂详情最小 `480px` 并占据剩余宽度；该区间选择卡保持单列。\n- `961px–1380px` 时使用两列：建设卡位于左列，工厂选择和当前详情在右列上下排列。\n- `721px–960px` 时恢复单列文档流，顺序为建设卡、工厂选择、当前详情；详情仍直接显示，不使用悬浮框。\n- 桌面和平板只渲染一个当前工厂的完整详情，不再同时铺开所有完整工厂卡。''',
)
replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '''- 详情显示工厂名称和总数量、运行开关、完整状态、“运行中／下一周期加入／冻结中”三列摘要、生产配方、集群生产公式、生产进度、玩家可见配方利润分析和市场入口。\n- 标题、开关、状态、摘要、配方和公式的语义与服务器状态保持不变；正式配方继续来自服务器目录。''',
    '''- 详情显示工厂名称和总数量、运行开关、完整状态、“运行中／下一周期加入／冻结中”三列摘要、生产配方、集群生产公式、生产进度、玩家可见配方利润分析和市场入口。\n- 桌面详情卡高度由内容决定：详情壳使用交叉轴起始对齐，详情卡不得使用 `min-height: 100%`、弹性空白行或占位 spacer；市场入口紧跟在实际详情内容之后。\n- 桌面详情卡不得增加独立纵向滚动条；页面仍由唯一页面滚动视口负责纵向滚动。\n- 标题、开关、状态、摘要、配方和公式的语义与服务器状态保持不变；正式配方继续来自服务器目录。''',
)
replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '''- 恢复同时铺开所有完整工厂卡、四列完整卡网格或瀑布流；\n- 按名称、数量、状态或最近操作重排工厂选择卡；''',
    '''- 恢复同时铺开所有完整工厂卡、四列完整卡网格或瀑布流；\n- 在 `1600px` 及以上把工厂集群选择恢复为单列，或让当前详情列继续扩张到超过 `680px`；\n- 让桌面详情壳恢复交叉轴拉伸、`min-height: 100%`、弹性空白行或占位 spacer；\n- 让 sticky 建设卡使用独立 `--space-*` 或像素顶部值，而不是统一的 `--desktop-page-top-offset`；\n- 按名称、数量、状态或最近操作重排工厂选择卡；''',
)

replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    '''- `.page-scroll-area` 与 `.page-scroll` 铺满工作区，桌面左右 padding 为 `0`；页面顶部避让固定为“沟槽 + 状态栏高度 + 沟槽”；\n- `.page-content` 使用 `width: 100%`、`max-width: none`、`margin: 0`，左侧 padding 为 `0`，右侧与底部 padding 使用 `--desktop-layout-gutter`；最外层页面网格的右边缘必须与状态栏右边缘共线；''',
    '''- `.page-scroll-area` 与 `.page-scroll` 铺满工作区，桌面左右 padding 为 `0`；页面顶部避让固定为“沟槽 + 状态栏高度 + 沟槽”；\n- 页面顶部避让必须集中为 `--desktop-page-top-offset`，其值固定由“`--desktop-layout-gutter` + `--desktop-asset-bar-height` + `--desktop-layout-gutter`”派生；需要避让状态栏的桌面 sticky 一级卡片必须直接读取该令牌，底部余量继续读取 `--desktop-layout-gutter`，不得重复维护另一套顶部数值。\n- `.page-content` 使用 `width: 100%`、`max-width: none`、`margin: 0`，左侧 padding 为 `0`，右侧与底部 padding 使用 `--desktop-layout-gutter`；最外层页面网格的右边缘必须与状态栏右边缘共线；''',
)

replace_once(
    'README.md',
    '''- 生产管理区采用工厂集群主从布局：桌面由常驻建设卡、按正式目录排序的紧凑集群选择器和单张当前详情卡组成；961px–1380px 保持建设卡左列、选择器与详情右列，低于 960px 改为单列。移动端不展开全部详情，点击选择卡或“查看详情”后从底部打开悬浮详情框，默认选中正式目录中的第一种已拥有工厂但首次进入不自动弹出。''',
    '''- 生产管理区采用工厂集群主从布局：大于等于 1600px 时建设卡、两列工厂集群选择器和自然高度的当前详情卡紧凑排列，详情宽度上限为 680px；1381px–1599px 保持三列单列选择器，961px–1380px 保持建设卡左列、选择器与详情右列，低于 960px 改为单列。移动端不展开全部详情，点击选择卡或“查看详情”后从底部打开悬浮详情框，默认选中正式目录中的第一种已拥有工厂但首次进入不自动弹出。''',
)

replace_once(
    'scripts/verify-game-shell-layout.mjs',
    '''  '--layout-gutter: var(--desktop-layout-gutter);',\n  'top: var(--desktop-layout-gutter);',''',
    '''  '--layout-gutter: var(--desktop-layout-gutter);',\n  '--desktop-page-top-offset: calc(',\n  'padding-top: var(--desktop-page-top-offset);',\n  'scroll-padding-top: var(--desktop-page-top-offset);',\n  'top: var(--desktop-layout-gutter);',''',
)
replace_once(
    'scripts/verify-game-shell-layout.mjs',
    '''forbid('src/styles/liquid-glass-surfaces.css', [\n  '--desktop-status-gap:',\n]);''',
    '''forbid('src/styles/liquid-glass-surfaces.css', [\n  '--desktop-status-gap:',\n]);\ncheck('src/styles/industry-system.css', [\n  'top: var(--desktop-page-top-offset);',\n  'max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));',\n]);\nforbid('src/styles/industry-system.css', [\n  'top: var(--space-3);',\n  'max-height: calc(100dvh - var(--space-6));',\n]);''',
)
replace_once(
    'scripts/verify-game-shell-layout.mjs',
    '''  '顶部状态栏不得包含 `ScrollArea`',\n]);''',
    '''  '顶部状态栏不得包含 `ScrollArea`',\n  '`--desktop-page-top-offset`',\n  '需要避让状态栏的桌面 sticky 一级卡片必须直接读取该令牌',\n]);''',
)

replace_once(
    'scripts/verify-unified-factory-recipes-grid.mjs',
    '''  '.facility-cluster-detail-card',\n  '.facility-detail-sheet-backdrop',''',
    '''  '.facility-cluster-detail-card',\n  '@media (min-width: 1600px)',\n  'minmax(440px, 520px)',\n  'minmax(480px, 680px)',\n  'justify-content: start;',\n  'align-self: start;',\n  '.facility-detail-sheet-backdrop',''',
)
replace_once(
    'scripts/verify-unified-factory-recipes-grid.mjs',
    '''  '--facility-card-height',\n  'height: var(--facility-card-height)',\n])''',
    '''  '--facility-card-height',\n  'height: var(--facility-card-height)',\n  'align-self: stretch;',\n  'min-height: 100%;',\n  'facility-card-spacer',\n  'grid-template-rows: auto auto auto minmax(0, 1fr) auto;',\n])''',
)
replace_once(
    'scripts/verify-unified-factory-recipes-grid.mjs',
    '''  '桌面和平板只渲染一个当前工厂的完整详情',\n  '不大于 `720px` 时页面内只显示当前选择栏和紧凑工厂选择网格',''',
    '''  '桌面和平板只渲染一个当前工厂的完整详情',\n  '大于等于 `1600px` 时使用紧凑三列',\n  '固定两列选择卡',\n  '桌面详情卡高度由内容决定',\n  '`--desktop-page-top-offset`',\n  '不大于 `720px` 时页面内只显示当前选择栏和紧凑工厂选择网格',''',
)
replace_once(
    'scripts/verify-unified-factory-recipes-grid.mjs',
    '''  'showNextCyclePreview = Boolean(pendingRecipe) || group.pendingJoinCount > 0',\n  'recipes.length === 1',''',
    '''  'showNextCyclePreview = Boolean(pendingRecipe) || group.pendingJoinCount > 0',\n  'recipes.length === 1',\n  'facility-card-spacer',''',
)
