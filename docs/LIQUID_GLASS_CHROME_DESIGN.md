# Economy liquid-glass-react 应用外壳设计

> 状态：桌面与移动端顶部状态栏、移动底部导航的视觉与布局基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-19

本文件定义应用外壳唯一液态玻璃实现、稳定几何、跨浏览器能力边界、性能约束和防回退规则。通用 UI 仍以 `docs/UI_DESIGN_SYSTEM.md` 为准；涉及状态栏和移动底栏材质时，以本文件为专题权威基线。

## 1. 唯一材质来源

- `liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现。
- `src/components/ui/LiquidGlassSurface.tsx` 是唯一允许直接导入该依赖的文件。
- 状态栏和移动底栏只能使用 `LiquidGlassSurface` 预设，不得在业务组件中直接设置第三方参数。
- `src/styles/liquid-glass-surfaces.css` 只负责尺寸、层级、内容布局、圆角裁切和最低可读性底色；不得用 CSS 重新实现模糊、折射、色差、高光或玻璃阴影。
- `src/styles/liquid-glass-chrome.css` 只允许作为历史路径转发入口，内容只能导入 `liquid-glass-surfaces.css`。

## 2. 文件职责

| 文件 | 职责 |
|---|---|
| `src/components/ui/LiquidGlassSurface.tsx` | 第三方库适配、参数预设、静态鼠标输入和统一 DOM |
| `src/components/shell/StatusBar.tsx` | 状态项语义、交互和内容入口 |
| `src/components/shell/MobileBottomNavigation.tsx` | 移动导航语义与内容入口 |
| `src/styles/liquid-glass-surfaces.css` | 玻璃宿主几何、第三方 DOM 尺寸适配、裁切、内容网格与最低对比度 |
| `src/styles/viewport.css` | 桌面悬浮定位、滚动层和移动安全区 |
| `src/styles/mobile-status-navigation.css` | 移动导航按钮尺寸、滚动和交互 |
| `src/styles/mobile-status-layout.css` | 移动顶部状态栏全宽等距布局 |
| `scripts/verify-liquid-glass-chrome.mjs` | 依赖、适配层、布局与防回退检查 |
| `tests/browser/liquid-glass-layout.spec.ts` | 真实浏览器中的全宽、裁切、单材质与页面避让验证 |

样式加载顺序固定为：`card-system.css` → `liquid-glass-surfaces.css` → 移动外壳样式 → `icon-system.css` → 业务样式 → `design-system.css`。

## 3. 统一参数预设

应用外壳固定使用 `mode="standard"`，不使用稳定性较低的 `shader` 模式。

### 3.1 顶部状态栏

- `displacementScale: 18`
- `blurAmount: 0.25`，对应库内部约 `12px` 模糊
- `saturation: 135`
- `aberrationIntensity: 0.45`
- `elasticity={0}`
- 桌面圆角 `18px`，移动端通过宿主几何覆盖为胶囊圆角

### 3.2 移动底部导航

- `displacementScale: 20`
- `blurAmount: 0.5`
- `saturation: 145`
- `aberrationIntensity: 0.5`
- `elasticity={0}`
- 圆角 `20px`

外壳必须传入固定 `globalMousePos` 和 `mouseOffset`，禁止第三方组件为状态栏和底栏注册鼠标移动监听。状态项和导航按钮的交互由内部原生按钮承担，不给玻璃外壳传 `onClick`。

## 4. 全平台能力边界

所有平台都渲染同一个 `LiquidGlassSurface`，不得按浏览器切换回另一套 CSS 玻璃：

- Chromium、Android Chromium WebView、Windows WebView2 显示完整标准折射、模糊和边缘色差。
- Safari、iOS WebKit 和 Firefox 使用同一组件；受浏览器 SVG displacement 支持限制，折射可能不可见，但模糊、高光和内容结构继续保留。
- 不支持 `backdrop-filter` 的环境只使用高不透明度对比底色保证可读性，不模拟第二套玻璃。
- 平台能力差异不允许改变状态栏高度、安全区、导航尺寸或内容顺序。

## 5. DOM 与布局

状态栏结构固定为：

```text
.asset-bar
└─ LiquidGlassSurface(statusBar)
   └─ .asset-bar-content
      └─ .asset-bar-item × 5
```

移动底栏结构固定为：

```text
.mobile-bottom-navigation
└─ LiquidGlassSurface(mobileNavigation)
   └─ .sidebar-nav
      └─ 导航按钮
```

`.asset-bar` 和 `.mobile-bottom-navigation` 不得包含 `.panel`。通用 `.panel` 会在最终设计系统中加入背景、阴影和 `backdrop-filter`，与第三方玻璃形成双重材质。

`.asset-bar` 只负责定位、尺寸和横向滚动，最终计算样式必须是单一块级宿主，不得以五列 Grid 排列 `LiquidGlassSurface`。五列布局只能存在于 `.asset-bar-content`。历史基础样式中的外层 Grid 必须由液态玻璃专题样式明确覆盖，不得重新成为生效布局。

桌面玻璃宿主宽度必须覆盖整个工作区；可用宽度低于内容最小值时，宿主扩展至 `675px`，961px 以下桌面扩展至 `725px`，由 `.asset-bar` 横向滚动。移动端清除最小宽度并使用全宽安全区胶囊。

`LiquidGlassSurface` 必须裁切第三方组件生成的并列高光、边框和覆盖层，所有装饰层圆角必须与宿主一致，不得在右侧或底部产生滤镜光晕溢出。

## 6. 状态项和移动导航

- 整个状态栏只有一个玻璃实例，不得为每个状态项单独创建实例。
- 整个移动底栏只有一个玻璃实例，不得为每个导航按钮单独创建实例。
- 桌面状态项保留弱分隔线；移动状态项不显示分隔线、独立边框或图标底板。
- 标签使用次级文字色，主数值使用主文字色，说明使用弱化文字色；不得用选择所有 `span` 的规则把主数值降为弱化颜色。
- 桌面保留完整信息密度，移动端使用紧凑图标与数值槽位，数字格式遵循全局“紧凑数字”偏好。
- 排名在桌面与移动端统一通过 `formatRank` 显示为 `#N`。
- 移动顶部状态栏固定 `48px`，移动底栏固定 `68px`。
- 移动导航按钮固定 `48px × 48px`，活动、悬停和触摸状态不得位移或缩放。
- 图标继续统一来自 `GameIcons.tsx`。

## 7. 性能与可访问性

- 桌面同时可见一个玻璃实例；移动同时可见两个玻璃实例。
- 禁止 `shader` 模式、滚动事件更新参数、噪点动画和每项独立滤镜。
- `elasticity={0}` 保证外壳几何稳定；内部按钮保留键盘焦点和点击反馈。
- 页面内容从状态栏下方开始，并在滚动后进入玻璃后方；初始页面标题不得位于状态栏视觉边界内。
- 玻璃生成的装饰 SVG 和覆盖层不得阻止内部按钮事件。

## 8. 验收标准

必须检查桌面 `1920px`、`1440px`、`1024px`、`768px`，以及移动 `430px`、`390px`、`375px`、`360px`、`320px`：

1. 状态栏和移动底栏均由 `LiquidGlassSurface` 渲染。
2. 桌面状态栏宽度与工作区一致，玻璃宿主宽度与状态栏一致；窄桌面只允许预期横向滚动。
3. `.asset-bar` 计算样式不是 Grid，五列 Grid 只存在于 `.asset-bar-content`。
4. `.asset-bar` 和 `.mobile-bottom-navigation` 不包含 `.panel`，计算样式不包含外层 `backdrop-filter`。
5. 第三方高光和滤镜层被宿主圆角裁切，没有右侧或底部光晕溢出。
6. 页面初始标题位于状态栏底部以下，滚动时内容可进入状态栏后方。
7. Chromium 显示折射，Safari／Firefox 缺少折射时仍清晰可读。
8. 移动顶部四项完整显示且不可横向滚动。
9. 移动底栏可横向滚动，按钮固定 `48px × 48px`。
10. `npm run build` 与浏览器测试通过。

## 9. 不可回退规则

除非先更新本设计和架构检查，否则不得：

- 在 `liquid-glass-chrome.css` 中恢复任何材质规则，或恢复 CSS `backdrop-filter` 玻璃材质；
- 在 `LiquidGlassSurface.tsx` 之外直接导入 `liquid-glass-react`；
- 给 `.asset-bar` 或 `.mobile-bottom-navigation` 添加 `.panel`；
- 让 `.asset-bar` 的最终计算样式恢复五列 Grid 或外层内边距；
- 取消玻璃宿主圆角裁切，或允许第三方并列装饰层溢出；
- 改用 `shader` 模式或把应用外壳 `elasticity` 调为非零；
- 为状态项或导航按钮分别创建玻璃实例；
- 删除固定鼠标输入并恢复全局鼠标跟踪；
- 因 Safari、iOS WebKit 和 Firefox 折射受限而切换到另一套玻璃；
- 恢复旧 `.workspace::before` 下沿渐隐；
- 破坏桌面全宽状态栏、移动安全区、四项等距布局、`48px` 状态栏、`68px` 底栏或 `48px × 48px` 导航按钮；
- 绕过架构检查或浏览器几何测试合并视觉回退。
