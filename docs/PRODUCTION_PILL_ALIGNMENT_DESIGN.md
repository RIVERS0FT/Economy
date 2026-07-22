# Economy 生产页胶囊与开关对齐设计

> 状态：生产页一级卡片胶囊、开关与桌面固定卡片几何基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-22

本设计补充 `UI_DESIGN_SYSTEM.md`、`WAREHOUSE_EXPANSION_DESIGN.md`、`INDUSTRY_AND_PRODUCTION_DESIGN.md` 与 `LIQUID_GLASS_CHROME_DESIGN.md`。生产页工厂集群开关的点击区域规则以本文为准；这是对全局 44 × 44px 开关点击区域规则的明确场景例外。生产页桌面 sticky 顶部定位也以本文为准；当旧文档要求业务 sticky 卡片直接将 `--desktop-page-top-offset` 用作 `top` 时，本文针对已经通过页面滚动容器顶部 padding 完成工作栏避让的生产页作出明确场景例外。

## 1. 统一对象

生产页统一以下可见胶囊几何：

- `StatusTag` 状态胶囊；
- 共享仓库等级胶囊；
- 工厂集群 `SwitchControl` 的可见轨道与点击区域。

状态与等级继续使用 `StatusTag`，开关继续使用唯一的 `SwitchControl`。

## 2. 可见几何

生产页工厂开关与状态、等级胶囊共享：

```text
可见高度：1.6rem
点击高度：1.6rem
开关宽度：2.75rem
圆角：var(--radius-pill)
边框：1px
```

状态与等级胶囊宽度由文字决定，开关保持固定宽度。统一的是高度、圆角、边框厚度和卡片边缘基准。

## 3. 点击区域

工厂集群开关的点击区域必须与可见胶囊完全一致，即 `2.75rem × 1.6rem`。不得保留超出可见胶囊的透明点击区域，也不得让透明点击盒继续参与标题行高度计算。

标题行最小高度必须使用同一个 `1.6rem` 胶囊高度。这样标题与下一行状态胶囊之间只保留正式网格间距，不会因为历史 44px 点击盒产生额外空白。

该紧凑规则只适用于生产页工厂集群卡右上角开关。其他页面和表单开关继续遵循全局触控目标规则。

## 4. 滑块与焦点

滑块保持 `1rem`，并使用以下关系垂直居中：

```css
top: calc((可见轨道高度 - 滑块尺寸) / 2);
```

开启状态左右留白必须一致。焦点环继续绘制在 `.ui-switch::before` 可见轨道外侧，键盘焦点和 `aria-label` 不得删除。

## 5. 样式职责

- `design-system.css` 定义 `StatusTag`、全局开关基础外观和焦点环；
- `production-surface.css` 负责生产页工厂开关点击区域、可见轨道、标题行高度以及桌面建设卡与详情外壳的 sticky 对齐；
- `facility-group-card-grid.css` 负责生产主网格、响应式轨道、工厂标题、状态、数量摘要和详情自然高度，不得重新设置工厂开关高度或透明命中区；
- `production-surface.css` 必须在 `facility-group-card-grid.css` 之后加载，使场景专用的 sticky 顶部基线成为最终结果。

## 6. 胶囊与开关防回退

不得：

- 恢复 `44 × 44px` 的生产页工厂开关透明点击区域；
- 让生产页工厂开关点击高度与可见高度不同；
- 让标题行继续使用 `var(--control-height)` 作为实际最小高度；
- 让开关轨道高度不同于 `StatusTag` 的 `1.6rem`；
- 用额外外边距单独修补某一种工厂卡；
- 让开关点击区域下压状态胶囊；
- 删除轨道焦点环或开关无障碍名称；
- 未同步更新本文档和验证脚本就改变生产页胶囊几何。

## 7. 桌面 sticky 顶部基线

大于等于 `961px` 时，建设卡与当前工厂详情外壳统一使用：

```css
position: sticky;
top: 0;
align-self: start;
```

`.page-scroll` 已经通过 `padding-top: var(--desktop-page-top-offset)` 完成桌面工作栏避让，因此生产页 sticky 后代使用 `top: 0`。不得再次把完整 `--desktop-page-top-offset` 叠加到 sticky `top`，否则建设卡会比工厂选择区和详情卡多下移一次状态栏高度。

`top: 0` 是相对于已经完成顶部避让的页面滚动视口，不代表卡片覆盖桌面工作栏。不得使用 `position: fixed`、负外边距、额外页面 padding 或 JavaScript 滚动监听模拟相同效果。

## 8. 建设卡与详情卡固定行为

- `.production-workspace > .production-build-card` 与 `.production-workspace > .facility-cluster-detail-shell` 共享同一 sticky 顶部基线。
- 建设卡最大高度继续使用 `calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter))`；内容过高时允许建设卡自身 `overflow-y: auto`。
- sticky 施加在详情外壳，不直接改变详情卡内部结构。
- 详情外壳与 `.facility-cluster-detail-card` 必须保持 `max-height: none` 和 `overflow: visible`。
- 详情卡继续由真实内容决定高度，不得新增固定高度、弹性占位行、spacer DOM 或独立 `overflow-y: auto`。
- 页面唯一纵向滚动视口负责访问完整详情；市场入口继续紧跟实际详情内容。
- 在 `961px–1380px` 两列布局中，详情卡只有在其正常位置到达滚动视口顶部后才固定，不得提前覆盖上方工厂选择区。

## 9. 响应式边界

- `721px–960px` 恢复普通文档流，建设卡、工厂选择和当前详情均不固定。
- 不大于 `720px` 时继续隐藏页面内详情外壳并使用现有 Bottom Sheet；不得改变拖动关闭、焦点管理、背景滚动锁或固定头尾结构。

## 10. sticky 防回退

`scripts/verify-production-desktop-layout.mjs` 必须验证：

- `production-surface.css` 在 `facility-group-card-grid.css` 之后加载；
- 建设卡和详情外壳共享 `position: sticky`、`top: 0` 与 `align-self: start`；
- 建设卡继续使用统一顶部偏移计算最大高度；
- 详情外壳与详情卡保持自然高度和可见溢出；
- 本文的场景优先级、页面唯一纵向滚动视口和响应式规则仍存在。
