# Economy 一级卡片内边距设计

> 状态：玩家端一级卡片外层几何的唯一规则
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-08-31

## 1. 目标

九个正式玩家页面中，处于页面主布局网格、拥有完整面板背景与边框、与其他主要模块同级的卡片统一视为一级卡片。一级卡片不得因页面类型、内容数量、卡片宽度或历史样式分别改变四边内边距。

同时，一级卡片必须完整落在当前页面承载面的真实内部宽度内：桌面端承载面是集成 `workspaceCard` 扣除固定指挥轨道后的页面槽，移动端承载面是唯一根级 Mobile Workspace Sheet 的内容盒。不得依赖外壳 `overflow: hidden` 裁掉超宽页面来获得“看似对齐”的结果。

## 2. 唯一权威

- `src/styles/primary-surfaces.css` 是玩家端一级卡片外层内边距的唯一 CSS 权威。
- `--primary-surface-inset` 是唯一一级卡片内边距令牌。
- 宽度大于 `720px` 时使用 `var(--space-4)`，即 `16px`。
- 宽度不大于 `720px` 时使用 `var(--space-3)`，即 `12px`。
- 一级卡片四边必须使用同一个令牌，不得分别设置上下或左右数值。
- `--player-page-content-inset` 固定使用当前 `.game-shell` 的 `var(--layout-gutter)`，用于 `PageLayout` 可滚动正文四边安全留白；令牌必须在 `.game-shell` 上解析，不能提前在 `:root` 解析成固定像素，否则会覆盖桌面宽屏／紧凑断点已经存在的战略网格间距。标题栏下方第一块正文必须因此保留同一内容间距，不得恢复顶部 `0` 的特殊规则。
- `primary-surfaces.css` 必须在 `design-system.css` 之后、`form-controls.css` 之前加载，确保业务页面样式不能重新覆盖一级卡片外层几何，同时继续保持表单控件为最后视觉权威。

## 3. React 组件规则

- 新增一级卡片必须使用 `PagePanel`。
- 只有页面正文确实存在需要独立视觉分组的一级业务模块时才创建一级卡片；正常状态下若整个正文只有一个一级业务模块，不得仅为包裹整页再增加 `PagePanel`、`Panel className="widget ..."` 或其他圆角卡片。该单一模块的标题、指标、列表和操作直接排列在 `PageLayout` 正文中。原因是桌面 `workspaceCard` 与移动根级 Mobile Workspace Sheet 已经承担页面一级承载面，再包一层唯一大卡只会形成没有信息层级增益的双层边框、圆角和内边距。
- `PagePanel` 固定输出 `panel widget ui-primary-surface` 三个语义类。
- 现有 `Panel className="widget ..."` 由 `Panel` 兼容桥自动补充 `ui-primary-surface`，用于避免一次性重写全部页面造成无关风险。
- 现有 `.panel.production-surface` 与 `.panel.leaderboard-board-card` 由 `primary-surfaces.css` 作为旧类兼容入口统一接管，直到对应组件迁移为 `PagePanel`；这两个类不得在业务 CSS 中重新声明外层 padding。
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
- 在移动端为某个正式玩家页面恢复 `16px` 或引入第三种一级卡片内边距；
- 通过根级横向滚动、超宽 Grid/Flex 子项或父级裁剪突破当前页面承载面的真实内部宽度。

## 5. 贴边内容例外

表格、图表或媒体确实需要贴边时，一级卡片本身仍保持统一 padding。贴边效果必须由内部子元素通过明确的负 margin 或独立边缘容器实现，且标题和主要操作区继续与统一锚点对齐。例外不得覆盖 `.ui-primary-surface` 本身。

需要横向浏览的数据表或图表可以在自身批准的内部滚动容器中横向滚动，但 `.page-card-scroll`、`.page-card-static` 与 `.ui-page-stack` 本身不得产生页面级横向溢出。

## 6. 页面承载安全几何

- `.page-content--player` 必须占满承载页面槽并保持既有桌面 `max-width: none` 语义；其下 `.page-fixed-header`、`.page-card-scroll-area / .page-card-static`、`.page-card-scroll` 与页面内容栈必须保持 `width: 100%`、`max-width: 100%`、`min-width: 0` 等价约束，一级直接子项同样不得超过 `100%`。
- 桌面端页面实际宽度必须等于 `workspaceCard` 中扣除固定 `78px` 指挥轨道后的页面槽宽度。侧栏由 `78px` 覆盖展开到 `224px` 时只允许覆盖页面，不得推动、扩宽或裁剪页面正文。
- 移动端页面实际宽度必须等于唯一根级 Mobile Workspace Sheet 的内容盒宽度；Sheet 边框之外不得存在页面正文，Sheet 内部也不得保留桌面宽度或隐形超宽盒。
- 可滚动 `PageLayout` 的 `.page-card-scroll` 四边统一使用 `--player-page-content-inset`。标题栏底边到第一块正文顶边必须至少保留该间距；不得再使用 `padding-top: 0` 或通过第一块卡片负 margin 抵消。
- 不可滚动 `.page-card-static` 仍必须遵守宽度链和禁止横向溢出规则，但不强制追加正文 inset，避免破坏研发树等固定工作区的既有内部布局。
- `GlobalBuildingsPage` 等全局经营页必须以 `minmax(0, 1fr)`、`min-width: 0` 和可收缩列表行保证内容随真实承载面收缩。一级建筑页只保留全局工厂目录，不再存在独立地区建筑卡片；全局工厂目录第一行继续保持“工厂｜平均利润／分钟｜拥有”的共享表头结构，一级目录条目登记为两行高度例外，第二行仅在工厂身份列内承载“当前生产产物／当前作业制度”两个方形图标，正方形工厂插画跨越两行。点击工厂后出现的地区工厂列表仍保持“地区｜利润／分钟｜拥有｜状态”的共享单行结构。两级列表都不得依赖卡片网格、抽屉裁剪或页面级横向滚动。
- 全局建筑列表的响应不能只依赖浏览器 viewport。`.global-operation-page` 必须建立 inline-size 容器；真实页面承载宽度不大于 `620px` 时，两级工厂列表继续压缩业务列模板，通用列间距、横向内边距与 Chevron 轨道必须复用 `entity-list-header.css` 的页面列表共享令牌。一级全局工厂目录只允许按已登记例外把条目高度／跨行工厂插画／第二行方形图标收紧到约 `70px / 46px / 26px`，极窄 `360px` 及以下进一步收紧到约 `68px / 42px / 24px`；地区工厂列表继续使用共享单行密度。原因是 `721px` 及以上已经进入桌面外壳，但固定侧栏和主卡轨道仍可能把实际页面槽压缩到远小于移动断点的宽度；响应必须以实际页面槽为准，同时不得为了避免溢出把第一行数值列或地区列表改成多行，也不得重新形成未登记的页面专属列表样式。
- 浏览器真实几何回归若在同一页面实例内跨越 `720px` 桌面／移动断点，必须先等待断点后的目标业务节点恢复为可见且具有非零布局盒，再读取 `boundingBox()` 或其他几何；视口切换会触发玩家外壳与 Mobile Workspace Sheet 的响应式重排，测试不得把切换调用返回的瞬间误判为布局已经稳定。

## 7. 当前清理结果

以下旧页面级外层规则已经移除：

- 州级概览与未解锁建筑／仓库不再使用包裹整个分区的唯一一级卡片，分区内容直接进入正文；
- 建筑页 `.panel.production-surface` 的独立桌面／移动 padding；
- 银行页 `.asset-overview-card` 的页面专属移动 padding，以及已删除 `.asset-event-panel` 的旧规则；
- 商店 `.gem-shop-grid > .widget` 的固定 padding；
- 排行 `.leaderboard-board-card` 的固定 padding；
- 全局建筑页已退役四项统计卡对应的 `.global-operation-metrics` 布局规则；
- 一级建筑页已退役独立“地区建筑”卡片及其 `.global-province-list` / `.global-province-row` 布局规则。

建筑页开关尺寸、银行资产总览内部摘要块、商店内部兑换块和排行列表行等内部布局规则继续保留，不属于一级卡片外层内边距。

## 8. 自动验证

`scripts/verify-primary-surface-insets.mjs` 必须验证：

- 唯一令牌、桌面 `16px` 和移动 `12px` 规则存在；
- `PagePanel`、旧 `Panel + widget` 兼容桥以及生产／排行旧类兼容入口存在；
- 正常正文只有一个一级业务模块时必须直接进入正文，不得恢复整页唯一圆角包裹卡；
- 玩家页面宽度链、`.game-shell` 局部解析的正文四边 inset、禁止根级横向溢出和一级直接子项宽度约束存在；
- 页面内容栈本身的命名样式仍唯一保留在 `design-system.css`，不得在 `primary-surfaces.css` 重复声明；
- 全局建筑页只保留全局工厂目录入口；一级全局工厂目录在 `620px`、`360px` 实际承载断点保持已登记的两行高度与身份列图标例外，第一行共享列、横向 padding、gap 和 Chevron 仍由 `entity-list-header.css` 控制；工厂类型下的地区工厂列表继续保持共享单行密度。一级页面不得恢复 `.global-province-list` / `.global-province-row`，两级列表都不得产生页面级横向溢出，也不得恢复已退役的 `.global-operation-metrics`；
- 样式加载顺序正确；
- 已清理页面不再声明旧外层 padding；
- 本设计文档中的唯一权威和禁止回退规则仍存在；
- `tests/browser/player-page-geometry.spec.ts` 在桌面和移动断点覆盖正式页面，验证页面不超出承载面、可滚动正文首项有统一顶部间距且根级无横向溢出，并分别对一级全局工厂目录和点击工厂后的地区工厂列表执行边界与跨断点真实几何回归；一级全局工厂目录条目必须保持约 `68～76px` 的登记两行高度，地区工厂条目继续保持不高于 `58px` 的共享单行高度；
- `tests/browser/market-runtime.spec.ts` 的跨桌面／移动响应式几何用例必须在断点切换后等待下单区与订单簿重新可见，再读取真实布局盒，防止把外壳重排中的瞬态无布局状态误报为页面几何回归。

该验证必须加入 `verify:architecture`，防止后续修改重新引入页面专属一级卡片内边距、页面宽度漂移或外壳裁剪。
