# Economy liquid-glass-react 应用外壳设计

> 状态：桌面与移动端顶部状态栏、移动底部导航及游戏外壳几何基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-20

本文件定义应用外壳唯一液态玻璃实现、桌面与移动工作区几何、移动导航结构、浏览器运行时样式入口、性能约束和防回退规则。通用 UI、覆盖式滚动条和市场表格仍以 `docs/UI_DESIGN_SYSTEM.md` 为准。

## 1. 唯一材质来源

- `liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现。
- `src/components/ui/LiquidGlassSurface.tsx` 是唯一允许直接导入该依赖的文件。
- 桌面状态栏、移动状态栏和移动底栏只能使用 `LiquidGlassSurface` 预设，不得在业务组件中直接设置第三方参数。
- 桌面状态栏必须使用独立的 `DESKTOP_STATUS_GLASS`；移动状态栏与移动底栏共同使用 `MOBILE_CHROME_GLASS`。桌面与移动不得再次合并为同一个参数常量。
- `StatusBar.tsx` 通过 `(max-width: 720px)` 媒体查询在 `desktopStatusBar` 与 `mobileStatusBar` 之间切换；任一时刻只能渲染一个状态栏玻璃实例，不得通过同时渲染两套后再用 CSS 隐藏。
- `src/styles/liquid-glass-surfaces.css` 只负责尺寸、层级、内容布局、圆角裁切、低密度透明染色、可读性回退、单层结构描边、第三方装饰层显隐和与各预设完全一致的 WebKit 属性别名；不得用 CSS 创建第二套模糊、折射或色差材质。
- 桌面与移动状态栏必须隐藏 `liquid-glass-react` 直属的两层边框／高光 `span`、两个 over-light 辅助 `div`，并清除第三方 `.glass` 外部阴影，只保留 `.glass__warp` 材质和宿主的一条结构描边。移动底栏允许保留第一层低强度 screen 高光。
- `src/styles/liquid-glass-chrome.css` 是浏览器测试兼容入口，不是第二套材质。它只允许按固定顺序转发 `performance.css`、`scrollbars.css`、`game-shell-layout.css` 和 `liquid-glass-surfaces.css`；生产入口 `src/main.tsx` 继续直接导入正式样式。
- 浏览器运行时 harness 必须加载真实的滚动条与外壳几何样式，不得只加载历史全局样式后用错误计算结果验证布局。

## 2. 文件职责与加载顺序

| 文件 | 唯一职责 |
|---|---|
| `LiquidGlassSurface.tsx` | 第三方库适配、桌面状态栏预设、移动 Chrome 预设、静态鼠标输入和统一 DOM |
| `StatusBar.tsx` | 保持单一状态栏实例，并按 `720px` 断点选择桌面／移动状态栏预设 |
| `liquid-glass-surfaces.css` | 玻璃宿主、第三方 DOM 尺寸、开放背景采样链、平台圆角、透明染色、状态栏单壳层级、移动底栏单层高光、结构描边、底栏唯一垂直留白和 WebKit 兼容别名 |
| `liquid-glass-chrome.css` | 浏览器 harness 的共享外壳样式兼容聚合入口 |
| `game-shell-layout.css` | 桌面双列轨道、状态栏外距、页面避让和工作区几何 |
| `desktop-sidebar.css` | 侧栏展开／折叠、导航固有行高和过渡 |
| `viewport.css` | 固定视口、移动工作区 gutter、两层 Overlay、安全区和移动背景采样层级 |
| `scrollbars.css` | 通用覆盖式滚动条；移动页面纵向轨道固定到视口安全边缘，不负责移动底栏 |
| `mobile-status-navigation.css` | 移动导航唯一原生横向滚动视口、原生轨道隐藏、按钮几何和内部焦点环 |
| `verify-liquid-glass-chrome.mjs` | 依赖、平台分离预设、单实例切换、单壳装饰、兼容入口、背景采样链、移动导航结构和防回退检查 |
| `verify-game-shell-layout.mjs` | 桌面双列、导航行高、移动 Overlay、滚动条和滚动链检查 |
| `verify-overlay-scrollbars.mjs` | 覆盖式滚动条、移动底栏原生滚动视口和滚动能力检查 |
| `verify-desktop-primary-surfaces.mjs` | 桌面一级卡片与独立桌面状态栏圆角、单结构边框和零第三方装饰层检查 |
| `liquid-glass-layout.spec.ts` | 真实浏览器平台预设、单状态栏实例、装饰层显隐、背景采样链、圆角、共线和页面避让验证 |
| `mobile-workspace-overlay.spec.ts` | 移动安全边缘轨道和内容宽度验证 |
| `mobile-navigation-scrollbar.spec.ts` | 移动底栏单一原生滚动视口、隐藏轨道、完整按钮边界和末项可达性验证 |

生产几何样式顺序固定为 `viewport.css` → `scrollbars.css` → `game-shell-layout.css`。浏览器兼容入口在 harness 已加载 `viewport.css` 后，固定转发 `performance.css` → `scrollbars.css` → `game-shell-layout.css` → `liquid-glass-surfaces.css`。

## 3. 平台分离参数预设

禁止 `shader` 模式，所有外壳继续使用 `elasticity={0}` 和固定 `globalMousePos`／`mouseOffset` 保持几何稳定。

### 3.1 桌面状态栏

`DESKTOP_STATUS_GLASS` 只供 `desktopStatusBar` 使用，参数固定为：

- `mode="standard"`；
- `displacementScale: 20`；
- `blurAmount: 0.0625`，对应 `blur(6px)`；
- `saturation: 120`；
- `aberrationIntensity: 0.15`；
- `elasticity={0}`；
- `cornerRadius: 24`。

桌面状态栏是宽而低的固定信息条，使用较轻的位移、色差和模糊，并与桌面一级卡片的 `24px` 圆角一致。不得恢复 `prominent` 中心透镜、`40px` 胶囊或移动端的较强边缘参数。

### 3.2 移动状态栏与移动底栏

`MOBILE_CHROME_GLASS` 同时供 `mobileStatusBar` 和 `mobileNavigation` 使用，参数固定为：

- `mode="standard"`；
- `displacementScale: 32`；
- `blurAmount: 0.1`，对应 `blur(7.2px)`；
- `saturation: 125`；
- `aberrationIntensity: 0.3`；
- `elasticity={0}`；
- `cornerRadius: 40`。

移动状态栏和底栏继续保持 iOS 工具栏式清透厚玻璃及 `40px` 胶囊轮廓。移动状态栏虽然与底栏共用材质参数，但装饰策略不同：状态栏隐藏全部第三方直属装饰，底栏只保留第一层 `opacity: 0.22` 的 screen 高光。

## 4. 平台能力边界

所有平台都渲染同一个 `LiquidGlassSurface` 适配组件：

- Chromium、Android Chromium WebView 和 Windows WebView2 显示完整折射、模糊和边缘色差；
- Safari、iOS WebKit 和 Firefox 在折射能力受限时仍保留同一组件、轻度模糊、结构描边和内容结构；
- `liquid-glass-react` 内联的非前缀 `backdrop-filter` 始终是参数权威；桌面状态栏的 `-webkit-backdrop-filter` 必须严格为 `blur(6px) saturate(120%)`，移动状态栏与底栏必须严格为 `blur(7.2px) saturate(125%)`；
- 不支持 `backdrop-filter` 时只使用可读性回退底色，不切换到另一套玻璃；
- 平台能力差异不得改变状态栏高度、安全区、导航尺寸或内容顺序。

## 5. 桌面应用外壳几何

大于 `720px` 时：

- `.game-shell` 固定覆盖视口，最终 `padding` 和 `gap` 都为 `0`；
- 第一列由侧栏左侧外距、侧栏宽度和侧栏与工作区间隔组成；第二列 `.workspace` 使用全部剩余宽度并贴合视口顶部、右侧和底部；
- `--desktop-shell-outer-inset` 是侧栏与状态栏唯一桌面外距令牌，默认 `12px`；
- 状态栏顶部／右侧间距都来自统一桌面外距，左边缘与 `.workspace` 一致；
- 侧栏展开宽度为 `224px`，折叠宽度为 `78px`，只能通过 `--sidebar-column-width` 改变工作区起点；
- `721px–960px` 使用自动紧凑侧栏和 `8px` 统一外距；
- 桌面侧栏导航必须从顶部按固有行高排列，不能把九个按钮平均拉伸到整列高度；
- 桌面状态栏高度保持 `76px`，实际玻璃圆角为 `24px`，与桌面一级卡片 `--radius-card: 24px` 一致；
- `.page-scroll-area` 与 `.page-scroll` 铺满工作区，桌面左右 padding 为 `0`；
- `.page-content` 使用 `width: 100%`、`max-width: none`、`margin: 0`，桌面左右 padding 为 `0`。

不得给 `.game-shell`、`.workspace`、`.page-scroll-area`、`.page-scroll` 或 `.page-content` 添加外边距模拟侧栏留白。

## 6. 移动工作区、Overlay 与滚动条

不大于 `720px` 时：

- `.workspace` 是页面、状态栏和底栏唯一水平边界，左右 padding 使用 `max(var(--mobile-workspace-gutter), env(safe-area-inset-left/right))`；
- `.mobile-page-overlay` 和 `.mobile-chrome-overlay` 占据同一 Grid 单元；页面层负责滚动，Chrome 层负责状态栏和底栏；
- 移动层级依赖 DOM 绘制顺序：页面 Overlay 先渲染，Chrome Overlay 后渲染；`.workspace`、两层 Overlay、`.page-scroll`、状态栏宿主和底栏宿主在移动端都不得建立正 `z-index` 或 `isolation: isolate` 背景根；
- 页面内部若使用带非 `auto` `z-index` 的 `position: sticky`／定位元素，必须由页面局部堆叠上下文收口，不能让其层级逃逸到 Chrome Overlay 之上。市场资产目录在移动端固定由 `.asset-directory-shell { position: relative; z-index: 0; }` 收口，使 `.asset-directory-divider` 的层级只在目录内部生效；
- Chrome Overlay 使用 `pointer-events: none`，只有状态栏和底栏恢复交互；
- 状态栏玻璃、底栏玻璃和一级卡片左右边缘必须共线；
- `.asset-bar` 不得用水平 padding 缩窄实际玻璃，状态项留白放入 `.asset-bar-content`；
- `.page-scroll` 左右 padding 必须为 `0`；
- 移动状态栏固定 `48px`，移动底栏固定 `68px`，两者使用同一 `40px` 胶囊圆角和同一移动材质参数；底栏相对 Chrome Overlay 使用 `position: absolute`；
- 不得给 `.asset-bar-scroll-area` 设置 `height: 100%`。

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

固定的只有覆盖式轨道；`.page-scroll-area`、`.page-scroll`、`.page-content` 和卡片仍由 `.workspace` 控制。滑块在轨道内右对齐并保留 `2px` 偏移，因此无安全区时距视口右边约 `2px`，有安全区时距安全区内缘约 `2px`。滚动条显隐不得改变页面 `clientWidth` 或卡片宽度。

不得恢复 `--mobile-workspace-inline-end`、`--mobile-scrollbar-edge-escape`、`right: 0 + translateX(...)`、负 `right` 或扩大页面宽度的逃逸实现。

## 7. 材质、背景采样、圆角和结构边缘

- `.asset-bar` 和 `.mobile-bottom-navigation` 不得包含 `.panel`；
- 整个顶部状态栏只允许一个玻璃实例；桌面／移动断点切换必须更新同一个实例的 `variant`，不得并列两套 DOM；整个移动底栏也只允许一个玻璃实例；
- 支持环境中的桌面状态栏、移动状态栏和底栏使用同一低密度透明染色 `rgba(194, 231, 214, 0.06)`，第三方 `.glass__warp` 继续采样页面内容；
- `.glass__warp` 到页面内容之间必须保持开放的背景采样链；`.liquid-glass-surface` 不得使用 `contain: paint`、`isolation: isolate` 或 `overflow: clip`，统一使用 `overflow: hidden` 完成圆角裁切；
- 桌面与移动预设的 WebKit 兼容别名必须分别匹配上游参数，不得使用一个通用数值覆盖两个平台；
- 三种宿主都只保留一条低强度 `1px` 结构描边；桌面状态栏圆角为 `24px`，移动状态栏和底栏圆角为 `40px`；
- 桌面与移动状态栏直属的所有 `span` 装饰必须为 `display: none`，所有非 `.liquid-glass-surface__effect` 直属辅助 `div` 必须隐藏，第三方 `.glass` 计算后的 `box-shadow` 必须为 `none`；
- 移动底栏的两个直属 `span` 中只允许第一层 `opacity: 0.22` 的 screen 高光可见，第二层 overlay 装饰必须隐藏；
- React `cornerRadius`、CSS 裁切和第三方折射层必须分别与所属平台预设一致；
- 所有仍可见的第三方装饰层必须受宿主圆角裁切，不得在右侧或底部溢出。

## 8. 状态项、数字和移动导航结构

- 标签使用次级文字色，主数值使用主文字色，说明使用弱化文字色；
- 排名统一通过 `formatRank` 显示为 `#N`；
- 实际数字格式遵循全局“紧凑数字”偏好；
- 玩家关闭全局“紧凑数字”后，桌面和移动状态栏都显示带千分位的完整整数；
- 移动导航按钮固定 `48px × 48px`，活动、悬停和触摸状态不得位移或缩放；
- 移动底栏隐藏可见水平轨道，但保留触控、触控板、滚轮和键盘横向滚动能力。普通纵向滚轮不得转换为水平滚动；
- 语义化 `<nav>` 是移动底栏唯一横向滚动视口；DOM 固定为 `aside.mobile-bottom-navigation → LiquidGlassSurface → .liquid-glass-surface__content → nav.mobile-bottom-navigation__viewport → buttons`；
- 移动底栏不得重新引入 `ScrollArea`、`.mobile-navigation-frame`、`.mobile-navigation-scroll-area`、项目自绘水平轨道或用于制造左右留白的 `::before`／`::after` 占位元素；
- 左右滚动留白只由 `nav` 的 `padding-inline: var(--mobile-nav-scroll-gutter)` 提供；
- 只有 `.liquid-glass-surface` 负责胶囊裁切，`nav` 只保留横向滚动所必需的 `overflow-x: auto` 和 `overflow-y: hidden`；不得增加额外垂直裁切包装层；
- 移动底栏垂直留白只允许由 `.liquid-glass-surface__content` 提供，固定为 `padding: 8px 0`；`.mobile-bottom-navigation` 必须保持 `padding: 0`，不得恢复双层垂直 padding；
- `48px` 按钮在 `68px` 胶囊内必须完整显示，上下边缘不得被裁剪；焦点环必须使用内部 `inset` 绘制，不得使用向外扩张的 `outline-offset`。

## 9. 性能与可访问性

- 桌面同时可见一个玻璃实例，移动同时可见两个；
- 禁止滚动事件更新玻璃参数、噪点动画和每项独立滤镜；
- 页面初始内容避让状态栏和底栏，滚动时允许进入玻璃后方；
- 装饰 SVG 和覆盖层不得阻止内部按钮事件；
- 页面和内部列表到达纵向边界后必须保留滚动链；
- 通用滑块保留 `role="scrollbar"`、方向、范围、拖动、轨道翻页和键盘语义；移动底栏不渲染项目自绘滑块，导航按钮和原生 `<nav>` 滚动视口继续可访问。

## 10. 验收标准

必须检查桌面 `1920×1080`、`1684×931`、`1440×900`、`1024×768`、`900×768`，以及移动 `430px`、`390px`、`375px`、`360px`、`320px`：

1. 桌面状态栏使用 `desktopStatusBar`／`DESKTOP_STATUS_GLASS`；移动状态栏使用 `mobileStatusBar`，移动底栏使用 `mobileNavigation`，后两者共同引用 `MOBILE_CHROME_GLASS`。
2. 从桌面调整到移动断点时，顶部状态栏始终只有一个 `.liquid-glass-surface`，variant 原地切换，不出现并列或残留玻璃实例。
3. 三者计算后的 `data-liquid-glass-mode` 都为 `standard`，WebKit 与非前缀背景滤镜一致，模糊和 SVG 折射引用均有效。
4. 桌面外壳覆盖整个视口，侧栏、状态栏和工作区共享统一外距。
5. 桌面导航按钮从顶部按固有高度排列。
6. 桌面状态栏圆角和桌面一级卡片均为 `24px`；状态栏只有一条结构描边，直属装饰 `span` 可见数量为 `0`，辅助 over-light `div` 不参与显示，第三方 `.glass` 无 box-shadow。
7. 移动状态栏、一级卡片和底栏实际玻璃左右共线。
8. 移动状态栏固定 `48px`，底栏固定 `68px`；状态栏、底栏和移动一级卡片计算圆角均为 `40px`。
9. 移动状态栏与底栏使用相同透明染色和 `blur(7.2px) saturate(125%)` 兼容滤镜；移动状态栏直属装饰可见数量为 `0`，底栏为 `1`。
10. 桌面状态栏使用 `blur(6px) saturate(120%)`，不得被移动参数覆盖。
11. 状态栏和移动底栏的宿主 `contain` 为 `none`、`isolation` 为 `auto`、裁切为 `overflow: hidden`。
12. 移动背景采样链中的 `.workspace`、两层 Overlay、`.page-scroll`、状态栏宿主和底栏宿主计算 `z-index` 均为 `auto`。
13. 移动页面内部的 sticky／定位层级不得逃逸到 Chrome Overlay 上方；市场目录滚入状态栏后方时，命中测试必须仍返回状态栏内部元素。
14. 移动页面轨道固定到视口安全边缘，滑块右边缘约为 `2px`，显隐前后内容宽度不变。
15. 移动底栏不包含 `ScrollArea`、额外 frame 或项目自绘水平轨道；原生滚动条不可见，唯一 `<nav>` 仍存在横向溢出并可滚动到最后一项。
16. 移动底栏外层 padding 为 `0`，内容层上下 padding 为 `8px`；活动按钮上下边缘完全位于滚动视口内。
17. 浏览器运行时 harness 实际加载 `performance.css`、`scrollbars.css`、`game-shell-layout.css` 和 `liquid-glass-surfaces.css`。
18. `npm run build` 与全部 Chromium 浏览器测试通过。

## 11. 不可回退规则

除非先更新本文档、架构检查和浏览器测试，否则不得：

- 在 `LiquidGlassSurface.tsx` 之外直接导入 `liquid-glass-react`；
- 在项目 CSS 中重新实现液态玻璃材质或改用 `shader`；
- 将 `DESKTOP_STATUS_GLASS` 与 `MOBILE_CHROME_GLASS` 重新合并，或让桌面状态栏直接复用移动预设；
- 改变桌面 `displacementScale: 20`、`blurAmount: 0.0625`、`saturation: 120`、`aberrationIntensity: 0.15`、`cornerRadius: 24`，或移动 `displacementScale: 32`、`blurAmount: 0.1`、`saturation: 125`、`aberrationIntensity: 0.3`、`cornerRadius: 40` 而不同时更新本文档与测试；
- 恢复 `prominent`、中心透镜式强折射或 `shader` 模式；
- 同时渲染桌面和移动状态栏后依靠 CSS 隐藏其中一套，或在断点切换后留下多于一个状态栏玻璃实例；
- 恢复状态栏直属装饰 `span`、over-light 辅助 `div` 或第三方 `.glass` box-shadow，使其与宿主结构描边形成多层状态栏；
- 给状态项或导航按钮分别创建玻璃实例；
- 在 `.liquid-glass-surface` 恢复 `contain: paint`、`isolation: isolate`、`overflow: clip`，或在移动玻璃与页面之间恢复正 `z-index` 背景根；
- 让页面内带正层级的 sticky／定位元素脱离局部堆叠上下文并覆盖状态栏或移动底栏；市场 `.asset-directory-shell` 不得删除移动端 `position: relative; z-index: 0`；
- 删除或改变与各自上游预设严格一致的 `.glass__warp` `-webkit-backdrop-filter` 兼容别名；
- 给桌面 `.game-shell` 恢复 padding／gap，或给 `.page-content` 恢复居中最大宽度；
- 让桌面侧栏导航自动行拉伸；
- 给移动状态栏、页面或底栏恢复独立水平 inset；
- 把移动底栏恢复为相对视口的 `position: fixed`；
- 不得恢复移动底栏可见水平轨道，也不得因隐藏轨道而禁用触控、触控板、滚轮或键盘横向滚动；
- 不得重新引入 `ScrollArea`、`.mobile-navigation-frame`、`.mobile-navigation-scroll-area`、项目自绘水平轨道、伪元素留白或多层垂直裁切包装；
- 不得在 `.mobile-bottom-navigation` 恢复垂直 padding，不得把内容层 `8px` 留白复制到其他层，也不得恢复外扩焦点 outline；
- 把移动页面轨道限制在卡片边缘、恢复 escape／translateX 方案、越过安全区或改变卡片宽度；
- 在 `.page-scroll` 上使用 `overscroll-behavior: contain` 阻断纵向滚动链；
- 给 `.asset-bar-scroll-area` 设置 `height: 100%`；
- 删除 `liquid-glass-chrome.css` 中浏览器 harness 所需的真实滚动条或外壳几何导入；
- 只验证宿主边界而不验证实际 `.liquid-glass-surface`、`.glass__warp`、直属装饰层与第三方 `.glass`；
- 绕过架构检查或浏览器几何测试合并视觉回退。
