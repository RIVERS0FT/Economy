# Economy liquid-glass-react 应用外壳设计

> 状态：桌面与移动端顶部状态栏、移动底部导航及游戏外壳几何基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-20

本文件定义应用外壳唯一液态玻璃实现、桌面与移动工作区几何、浏览器运行时样式入口、性能约束和防回退规则。通用 UI、覆盖式滚动条和市场表格仍以 `docs/UI_DESIGN_SYSTEM.md` 为准。

## 1. 唯一材质来源

- `liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现。
- `src/components/ui/LiquidGlassSurface.tsx` 是唯一允许直接导入该依赖的文件。
- 状态栏和移动底栏只能使用 `LiquidGlassSurface` 预设，不得在业务组件中直接设置第三方参数。
- `src/styles/liquid-glass-surfaces.css` 只负责尺寸、层级、内容布局、圆角裁切、可读性回退、单层高光和单层结构描边；不得用 CSS 重新实现模糊、折射或色差。
- `src/styles/liquid-glass-chrome.css` 是浏览器测试兼容入口，不是第二套材质。它只允许按固定顺序转发 `performance.css`、`scrollbars.css`、`game-shell-layout.css` 和 `liquid-glass-surfaces.css`；生产入口 `src/main.tsx` 继续直接导入正式样式。
- 浏览器运行时 harness 必须加载真实的滚动条与外壳几何样式，不得只加载历史全局样式后用错误计算结果验证布局。

## 2. 文件职责与加载顺序

| 文件 | 唯一职责 |
|---|---|
| `LiquidGlassSurface.tsx` | 第三方库适配、参数预设、静态鼠标输入和统一 DOM |
| `liquid-glass-surfaces.css` | 玻璃宿主、第三方 DOM 尺寸、裁切、内容网格、高光和结构描边 |
| `liquid-glass-chrome.css` | 浏览器 harness 的共享外壳样式兼容聚合入口 |
| `game-shell-layout.css` | 桌面双列轨道、状态栏外距、页面避让和工作区几何 |
| `desktop-sidebar.css` | 侧栏展开／折叠、导航固有行高和过渡 |
| `viewport.css` | 固定视口、移动工作区 gutter、两层 Overlay 和安全区 |
| `scrollbars.css` | 全局覆盖式滚动条；移动页面纵向轨道固定到视口安全边缘 |
| `mobile-status-navigation.css` | 移动导航布局、原生滚动能力和移动底栏可见轨道隐藏规则 |
| `verify-liquid-glass-chrome.mjs` | 依赖、适配层、兼容入口、布局和防回退检查 |
| `verify-game-shell-layout.mjs` | 桌面双列、导航行高、移动 Overlay、滚动条和滚动链检查 |
| `verify-overlay-scrollbars.mjs` | 覆盖式滚动条、移动底栏隐藏轨道和滚动能力检查 |
| `liquid-glass-layout.spec.ts` | 真实浏览器玻璃、圆角、共线和页面避让验证 |
| `mobile-workspace-overlay.spec.ts` | 移动安全边缘轨道和内容宽度验证 |
| `mobile-navigation-scrollbar.spec.ts` | 移动底栏隐藏可见轨道且仍可横向滚动的验证 |

生产几何样式顺序固定为 `viewport.css` → `scrollbars.css` → `game-shell-layout.css`。浏览器兼容入口在 harness 已加载 `viewport.css` 后，固定转发 `performance.css` → `scrollbars.css` → `game-shell-layout.css` → `liquid-glass-surfaces.css`。

## 3. 统一参数预设

禁止 `shader` 模式，外壳继续使用 `elasticity={0}` 保持几何稳定。

### 3.1 顶部状态栏

- `mode="prominent"`；
- `displacementScale: 38`；
- `blurAmount: 0.14`；
- `saturation: 145`；
- `aberrationIntensity: 1.15`；
- `elasticity={0}`；
- 桌面 `cornerRadius: 24`，与 `--radius-card: 1.5rem` 一致。

### 3.2 移动底部导航

- `mode="standard"`；
- `displacementScale: 20`；
- `blurAmount: 0.5`；
- `saturation: 145`；
- `aberrationIntensity: 0.5`；
- `elasticity={0}`；
- `cornerRadius: 40`；
- 移动底栏玻璃圆角与移动一级卡片 `--radius-card-mobile` 一致，当前均为 `40px`。

外壳必须传入固定 `globalMousePos` 和 `mouseOffset`，不得为状态栏或导航注册全局鼠标跟踪。状态项和导航按钮由内部原生控件承担交互。

## 4. 平台能力边界

所有平台都渲染同一个 `LiquidGlassSurface`：

- Chromium、Android Chromium WebView 和 Windows WebView2 显示完整折射、模糊和边缘色差；
- Safari、iOS WebKit 和 Firefox 在折射能力受限时仍保留同一组件、模糊、高光和内容结构；
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
- `.page-scroll-area` 与 `.page-scroll` 铺满工作区，桌面左右 padding 为 `0`；
- `.page-content` 使用 `width: 100%`、`max-width: none`、`margin: 0`，桌面左右 padding 为 `0`。

不得给 `.game-shell`、`.workspace`、`.page-scroll-area`、`.page-scroll` 或 `.page-content` 添加外边距模拟侧栏留白。

## 6. 移动工作区、Overlay 与滚动条

不大于 `720px` 时：

- `.workspace` 是页面、状态栏和底栏唯一水平边界，左右 padding 使用 `max(var(--mobile-workspace-gutter), env(safe-area-inset-left/right))`；
- `.mobile-page-overlay` 和 `.mobile-chrome-overlay` 占据同一 Grid 单元；页面层负责滚动，Chrome 层负责状态栏和底栏；
- Chrome Overlay 使用 `pointer-events: none`，只有状态栏和底栏恢复交互；
- 状态栏玻璃、底栏玻璃和一级卡片左右边缘必须共线；
- `.asset-bar` 不得用水平 padding 缩窄实际玻璃，状态项留白放入 `.asset-bar-content`；
- `.page-scroll` 左右 padding 必须为 `0`；
- 移动状态栏固定 `48px`，移动底栏固定 `68px`，底栏相对 Chrome Overlay 使用 `position: absolute`；
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

## 7. 材质、圆角和结构边缘

- `.asset-bar` 和 `.mobile-bottom-navigation` 不得包含 `.panel`；
- 整个状态栏只允许一个玻璃实例，整个移动底栏只允许一个玻璃实例；
- 支持环境中的状态栏宿主背景透明，由第三方 `.glass__warp` 采样页面内容；
- 桌面状态栏属于桌面一级表面，必须复用通用 `--radius-card`；
- 宿主只保留一条低强度 `1px` 结构描边；
- 第三方直属装饰中只允许第一层低透明度 screen 高光可见；
- 第二层 overlay 装饰必须隐藏，避免双边框和角部断线；
- 移动底栏的 React `cornerRadius`、CSS 裁切和第三方折射层必须都为 `40px`；
- 所有第三方装饰层必须受宿主圆角裁切，不得在右侧或底部溢出。

## 8. 状态项、数字和导航

- 标签使用次级文字色，主数值使用主文字色，说明使用弱化文字色；
- 排名统一通过 `formatRank` 显示为 `#N`；
- 实际数字格式遵循全局“紧凑数字”偏好；
- 玩家关闭全局“紧凑数字”后，桌面和移动状态栏都显示带千分位的完整整数；
- 移动导航按钮固定 `48px × 48px`，活动、悬停和触摸状态不得位移或缩放；
- 状态栏有横向溢出时水平轨道常驻；移动底栏隐藏可见水平轨道，但保留触控、触控板、滚轮和键盘横向滚动能力。普通纵向滚轮不得转换为水平滚动。

## 9. 性能与可访问性

- 桌面同时可见一个玻璃实例，移动同时可见两个；
- 禁止滚动事件更新玻璃参数、噪点动画和每项独立滤镜；
- 页面初始内容避让状态栏和底栏，滚动时允许进入玻璃后方；
- 装饰 SVG 和覆盖层不得阻止内部按钮事件；
- 页面和内部列表到达纵向边界后必须保留滚动链；
- 滑块保留 `role="scrollbar"`、方向、范围、拖动、轨道翻页和键盘语义；移动底栏隐藏的水平轨道不承担键盘焦点，导航按钮和原生滚动视口继续可访问。

## 10. 验收标准

必须检查桌面 `1920×1080`、`1684×931`、`1440×900`、`1024×768`、`900×768`，以及移动 `430px`、`390px`、`375px`、`360px`、`320px`：

1. 状态栏和移动底栏都由 `LiquidGlassSurface` 渲染。
2. 桌面外壳覆盖整个视口，侧栏、状态栏和工作区共享统一外距。
3. 桌面导航按钮从顶部按固有高度排列。
4. 桌面状态栏与一级卡片圆角均为 `24px`，只有一条结构描边和一层高光。
5. 移动状态栏、一级卡片和底栏实际玻璃左右共线。
6. 移动状态栏固定 `48px`，底栏固定 `68px`，底栏和移动卡片圆角均为 `40px`。
7. 移动页面轨道固定到视口安全边缘，滑块右边缘约为 `2px`，显隐前后内容宽度不变。
8. 移动底栏的原生与项目水平滚动条都不可见，但导航视口仍存在横向溢出并可滚动到最后一项。
9. 浏览器运行时 harness 实际加载 `performance.css`、`scrollbars.css`、`game-shell-layout.css` 和 `liquid-glass-surfaces.css`。
10. `npm run build` 与全部 Chromium 浏览器测试通过。

## 11. 不可回退规则

除非先更新本文档、架构检查和浏览器测试，否则不得：

- 在 `LiquidGlassSurface.tsx` 之外直接导入 `liquid-glass-react`；
- 在项目 CSS 中重新实现液态玻璃材质或改用 `shader`；
- 给状态项或导航按钮分别创建玻璃实例；
- 给桌面 `.game-shell` 恢复 padding／gap，或给 `.page-content` 恢复居中最大宽度；
- 让桌面侧栏导航自动行拉伸；
- 给移动状态栏、页面或底栏恢复独立水平 inset；
- 把移动底栏恢复为相对视口的 `position: fixed`；
- 不得恢复移动底栏可见水平轨道，也不得因隐藏轨道而禁用触控、触控板、滚轮或键盘横向滚动；
- 把移动页面轨道限制在卡片边缘、恢复 escape／translateX 方案、越过安全区或改变卡片宽度；
- 在 `.page-scroll` 上使用 `overscroll-behavior: contain` 阻断纵向滚动链；
- 给 `.asset-bar-scroll-area` 设置 `height: 100%`；
- 删除 `liquid-glass-chrome.css` 中浏览器 harness 所需的真实滚动条或外壳几何导入；
- 只验证宿主边界而不验证实际 `.liquid-glass-surface`；
- 绕过架构检查或浏览器几何测试合并视觉回退。
