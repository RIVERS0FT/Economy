# Economy liquid-glass-react 应用外壳设计

> 状态：桌面与移动端顶部状态栏、移动底部导航的视觉与布局基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-19

本文件定义应用外壳唯一液态玻璃实现、跨浏览器能力边界、稳定几何、性能约束和防回退规则。通用 UI 仍以 `docs/UI_DESIGN_SYSTEM.md` 为准；涉及状态栏和移动底栏材质时，以本文件为专题权威基线。

## 1. 唯一材质来源

- `liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现。
- `src/components/ui/LiquidGlassSurface.tsx` 是唯一允许直接导入该依赖的文件。
- 状态栏和移动底栏只能使用 `LiquidGlassSurface` 的预设，不得在业务组件中直接设置第三方参数。
- `src/styles/liquid-glass-surfaces.css` 只负责尺寸、层级、内容布局、透明通用面板覆盖和最低可读性底色；不得用 CSS 重新实现模糊、折射、色差、高光或玻璃阴影。
- 旧 `src/styles/liquid-glass-chrome.css` 必须删除，且不得恢复。

## 2. 文件职责

| 文件 | 职责 |
|---|---|
| `src/components/ui/LiquidGlassSurface.tsx` | 第三方库适配、参数预设、静态鼠标输入和统一 DOM |
| `src/components/shell/StatusBar.tsx` | 状态项语义、交互和状态栏内容布局入口 |
| `src/components/shell/MobileBottomNavigation.tsx` | 移动导航语义与内容入口 |
| `src/styles/liquid-glass-surfaces.css` | 玻璃宿主几何、第三方 DOM 尺寸适配、状态栏内容网格和最低对比度 |
| `src/styles/viewport.css` | 桌面悬浮定位、滚动层和移动安全区 |
| `src/styles/mobile-status-navigation.css` | 移动导航按钮尺寸、滚动和交互 |
| `src/styles/mobile-status-layout.css` | 移动顶部状态栏全宽等距布局 |
| `scripts/verify-liquid-glass-chrome.mjs` | 依赖、适配层、布局与防回退检查 |

样式加载顺序固定为：`card-system.css` → `liquid-glass-surfaces.css` → 移动外壳样式 → `icon-system.css` → 业务样式 → `design-system.css`。

## 3. 统一参数预设

应用外壳固定使用 `mode="standard"`，不使用稳定性较低的 `shader` 模式。

### 3.1 顶部状态栏

- `displacementScale: 28`
- `blurAmount: 0.6875`
- `saturation: 145`
- `aberrationIntensity: 0.8`
- `elasticity={0}`
- 桌面圆角 `18px`，移动端通过宿主几何覆盖为胶囊圆角

### 3.2 移动底部导航

- `displacementScale: 20`
- `blurAmount: 0.5`
- `saturation: 145`
- `aberrationIntensity: 0.5`
- `elasticity={0}`
- 圆角 `20px`

外壳必须传入固定 `globalMousePos` 和 `mouseOffset`，禁止第三方组件为状态栏和底栏注册鼠标移动监听。状态项或导航按钮的交互由内部原生按钮承担，不给玻璃外壳传 `onClick`。

## 4. 全平台能力边界

所有平台都渲染同一个 `LiquidGlassSurface`，不得按浏览器切换回另一套 CSS 玻璃：

- Chromium、Android Chromium WebView、Windows WebView2 显示完整标准折射、模糊和边缘色差。
- Safari、iOS WebKit 和 Firefox 使用同一组件；受浏览器 SVG displacement 支持限制，折射可能不可见，但模糊、高光和内容结构继续保留。
- 不支持 `backdrop-filter` 的环境只使用高不透明度对比底色保证可读性，不模拟第二套玻璃。
- 平台能力差异不允许改变状态栏高度、安全区、导航尺寸或内容顺序。

## 5. DOM 与布局

状态栏结构固定为：

```text
.asset-bar.panel
└─ LiquidGlassSurface(statusBar)
   └─ .asset-bar-content
      └─ .asset-bar-item × 5
```

移动底栏结构固定为：

```text
.mobile-bottom-navigation.panel
└─ LiquidGlassSurface(mobileNavigation)
   └─ .sidebar-nav
      └─ 导航按钮
```

保留 `panel` 类只为兼容既有定位和移动规则；`liquid-glass-surfaces.css` 必须以更高选择器优先级清除通用面板背景、边框、阴影和外层内边距，实际材质只来自第三方组件。状态栏内容内边距由 `.asset-bar-content` 管理，移动底栏垂直内边距由 `.liquid-glass-surface__content` 管理。

桌面状态栏继续保持单行五列，最小内容宽度为 `675px`；961px 以下桌面最小内容宽度为 `725px`，空间不足时由外层状态栏横向滚动。移动端清除该最小宽度并使用全宽安全区胶囊。

## 6. 状态项和移动导航

- 整个状态栏只有一个玻璃实例，不得为每个状态项单独创建实例。
- 整个移动底栏只有一个玻璃实例，不得为每个导航按钮单独创建实例。
- 桌面状态项保留弱分隔线；移动状态项不显示分隔线、独立边框或图标底板。
- 移动顶部固定显示可用资金、总资产、排行榜和仓库剩余四项，使用 `space-evenly` 和内容宽度项目。
- 移动顶部状态栏固定 `48px`，移动底栏固定 `68px`。
- 移动导航按钮固定 `48px × 48px`，活动、悬停和触摸状态不得位移或缩放。
- 图标继续统一来自 `GameIcons.tsx`，不得恢复 Unicode、Emoji 或第二套图标。

## 7. 性能与可访问性

- 桌面同时可见一个玻璃实例；移动同时可见两个玻璃实例。
- 禁止 `shader` 模式、滚动事件更新参数、噪点动画和每项独立滤镜。
- `elasticity={0}` 保证外壳几何稳定；内部按钮仍保留键盘焦点和点击反馈。
- 页面内容继续从状态栏下方开始并可滚动到玻璃后方。
- 玻璃生成的装饰 SVG 和覆盖层不得阻止内部按钮事件。

## 8. 验收标准

必须检查桌面 `1920px`、`1440px`、`1024px`、`768px`，以及移动 `430px`、`390px`、`375px`、`360px`、`320px`：

1. 状态栏和移动底栏均由 `LiquidGlassSurface` 渲染。
2. Chromium 显示折射，Safari／Firefox 缺少折射时仍清晰可读。
3. 页面滚动时内容可进入状态栏后方。
4. 状态栏没有旧 CSS 渐隐横条。
5. 桌面状态栏不换行，空间不足时横向滚动。
6. 移动顶部四项完整显示且不可横向滚动。
7. 移动底栏可横向滚动，按钮固定 `48px × 48px`。
8. 玻璃外壳和内部按钮不发生弹性位移或缩放。
9. 键盘焦点、触摸、安全区和页面避让正常。
10. `npm run build` 与浏览器测试通过。

## 9. 不可回退规则

除非先更新本设计和架构检查，否则不得：

- 恢复 `liquid-glass-chrome.css` 或 CSS `backdrop-filter` 玻璃材质；
- 在 `LiquidGlassSurface.tsx` 之外直接导入 `liquid-glass-react`；
- 改用 `shader` 模式或把应用外壳 `elasticity` 调为非零；
- 为状态项或导航按钮分别创建玻璃实例；
- 删除固定鼠标输入并恢复全局鼠标跟踪；
- 因 Safari、iOS WebKit 和 Firefox 折射受限而切换到另一套玻璃；
- 恢复旧 `.workspace::before` 下沿渐隐；
- 让通用 `.panel` 背景或外层内边距覆盖第三方玻璃；
- 破坏桌面悬浮状态栏、移动安全区、四项等距布局、`48px` 状态栏、`68px` 底栏或 `48px × 48px` 导航按钮；
- 绕过架构检查合并视觉回退。
