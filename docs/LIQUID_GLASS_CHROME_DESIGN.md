# Economy liquid-glass-react 应用外壳设计

> 状态：统一认证卡片、游戏与管理员桌面工作栏、全应用三层摄影背景、移动状态栏、移动底部导航及登录后共享外壳几何基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-29

本文件定义应用唯一液态玻璃实现、认证卡片、全应用三层摄影背景与背景采样、游戏端和管理员端登录后桌面应用外壳几何、根级摄影状态外壳、移动工作区 Overlay、移动导航结构、浏览器运行时样式入口、性能约束和防回退规则。摄影资源、认证／玩家／管理员氛围变体、根级加载与异常状态以 `REGISTRATION_INVITE_FLOW_DESIGN.md` 为共享摄影专项权威；认证卡片光学与静态输入参数、边缘高光和登录布局仍由该文档约束；通用 UI、覆盖式滚动条和市场表格仍以 `docs/UI_DESIGN_SYSTEM.md` 为准。

## 1. 唯一材质来源

- `liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现。
- `src/components/ui/LiquidGlassSurface.tsx` 是唯一允许直接导入该依赖的文件。
- 玩家桌面状态栏、管理员桌面玻璃工作栏、移动状态栏、移动底栏和认证卡片只能使用 `LiquidGlassSurface` 预设，不得在业务组件中直接设置第三方参数。
- 桌面状态栏与管理员桌面玻璃工作栏必须使用独立的 `DESKTOP_STATUS_GLASS`；移动状态栏与移动底栏共同使用 `MOBILE_CHROME_GLASS`；桌面和移动认证卡片分别使用 `DESKTOP_AUTH_CARD_GLASS` 与 `MOBILE_AUTH_CARD_GLASS`。四个预设继续保留独立圆角常量，但所有平台光学参数必须保持完全一致。
- `StatusBar.tsx` 通过 `(max-width: 720px)` 媒体查询在 `desktopStatusBar` 与 `mobileStatusBar` 之间切换；任一时刻只能渲染一个状态栏玻璃实例，不得通过同时渲染两套后再用 CSS 隐藏。顶部状态栏不得包含 `ScrollArea`、原生滚动视口或项目自绘滚动条。
- `AuthCardSurface.tsx` 通过同一 `720px` 断点在 `desktopAuthCard` 与 `mobileAuthCard` 之间原地切换；认证卡片任一时刻只能存在一个 `LiquidGlassSurface`，不得并行渲染桌面和移动卡片。
- 真实认证内容与状态栏内容使用相同的 `.glass` 内部位置：`LiquidGlassSurface → liquid-glass-react → .glass → .liquid-glass-surface__content`。认证表单不得再作为玻璃效果外部的兄弟层，也不得通过重建 `LiquidGlass` 的 React `key` 更新尺寸。
- 支持背景滤镜时，桌面／移动状态栏、移动底栏和认证卡片统一把低密度透明染色放在 `.liquid-glass-surface` 宿主并统一使用 `--liquid-glass-contrast`；不得创建 `.liquid-glass-surface__material-fill` 或认证专用支持环境染色变量。
- `AdminDesktopBar.tsx` 只在桌面显示一个 `desktopStatusBar` 玻璃实例；管理员移动端不得渲染顶部玻璃栏，只保留页面标题和移动底栏。
- `src/styles/liquid-glass-surfaces.css` 只负责尺寸、层级、内容布局、圆角裁切、低密度透明染色、认证回退底色、状态栏单层结构描边、认证卡片无项目结构描边、第三方装饰层显隐和与各预设完全一致的 WebKit 属性别名；不得用 CSS 创建第二套模糊、折射或色差材质。
- 桌面与移动状态栏必须隐藏 `liquid-glass-react` 的直属边框／高光，但所有五种 variant 必须保留并显示 `overLight=true` 产生的两个官方黑色辅助层；认证卡片必须保留官方两个直属边缘高光 `span`，并清除第三方 `.glass` 外部阴影。状态栏只保留宿主的一条最上层连续结构描边；认证卡片不得绘制项目结构描边或额外 `::after` 白色外框，由官方双层高光、折射边缘、圆角裁切和宿主阴影共同表达材质。移动底栏允许保留第一层低强度 screen 高光。
- `src/styles/liquid-glass-chrome.css` 是浏览器测试兼容入口，不是第二套材质。它只允许按固定顺序转发 `performance.css`、`scrollbars.css`、`game-shell-layout.css`、`financial-backdrop.css` 和 `liquid-glass-surfaces.css`；生产入口 `src/main.tsx` 继续直接导入正式样式。
- 浏览器运行时 harness 必须加载真实的滚动条与外壳几何样式，并同时加载共享摄影背景与液态玻璃样式；不得让 `FinancialBackdrop` 失去固定定位后作为桌面 Grid 普通子项参与布局，也不得只加载历史全局样式后用错误计算结果验证布局。

## 2. 文件职责与加载顺序

| 文件 | 唯一职责 |
|---|---|
| `LiquidGlassSurface.tsx` | 第三方库适配、五种平台预设、统一零弹性与静态鼠标输入、固定／内容自适应布局、认证内容首次绘制前同步测高、提交后观察器补充测量、上游滤镜尺寸通知和统一 DOM |
| `AuthCardSurface.tsx` | 认证卡片语义宿主、`720px` 响应式预设切换和单一认证玻璃实例 |
| `FinancialBackdrop.tsx` | 登录、玩家游戏、管理员后台与根级状态共享的图片层、三种氛围变体、critical 暗角、响应式图片、优先级和加载失败隐藏 |
| `PhotographicStateShell.tsx` | 统一账号检查、代码包加载、封禁、无权限和致命错误的单一摄影状态外壳、语义状态与安全区内容几何 |
| `SignedInShell.tsx` | 游戏与管理员共享根外壳、可选背景插槽、侧栏／工作区轨道、唯一页面 `ScrollArea`、页面 Overlay 与 Chrome Overlay DOM 顺序 |
| `GameShell.tsx` | 向共享外壳提供玩家背景、玩家侧栏、单一状态栏、移动通知和玩家移动导航 |
| `AdminDesktopBar.tsx` | 向共享外壳提供管理员桌面标题、说明、账号、世界／API 摘要与刷新操作，并复用 `desktopStatusBar` |
| `AdminApp.tsx` | 向共享外壳提供管理员摄影背景、管理员侧栏、管理员移动导航和业务页面；不得重建根滚动视口或复用玩家／认证氛围变体 |
| `StatusBar.tsx` | 保持单一玩家状态栏实例，按 `720px` 断点选择预设，直接承载固定五列状态内容，并使用单一 `ResizeObserver` 与合并后的 `requestAnimationFrame` 对移动端真实溢出的主数值逐项缩小字号；不得引入 `ScrollArea` |
| `financial-backdrop.css` | 玩家／管理员图片层、三种氛围、网格、噪点、critical 暗角、失败回退、根级状态外壳和全局 `body` 网格关闭 |
| `auth.css` | 认证内容层、品牌区、卡片外层宽度／对齐／圆角、认证内容内边距、输入与自动填充兼容；不得实现玻璃材质 |
| `liquid-glass-surfaces.css` | 所有玻璃宿主、第三方 DOM 尺寸、内容自适应层、开放背景采样链、平台圆角、统一宿主染色、认证回退、状态栏单层结构描边、认证官方双层高光显隐、认证高光宿主几何绑定、零尺寸过渡、认证卡片无项目结构描边和移动底栏唯一垂直留白 |
| `liquid-glass-chrome.css` | 浏览器 harness 的共享外壳样式兼容聚合入口，必须包含全应用摄影背景样式 |
| `game-shell-layout.css` | 登录后桌面双列轨道、唯一布局沟槽、工作栏外距、页面避让、内容边缘和桌面页面滚动条贴边几何 |
| `desktop-sidebar.css` | 侧栏展开／折叠、导航固有行高和过渡 |
| `viewport.css` | 游戏与管理员固定视口、登录态根视口纵向 overscroll 终止、移动工作区 gutter、两层 Overlay、安全区和移动背景采样层级 |
| `scrollbars.css` | 通用覆盖式滚动条；移动页面纵向轨道固定到视口安全边缘，不负责移动底栏 |
| `mobileFacilityPullRefresh.ts` | 仅对已打开的移动工厂详情识别顶部向下关闭手势，并在该手势激活后局部取消浏览器默认纵向过度滚动 |
| `admin-navigation.css` | 管理员桌面工作栏内容布局与运营业务编排，不得定义第二套根外壳 |
| `mobile-status-navigation.css` | 移动导航唯一原生横向滚动视口、原生轨道隐藏、按钮几何和内部焦点环 |
| `mobile-status-layout.css` | 移动状态栏固定五列、图标与数值几何、数值自适应 CSS 变量、`clip` 溢出策略和移动通知定位 |
| `verify-liquid-glass-chrome.mjs` | 唯一依赖入口、五种预设、全预设零弹性、静态鼠标输入、固定／内容自适应布局、认证内容内部定位、单实例、单壳装饰、兼容入口、背景采样链、移动导航和认证卡片防回退 |
| `verify-game-three-layer.mjs` | 全应用摄影变体、玩家与管理员背景插槽、根级状态外壳、三层顺序、兼容样式入口和移动 Overlay 防回退 |
| `verify-mobile-status-value-fit.mjs` | 移动状态栏数值测量、单观察器、逐项字号适配、禁止省略号、设计记录和浏览器回归检查 |
| `verify-game-shell-layout.mjs` | 游戏与管理员共享桌面沟槽、双列、导航行高、页面滚动条贴边、移动 Overlay、滚动条和滚动链检查 |
| `verify-overlay-scrollbars.mjs` | 覆盖式滚动条、移动底栏原生滚动视口和滚动能力检查 |
| `verify-mobile-facility-pull-refresh.mjs` | 登录态根 overscroll、工厂详情局部非被动触摸监听、设计记录和浏览器回归检查 |
| `verify-desktop-primary-surfaces.mjs` | 桌面一级卡片与独立桌面状态栏圆角、单结构边框和零第三方装饰层检查 |
| `liquid-glass-layout.spec.ts` | 真实浏览器平台预设、单状态栏实例、装饰层显隐、背景采样链、圆角、共线和页面避让验证 |
| `auth-three-layer.spec.ts` | 登录三层结构、认证桌面／移动预设、官方折射光学参数、零弹性、静态鼠标输入、双层边缘高光、首帧宿主与高光底部同步、认证内容内部定位、同源宿主染色、无项目外框、单实例、自然高度、表单值保持、断点切换和无内部滚动回归 |
| `game-three-layer.spec.ts` | 玩家桌面与移动三层背景、DOM 顺序、全局网格关闭和摄影加载失败回退 |
| `application-photography.spec.ts` | 管理员桌面／移动、统一账号检查、封禁、无权限和管理员摄影加载失败回退 |
| `mobile-status-value-fit.spec.ts` | 在 `430px` 至 `320px` 真实浏览器宽度验证长数字逐项缩小、短数字保持默认字号、数值更新后恢复和零省略号 |
| `game-shell-layout.spec.ts` | 玩家普通、窄宽和矮高桌面的统一沟槽、卡片间距、工作栏／侧栏外距、页面边缘和贴边滚动条几何回归 |
| `admin-runtime.spec.ts` | 管理员共享沟槽、桌面玻璃工作栏、满宽页面框、贴边滚动条、业务双栏与移动 Overlay 回归 |
| `mobile-workspace-overlay.spec.ts` | 移动安全边缘轨道和内容宽度验证 |
| `mobile-navigation-scrollbar.spec.ts` | 移动底栏单一原生滚动视口、隐藏轨道、完整按钮边界和末项可达性验证 |
| `mobile-facility-pull-refresh.spec.ts` | 移动工厂详情从内容顶部下滑时取消浏览器默认 overscroll、关闭详情且不发生顶层导航 |

生产几何与背景样式顺序固定为 `viewport.css` → `scrollbars.css` → `game-shell-layout.css` → `financial-backdrop.css`，随后加载 `liquid-glass-surfaces.css`。浏览器兼容入口在 harness 已加载 `viewport.css` 后，固定转发 `performance.css` → `scrollbars.css` → `game-shell-layout.css` → `financial-backdrop.css` → `liquid-glass-surfaces.css`。背景样式缺失会把 `FinancialBackdrop` 的两个节点变成普通 Grid 子项；更晚加载的管理员业务样式也不得用低特异性纯色根背景遮盖摄影层，必须由架构检查阻止。

## 3. 全局液态玻璃参数与平台几何

禁止 `shader` 模式。桌面状态栏、管理员桌面工作栏、移动状态栏、移动底栏、桌面认证卡片和移动认证卡片全局统一传入以下官方参数：

- `mode="standard"`；
- `displacementScale: 120`；
- `blurAmount: 0`；
- `saturation: 120`；
- `aberrationIntensity: 2`；
- `elasticity: 0`；
- `overLight: true`；
- `mouseContainer={null}`；
- 固定 `globalMousePos` 与 `mouseOffset`。

`overLight=true` 就是本项目所称的 “Tint liquid glass dark”，不得再用项目自定义深色背景变量替代。`liquid-glass-react@1.1.1` 的官方实现会在 `overLight=true` 时显示两个直属黑色辅助 `div`，将基础 backdrop blur 设为 `12px`，并把传入的 `displacementScale` 乘以 `0.5` 后交给 SVG 滤镜。因此配置权威仍是 `120 / 0 / 120 / 2`，浏览器计算值必须是 `blur(12px) saturate(120%)`，首个 `feDisplacementMap` 的绝对 scale 必须是 `60`。这些是官方 `overLight` 语义，不得通过把配置改成 `240` 或负 blur 抵消。

所有平台参数必须保持完全一致。四个预设继续保留独立圆角常量：`DESKTOP_STATUS_GLASS` 与 `DESKTOP_AUTH_CARD_GLASS` 使用 `24px`，`MOBILE_CHROME_GLASS` 与 `MOBILE_AUTH_CARD_GLASS` 使用 `40px`。移动状态栏与移动底栏继续共享 `MOBILE_CHROME_GLASS`，桌面与移动认证卡片仍保持独立 variant 和内容高度规则。每个宿主必须暴露 `data-liquid-glass-over-light="true"` 以及配置参数 data attribute，供浏览器区分“传入配置值”和“官方 overLight 处理后的计算值”。

所有四个参数预设都必须固定 `elasticity: 0`，并继续使用静态鼠标输入。桌面状态栏、管理员工作栏、移动状态栏、移动底栏和认证卡片均不得开启鼠标、触控板、触笔或触摸跟踪。

认证卡片继续使用 `layout="content"`。认证内容高度只允许读取 `scrollHeight`／`offsetHeight`，React 内容变化仍在 `useLayoutEffect` 中于首次绘制前同步提交，单个 `ResizeObserver` 与条件 `MutationObserver` 仅负责补充测量。

可见高光几何直接绑定认证宿主：官方两个高光 `span`、两个 over-light 辅助 `div`、认证效果层与 `.glass` 都必须使用认证宿主 `100%` 尺寸并取消几何过渡；登录→注册→登录时，它们的底部必须在首个绘制帧内同步。上游 resize 通知只负责随后补齐 SVG 滤镜内部坐标。
## 4. 平台能力边界

所有平台都渲染同一个 `LiquidGlassSurface` 适配组件：

- Chromium、Android Chromium WebView 和 Windows WebView2 显示完整折射、模糊和边缘色差；
- Safari、iOS WebKit 和 Firefox 在折射能力受限时仍保留同一组件、轻度模糊、状态栏结构描边、认证卡片圆角裁切和内容结构；
- `liquid-glass-react` 内联的非前缀 `backdrop-filter` 始终是参数权威；所有状态栏、管理员工作栏、移动底栏和认证卡片的 `-webkit-backdrop-filter` 必须严格匹配官方 `overLight=true` 计算值 `blur(12px) saturate(120%)`；
- 不支持 `backdrop-filter` 时状态栏与导航使用既有高对比回退，认证卡片使用 `--liquid-glass-auth-fallback`，不切换到另一套玻璃组件；
- 平台能力差异不得改变工作栏高度、安全区、导航尺寸、认证内容高度、背景层级或内容顺序。

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

玩家和管理员根外壳都可以使用 `isolation: isolate` 收口各自负层级摄影和氛围层，但背景节点必须固定定位且不参与桌面 Grid；玩家只使用 `game` 变体，管理员只使用低干扰 `admin` 变体。根隔离不得下沉到 `.workspace`、页面 Overlay、Chrome Overlay 或液态玻璃宿主。

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

## 7. 全应用三层背景、材质采样、圆角和结构边缘

- 登录、玩家游戏、管理员后台和根级状态固定复用同一摄影资源；登录使用 `login-image-layer`／`login-atmosphere-layer`，玩家使用 `game-image-layer`／`game-atmosphere-layer`，管理员使用 `admin-image-layer`／`admin-atmosphere-layer`。统一账号检查、代码包加载、封禁、无权限和致命错误使用 `PhotographicStateShell` 选择对应变体；不得出现纯色过渡页。
- `html[data-app-surface="auth"|"game"|"admin"|"loading"|"banned"] body::before` 必须关闭；网格只能由氛围层绘制，不得在摄影、氛围和内容之间恢复第四个全局网格层。
- 图片请求失败时隐藏图片元素，各变体的深色底色与氛围层必须继续覆盖视口，不得显示破图图标或白底。
- 管理员氛围必须低于玩家氛围的饱和度并使用更均匀遮罩；封禁、无权限和致命错误只增加 `critical` 红色暗角，不得更换图片资源。
- `.asset-bar` 和 `.mobile-bottom-navigation` 不得包含 `.panel`；认证卡片不得包含 `.panel` 或 `.login-card.panel`。
- 每个可见顶部工作栏只允许一个玻璃实例；整个移动底栏也只允许一个玻璃实例；认证页面只允许一个认证玻璃实例。
- 支持环境中的桌面状态栏、管理员桌面工作栏、移动状态栏、底栏和认证卡片统一显示官方 `overLight=true` 的两个黑色辅助层；`--liquid-glass-contrast: rgba(194, 231, 214, 0.06)` 只提供低密度支持染色，不是 dark tint 实现，第三方 `.glass__warp` 继续采样页面内容和氛围背景；认证输入框自身继续保持不透明深色控件以保护表单可读性。
- 认证卡片不得创建 `.liquid-glass-surface__material-fill`，也不得恢复 `--liquid-glass-auth-contrast` 或 `--liquid-glass-auth-mobile-contrast`；只有不支持背景滤镜时可使用 `--liquid-glass-auth-fallback`。
- `.glass__warp` 到页面内容之间必须保持开放的背景采样链；`.liquid-glass-surface` 不得使用 `contain: paint`、`isolation: isolate` 或 `overflow: clip`，统一使用 `overflow: hidden` 完成圆角裁切。
- 桌面、移动和认证预设的 WebKit 兼容别名必须分别匹配上游参数，不得使用一个通用数值覆盖不同平台。
- 状态栏只保留一条低强度 `1px` 最上层连续结构描边；认证卡片不得绘制项目结构描边，`.liquid-glass-surface--desktopAuthCard::after` 与 `.liquid-glass-surface--mobileAuthCard::after` 必须使用 `content: none`；移动底栏继续使用宿主边框。
- 桌面与移动状态栏的直属 `span`／辅助 `div` 必须隐藏；认证卡片的两个直属边缘高光 `span` 必须可见、直接绑定认证宿主 `100%` 几何并取消第三方尺寸过渡，over-light 辅助 `div` 必须隐藏。第三方 `.glass` 计算后的 `box-shadow` 必须为 `none`；认证宿主可以保留由项目定义的一层悬浮阴影。
- 移动底栏的两个直属 `span` 中只允许第一层 `opacity: 0.22` 的 screen 高光可见。
- React `cornerRadius`、CSS 裁切和第三方折射层必须分别与所属平台预设一致。

## 8. 状态项、管理员工作栏与移动导航结构

- 玩家状态标签使用次级文字色，主数值使用主文字色，说明使用弱化文字色；排名统一通过 `formatRank` 显示为 `#N`；
- 实际数字格式遵循全局“紧凑数字”偏好；玩家关闭全局“紧凑数字”后，桌面和移动状态栏都显示带千分位的完整整数；
- 移动状态栏数值自适应只处理真实几何溢出：默认字号继续使用 `clamp(.7rem, 3.45vw, .95rem)`，仅真实溢出的状态项缩小字号，最小字号为 `0.56rem`，并保留 `2%` 宽度安全余量；未溢出的宝石、排名等短值必须保持默认字号；
- 状态值、状态栏宽度、屏幕方向或字体加载发生变化时必须重新测量；完整数字偏好不得被自动改写为 `K/M/B`，移动状态栏数值不得恢复省略号；
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
- `.asset-bar-item-value` 必须使用 `text-overflow: clip`，不得继承全局 `strong` 的 `ellipsis`；主数值通过 `--mobile-status-value-font-size` 接收逐项计算后的字号，不得统一缩小整条状态栏；
- 数值测量只能复用一个 `ResizeObserver`，并由同一个 `requestAnimationFrame` 合并宽度、方向、字体和 React 数值更新后的重算；不得为五个状态项分别创建观察器、轮询器或滚动监听；
- 顶部状态栏的结构描边必须位于玻璃效果和状态内容之上，使用 `z-index: 2`、`pointer-events: none` 的 `::after` 内描边；
- 页面滚动到卡片后方时，状态栏圆角描边必须保持连续。

## 9. 性能与可访问性

- 认证页面同时只可见一个认证玻璃实例；玩家桌面同时可见一个玻璃实例；管理员桌面同时可见一个工作栏玻璃实例；玩家移动同时可见状态栏和底栏两个，管理员移动只可见底栏一个。
- 禁止滚动事件更新玻璃参数、噪点动画和每项独立滤镜。所有玻璃预设使用零弹性和静态鼠标输入，不得在玻璃宿主、页面或滚动容器注册指针跟踪来驱动折射、位移、缩放或边缘高光。
- 认证 React 内容提交后只允许一次无依赖 `useLayoutEffect` 同步测量，并仅在高度值改变时更新状态；该测量用于首次绘制前同步提交，不属于持续每帧测量。单个 `ResizeObserver`、条件 `MutationObserver` 和合并后的 `requestAnimationFrame` 只处理提交后的异步几何变化和上游 SVG 滤镜通知。
- 移动状态栏字号适配只在数值、容器几何、方向或字体就绪时运行，必须使用单一观察器与帧合并，不得加入定时轮询或每帧持续测量。
- 页面初始内容避让工作栏和底栏，滚动时允许进入玻璃后方；认证页面继续使用文档滚动。
- 装饰 SVG、官方边缘高光、摄影背景、氛围覆盖层和认证玻璃宿主不得阻止内部按钮或输入事件；两个认证高光保持 `pointer-events: none`。
- 页面和内部列表到达纵向边界后必须保留滚动链；登录态根 `html` 只在链最终到达浏览器视口时终止原生过度滚动。
- 通用滑块保留 `role="scrollbar"`、方向、范围、拖动、轨道翻页和键盘语义；移动底栏使用原生 `<nav>` 滚动视口；认证卡片使用语义化 `<section aria-label="账号认证">`。

## 10. 验收标准

必须检查桌面 `1920×1080`、`1684×931`、`1440×900`、`1024×768`、`900×768`，以及移动 `430px`、`390px`、`375px`、`360px`、`320px`：

1. 玩家顶部状态栏不包含内部滚动区，固定五列完整；桌面使用 `desktopStatusBar`，移动使用 `mobileStatusBar`，移动底栏使用 `mobileNavigation`。
2. 断点切换时玩家状态栏始终只有一个 `.liquid-glass-surface`，variant 原地切换。
3. 认证卡片桌面使用 `desktopAuthCard`、移动使用 `mobileAuthCard`，断点切换全程只有一个 `.liquid-glass-surface`，保持 `data-liquid-glass-layout="content"`，真实表单内容位于 `.glass` 内且表单值不丢失；认证伪元素不生成项目结构描边或大圆角白色外框，官方两个直属边缘高光保持可见。
4. 五种预设计算后的 `data-liquid-glass-mode` 都为 `standard`，`data-liquid-glass-elasticity` 都为 `0`，WebKit 与非前缀背景滤镜一致。
5. 游戏和管理员桌面外壳覆盖整个视口；普通桌面统一沟槽为 `12px`，窄宽或矮高桌面为 `8px`；页面主滚动条轨道和滑块右边缘均为 `0px`。
6. 管理员桌面工作栏使用一个 `desktopStatusBar` 玻璃实例，页面标题不重复显示，内容右边缘与工作栏共线，页面框不居中限宽。
7. 桌面导航按钮从顶部按固有高度排列；桌面工作栏、桌面认证卡和桌面一级卡片均为 `24px`。
8. 移动状态栏、一级卡片和底栏实际玻璃左右共线；移动状态栏固定 `48px`，底栏固定 `68px`；移动 Chrome 与移动认证卡圆角均为 `40px`。
9. 所有液态玻璃变体统一传入 `120 / 0 / 120 / 2`、弹性 `0` 与 `overLight=true`；浏览器必须计算为 `blur(12px) saturate(120%)`，首个位移 scale 绝对值为 `60`，两个官方 over-light 辅助层可见。
10. 玻璃宿主 `contain` 为 `none`、`isolation` 为 `auto`、裁切为 `overflow: hidden`。
11. 移动背景采样链中的工作区、两层 Overlay、页面滚动区和底栏宿主计算 `z-index` 均为 `auto`。
12. 管理员移动页面层与 Chrome 层位于同一工作区，顺序为 `1` 和 `2`，桌面工作栏隐藏且底栏保持可点击。
13. 登录、玩家桌面／移动、管理员桌面／移动与根级状态均存在摄影、氛围和内容三层；管理员使用独立低干扰氛围，浏览器 harness 加载背景样式后侧栏、工作栏、页面边缘与滚动条几何不得变化。
14. 摄影请求失败时图片元素隐藏，氛围背景、状态卡、页面内容、状态栏、管理员工作栏与导航仍然可见并可交互。
15. 登录切换为注册后，同一个认证玻璃随内容自然增高；认证内容保持在 `.glass` 内，卡片、玻璃宿主和内容均不得创建内部纵向滚动区，输入框、验证码、错误提示和按钮保持可操作。
16. 支持环境中的认证卡片与状态栏统一使用 `--liquid-glass-contrast` 宿主染色且不存在 `.liquid-glass-surface__material-fill`；认证卡片 `::after` 不生成外框，两个官方高光 `span` 可见且辅助 `div` 隐藏，`auth.css` 不包含认证卡片的模糊、玻璃渐变或材质描边，登录卡片不包含 `.panel`；不支持背景滤镜时认证卡片使用统一深色回退。
17. Chromium 中把指针从认证卡片一侧移动到另一侧后，第三方效果层的视觉 `transform` 和直属高光背景方向必须保持不变；登录→注册→登录时，在点击后首个 `requestAnimationFrame` 内宿主、`.glass` 与两个官方高光的实际底部误差不得超过 `1px`，`.glass` 与两个高光的 `transition-property` 必须为 `none`；随后宿主、效果层、`.glass`、SVG 滤镜与高光的未变换布局尺寸保持同步。人工尺寸通知期间必须短暂出现且同步清除 `data-liquid-glass-measuring="true"` 中性测量态，不得把视觉矩形持久化为玻璃尺寸。
