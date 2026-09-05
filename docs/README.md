# Economy 设计文档索引

> 状态：当前设计文档入口与内容边界
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-09-04
> 客户端状态版本：41
> 世界状态版本：33

本文件只负责**文档索引、内容边界和规则路由**，不是业务规则正文。任何会改变玩家行为、业务参数、算法、页面几何、协议字段、存储结构或部署步骤的规则，都必须写入下表登记的唯一权威 DESIGN，而不是复制到本文件或任意 README。

`docs/` 只保留当前有效设计。旧规则不归档在本目录，不得以“补充说明”、V2/V3、迁移记录或未登记专题文档的形式并行存在；未列入本文“权威设计文档”表的 Markdown 文件不得存在。

## 1. 文档层级

| 层级 | 文件 | 唯一职责 | 允许内容 | 禁止内容 |
|---|---|---|---|---|
| 协作层 | `AGENTS.md` | 如何开始任务、验证、集成和交付 | 协作流程、冲突处理、验证与部署门禁 | 项目介绍、业务参数、产品规则、运行时版本、页面细节 |
| 项目入口 | 根 `README.md` | 让读者理解、启动和导航项目 | 项目简介、稳定高层能力、在线入口、技术栈、本地启动、常用命令、目录与文档入口 | 金额、费率、配额、周期、业务算法、协议字段、UI 几何、迁移细节、生产服务器内部路径 |
| 设计索引 | `docs/README.md` | 告诉维护者“某条规则归谁负责” | README 层级、DESIGN 职责与不负责范围、规则路由、文档治理 | 实际业务口径、算法公式、UI 尺寸、API 细节、实现路径清单、专项防回退字符串副本 |
| 目录导航 | 可选目录级 `README.md` | 解释一个复杂目录如何维护 | 本目录职责、入口、依赖方向、开发或测试操作 | 产品规则、跨目录架构规范、其他 README 或 DESIGN 的正文副本 |
| 规则权威 | `docs/*_DESIGN.md` | 定义某一领域当前唯一最终规则 | 领域语义、约束、职责边界、必要的 non-obvious reason、防回退边界、实现与验证映射 | 方案演进、失败尝试、临时状态、已替代规则、其他领域完整规则 |
| 运行事实 | 代码与正式数据文件 | 当前实际运行行为和常量 | 运行时常量、协议实现、业务实现、正式数据 | 用注释创建第二套产品设计 |
| 防回退 | 测试与 verifier | 证明实现没有偏离 DESIGN | 行为测试、结构检查、边界检查 | 通过要求 README 复制业务规则来制造第二权威来源 |

### 1.1 根 README 边界

根 README 回答：“Economy 是什么、如何进入、如何在本地启动、去哪里找规则”。稳定的产品类别可以概述，例如“支持生产、市场、合同、银行和拍卖”；任何需要随玩法参数或实现细节同步修改的内容都必须下沉到 DESIGN 或代码。

根 README 不承担状态协议版本、市场模型版本、业务金额、手续费、每日额度、生产公式、宝石换算、API 请求体、数据库迁移、Nginx 路由或生产目录等权威口径。

### 1.2 目录 README 边界

目录 README 不是默认必需文件。只有当一个目录无法通过目录名、入口文件和现有 DESIGN 清楚理解时才新增。它只能解释“这里放什么、从哪里开始读、怎样运行本目录相关开发操作”，不得定义产品规则，也不得重复跨目录架构。

## 2. DESIGN 内容边界

每份 DESIGN 只拥有本文登记的一项领域职责。设计正文应围绕以下内容组织，不要求机械使用完全相同的章节名：

1. **唯一职责**：本文负责什么问题。
2. **包含范围**：哪些语义、交互、架构或部署约束由本文定义。
3. **明确不负责**：相邻问题由哪一份 DESIGN 拥有；这里只引用，不复制完整规则。
4. **当前最终规则**：只写当前有效行为，不保留历史方案或中间尝试。
5. **防回退边界**：明确未来修改不能恢复的旧行为；只保留有维护价值的 non-obvious reason。
6. **实现与验证映射**：指出实现和验证应该覆盖哪些边界；运行时常量仍以代码或正式数据文件为准。

跨领域功能必须按“语义所有权”拆分。例如某个业务动作的业务资格由玩法 DESIGN 拥有，页面 DESIGN 只定义如何展示，服务器 DESIGN 只定义事务、API、存储和权威校验；三者不得分别复制一整套业务规则。

如果一个新规则无法明确归入下表任何 DESIGN，先判断现有文档职责是否需要调整。只有确实形成新的、长期稳定且互不重叠的领域时才允许新增 DESIGN，并必须同时登记本文和更新文档权威验证；不得为单次修改创建补充文档。

## 3. 权威设计文档

<!-- design-registry:start -->
| 文档 | 唯一职责 | 明确不负责 |
|---|---|---|
| `PRODUCT_AND_GAMEPLAY_DESIGN.md` | 产品定位、核心循环、玩家可感知的总体经济与成长语义 | 具体产业配方与生产算法、页面布局、服务器协议与存储 |
| `GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md` | 宝石加速与动态兑换的业务语义和审计边界 | 通用货币体系、银行、页面通用视觉、服务器部署 |
| `INDUSTRY_AND_PRODUCTION_DESIGN.md` | 商品、工厂、配方、生产、产业科技及生产侧资产约束 | 商业建筑经营、页面信息架构、通用 UI、HTTP/SQLite/部署实现 |
| `COMMERCIAL_BUILDINGS_DESIGN.md` | 商业建筑资产、地区商品消费、营业周期与固定商业利润 | 工业生产配方、商品市场交易算法、页面通用视觉、服务器部署 |
| `FACILITY_CATALOG_PRESENTATION_DESIGN.md` | 工厂目录与已拥有工厂的展示顺序 | 工厂经济规则、卡片通用视觉、服务器目录生成 |
| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 商品即时交易、每日官方系统价、服务器内部消费／储备订单边界与历史玩家挂单迁移 | 商业建筑仓库消费、市场页面布局、人口需求预算细节、服务器容量与部署实现 |
| `WAREHOUSE_EXPANSION_DESIGN.md` | 仓库、地区库存、运输和工厂自动经营业务语义 | 商业营业结算、市场撮合、生产配方、通用页面 Chrome、服务器部署 |
| `TRANSPORT_NETWORK_GEOMETRY_DESIGN.md` | 运输地图公路／铁路首府物理中心线的数据源、离线派生、压缩及航空虚拟航路的数据边界 | 运输经济结算、战略地图 Camera／路线渲染、服务器协议与存储 |
| `STRATEGIC_MAP_RENDERING_DESIGN.md` | 战略地图 SVG Camera、固定视场边界、州名清晰度、路线显示／运动／高亮与地图专属表面材质 | 运输经济结算、原始 GIS 数据、全应用通用视觉与根 Chrome |
| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 页面模块归属、导航、页面内容与玩家信息架构 | 业务算法、通用视觉令牌、服务器事务和存储 |
| `MARKET_CHART_LAYOUT_DESIGN.md` | 市场行情图的布局、坐标、交互几何和浏览器回归 | 行情数据生成、撮合价格规则、通用 UI 设计系统 |
| `REGISTRATION_INVITE_FLOW_DESIGN.md` | 登录/注册/密码重置入口与邀请流程的玩家可见行为 | 通用表单视觉、账号服务安全与存储、部署路由实现 |
| `UI_DESIGN_SYSTEM.md` | 通用设计令牌、共享组件、州级中文短名、商品与工厂场景插画主视觉、视觉语义、响应式与可访问性 | 战略地图 Camera／路线渲染、单页业务内容、玩法资格、服务器逻辑 |
| `AUTHORITATIVE_COUNTDOWN_DESIGN.md` | 客户端权威时间、倒计时确认、状态读取恢复与 ready 生命周期 | 各业务领域的结算结果、普通页面内容、服务器容量 |
| `PRIMARY_SURFACE_INSET_DESIGN.md` | 玩家一级表面的统一外层内边距与贴边例外 | 通用卡片视觉、页面业务结构、其他布局系统 |
| `OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md` | 概览页布局完整性、宽度断点与局部几何回归 | 概览业务数据含义、通用响应式系统、服务器数据来源 |
| `PRODUCTION_PILL_ALIGNMENT_DESIGN.md` | 建筑页生产状态胶囊和开关的局部对齐几何 | 生产状态业务语义、通用控件设计、工厂算法 |
| `LIQUID_GLASS_CHROME_DESIGN.md` | 根外壳、通用毛玻璃材质与 Chrome、工作区及浮层层级结构 | 战略地图 Camera／路线渲染／地图专属表面材质、页面业务内容、通用表单/颜色令牌、经济规则 |
| `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` | 服务器权威、API、事务、存储、缓存、安全、容量与生产部署 | 玩家可见玩法定义、页面模块归属、通用视觉设计 |
| `CI_EXECUTION_DESIGN.md` | PR、分支、主线与手动 GitHub Actions 的选择、并行、分片、超时、发布前门禁和生产只读诊断执行安全 | 业务规则、服务器运行时实现、SQLite 维护语义、生产业务配置 |
| `LOCAL_ACTIVITY_LOG_DESIGN.md` | 浏览器本地活动记录的最小数据、迁移、展示与清除边界 | 服务器权威账本、市场撮合、全局通知系统 |
| `GIFT_CODE_AND_ADMIN_DESIGN.md` | 礼品码、管理员运营能力、管理审计和管理端专属规则 | 普通玩家通用页面、产业生产规则、服务器基础设施 |

<!-- design-registry:end -->

文档名称表达领域而不是版本。需要调整职责时直接修改现有 DESIGN 和本表，不新建 `*_V2_DESIGN.md`、`*_V3_DESIGN.md` 或 `*_SUPPLEMENT.md`。

## 4. 规则路由

| 修改内容 | 首要 DESIGN owner |
|---|---|
| 产品定位、总体玩法循环、玩家资产与总体经济语义 | `PRODUCT_AND_GAMEPLAY_DESIGN.md` |
| 商品、工厂、生产、配方、产业科技 | `INDUSTRY_AND_PRODUCTION_DESIGN.md` |
| 商业建筑、地区商品消费、营业周期、固定商业利润 | `COMMERCIAL_BUILDINGS_DESIGN.md` |
| 商品即时交易、每日官方系统价、内部人口／储备订单边界、历史挂单迁移 | `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` |
| 仓库、地区库存、运输、工厂自动经营 | `WAREHOUSE_EXPANSION_DESIGN.md` |
| 运输地图公路／铁路首府几何的数据源、离线生成及航空虚拟航路数据 | `TRANSPORT_NETWORK_GEOMETRY_DESIGN.md` |
| 战略地图 Camera、固定视场边界、地图路线显示／运动／高亮和地图专属表面 | `STRATEGIC_MAP_RENDERING_DESIGN.md` |
| 页面有哪些模块、导航到哪里、内容放在哪页 | `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` |
| 通用颜色、字体、控件、列表、响应式、可访问性 | `UI_DESIGN_SYSTEM.md` |
| 州级中文短名与跨页面州名视觉语义 | `UI_DESIGN_SYSTEM.md` |
| 商品与工厂场景插画主视觉 | `UI_DESIGN_SYSTEM.md` |
| 根外壳、通用毛玻璃材质、Chrome、工作区与浮层层级 | `LIQUID_GLASS_CHROME_DESIGN.md` |
| 市场行情图局部几何 | `MARKET_CHART_LAYOUT_DESIGN.md` |
| 概览、一级表面 inset、生产胶囊等局部布局专项 | 对应布局专项 DESIGN |
| 注册、邀请、登录入口的玩家流程 | `REGISTRATION_INVITE_FLOW_DESIGN.md` |
| 宝石加速与动态兑换 | `GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md` |
| 权威倒计时、状态读取恢复、ready 生命周期 | `AUTHORITATIVE_COUNTDOWN_DESIGN.md` |
| API、事务、状态协议、存储、缓存、安全、容量、部署 | `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` |
| CI 选测、分片、超时、主线发布门禁和手动生产只读诊断执行 | `CI_EXECUTION_DESIGN.md` |
| 浏览器本地成交/活动历史 | `LOCAL_ACTIVITY_LOG_DESIGN.md` |
| 礼品码与管理员专属运营能力 | `GIFT_CODE_AND_ADMIN_DESIGN.md` |

工厂场景插画主视觉归属 `UI_DESIGN_SYSTEM.md`；工厂目录排序只归 `FACILITY_CATALOG_PRESENTATION_DESIGN.md`。这里仅声明 owner，不复制插画尺寸、资源路径、构图或生成规则。

一个改动可以影响多份 DESIGN，但每条语义规则仍只能有一个 owner。其他受影响文档只描述本领域的接口或结果，并引用 owner。

设计文档必须保持紧凑：单份 DESIGN 不得超过 128 KiB，全部 DESIGN 总量不得超过 820 KiB；超过边界必须先消除跨文档重复、实现目录副本、验证字符串清单和历史过程，再考虑新增文档。

## 5. 修改规则

1. 一个语义规则只能有一个权威 DESIGN；README 不是业务权威来源。
2. 跨主题内容只引用 owner，不复制完整规则、参数表或算法。
3. 运行时常量、目录数据和协议版本以实现代码或正式数据文件为真实来源；DESIGN 解释含义、约束和兼容边界，不手工维护可由代码直接生成的第二份常量表。
4. 删除或替换设计时直接修改权威 DESIGN，只保留当前最终状态；不得保留历史章节、迁移过程日志或 intermediate attempts。
5. 设计和实现不一致时必须立即消除冲突；不得通过修改 README 或 verifier 文案来掩盖实现偏差。
6. 专项 verifier 应直接检查对应 DESIGN 与实现，不得要求根 README 或本索引复制业务字符串。
7. `scripts/verify-document-authority.mjs` 从上述登记表读取唯一文档清单，只阻断缺失／空文档、重复或未登记文档及失效的本地 Markdown 链接。登记表的机器边界标记和文件路径是结构契约；自然语言措辞、标题、章节顺序及合理篇幅不是硬门禁。篇幅检查仅提示，不声称证明语义没有重复或 README 没有越界；职责与语义一致性由设计审查确认。
8. `docs/*.md` 必须全部登记在本文；未登记 Markdown、补充说明和版本化平行文档不得存在。
9. 只有目录复杂到确实需要工程导航时才新增目录 README；新增后必须遵守本文目录 README 边界。
10. 只有形成或改变长期规则时才新增设计约束，并说明保护的风险、适用范围和验证方式；纯重构、措辞和恢复既定行为的修复不机械增加永久禁令。修改完成后按 `AGENTS.md` 执行对应验证、压缩合并与主线部署。

## 6. 阅读顺序

开始任务时先读 `AGENTS.md` 和本索引，然后只读取任务路由到的 DESIGN、实现、测试和 verifier。不要为了寻找一个局部规则把所有 DESIGN 当作一份连续规范加载，也不要根据 README 的高层介绍推断业务参数。
