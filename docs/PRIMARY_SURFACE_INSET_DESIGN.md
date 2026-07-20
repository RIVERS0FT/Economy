# Economy 一级卡片内边距设计

> 状态：玩家端一级卡片外层几何的唯一规则
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-07-20

## 1. 目标

九个正式玩家页面中，处于页面主布局网格、拥有完整面板背景与边框、与其他主要模块同级的卡片统一视为一级卡片。一级卡片不得因页面类型、内容数量、卡片宽度或历史样式分别改变四边内边距。

## 2. 唯一权威

- `src/styles/primary-surfaces.css` 是玩家端一级卡片外层内边距的唯一 CSS 权威。
- `--primary-surface-inset` 是唯一一级卡片内边距令牌。
- 宽度大于 `720px` 时使用 `var(--space-4)`，即 `16px`。
- 宽度不大于 `720px` 时使用 `var(--space-3)`，即 `12px`。
- 一级卡片四边必须使用同一个令牌，不得分别设置上下或左右数值。
- `primary-surfaces.css` 必须在 `design-system.css` 之后、`form-controls.css` 之前加载，确保业务页面样式不能重新覆盖一级卡片外层几何，同时继续保持表单控件为最后视觉权威。

## 3. React 组件规则

- 新增一级卡片必须使用 `PagePanel`。
- `PagePanel` 固定输出 `panel widget ui-primary-surface` 三个语义类。
- 现有 `Panel className="widget ..."` 由 `Panel` 兼容桥自动补充 `ui-primary-surface`，用于避免一次性重写全部页面造成无关风险。
- 修改现有一级卡片时应优先迁移为 `PagePanel`；不得创建新的页面专属一级卡片基础组件。
- 普通 `Panel` 继续用于登录、管理员、弹窗、嵌套面板或其他不属于玩家页面一级平面的表面。

## 4. 页面 CSS 边界

业务页面 CSS 可以控制：

- 网格、列宽、卡片高度和内部排列；
- 标题、列表、表格、指标块和操作区的内部间距；
- 内嵌二级卡片、状态块和表单区域的 padding；
- 图表、媒体或表格的明确贴边子区域。

业务页面 CSS 不得：

- 对 `.ui-primary-surface` 或页面一级卡片类直接声明外层 `padding`；
- 创建 `--production-surface-inset`、`--asset-card-padding`、`--shop-card-padding` 等页面专属一级卡片内边距变量；
- 使用负 margin、transform 或标题专属 padding 修正一级卡片标题左上锚点；
- 在移动端为某个正式玩家页面恢复 `16px` 或引入第三种一级卡片内边距。

## 5. 贴边内容例外

表格、图表或媒体确实需要贴边时，一级卡片本身仍保持统一 padding。贴边效果必须由内部子元素通过明确的负 margin 或独立边缘容器实现，且标题和主要操作区继续与统一锚点对齐。例外不得覆盖 `.ui-primary-surface` 本身。

## 6. 当前清理结果

以下旧页面级外层规则已经移除：

- 生产页 `.panel.production-surface` 的独立桌面／移动 padding；
- 资产页 `.asset-overview-card` 与 `.asset-event-panel` 的移动 padding；
- 商店 `.gem-shop-grid > .widget` 的固定 padding；
- 排行 `.leaderboard-board-card` 的固定 padding。

生产页开关尺寸、资产页内部摘要块、商店内部兑换块和排行列表行等内部布局规则继续保留，不属于一级卡片外层内边距。

## 7. 自动验证

`scripts/verify-primary-surface-insets.mjs` 必须验证：

- 唯一令牌、桌面 `16px` 和移动 `12px` 规则存在；
- `PagePanel` 与旧 `Panel + widget` 兼容桥存在；
- 样式加载顺序正确；
- 已清理页面不再声明旧外层 padding；
- 本设计文档中的唯一权威和禁止回退规则仍存在。

该验证必须加入 `verify:architecture`，防止后续修改重新引入页面专属一级卡片内边距。
