# Economy 页面表面与卡片内边距设计

> 状态：玩家端一级表面与正文对象卡外层几何的唯一规则
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-09-02

## 1. 目标

玩家页面必须先区分“页面结构”与“独立业务对象”，再决定是否使用圆角卡片。页面章节、集合容器、摘要和同构列表属于页面结构，默认直接排列在正文并通过留白与细线建立层级；拥有独立身份、状态、属性和操作的复杂业务对象可以作为对象卡保留圆角边界，即使它随页面正文一起滚动。

因此，是否随 `.page-card-scroll` 滚动不再决定是否允许圆角。真正决定视觉的是语义：页面分区不做卡片；同构且以横向比较为主要任务的数据使用列表／表格；以阅读或操作单个复杂对象为主要任务的内容使用对象卡；脱离正文的固定、sticky、Popover、Dialog、Tooltip 与根级工作区才属于高层独立表面并可以使用毛玻璃材质。

所有获准圆角表面必须完整落在当前页面承载面的真实内部宽度内：桌面端承载面是集成 `workspaceCard` 扣除固定指挥轨道后的页面槽，移动端承载面是唯一根级 Mobile Workspace Sheet 的内容盒。不得依赖外壳 `overflow: hidden` 裁掉超宽页面来获得“看似对齐”的结果。

## 2. 唯一权威

本文只负责获 `UI_DESIGN_SYSTEM.md` 允许显示为圆角的玩家一级表面与正文对象卡的 inset 几何。页面结构是否扁平、哪些业务对象属于对象卡、正文对象卡是否使用毛玻璃，由 UI 设计系统与 `src/styles/scrolling-page-sections.css` 决定；本文不得把“是否滚动”重新当作卡片资格条件。

- `src/styles/primary-surfaces.css` 是玩家端获准圆角表面外层内边距的唯一 CSS 权威。
- `--primary-surface-inset` 是共享圆角表面的唯一外层内边距令牌；正文 `.ui-entity-card` 与兼容映射的 `.contract-card` 复用该令牌，不维护对象专属 padding。
- 宽度大于 `720px` 时使用 `var(--space-4)`，即 `16px`。
- 宽度不大于 `720px` 时使用 `var(--space-3)`，即 `12px`。
- 圆角表面四边必须使用同一个令牌，不得分别设置上下或左右数值。
- `--player-page-content-inset` 固定使用当前 `.game-shell` 的 `var(--layout-gutter)`，用于 `PageLayout` 可滚动正文四边安全留白；令牌必须在 `.game-shell` 上解析，不能提前在 `:root` 解析成固定像素，否则会覆盖桌面宽屏／紧凑断点已经存在的战略网格间距。标题栏下方第一块正文必须因此保留同一内容间距，不得恢复顶部 `0` 的特殊规则。
- `primary-surfaces.css` 必须在 `design-system.css` 之后、`form-controls.css` 之前加载，确保业务页面样式不能重新覆盖共享圆角表面的外层几何，同时继续保持表单控件为最后视觉权威。
- `scrolling-page-sections.css` 在玩家滚动正文中负责最终表面语义：默认 `PagePanel` 作为页面结构扁平化；显式 `.ui-entity-card` 保留轻量圆角边界；`.contract-card` 作为当前合同页兼容映射必须与 `.ui-entity-card` 同语义；正文对象卡禁止 `backdrop-filter` 和高层浮动阴影。

## 3. React 与页面结构规则

- `PagePanel` 继续固定输出 `panel widget ui-primary-surface` 三个兼容语义类，但它本身不再等同于“可见圆角卡片”。进入 `.page-card-scroll` 后，普通 `PagePanel` 默认被视为页面章节并由最终样式扁平化。
- 新增独立业务对象时，可以在既有 `PagePanel` 上显式增加 `.ui-entity-card`，或者使用业务组件输出同一共享类；不得为了对象卡创建页面专属基础卡片系统。
- 合同页现有 `.contract-card` 是迁移兼容入口：公开合同和进行中合同具有发布者／参与角色、状态、条款、履约数据与独立操作，必须保持对象卡边界；后续迁移可以显式改用 `.ui-entity-card`，但不得在迁移前重新被滚动正文通用规则扁平化。
- 页面章节、筛选区、发布表单大分组、资产总览、合同广场、“我的合同”、履约档案等集合或页面结构不得仅为了视觉分组新增圆角外壳；它们使用语义化 `section`、普通 `PagePanel` 兼容节点、列表或表格表面，并在滚动正文中保持扁平。
- 页面摘要指标属于同一信息条而不是多个独立业务对象。普通玩家正文优先使用无独立圆角背景的指标条；现有合同 `.contract-summary-grid` 是该语义的兼容映射，内部 `MetricCard` 只保留指标排版，不保留逐项卡片边界。
- 如果主要任务是连续比较多个同构对象，应使用统一列表／表格，不为每条记录创建对象卡；运输路线、商品目录、工厂目录、成交记录与历史记录遵守该规则。
- 如果去掉边界会让相邻内容的身份、状态、属性或操作归属产生歧义，并且主要任务是阅读或操作单个复杂对象，则可以使用 `.ui-entity-card`。
- 固定、sticky、浮动、Popover、Dialog、Tooltip、地图编辑器与根级工作区属于真正高层独立表面，可以按各自权威设计保留毛玻璃；正文 `.ui-entity-card` 只允许轻量实体背景、边框和圆角。圆角不等于毛玻璃。
- 现有 `Panel className="widget ..."` 由 `Panel` 兼容桥自动补充 `ui-primary-surface`，用于避免一次性重写全部页面造成无关风险。
- 现有 `.panel.production-surface` 与 `.panel.leaderboard-board-card` 由 `primary-surfaces.css` 作为旧类兼容入口统一接管外层 inset，直到对应组件迁移；这两个类不得在业务 CSS 中重新声明外层 padding。
- 普通 `Panel` 继续用于登录、管理员、弹窗、嵌套面板或其他不属于玩家页面正文语义的表面。

## 4. 页面 CSS 边界

业务页面 CSS 可以控制：

- 网格、列宽、对象卡高度和内部排列；
- 标题、列表、表格、指标条和操作区的内部间距；
- 内嵌控制块、状态块和表单区域的 padding；
- 对象卡的业务状态色、警告边界和局部强调，但不得恢复毛玻璃；
- 图表、媒体或表格的明确贴边子区域。

业务页面 CSS 不得：

- 对 `.ui-primary-surface`、`.ui-entity-card` 或获准圆角对象卡直接声明另一套外层 `padding`；
- 创建 `--production-surface-inset`、`--asset-card-padding`、`--contract-card-padding`、`--shop-card-padding` 等页面专属外层内边距变量；
- 使用负 margin、transform 或标题专属 padding 修正圆角表面的标题左上锚点；
- 在移动端为某个正式玩家页面恢复 `16px` 或引入第三种圆角表面内边距；
- 给滚动正文对象卡增加 `backdrop-filter`、大范围高层阴影或第二层玻璃包装；
- 通过根级横向滚动、超宽 Grid/Flex 子项或父级裁剪突破当前页面承载面的真实内部宽度。

## 5. 贴边内容例外

表格、图表或媒体确实需要贴边时，获准圆角表面本身仍保持统一 padding。贴边效果必须由内部子元素通过明确的负 margin 或独立边缘容器实现，且标题和主要操作区继续与统一锚点对齐。例外不得覆盖 `.ui-primary-surface` 或 `.ui-entity-card` 本身。

需要横向浏览的数据表或图表可以在自身批准的内部滚动容器中横向滚动，但 `.page-card-scroll`、`.page-card-static` 与 `.ui-page-stack` 本身不得产生页面级横向溢出。

## 6. 页面承载安全几何

- `.page-content--player` 必须占满承载页面槽并保持既有桌面 `max-width: none` 语义；其下 `.page-fixed-header`、`.page-card-scroll-area / .page-card-static`、`.page-card-scroll` 与页面内容栈必须保持 `width: 100%`、`max-width: 100%`、`min-width: 0` 等价约束，一级直接子项同样不得超过 `100%`。
- 桌面端页面实际宽度必须等于 `workspaceCard` 中扣除固定 `78px` 指挥轨道后的页面槽宽度。侧栏由 `78px` 覆盖展开到 `224px` 时只允许覆盖页面，不得推动、扩宽或裁剪页面正文。
- 移动端页面实际宽度必须等于唯一根级 Mobile Workspace Sheet 的内容盒宽度；Sheet 边框之外不得存在页面正文，Sheet 内部也不得保留桌面宽度或隐形超宽盒。
- 可滚动 `PageLayout` 的 `.page-card-scroll` 四边统一使用 `--player-page-content-inset`。标题栏底边到第一块正文顶边必须至少保留该间距；不得再使用 `padding-top: 0` 或通过第一块卡片负 margin 抵消。
- 不可滚动 `.page-card-static` 仍必须遵守宽度链和禁止横向溢出规则，但不强制追加正文 inset，避免破坏研发树等固定工作区的既有内部布局。
- `GlobalBuildingsPage` 等全局经营页必须以 `minmax(0, 1fr)`、`min-width: 0` 和可收缩列表行保证内容随真实承载面收缩。一级建筑页只保留全局工厂目录，不再存在独立地区建筑卡片；全局工厂目录第一行继续保持“工厂｜平均利润／分钟｜拥有”的共享表头结构，一级目录条目登记为两行高度例外，第二行仅在工厂身份列内承载“当前生产产物／当前作业制度”两个方形图标，正方形工厂插画跨越两行。条目四边统一使用同一个 `--entity-list-inline-padding`，地区下钻按钮只覆盖第一行；第二行图标的候选菜单使用工作区顶层浮层，不得通过改变条目高度显示。点击工厂后出现的地区工厂列表继续保持“地区｜利润／分钟｜拥有｜状态”的第一行共享列，但条目同步改为两行结构：第一行负责地区详情下钻，第二行承载纯文字生产产物与作业制度下拉，不加入任何工厂插画或生产配置图标。两级列表都不得依赖卡片网格、抽屉裁剪或页面级横向滚动。
- 全局建筑列表的响应不能只依赖浏览器 viewport。`.global-operation-page` 必须建立 inline-size 容器；真实页面承载宽度不大于 `620px` 时，两级工厂列表继续压缩业务列模板，通用列间距、横向内边距与 Chevron 轨道必须复用 `entity-list-header.css` 的页面列表共享令牌。一级全局工厂目录按已登记例外把条目高度／跨行工厂插画／第二行方形图标收紧到约 `88px / 68px / 26px`，极窄 `360px` 及以下进一步收紧到约 `84px / 66px / 24px`；地区工厂列表同步使用约 `88px / 84px` 的两行高度，但第二行只显示纯文字下拉并保持无图标。原因是 `721px` 及以上已经进入桌面外壳，但固定侧栏和主卡轨道仍可能把实际页面槽压缩到远小于移动断点的宽度；响应必须以实际页面槽为准，同时不得为了避免溢出把第一行数值列或地区列表改成多行，也不得重新形成未登记的页面专属列表样式。
- 浏览器真实几何回归若在同一页面实例内跨越 `720px` 桌面／移动断点，必须先等待断点后的目标业务节点恢复为可见且具有非零布局盒，再读取 `boundingBox()` 或其他几何；视口切换会触发玩家外壳与 Mobile Workspace Sheet 的响应式重排，测试不得把切换调用返回的瞬间误判为布局已经稳定。

## 7. 当前清理结果

以下旧页面级外层规则已经移除或重新归类：

- 州级概览与未解锁建筑／仓库不再使用包裹整个分区的唯一一级卡片，分区内容直接进入正文；
- 可滚动正文不再通过 `.page-card-scroll .panel` 无差别清除所有对象边界；普通章节继续扁平化，`.ui-entity-card` 与合同 `.contract-card` 保留轻量对象卡边界；
- 合同广场与“我的合同”保持平面页面分区，公开合同和进行中合同恢复为逐份独立对象卡，合同顶部四项摘要改为同一无圆角摘要条；
- 建筑页 `.panel.production-surface` 的独立桌面／移动 padding；
- 银行页 `.asset-overview-card` 的页面专属移动 padding，以及已删除 `.asset-event-panel` 的旧规则；
- 商店 `.gem-shop-grid > .widget` 的固定 padding；
- 排行 `.leaderboard-board-card` 的固定 padding；
- 全局建筑页已退役四项统计卡对应的 `.global-operation-metrics` 布局规则；
- 一级建筑页已退役独立“地区建筑”卡片及其 `.global-province-list` / `.global-province-row` 布局规则。

建筑页开关尺寸、银行资产总览内部摘要块、商店内部兑换块、排行列表行和对象卡内部控制块等内部布局规则继续保留，不属于共享圆角表面的外层内边距。

## 8. 自动验证

`scripts/verify-primary-surface-insets.mjs` 必须验证：

- 唯一令牌、桌面 `16px` 和移动 `12px` 规则存在；
- `PagePanel`、旧 `Panel + widget` 兼容桥以及生产／排行旧类兼容入口存在；
- `scrolling-page-sections.css` 不得恢复 `.page-card-scroll .panel` 的无条件全量扁平化；默认页面章节必须继续扁平，`.ui-entity-card` 和合同 `.contract-card` 必须保留圆角、边框与共享 inset，同时禁止毛玻璃；
- 合同 `.contract-summary-grid` 内部指标必须保持无独立背景、无圆角的摘要条语义；
- 正常正文只有一个页面结构模块时必须直接进入正文，不得恢复整页唯一圆角包裹卡；
- 玩家页面宽度链、`.game-shell` 局部解析的正文四边 inset、禁止根级横向溢出和一级直接子项宽度约束存在；
- 页面内容栈本身的命名样式仍唯一保留在 `design-system.css`，不得在 `primary-surfaces.css` 重复声明；
- 全局建筑页只保留全局工厂目录入口；一级全局工厂目录在 `620px`、`360px` 实际承载断点保持已登记的两行高度与插画跨行例外，第一行共享列、gap 和 Chevron 仍由 `entity-list-header.css` 控制，横向内边距必须复用其 `--entity-list-inline-padding`，纵向内边距允许为两行密度独立收紧；工厂类型下的地区工厂列表同步保持两行密度、第一行下钻与第二行同源 `production-config` 图标方案槽。一级页面不得恢复 `.global-province-list` / `.global-province-row`，两级列表都不得产生页面级横向溢出，也不得恢复已退役的 `.global-operation-metrics`；
- 样式加载顺序正确；
- 已清理页面不再声明旧外层 padding；
- 本设计文档中的语义分类、唯一权威和禁止回退规则仍存在；
- `tests/browser/player-page-geometry.spec.ts` 在桌面和移动断点覆盖正式页面，验证页面不超出承载面、可滚动正文首项有统一顶部间距且根级无横向溢出，并分别对一级全局工厂目录和点击工厂后的地区工厂列表执行边界与跨断点真实几何回归；一级全局工厂目录和地区工厂列表条目必须保持约 `93～96px` 的登记两行高度；桌面第一行收紧到 `32px`，移动端第一行保持 `44px`，不得再恢复地区工厂单行高度规则；
- `tests/browser/contract-attention-background.spec.ts` 必须验证普通合同和待处理合同保留相同非零圆角、正文对象卡 `backdrop-filter` 为 `none`，待处理合同保留警告强调，同时合同摘要指标保持透明无圆角；
- `tests/browser/market-runtime.spec.ts` 的跨桌面／移动响应式几何用例必须在断点切换后等待下单区与订单簿重新可见，再读取真实布局盒，防止把外壳重排中的瞬态无布局状态误报为页面几何回归。

该验证必须加入 `verify:architecture`，防止后续修改重新引入页面专属外层内边距、把页面章节做成卡片、把独立对象错误扁平化、页面宽度漂移或外壳裁剪。
