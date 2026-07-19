# Economy 游戏外壳布局设计

> 状态：当前实现与不可回退规则
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-07-19

## 1. 目标

登录后的游戏网页使用覆盖整个视口的水平双列结构：左侧是具有独立外边距的桌面侧栏，右侧是无外边距的工作区。状态栏和所有页面内容都属于同一个右侧工作区，不得分别计算侧栏偏移。

```text
.game-shell
├─ .desktop-sidebar
└─ .workspace
   ├─ .asset-bar
   └─ .page-scroll
      └─ .page-content
```

## 2. 唯一几何权威

`src/styles/game-shell-layout.css` 是登录后游戏外壳最终几何权威，并在 `viewport.css` 之后加载。

- `globals.css` 只提供历史通用基础布局；其中旧的 `.game-shell` 间距和 `.page-content` 最大宽度不得成为最终计算样式。
- `desktop-sidebar.css` 负责侧栏内部布局、展开／折叠宽度和过渡。
- `viewport.css` 负责固定视口、滚动容器、安全区和移动端结构。
- `game-shell-layout.css` 统一收束桌面双列轨道、侧栏外边距、工作区边界和页面全宽规则。

## 3. 桌面水平双列结构

大于 `720px` 时：

- `.game-shell` 固定覆盖整个视口，`padding` 和 `gap` 的最终计算值必须为 `0`。
- 第一列宽度由“侧栏左侧外边距 + 侧栏实际宽度 + 侧栏与工作区间隔”组成。
- 第二列 `.workspace` 使用剩余全部宽度，并贴合视口顶部、右侧和底部。
- 侧栏展开／折叠只能改变 `--sidebar-column-width`；状态栏和页面跟随同一个工作区起点移动。

桌面默认值：

- 侧栏展开宽度：`224px`；
- 侧栏折叠宽度：`78px`；
- 侧栏外边距：`12px`；
- 侧栏与工作区间隔：`12px`；
- 过渡时长继续由桌面侧栏设计控制。

`721px–960px` 使用自动紧凑侧栏，并把侧栏外边距和工作区间隔降为 `8px`。矮桌面继续使用 `.45rem`，但不得恢复整个 `.game-shell` 的 padding 或 grid gap。

## 4. 侧栏规则

只有 `.desktop-sidebar` 拥有桌面外边距：

- 左、上、下边距相同；
- 右侧不使用 margin，侧栏与工作区的距离由第一列轨道中的专用 gap 变量提供；
- 侧栏高度为视口高度减去上下外边距；
- 展开和折叠时 Logo、导航图标及底部操作的锚点继续保持稳定。

不得给整个 `.game-shell`、`.workspace`、`.page-scroll` 或 `.page-content` 添加桌面外边距来模拟侧栏留白。

## 5. 工作区、状态栏和页面

`.workspace` 是无外边距的完整矩形：

- `top = 0`；
- `right = viewport.right`；
- `bottom = viewport.bottom`；
- `width = viewport.width - workspace.left`。

`.asset-bar` 始终铺满 `.workspace` 顶部，不设置独立侧栏偏移、最大宽度或居中 margin。桌面液态玻璃只保留下方圆角，使状态栏与视口顶部和右侧形成连续边界。

`.page-scroll` 始终铺满工作区，只保留顶部状态栏避让和底部内容空间；桌面左右 padding 必须为 `0`，滚动条位于工作区最右边。

`.page-content` 在游戏表面中必须：

- `width: 100%`；
- `max-width: none`；
- `margin: 0`；
- 左右 padding 为 `0`。

页面标题可以拥有自身局部 padding。卡片、网格、表单和列表继续管理各自内部 padding 与项目 gap；不得通过恢复 `.page-content` 的外层间距解决页面内部排版。

## 6. 移动端

不大于 `720px` 时继续使用单列移动结构：

- 桌面侧栏隐藏；
- 移动状态栏、页面内容和底部导航继续尊重安全区；
- `mobile-content-inset` 属于移动触控安全区，不受桌面无外边距规则影响；
- 移动状态栏继续使用胶囊圆角。

## 7. 验收标准

至少在 `1684×931`、`1440×900`、`1024×768` 和 `900×768` 检查：

1. `.game-shell` 四边与视口一致。
2. `.game-shell` 的最终 `padding` 和 `gap` 均为 `0`。
3. 侧栏左、上、下外边距符合当前断点变量。
4. 工作区与侧栏之间的距离符合当前断点变量。
5. `.workspace` 贴合视口顶部、右侧和底部。
6. `.asset-bar` 与 `.workspace` 左右边界一致。
7. `.page-scroll` 与 `.workspace` 左右边界一致。
8. `.page-content` 使用页面滚动区全部可用内容宽度，没有居中最大宽度和左右外层 padding。
9. 展开与折叠侧栏后，上述关系都保持成立。
10. 页面不存在非预期水平滚动，最右侧卡片和内容不得被裁切。

## 8. 不可回退规则

除非先更新本设计文档和架构检查，否则不得：

- 给桌面 `.game-shell` 恢复 padding 或 grid gap；
- 给 `.workspace` 添加顶部、右侧或底部外边距；
- 让状态栏和页面分别读取侧栏宽度或维护两套左偏移；
- 给游戏 `.page-content` 恢复 `--content-max-width`、`margin: 0 auto` 或左右 padding；
- 把侧栏外边距重新移动到整个游戏外壳；
- 通过 JavaScript、ResizeObserver 或滚动事件计算工作区横向位置；
- 破坏移动端安全区与移动内容内边距；
- 绕过浏览器几何测试合并布局回退。
