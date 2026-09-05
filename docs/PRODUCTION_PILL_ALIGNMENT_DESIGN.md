# Economy 建筑页工厂卡片与胶囊对齐设计

## 1. 职责边界

本文只负责地区建筑页工业／商业卡片、二级详情、共享标题轨道以及运行状态胶囊／开关的场景几何。建造和生产语义归 `INDUSTRY_AND_PRODUCTION_DESIGN.md`，页面归属归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`，通用控件归 `UI_DESIGN_SYSTEM.md`。

## 2. 当前规则

- 删除“建筑概况”卡片；“建设新工厂”是建筑列表态第一张一级卡片，之后直接排列已拥有工厂。
- 建筑列表不显示搜索输入框、产业分类下拉框或运行状态下拉框，不增加无业务含义的外层列表卡。
- 工厂选择器正式呈现恢复为原 4:5 插画卡片；列表正式使用三列，卡片保持 `width: 100%`、`max-width: none` 和 `aspect-ratio: 4 / 5`，320px 及以上不得产生页面级横向滚动。
- 点击工厂卡片后进入当前地区建筑分区内部的二级详情视图，唯一复用 `FacilityClusterDetailContent`；列表态与详情态不得同时展示。
- 地区子导航的名称与顺序以 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为唯一权威；本文只要求该正文级子导航不进入固定页面标题操作区。
- 地区工厂详情复用 `RegionalEntityPageTitle`：第一行是工厂实体名称，第二行是州级地区全称并使用灰色次级文字；两行均单行省略。
- 所有玩家页面共享 `--player-page-title-track-height: 40px` 与 `--font-size-player-page-title`；建筑页不得再通过 `body:has(...)` 或页面专属标题高度改变轨道。
- 建筑页状态胶囊与工厂集群开关的可见和点击高度均为 `1.6rem`，开关宽度 `2.75rem`，滑块 `1rem`；焦点环和键盘可访问性必须保留。
- 工厂详情的满员率与生产周期进度条都在轨道内同时显示状态文案和百分比；两者复用相同的线性轨道、绿色渐变填充、文字排版与 `--radius-control` 按钮圆角，不得使用 `--radius-pill` 半圆端点、扫光或箭头端点。进度条仍须保留语义化进度值，文字不得另占轨道上方的行。
- 建设卡和工厂详情保持普通文档流，不建立第二纵向滚动根；移动端仍使用当前页面工作区，不恢复专用工厂详情 Sheet。

## 3. 防回退边界

不得恢复横向建筑账本、建筑概况、筛选器、同页详情、页面专属标题高度、移动专用工厂详情 Sheet、状态文字伪元素或不可见 44px 开关点击盒。

## 4. 实现与验证

`production-surface.css` 必须在 `facility-group-card-grid.css` 之后加载。`tests/browser/buildings-ledger-layout.spec.ts` 验证建设卡顺序、三列卡片、二级详情和移动端无裁切；`tests/browser/player-page-geometry.spec.ts` 验证共享标题轨道。

## 5. 压缩后场景防回退补充

- 所有玩家 `PageLayout` 标题统一使用 `design-system.css` 的 `--player-page-title-track-height: 40px`；普通单行标题统一使用 `--font-size-player-page-title`。
- 移动端工厂卡点击行为与桌面一致，继续进入同一地区建筑二级详情。
- 建设卡和工厂详情都保持普通文档流，不使用建筑页场景 sticky，也不建立第二纵向滚动根。

- 地区工厂详情不再从 `BuildingsPage` 打开专用 `MobileFacilityDetailSheet`；页面唯一纵向滚动视口继续由 `PageLayout` 管理，建设卡和详情不得创建自己的纵向滚动条。

## 6. 商业建筑同构展示

地区已拥有商业建筑与工业建筑共用 `BuildingClusterCard` 纯展示组件和本文的选择卡几何、状态颜色、整卡按钮、键盘焦点与二级详情规则；商业不得复制第二套网格、卡片、遮罩或响应式断点。商业与工业详情统一使用 `BuildingDetailPage`，共用 `MobileDetailSummary`、状态胶囊、紧凑开关、利润展示区和线性周期轨道，不创建独立滚动根或专用 Sheet。开关和状态区沿用工业摘要同一行的几何。

商业卡片与详情字段归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`，插画与共享组件边界归 `UI_DESIGN_SYSTEM.md`，营业意图、周期锁定与消费规则归 `COMMERCIAL_BUILDINGS_DESIGN.md`；视觉共用不得带入工业产能算法、配方或资产资格；商业满员率采用独立商业经营规则。

`tests/browser/commercial-buildings-layout.spec.ts` 对照工业基线验证 320px 起的三列比例、整卡和键盘导航、摘要与开关高度、长名称与大数量、异常与停止状态、权威周期和请求失败行为。

两类详情的自动经营与结算分别共用 `BuildingAutoOperationSection` 和 `BuildingSettlementPanel`；地区商业与工业分区分别展示对应类别网格，两者沿用本文同一套三列 4:5 规则，不因入口拆分复制几何。商业收入替代工业产出槽的内容，不另设结算几何。

自动经营标题与开关的垂直中心对齐，正常宽度下不得分行；状态摘要的营业开关仍按本文原胶囊几何排列。该规则由共享自动经营组件同时覆盖工业与商业。

工业与商业满员率轨道共用 `BuildingStaffingProgress` 的结构、填充、文字与可访问进度属性；领域适配器提供百分比、方向和解释，公共组件不计算经营量。缺失商业权威基线时显示待同步且不提供伪造的百分比。营业周期轨道继续独立放在结算面板内。
