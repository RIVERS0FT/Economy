from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')

def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))

replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '> 更新时间：2026-07-24',
    '> 更新时间：2026-07-25',
)
replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '| `src/styles/desktop-sidebar.css` | 桌面侧栏宽度、折叠、导航固有行高、市场角标与可访问状态 |',
    '| `src/styles/desktop-sidebar.css` | 桌面侧栏宽度、折叠、导航固有行高、统一导航数字角标与可访问状态 |',
)
replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 市场未完成订单角标必须使用 `.sidebar-nav-count`：展开态固定在第三网格列的右侧；折叠态与 `721px–960px` 自动紧凑侧栏固定在按钮内部右上角，使用非负 `top`／`right` 内边距，不得伸出按钮或依赖父容器裁剪。可见数字最多显示 `999+`，完整数量必须保留在按钮 `aria-label` 与角标 `title` 中。',
    '- 正式页面导航角标必须使用单一 `.navigation-badge`：一个页面最多显示一个绿色数字角标，颜色固定沿用 `var(--color-success)` 与 `var(--color-on-primary)`；可见数字只显示 `1`～`99`，超过显示 `99+`，完整数量与组成必须保留在按钮 `aria-label` 与角标 `title` 中。展开态固定在第三网格列右侧；折叠态、`721px–960px` 自动紧凑侧栏和移动底栏固定在按钮内部右上角，使用非负 `top`／`right`，不得伸出按钮或依赖父容器裁剪。角标不得拆成双项、多项、带前缀数字或多个圆点。',
)
replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 把市场角标恢复为固定 `left` 坐标、让展开态角标离开第三网格列，或让折叠态角标伸出按钮并依赖侧栏裁剪；',
    '- 恢复市场专用角标、双项／多项角标、超过 `99+` 的可见上限、固定 `left` 坐标，让展开态角标离开第三网格列，或让折叠态角标伸出按钮并依赖侧栏裁剪；',
)

replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '> 更新时间：2026-07-24',
    '> 更新时间：2026-07-25',
)
replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '### 2.1 状态交付容量',
    '''### 2.1 统一导航角标

九个正式页面共用同一单数字角标能力。一个页面最多显示一个绿色数字角标，使用当前市场角标颜色；可见值上限为 `99+`。角标只表达需要关注的唯一业务对象数量，多种来源必须先按业务 ID 求并集，禁止直接相加、拆成双项／多项角标或用颜色区分来源。完整分项说明只进入导航按钮 `aria-label` 与角标 `title`。

| 页面 | 当前角标规则 |
|---|---|
| 概览 | 暂不显示，保留通用能力 |
| 市场 | 当前玩家 `open`／`partial` 未完成订单数量；访问页面不清除 |
| 生产 | 异常工厂组 ID 与仓库容量问题 ID 的并集；问题解除后消失 |
| 资产 | 暂不显示，保留通用能力 |
| 拍卖 | 拍卖角标按拍卖 ID 对“新拍卖”和“被超价拍卖”求并集；访问拍卖页只清除新拍卖，仍被超价的进行中拍卖继续保留 |
| 合同 | 合同角标按合同 ID 对“新合同”和“需要处理合同”求并集；访问合同页只清除新合同，真实履约问题继续保留 |
| 排行 | 服务器排行榜周期键变化表示一次新结算完成，固定显示 `1`，访问排行页后清除；首次启用以当前周期建立基线 |
| 商店 | 暂不显示，保留通用能力 |
| 设置 | 暂不显示，保留通用能力 |

“新拍卖”只统计其他玩家发布、当前仍进行且自上次查看后首次出现的拍卖；“被超价”只统计当前玩家曾出价但已不是最高出价者的进行中拍卖。“新合同”统计其他玩家新发布的可承接合同，以及新形成且当前玩家参与的履约合同；自己刚发布但尚未承接的公开合同不计为新合同。“需要处理合同”以活动合同实际 `issue` 为准，并应与服务器 `productionContractSummary.needsAttention` 保持一致。

新拍卖、新合同和排行榜结算的已读基线保存在按用户隔离的浏览器本地键 `economy:navigation-badges:v1:<userId>`。首次启用、存储缺失或损坏时直接以当前状态建立基线，不把历史对象误报为新；玩家停留在对应页面时到达的新对象直接视为已查看。市场、生产、被超价和合同履约问题属于当前权威状态，不保存为已读记录。资产、商店和设置未启用角标时不得提前增加轮询、接口或本地状态字段。

角标从现有六分区完整状态派生，不新增服务器接口、不改变轮询频率、不触发懒加载页面，也不得在根游戏模型增加每秒时钟。`NavigationItems` 只接收最终 `NavigationBadgeMap`，不得恢复 `openOrderCount` 或 `id === 'market'` 等页面专用渲染分支。

### 2.2 状态交付容量''',
)
replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '### 2.2 紧凑时间与排名',
    '### 2.3 紧凑时间与排名',
)
replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '### 2.3 登录与注册入口',
    '### 2.4 登录与注册入口',
)

readme = read('README.md')
rule = '- 九项正式页面共用单数字绿色导航角标：可见上限 `99+`，拍卖与合同按业务 ID 对多来源求并集，排行结算固定显示 `1`；资产、商店、设置和概览暂不显示但保留通用能力。\n'
if rule not in readme:
    marker = '## 当前关键规则\n\n'
    if marker not in readme:
        raise RuntimeError('README.md missing current key rules marker')
    write('README.md', readme.replace(marker, marker + rule, 1))

docs_index = read('docs/README.md')
index_rule = '43. 统一导航角标的单数字绿色视觉、`99+` 上限、拍卖／合同按业务 ID 合并去重、排行榜结算已读基线和页面启用范围属于页面与 UI 共同规则；必须同步更新 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`、`UI_DESIGN_SYSTEM.md`、共享角标组件、浏览器本地已读状态、`scripts/verify-navigation-badges.mjs` 与浏览器测试，不得恢复市场专用、双项或多项角标。'
if index_rule not in docs_index:
    write('docs/README.md', docs_index.rstrip() + '\n' + index_rule + '\n')

print('navigation badge changes applied')
