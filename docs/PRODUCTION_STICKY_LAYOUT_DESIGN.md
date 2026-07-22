# Economy 生产页桌面 Sticky 对齐补充设计

> 状态：当前生产页桌面固定卡片几何基线
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-07-22

## 1. 规则优先级

本文是 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 与 `LIQUID_GLASS_CHROME_DESIGN.md` 的窄范围补充，只覆盖生产页桌面建设卡和当前工厂详情卡的 sticky 顶部定位。

当旧文档要求生产页 sticky 卡片直接使用 `--desktop-page-top-offset` 作为 `top` 时，以本文为准：生产页位于已经通过 `padding-top: var(--desktop-page-top-offset)` 完成工作栏避让的 `.page-scroll` 内，因此其 sticky 后代必须使用 `top: 0`，不得再次累计完整顶部偏移。其他产业、生产、外壳和移动端规则保持不变。

## 2. CSS 权威边界

- `src/styles/facility-group-card-grid.css` 继续负责生产主网格、响应式轨道、工厂集群选择器和详情内容自然高度。
- `src/styles/production-surface.css` 作为建设卡与详情外壳 sticky 对齐的最终权威，并保持在 `facility-group-card-grid.css` 之后加载。
- 不得通过 `position: fixed`、负外边距、额外页面 padding 或 JavaScript 滚动监听模拟固定效果。

## 3. 大于等于 961px 的桌面规则

- `.production-workspace > .production-build-card` 与 `.production-workspace > .facility-cluster-detail-shell` 都使用 `position: sticky`、`top: 0` 和 `align-self: start`。
- 两者在各自正常文档位置到达页面滚动视口顶部后固定；sticky 不得提前把 961px–1380px 布局中的详情卡拉到工厂选择区之上。
- 建设卡、工厂选择区和详情卡在同一网格行时顶部必须对齐；页面滚动后建设卡与详情卡固定基线必须一致。
- `top: 0` 是相对于已经完成工作栏避让的页面滚动视口，不代表卡片覆盖桌面工作栏。

## 4. 建设卡高度与滚动

- 建设卡最大高度固定为 `calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter))`，确保状态栏和底部沟槽都被扣除。
- 建设卡内容超过可用高度时允许自身 `overflow-y: auto`，并保留纵向滚动链。
- 建设卡不得再次将 `--desktop-page-top-offset` 用作 sticky `top`，否则会出现重复顶部避让。

## 5. 当前工厂详情高度与滚动

- sticky 施加在 `.facility-cluster-detail-shell`，不直接改变详情卡内部布局。
- 详情外壳和 `.facility-cluster-detail-card` 必须保持 `max-height: none` 与 `overflow: visible`。
- 详情卡继续由真实内容决定高度，不得新增固定高度、弹性占位行、spacer DOM 或独立 `overflow-y: auto`。
- 页面唯一纵向滚动视口负责访问完整详情；市场入口继续紧跟实际详情内容。

## 6. 响应式与移动端

- `721px–960px` 恢复普通文档流，建设卡、工厂选择和当前详情均不固定。
- 不大于 `720px` 时继续隐藏页面内详情外壳，并使用现有 Bottom Sheet；本文不得改变移动悬浮框、拖动关闭、焦点管理或背景滚动锁。

## 7. 防回退验证

`scripts/verify-production-desktop-layout.mjs` 必须验证：

- `production-surface.css` 在 `facility-group-card-grid.css` 之后加载；
- 建设卡和详情外壳共享 `position: sticky`、`top: 0` 与 `align-self: start`；
- 建设卡继续使用统一顶部偏移计算最大高度；
- 详情外壳与详情卡保持自然高度和可见溢出；
- 本文的优先级、唯一滚动视口和响应式规则仍存在。
