# Economy 概览布局完整性设计

> 状态：当前正式概览布局防回退基线
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-08-23

## 1. 目标

概览使用参考大战略建筑页面的左侧毛玻璃业务面板，保留常驻地图，并与玩家外壳右侧统一战略追踪器并列。概览正文只负责签到、生产摘要、资产与银行、当前挂单，不持有桌面或移动教程、公开事件、今日经营、基础工作或第二套经营提醒。

## 2. 页面与外壳职责

```text
工作区左侧：概览 PageLayout → 本周签到 → 三张经营摘要
桌面工作区右侧：StrategicWorkspaceChrome → StrategicOutliner → 教程／进行中／关注／公开经济事件
移动工作区顶部：同一 StrategicOutliner DOM → 仅教程分区（可见时固定在状态栏下方）
```

- 概览页面区域与市场、建筑、设置共用 `--strategic-compact-page-width: 56rem` 内容目标，并与 `78px` 侧栏轨道共同位于唯一玩家主卡片；完整主卡片不得超过 `calc(100vw / 3)`，并为战略追踪器当前预留宽度保留空间；
- `.strategic-outliner` 不得成为 `.page-content`、`.overview-dashboard-shell` 或页面滚动区的后代；它由 `StrategicWorkspaceChrome` 单实例持有，并与正式页面路由生命周期解耦；
- 展示层缺省归一化由 `StrategicWorkspace` 在把完整页面模型交给 `StrategicOutliner` 前统一完成：缺少 `game.research` 时按 `{ active: null }` 展示，缺少 `game.facilityConstruction` 时按 `null` 展示，缺少 `game.economicCalendar` 时按 `{ events: [] }` 展示，`selectedProvinceId` 不是字符串时按空地区上下文展示。该降级只用于外壳展示兼容测试夹具、渐进加载或旧投影，不得写回权威状态、伪造经济值或中断整个 React 外壳挂载；
- 教程属于 `StrategicOutliner` 顶部分区，只由教程自身显示状态控制，不得再以 `home`／概览页面是否显示作为挂载条件；桌面端位于追踪器顶部，移动端在同一 Outliner DOM 上只保留教程分区并固定到状态栏正下方；
- 不大于 `720px` 时公开事件、进行中和关注分区隐藏，概览不得重新创建 `.overview-mobile-tutorial` 或直接渲染 `GameGuideStrip`。移动教程所在工作区层低于根级 Mobile Workspace Sheet、通知面板／通知灵动岛和状态栏，因此页面与通知可以自然覆盖教程；覆盖期间不得卸载教程或改变教程进度；
- 公开经济事件在战略追踪器内使用紧凑事件行并共享追踪器唯一纵向滚动根，不再由 `EconomicEventLogPanel` 作为页面外独立右栏的正式挂载方式；旧组件可保留用于隔离测试或兼容内容验证，但不得回流概览页面。

## 3. 概览正文响应式

- `.home-grid` 始终单列组织签到和摘要行；
- 概览真实内容宽度大于 `1050px` 时三张摘要卡同排；
- 不大于 `1050px` 时摘要两列，当前挂单跨两列；
- 不大于 `580px` 时摘要全部单列并恢复自然高度；
- `900px` 紧凑桌面只为战略追踪器保留 `44px` 收起轨道，因此概览正文允许进入单列；玩家临时展开追踪器时向左覆盖，不得把公开事件塞回概览或推动概览重新排版。

## 4. 高度与滚动

- 当前挂单只有超过三条时使用 `overview-open-orders-list--scrollable`；
- 服务器权威资产状态不得内部滚动；
- 战略追踪器只有 `.strategic-outliner__scroll` 一个纵向滚动根，公开事件不得建立第二个事件列表滚动视口，也不得增加概览页面高度；事件折叠态只显示名称、状态点和距离开始／结束时间，具体信息只在展开后显示；
- 侧栏从 `78px` 展开到 `224px` 时在玩家主卡片内覆盖概览页面，工作区、概览页面宽度和战略追踪器几何不得重排；侧栏右侧竖线和阴影必须随其边缘移动。
- 概览不显示“进入市场”页面按钮；标题固定在页面卡片头部，签到与摘要在卡片内部滚动。

## 5. 签到与摘要

- 签到日历固定周一到周日七格，移动端仍保留七列；
- 签到日期、周边界、今日状态和全勤资格只读取服务器；
- 签到按钮固定在“本周签到”标题右侧，不显示签到天数胶囊、连续七天奖励说明或北京时间补签说明；注册所在不完整周仍显示下周起参与全勤；
- “资产与银行”展示现金、商品估值、工厂估值、冻结资金、可支配资产、冻结资产和贷款负债；
- “生产摘要”优先展示运行、受阻、停工和理论日产量；
- “当前挂单”只显示本人未完成订单摘要和列表，不提供概览撤单。

## 6. 浏览器回归

至少验证：

1. `1684×931` 下概览建筑面板与展开战略追踪器不相交；
2. 战略追踪器不在 `.page-content` 内，教程位于追踪器顶部分区；从概览切换到桌面其他业务页和 `fullscreen` 页面时同一 Outliner DOM 继续存在；
3. 任何缺失 `research`、`facilityConstruction`、`economicCalendar` 或地区上下文的最小状态投影都不得让 `GameShell`／`StrategicWorkspaceChrome` 挂载失败；对应 Outliner 分区显示为空状态或忽略缺省上下文；
4. `390×844` 下概览没有自己的教程 DOM，同一 Outliner DOM 只显示教程并固定在状态栏下方；根级业务 Sheet 与通知覆盖教程时教程仍保持挂载，状态栏继续位于最上层；
5. `900×1000` 下概览摘要单列且无横向溢出，Outliner 默认只占 `44px` 轨道；
6. 侧栏悬浮展开覆盖概览但不改变页面和战略追踪器几何，且竖线与阴影跟随展开边缘；
7. 签到七格、短挂单和长挂单滚动语义；
8. “今日经营”、基础工作和概览独立提醒均不存在。

## 7. 文件职责

- `src/pages/OverviewPage.tsx`：签到、经营摘要和挂单；不得持有教程或公开事件；
- `src/components/outliner/StrategicOutliner.tsx`：教程、进行中、关注和公开经济事件四分区；
- `src/components/shell/StrategicWorkspace.tsx`：常驻地图、镜头栏、战略追踪器外壳挂载以及展示层缺省归一化；
- `src/styles/mobile-status-layout.css`：移动同一 Outliner 教程分区的状态栏下方锚点以及与通知共享的顶部基准；
- `src/styles/overview.css`、`overview-polish.css`：概览正文；
- `src/styles/strategic-game-shell.css`、`strategic-outliner.css`：建筑面板、全区域页面和战略追踪器几何／最终层级；
- `tests/browser/runtime.spec.ts` 与 `tests/browser/tutorial-right-rail.spec.ts`：概览内容、Outliner 常驻、缺省投影安全降级、移动覆盖层级与真实几何；
- `scripts/verify-overview-content.mjs`、`scripts/verify-strategic-outliner.mjs`：静态防回退。
