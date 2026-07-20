# Economy 游戏外壳布局设计

> 状态：当前实现与不可回退规则  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-20

## 1. 目标

登录后的游戏网页覆盖整个视口。桌面使用左侧侧栏和右侧工作区的水平双列结构；移动端由 `.workspace` 统一提供左右安全边距，并在同一个工作区内容框内叠放页面层和外壳层。

```text
.game-shell
├─ .desktop-sidebar
└─ .workspace
   ├─ .mobile-page-overlay
   │  └─ .page-scroll-area
   │     └─ .page-scroll
   │        └─ .page-content
   └─ .mobile-chrome-overlay
      ├─ .asset-bar-scroll-area
      │  └─ .asset-bar-scroll-track
      │     └─ .asset-bar
      └─ .mobile-bottom-navigation
```

桌面端两个移动包装层使用 `display: contents`，不改变既有桌面结构。移动端两个包装层占据同一个 Grid 单元：页面层负责纵向滚动，外壳层承载顶部状态栏和底部导航。

## 2. 唯一几何权威

`src/styles/game-shell-layout.css` 是桌面外壳最终几何权威；`src/styles/viewport.css` 是移动工作区、两层 Overlay、页面避让和安全区的最终几何权威。样式顺序固定为 `viewport.css` → `scrollbars.css` → `game-shell-layout.css`。

- `globals.css` 只提供历史通用基础布局；其中旧的 `.game-shell` 间距和 `.page-content` 最大宽度不得成为最终计算样式。
- `desktop-sidebar.css` 负责侧栏内部布局、展开／折叠宽度和过渡。
- `viewport.css` 负责固定视口、原生滚动视口、移动 `.workspace` 内边距、两层 Overlay、安全区和上下避让。
- `scrollbars.css` 负责覆盖式滚动条，不参与状态栏宿主或工作区几何占位。
- `game-shell-layout.css` 统一收束桌面双列轨道、共享外距、工作区边界和页面全宽规则。
- `mobile-status-navigation.css` 定义移动工作区统一间距和外壳尺寸令牌，只负责状态栏与导航内部布局。
- `mobile-status-layout.css` 只收束移动状态项密度和固定高度，不得重新给页面或外壳设置水平边距。

## 3. 桌面水平双列结构

大于 `720px` 时：

- `.game-shell` 固定覆盖整个视口，`padding` 和 `gap` 的最终计算值必须为 `0`。
- 第一列宽度由“侧栏左侧外边距 + 侧栏实际宽度 + 侧栏与工作区间隔”组成。
- 第二列 `.workspace` 使用剩余全部宽度，并贴合视口顶部、右侧和底部。
- 侧栏展开／折叠只能改变 `--sidebar-column-width`；状态栏和页面跟随同一个工作区起点移动。
- `--desktop-shell-outer-inset` 是侧栏和状态栏唯一桌面外距令牌。
- `--desktop-sidebar-workspace-gap` 默认引用 `--desktop-shell-outer-inset`，不得复制硬编码间距。

桌面默认值：

- 侧栏展开宽度：`224px`；
- 侧栏折叠宽度：`78px`；
- 统一桌面外距：`12px`；
- 侧栏与工作区间隔：`12px`；
- 过渡时长继续由桌面侧栏设计控制。

`721px–960px` 使用自动紧凑侧栏，并把统一桌面外距降为 `8px`。矮桌面继续使用 `.45rem`，但不得恢复整个 `.game-shell` 的 padding 或 grid gap。

## 4. 桌面侧栏规则

`.desktop-sidebar` 使用统一桌面外距：

- 左、上、下边距相同；
- 右侧不使用 margin，侧栏与工作区的距离由第一列轨道中的 gap 变量提供；
- 侧栏高度为视口高度减去上下外边距；
- 展开和折叠时 Logo、导航图标及底部操作的锚点继续保持稳定；
- 中部导航使用共享纵向 `ScrollArea`，只有实际滚动后显示纵向滚动条。

不得给整个桌面 `.game-shell`、`.workspace`、`.page-scroll-area`、`.page-scroll` 或 `.page-content` 添加外边距来模拟侧栏留白。

## 5. 桌面工作区、状态栏和页面

桌面 `.workspace` 是无外边距的完整矩形：

- `top = 0`；
- `right = viewport.right`；
- `bottom = viewport.bottom`；
- `width = viewport.width - workspace.left`。

`.asset-bar-scroll-area` 位于 `.workspace` 内部：

- 左边缘与工作区左边缘一致；
- 顶部和右侧使用 `--desktop-shell-outer-inset`；
- 使用 `left: 0`、`right: var(--desktop-shell-outer-inset)` 和 `width: auto`；
- 不设置独立侧栏偏移、最大宽度或居中 margin；
- 内部 `.asset-bar` 是横向原生滚动视口，不再负责绝对定位；
- 状态栏外距不改变 `.workspace` 和页面主体的宽度。

`.page-scroll-area` 和 `.page-scroll` 始终铺满工作区，只保留“统一桌面外距 + 状态栏高度 + 状态栏下间距”的顶部避让和底部内容空间；桌面左右 padding 必须为 `0`。

页面纵向滚动条使用共享覆盖式规则：

- `.page-scroll` 始终保持 `overflow-y: auto`，原生滚动条视觉隐藏，覆盖式轨道不占布局空间；
- 初始和无实际纵向滚动状态下纵向轨道透明；
- 只有 `scrollTop` 确实变化才显示纵向滚动条；鼠标移动、点击、焦点、滚轮或按键事件本身不算滚动活动；
- 停止实际纵向滚动 `1200ms` 后恢复透明；
- 普通滚轮默认垂直滚动，滚动到边界后允许滚动链传递；
- 完整滚动规则以 `docs/OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md` 为专题权威。

桌面 `.page-content` 必须使用工作区全部可用宽度：`width: 100%`、`max-width: none`、`margin: 0`，左右 padding 为 `0`。

## 6. 移动工作区统一水平间距

不大于 `720px` 时，`.workspace` 是移动端水平几何的唯一权威：

- `--mobile-workspace-gutter` 固定引用 `var(--space-3)`，当前为 `12px`；
- `--mobile-primary-surface-gap` 必须引用 `--mobile-workspace-gutter`；
- `.workspace` 将自身 `--layout-gutter` 设为 `--mobile-primary-surface-gap`，使一级卡片间距与工作区左右内边距保持相同；
- 左内边距为 `max(var(--mobile-workspace-gutter), env(safe-area-inset-left))`；
- 右内边距为 `max(var(--mobile-workspace-gutter), env(safe-area-inset-right))`；
- 页面层、状态栏和底部导航均填满 `.workspace` 的内容框，不得再次设置独立水平 inset；
- `.page-scroll` 的左右 padding 必须为 `0`，防止与 `.workspace` 形成双重边距；
- 一级卡片自身只管理内部 padding，卡片之间的外部距离继续由布局容器的 `gap` 管理，不得给所有 `.panel` 添加统一 margin。

CSS 中所称“移动端全局左右外边距”必须使用 `.workspace` 的 `padding-inline` 实现，不能使用会缩短或偏移整个固定视口外壳的 `margin-inline`。

## 7. 移动两层 Overlay

移动 `.workspace` 使用一个单格 Grid，`.mobile-page-overlay` 和 `.mobile-chrome-overlay` 同时占据第一行第一列：

- `.mobile-page-overlay` 使用 `z-index: 1`，承载通知和唯一页面纵向 `ScrollArea`；
- `.mobile-chrome-overlay` 使用 `z-index: 10`，承载状态栏和导航栏；
- Chrome Overlay 自身使用 `pointer-events: none`，只有状态栏和导航栏恢复 `pointer-events: auto`，透明区域不得阻断页面触控滚动；
- 两个 Overlay 的边界必须等于 `.workspace` 的内容框，因此状态栏、一级卡片和底栏左右边缘天然共线；
- 页面滚动时内容允许进入玻璃状态栏和底栏后方，但初始标题与最后一项操作必须通过上下 padding 完整避让外壳。

移动状态栏：

- 相对于 `.mobile-chrome-overlay` 使用 `position: absolute`；
- `left: 0`、`right: 0`，不得再读取独立左右安全区变量；
- 顶部使用 `max(var(--mobile-chrome-block-inset), env(safe-area-inset-top))`；
- 高度、最小高度和最大高度都固定为 `48px`；
- `.asset-bar-scroll-track` 和 `.asset-bar` 可以使用 `height: 100%` 填满固定宿主，但 `scrollbars.css` 不得给 `.asset-bar-scroll-area` 设置 `height: 100%`。

移动底部导航：

- 与状态栏处于同一个 Chrome Overlay；
- 使用 `position: absolute`，不得继续相对视口使用 `position: fixed`；
- `left: 0`、`right: 0`；
- 底部使用 `max(var(--mobile-chrome-block-inset), env(safe-area-inset-bottom))`；
- 高度、最小高度和最大高度都固定为 `68px`。

## 8. 验收标准

桌面至少检查 `1684×931`、`1440×900`、`1024×768` 和 `900×768`：

1. `.game-shell` 四边与视口一致，最终 `padding` 和 `gap` 均为 `0`。
2. 侧栏左、上、下外边距符合当前 `--desktop-shell-outer-inset`。
3. 工作区与侧栏之间的距离符合当前 gap 变量。
4. `.workspace` 贴合视口顶部、右侧和底部。
5. `.asset-bar-scroll-area` 左边缘与工作区一致，顶部和右侧间距等于统一桌面外距。
6. `.page-scroll-area` 与 `.workspace` 左右边界一致，页面不存在非预期水平滚动。
7. 展开与折叠侧栏后上述关系保持成立。
8. 页面纵向滚动条初始透明，实际滚动后显示，停止 `1200ms` 后重新透明；显隐前后页面宽度不变化。

移动至少检查 `430px`、`390px`、`375px`、`360px` 和 `320px`：

1. `.workspace` 左右计算 padding 等于 `12px` 或更大的对应安全区。
2. 页面 Overlay 和 Chrome Overlay 占据同一内容框。
3. 状态栏、页面一级卡片和底部导航左右边缘共线。
4. `.page-scroll` 左右计算 padding 为 `0`。
5. 状态栏始终为 `48px`，不得被 ScrollArea 拉伸为工作区高度。
6. 底部导航始终为 `68px`，并相对于工作区定位。
7. Chrome Overlay 透明区域不阻断页面滑动，状态栏和导航按钮仍可点击。
8. 初始标题位于状态栏下方，最后一张卡和操作可以滚动到导航栏上方。
9. 页面不存在双重水平内边距或水平滚动。

## 9. 不可回退规则

除非先更新本设计文档和架构检查，否则不得：

- 给桌面 `.game-shell` 恢复 padding 或 grid gap；
- 给桌面 `.workspace` 添加顶部、右侧或底部外边距；
- 让状态栏和页面分别读取侧栏宽度或维护两套左偏移；
- 给状态栏单独硬编码与侧栏不同的桌面外距；
- 把绝对定位重新放回内部 `.asset-bar`，或给桌面包装器恢复 `top: 0`、`right: 0`；
- 给游戏 `.page-content` 恢复 `--content-max-width`、`margin: 0 auto` 或桌面左右 padding；
- 为隐藏滚动条把 `.page-scroll` 改成 `overflow-y: hidden`；
- 恢复 `scrollbar-gutter: stable`、原生滚动条占位或 GameShell 内的指针／焦点计时器；
- 把侧栏外边距重新移动到整个游戏外壳；
- 通过 JavaScript、ResizeObserver 或滚动事件计算工作区横向位置；
- 在移动页面层、状态栏或导航栏重新增加独立左右 inset；
- 把移动左右内边距重新放回 `.page-scroll`；
- 让移动工作区 gutter 与一级卡片 gap 使用不同数值；
- 把移动底栏移回 `.workspace` 外部或恢复 `position: fixed`；
- 给 `.mobile-chrome-overlay` 恢复会拦截整屏触控的 `pointer-events: auto`；
- 在 `scrollbars.css` 中重新给 `.asset-bar-scroll-area` 设置 `height: 100%`；
- 破坏移动状态栏 `48px`、底栏 `68px`、上下安全区或最后一项内容避让；
- 绕过浏览器几何测试合并布局回退。
