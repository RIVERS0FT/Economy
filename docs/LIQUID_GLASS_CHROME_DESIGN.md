# Economy liquid-glass-react 应用外壳设计

> 状态：游戏与管理员桌面工作栏、移动状态栏、移动底部导航及登录后共享外壳几何基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-24

本文件定义应用外壳唯一液态玻璃实现、游戏端和管理员端登录后桌面应用外壳几何、移动工作区 Overlay、移动导航结构、浏览器运行时样式入口、性能约束和防回退规则。通用 UI、覆盖式滚动条和市场表格仍以 `docs/UI_DESIGN_SYSTEM.md` 为准。

## 1. 唯一材质来源

- `liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现。
- `src/components/ui/LiquidGlassSurface.tsx` 是唯一允许直接导入该依赖的文件。
- 玩家桌面状态栏、管理员桌面玻璃工作栏、移动状态栏和移动底栏只能使用 `LiquidGlassSurface` 预设，不得在业务组件中直接设置第三方参数。
- 桌面状态栏与管理员桌面玻璃工作栏必须使用独立的 `DESKTOP_STATUS_GLASS`；移动状态栏与移动底栏共同使用 `MOBILE_CHROME_GLASS`。桌面与移动不得再次合并为同一个参数常量。
- `StatusBar.tsx` 通过 `(max-width: 720px)` 媒体查询在 `desktopStatusBar` 与 `mobileStatusBar` 之间切换；任一时刻只能渲染一个状态栏玻璃实例，不得通过同时渲染两套后再用 CSS 隐藏。顶部状态栏不得包含 `ScrollArea`、原生滚动视口或项目自绘滚动条。
- `AdminDesktopBar.tsx` 只在桌面显示一个 `desktopStatusBar` 玻璃实例；管理员移动端不得渲染顶部玻璃栏，只保留页面标题和移动底栏。
- `src/styles/liquid-glass-surfaces.css` 只负责尺寸、层级、内容布局、圆角裁切、低密度透明染色、可读性回退、单层结构描边、第三方装饰层显隐和与各预设完全一致的 WebKit 属性别名；不得用 CSS 创建第二套模糊、折射或色差材质。
- 桌面与移动状态栏必须隐藏 `liquid-glass-react` 直属的两层边框／高光 `span`、两个 over-light 辅助 `div`，并清除第三方 `.glass` 外部阴影，只保留 `.glass__warp` 材质和宿主的一条最上层连续结构描边。移动底栏允许保留第一层低强度 screen 高光。
- `src/styles/liquid-glass-chrome.css` 是浏览器测试兼容入口，不是第二套材质。它只允许按固定顺序转发 `performance.css`、`scrollbars.css`、`game-shell-layout.css` 和 `liquid-glass-surfaces.css`；生产入口 `src/main.tsx` 继续直接导入正式样式。
- 浏览器运行时 harness 必须加载真实的滚动条与外壳几何样式，不得只加载历史全局样式后用错误计算结果验证布局。

## 2. 文件职责与加载顺序

| 文件 | 唯一职责 |
|---|---|
| `LiquidGlassSurface.tsx` | 第三方库适配、桌面状态栏预设、移动 Chrome 预设、静态鼠标输入和统一 DOM |
| `SignedInShell.tsx` | 游戏与管理员共享根外壳、侧栏／工作区轨道、唯一页面 `ScrollArea`、页面 Overlay 与 Chrome Overlay DOM 顺序 |
| `GameShell.tsx` | 向共享外壳提供玩家侧栏、单一状态栏、移动通知和玩家移动导航 |
| `AdminDesktopBar.tsx` | 向共享外壳提供管理员桌面标题、说明、账号、世界／API 摘要与刷新操作，并复用 `desktopStatusBar` |
| `AdminApp.tsx` | 向共享外壳提供管理员侧栏、管理员移动导航和业务页面，不得重建根滚动视口 |
| `StatusBar.tsx` | 保持单一玩家状态栏实例，按 `720px` 断点选择预设，并直接承载固定五列状态内容；不得引入 `ScrollArea` |
| `liquid-glass-surfaces.css` | 玻璃宿主、第三方 DOM 尺寸、开放的背景采样链、平台圆角、透明染色、状态栏单壳层级、结构描边、移动底栏单层高光、底栏唯一垂直留白和 WebKit 兼容别名 |
| `liquid-glass-chrome.css` | 浏览器 harness 的共享外壳样式兼容聚合入口 |
| `game-shell-layout.css` | 登录后桌面双列轨道、唯一布局沟槽、工作栏外距、页面避让、内容边缘和桌面页面滚动条贴边几何 |
| `desktop-sidebar.css` | 侧栏展开／折叠、导航固有行高和过渡 |
| `viewport.css` | 游戏与管理员固定视口、登录态根视口纵向 overscroll 终止、移动工作区 gutter、两层 Overlay、安全区和移动背景采样层级 |
| `scrollbars.css` | 通用覆盖式滚动条；移动页面纵向轨道固定到视口安全边缘，不负责移动底栏 |
| `mobileFacilityPullRefresh.ts` | 仅对已打开的移动工厂详情识别顶部向下关闭手势，并在该手势激活后局部取消浏览器默认纵向过度滚动 |
| `admin-navigation.css` | 管理员桌面工作栏内容布局与运营业务编排，不得定义第二套根外壳 |
| `mobile-status-navigation.css` | 移动导航唯一原生横向滚动视口、原生轨道隐藏、按钮几何和内部焦点环 |
| `verify-liquid-glass-chrome.mjs` | 依赖、平台分离预设、单实例切换、单壳装饰、兼容入口、背景采样链、移动导航结构和防回退检查 |
| `verify-game-shell-layout.mjs` | 游戏与管理员共享桌面沟槽、双列、导航行高、页面滚动条贴边、移动 Overlay、滚动条和滚动链检查 |
| `verify-overlay-scrollbars.mjs` | 覆盖式滚动条、移动底栏原生滚动视口和滚动能力检查 |
| `verify-mobile-facility-pull-refresh.mjs` | 登录态根 overscroll、工厂详情局部非被动触摸监听、设计记录和浏览器回归的防回退检查 |
| `verify-desktop-primary-surfaces.mjs` | 桌面一级卡片与独立桌面状态栏圆角、单结构边框和零第三方装饰层检查 |
| `liquid-glass-layout.spec.ts` | 真实浏览器平台预设、单状态栏实例、装饰层显隐、背景采样链、圆角、共线和页面避让验证 |
| `game-shell-layout.spec.ts` | 玩家普通、窄宽和矮高桌面的统一沟槽、卡片间距、工作栏／侧栏外距、页面边缘和贴边滚动条几何回归 |
| `admin-runtime.spec.ts` | 管理员共享沟槽、桌面玻璃工作栏、满宽页面框、贴边滚动条、业务双栏与移动 Overlay 回归 |
| `mobile-workspace-overlay.spec.ts` | 移动安全边缘轨道和内容宽度验证 |
| `mobile-navigation-scrollbar.spec.ts` | 移动底栏单一原生滚动视口、隐藏轨道、完整按钮边界和末项可达性验证 |
| `mobile-facility-pull-refresh.spec.ts` | 移动工厂详情从内容顶部下滑时取消浏览器默认 overscroll、关闭详情且不发生顶层导航 |

生产几何样式顺序固定为 `viewport.css` → `scrollbars.css` → `game-shell-layout.css`。浏览器兼容入口在 harness 已加载 `viewport.css` 后，固定转发 `performance.css` → `scrollbars.css` → `game-shell-layout.css` → `liquid-glass-surfaces.css`。

## 3. 平台分离参数预设

禁止 `shader` 模式，所有外壳继续使用 `elasticity={0}` 和固定 `globalMousePos`／`mouseOffset` 保持几何稳定。

### 3.1 桌面状态栏与管理员桌面工作栏

`DESKTOP_STATUS_GLASS` 只供 `desktopStatusBar` 使用，参数固定为：

- `mode="standard"`；
- `displacementScale: 20`；
- `blurAmount: 0.0625`，对应 `blur(6px)`；
- `saturation: 120`；
- `aberrationIntensity: 0.15`；
- `elasticity={0}`；
- `cornerRadius: 24`。

玩家桌面状态栏和管理员桌面玻璃工作栏都是宽而低的固定信息条，使用较轻的位移、色差和模糊，并与桌面一级卡片的 `24px` 圆角一致。不得恢复 `prominent` 中心透镜、`40px` 胶囊或移动端的较强边缘参数。

### 3.2 移动状态栏与移动底栏

`MOBILE_CHROME_GLASS` 同时供 `mobileStatusBar` 和 `mobileNavigation` 使用，参数固定为：

- `mode="standard"`；
- `displacementScale: 32`；
- `blurAmount: 0.1`，对应 `blur(7.2px)`；
- `saturation: 125`；
- `aberrationIntensity: 0.3`；
- `elasticity={0}`；
- `cornerRadius: 40`。

移动状态栏和底栏继续保持 iOS 工具栏式清透厚玻璃及 `40px` 胶囊轮廓。移动状态栏虽然与底栏共用材质参数，但装饰策略不同：状态栏隐藏全部第三方直属装饰，底栏只保留第一层 `opacity: 0.22` 的 screen 高光；两者使用同一 `40px` 胶囊圆角。

## 4. 平台能力边界

所有平台都渲染同一个 `LiquidGlassSurface` 适配组件：

- Chromium、Android Chromium WebView 和 Windows WebView2 显示完整折射、模糊和边缘色差；
- Safari、iOS WebKit 和 Firefox 在折射能力受限时仍保留同一组件、轻度模糊、结构描边和内容结构；
- `liquid-glass-react` 内联的非前缀 `backdrop-filter` 始终是参数权威；桌面状态栏的 `-webkit-backdrop-filter` 必须严格为 `blur(6px) saturate(120%)`，移动状态栏与底栏必须严格为 `blur(7.2px) saturate(125%)`；
- 不支持 `backdrop-filter` 时只使用可读性回退底色，不切换到另一套玻璃；
- 平台能力差异不得改变工作栏高度、安全区、导航尺寸或内容顺序。

## 5. 登录后桌面应用外壳几何

大于 `720px` 时，游戏端和管理员端都必须由 `SignedInShell` 渲染同一个根结构：

- `.signed-in-shell` 固定覆盖视口，最终 `padding` 和 `gap` 都为 `0`；
- `--desktop-layout-gutter` 是桌面侧栏、悬浮工作栏、页面内容边缘与一级内容父网格之间间距的唯一权威；普通桌面使用 `12px`，宽度 `721px–960px` 或高度不大于 `760px` 的紧凑桌面使用 `8px`；
- `--desktop-shell-outer-inset` 是侧栏与工作栏唯一桌面外距令牌 `--desktop-layout-gutter` 的兼容别名；`--desktop-sidebar-workspace-gap`、`--desktop-status-gap` 与桌面 `--layout-gutter` 同样只能指向该令牌，不得单独赋值；
- 第一列由侧栏左侧外距、侧栏宽度和侧栏与工作区间隔组成；第二列 `.workspace` 使用全部剩余宽度；侧栏左／上／下外距、侧栏到工作区、工作栏顶部／右侧、工作栏到页面内容、页面右／下留白和一级内容之间的 gap 必须等于同一个沟槽值；
- 工作区和页面滚动视口继续铺满视口右边缘；`.workspace`、`.page-scroll-area` 与 `.page-scroll` 不得因卡片留白而缩宽，滚动条显隐不得改变页面 `clientWidth`；
- 玩家状态栏和管理员桌面玻璃工作栏都保持 `position: absolute` 悬浮，左边缘与 `.workspace` 一致；顶部／右侧间距都来自统一桌面外距；
- 侧栏展开宽度为 `224px`，折叠宽度为 `78px`，只能通过 `--sidebar-column-width` 改变工作区起点；
- `721px–960px` 使用 `8px` 统一外距；高度不大于 `760px` 时同样使用 `8px`，不得恢复 `.45rem` 第三种外距；
- 桌面侧栏导航必须从顶部按固有行高排列，不能把导航按钮平均拉伸到整列高度；
- 桌面工作栏高度保持 `76px`，实际玻璃圆角为 `24px`；
- `.page-scroll-area` 与 `.page-scroll` 铺满工作区，桌面左右 padding 为 `0`；页面顶部避让固定为“沟槽 + 工作栏高度 + 沟槽”；
- 页面顶部避让必须集中为 `--desktop-page-top-offset`，由“`--desktop-layout-gutter` + `--desktop-asset-bar-height` + `--desktop-layout-gutter`”派生；需要避让工作栏的桌面 sticky 业务卡片必须直接读取该令牌；
- `.page-content` 使用 `width: 100%`、`max-width: none`、`margin: 0`，左侧 padding 为 `0`，右侧与底部 padding 使用 `--desktop-layout-gutter`；最外层内容网格的右边缘必须与工作栏右边缘共线；
- 一级内容父网格继续使用 `gap: var(--layout-gutter)`；页面内部二级卡片、列表行、按钮组和表单间距不属于该规则；
- 桌面页面主滚动条的轨道和可见滑块都使用 `right: 0`，直接贴合视口右边缘；不得影响侧栏、表格、虚拟列表或移动页面轨道；
- 管理员 `.admin-page-frame` 必须 `width: 100%`、`max-width: none`，不得恢复全局 `1440px`／`1600px` 居中限制；桌面 `PageLayout` 标题隐藏，由 `AdminDesktopBar` 承载上下文，业务内容仍保留主从双栏；
- 不得给 `.signed-in-shell`、`.workspace`、`.page-scroll-area` 或 `.page-scroll` 添加外边距／水平 padding 模拟内容留白，不得为管理员创建第二个原生主滚动容器。

## 6. 移动工作区、Overlay 与滚动条

不大于 `720px` 时：

- `.workspace` 是页面、状态栏和底栏唯一水平边界，左右 padding 使用 `max(var(--mobile-workspace-gutter), env(safe-area-inset-left/right))`；
- `SignedInShell` 的 `.mobile-page-overlay` 和 `.mobile-chrome-overlay` 占据同一 Grid 单元；页面层固定 `order: 1`，Chrome 层固定 `order: 2`；
- 移动层级依赖 DOM 绘制顺序：页面 Overlay 先渲染，Chrome Overlay 后渲染；`.workspace`、两层 Overlay、`.page-scroll`、状态栏宿主和底栏宿主在移动端都不得建立正 `z-index` 或 `isolation: isolate` 背景根；
- 页面内部若使用带非 `auto` `z-index` 的 `position: sticky`／定位元素，必须由页面局部堆叠上下文收口，不能让其层级逃逸到 Chrome Overlay 之上；
- Chrome Overlay 使用 `pointer-events: none`，只有状态栏和底栏恢复交互；
- 状态栏玻璃、底栏玻璃和一级卡片左右边缘必须共线；
- 玩家 `.asset-bar` 直接包含唯一 `LiquidGlassSurface`；不得用水平 padding 缩窄实际玻璃，状态项留白放入 `.asset-bar-content`；
- `.asset-bar-content` 固定五列布局使用 `repeat(5, minmax(0, 1fr))`，不得通过横向滚动解决空间不足；
- `.page-scroll` 左右 padding 必须为 `0`；管理员 `.admin-page-scroll` 因不渲染移动顶部状态栏，只保留安全区顶部 inset 和底栏避让；
- 移动操作结果通知必须位于 `GameShell` 的 `.mobile-chrome-overlay` 内容内，DOM 顺序固定为 `StatusBar` 后、`MobileBottomNavigation` 前；不得放入 `.mobile-page-overlay` 或 `.page-scroll`；
- 通知顶部固定为安全区顶部 + `48px` 状态栏 + `8px` 间距，左右各 `8px`，内容水平居中且最大宽度 `30rem`；通知使用普通半透明提示样式，不新增液态玻璃实例；
- 通知宿主与提示本体均不得拦截指针事件，通知显示／隐藏不得推动页面内容、状态栏或底栏，也不得改变页面滚动高度；
- 移动状态栏固定 `48px`，移动底栏固定 `68px`；底栏相对 Chrome Overlay 使用 `position: absolute`；
- 管理员移动端只显示统一底栏，不显示 `.admin-command-bar`；不得给 `.asset-bar` 设置 `height: 100%`。

### 6.1 登录态根视口的下拉刷新边界

- `html[data-app-surface="game"|"admin"]` 是固定应用纵向滚动链的最终边界，必须由 `viewport.css` 设置 `overscroll-behavior-y: none`，阻止浏览器原生下拉刷新；登录、注册和封禁页面继续使用普通文档滚动，不得套用该根规则。
- 页面 `.page-scroll`、详情内容、虚拟列表和其他内部滚动区继续保持 `overscroll-behavior-y: auto`，到达边界时仍按 UI 设计系统释放滚动链；不得为了阻止刷新把内部滚动区改成 `contain`。
- `mobileFacilityPullRefresh.ts` 只为动态挂载的 `.facility-detail-sheet` 注册局部非被动 `touchmove`。它必须先排除按钮、链接、输入、选择器和滚动条，只在标题区或内容顶部识别到超过阈值且纵向占优的向下手势后调用 `preventDefault()`。
- 该保护只取消浏览器默认过度滚动；工厂详情的位移、速度、关闭阈值、焦点返回和页面滚动锁定继续由 `ProductionPage.tsx` 负责。不得在 `window`、`document` 或 `body` 上建立全局非被动 `touchmove`。

移动页面纵向覆盖式轨道固定到视口安全边缘：

```css
.page-scroll-area > .ui-scrollbar--vertical {
  position: fixed;
  top: var(--scrollbar-edge-offset);
  right: env(safe-area-inset-right, 0px);
  bottom: var(--scrollbar-edge-offset);
  transform: none;
}
```

固定的只有覆盖式轨道；`.page-scroll-area`、`.page-scroll`、`.page-content` 和卡片仍由 `.workspace` 控制。滑块在轨道内右对齐并保留 `2px` 偏移，因此无安全区时距视口右边约 `2px`，有安全区时距安全区内缘约 `2px`。滚动条显隐不得改变页面 `clientWidth` 或卡片宽度。不得恢复 `--mobile-workspace-inline-end`、`--mobile-scrollbar-edge-escape`、`right: 0 + translateX(...)`、负 `right` 或扩大页面宽度的逃逸实现。

## 7. 材质、背景采样、圆角和结构边缘

- `.asset-bar` 和 `.mobile-bottom-navigation` 不得包含 `.panel`；
- 每个可见顶部工作栏只允许一个玻璃实例；整个移动底栏也只允许一个玻璃实例；
- 支持环境中的桌面状态栏、管理员桌面工作栏、移动状态栏和底栏使用同一低密度透明染色 `rgba(194, 231, 214, 0.06)`，第三方 `.glass__warp` 继续采样页面内容；
- `.glass__warp` 到页面内容之间必须保持开放的背景采样链；`.liquid-glass-surface` 不得使用 `contain: paint`、`isolation: isolate` 或 `overflow: clip`，统一使用 `overflow: hidden` 完成圆角裁切；
- 桌面与移动预设的 WebKit 兼容别名必须分别匹配上游参数，不得使用一个通用数值覆盖两个平台；
- 三种宿主都只保留一条低强度 `1px` 结构描边；桌面与移动状态栏使用 `::after` 绘制连续结构描边，移动底栏继续使用宿主边框；
- 桌面与移动状态栏直属的所有 `span` 装饰必须为 `display: none`，辅助 `div` 必须隐藏，第三方 `.glass` 计算后的 `box-shadow` 必须为 `none`；
- 移动底栏的两个直属 `span` 中只允许第一层 `opacity: 0.22` 的 screen 高光可见；
- React `cornerRadius`、CSS 裁切和第三方折射层必须分别与所属平台预设一致。

## 8. 状态项、管理员工作栏与移动导航结构

- 玩家状态标签使用次级文字色，主数值使用主文字色，说明使用弱化文字色；排名统一通过 `formatRank` 显示为 `#N`；
- 实际数字格式遵循全局“紧凑数字”偏好；玩家关闭全局“紧凑数字”后，桌面和移动状态栏都显示带千分位的完整整数；
- 管理员桌面工作栏左侧显示当前分区标题与说明，右侧显示管理员身份、世界版本、API 状态和刷新操作；移动端这些内容回到页面标题；
- 移动导航按钮固定 `48px × 48px`，活动、悬停和触摸状态不得位移或缩放；
- 移动底栏隐藏可见水平轨道，但保留触控、触控板、滚轮和键盘横向滚动能力。普通纵向滚轮不得转换为水平滚动；
- 语义化 `<nav>` 是移动底栏唯一横向滚动视口；DOM 固定为 `aside.mobile-bottom-navigation → LiquidGlassSurface → .liquid-glass-surface__content → nav.mobile-bottom-navigation__viewport → buttons`；
- 移动底栏不得重新引入 `ScrollArea`、`.mobile-navigation-frame`、`.mobile-navigation-scroll-area`、项目自绘水平轨道或伪元素占位；
- 左右滚动留白只由 `nav` 的 `padding-inline: var(--mobile-nav-scroll-gutter)` 提供；
- 移动底栏垂直留白只允许由 `.liquid-glass-surface__content` 提供，固定为 `padding: 8px 0`；`.mobile-bottom-navigation` 必须保持 `padding: 0`；
- `48px` 按钮在 `68px` 胶囊内必须完整显示，焦点环必须使用内部 `inset` 绘制。

### 8.1 顶部状态栏固定内容规则

- 玩家状态栏 DOM 固定为 `header.asset-bar → LiquidGlassSurface → .liquid-glass-surface__content → .asset-bar-content → 五个状态项`；状态栏范围内不得出现 `.ui-scroll-area`、`.ui-scroll-area__viewport`、`.ui-scrollbar`、`.asset-bar-scroll-area` 或 `.asset-bar-scroll-track`；
- 状态栏固定五列布局，玻璃宽度始终等于宿主可视宽度，内容不得扩大玻璃最小宽度；
- 顶部状态栏的结构描边必须位于玻璃效果和状态内容之上，使用 `z-index: 2`、`pointer-events: none` 的 `::after` 内描边；
- 页面滚动到卡片后方时，状态栏圆角描边必须保持连续。

## 9. 性能与可访问性

- 玩家桌面同时可见一个玻璃实例；管理员桌面同时可见一个工作栏玻璃实例；玩家移动同时可见状态栏和底栏两个，管理员移动只可见底栏一个；
- 禁止滚动事件更新玻璃参数、噪点动画和每项独立滤镜；
- 页面初始内容避让工作栏和底栏，滚动时允许进入玻璃后方；
- 装饰 SVG 和覆盖层不得阻止内部按钮事件；
- 页面和内部列表到达纵向边界后必须保留滚动链；登录态根 `html` 只在链最终到达浏览器视口时终止原生过度滚动；
- 通用滑块保留 `role="scrollbar"`、方向、范围、拖动、轨道翻页和键盘语义；移动底栏使用原生 `<nav>` 滚动视口。

## 10. 验收标准

必须检查桌面 `1920×1080`、`1684×931`、`1440×900`、`1024×768`、`900×768`，以及移动 `430px`、`390px`、`375px`、`360px`、`320px`：

1. 玩家顶部状态栏不包含内部滚动区，固定五列完整；桌面使用 `desktopStatusBar`，移动使用 `mobileStatusBar`，移动底栏使用 `mobileNavigation`。
2. 断点切换时玩家状态栏始终只有一个 `.liquid-glass-surface`，variant 原地切换。
3. 三种预设计算后的 `data-liquid-glass-mode` 都为 `standard`，WebKit 与非前缀背景滤镜一致。
4. 游戏和管理员桌面外壳覆盖整个视口；普通桌面统一沟槽为 `12px`，窄宽或矮高桌面为 `8px`；页面主滚动条轨道和滑块右边缘均为 `0px`。
5. 管理员桌面工作栏使用一个 `desktopStatusBar` 玻璃实例，页面标题不重复显示，内容右边缘与工作栏共线，页面框不居中限宽。
6. 桌面导航按钮从顶部按固有高度排列；桌面玻璃圆角和桌面一级卡片均为 `24px`。
7. 移动状态栏、一级卡片和底栏实际玻璃左右共线；移动状态栏固定 `48px`，底栏固定 `68px`，圆角均为 `40px`。
8. 桌面使用 `blur(6px) saturate(120%)`，移动使用 `blur(7.2px) saturate(125%)`。
9. 玻璃宿主 `contain` 为 `none`、`isolation` 为 `auto`、裁切为 `overflow: hidden`。
10. 移动背景采样链中的工作区、两层 Overlay、页面滚动区和底栏宿主计算 `z-index` 均为 `auto`。
11. 管理员移动页面层与 Chrome 层位于同一工作区，顺序为 `1` 和 `2`，桌面工作栏隐藏且底栏保持可点击。
12. 移动页面轨道固定到视口安全边缘，显隐前后内容宽度不变。
13. 移动底栏不包含 `ScrollArea` 或项目自绘水平轨道，唯一 `<nav>` 可滚动到最后一项。
14. 登录态游戏与管理员根 `html` 的计算 `overscroll-behavior-y` 为 `none`；认证页面不受影响。
15. 工厂详情内容位于顶部时向下关闭，局部 `touchmove` 已被取消，详情关闭、URL 不变且不发生顶层导航。
16. 浏览器运行时 harness 实际加载正式几何与材质样式。
17. `npm run build` 与全部 Chromium 浏览器测试通过。

## 11. 不可回退规则

除非先更新本文档、架构检查和浏览器测试，否则不得：

- 在 `LiquidGlassSurface.tsx` 之外直接导入 `liquid-glass-react`；
- 在项目 CSS 中重新实现液态玻璃材质或改用 `shader`；
- 将 `DESKTOP_STATUS_GLASS` 与 `MOBILE_CHROME_GLASS` 重新合并，或让桌面工作栏直接复用移动预设；
- 改变正式桌面或移动预设参数而不同时更新本文档与测试；
- 恢复 `prominent`、中心透镜式强折射或同时渲染两套玩家状态栏；
- 恢复状态栏第三方多层装饰和外部阴影；
- 给状态项或导航按钮分别创建玻璃实例；
- 在 `.liquid-glass-surface` 恢复 `contain: paint`、`isolation: isolate`、`overflow: clip`，或在移动玻璃与页面之间恢复正 `z-index` 背景根；
- 让页面内 sticky／定位元素覆盖状态栏或移动底栏；
- 删除或改变与各自上游预设严格一致的 `.glass__warp` `-webkit-backdrop-filter` 兼容别名；
- 给桌面 `.signed-in-shell` 恢复 padding／gap，给 `.page-content` 恢复居中最大宽度，或让管理员恢复独立根外壳／主滚动视口；
- 为桌面侧栏、工作栏、工作栏到内容、一级内容 gap 或页面右／下留白恢复独立数值，绕过 `--desktop-layout-gutter`；
- 将普通桌面沟槽改为非 `12px`、将紧凑桌面改为非 `8px`，或恢复 `.45rem` 第三种沟槽；
- 给 `.workspace`、`.page-scroll-area` 或 `.page-scroll` 增加桌面水平 padding／margin，缩小页面滚动视口；
- 让桌面页面主滚动条恢复右侧偏移或显隐改变内容宽度；
- 让桌面侧栏导航自动行拉伸；
- 给移动状态栏、页面或底栏恢复独立水平 inset，或把移动底栏恢复为 `position: fixed`；
- 恢复移动底栏可见水平轨道，或禁用原生横向滚动；
- 重新引入移动导航 `ScrollArea`、额外 frame、项目自绘轨道、伪元素留白或多层垂直裁切；
- 在 `.mobile-bottom-navigation` 恢复垂直 padding 或外扩焦点 outline；
- 把移动页面轨道限制在卡片边缘、越过安全区或改变卡片宽度；
- 在 `.page-scroll` 或工厂详情内容上使用 `overscroll-behavior: contain` 阻断纵向滚动链；
- 删除登录态根 `html` 的 `overscroll-behavior-y: none`，让浏览器原生下拉刷新重新接管固定应用视口；
- 把工厂详情保护改为 `window`、`document` 或 `body` 级全局非被动 `touchmove`，或在向上滚动、横向手势、内容未到顶部和交互控件上取消默认行为；
- 给 `.asset-bar` 设置 `height: 100%`；
- 删除浏览器 harness 所需的真实滚动条或外壳几何导入；
- 绕过架构检查或浏览器几何测试合并视觉回退。
