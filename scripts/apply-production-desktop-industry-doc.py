from pathlib import Path

path = Path('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md')
content = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global content
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'INDUSTRY design expected one match, found {count}')
    content = content.replace(old, new, 1)


replace_once(
    '- 使用 `position: sticky`，只在生产管理区范围内常驻。\n- 低于 960px 恢复普通文档流并位于工厂集群选择之前。',
    '- 使用 `position: sticky`，只在生产管理区范围内常驻；固定后的顶部偏移必须读取 `--desktop-page-top-offset`，不得使用独立 `--space-*` 或像素值重复计算状态栏避让。\n- sticky 最大高度必须扣除 `--desktop-page-top-offset` 与底部 `--desktop-layout-gutter`，使卡片上下均保留同一个桌面间隔。\n- 低于 960px 恢复普通文档流并位于工厂集群选择之前。',
)
replace_once(
    '- 大于 `1380px` 时生产管理区使用三列：建设卡 `280px–320px`、工厂集群选择 `260px–300px`、当前工厂详情最小 `480px` 并占据剩余宽度。\n- `961px–1380px` 时使用两列：建设卡位于左列，工厂选择和当前详情在右列上下排列。\n- `721px–960px` 时恢复单列文档流，顺序为建设卡、工厂选择、当前详情；详情仍直接显示，不使用悬浮框。\n- 桌面和平板只渲染一个当前工厂的完整详情，不再同时铺开所有完整工厂卡。',
    '- 大于等于 `1600px` 时使用紧凑三列：建设卡 `280px–320px`、工厂集群选择 `440px–520px` 并固定两列选择卡、当前工厂详情 `480px–680px`；三列从左侧开始排列，详情不得继续吞占全部剩余宽度。\n- `1381px–1599px` 时保持原三列：建设卡 `280px–320px`、工厂集群选择 `260px–300px`、当前工厂详情最小 `480px` 并占据剩余宽度；该区间选择卡保持单列。\n- `961px–1380px` 时使用两列：建设卡位于左列，工厂选择和当前详情在右列上下排列。\n- `721px–960px` 时恢复单列文档流，顺序为建设卡、工厂选择、当前详情；详情仍直接显示，不使用悬浮框。\n- 桌面和平板只渲染一个当前工厂的完整详情，不再同时铺开所有完整工厂卡。',
)
replace_once(
    '- 详情显示工厂名称和总数量、运行开关、完整状态、“运行中／下一周期加入／冻结中”三列摘要、生产配方、集群生产公式、生产进度、玩家可见配方利润分析和市场入口。',
    '- 详情显示工厂名称和总数量、运行开关、完整状态、“运行中／下一周期加入／冻结中”三列摘要、生产配方、集群生产公式、生产进度、玩家可见配方利润分析和市场入口。\n- 桌面详情卡高度由内容决定：详情壳使用交叉轴起始对齐，详情卡不得使用 `min-height: 100%`、弹性空白行或可见占位 spacer；市场入口紧跟在实际详情内容之后。\n- 桌面详情卡不得增加独立纵向滚动条；页面仍由唯一页面滚动视口负责纵向滚动。',
)
replace_once(
    '- 恢复同时铺开所有完整工厂卡、四列完整卡网格或瀑布流；\n- 按名称、数量、状态或最近操作重排工厂选择卡；',
    '- 恢复同时铺开所有完整工厂卡、四列完整卡网格或瀑布流；\n- 在 `1600px` 及以上把工厂集群选择恢复为单列，或让当前详情列继续扩张到超过 `680px`；\n- 让桌面详情壳恢复交叉轴拉伸、`min-height: 100%`、弹性空白行或可见占位 spacer；\n- 让 sticky 建设卡使用独立 `--space-*` 或像素顶部值，而不是统一的 `--desktop-page-top-offset`；\n- 按名称、数量、状态或最近操作重排工厂选择卡；',
)

path.write_text(content, encoding='utf-8')
