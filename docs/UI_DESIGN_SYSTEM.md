# Economy UI 设计系统

> 状态：当前视觉、共享组件、响应式与可访问性实现基线
> 适用项目：`RIVERS0FT/Economy`
> 当前平台：网页端
> 更新时间：2026-08-25

产品和页面职责分别以 `PRODUCT_AND_GAMEPLAY_DESIGN.md`、`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准；应用外壳几何和玻璃材质以 `LIQUID_GLASS_CHROME_DESIGN.md` 为准。

## 1. 界面目标

- 深色、稳定、专业的金融与产业经营氛围；
- 信息密度高但层级清晰；
- 玩家可见固定文案统一使用中文；
- 绿色表示主要操作、增长、买入和正常；
- 红色表示卖出、损失、危险和错误；
- 金色表示价格、等待和施工；
- 蓝色表示信息；
- 桌面适合持续观察，移动端适合单手操作并尊重安全区；
- 标题只保留主标题和必要说明，不显示英文眉题或重复小字。

## 2. 样式职责

| 文件 | 唯一职责 |
|---|---|
| `src/styles/design-system.css` | 设计令牌、页面一级内容栈、按钮、面板、状态、表格、开关和通用焦点视觉 |
| `src/styles/interaction-states.css` | 最近输入方式驱动的共享 hover、active、程序化焦点与键盘焦点视觉 |
| `src/styles/primary-surfaces.css` | 玩家端一级卡片外层内边距令牌、最终选择器、移动断点与旧一级卡片类兼容入口 |
| `src/styles/form-controls.css` | 输入、选择器、文本域、文件控件、自动填充、错误／只读／禁用状态和移动尺寸的最终视觉权威 |
| `src/styles/globals.css` | 通用业务布局 |
| `src/styles/strategic-game-shell.css` | 玩家端常驻地图、侧栏与页面单一主卡片、统一紧凑页宽、页面开启动画、地图镜头栏、覆盖式指挥栏与移动安全布局；不得修改管理员外壳 |
| `src/styles/charts.css` | 共享 ECharts 容器、Tooltip 内容排版、无障碍摘要、市场底部安全区、管理员图表与资产圆环布局；不得定义 Tooltip 毛玻璃材质 |
| `src/styles/safe-floating.css` | 工作区安全 Tooltip 的容器内定位、尺寸、滚动与交互几何；不得定义 Tooltip 毛玻璃材质或承担外壳几何 |
| `src/styles/overview.css` | 概览主列核心卡片、右侧公开事件日志和响应式布局 |
| `src/styles/icon-system.css` | 全局 SVG 图标尺寸、商品图标标签、货币金额、导航图标槽位和移动图标尺寸 |
| `src/styles/player-avatar.css` | 玩家 64px 头像、缺省首字符回退与圆形裁切的共享视觉 |
| `src/styles/product-artwork.css` | 商品插画 128px 运行时缩略图映射、批准展示上下文、尺寸与低流量 SVG 回退 |
| `src/styles/facility-artwork.css` | 工厂场景插画 256px 运行时缩略图映射、批准展示上下文、尺寸与低流量 SVG 回退 |
| `src/styles/unified-market-admin.css` | 统一市场与管理员页面布局 |
| `src/styles/market-commodity-row.css` | 全局商品详情与地区市场共享的独立列表表头、紧凑商品数据行、默认折叠筛选 disclosure 和移动单行收缩规则 |
| `src/styles/settings.css` | 设置页统一单列、统计密度、账号分组和存档管理布局 |
| `src/styles/asset-overview.css` | 银行页资产总览的净资产摘要、资产配置圆环、资产构成表和移动两行两列重排 |
| `src/styles/bank.css` | 存款余额条、存取款双列、贷款评估表、抵押摘要、还款与银行记录的业务布局 |
| `src/styles/industry-system.css` | 工厂、建设列、自适应同行等高卡片与生产密度 |
| `src/styles/facility-group-card-grid.css` | 生产主从布局、工厂集群详情内部排列和“生产产物／作业制度”横向 Auto 槽位布局 |
| `src/styles/facility-production-formula.css` | 工厂集群生产结算的输入侧周期成本、物资槽、流向进度、范围标识和响应式布局 |
| `src/styles/warehouse-expansion.css` | 州级可钻取仓库商品网格、独立跨州运输卡、地区商品详情自动交易控制、容器查询、紧凑商品卡和移动自动交易入口布局 |
| `src/styles/production-surface.css` | 建筑页建设卡和工厂详情的标题轨道、名称下状态与紧凑开关；不得定义一级卡片外层内边距 |
| `src/styles/regional-entity-page-title.css` | 地区商品／工厂详情共享两行标题：实体主标题、灰色地区副标题，以及不改变固定标题区高度的溢出规则 |
| `src/styles/auth.css` | 登录布局、动态视口与认证自动填充兼容例外 |
| `src/styles/card-system.css` | 卡片圆角映射 |
| `src/styles/desktop-sidebar.css` | 桌面侧栏宽度、折叠、导航固有行高、无角标按钮和可访问状态 |
| `src/styles/mobile-detail-sheet.css` | 唯一根级 Mobile Workspace Sheet 的工厂详情卡片容器、透明点击 backdrop、圆角、拖动、页面／详情内容层、滚动区、安全区和动效最终权威；所有移动业务页面与业务详情共用同一个根 Sheet，Sheet 自身承担唯一移动毛玻璃模糊，状态栏与移动通知层保持在其上，底部导航保持同一 DOM 但在 Sheet 存在期间隐藏，不得创建第二个 Sheet DOM |
| `src/styles/scrollbars.css` | 全局覆盖式滚动条宽度、颜色、层级、显隐与移动页面／根级 Dialog 安全边缘轨道 |
| `src/styles/performance.css` | 渲染性能保护和触控惯性；不得阻断页面或虚拟列表的纵向滚动链 |
| `src/styles/frosted-glass-surfaces.css` | 状态栏、认证卡片、移动底栏、玩家 `workspaceCard`、根级状态卡与 `.ui-tooltip-surface` 的统一纯 CSS 毛玻璃材质；Tooltip 只允许单节点轻量表面 |
| `src/styles/frosted-glass-chrome.css` | 仅供浏览器运行时 harness 使用的固定样式聚合入口 |
| `src/styles/virtual-list.css` | 共享窗口化列表、虚拟表格行、滚动视口和管理员高增长记录布局 |
| `src/styles/mobile-*.css` | 移动导航、安全区和页面布局 |

业务页面样式先加载，`design-system.css` 在页面样式之后收束页面一级区块间距和共享基础视觉，`interaction-states.css` 随后根据最近输入方式收束共享交互状态，`primary-surfaces.css` 再收束玩家端一级卡片外层几何，`form-controls.css` 最后加载并只负责表单控件。页面样式不得重新实现页面一级区块间距、按钮、输入、面板、一级卡片外层内边距、状态标签、开关、表格、图标、hover、active 或焦点的基础外观。

## 3. 共享 React 组件

业务页面优先使用：

- `PageLayout`
- `RegionalEntityPageTitle`
- `MobileWorkspaceSheetHost`
- `MobileWorkspacePageSheet`
- `MobileWorkspaceDetailSheet`
- `MobileDetailSummary`
- `Panel`
- `PagePanel`
- `WidgetHeading`
- `Button`
- `StatusTag`
- `MetricCard`
- `DataList`
- `DataRow`
- `SwitchControl`
- `ToggleField`
- `ScrollableTable`
- `VirtualList`
- `VirtualRecordTable`
- `CompactNumber`
- `CompactCurrency`
- `CompactRank`
- `PlayerAvatar`
- `CurrencyAmount`
- `MarketCommodityRow`
- `CurrencyText`
- `EmptyState`
- `SafeTooltip`
- `FormField`
- `TextInput`
- `IntegerInput`
- `SelectInput`
- `TextArea`
- `FileInput`
- `InputGroup`
- `EconomyChart`

`MobileWorkspaceSheetHost` 是移动端唯一根级 Sheet 宿主，并独占 `useMobileWorkspaceSheetDrag` 的向下拖动、速度判定、回弹、关闭和 reduced-motion 状态机。`MobileWorkspacePageSheet` 只保留为 `GameShell` 的零 DOM 兼容适配器，`MobileWorkspaceDetailSheet` 只向 Host 注册详情内容和固定底栏；两者都不得创建自己的 Sheet 外框、遮罩、Portal 或第二套手势状态机。

`PagePanel` 是新增玩家端一级卡片的唯一 React 入口，固定复用 `Panel`、`.widget` 与 `.ui-primary-surface`。现有 `Panel className="widget ..."` 由兼容桥自动补充 `.ui-primary-surface`；建筑页和排行页尚未迁移的旧一级卡片类只允许在 `primary-surfaces.css` 中作为兼容入口，不得在业务 CSS 中重新定义外层 padding。

玩家页面返回统一由 `PlayerPageNavigationContext` 的受限位置栈驱动。栈项必须是轻量可比较描述符，当前页加历史最多 20 层；同级分区使用 replace，实体下钻使用 push，返回 pop，关闭 reset 到 `map`。页面组件不得保存来源回调、DOM 或完整业务状态来实现返回，也不得让轮询更新改变栈深度。仓库商品卡、全局商品／工厂下钻和地区实体详情必须复用这套语义。

`RegionalEntityPageTitle` 是地区商品与地区工厂详情的唯一共享标题结构。第一行固定显示实体名称并使用大于地区行的主标题字号；第二行固定显示州级地区全称，使用 `var(--color-text-muted)` 灰色次级文字。两行各自保持单行与省略号溢出，总容器固定占用现有 `40px` 标题轨道，不得修改 `PageLayout` 的标题 padding、返回／关闭按钮位置、`.page-fixed-header` 高度或正文起点。目录页继续使用普通单行页面标题；只有具体地区实体详情使用该两行结构。

`EconomyChart` 是业务数据图表的唯一 React 入口。项目只安装 Apache `echarts`，不得引入 `echarts-for-react` 或第二套图表包装库；`echarts.init`、SVGRenderer、按需图表模块注册、`ResizeObserver`、`requestAnimationFrame` 合并 resize、Option 更新、事件绑定与卸载 `dispose()` 统一放在 `src/components/charts/`。图表容器宽或高为 `0` 时必须延迟 `setOption` 并跳过 `resize`，在首次获得可渲染尺寸后再应用最新 Option。市场行情、银行资产配置、管理员玩家与人口图表必须从现有 CSS 设计令牌读取颜色，提供中文 `aria-label` 与可读数据摘要；业务页面只提供数据、Option 和语义事件回调，不得直接持有 ECharts 实例或依赖其私有 SVG DOM。ECharts 必须随使用它的数据图表既有动态 import 按需加载，登录首屏不得静态加载图表包。战略地图不属于业务数据图表，不使用 ECharts Map／Geo；它由 `UsMainlandMap` 的静态 SVG 世界面和独立合成相机负责，避免高频缩放触发图表重绘。

ECharts 不得把 `var(--color-*)` 原样交给 ZRender 的颜色运算。`EconomyChart` 必须在每次 `setOption` 前读取图表容器的浏览器计算样式，把 Option 中静态颜色、颜色数组、数据项颜色和颜色回调结果统一解析为实体色值；业务图表不得自行复制颜色解析器。以 Tooltip 为唯一悬浮信息反馈的折线、柱状和饼图系列必须复用 `STABLE_TOOLTIP_EMPHASIS`，禁止库默认 emphasis 改写填充、描边或透明度。鼠标、触控点击、状态刷新和尺寸变化均不得让当前或其他数据图形消失、变为透明或丢失原始颜色。

应用内 Tooltip 的普通 React 入口统一使用 `SafeTooltip`，图表 Tooltip 统一复用 `src/components/charts/chartOptions.ts` 的 `commonTooltip`。两类实际 Tooltip 浮层节点都必须包含 `.ui-tooltip-surface`，其半透明背景、`backdrop-filter`、柔和边界、高光与阴影唯一来自 `src/styles/frosted-glass-surfaces.css`；`safe-floating.css` 只负责安全定位、尺寸与滚动，`charts.css` 只负责 ECharts Tooltip 的内容排版。Tooltip 必须保持单节点轻量毛玻璃，不得套用 `FrostedGlassSurface`、增加装饰性玻璃 DOM，或在业务 CSS 中复制第二套材质。浏览器原生 `title` 不属于应用内 Tooltip 材质，只能按既有可访问性规则保留非必要补充说明。

所有 `type: 'pie'` 系列（包括实心饼图与圆环图）必须使用 `chartOptions.ts` 的共享 `PIE_PAD_ANGLE = 5`，统一设置 `padAngle: PIE_PAD_ANGLE`；不得在业务图表中改回零间隔、直接写入魔法数字或定义第二套扇区间隔。

`src/components/ui/FormControls.tsx` 是文本、整数、选择器、文本域、文件与组合输入的唯一 React 包装层；紧凑表格行内输入可以直接使用原生输入控件，但不得直接渲染可见 `<select>`。所有玩家端和管理员端可见下拉选择器必须使用共享富下拉视觉与交互：普通纯文字选择器通过共享 `SelectInput` 自动复用 `RichSelectInput` 的触发器与列表，需要商品图片或语义 Icon 时继续使用共享 `RichSelectInput`，业务页面不得自行实现下拉弹层。浏览器原生 `select` 只允许作为 `SelectInput` 内不可见的表单值与旧 `onChange` 兼容层，不承担可见视觉、键盘焦点或弹层。默认 `SelectInput` 与 `RichSelectInput` 必须共用触发器、深色列表、选项高度、圆角、悬停、选中、禁用、方向键／Home／End／Enter／Space／Escape／Tab、文字快速定位、焦点返回和工作区安全浮层定位；纯文字选项不得保留空图标列。生产产物使用 `ProductArtwork`，作业制度使用统一功能 Icon，不得手写 `<svg>`、`<path>`、Emoji、字符或字体图标。

生产设置中的“生产产物／作业制度”是共享 `RichSelectInput` 唯一批准的 `production-config` 变体。该变体参考经营模拟游戏的生产方式切换信息层级，以“生产方案槽”承载当前选择；收起触发按钮固定为正方形并按内容宽度布局，只显示当前产物／作业制度图片，不显示名称、参数摘要或下拉箭头，图片槽不得绘制独立黑色底板，且不得横向拉伸。生产设置横向排列使用类似 UMG Horizontal Box 的 Auto／Desired Size 槽位：两个字段按自身内容宽度从左向右连续排列，只由统一 `gap` 分隔，父容器剩余宽度不得分配给字段，不得使用 `1fr`、百分比或 `flex-grow` 制造 Fill 槽；字段容器与触发按钮的实际命中区域继续随内容收缩。展开后仍使用同一 `combobox`／`listbox`、同一 `open`／`activeValue`、文字快速定位、键盘导航、焦点返回、工作区／Dialog Portal、顶层 Popover 与刷新透明性内核，不得复制第二套 Popover、键盘导航或刷新状态。`production-config` 只允许在 `form-controls.css` 中改变共享控件外观；生产设置 Auto 槽排列只允许在 `facility-group-card-grid.css` 定义。方案行可高于默认选项，菜单允许宽于触发器，但宽度必须收敛在当前工作区或根级 Dialog 可用矩形内；设置、合同、拍卖、建设工厂等默认下拉不得继承这些尺寸。

收起的生产产物方案槽只显示 `ProductArtwork`；路线名称、实际产出数量、周期、投入／产出与周期成本仅在候选方案菜单中显示。收起的作业制度方案槽只显示统一功能 Icon；制度名称、周期、成本、产量、实际投入与相对变化仅在候选方案菜单中显示。生产产物和作业制度的触发图片与展开选项图片都不得带独立黑色底板或图片槽边框；完整名称与参数只在展开候选中显示。绿色／红色只表达“该指标相对当前更有利／更不利”的方向，不得把高速、高产或任何制度整体承诺为盈利；真实利润继续由生产结算和真实成交价表达。当前方案在菜单中使用共享选中标记，作业制度说明不得显示。

移动工厂详情中的生产产物与作业制度继续同一行横向 Auto 槽；两个字段均按自身 Desired Size 从左侧连续排列，第二项紧跟第一项并只保留统一 `gap`，不得恢复两等分列、百分比轨道或其他 Fill 布局。打开 `production-config` 时，方案菜单可以扩展到根级 Dialog 的可用宽度而不受正方形触发按钮限制，必须保持在视口内且不得制造横向溢出。根级 Dialog 内的 `RichSelectInput` 列表继续复用该 Dialog 根作为安全定位边界并位于详情 Sheet 表面之上，但移动通知面板和状态栏层级更高。`production-methods.css` 只负责投入／产出／指标摘要的业务内部排列，不得定义触发器、弹层、定位、键盘或选中基础视觉。

管理员入口、游戏入口、十一个正式游戏页面与隐藏 `ProvincePage` 必须使用 `React.lazy` 与动态 `import()` 按需加载；登录页不得静态拉入管理员和全部游戏页面。根游戏模型不得维护每秒变化的时间状态，倒计时只在概览、生产、拍卖、合同和银行等实际需要的局部页面通过共享 `useNow` 维护，市场订单簿、导航、地图和银行资产总览等静态区域不得被全局秒级时钟重渲染。

服务器快照与客户端交互状态必须使用不同原语。实体选择使用 `src/hooks/useStableSelection.ts` 的 `useStableSelection`，有效选择在任意轮询快照和无关分区变化中保持不变；服务器字段编辑使用 `src/hooks/useServerDraft.ts` 的 `useServerDraft`，以 `dirty`、`baseRevision` 和 `conflicted` 区分已确认值与未提交草稿。业务页面不得通过依赖完整 `game` 对象的 Effect 无条件重置本地 setter，也不得用服务器修订号、时间戳或完整状态作为 React `key` 触发重新挂载。

`SwitchControl` 是布尔开关的唯一 React 基础组件，`.ui-switch` 是唯一视觉实现。不得新增工厂开关、音乐开关或设置开关的平行 CSS。

`VirtualList` 与 `VirtualRecordTable` 共用 `src/hooks/useVirtualWindow.ts` 的唯一窗口化内核。该内核根据滚动位置只挂载可视条目与少量 `overscan` 条目，使用模块级稳定业务 ID 取键，并通过 `ResizeObserver` 修正可变高度。滚动事件必须通过 `requestAnimationFrame` 合并为每帧最多一次 React 状态更新，可视起止索引必须使用累计偏移二分查找，不得每帧从第 0 项线性扫描。普通高增长列表使用 `VirtualList`；需要表头与数据共享横纵偏移的记录表使用单一双轴视口 `VirtualRecordTable`，不得各自实现另一套虚拟滚动器。

`CurrencyAmount` 是玩家端和管理员端可见货币金额的唯一组合组件，固定复用 `GameIcons.tsx` 的 `CreditsIcon`。`CurrencyText` 只用于把服务器或旧数据返回字符串中的遗留货币字符转换为同一 SVG，不得用运行时 DOM 扫描替代组件渲染。

页面标题从 `h1` 开始，卡片标题从 `h2` 开始。`PageLayout` 和 `WidgetHeading` 不提供 `eyebrow` 参数。

### 3.1 `PageLayout` 与页面一级区块间距

- 除地图页外的十个玩家正式页面、隐藏 `ProvincePage` 和管理员分区必须使用共享 `PageLayout`；地图页是唯一全工作区例外，必须直接使用透明且无子元素的 `.province-map-page` 路由占位，不得嵌入 `PageLayout`、`.ui-page-stack`、左上指挥卡、左下图例／来源卡或“当前经营地区”卡片。唯一地图实例与地图镜头栏由 `StrategicWorkspace` 通过同一个 Portal 挂载为根级地图层的直接子节点，镜头栏不得进入页面工作区 Chrome，`MapPage` 不得再渲染 `UsMainlandMap`。玩家桌面端必须使用唯一 `workspaceCard` 把侧栏和当前页面组合为同一张外层毛玻璃卡片；侧栏与 `.page-content` 在该卡片内保持透明，管理员和移动端不得被迫套用第二层玩家材质。玩家 `GameShell` 必须通过轻量页面导航上下文让共享 `PageLayout` 形成“返回 SVG｜标题｜关闭 SVG”三列标题栏；标题居中，两个控制固定正方形且只显示统一 SVG，不得显示“返回”或“关闭”文字。返回无历史时禁用，关闭进入纯地图视图；页面业务操作进入标题栏下方独立行。玩家标题与操作组成固定 `.page-fixed-header`，并使用独立表面背景、底部分隔线和阴影与正文形成清晰分区；标题块不得随正文滚动。普通页面正文唯一 `.ui-page-stack` 位于页面卡片内部 `ScrollArea`，覆盖式纵向轨道贴紧页面正文视口右边缘但不得越出主卡片。研发页是唯一固定正文例外：显式使用 `PageLayout scrollable={false}` 与 `.page-card-static`，页面自身不滚动，科技画布占满正文并继续平移缩放，桌面研发卡覆盖在画布左上安全内距内，移动研发详情继续使用共享详情面板的内部 `ScrollArea`。管理员未提供玩家导航上下文，不得显示玩家页面控制。`PageLayout` 标题区只渲染标题与操作，不得渲染标题下方说明段落；兼容 `description` 属性不得进入 DOM。其他业务页面不得直接创建 `.page-content`、复制页面外壳或手动插入第二个 `.ui-page-stack`。
- `.ui-page-stack` 是页面标题下一级内容的唯一纵向容器，在自身上下文把 `--page-section-gap` 映射为当前 `var(--layout-gutter)`。它可以位于普通页面 `.page-card-scroll` 或研发页 `.page-card-static` 中；普通滚动宿主保持内容高度，固定宿主必须显式使用 `grid-template-rows: minmax(0, 1fr)` 与 `align-content: stretch` 建立可解析的剩余高度，不得让 `height: 100%` 子项落入自动内容行并塌陷。两种宿主都必须保持相同的直接子区块间距。因此普通桌面、紧凑桌面和移动工作区继续分别跟随外壳沟槽，不维护页面专属固定像素。
- 页面外边距、标题内边距、正文内边距、一级区块间距和战略面板预留统一读取 `var(--layout-gutter)`；标题上下左右四边必须使用同一个值，桌面与移动断点不得只覆盖单边。玩家页面外层与所有一级卡片统一读取 `var(--radius-card)`，页面或业务 CSS 不得另写像素圆角。
- 页面摘要、一级面板、标签栏、主要列表或主要工作区必须作为 `.ui-page-stack` 的直接子元素；相邻可见一级区块只由 `gap: var(--page-section-gap)` 分隔。共享最终样式必须清除直接子元素的 `margin-block`，业务 CSS 不得用 `margin-top`、`margin-bottom`、相邻选择器或更高优先级规则重新制造一级外部间距。
- `PagePanel` 的 `--primary-surface-inset` 只负责一级卡片边缘到内部内容的留白；页面一级区块间距、一级卡片内边距和组件内部 `--space-*` 间距是三个独立层级，不得互相替代。
- 复杂页面允许把若干紧密关联模块放进一个页面专属网格或组合容器，再把该容器作为 `.ui-page-stack` 的一个直接子元素；不得为特殊页面增加 `disableSpacing`、零间距开关或平行页面外壳。
- `scripts/verify-page-section-spacing.mjs` 必须扫描全部 `src/pages/*Page.tsx`、管理员入口、共享组件、最终 CSS、权威设计和浏览器回归；除唯一地图工作台例外外，新增正式页面未使用 `PageLayout`，或地图页恢复 `PageLayout`／缺少 `.province-map-page`，或业务样式重定义 `.ui-page-stack`、真实一级几何间距不一致时必须阻止构建。

### 3.1.1 登录后唯一根级 Mobile Workspace Sheet

不大于 `720px` 时，除纯地图外的所有玩家业务页面与业务详情共用同一个唯一根级 Mobile Workspace Sheet。`MobileWorkspaceSheetHost` 通过 `SignedInShell` 唯一 `.workspace-dialog-layer` 只挂载一份 `.mobile-detail-sheet-backdrop > .mobile-detail-sheet`。完整视口 `.mobile-detail-sheet-backdrop` 只承担空白点击关闭和手势命中，必须保持透明并禁用 `backdrop-filter`；Sheet 自身承担唯一移动毛玻璃模糊，实体 `.mobile-detail-sheet` 才能复用共享 `--frosted-glass-*` 背景、边框和 `blur(18px) saturate(128%)`。实体 Sheet 底边贴物理视口底部，最大高度同时受视觉视口 `88%`、`760px` 和移动状态栏下方实际可用高度约束，顶边始终位于移动状态栏下方。Sheet 外地图与 Chrome 不得压暗、变色或模糊；移动状态栏和通知入口始终清晰且可交互。

移动底部导航必须始终保留同一个 DOM 实例。根 Sheet 存在期间，底栏必须由 `GameShell`／导航组件显式设置 `aria-hidden`、`inert`、不可见和不可命中，不能只依赖 Sheet 或 backdrop 遮挡；只有根 Sheet 完整收起并进入纯 `map` 后才恢复可见与可交互，并播放一次约 `280ms cubic-bezier(.2,.8,.2,1)` 的通知岛同系弹性返回动画。详情层打开／关闭、通知面板打开／关闭、权威状态刷新、页面内容切换和初始挂载都不得触发该动画；`prefers-reduced-motion: reduce` 时立即恢复，不播放位移动画。

一级业务页面作为 Host 的基础内容层继续承载原页面 `PageLayout` 固定标题和页面自己的正文 `ScrollArea`；业务页面之间切换只替换基础内容并保持同一个 `.mobile-detail-sheet` DOM。工厂详情、研发详情与市场自动交易设置继续使用 `MobileWorkspaceDetailSheet` API，但该组件只能把详情正文和可选固定底栏 Portal 到 Host 预留的详情槽位，不得创建第二个 Sheet DOM。打开详情时在同一根 Sheet 内把基础页面设为 `inert` 并隐藏，详情层使用同一拖动内核；关闭详情、点击 backdrop、按 `Escape` 或有效向下拖动只收起当前详情层并恢复原页面与触发焦点，根 Sheet 不卸载。仅当不存在详情层时，关闭页面、点击 backdrop、按 `Escape` 或正文已到顶部的有效向下拖动才收起整个根 Sheet并进入 `map`。

`MobileWorkspaceSheetHost` 是唯一允许调用 `useMobileWorkspaceSheetDrag`、`useWorkspaceDialogLayer`、创建根 backdrop 和实施页面滚动锁的组件；它以可与顶部 Chrome 并存的非模态 `role="dialog"` 工作，不得设置 `aria-modal="true"`，也不得建立全局 `Tab` 焦点陷阱。状态栏通知按钮必须能够在 Sheet 打开时获得焦点。`MobileWorkspacePageSheet` 只是零 DOM 兼容适配器，`MobileWorkspaceDetailSheet` 只是内容注册器。物理根 Sheet 独占一套 Pointer／Touch 监听，详情打开时只切换同一拖动内核的视觉目标，不得把监听下沉或重复注册。

普通 Tooltip、Popover 与不应覆盖应用 Chrome 的业务浮层继续使用 `.workspace-floating-layer`；来自唯一根 Sheet 内的富下拉可以继续以 `.workspace-dialog-layer` 作为安全定位边界并位于 Sheet 表面之上。移动通知面板是明确例外：它复用同一个 `.workspace-dialog-layer` 的更高内部层级覆盖 Sheet，但位于移动状态栏之下，不创建第二个 Portal 根或第五个全局层。通知面板打开时必须卸载通知岛、Toast 及对应 ARIA live region，`Escape` 由通知面板在捕获阶段消费并只关闭通知，不得穿透去关闭下层详情或根 Sheet。任何业务页、工厂详情、研发详情或自动交易设置都不得创建嵌套 `.mobile-detail-sheet`、第二个 backdrop、第二个根级 Portal 或平行拖动状态机。地区商品自动交易详情固定当前商品，继续复用采购／出售页签和既有仓库表单信息层级，不显示全商品选择器；原子保存动作仍放在唯一 Host 的固定底栏。

### 3.2 输入方式与共享交互状态

输入方式是跨页面 UI 能力，不属于滚动条私有实现。所有 React 根入口必须导入 `src/app/interactionBootstrap.ts`，由其唯一安装 `src/utils/inputModality.ts`；最近一次有效鼠标／触控板、手指／笔或键盘输入分别把根元素 `data-input-modality` 更新为 `mouse`、`touch` 或 `keyboard`，混合输入设备必须在不刷新页面的情况下即时切换。

| 能力 | 运行时权威 | 样式／组件入口 | 防回退 | 浏览器测试 |
|---|---|---|---|---|
| 输入方式 | `src/utils/inputModality.ts` + `src/app/interactionBootstrap.ts` | 根元素 `data-input-modality` | `scripts/verify-interaction-modality.mjs` | `tests/browser/input-modality.spec.ts` |
| 共享交互表面 | 根输入方式 | `src/styles/interaction-states.css` + `data-ui-interactive="surface"` | `scripts/verify-interaction-modality.mjs` | 工厂详情与混合输入测试 |
| 覆盖式滚动条 | `src/hooks/useOverlayScrollbar.ts` | `ScrollArea` + `src/styles/scrollbars.css` | `scripts/verify-overlay-scrollbars.mjs` | `scroll-input-modality.spec.ts` |

共享交互规则：

- 需要自定义悬停／按压／焦点视觉的卡片按钮必须声明 `data-ui-interactive="surface"`，业务 CSS 只提供 `--ui-interactive-*` 变量，不得再次直接声明同一元素的裸 `:hover`、`:active` 或 `:focus-visible`。
- hover 必须同时满足最近输入方式为 `mouse`、`(hover: hover)` 和 `(pointer: fine)`；触摸产生的浏览器粘滞 `:hover` 不得改变可见样式。
- 触摸关闭 Overlay 后可以把语义焦点返回触发元素，但共享交互表面不得显示类似选中态的焦点环；输入方式为 `keyboard` 时必须显示明确的 `:focus-visible` 焦点。
- `scripts/interaction-hover-legacy.json` 只记录迁移前已经存在的未约束 hover。`scripts/verify-interaction-modality.mjs` 禁止增加新条目；修改既有交互区域时应迁移到共享协议，而不是扩大遗留基线。
- 新增 React 根入口时必须自动纳入静态扫描并安装交互 bootstrap；不得依赖修改者记住手动调用 `configureInputModality()`。

## 4. 开关焦点环与点击区域

全局 `SwitchControl` 的可访问点击区域为至少 `44 × 44px`，视觉轨道仍保持紧凑。焦点环应位于轨道伪元素外侧，并与轨道形状一致。不得恢复围绕整个 44px 点击区域的额外的大圆环。

必须保留：

- `.ui-switch:focus`
- `.ui-switch:focus-visible`
- `.ui-switch:focus-visible::before`
- 明确的 `outline-offset`

建筑页工厂集群卡右上角是明确例外：点击区域与可见胶囊完全一致，为 `2.75rem × 1.6rem`，用于避免透明 44px 高命中盒下压状态行。其他页面和表单继续遵循至少 44 × 44px。工厂开关始终对齐卡片右上角，异常状态通过 `StatusTag` 文字表达，不得创建异常开关变体。

## 5. 统一 SVG 图标体系

应用外壳图标来自 `src/components/icons/GameIcons.tsx`，商品语义图标来自 `src/components/icons/ProductIcons.tsx`：

方向型交互箭头统一使用无横杆 Chevron：进入详情／跳转向右、返回向左、展开向下、收起向上，状态趋势与相对指标按数值方向使用上／下 Chevron，无变化使用右向 Chevron；JSX 统一复用 `GameIcons.tsx` 的 `ChevronIcon`，原生 disclosure 与共享选择器的 CSS 箭头必须保持同一两笔 V 形几何。方向型箭头不得带横杆、尾线或独立箭杆，不得在业务组件中重新使用 `›`、`⌄`、`↑`、`↓`、`→` 等字符箭头；市场、刷新、退出等具有独立业务语义的复合图标不按方向控件处理，普通说明文字中的层级或流程分隔也不作为交互箭头。

- 状态栏和桌面／移动导航不得继续使用 Unicode 字符、Emoji 或字体符号作为图标；
- 商品图标不得使用字符、字母缩写或 Emoji 作为占位；
- 紧凑工厂资产标签必须使用 `GameIcons.tsx` 的 `FactoryIcon`；建筑选择卡、建筑从属资产交易详情和拍卖主视觉使用 `FacilityIcons.tsx` 的 `FacilityIcon`，不得使用机械商品的齿轮图标或 `⚙` 字符；
- `FactoryIcon` 使用厂房与烟囱轮廓，`machinery` 商品继续使用齿轮机械轮廓，两者不得共用路径；
- 工厂生产公式的周期使用 `GameIcons.tsx` 的 `CycleIcon`，成本使用 `CreditsIcon`，输入库存使用 `WarehouseIcon`；不得用 Emoji 替代；
- 所有玩家端和管理员端可见货币金额必须使用 `CurrencyAmount` 与 `CreditsIcon`，包括状态栏、指标卡、数据行、订单簿、成交记录、排行榜、拍卖、仓库、按钮和管理员记录；
- `GemIcon` 必须接受并转发标准 SVG props、在根节点使用 `.game-icon`，并提供明确的 `1em × 1em` 基础尺寸；商店、状态栏和导航不得依赖父容器裁切或只设置 `font-size` 来约束宝石 SVG；
- 玩家界面不得直接显示 `¤`、`￥`、`¥`、`$`、`€`、`£` 等字符货币符号；服务器消息中的遗留字符必须在通知边界通过 `CurrencyText` 转换为 `CreditsIcon`；
- 所有图标使用统一 `24 × 24` `viewBox`、`currentColor` 和圆角描边；
- 桌面玩家侧栏的 QQ 群入口与设置入口必须分别使用 `GameIcons.tsx` 的 `QqIcon` 与 `SettingsIcon`，不得使用“QQ”或“设置”文字充当折叠态图标；退出登录只保留在设置页当前会话分组；
- SVG 根节点必须带 `.game-icon`，商品 SVG 额外带 `.product-icon`，工厂场景入口额外带 `.facility-icon`；
- 图标本身使用 `aria-hidden="true"` 和 `focusable="false"`；
- 导航配置只保存 `id` 与中文 `label`，不得重新加入字符型 `icon` 字段；
- 桌面侧栏和移动底栏复用同一套导航 SVG，不维护两套图标；
- `721px–960px` 侧栏不得启用另一套紧凑几何；展开态继续显示完整导航与底部操作文字，折叠态只保留图标。桌面侧栏不渲染数字角标。移动底栏的导航项未填满可用宽度时整组居中，发生横向溢出时使用安全居中语义回到起点对齐并保留滚动能力；
- 图标颜色必须继承 `currentColor`；
- `ProductIconLabel` 是商品图标与名称的统一并排结构。

### 5.1 商品 SVG 图标目录

当前 38 种正式商品必须在 `ProductIcons.tsx` 中各有一个独立、可辨识的本地内联 SVG。甘蔗、水果、鱼类、砂糖、纸浆、饮料、预制餐、纸品、配合饲料、养殖药剂、拖拉机和家电不得使用默认包装箱图标。

- `wheat`：麦穗；
- `rice`：稻穗与米碗；
- `sugarcane`：甘蔗秆与叶片；
- `fruit`：带叶水果；
- `timber`：原木；
- `cotton`：棉花；
- `ore`：铁矿石；
- `copper-ore`：铜矿石；
- `crude-oil`：油滴；
- `fish`：鱼；
- `meat`：肉；
- `eggs`：鸡蛋；
- `milk`：牛奶；
- `wool`：羊毛；
- `flour`：面粉袋；
- `sugar`：砂糖袋；
- `lumber`：堆叠木板；
- `steel`：工字钢；
- `copper`：铜材；
- `plastic`：塑料瓶；
- `fertilizer`：化肥袋与颗粒；
- `feed`：配合饲料袋与颗粒；
- `veterinary-medicine`：养殖药剂瓶；
- `pulp`：纸浆卷；
- `textile`：纺织布卷；
- `food`：食物碗；
- `beverage`：饮料瓶；
- `prepared-meal`：分格餐盒；
- `paper`：叠放纸张；
- `furniture`：椅子；
- `clothing`：服装；
- `machinery`：齿轮机械；
- `tractor`：农业拖拉机；
- `electronics`：芯片；
- `appliance`：家电机身与滚筒。

服务器未来返回未知商品 ID 时必须使用统一包装箱 SVG 回退，页面仍按服务器数组动态渲染，不得隐藏商品。市场商品标签、概览商品行情、仓库商品卡、商品订单和商品资产变动必须使用相同的 `ProductIcon`／`ProductIconLabel`。

### 5.2 主页品牌 Logo

- `https://riversoft.top/logo.svg` 是 Economy 登录页与玩家状态栏显示品牌 Logo 的唯一权威资源，统一通过 `src/config/brand.ts` 的 `BRAND_LOGO_URL` 引用；不得恢复直接引用兼容 PNG、复制本地 Logo 或创建平行品牌图标。
- 页面 favicon 使用同一 SVG，并声明 `image/svg+xml`。
- Apple Touch Icon、Open Graph 和 Twitter 图片继续使用主页同步生成的 `https://riversoft.top/1000002880.png`，用于不稳定支持 SVG 的平台；兼容 PNG 不得替代页面内可见 Logo。
- Logo 保持正方形比例并沿用当前圆形裁剪展示，不得拉伸、改色、叠加滤镜或在 Economy 内重新绘制。

### 5.3 商品物资插画图标绘制规范

商品物资插画是仓库、市场、资产和生产物资界面可使用的高识别度商品视觉资产，与导航、状态、周期、成本等功能型 SVG 分工明确。正式源资源统一保存在 `src/assets/product-icons/`，每种商品使用与服务器商品 ID 同名的独立 `1024 × 1024` PNG 文件。普通 24 × 24 紧凑语义位置继续使用 `ProductIcon`／`ProductIconLabel`；生产结算物资行以及 `RichSelectInput` 的生产产物触发器与选项是明确例外，必须通过 `ProductArtwork` 使用 128px 运行时 PNG，不得渲染商品 SVG，也不得由页面直接拼接图片路径。

页面运行时不得直接加载 `1024 × 1024` 源图。`npm run dev`、`npm run build` 和独立商品图片验证会先调用 `scripts/generate-product-artwork-thumbnails.mjs`，使用预乘 Alpha 的 8×8 面积采样生成 `src/assets/product-icons/generated/128/` 下与商品 ID 同名的 `128 × 128` RGBA PNG；`product-artwork.css` 只能引用该目录。生成目录是可复现构建产物，不是正式源资源，构建产物不得提交仓库。

所有商品物资插画必须遵循同一绘制语言：

- 写实与游戏插画融合的 3D 手绘风格，材质真实但略微卡通化，细节适中，优先保证小尺寸识别；
- 使用轻微俯视的三分之四视角、居中悬浮构图，主体约占画布 75%，外形紧凑且轮廓清晰；
- 柔和暖色主光从左上方照射，表面保留符合材质的自然高光、明暗变化和体积感；
- 主体底部只允许非常柔和的半透明接触阴影，不得绘制地面、环境投影或场景背景；
- 每张图只包含对应商品主体，不得加入文字、数字、边框、卡片、人物、Logo、水印或无关装饰物；
- 最终文件必须为 `1:1`、`1024 × 1024`、PNG RGBA 和真实 Alpha 透明通道，四角完全透明，边缘干净且不得带白边或色键残边；
- 同一批资源的相机角度、主体占比、光向、阴影软硬和细节密度必须保持一致，不得为单个商品另起一套视觉风格。

商品主体的语义、正式 ID 与增删范围以本节 5.1 的商品 SVG 图标目录和服务器商品目录为唯一权威；插画应选取能直接表达对应商品、适合小尺寸识别的代表性形态，不得在本小节复制或长期维护另一份固定数量商品清单。
新增商品时必须同时提供同规格源插画并扩展本目录，随后重新生成全部运行时缩略图；替换已有图标时必须保持商品语义和上述统一绘制语言，不得只替换部分尺寸或遗留非透明背景版本。`scripts/verify-product-artwork.mjs` 必须同时校验源图、128px 缩略图、CSS 映射、生成脚本、构建入口和 SVG 使用边界。

### 5.4 工厂场景插画图标绘制规范

工厂场景插画是经营模拟主视觉，用于让玩家在小尺寸下直接识别产业类型。正式源资源统一保存在 `src/assets/facility-icons/`，文件名必须与服务器 `FACILITY_TYPE_CATALOG` 的 `facilityTypeId` 一致。建筑集群选择卡、当前工厂详情横幅、建筑从属资产详情，以及拍卖工厂的大型主视觉、资产矩阵、资产包行和历史图标统一通过 `FacilityIcon` 选择资源；订单表格、本地成交、银行抵押、概览挂单、导航和未知工厂继续使用紧凑 `FactoryIcon`，不得把场景插画扩散到高密度语义位置。当前工厂详情横幅使用 256px 运行时缩略图、居中 `cover` 裁切和上下轻量渐变，移动端不得隐藏。

所有工厂场景插画必须遵循同一绘制语言：

- 高质量写实数字插画／商业级写实 CG，结构真实、材质清晰、细节丰富，允许适度商业游戏美化，但不得使用卡通化夸张造型；
- 明亮自然的日间环境光，具有清晰高光、柔和阴影、蓝天白云与通透空气感；色彩鲜明但不过度饱和，不得使用夸张 HDR、荧光草地或过强青蓝天空抢夺主体；
- 主体建筑或主要设施居中或略居中并保持完整清晰，通常应占画面宽度约 `60%–80%`、高度约 `50%–70%`，缩小到真实卡片尺寸后仍必须成为第一视觉元素；
- 核心主体必须落在中央约 `80%` 安全区域内，以适应正方形源图到 `4:5` 竖卡的居中裁切；天空通常控制在画面高度约 `20%–30%`，大面积空地、田野、水面或堆场不得压低主体识别度；
- 道路不是必选元素，不得为了统一构图强制加入道路。可根据产业语义使用作物行、果树排列、围栏、坡向、管线、传送带、轨道、池体边界或建筑组团形成视觉引导，也允许直接依靠主体尺度、光影和前后层次建立焦点；
- 确需表现道路、装卸场或服务步道时，其面积、亮度和透视强度必须低于主体，不得从底边以超广角大面积铺满画面；交通空间只承担产业识别或轻量引导，不得成为画面面积最大或对比最强的元素；
- 周边使用少量能明确识别产业的辅助设施、工具、运输设备、作物、矿石、堆场、烟囱或资源元素，场景整洁有序，呈现繁荣、稳定和可持续生产状态；
- 正方形满画布场景，无边框、无金属包边、无圆角外框、无 UI 装饰；画面内无文字、无人物、无水印、无品牌标志；
- 最终文件为 `1:1`、`1024 × 1024`、8-bit PNG RGBA；工厂是满画布场景，允许 Alpha 全不透明，不要求商品插画的透明四角；
- 同一批资源必须保持相机高度、透视、主体占比、日间光向、材质细节密度和空气透视一致，单个产业不得另起一套画风。

当前 C1 复杂度工厂 `farm`、`orchard`、`ranch` 与 `fishery` 已采用统一新风格从空白新绘，均为独立原创构图，不以旧图为编辑、描摹或重绘底稿：农场突出谷仓、粮仓与主食作物，果园突出果树与分拣作业建筑，畜牧场突出主畜舍、围栏和牲畜，渔场突出养殖池、处理建筑与供水设施。

当前 C2 复杂度工厂 `logging-camp`、`mine`、`oil-field`、`mill` 与 `sawmill` 同样采用统一新风格从空白新绘：伐木场突出林间作业建筑、原木与集材设备，矿场突出露天矿阶、破碎分选建筑和矿石堆，油田突出完整泵机、储罐与作业建筑，磨坊突出砖木主体、粮仓、面粉与主食作物，锯木厂突出加工厂房、原木进料和成品板材。五张 C2 图片均为独立原创构图，不把旧 C2 图作为图像生成、编辑、构图参考或描摹输入。

当前 C3 复杂度工厂 `pulp-mill`、`steelworks`、`textile-mill`、`food-factory` 与 `paper-mill` 采用统一新风格从空白新绘：纸浆厂突出原木、木片输送、蒸煮罐和清洁管线，冶炼厂突出高炉、矿石上料、铸轧厂房和受控炉光，纺织厂突出锯齿采光屋顶、棉毛原料和成品布卷，食品厂突出面粉储存、洁净加工与冷藏设施，造纸厂突出纸浆罐、造纸主厂房、纸卷和水处理设施。

当前 C4 复杂度工厂 `refinery`、`beverage-factory`、`furniture-factory` 与 `garment-factory`，以及 `fertilizer-factory`、`veterinary-medicine-factory` 与 `tool-workshop`，均采用统一新风格从空白新绘：炼油厂突出分馏塔、换热器、管廊和储罐，化肥厂突出造粒、储存、输送与包装，养殖药剂厂突出洁净混合与灌装，饮料厂突出卫生级混合罐、瓶装线、乳品与水果收料，家具厂突出木料、除尘系统、加工厂房和成品家具，制衣厂突出布卷、采光厂房、裁缝生产区和成衣出库，工具工坊突出中小型锻造与手工具加工。当前 C5 `machine-factory`、C6 `electronics-factory` 与 C7 `appliance-factory` 分别以重型机械总装、洁净自动化电子制造和集成式家电装配为核心；C5 `tractor-factory` 另以拖拉机总装线和轮胎工位保持区分。全部 C3–C7 图片均为独立原创构图，不把旧 C3–C7 图作为图像生成、编辑、构图参考或描摹输入。

C1–C7 全部图片都必须在实际 `4:5` 居中裁切后保持核心主体完整，且不得恢复“底部宽阔道路—远处小建筑—高饱和蓝天”的统一模板。当前批准源图的 SHA-256、覆盖复杂度与从空白新绘的创作模式记录在 `scripts/facility-artwork-baseline.json`，由 `scripts/verify-facility-artwork.mjs` 校验；替换任一已纳入基线的图片时必须采用独立新构图，同步更新本节视觉规则、机器基线和审核结果，不得只覆盖 PNG 或把旧图作为图像编辑输入。

运行时不得直接加载 1024px 源图。`npm run dev`、`npm run build` 和独立工厂图片验证先调用 `scripts/generate-facility-artwork-thumbnails.mjs`，通过共享预乘 Alpha 面积采样生成 `src/assets/facility-icons/generated/256/` 下的 256px RGBA 缩略图；生成目录是可复现构建产物，构建产物不得提交仓库。`facility-artwork.css` 只能通过 `FacilityIcon` 的 `data-facility-icon` 映射缩略图，并且只允许在上述主视觉上下文显示；未知 ID 沿用组件内厂房 SVG，`prefers-reduced-data` 下所有工厂场景恢复厂房 SVG。建筑集群选择卡、建筑从属资产详情、拍卖工厂主视觉统一加载 256px 运行时缩略图。建筑集群选择卡中的插画必须覆盖完整 `4:5` 竖卡；建筑从属资产详情使用桌面 `76px` 槽位承载 `68px` 插画，移动端使用 `64px` 槽位承载 `58px` 插画。所有工厂插画统一使用 `background-size: cover` 与居中定位等比裁切，不得拉伸、重复、偏移主体或叠加状态滤镜；建筑卡继续通过上下两层黑色渐变保护文字，建筑从属资产详情只在独立插画槽内展示图像，不得把图像铺到整行文字数据下方。运行、异常、停止、当前和悬停状态只能由边框、背景、文字、胶囊和数量表达，不得给插画本身着色。

新增或删除正式工厂时，服务器目录、同名源图、`FacilityIcon` ID 声明、CSS 映射和验证必须在同一变更中完成。`scripts/verify-facility-artwork.mjs` 必须校验目录一一对应、源图、缩略图、映射、生成入口、批准使用上下文、低流量回退、未知 ID 降级，以及 C1–C7 目录、覆盖复杂度与批准源图 SHA-256 基线一致。

## 6. 设计令牌、按钮与表单

- 基础视觉必须使用 `design-system.css` 中的颜色、文字、间距、圆角、阴影和控件高度令牌。
- 相同语义在所有页面使用相同颜色，颜色不能作为状态的唯一表达。
- 桌面卡片使用统一 `--radius-card`，移动主要卡片使用 `--radius-card-mobile`。
- 玩家端一级卡片外层内边距由 `primary-surfaces.css` 的 `--primary-surface-inset` 唯一控制：宽度大于 `720px` 时为 `var(--space-4)`（16px），不大于 `720px` 时为 `var(--space-3)`（12px），四边必须相同。
- 同一页面背景上、处于同一视觉平面的一级卡片必须共用同一语义内边距，不得按卡片类型、内容数量或自身宽度分别改变外层 `padding`；业务 CSS 只能调整卡片内部子区域。
- 业务操作使用 `Button` 的正式变体。
- 危险操作不得使用绿色主要按钮。
- 输入框、选择器、文本域、文件控件和组合输入统一使用 `FormControls.tsx` 与 `form-controls.css`。
- 除建筑页工厂紧凑开关的明确例外外，所有可点击控件在移动端至少提供 44px 的有效触控高度。
- 禁用状态使用原生 `disabled`。

### 6.1 统一表单控件

- `src/components/ui/FormControls.tsx` 负责标签、必填标记、说明、错误消息和 ARIA 关联；`src/styles/form-controls.css` 是表单视觉的最终权威，业务 CSS 只负责宽度、网格位置、行内／块级排列与明确的紧凑变体。
- 标准控件桌面最小高度为 `44px`，移动端为 `48px`；紧凑控件桌面可为 `36px`，移动端仍不得低于 `44px`。移动端输入字号不得低于 `16px`，避免聚焦时浏览器自动缩放。
- `aria-invalid="true"` 必须同时有错误文字；`readonly` 保持可选择和复制，`disabled` 使用原生禁用语义，两者视觉必须可区分。
- 选择器箭头、日期时间图标、文件选择按钮、自动填充、占位符、焦点、悬浮、错误、只读和禁用状态统一由 `form-controls.css` 实现。
- 所有可编辑正整数使用字符串草稿保存当前文本，允许用户暂时清空；合法值才同步到业务数值、参与预览或提交。不得在 `onChange` 中直接执行 `Number(event.target.value)`，不得把空白立即回填为 `0` 或 `1`。
- 正整数统一通过 `src/utils/integerDraft.ts` 的 `parseIntegerDraft` 和 `normalizeIntegerDraft` 解析；非法或越界时禁用操作，失焦恢复上一个合法值或收敛到范围，Escape 恢复上一个合法值。
- 整数输入始终拥有发生在自身命中区域内的滚轮事件：`IntegerInput` 必须在真实 `<input>` 节点上注册非被动原生 `wheel` 监听器，并在事件到达父级 `ScrollArea` 前同时调用 `preventDefault()` 与 `stopPropagation()`；可编辑输入按纵向滚轮方向以步长 1 增减并限制在 `min`／`max`，只读、禁用、横向滚轮和到达数值边界时仍消费事件但不改变值，页面不得跟随滚动。
- 金额输入默认不响应滚轮；只有业务显式传入正数 `wheelStep` 时，`MoneyInput` 才在真实输入节点注册非被动原生 `wheel` 监听器。输入框必须已经聚焦才消费纵向滚轮，并按“分”的整数步长限制在 `min`／`max`；未聚焦时必须放行滚轮，避免浏览页面时误改金额。
- 嵌入输入框的绝对定位操作按钮不得依赖 `transform` 完成基础居中；普通、悬停、按下、键盘焦点和禁用状态必须共享同一几何位置，状态变化不得造成按钮跳动。
- 精确输入永远不使用 K/M/B/T 紧凑格式。快捷数量按钮必须同时更新草稿和业务值。
- 登录邮箱和密码是自动填充例外：继续使用原生未受控值、稳定 `name` 和 `FormData`，不得绑定到初始为空的 React `value`。

## 7. 状态、表格、数据与窗口化

- 状态使用 `StatusTag`，必须同时包含文字。
- 普通小规模表格外层使用 `ScrollableTable`，窄屏允许横向滚动列。
- `.page-scroll` 继续承担页面主体滚动；高增长记录允许在面板内使用带明确高度的 `VirtualList` 视口。
- 虚拟记录视口必须可键盘聚焦，支持触控惯性滚动、稳定滚动条和 `overscan`。
- 虚拟列表纵向滚动到顶或到底后必须把后续滚动链交给外层 `.page-scroll`；仅横向越界允许使用 `overscroll-behavior-x: contain`，不得用双轴隔离吞掉滚轮、触控板或触控滚动。
- 虚拟表格使用 `role="table"`、`rowgroup`、`row`、`columnheader` 和 `cell` 保留表格语义。
- 窗口化不等于分页或截断：筛选、统计和数据保留仍针对完整数组执行。
- 可变高度卡片必须通过实际测量修正估算高度；不能因为高度估算误差造成条目重叠。
- 订单簿档位每行只显示方向、价格和合计剩余数量，不显示所有者；无障碍名称可以补充该档位包含的独立订单笔数。
- “紧凑数字”是全局固定显示规则，不再是客户端偏好；数量、普通货币与排名等只读业务数值对绝对值达到 1,000 的内容统一使用 K/M/B/T，不提供关闭入口或按设备分流。日期、时间、时长和百分比继续使用各自语义格式，可编辑数字输入始终显示并提交完整原值。
- 所有紧凑只读数值必须复用 `CompactNumber`／`CompactCurrency`／`CompactRank` 或 `CurrencyAmount`；鼠标悬停和键盘聚焦统一通过 `SafeTooltip` 的毛玻璃浮层显示完整分组数字。`formatCurrency` 继续保留普通货币两位精确格式，供输入、完整数字 Tooltip 和精度边界使用，紧凑化只改变只读呈现。资产配置圆环使用未舍入的精确比例绘制，三个可见整数百分比使用统一余数分配并严格合计为 100%；不得分别四舍五入后显示 99% 或 101%。

### 7.1 统一覆盖式滚动条

- `src/components/ui/ScrollArea.tsx` 是应用内覆盖式滚动区域的唯一共享组件，`src/hooks/useOverlayScrollbar.ts` 是尺寸、位置、拖动、轨道翻页、活动判断和双轴输入分派的唯一实现，`src/styles/scrollbars.css` 是滚动条视觉的唯一来源。
- 原生滚动容器继续负责可访问滚动、触控惯性与浏览器滚动链；原生滚动条视觉在 `ScrollArea` 视口内隐藏，项目轨道覆盖在内容上方且不占布局空间。
- 业务 `ScrollArea` 不得通过 `padding`、`margin` 或宽度计算预留 `--scrollbar-hit-size`；项目轨道必须覆盖在内容边缘，不得为轨道命中区制造永久空白。
- 全局统一令牌为视觉宽度 `6px`、轨道命中尺寸 `14px`、透明滑块触控目标 `44px`、通用边缘偏移 `2px`、最小滑块 `44px`、鼠标空闲延迟 `1200ms`、触控纵向空闲延迟 `1600ms`、淡入淡出 `120ms`。玩家页面纵向轨道和滑块是贴边例外，固定使用 `top/right/bottom: 0` 与右对齐滑块；横轴、其他纵轴、鼠标和触控不得定义第二套尺寸。
- 当前输入方式由最近一次有效输入动态决定：鼠标或触控板为 `mouse`，手指或笔为 `touch`，键盘为 `keyboard`；`pointer: coarse` 只决定首次默认值。混合输入设备必须在运行时切换，不得只按视口宽度判断。
- 鼠标模式下，横纵轨道在悬停、键盘聚焦、实际滚动、滑块拖动或轨道操作时显示；离开且空闲后隐藏。滑块必须使用 pointer capture，拖动写入通过 `requestAnimationFrame` 合并，指针离开轨道后仍连续工作。
- 触控模式下横向项目轨道始终 `display: none`，不得在横向滚动时闪现，也不得拦截内容。横向内容继续通过原生手指滑动、惯性与 `touch-action: pan-x pan-y` 操作。
- 触控模式下纵向轨道只在 `scrollTop` 实际变化后显示；显示期间允许触摸拖动滑块与点击轨道翻页，拖动或轨道操作期间不得隐藏，结束并空闲 `1600ms` 后淡出，隐藏时必须 `pointer-events: none`。
- `scrollbarVisibility="adaptive"` 是普通区域默认策略；`always` 只允许明确需要常驻轨道的管理工具使用，`hidden` 用于移动底栏等保留滚动但永久隐藏项目轨道的区域。触控模式隐藏横向轨道的规则高于 `always`。
- “活动”只由实际 `scrollLeft` 或 `scrollTop` 变化、滑块拖动或轨道操作产生；鼠标移动、触摸按下、点击、焦点、无法继续滚动的滚轮或边界手势本身不算活动。
- 普通滚轮和以 `deltaY` 为主的触控板输入优先垂直滚动；只有 `Shift + 滚轮`、明确以 `deltaX` 为主的触控板输入、水平滑块拖动或水平轨道点击才执行水平滚动。到达内部纵向边界后必须把滚动链交给外层，不得自动改成水平滚动。
- 同一滚轮事件经过嵌套视口时，最近且仍能沿当前方向滚动的后代视口拥有事件；祖先 `ScrollArea` 必须先检查事件目标到自身视口之间的原生或共享滚动容器，不得在后代尚未到边界时抢走滚动。
- 当前视口真正发生滚动时必须同时调用 `preventDefault()` 与 `stopPropagation()`；到顶、到底或该轴不可滚动时两者都不得调用，使事件继续交给祖先或浏览器。仅横向控件不得消费普通纵向滚轮。
- 双轴轨道同时存在时纵向轨道 `z-index` 更高，水平轨道在右侧避让纵向命中区，不绘制额外右下角块。触控模式隐藏横向轨道后不得留下空白或命中区域。
- 不得使用 `overscroll-behavior: contain` 阻断纵向滚动链；只有明确的横向视口可以使用 `overscroll-behavior-x: contain`，并保持 `overscroll-behavior-y: auto`。
- 玩家页面纵向轨道固定在 `.page-card-scroll-area` 的正文视口右边界并保持绝对定位，轨道和可见滑块都必须贴紧右边，顶部与底部同时贴紧正文视口；不得逃逸到工作区或屏幕边缘。管理员共享外层页面滚动区在移动端仍可使用安全区边缘轨道。轨道覆盖内容但不改变卡片宽度。
- 移动根级 Dialog 内与视口同宽的纵向轨道保持内容区内的绝对定位，但右侧安全边缘和滑块可见偏移必须与移动页面轨道一致；轨道与滑块几何只允许在 `scrollbars.css` 定义，业务 CSS 不得重写 `right`、`left`、宽度或颜色。
- 市场商品列表不得建立横向主滚动区，筛选栏和数据行必须按内容宽度降级；当前资产本地成交继续使用单一双轴原生视口，并且不得使用 `scroll-snap-type`、`scroll-snap-align` 或容器级 `scroll-behavior: smooth` 干扰数据单元格横滑。
- 本地成交记录必须使用单一双轴原生视口的 `VirtualRecordTable`；表头与虚拟数据共享同一个 `scrollLeft`，数据单元格本身必须能作为横向触控起点，不得恢复“外层横向 + 内层纵向”的正交嵌套视口。
- 滚动过程中不得用 React state 更新滑块位置；使用 ref、CSS transform、`requestAnimationFrame` 和 `ResizeObserver`。滑块保留 `role="scrollbar"`、方向和范围语义，支持拖动、轨道翻页与键盘控制。

### 7.2 滚轮事件归属与前端控件位置

本次滚动链审计确认以下纵向控件必须遵守“内部可滚动时由内部消费，边界后释放给外层”的同一规则：

- 全部玩家页面的正文视口：`PageLayout` 中的 `.page-card-scroll`；工作区外层 `.page-scroll` 不再滚动玩家正文。卡片正文只在没有更近的可滚动后代时消费。
- 概览页“当前挂单”卡：`OverviewPage.tsx` / `overview-polish.css` 的 `.overview-open-orders-list--scrollable`。
- 建筑页桌面“建设新工厂”卡：`BuildingsPage.tsx` / `industry-system.css` 的 `.production-build-card`；不得再使用会吞掉纵向边界的双轴 `overscroll-behavior: contain`。
- 排行页宽布局四张并排榜单卡与窄布局当前按钮选中的单张榜单卡：`LeaderboardPage.tsx` / `leaderboards.css` 的 `.leaderboard-list`。
- 市场页“我的订单与成交 → 本地成交记录”：`MarketPage.tsx` 的 `.local-trades-scroll-area` 单一双轴 `.virtual-record-table`。
- 管理员后台整页滚动区：`AdminApp.tsx` / `unified-market-admin.css` 的 `.admin-page-scroll`，以及其中的礼品码记录和兑换记录两类 `VirtualList`。
- 桌面侧栏导航：`SidebarFrame.tsx` 的 `.sidebar-nav`；其外层没有可滚动页面时，到边界仍不得人为阻止事件继续传播。

横向状态栏、表格横向视口和移动底栏不是纵向消费控件；未按下 `Shift` 且输入以 `deltaY` 为主时必须放行。所有新增固定高度、`overflow-y: auto|scroll` 或 `VirtualList` 控件都必须加入滚轮归属浏览器测试或复用已经覆盖的共享实现。

“我的未完成订单”列顺序固定为：

```text
资产｜方向｜价格｜剩余/原始｜状态｜时间｜操作
```

方向列固定 `60px`，操作列固定 `76px` 并使用 `position: sticky; right: 0`；撤单按钮必须始终位于横向滚动视口右侧，空状态 `colSpan` 为 `7`，不得恢复独立“类型”列。

“本地成交记录”列顺序固定为：

```text
资产｜方向｜数量｜价格｜总额｜手续费/实收｜时间
```

`TradeRecord.type` 只用于内部图标与类型判断；资产列不得再显示“买入／卖出”前缀，方向只由 `TradeRecord.side` 和方向列表达。本地成交使用单一双轴 `VirtualRecordTable`，表头和内容共享同一个横向位置；触控模式隐藏横向轨道但保留从任意数据单元格开始的原生横滑，纵向轨道在活动后显示并允许触摸操作。

## 8. 统一资产市场

- 商品和工厂使用同一资产标签和下单区域。
- 订单簿为单列 5+5 价格档位；同资产、同方向、同价格的有效订单只累加当前剩余数量。
- 必须聚合完成后再截取最优 5 档；卖盘将选出的档位反向显示，使最低卖价靠近中线。
- 档位行只显示方向、价格和合计剩余数量；无障碍名称补充独立订单笔数，不显示所有者。
- 价格档位只属于匿名公共盘口；我的订单、逐单撤销、服务器撮合、逐笔成交和单张卖单手续费保持独立。
- 一级市场采用“商品目录 → 商品全局详情 → 地区商品详情”，地区州上下文采用“地区商品目录 → 地区商品详情”；两条路径最终都复用同一个地区商品详情、订单簿、下单和自动交易实现。一级市场不显示独立地区市场面板，地区目录不提供“市场行情／自动交易”工作区、四张目录汇总统计卡或商品列表外层一级卡片；工厂资产交易只从建筑详情打开从属交易视图。全局与地区市场筛选均使用原生 disclosure，默认折叠且不提供商品名称搜索框。
- 买入使用成功色，卖出使用危险色，但方向必须有文字。
- `MarketCommodityRow` 是商品全局详情地区行和地区市场目录的唯一共享商品数据行。共享列表固定使用独立表头“商品｜卖单量｜买单量｜市场价｜24h｜箭头”，数据行固定为“商品身份｜卖单量值｜买单量值｜市场价值｜24h 值｜右向 Chevron”且不重复字段名，不显示挂单差额、基准偏离或挂单状态；这些分析指标只在具体地区商品详情保留。桌面身份槽使用 `42px`、商品插画 `34px`；不大于 620px 时收紧为 `34px / 29px`，极窄屏继续缩小。移动端仍保持单行，不得恢复两列／多行摘要卡、隐藏四项核心指标或产生横向主滚动。列表行使用 `var(--radius-control)`、统一边框和共享交互表面；桌面鼠标悬停不得位移。商品详情头部继续复用对应主视觉；建筑从属交易详情调用按正式 ID 映射的 `FacilityIcon` 并保持居中 `cover`。

### 8.1 美国本土州级经营地图

- 地图由 `StrategicWorkspace` 内唯一 `UsMainlandMap` 持有，不再使用 ECharts Geo/Map。精确使用 `us-atlas@3.0.1` 与 `topojson-client@3.1.0` 把州 TopoJSON 转为连续 48 州几何，不显示阿拉斯加、夏威夷、华盛顿特区或海外领地附图。地图在模块初始化时建立固定投影比例的静态 SVG 世界面；48 个州面 path 必须始终完整挂载，州面 path 的 `d` 在缩放和平移期间保持不变，不得按当前物理视口裁掉屏外州或在手势期间重新生成路径。根 `.application-map-layer` 仍只负责最终物理视口裁剪；州面放大后可以离开屏幕，但缩小时必须仅凭同一世界面的相机变换在手势 active 阶段立即重新进入。
- 桌面与移动默认镜头均为完整美国本土轮廓的等比 Contain 视图，保持固定投影比例与少量安全边距；用户缩放固定为 `0.5～4`。单一合成相机状态是相对于默认世界面的 `x / y / zoom`，缩放焦点围绕指针或双指中点计算，单指／鼠标拖动修改平移。滚轮使用非被动监听器阻止页面滚动并归一化 `deltaMode`；移动双指使用两个真实 Pointer 的距离和中点。鼠标双击或触摸双触地图空白把相机恢复为 `0 / 0 / 1`，州面上的双击／双触不得重置。
- 地图高频交互只允许单一合成相机：州面和州名共同位于 `.province-map-camera-surface` 下的同一个 SVG 世界坐标系，每个动画帧最多写一次该 HTML 合成层的 `translate3d(...) scale(...)`。缩放／平移帧不得调用 ECharts、`setOption`、`dispatchAction`、ZRender、重新投影州界、修改州面 path 的 `d`、重新测量字体或重新布局州名。连续输入在同一浏览器帧内必须合并成一次 transform 写入；`will-change: transform` 只允许在交互 active 期间动态开启，停止输入后立即清除。选择州、切换镜头和普通状态刷新只能更新填充／描边／选中属性，不得重置或重建相机。
- 中文州全名和州面直接处于同一个 SVG 世界坐标系，不维护第二套标签相机、参考点同步矩阵或 `georoam` 跟随逻辑，因此任何相机 transform 天然同时作用于州界和名称。标签布局只在首次创建、字体准备完成或真实容器尺寸变化时允许执行；布局先依据静态投影后的州多边形求州内几何主轴与可读方向，沿主轴扫描完整位于州面的文字走廊，再使用实际字体固定字重的自然宽度、自然高度与自然长宽比等比求字号。每个汉字必须作为独立刚性 SVG `text`，只做 `translate + rotate`；不得通过 `textLength`、`lengthAdjust="spacingAndGlyphs"`、`scaleX`、`scaleY` 或其他非等比方式拉伸字形。逐字包围盒必须完整位于州面内部；标签 `pointer-events: none`，不得阻塞州面点击、拖动或 Tooltip。
- 移动双指从州面、州界附近或地图空白起手必须等价。相机输入层在容器捕获阶段同时跟踪 Pointer 与 Touch 生命周期；一旦本轮出现两个及以上触点，从多点手势开始到最后触点释放后的 `420ms` 内，必须抑制合成 click、州面选择和空白双触重置。该窗口只负责输入仲裁，不得驱动、回滚或复制相机；窗口结束后的正常单指点击必须立即恢复。防回退必须记录多点序列数、当前触点数和被抑制 click 数，使真浏览器 CDP 双触可以验证州面内起手也不会误打开地区页。
- 战略地图州面交互固定采用“镜头底色 + 中性轮廓”分层，视觉强度固定为“选中悬浮 > 选中 > 普通悬浮 > 默认”。每个州的基础 `areaColor` 继续由政治／资产／工业／市场／异常镜头和未解锁状态决定；普通悬浮、选中及选中后继续悬浮都必须原样保留该底色。桌面普通悬浮只使用 `--color-text-secondary` 的 `1.5px` 中性亮边且无辉光；选中使用 `--color-text-primary` 的 `2.5px` 亮边与低强度 `5px` 辉光；选中悬浮使用 `3px` 亮边与 `7px` 辉光。未解锁州始终保持灰显底色，悬浮其他州不得清除选中州。上述视觉只允许在同一静态 SVG path 上通过原生 `:hover`、`:focus-visible` 和外部 `data-selected` 表达，不得恢复第二张地图、第二套州面 SVG、ECharts `emphasis/select`、pointermove 驱动的 React 高频视觉状态或交互时 `setOption`；州名选中只更新既有 `data-selected`，不得重排标签或修改相机。
- 地区默认、当前、资产、工业、市场和异常语义继续使用区域填充、边界、文字、Tooltip 和五种镜头共同表达；默认州面、未解锁州面、州界与州名分别读取 `--color-map-region-default`、`--color-map-region-locked`、`--color-map-region-border` 与 `--color-map-label`。当前地区由外部 `selectedProvinceId` 驱动 path 与标签选中属性；镜头状态只属于 `GameShell` 客户端视觉上下文，不写入服务器或更换地区。每个州面保留鼠标、触摸和键盘激活；单击后设置经营州并打开隐藏 `province` 上下文页。离开州级页立即清除地图视觉高亮，但保留经营州供后续业务写操作使用。
- 桌面 Tooltip 继续使用 `.ui-tooltip-surface` 的统一毛玻璃材质，并显示本地库存、工厂、运行中与本地挂单；未解锁州明确标注“未解锁”。不大于 `720px` 时地图 Tooltip 必须禁用并隐藏，触摸州面直接打开州级上下文页。地图容器继续提供“美国本土州级经营地图”可访问名称与可读摘要。`MapPage` 只保留透明路由占位；市场、建筑和其他业务页面不得恢复地区下拉框、第二张地图或平行选择状态。
- 性能回归必须验证实际热路径：缩放／平移前后的 48 条 path `d` 与州名基础 glyph transform 保持不变；州面和州名都能追溯到同一个 `.province-map-camera-surface`；同一任务内的多次滚轮输入在下一绘制帧只增加一次 camera write；放大使外围州离开屏幕后，缩小且 `data-map-zoom-active="true"` 时外围州已经重新进入且州名中心仍命中对应 path。不得用最终 settle 后才恢复、隐藏屏外州、永久 `will-change`、第二套相机或 ECharts Map 规避检查。
- 玩家端仍采用大战略游戏式常驻地图工作台：图片层 `0`、氛围层 `10`、地图层 `20`、UI 层 `30`，`.application-map-layer` 通过同一个 Portal 持有唯一 `StrategicMapStage` 和 `StrategicMapLensBar`。业务页面和通知仍位于更高 UI 层；不大于 `720px` 时镜头栏隐藏。地图数据只用于游戏经营地区视觉，不用于现实测绘、导航或法律边界声明；既有 34 个地区 ID 与新增 14 个州 ID 必须继续稳定对应现有资产。
- 外壳页面模式继续保持既有职责：概览、州级上下文、市场、建筑、设置使用 `building` 左侧毛玻璃面板；研发、拍卖、合同、银行、排行榜、商店使用 `fullscreen` 占满可用区域。为保证根层毛玻璃开放采样和静态地图合成相机不被额外 stacking context 截断，`.application-map-layer`、`.application-ui-layer` 与 `.workspace-strategic-chrome` 必须保持 `isolation:auto`；不得恢复隔离层。

## 9. 目录型横向导航

商品和工厂标签必须根据服务器目录动态生成：

- 使用可滚动横向区域或自适应自动列；
- 不得使用固定项目数量的 `repeat(6, ...)`；
- 不得在 JSX 中硬编码 6 个商品或工厂；
- 新商品和工厂应在不修改页面结构的情况下自动出现；
- 空目录必须显示明确空状态；
- 标签文本过长时保持可访问名称，不得让页面整体横向溢出。

## 10. 概览布局

- 概览采用“经营决策优先”层级，标题区不显示页面业务按钮；生产异常、主动停工和本人未完成挂单全部进入统一通知待处理，不在概览恢复第二套提醒。
- “今日经营”与基础工作入口永久移除。概览正文位于 `building` 面板，只包含签到和三张经营摘要；公开经济事件由 `StrategicWorkspaceChrome` 在页面外的屏幕右栏纵向滚动，绝不回落到概览正文。桌面教程位于该右栏顶部；移动端右栏隐藏并只保留概览移动教程入口。
- 公开事件面板标题不显示说明段落和右侧胶囊。事件折叠态只显示事件名称与距离开始时间；原生可访问展开后才显示状态、时间范围、说明、重点类别／商品、预算边界和已结束事件反馈。
- 签到日历固定为周一至周日七格，已签、今日、漏签和未来日期均保留完整文字；宽卡七列展示，移动端仍优先保持七列紧凑布局，不通过隐藏星期或奖励信息规避空间。
- 签到卡顶部展示每日 1 宝石和每周全勤额外 5 宝石，底部只保留一个签到按钮。已签到时按钮禁用，全勤完成时明确显示奖励已领取；注册所在不完整周说明下周起参与全勤。
- 主列第二排固定为生产摘要、资产构成和当前挂单。主列内容宽度大于 `1050px` 时三列同排并统一约 `320px` 高；不足时改为两列且挂单卡跨两列；不大于 `580px` 时全部单列并恢复自然高度。
- 资产构成不得重复状态栏中的总资产或排名；只展示现金、商品估值、工厂估值、冻结资金和当前浏览器资金变化。当前挂单列表在卡片内部滚动，概览不提供撤单按钮。
- `1920×1080` 与 `1440×900` 下建筑面板和独立事件右栏必须同时可见且互不相交；事件内部滚动不得增加概览页面高度。
- 商品挂单继续使用 `ProductIconLabel`，工厂挂单使用 `FactoryIcon`；买卖、涨跌和异常必须同时使用文字、符号和状态色。

## 11. 生产与仓库布局

- 州级上下文页的仓库分区只呈现当前州只读库存，不承载自动交易或库存管理表单。
- 仓库只显示可用或冻结数量大于零的商品，不显示筛选按钮或全部商品视图。
- “仓库内容”标题不显示商品种类统计说明。
- 仓库商品卡直接使用 `ProductIcon`，固定采用“左上名称／居中大图标／可用主值／冻结辅助值”的图标主导结构；不得显示独立库存总量行。
- 商品名称使用次级文字色并固定在左上角，商品图标必须成为卡片第一视觉元素；“可用 N”沿用库存主值字号，“冻结 N”沿用辅助文字字号，冻结为零时仍显示。
- 仓库商品网格使用容器查询。仓库商品网格的列数、容器断点、卡片高度、内边距和图标尺寸唯一归属 `WAREHOUSE_EXPANSION_DESIGN.md` 第 7.2 节；本文件只保留通用视觉与组件边界，不维护第二套几何数值。
- 建设新工厂卡桌面独占 `280px–320px` 左列并使用 `position: sticky`；低于 960px 恢复普通文档流。
- 建设卡只显示工厂类型、配方名称、建造数量、建造现金和逐项材料需求；不显示施工时间、生产周期、单座周期产量或单座周期成本。
- 建筑管理区使用建设卡、可筛选建筑列表和单张当前建筑详情的主从布局；桌面和平板不得同时铺开全部完整工厂卡，移动端完整详情只在底部悬浮框中渲染。具体断点和 Overlay 行为以 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准。
- 工厂集群选择卡统一为最大宽度 `160px`、`4:5` 竖卡；按 `facilityTypeId` 映射的 `FacilityIcon` 场景插画等比居中裁切并铺满整卡，在插画上叠加上下两层黑色渐变，中央主体区域保持透明，确保标签可读但不遮蔽工厂主体。名称固定左上、总数量纯数字固定右下。右上角只显示与详情同源的单厂有效平均利润数字：盈利为绿色且不加正号，亏损为红色、显示绝对值且不显示负号，零值为中性色，缺价为中性色 `—`；不得出现货币图标、货币符号、标签、单位或胶囊。运行中／异常／已停止分别由绿色／红色／灰色边框、轻量背景和数量表达，不得给插画着色。卡片点击不保留选中态，不使用 `aria-pressed`；移动端固定三列且极窄屏不降列。无障碍名称必须同时包含利润盈亏语义、完整状态和异常原因。不得恢复“盈利为绿色且不加正号，亏损为红色且保留负号”的旧规则。
- 建筑概况、建设新工厂、工厂集群选择器和桌面当前工厂详情都是建筑页同一一级平面的 `Panel`，统一带 `.production-surface`；它们通过 `primary-surfaces.css` 读取同一个 `--primary-surface-inset`，大于 `720px` 时四边统一为 `16px`，不大于 `720px` 时四边统一为 `12px`。共享仓库只位于州级上下文页仓库分区，自动交易只位于市场。
- 一级卡片标题元素盒子的左上锚点必须一致；右侧等级标签或 `SwitchControl` 不得改变标题位置。容器查询只允许调整卡片内部密度和换行，不得改变一级外层内边距。
- 当前工厂详情使用唯一 `FacilityClusterInformation` 合并名称、`4:5` 纵向场景插画、总数量、唯一状态胶囊、`SwitchControl`、运行中／冻结中／抵押中数量明细与单厂平均利润；移动固定头部不得继续承载名称、状态或开关。
- 数量摘要位于工厂信息区内部，固定为“运行中／冻结中／抵押中”三列；总数量只在主信息中显示一次，不得重新拼入标题。
- 移动详情悬浮框不显示顶部关闭按钮；共享固定头部只保留拖动把手，完整工厂信息通过 `MobileDetailSummary` 作为正文 `ScrollArea` 的第一个区块。对话框容器承担初始焦点，点击透明 backdrop、按 `Escape` 和有效向下拖动共用向下收起流程，关闭后焦点返回触发卡。移动详情复用 `SignedInShell` 唯一根级 `.workspace-dialog-layer`，但实体 Sheet 顶边必须始终低于移动状态栏；状态栏不被 Sheet 截获。根 Sheet 存在期间底部导航保持同一 DOM 但隐藏、`aria-hidden`、`inert` 且不可命中；完整根 Sheet 关闭到地图后才恢复。Bottom Sheet 必须在首次可见绘制前通过 `useLayoutEffect` 完成页面滚动锁定、稳定视觉视口高度快照和 `focus({ preventScroll: true })`；打开后不得继续读取动态 `dvh` 改变高度。
- 当前工厂详情顺序固定为“移动把手（桌面无）→ 工厂信息 → 满员率 → 生产设置 → 生产结算 → 经营诊断 → 市场入口”。仅工厂信息内部允许纵向插画与主信息两列；其余区块必须按 DOM 自上而下排列。满员率使用无独立圆角和背景的状态带，只显示百分比、方向和进度条。
- 玩家可见的“生产产物”与“作业制度”固定使用同一个“生产设置”区和共享 `RichSelectInput` 的 `production-config` 生产方案槽；桌面和移动详情都固定同一行 Auto 槽横排，移动端在 `320px` 及以上不得换行。两个字段均按自身 Desired Size 从左向右连续排列，第二项紧跟第一项并只由统一 `gap` 分隔，不得使用两等分 `1fr`、百分比或 `flex-grow` 制造 Fill 槽。两个收起触发按钮固定为正方形并按内容宽度布局，只显示当前产物／作业制度图片，不显示名称、参数摘要或下拉箭头，图片本身不得带独立黑色底板或图片槽边框；字段和触发按钮命中区域都不得扩展到父容器剩余空间；展开菜单才显示候选名称、结构化投入／产出、周期／成本信息，作业制度候选还必须相对当前方案标示周期、成本与产量变化。不得恢复收起态文字详情、箭头、Fill 轨道、字段／按钮全宽拉伸、剩余空白命中或作业制度说明。
- 工厂生产公式固定采用双列顶层布局：左侧为输入组合区，右侧为输出区；输入与输出物资槽顶部对齐。时间与成本位于双列物资区下方的同一条操作数据带，中间使用竖向分隔线；多输入或多输出内部允许换行，时间与成本不得回到输入输出之间的独立中列。公式、操作数据带和进度共同组成“生产结算”；生产进度位于数据带下方，并且是生产结算最后一个可见元素；单厂平均利润只属于工厂信息区。
- 输入和输出项目统一使用“商品图片、生产数量、仓库 Icon、当前可用库存”的单行结构；多项物资只通过独立物资槽与间距分隔，不显示 `+` 或其他连接字符。输入与输出均显示当前可用库存，输出库存不得改成预计入库后的预测值。商品位置只能调用 `ProductArtwork` 加载 128px PNG，不得渲染 `ProductIcon` SVG；仓库等功能语义继续使用统一功能 Icon，不得在生产详情中手写 SVG 标记。
- 生产结算中的每个投入／产出物资槽整体使用原生按钮语义并可直接打开对应商品市场；点击目标覆盖完整物资槽，继续只显示商品图片、生产数量、仓库 Icon 与当前可用库存，不新增“查看市场”、箭头或外链 Icon。按钮必须复用 `data-ui-interactive="surface"` 的统一 hover／active／`:focus-visible` 反馈，并提供包含商品名、生产数量和库存的 `aria-label`；不得把承载可交互物资槽的 `.facility-formula-visual` 整体设为 `aria-hidden`。
- 从生产结算商品物资槽进入市场必须复用统一市场资产选择语义，以 `commodity + productId` 打开对应商品；不得根据生产配方语义自动推断采购／出售方向，数量和价格继续按统一市场资产切换的订单草稿初始化规则处理，不得自动提交订单，也不得改写建筑页建设工厂类型、数量、配方、作业制度或任何服务器权威生产状态。
- 生产结算操作数据带只显示时间 Icon、周期数值、成本 Icon 和集群成本数值，不显示可见的“周期”或“运行成本”标签；时间和成本固定在同一行，中间使用 `border-left` 形成竖向分隔线。操作数据带使用 `width: fit-content`、`max-width: 100%` 与左对齐，移动端不得拉伸为全宽，也不得恢复上下两行或横向分隔符。生产结算内部布局只能由 `facility-production-formula.css` 定义，工厂主从布局样式不得写入生产公式的 `grid-area` 或专属容器查询。
- 生产进度条横向铺满公式容器并作为输入到输出的唯一连接视觉；运行、停止和异常状态都保留同一进度轨道。进度填充允许使用内置方向端帽和低强度高光，但不得新增独立箭头元素或第二条连接线。
- 生产进度条是生产公式容器最后一个可见元素；集群范围标识位于公式内容上方，进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字。
- 窄容器允许输入与输出物资槽在各自列内换行；操作数据带保持内容宽度并可在自身内部收缩，顶层仍保持输入侧／输出双列，不得造成页面横向滚动。
- 生产公式必须提供完整文本无障碍描述，说明公式范围、集群输入、集群输出、配方周期、集群成本和当前进度，不能只依赖图标。
- 所有工厂统一显示“生产配方”选择器；多配方工厂可选择，单配方工厂显示唯一选项并保持启用，但重复选择不得提交动作。运行中切换时显示“立即切换为：配方名称”。
- 卡片内部只允许一个弹性空白区，位于生产内容与资产交易入口之间；入口固定在卡片底部，固定使用“交易该建筑资产”文本与右向无横杆 Chevron。
- 不得显示生产模式、目标产量、计划自动保存或保存计划控件。

## 12. 银行页面布局

银行页必须使用 `PageLayout` 和 `PagePanel`，一级顺序固定为资产总览、存款账户与存款利息双列、工厂抵押贷款、银行记录。`src/styles/asset-overview.css` 只负责资产总览内部几何，`src/styles/bank.css` 只负责存款余额条、业务网格、紧凑工厂表格、抵押胶囊、还款行和响应式折叠；不得恢复独立资产页或页面顶部五张重复指标卡。输入、按钮、开关、状态标签、数据行、货币图标、一级面板外层内边距、hover 和焦点继续由共享设计系统收束。

银行总览桌面五列，宽度不足时按三列、两列逐级折叠；不得通过横向滚动保留五列。存款账户与存款利息在宽屏两列、窄屏单列。工厂抵押表格允许横向滚动以保留“工厂／总持有／交易冻结／已抵押／可抵押／审慎单价／本次抵押”完整列，首列保持可读最小宽度；移动端不得把同一工厂拆成多张重复卡片。抵押数量使用带 `.ui-control` 的紧凑原生整数输入，仍必须遵守统一表单字号、触控尺寸、错误状态和字符串草稿规则。

贷款评估在桌面使用“评估依据／申请表单”双列，移动端单列；所有加减项必须同时显示文字和正负数值，颜色不能作为唯一依据。当前贷款摘要在宽屏四列，抵押明细使用工厂图标与数量胶囊；自动还款复用 `ToggleField`，不得创建银行专属开关。银行记录使用单张一级面板内的分隔记录行，不得每条记录创建独立玻璃卡片。

结息和贷款倒计时复用共享 `useNow`、`formatDuration` 与服务器单调时钟。倒计时到零时显示等待服务器确认，不改变按钮以外的权威余额。存款利率只显示日收益率，不显示夸大的年化值；微单位余数不作为普通货币金额渲染。银行图标必须复用 `GameIcons.tsx` 的 `BankIcon`，不得使用 Emoji、文本字符或外部图片。

## 13. 导航颜色与不透明度

桌面侧栏和移动底栏的图标、文字都必须保持 `opacity: 1`：

- 未选中状态使用完全不透明的 `var(--color-text-muted)` 灰色；
- 选中文字使用完全不透明的 `var(--color-text-primary)`；
- 选中图标使用完全不透明的 `var(--color-success)`；
- 图标继承按钮颜色，不得为未选中图标另设半透明 RGBA；
- 背景、边框和玻璃材质仍可使用透明度；
- hover、focus、active 不得降低图标或文字透明度。
- 桌面侧栏不得提供显式展开或折叠按钮；游戏与管理员后台复用同一侧栏框架，在 `224px`／`78px` 间以约 `200ms` 过渡。鼠标悬浮或键盘焦点进入侧栏时自动展开，鼠标移出或焦点离开侧栏时自动收起。`721px–960px` 与宽屏使用完全相同的宽度、四边统一 `14px` 内边距、三列导航和 `48px` 图标轨道；导航视口不得再叠加顶部外边距，不得隐藏展开态文字或偏移图标。桌面侧栏按钮不渲染数字角标。细指针桌面 hover 显示背景、边界和左侧绿色提示，但按钮几何不移动；移动底栏不得显示 hover 反馈，只保留未选中、按下、选中和键盘焦点状态。
- 桌面侧栏导航网格必须从顶部开始排列，使用固有内容行高；`.sidebar-nav` 固定为 `align-content: start` 与 `grid-auto-rows: max-content`。共享纵向 `ScrollArea` 可以占满剩余高度，但不得把玩家九个主导航按钮或管理员导航平均拉伸到整列高度。
- 移动底栏导航角标使用 `.navigation-badge`，颜色固定沿用 `var(--color-success)` 背景和 `var(--color-on-primary)` 文字。每个页面最多一个合并数字，只显示 `1`～`99` 或 `99+`；桌面侧栏不渲染角标，但必须在按钮 `aria-label` 中保留完整数量和来源。移动角标固定在按钮内部右上角，不得裁剪数字。根 Sheet 存在时整条移动底栏保持同一 DOM，但由外壳统一隐藏并设为 `aria-hidden`／`inert`；根 Sheet 完整收起到 `map` 后才恢复并播放一次通知岛同系弹性返回动画，`prefers-reduced-motion` 下无位移动画。

## 14. 设置页布局

- 设置页在所有宽度下固定使用单一纵向内容栈，顺序固定为“玩家资料／游戏设置／账号与管理”；三张设置卡直接由 `.settings-layout` 依次排列并按自然内容高度堆叠，不得恢复桌面双列、共享三列网格、跨列卡片或列包装器。
- 页面外层固定为单个 `minmax(0, 1fr)` 网格轨道，不设置桌面专用双列比例或 `1180px` 降列断点；不同卡片之间只使用 `var(--layout-gutter)`，不得用 `display: contents` 与 `order` 补丁重排。
- 玩家累计统计在宽布局中使用四列，`760px` 以下降为两列；统计块外观继续复用现有 `.player-stat-grid`，不得创建另一套统计卡视觉。
- 昵称编辑在桌面使用输入框和自然宽度“保存昵称”按钮同行；`760px` 以下改为单列且按钮占满可用宽度。
- 商店桌面在余额摘要下使用两个独立纵向栈：主列依次为邀请好友与兑换记录，侧列依次为兑换货币与礼品码兑换；不超过 `960px` 时固定按余额、兑换货币、礼品码兑换、邀请、记录排序。邀请卡与礼品码兑换不得在设置页重复出现。
- “账号与管理”卡不得提供跳转主页修改账号资料的入口；管理员工具、存档管理和当前会话必须明确分组。管理员工具只对管理员显示；存档管理使用共享 `danger` 按钮、不可撤销状态标签和服务器阻止事项列表，但不得额外创建“危险区域”标题或复制按钮基础视觉。
- 设置页专用布局只允许在 `src/styles/settings.css` 维护；按钮、面板和开关由共享组件与 `design-system.css` 提供，输入、选择器、文本域和焦点由 `FormControls.tsx` 与 `form-controls.css` 提供，不得在设置样式中复制基础视觉。

## 15. 中文、品牌、响应式与安全区

- 玩家可见界面统一使用中文，不允许固定文案中英文夹杂。
- 技术枚举必须转换为中文。
- 时间使用秒、分钟、小时。
- 玩家状态栏身份轨道第一行固定为“金融帝国”，第二行显示玩家用户名；宽屏显示完整文字，紧凑桌面和移动端保留同一 Logo 身份槽但可隐藏文字以保证五项状态数据可读。
- 正式导航名称固定为“概览｜市场｜建筑｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置”。资产总览唯一归属银行，不得恢复独立资产导航。
- 建筑页 `PageLayout` 主标题固定为“{州级地区全称}建筑”，路由 ID 固定为 `buildings`；建设卡和工厂类型业务名称继续使用“工厂”。
- 普通玩家页面的 `.page-card-scroll` 是页面主体纵向滚动容器；外层 `.page-scroll` 不滚动玩家正文。研发页使用 `.page-card-static` 固定工作区且页面自身不滚动；窗口化记录视口只负责对应高增长列表。
- 移动状态栏和底栏必须使用 `safe-area-inset-*`。
- 移动底部导航允许横向滚动，首尾保留完整空白。
- 移动端与桌面端使用同一固定紧凑数量规则，不得按视口建立第二套开关或默认值。
- 活动导航按钮和图标不得位移、缩放或改变几何尺寸。
- 移动端业务页面进入唯一根级 Mobile Workspace Sheet 后不再为已隐藏的底部导航预留外层空间；底栏仍保持同一 DOM 但在根 Sheet 存在期间不可见、`aria-hidden`、`inert` 且不可命中。最后一张卡必须能在 Sheet 自身正文滚动区内完整滚到可见位置，并尊重根 Sheet 与安全区内边距。
- 移动登录页面通过 `100dvh` 和矮屏媒体查询适配软键盘。
- 登录按钮在普通与“正在连接账号服务…”状态下保持至少 48px 高度和单行文案；表单使用 `aria-busy` 表达提交状态。
- 输入、按钮焦点和提交中的原生 `disabled` 状态不得改变标题字号、区块间距或整体对齐。
- 登录表单中的账号和密码必须保留原生未受控表单值，并使用稳定的 `name="email"` 与 `name="password"`；提交时通过 `FormData(event.currentTarget)` 读取浏览器自动填充内容。
- 不得把账号或密码重新绑定到初始为空的 React `value` 状态。

## 16. 防回退

- 银行页面不得绕过 `PageLayout`、`PagePanel`、`IntegerInput`、`.ui-control`、`ToggleField`、`CurrencyAmount` 或共享交互状态；
- 不得把工厂抵押评估改为移动端逐工厂独立一级卡片、隐藏审慎价格／可抵押数量，或只用颜色表达额度加减项；
- 不得显示年化存款收益率、把微单位余数显示为可用货币，或用浏览器墙上时间直接结息和判定违约；
不得：

- 在业务页面复制基础控件视觉；
- 为 `SafeTooltip` 或 ECharts `commonTooltip` 恢复近不透明独立背景、移除 `.ui-tooltip-surface`、给 Tooltip 套 `FrostedGlassSurface`／额外玻璃 DOM，或在 `safe-floating.css`、`charts.css` 与业务 CSS 中复制 Tooltip 毛玻璃材质；
- 绕过 `FormControls.tsx` 为普通表单新增平行输入组件，或把 `form-controls.css` 移到 `design-system.css` 之前；
- 在业务页面直接渲染可见原生 `<select>`、恢复浏览器原生选项弹层，或绕过共享 `SelectInput`／`RichSelectInput` 自建第二套下拉框；
- 把生产产物／作业制度收起态恢复为“图标 + 名称／参数／箭头”、恢复图片黑色底板或图片槽边框、恢复两等分 `1fr`／百分比／`flex-grow` Fill 轨道、恢复字段或按钮全宽拉伸、让父容器剩余空白成为下拉命中区域、改回默认普通下拉、删除 `production-config` 生产方案槽、把方案菜单重新限制为正方形触发按钮宽度，或在业务组件复制第二套 Popover、键盘导航、焦点返回、Portal 或刷新状态；
- 删除生产配置候选的投入／产出／周期／周期成本信息，删除作业制度相对当前方案的周期／成本／产量变化，或恢复作业制度说明段落；
- 在正整数输入的 `onChange` 中恢复 `Number(event.target.value)`、把空白立即改成 `0`／`1`，或绕过统一字符串草稿解析；
- 删除整数输入的非被动原生滚轮监听、让滚轮事件到达父级 `ScrollArea`，或在数值到达 `min`／`max` 时把滚轮释放给页面；
- 把移动端标准输入高度降到 `48px` 以下、紧凑输入降到 `44px` 以下，或把移动端输入字号降到 `16px` 以下；
- 在页面 CSS 中重新定义输入背景、边框、圆角、焦点、错误、只读、禁用、自动填充或文件选择器基础视觉；
- 恢复英文眉题；
- 把地图州名恢复为英文州缩写、ECharts 默认标签、固定屏幕字号、州外／引线标签，或让中文州全名标签不再完整落在州面内部、不随地图缩放和平移同步重算；
- 把地图缩放恢复为 ECharts 根 SVG／州名根 SVG 的 CSS 矩阵缩放、恢复 settle 后 `layoutSize + layoutCenter` 二次提交或维护第二套持久相机；交互缩放必须在动画帧内通过同一 ECharts Map 的增量 `geoRoam` 推进正式相机，且动画帧不得调用 `setOption`、重新投影／重排 48 州标签；
- 把匿名公共订单簿恢复为同价订单逐笔重复行、在聚合前先截取五笔，或使用原始 `quantity` 代替当前 `remaining`；
- 合并我的订单、撤单入口、逐笔成交或手续费，或把客户端价格档位保存为服务器订单；
- 恢复 `records` 导航；
- 新增平行开关；
- 在导航或状态栏中恢复 Unicode 字符、Emoji 或字体符号图标；
- 绕过 `GameIcons.tsx` 新增平行界面图标库；
- 在玩家端或管理员端恢复字符货币符号、为不同页面创建平行货币图标，或绕过 `CurrencyAmount`／`CurrencyText`；
- 删除当前商品显式图标、未知商品包装箱回退或 `ProductIconLabel`；
- 让工厂标签恢复齿轮、`⚙` 或与机械商品相同的 SVG 路径；
- 把建筑从属资产详情插画缩回 `72 × 72px`／`56 × 56px` 居中小图、改用拉伸／`contain`／非居中裁切、删除满幅覆盖或上下可读性渐变；
- 让导航图标或文字恢复半透明；
- 恢复概览全部商品快捷切换条、概览本地成交面板或商品选择后自动跳转市场；
- 恢复“今日经营”、基础工作或概览独立经营提醒，把公开事件日志重新放入概览正文，或删除摘要三列到两列／单列的响应式规则；
- 恢复仓库商品筛选、全部商品视图、商品种类统计说明、独立库存总量行或银行资产总览逐商品库存与估值卡；
- 绕过 `WAREHOUSE_EXPANSION_DESIGN.md` 第 7.1 节，在通用 UI 文档或其他样式文件维护第二套仓库网格列数、容器断点、卡片高度、内边距或图标尺寸；
- 把仓库商品名称移出左上角、把商品图标恢复为名称旁的小图标、取消居中大图标主体结构或删除权威仓库设计规定的窄容器紧凑密度；
- 把建设卡恢复为桌面独占整行，或恢复生产周期、单座产量和单座成本；
- 让建筑概况、建设新工厂和工厂集群在同一断点使用不同一级外层内边距；
- 在业务页面 CSS 中重新声明一级卡片外层 padding、创建页面专属一级卡片内边距变量，或绕过 `PagePanel` 新增玩家端一级卡片；
- 恢复同时铺开全部完整工厂卡、四列完整详情网格或瀑布流，或让市场入口离开详情底部；
- 把完整状态从工厂名称下方移回独立右侧操作区、把开关移出标题区，或把三项数量摘要改为纵向排列；
- 恢复移动详情顶部关闭按钮、让对话框没有明确初始焦点，或让点击 backdrop 和 `Escape` 绕过共享收起状态机直接卸载；
- 绕过唯一根级 Mobile Workspace Sheet 让业务页面或详情创建第二个 Sheet DOM、第二个 backdrop、第二个根级 Portal 或平行拖动状态机；不得恢复外部 backdrop 的压暗／模糊或 `backdrop-filter`，不得让实体 Sheet 覆盖／截获移动状态栏，不得恢复 `aria-modal="true"` 或全局 `Tab` 焦点陷阱；不得让根 Sheet 存在时移动底栏保持可见可交互，也不得在详情切换、通知开关、刷新或初始挂载时播放底栏返回动画；
- 恢复工厂周期、产量、成本、原料四格规格区；
- 在生产公式中恢复独立箭头元素、Emoji 周期或成本图标、可见“周期”标签或可见“运行成本”标签；
- 删除 `CycleIcon`、`CreditsIcon`、`WarehouseIcon` 或用平行 SVG 文件替代统一图标组件；
- 破坏输入侧／输出双列语义、把周期成本移回独立中列、删除 `+` 分隔或逐输入库存能力；
- 把生产结算投入／产出物资槽恢复为不可交互元素、缩小到只有图片可点击、删除键盘按钮语义，或把承载物资按钮的 `.facility-formula-visual` 整体设为 `aria-hidden`；
- 让生产结算商品入口根据投入／产出自动切换买卖方向、自动填充生产数量作为下单数量、自动提交订单，或反向改写建筑页建设／配方／作业制度状态；
- 在生产进度条下方恢复当前周期、恢复运行、产出、成本或其他可见说明文字；
- 恢复静态计划模式文本、手动“保存计划”按钮、目标产量输入、农场专属配方区域或其他计划视觉；
- 把建筑页主标题恢复为“工厂”；
- 恢复“紧凑数字”设置开关、关闭路径或按移动／桌面分流默认值；
- 让移动状态栏或底栏忽略安全区；
- 给导航活动态添加位移或缩放；
- 恢复桌面侧栏显式展开／折叠按钮，或删除悬浮／焦点自动展开、折叠状态的导航可访问名称或键盘操作能力；
- 在桌面侧栏恢复可见数字角标，或为移动底栏单个页面恢复专用角标组件、双项／多项角标、`999+` 上限和固定 `left` 坐标；
- 让桌面侧栏导航网格拉伸自动行、使用 `align-content: stretch`，或把十一个导航按钮平均分散到整个侧栏高度；
- 对高增长记录恢复全量 `.map()` DOM 渲染，或用分页、截断替代 `VirtualList`；
- 恢复会阻断纵向滚动链的 `overscroll-behavior: contain` 或其他双轴越界隔离；
- 为页面、侧栏或业务表格复制滚动条宽度、颜色、计时器或活动判断；
- 为业务 `ScrollArea` 按 `--scrollbar-hit-size` 预留内容空白、在业务 CSS 重写轨道或滑块几何，或让移动根级 Dialog 纵向轨道偏离页面安全边缘；
- 隐藏存在横向溢出的水平滚动条，把普通纵向滚轮转换为水平滚动，或让水平轨道覆盖纵向轨道；
- 让玩家页面纵向轨道逃出页面卡片，恢复 `--mobile-scrollbar-edge-escape`／`translateX(...)` 逃逸实现，越过卡片右边界，或通过改变 viewport／卡片宽度实现屏幕贴边；
- 使用 `.login-shell:focus-within` 或其他焦点选择器改变移动登录页标题字号、区块间距或整体对齐；
- 把账号或密码重新绑定到初始为空的 React `value` 状态；
- 把设置页恢复为桌面双列、共享三列网格、`span-2` 跨列卡片、宽卡片两列统计或整卡宽度昵称保存按钮；
- 恢复旧“经济状态重置”动作、绕过服务器预检查和双重确认，或把删除存档做成无说明的一键操作；
- 把账号资料、管理员入口和退出登录重新混成无标题的单一操作栈；
- 在 `settings.css` 复制按钮、输入、面板或开关基础视觉；
- 使用运行时 DOM 扫描、文本匹配或 `MutationObserver` 修补已渲染页面；
- 未更新本文档和验证脚本就改变令牌、断点、共享组件、图标体系或关键布局。

## 市场页布局完整性

市场页专用布局规则由 `src/styles/market-page-polish.css` 负责，但必须先于 `design-system.css`、`primary-surfaces.css` 与 `form-controls.css` 加载，只允许控制页面结构和尺寸，不得覆盖共享基础控件或一级卡片外层内边距。列表筛选栏按市场内容宽度由四列降为两列和单列，列表行由桌面数据行降为移动两列摘要，不得隐藏八项市场字段或形成横向主滚动区。商品目录不显示工厂资产切换；`64px` 身份槽内商品插画固定 `48px`。商品详情插画桌面为 `58px`、移动为 `50px`，建筑从属交易详情尺寸保持桌面 `68px`、移动 `58px`。详情完整行情使用共享 `EconomyChart` 的 ECharts SVG 双 Grid，由组件按实际宽度、根字号、full `68px`／compact `48px` 成交量下限、22% 数据区占比和底部安全区计算动态高度；业务 CSS 不得固定 `16:9`。订单簿不得通过 `stretch` 跟随行情卡制造空白。

市场页面标题栏保持“返回 SVG｜标题｜关闭 SVG”。目录态返回遵循页面历史；商品详情返回商品列表并保留筛选，建筑从属交易返回原建筑详情，关闭仍进入纯地图。详情只显示当前资产本人未完成订单和当前资产浏览器本地成交，避免与全市场记录重复；商品列表通过“有我的订单”筛选承担全市场发现。市场不得恢复行情底部统计栏；仅允许行情内部的方向图例和“时间”轴标题使用组件稳定 DOM，并围绕真实绘图区居中。

Playwright 必须验证 `1684×931`、`1280×900`、`900×1000`、`390×844` 和 `320×700` 下的商品筛选、八项市场字段、行情／自动交易切换、整行详情入口、详情返回、动态行情高度、ECharts SVG 初始化、零涨跌中性状态、禁用原因、订单簿标题顺序、同价档位聚合、当前资产订单／成交隔离及零水平溢出；还必须从建筑详情验证工厂主视觉、从属资产交易返回和移动触摸反馈。

## 资产拍卖图标规则

拍卖页只允许商品和工厂：主视觉、资产矩阵、资产包行和历史图标中，商品必须使用 `ProductIcon`，工厂必须使用按 ID 映射的 `FacilityIcon`；类型切换或其他紧凑类型语义仍可使用 `FactoryIcon`。创建表单在商品和工厂之间使用两个等宽文字按钮切换，移动端改为单列但不得隐藏数量、起拍价、可选保留价、发布费、最低加价或时长。

进行中的拍卖主视觉格子外边界不得超过 `256 × 256px`，并保持正方形、在各自网格列内居中。工厂场景插画必须在主视觉格子和资产矩阵槽的可用内容区内使用居中 `cover` 完整铺满，不得继续按居中小图标尺寸缩放；主视觉边框和资产矩阵数量胶囊继续位于插画之上。

资产矩阵的非空格子必须复用 `SafeTooltip`，鼠标悬浮或键盘聚焦时显示当前资产，格式固定为“名称 ×数量”；空占位格不显示提示，移动触摸不得增加阻断页面操作的点击层。主视觉只作静态展示，不接入 `SafeTooltip`、不响应鼠标悬浮、不成为键盘焦点目标，也不产生悬浮边框或背景变化。主视觉和矩阵格子继续保留名称和数量的可访问标签，不得恢复原生 `title`、页面内绝对定位提示或运行时 DOM 扫描；矩阵 Tooltip 包装层不得改变主视觉 `256px` 上限、正方形比例、工厂插画 `cover` 铺满或数量胶囊层级。

## 资产包编辑器与冻结资产明细

拍卖发布区使用两列表面：左侧添加资产，右侧展示资产包；窄屏降为单列。类型选择是互斥分段控件，必须使用 `aria-pressed` 表达当前项，不得把选中类型伪装成页面主提交按钮。资产包行使用 `ProductIcon` 或 `FacilityIcon`，显示名称、类型、数量和移除操作；发布按钮位于统一拍卖参数区，费用摘要使用紧凑定义列表。隐藏保留价使用带真实复选框的标签，不得只靠颜色表达启用状态。出价历史使用原生按钮承载展开状态并设置 `aria-expanded`，默认折叠；记录行同时显示匿名代码、金额、时间和“我的出价”文字标记，不得只靠颜色区分本人。

进行中资产包卡最多直接展示前三项，使用“当前总价”和“整包出价”；多项视觉采用本地图标网格，不使用字符占位。零场空状态只使用一层表面，最近结束区域始终渲染。

银行页资产总览的冻结资产明细使用现有共享指标与状态色：冻结资金、冻结商品估值与冻结工厂估值可以使用等待色，但必须同时有文字。总资产必须明确包含冻结资产，并同时展示可支配资产；颜色不得暗示冻结等同损失。

## 金额输入与显示精度

`MoneyInput` 是所有可编辑普通货币的唯一输入控件。输入字符串最多包含两位小数，最小非零值为 `0.01`；第三位及以后无论是否为零都判定为无效，禁止自动截断、自动扩大精度或先转浮点再猜测用户意图。

普通玩家界面的余额、价格、总额、资产、银行和合同金额统一四舍五入显示两位；非零绝对值小于 `0.01` 时显示 `<0.01` 或 `-<0.01`。流水详情、合同审计和管理员精确诊断可以显示六位。格式化文本只是展示结果，不得回填到权威状态或参与计算。

### 金额显示精度边界

- 普通金额统一显示两位；精确流水、合同审计和管理员诊断详情统一显示六位。
- 非零且绝对值小于 `0.01` 的普通金额显示为 `< 0.01`，不得误显示为零。
- 显示格式化结果只用于界面渲染，不得重新参与服务器或客户端业务运算。

## 登录后浮层安全区

- 游戏端与管理员端的 Tooltip、Popover、下拉菜单、上下文菜单、确认框和普通页面 Dialog 必须使用 `SignedInShell` 提供的 `.workspace-floating-layer`，或由业务容器在自身边界内完成 `confine`。唯一根级 Mobile Workspace Sheet 和移动通知面板使用现有 `.workspace-dialog-layer`，但不得为它们建立第二个 Portal 根。
- 普通 Tooltip、Popover、菜单以及桌面通知面板等工作区安全浮层不得与桌面顶部状态栏／管理员工作栏、桌面侧栏、移动顶部状态栏或可见移动底栏相交。移动根 Sheet 是结构例外但不是 Chrome 覆盖例外：实体 Sheet 顶边必须低于移动状态栏，外部 backdrop 完全透明且不模糊 Chrome；底部导航在 Sheet 存在时由导航自身隐藏、`aria-hidden`、`inert` 并退出命中，而不是被 Sheet 视觉遮挡。
- 移动通知面板是 Chrome 级例外：它复用同一个 `.workspace-dialog-layer` 的更高内部层级，覆盖根 Sheet但位于移动状态栏下方。状态栏始终位于 Sheet 与通知面板之上。面板不得新增 Portal 根、第五个全局层或额外毛玻璃宿主；面板外点击捕获层必须透明。
- `SafeTooltip` 是普通 React Tooltip 的共享入口，其定位必须根据工作区浮层根计算、自动上下翻转、水平收敛并保留 `8px` 安全间距；ECharts Tooltip 统一通过 `commonTooltip` 在图表容器边界内 `confine`。两者的实际浮层节点都必须使用 `.ui-tooltip-surface`，材质唯一归属 `src/styles/frosted-glass-surfaces.css`，不得增加第二层玻璃包装。
- 登录后界面不得使用原生 `title` 承担被截断文本、操作说明或其他必须可访问的信息；原生 `title` 只允许保留非必要补充说明。
- 唯一根级 Mobile Workspace Sheet 只实施页面滚动锁、当前基础页／详情的 `inert` 切换和自身点击／拖动关闭；不得建立全局 `Tab` 焦点陷阱，不得设置 `aria-modal="true"`，也不得阻止移动状态栏通知按钮取得焦点。移动通知面板打开时由其自身消费 `Escape`，关闭后焦点返回通知入口；不得继续把该按键传递给下层 Sheet。
- 浏览器回归必须分别验证玩家图表 Tooltip、管理员工作栏 Tooltip、侧栏展开／折叠、移动安全区、Sheet／通知／状态栏层级和 `125%` 根字号；Tooltip 回归还必须读取真实计算样式验证共享半透明毛玻璃，而不能只检查类名、`z-index` 或 Option 字符串。

## 生产方式下拉选择

- 生产产物与作业制度必须使用共享 `RichSelectInput` 的 `production-config` 生产方案槽，继续保持 `combobox`／`listbox` 语义、方向键／Home／End／Enter／Space／Escape／Tab、文字快速定位、焦点返回与状态刷新透明；不得恢复 `radiogroup`、选择卡、按钮组、可见原生 `select` 或业务自建弹层。
- 生产产物候选使用商品 `ProductArtwork`，直接展示当前作业制度下的投入 → 产出、周期和周期成本；作业制度候选使用统一功能 Icon，直接展示实际投入、周期、成本和产量，并相对当前方案显示周期／成本／产量变化。当前方案必须有明确选中标记，不得只用颜色表达。
- `production-config` 菜单允许宽于触发器，在桌面优先提供完整方案比较宽度，在移动根级 Dialog 内收敛到抽屉可用宽度；不得越过工作区／Dialog 安全边界，也不得产生页面横向溢出。
- 控件收起时只显示当前方案图片，不显示名称、参数摘要或下拉箭头；收起触发按钮固定为正方形并按内容宽度布局。生产产物与作业制度位于同一横向 Auto／Desired Size 容器中，两个字段从左向右连续排列并只由统一 `gap` 分隔，字段与触发按钮命中区域均不得吸收父容器剩余宽度；不得恢复 `1fr`、百分比或 `flex-grow` Fill 槽。图片槽背景透明且无独立边框，完整名称与参数只在展开候选中显示；不在生产设置下方恢复独立“周期 · 产出 · 成本”摘要，不重复当前制度名称，不显示作业制度说明。
- 方式说明和指标颜色不承诺收益；真实利润仍以生产结算和最近真实成交价为准。

- 工厂详情参考经营模拟游戏的建筑信息层级组织为“工厂信息 → 满员率 → 生产设置 → 投入产出与进度”。工厂信息统一使用 `4:5` 纵向场景插画并包含经营结果；满员率不得显示周期范围、锁定值或等效产能说明；生产设置不得重复周期、产出和成本摘要；生产结算标题不得显示右侧长描述。

运行中公式使用 `participatingCount`、实时投影的 `staffingRateBps` 和跨周期 `staffingBatchCarryBps`，在周期完成时计算整数等效产能；停止或异常使用 `productionAvailableCount`、实时投影的满员率和 `staffingBatchCarryBps` 计算启动后或恢复后的整数等效产能。

当前工厂详情正文按“工厂信息 → 满员率 → 生产设置 → 生产结算 → 经营诊断”组织；单厂平均利润属于工厂信息，生产结算只包含公式、操作数据带和进度，经营诊断固定紧跟生产结算。

生产公式是集群运行能力展示，只负责表达当前运行能力，不替代服务器完成时结算。

不得使用 `group.count` 作为公式乘数。

任何可见下拉均不得恢复浏览器浅色原生选项弹层；生产产物与作业制度继续使用共享 `RichSelectInput` 的 `production-config` 富内容方案列表，普通纯文字 `SelectInput` 继续复用默认共享触发器和列表视觉。

生产结算的多项物资只使用独立物资槽与间距分隔，不显示 `+` 或其他连接字符。

生产结算操作数据带按内容宽度左对齐且最大不超过结算容器，移动端不得拉伸为全宽。

## 通知面板与关闭态 Toast

- 玩家通知入口只有状态栏最右侧按钮。数字只表示当前未解决待处理事项，普通未读通知使用独立圆点；二者不得合并成同一数字。
- 移动状态栏继续固定为 `48px` 高；通知入口使用独立 `48px` 工具轨道和 `44×44px` 触控目标，不得缩回旧测试夹具的 `36px`，也不得挤入五项状态数据网格。
- 桌面通知面板继续挂载到工作区安全浮层并在工作区右上角展开。移动通知面板不再使用普通 `.workspace-floating-layer`，而是复用现有 `.workspace-dialog-layer` 的更高内部层级，在状态栏下方覆盖当前 Mobile Workspace Sheet；状态栏仍位于通知面板之上且通知按钮可交互。移动面板不得新建 Portal 根、第五个全局层或额外毛玻璃宿主。面板外的点击捕获层保持完全透明，不得压暗常驻地图；Sheet 自身承担唯一移动毛玻璃模糊。
- 待处理条目使用严重程度文字、图标和左侧标记三重表达，只提供前往处理，不提供删除；问题解决后由状态派生自动移除。普通通知显示图标、标题、可选说明、时间与至少 `40×40px` 删除按钮。
- 面板头部固定提供“清除已读”和关闭按钮。“清除已读”只删除已读普通通知，禁用态必须可辨识；单条删除不弹确认框，也不得产生新的成功通知。
- 面板关闭时使用关闭态 Toast。桌面最多同时显示三条，移动只显示队列最后一条；Toast 必须可点击打开通知面板。移动通知岛在面板关闭时允许显示于 Sheet 之上、状态栏之下；面板打开时立即清空 Toast 队列，并且整个面板打开期间不得挂载通知岛、Toast 或其 ARIA live region，也不得继续排入新的 Toast。面板期间已经展示在面板内的新通知，关闭面板后不得延迟补弹。
- 面板顶部直接对齐对应浮层安全起点；桌面复用状态栏与工作区之间既有沟槽，移动面板使用移动状态栏下方安全 inset。点击面板外遮罩空白、按 `Escape` 或点击关闭按钮都必须关闭，面板内部 Pointer 操作不得冒泡触发关闭。移动端键盘监听必须在捕获阶段消费 `Escape` 并停止传播，避免同一次按键关闭下层详情／根 Sheet。关闭后焦点返回通知入口；入口使用 `aria-expanded`／`aria-controls`，面板使用命名 `dialog`，删除按钮必须包含具体通知标题的可访问名称。
- `prefers-reduced-motion` 下关闭 Toast、移动通知岛和移动底栏返回位移动画都必须关闭；颜色不得作为待处理严重程度、未读状态或操作结果的唯一表达。
- 待处理派生必须容忍浏览器夹具、迁移中状态或分区尚未送达造成的局部字段缺失；缺失领域不得阻断登录后外壳，只能不生成对应提醒，不得伪造提醒。

### 化肥与化肥厂视觉资产

正式商品 `fertilizer` 和正式设施 `fertilizer-factory` 必须分别具有 1024×1024 RGBA 源图、运行时缩略图、共享 `ProductIcon`／`FacilityIcon` ID 与 CSS 映射。化肥主视觉使用敞口颗粒肥料袋、叶片和紧凑土壤垄沟语义；化肥厂当前批准构图以中央造粒塔、双侧储罐、输送管廊和装袋区为核心，并与以成组分馏塔为主体的炼油厂保持可辨识差异。目录外回退不得替代正式资产；化肥厂插画哈希必须进入现有工厂基线，化肥商品源图继续接受商品资源完整性验证。

正式商品 `feed`、`veterinary-medicine`、`tractor` 与正式设施 `feed-factory`、`veterinary-medicine-factory`、`tractor-factory` 必须分别具有同名 1024×1024 RGBA 源图、运行时缩略图、共享图标 ID 与 CSS 映射。配合饲料主视觉使用无文字饲料袋和颗粒，养殖药剂使用琥珀药剂瓶，拖拉机使用无品牌农业拖拉机；三座工厂分别以粮仓与制粒设备、洁净混合与灌装设备、拖拉机总装线为中央识别主体。三座工厂均从空白生成且哈希进入工厂基线，不得以旧图编辑、通用厂房或未知 ID 回退替代。

- `tools` 当前批准构图使用红橙色敞口钢制工具箱、木柄锤和大型活动扳手主体；`tool-workshop` 当前批准构图以砖钢锯齿屋顶工坊、开放锻造间、工作台与工具架为核心，并使用钢条、木料和成品手工具强化产业识别，纳入 SHA-256 插画基线。
- 四张批准资产均从空白重新构图，不把被替换图片作为生成、编辑、构图参考或描摹输入；化肥与工具在 128px 透明缩略图中保持完整轮廓，化肥厂与工具工坊在 256px 方形缩略图及实际 `4:5` 居中裁切中保持核心主体完整。

### 未解锁作业制度的研发锁定

生产方式下拉选择继续复用共享 `production-config` `combobox` 与生产方案槽。未解锁作业制度必须保留在候选列表中并显示禁用状态，同时明确所需研发科技；不得通过隐藏选项、复制第二套选择器或仅依赖客户端禁用来代替权限控制。客户端禁用只负责提示，服务器 `setFacilityRecipe` 必须按正式 `requiredTechnologyIds` 再次校验；研发完成后的状态刷新应使原候选项自然转为可选，作业制度说明不得显示在收起态生产设置区。

### 建筑页缺失研发状态兼容

正式服务器快照继续返回 `research` 与 `researchTechnologies`；但浏览器历史回归快照、逐步发布兼容数据或旧客户端缓存可能暂时缺少 `research`。建筑页不得因此在首屏读取 `completedTechnologyIds` 时崩溃：工厂目录准入继续复用 `getUnlockedFacilityTypes` 的既有兼容语义，作业制度研发状态在缺少 `research` 时仅按空 `completedTechnologyIds` 渲染锁定提示。该客户端兜底不得绕过服务器 `setFacilityRecipe` 的正式科技校验，也不得把缺失研发状态写回服务器或永久视为已完成科技。

### 玩家头像

玩家头像统一由 `PlayerAvatar` 渲染。服务器实际资源固定为 64×64 WebP；加载失败或旧玩家尚未设置头像时使用玩家名称首字符作为本地回退，不请求大图。设置页选择原图后必须先在浏览器本地居中裁成正方形、缩放至 64×64 并压缩，再上传最终缩略图；原图不得发送到服务器。状态栏和设置页不得各自实现第二套头像加载逻辑。
