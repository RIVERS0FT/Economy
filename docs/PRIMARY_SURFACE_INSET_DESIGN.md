# Economy 页面表面与卡片内边距设计


## 1. 目标

玩家页面必须先区分页面结构、同构列表、独立业务对象和高层独立表面，再决定是否使用圆角。页面章节、集合容器、摘要和以连续比较为主要任务的同构记录直接排列在正文，通过留白与细线建立层级；具有独立身份、状态、属性和操作的复杂业务对象可以使用轻量圆角对象卡，即使它随 `.page-card-scroll` 一起滚动。

是否滚动不再决定卡片资格。固定、sticky、Popover、Dialog、Tooltip、地图编辑器和根级工作区属于高层独立表面，可以按对应设计使用毛玻璃；正文对象卡只使用实体背景、边框和圆角，不使用毛玻璃或高层阴影。所有获准圆角表面必须完整落在当前页面承载面的真实内部宽度内。

## 2. 唯一权威

- `UI_DESIGN_SYSTEM.md` 决定页面分区、列表、对象卡和高层独立表面的视觉语义；本文只负责获准圆角表面的共享 inset 与承载几何，不得再以“是否滚动”判断卡片资格。
- `src/styles/primary-surfaces.css` 是共享圆角表面外层内边距的唯一 CSS 权威；`--primary-surface-inset` 是唯一外层 inset 令牌。
- 宽度大于 `720px` 时使用 `var(--space-4)`，即 `16px`；不大于 `720px` 时使用 `var(--space-3)`，即 `12px`；四边必须相同。
- 正文 `.ui-entity-card` 与合同兼容入口 `.contract-card` 复用 `--primary-surface-inset`；拍卖兼容入口 `.asset-auction-card` 同样复用该令牌，三者都不得创建对象专属 padding 变量。
- `--player-page-content-inset` 固定使用当前 `.game-shell` 的 `var(--layout-gutter)`，用于 `PageLayout` 可滚动正文四边安全留白；标题栏下方第一块正文不得恢复顶部 `0` 或负 margin 抵消。
- 同页一级业务卡片之间的网格或堆叠间隔同样固定使用 `var(--layout-gutter)`；该外部间隔与 `--primary-surface-inset` 的卡片四边内边距保持分离，业务 CSS 不得用额外的卡片 `margin-bottom` 或 `--space-*` 替代。
- `primary-surfaces.css` 必须在 `design-system.css` 之后、`form-controls.css` 之前加载；正文表面语义由 `content-surfaces.css` 与 `scrolling-page-sections.css` 收束。

## 3. React 与页面结构规则

- `PagePanel` 固定输出 `panel widget ui-primary-surface` 兼容语义，但它本身不等于可见圆角卡片。进入 `.page-card-scroll` 后，普通 `PagePanel` 默认作为页面章节扁平化。
- 新增复杂独立业务对象时使用 `.ui-entity-card`；不得为了对象卡创建页面专属基础卡片系统。合同页现有 `.contract-card` 是迁移兼容入口，公开合同和进行中合同必须保持对象卡边界；拍卖页现有 `.asset-auction-card` 同样是迁移兼容入口，单场进行中拍卖必须保持对象卡边界，而“发起拍卖”仍属于页面工作区分区。
- 页面章节、筛选区、发布表单大分组、资产总览、合同工作台、合同市场、“我的合同”、历史筛选、履约档案等集合或页面结构不得仅为了视觉分组增加圆角外壳。
- 页面摘要指标属于同一比较条，不是多个独立业务对象；玩家正文优先使用无逐项圆角背景的指标条。合同 `.contract-summary-grid` 是当前兼容映射。
- 商品目录、工厂目录、成交记录和历史记录等主要任务为连续比较的同构数据使用列表或表格，不为每条记录创建对象卡。运输路线是否使用对象卡由 `UI_DESIGN_SYSTEM.md` 的运输页视觉语义唯一决定，本文不得再把运输路线固定归类为同构列表。
- 如果去掉边界会让相邻内容的身份、状态、属性或操作归属产生歧义，并且主要任务是阅读或操作单个复杂对象，则允许使用 `.ui-entity-card`。
- 正文对象卡禁止 `backdrop-filter` 和高层浮动阴影；圆角不等于毛玻璃。
- 现有 `Panel className="widget ..."` 继续由兼容桥补充 `ui-primary-surface`；`.panel.production-surface` 与 `.panel.leaderboard-board-card` 的共享 inset 仍由 `primary-surfaces.css` 接管，业务 CSS 不得重新声明外层 padding。

## 4. 页面 CSS 边界

业务页面 CSS 可以控制网格、列宽、对象卡高度和内部排列，标题、列表、表格、指标条和操作区内部间距，以及对象卡的业务状态色、警告边界和局部强调。

业务页面 CSS 不得：

- 对 `.ui-primary-surface`、`.ui-entity-card` 或获准圆角对象卡声明另一套外层 `padding`；
- 创建 `--production-surface-inset`、`--asset-card-padding`、`--contract-card-padding`、`--shop-card-padding` 等页面专属外层 inset；
- 使用负 margin、transform 或标题专属 padding 修正圆角表面的标题锚点；
- 在移动端引入第三种圆角表面内边距；
- 给滚动正文对象卡增加 `backdrop-filter`、大范围高层阴影或第二层玻璃包装；
- 通过根级横向滚动、超宽 Grid/Flex 子项或父级裁剪突破当前页面承载面的真实内部宽度。

## 5. 贴边内容例外

表格、图表或媒体确实需要贴边时，圆角表面本身仍保持统一 padding；贴边效果只能由内部边缘容器实现。需要横向浏览的数据表或图表可以在自身批准的内部滚动容器中横向滚动，但 `.page-card-scroll`、`.page-card-static` 与 `.ui-page-stack` 本身不得产生页面级横向溢出。

## 6. 页面承载安全几何

- `.page-content--player` 及其 `.page-fixed-header`、`.page-card-scroll-area / .page-card-static`、`.page-card-scroll` 必须保持 `width: 100%`、`max-width: 100%`、`min-width: 0` 等价约束。
- 桌面端页面实际宽度等于 `workspaceCard` 扣除固定 `78px` 指挥轨道后的页面槽宽度；侧栏展开只能覆盖页面，不能推动、扩宽或裁剪正文。
- 移动端页面实际宽度等于唯一根级 Mobile Workspace Sheet 的内容盒宽度。
- 可滚动 `PageLayout` 的 `.page-card-scroll` 四边统一使用 `--player-page-content-inset`；不可滚动 `.page-card-static` 继续遵守宽度链和禁止横向溢出规则。
- 全局建筑页继续通过 `minmax(0, 1fr)`、`min-width: 0`、共享实体列表列令牌和按真实容器宽度触发的 `620px / 360px` 密度规则保证两级工厂列表不产生页面级横向溢出；已登记的两行目录结构、第一行下钻、第二行生产配置和插画跨行例外保持不变。
- 浏览器真实几何回归在同一页面实例跨越 `720px` 桌面／移动断点时，必须等待目标业务节点恢复可见且具有非零布局盒后再读取几何。

## 7. 退役页面与结构边界

已删除的旧银行统计面板、全局建筑统计卡和地区建筑独立卡片不再拥有 DESIGN 规则。当前页面不得恢复整页唯一包裹卡、平行地区列表或无业务语义 spacer；同时也不得把独立复杂业务对象重新无条件扁平化成无法区分归属的连续正文。

## 8. 自动验证

`scripts/verify-primary-surface-insets.mjs` 必须验证：

- 唯一 inset 令牌、桌面 `16px`、移动 `12px`、页面安全宽度链和样式加载顺序；
- 普通滚动正文结构继续扁平化，同时 `.ui-entity-card`、`.contract-card` 与 `.asset-auction-card` 不被滚动父级无条件扁平化；
- `content-surfaces.css` 中正文对象卡无毛玻璃，合同与进行中拍卖对象卡有独立边界，合同摘要指标条无逐项圆角卡片；
- `PagePanel`、旧 `Panel + widget` 兼容桥以及生产／排行兼容入口继续存在；
- 已清理页面不恢复旧外层 padding、整页唯一圆角包裹卡、全局建筑退役结构或页面级横向溢出；
- `tests/browser/contract-attention-background.spec.ts` 验证正常合同与待处理合同保持同一对象卡圆角、待处理警告强调可见、对象卡无 `backdrop-filter`，同时合同摘要指标保持透明且无圆角；拍卖浏览器回归必须证明 `.asset-auction-card` 继续保留对象边界且无正文毛玻璃；
- `tests/browser/player-page-geometry.spec.ts` 和市场响应式几何回归继续覆盖真实承载面与跨断点稳定性。

该验证必须加入 `verify:architecture`，防止后续修改重新以滚动状态决定卡片资格、恢复页面专属 inset 或破坏页面安全几何。
