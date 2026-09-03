# Economy 设计文档索引

> 状态：当前设计文档入口与内容边界
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-09-03
> 客户端状态版本：39
> 世界状态版本：32

本文件只负责**文档索引、内容边界和规则路由**，不是业务规则正文。任何会改变玩家行为、业务参数、算法、页面几何、协议字段、存储结构或部署步骤的规则，都必须写入下表登记的唯一权威 DESIGN，而不是复制到本文件或任意 README。

`docs/` 只保留当前有效设计。未登记 Markdown、补充说明和版本化平行文档不得存在；不得以 V2/V3、迁移记录或临时专题文档保留已替代规则。

## 1. 文档层级

| 层级 | 文件 | 唯一职责 | 允许内容 | 禁止内容 |
|---|---|---|---|---|
| 协作层 | `AGENTS.md` | 如何开始任务、验证、集成和交付 | 协作流程、冲突处理、验证与部署门禁 | 产品规则、页面细节、运行时常量 |
| 项目入口 | 根 `README.md` | 项目介绍、在线入口、本地启动和导航 | 稳定高层能力、技术栈、开发入口 | 业务参数、UI 几何、协议和部署内部细节 |
| 设计索引 | `docs/README.md` | 告诉维护者规则由哪一份 DESIGN 负责 | 文档边界、owner 与规则路由 | 领域规则正文和实现副本 |
| 目录导航 | 可选目录级 `README.md` | 解释复杂目录如何维护 | 目录职责、入口、依赖方向 | 产品规则和跨目录架构规则 |
| 规则权威 | `docs/*_DESIGN.md` | 定义某一领域当前唯一最终规则 | 领域语义、约束、防回退和验证边界 | 历史方案、失败尝试、其他领域完整规则 |
| 运行事实 | 代码与正式数据 | 当前真实实现与常量 | 协议实现、运行时常量、正式数据 | 第二套产品设计 |
| 防回退 | 测试与 verifier | 证明实现没有偏离 DESIGN | 行为、结构与边界检查 | 通过复制规则创建新权威来源 |

根 `README.md` 回答“项目是什么、怎样运行、去哪里找规则”。目录级 `README.md` 只在目录本身无法自解释时存在。业务、交互、架构、视觉和部署规则只进入登记的 DESIGN。

## 2. DESIGN 内容边界

每份 DESIGN 必须明确以下边界：

1. **唯一职责**：该文档唯一拥有的问题。
2. **包含范围**：本领域长期稳定的行为和约束。
3. **明确不负责**：相邻问题交给哪一份 DESIGN。
4. **当前最终规则**：只保留现行行为，不保留演进历史。
5. **防回退边界**：禁止恢复的旧实现或旧语义。
6. **实现与验证映射**：哪些代码与测试证明该规则成立。

一个语义规则只能有一个权威 DESIGN。跨领域功能按语义所有权拆分；如果确实形成长期稳定且互不重叠的新领域，才允许新增 DESIGN，并必须同时登记本文和文档权威 verifier。

## 3. 权威设计文档

| 文档 | 唯一职责 | 明确不负责 |
|---|---|---|
| `PRODUCT_AND_GAMEPLAY_DESIGN.md` | 产品定位、核心循环和总体经济成长语义 | 产业算法、页面布局、服务器实现 |
| `GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md` | 宝石加速与动态兑换业务语义 | 银行、通用视觉、部署 |
| `INDUSTRY_AND_PRODUCTION_DESIGN.md` | 商品、工厂、配方、生产和产业科技 | 页面信息架构、服务器部署 |
| `FACILITY_CATALOG_PRESENTATION_DESIGN.md` | 工厂目录与已拥有工厂展示顺序 | 工厂经济规则、通用卡片视觉 |
| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 市场订单、冻结、撮合、成交与资产交易 | 页面布局、服务器容量 |
| `WAREHOUSE_EXPANSION_DESIGN.md` | 仓库、地区库存、运输经济和工厂自动经营 | 地图路线视觉、通用 Chrome |
| `TRANSPORT_NETWORK_GEOMETRY_DESIGN.md` | 公路／铁路 GIS 数据、首府物理中心线离线派生和航空虚拟航路数据边界 | 运输经济、战略地图 Camera 和通用视觉 |
| `STRATEGIC_MAP_RENDERING_DESIGN.md` | 战略地图 SVG Camera、固定视场边界、州名清晰度、路线视觉／运动／高亮和地图专属表面材质 | 运输经济、原始 GIS、全应用通用视觉与根 Chrome |
| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 页面模块、导航和玩家信息架构 | 业务算法、通用视觉、服务器事务 |
| `MARKET_CHART_LAYOUT_DESIGN.md` | 市场行情图布局、坐标和交互几何 | 行情生成和撮合规则 |
| `REGISTRATION_INVITE_FLOW_DESIGN.md` | 登录、注册、密码重置与邀请流程 | 通用表单视觉和账号存储 |
| `UI_DESIGN_SYSTEM.md` | 通用设计令牌、共享组件、州级名称视觉、插画、响应式与可访问性 | 战略地图 Camera／路线渲染、单页业务内容、服务器逻辑 |
| `AUTHORITATIVE_COUNTDOWN_DESIGN.md` | 客户端权威时间、倒计时确认、状态读取恢复和 ready 生命周期 | 各业务结算结果 |
| `PRIMARY_SURFACE_INSET_DESIGN.md` | 玩家一级表面的统一外层内边距与贴边例外 | 卡片通用视觉和业务结构 |
| `OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md` | 概览页布局完整性和局部几何回归 | 概览业务数据和通用响应式系统 |
| `PRODUCTION_PILL_ALIGNMENT_DESIGN.md` | 生产状态胶囊与开关局部对齐 | 生产业务语义和通用控件 |
| `LIQUID_GLASS_CHROME_DESIGN.md` | 四层根外壳、通用毛玻璃材质与 Chrome、Workspace 和浮层层级 | 战略地图 Camera／路线渲染、地图专属表面材质、页面业务、经济规则 |
| `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` | 服务器权威、API、事务、存储、缓存、安全、容量和生产部署 | 玩家玩法、页面与通用视觉 |
| `CI_EXECUTION_DESIGN.md` | CI 选测、并行、分片、超时、发布门禁和生产只读诊断安全 | 业务和运行时实现 |
| `LOCAL_ACTIVITY_LOG_DESIGN.md` | 浏览器本地活动记录最小数据、迁移、展示和清除 | 服务器账本和全局通知 |
| `GIFT_CODE_AND_ADMIN_DESIGN.md` | 礼品码、管理员运营能力、管理审计和管理端规则 | 普通玩家页面和产业规则 |

工厂场景插画主视觉归属 `UI_DESIGN_SYSTEM.md`；具体工厂目录展示顺序和场景选择仍归 `FACILITY_CATALOG_PRESENTATION_DESIGN.md`。

文档名称表达领域而不是版本。职责变化时直接更新现有 DESIGN 和本表，不建立版本化或补充型平行文档。

## 4. 规则路由

| 修改内容 | 首要 DESIGN owner |
|---|---|
| 产品定位、总体玩法循环和总体经济语义 | `PRODUCT_AND_GAMEPLAY_DESIGN.md` |
| 商品、工厂、生产、配方、产业科技 | `INDUSTRY_AND_PRODUCTION_DESIGN.md` |
| 市场订单、冻结、撮合、成交 | `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` |
| 仓库、地区库存、运输费用／耗时／载荷／结算 | `WAREHOUSE_EXPANSION_DESIGN.md` |
| 公路／铁路上游 GIS、首府路网快照和航空航路数据来源 | `TRANSPORT_NETWORK_GEOMETRY_DESIGN.md` |
| 战略地图 Camera、固定视场边界、地图路线显示／运动／高亮、地图专属表面 | `STRATEGIC_MAP_RENDERING_DESIGN.md` |
| 页面模块、导航和内容归属 | `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` |
| 通用颜色、字体、控件、列表、响应式、可访问性 | `UI_DESIGN_SYSTEM.md` |
| 根外壳、通用毛玻璃材质与 Chrome、Workspace 和浮层层级 | `LIQUID_GLASS_CHROME_DESIGN.md` |
| 市场行情图局部几何 | `MARKET_CHART_LAYOUT_DESIGN.md` |
| 注册、邀请和账号入口流程 | `REGISTRATION_INVITE_FLOW_DESIGN.md` |
| 宝石加速与动态兑换 | `GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md` |
| 权威时间、状态读取恢复和 ready 生命周期 | `AUTHORITATIVE_COUNTDOWN_DESIGN.md` |
| API、事务、协议、存储、缓存、安全、容量和部署 | `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` |
| CI 选测、分片、超时和发布门禁 | `CI_EXECUTION_DESIGN.md` |
| 浏览器本地活动历史 | `LOCAL_ACTIVITY_LOG_DESIGN.md` |
| 礼品码与管理员运营能力 | `GIFT_CODE_AND_ADMIN_DESIGN.md` |

一个改动可以影响多份 DESIGN，但每一条最终语义必须明确唯一 owner。专项布局只归对应专项 DESIGN，不向通用 UI 或页面 DESIGN 复制完整规则。

## 5. 修改规则

- 新对话、分析或修改前先读 `AGENTS.md`、本索引、相关 owner DESIGN、实现和回归测试。
- 如果 DESIGN、代码、测试相互冲突，先报告冲突，再以当前需求修改唯一 owner；不得静默选择其中一份。
- 改变业务或交互规则时，owner DESIGN、实现和防回退必须在同一变更中更新。
- 运行时数值与协议常量以正式代码／数据为事实来源；DESIGN 只记录需要长期维护的语义和边界。
- 专项 verifier 应直接检查对应 DESIGN 与实现；`scripts/verify-document-authority.mjs` 只验证文档登记、层级边界和文档体积，不复制领域规则。
- README、代码注释和测试名称不得承担第二套设计权威。
- 合并前检查变更范围、测试和文档一致性；同目的提交最终压缩后进入 `main`，由正式部署工作流发布。
