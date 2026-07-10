# 金融帝国界面设计规范

本文件记录已经确定的界面规则。涉及相同组件的后续修改应优先更新本文件，再修改实现，避免样式在不同 PR 中反复回退。

## 1. 卡片圆角

- 桌面端卡片统一使用 `1.5rem`。
- 移动端卡片统一使用 `2.5rem`。
- 圆角统一由 `src/styles/card-system.css` 中的 `--card-radius` 控制。
- 输入框、按钮、头像、状态标签等控件不是卡片，不跟随大圆角变量。

## 2. 移动端顶部状态栏与底部导航栏

顶部状态栏指 `.asset-bar.panel`，底部导航栏指 `.sidebar.panel`。

### 2.1 外边距与应用画布

- 顶部状态栏和底部导航栏使用同一个变量：`--mobile-chrome-inset`。
- `--mobile-chrome-inset` 固定为 `1rem`，与移动端登录页 `.login-shell` 的 `margin: 1rem auto` 保持一致。
- 页面滚动内容左右外边距使用独立变量：`--mobile-content-inset`。
- `--mobile-content-inset` 固定为 `.4rem`，不得跟随上下栏外边距增大。
- 底部导航在有系统安全区时使用：
  `max(--mobile-chrome-inset, env(safe-area-inset-bottom))`。
- 移动端 `.game-shell` 必须使用 `padding: 0` 并完整覆盖视口。
- 上下栏外边距只能施加在栏本身，不能施加在整个应用画布上。
- 页面内容外边距只能通过 `.page-scroll` 的左右 padding 设置，不能复用 `--mobile-chrome-inset`。

### 2.2 液态玻璃背景

- 顶部状态栏和底部导航栏必须使用同一套液态玻璃表面变量。
- 液态玻璃由统一半透明纯色、完整边框、背景模糊、饱和度增强、亮度增强、内侧高光和外部柔和阴影共同组成。
- 当前背景变量为 `--mobile-liquid-glass-surface`，边框变量为 `--mobile-liquid-glass-border`。
- `backdrop-filter` 与 `-webkit-backdrop-filter` 必须同时保留。
- 上下栏不得使用从不透明到透明的背景渐变。
- 不得改为完全不透明背景，否则后方内容不能参与混合，液态玻璃效果会消失。
- 顶部和底部必须使用完全一致的背景、模糊、边框和阴影参数，不能分别实现两套玻璃效果。

### 2.3 顶部状态栏

- 顶部资产信息应压缩为状态栏，不使用大段说明文本。
- 每个状态项采用水平布局：左侧为无底座图标，右侧为“数字在上、文字在下”。
- 顶部图标不得使用独立边框、圆角或背景底座。
- 移动端第三行补充信息隐藏，避免状态栏高度膨胀。
- 状态项卡片本身保留独立边框和圆角，主要资产项只允许使用纯色半透明高亮。
- 状态栏保持横向滚动，宽度不足时显示后续状态项。
- 状态栏高度由 `--mobile-asset-bar-height` 控制，当前为 `68px`。

### 2.4 底部导航栏

- 底部导航卡片本身只保留上下内边距，不使用固定左右内边距。
- 左右留白属于 `.sidebar-nav` 的可滚动内容，不属于 `.sidebar.panel` 的固定 padding。
- 左右留白由 `.sidebar-nav::before` 和 `.sidebar-nav::after` 提供，并使用 `--mobile-nav-scroll-gutter` 控制宽度。
- 当前 `--mobile-nav-scroll-gutter` 为 `1.25rem`。
- 两侧留白必须跟随导航按钮一起横向滚动；滚动到最左或最右时，首尾按钮与卡片圆角之间仍应保留完整空白。
- 不得用 `.sidebar.panel` 的左右 padding 模拟该空白，否则空白不会随滚动移动，且首尾按钮仍可能在滚动边界被裁剪。
- 导航图标直接显示，不使用独立边框、圆角或背景底座。
- 导航文字保持完整显示，字号不得恢复为 `.58rem` 的旧值。
- 选中项使用按钮级纯色半透明背景、完整边框和图标高亮，不得给图标本身重新添加底座。
- 不得恢复线性渐变或仅使用顶部细线表示选中状态。
- 未选中项保持低对比度，但文字和图标仍应清晰可读。
- 底部导航栏高度由 `--mobile-nav-height` 控制，当前为 `76px`。

### 2.5 边框

- 顶部状态栏和底部导航栏必须保留完整四边边框。
- 边框由 `--mobile-liquid-glass-border` 统一控制。
- 不得使用 `border-bottom-color: transparent` 或其他方式隐藏任意一边。
- 底部左右圆角处的边框弧线必须连续，不能提前中断。

### 2.6 层级与滚动透视

- 移动端 `.workspace` 和 `.page-scroll` 必须完整覆盖应用视口。
- 顶部状态栏使用绝对定位覆盖在滚动内容上方，并单独使用 `--mobile-chrome-inset` 定位。
- 底部导航使用固定定位悬浮在滚动内容上方，并单独使用同一外边距变量定位。
- `.page-scroll` 仍是登录后页面唯一的纵向页面滚动容器。
- `.page-scroll` 自身铺满视口，左右内容间距统一使用 `--mobile-content-inset: .4rem`。
- 最后一张内容卡片必须能够完整滚动到导航栏上方。

### 2.7 非页面滚动容器

- `.page-scroll` 可以使用 `overscroll-behavior: contain`，避免页面滚动越过应用边界。
- `.asset-bar`、`.sidebar-nav`、`.table-wrap`、`.ledger-list` 和 `.market-stat-strip` 不得使用 `overscroll-behavior: contain`。
- 上述非页面滚动容器必须使用 `overscroll-behavior: auto`，到达滚动边界后释放后续手势，不再继续消耗滚动。
- 横向滚动容器必须允许横向和纵向触摸手势，由浏览器将不能继续滚动的手势交还给上层。

## 3. 导航文案

底部导航和桌面侧边导航共用同一套简短中文名称：

- `home`：`概览`
- `market`：`市场`
- `production`：`生产`
- `assets`：`资产`
- `leaderboard`：`排行`
- `records`：`订单`
- `settings`：`设置`

不得恢复为“主页面”“排行榜”“订单与记录”等较长文案。移动端导航名称应保持两个汉字以内。

## 4. 实现位置

- 圆角系统：`src/styles/card-system.css`
- 移动端基础定位、边距和滚动预留：`src/styles/viewport.css`
- 移动端状态栏、导航栏、液态玻璃效果与滚动留白：`src/styles/mobile-status-navigation.css`
- 基础布局与组件样式：`src/styles/globals.css`
- 样式加载顺序、品牌与导航文案同步：`src/main.tsx`

## 5. 修改检查清单

修改移动端顶部状态栏、底部导航栏或滚动行为前，必须确认：

1. `.game-shell` 是否仍为 `padding: 0` 并完整铺满视口；
2. 上下栏外边距是否仍由 `--mobile-chrome-inset: 1rem` 控制；
3. 页面内容左右外边距是否仍由 `--mobile-content-inset: .4rem` 独立控制；
4. 上下栏是否仍共用同一套液态玻璃背景、边框、模糊和阴影参数；
5. `backdrop-filter` 和 `-webkit-backdrop-filter` 是否仍启用；
6. 上下栏是否没有透明度渐变；
7. 顶部状态项是否仍为“无底座图标 + 数字在上、文字在下”的紧凑布局；
8. 顶部状态栏是否仍隐藏第三行补充信息；
9. 底部导航卡片是否没有固定左右 padding；
10. 左右滚动留白是否仍由 `.sidebar-nav::before` 和 `.sidebar-nav::after` 提供；
11. 左右留白是否会跟随按钮滚动，并在滚动边界完整显示；
12. 底部导航图标是否仍无独立底座；
13. 图标和文字是否保持放大后的尺寸；
14. 选中项是否仍使用按钮级纯色半透明背景、边框和图标高亮；
15. 上下栏四边边框和圆角弧线是否完整；
16. 非页面滚动容器是否仍在边界释放滚动手势；
17. 最后一张内容卡片是否能完整滚动到导航栏上方；
18. 是否同步更新了本设计文档。
