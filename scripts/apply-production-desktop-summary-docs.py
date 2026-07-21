from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    content = target.read_text(encoding='utf-8')
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    target.write_text(content.replace(old, new, 1), encoding='utf-8')


replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    '- `.page-scroll-area` 与 `.page-scroll` 铺满工作区，桌面左右 padding 为 `0`；页面顶部避让固定为“沟槽 + 状态栏高度 + 沟槽”；\n- `.page-content` 使用 `width: 100%`、`max-width: none`、`margin: 0`，左侧 padding 为 `0`，右侧与底部 padding 使用 `--desktop-layout-gutter`；最外层页面网格的右边缘必须与状态栏右边缘共线；',
    '- `.page-scroll-area` 与 `.page-scroll` 铺满工作区，桌面左右 padding 为 `0`；页面顶部避让固定为“沟槽 + 状态栏高度 + 沟槽”；\n- 页面顶部避让必须集中为 `--desktop-page-top-offset`，其值固定由“`--desktop-layout-gutter` + `--desktop-asset-bar-height` + `--desktop-layout-gutter`”派生；需要避让状态栏的桌面 sticky 一级卡片必须直接读取该令牌，底部余量继续读取 `--desktop-layout-gutter`，不得重复维护另一套顶部数值。\n- `.page-content` 使用 `width: 100%`、`max-width: none`、`margin: 0`，左侧 padding 为 `0`，右侧与底部 padding 使用 `--desktop-layout-gutter`；最外层页面网格的右边缘必须与状态栏右边缘共线；',
)
replace_once(
    'README.md',
    '- 生产管理区采用工厂集群主从布局：桌面由常驻建设卡、按正式目录排序的紧凑集群选择器和单张当前详情卡组成；961px–1380px 保持建设卡左列、选择器与详情右列，低于 960px 改为单列。移动端不展开全部详情，点击选择卡或“查看详情”后从底部打开悬浮详情框，默认选中正式目录中的第一种已拥有工厂但首次进入不自动弹出。',
    '- 生产管理区采用工厂集群主从布局：大于等于 1600px 时建设卡、两列工厂集群选择器和自然高度的当前详情卡紧凑排列，详情宽度上限为 680px；1381px–1599px 保持三列单列选择器，961px–1380px 保持建设卡左列、选择器与详情右列，低于 960px 改为单列。移动端不展开全部详情，点击选择卡或“查看详情”后从底部打开悬浮详情框，默认选中正式目录中的第一种已拥有工厂但首次进入不自动弹出。',
)
