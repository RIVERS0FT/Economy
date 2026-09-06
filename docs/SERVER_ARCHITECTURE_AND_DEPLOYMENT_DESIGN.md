# Economy 服务器架构与部署设计

> 州级运行时兼容别名的全量安装只允许在世界冷加载／迁移或同一 record 首次访问时执行一次；同一 `markets`／`facilityMarkets`／玩家 `inventories` record 的后续热查询必须复用已安装别名与迁移结果。运行时新增或删除默认州的单个 scoped 键时，只允许同步该资产对应的兼容别名，不得重新扫描整份 record。48 州需求周期会高频查询州级市场与库存，重复 O(州数 × 商品数) 属性扫描会阻塞 Node 事件循环并让正常 API 穿透 Nginx 30 秒超时。

> 生产文件同步必须同时受 deploy Job 20 分钟整体上限、单次 rsync 300 秒外层上限、60 秒 I/O 无进展上限与 SSH keepalive 约束；任一边界触发必须失败并保留步骤日志，不得让生产部署无限挂起。

## 1. 权威边界

州级访问不再是服务器业务资格维度：美国本土连续 48 州均直接可经营。客户端状态 39 与旧快照中的 `startingProvinceId`、`startingProvinceChosen`、`unlockedProvinces` 只作为兼容字段保留；新建玩家和迁移统一归一为 `startingProvinceId = 110000`、`startingProvinceChosen = true`、`unlockedProvinces = 连续 48 州`，任何服务器写动作不得据此拒绝合法州级操作。旧 `/api/game/provinces/starting` 与 `/api/game/provinces/unlock` 可保留兼容路由，但只能返回玩法已退役提示，不得扣款、发行资产或改变经营资格。

人口需求激活与州访问资格必须解耦：`activePopulationDemandProvinceIds` 不得读取兼容字段 `unlockedProvinces`；它只使用兼容默认经营地区 `startingProvinceId` 与实际工厂经营足迹决定需求州，避免取消地区解锁时顺带把既有全局消费预算稀释到连续 48 州。

市场储备不是玩家。服务器不得通过 `userId = 0`、负数 ID 或隐藏玩家档案模拟储备主体；储备采购合同使用 `publisherType = market_reserve` 与内部 `marketReserveGroupId`，储备清仓拍卖使用 `sellerType = market_reserve` 与同一需求组 ID，所有资金和商品直接结算到 `marketDemand.liquidity.groups` 的真实储备账户。普通玩家索引、排行榜、仓库、玩家统计和登录身份不得出现储备伪账号。

跨市场储备调节只在对应五分钟需求周期 `lastCycleId` 变化后评估一次，不新增每秒全商品扫描器；服务器现有权威世界推进先完成市场需求/储备订单重挂，再评估短缺合同和过剩拍卖，随后处理合同到期与履约。合同与拍卖的冻结必须与订单簿共享储备真实 `frozenCredits` / `frozenInventory` 总量且逐实体释放，审计事件把储备侧记录为系统账户。紧急储备卖单仍由订单簿周期创建，不新增独立定时器。

服务器唯一权威状态包括：

- 玩家可用资金、冻结资金、银行存款、贷款负债、宝石和邀请码；
- 三类人口真实钱包、冻结资金、就业收入、收入状态与消费状态；
- 商品可用与冻结库存；
- 按地区＋建筑类型保存的自动经营策略、地区出售授权、逐来源真实商品冻结，以及实际周期完成后执行的商品交易；
- 工厂集群、当前与待生效配方、统一周期、即时建设结果与银行冻结数量；
- 按州保存的商业建筑集群、营业意图、自动经营策略、已投入周期锁定收入及商品／成本明细、消费商品累计与商业结算审计；
- 商品每日官方系统价、玩家商品即时成交记录、服务器内部人口／储备订单，以及工厂正式估值状态；
- 市场储备真实资金、库存和双边订单；
- 玩家卖出手续费累计、市场服务就业收入、人口生产工资系数和即时建造业就业收入；
- 商品／工厂资产拍卖、卖方资产托管、最高出价冻结、发布费托管、卖方成交手续费、隐藏保留价、截止延时与追加式拍卖审计；
- 三类合同领域：地区化商品供货（含旧批次兼容）、玩家冻结借贷、工厂使用权租赁，以及对应当日额度托管／旧批次托管、冻结、保证金、旧兼容宽限、周期／到期结算与追加式合同审计；
- 银行利息池、风险准备金、工厂储备、贷款期限／宽限、每日最低存款余额、微单位利息余数与银行流水；
- 礼品码、每日签到、每周全勤、宝石流水、每日终端报价、报价决策、商店兑换、研发宝石加速审计与历史施工宝石加速只读审计；
- 邀请关系、Economy 注册记录、同 IP 异常事件、管理员手动封禁和审计；
- 排行榜、市场需求和系统统计。

浏览器只持有展示缓存、本地匿名成交记录、偏好、按教程版本／玩家 ID 隔离的客户端教程状态和在线运输节点规划意图。运输节点装卸规划可以由客户端根据已交付的玩家库存与州级行情计算，但不得直接修改权威资产；服务器仍重新校验周期世代、节点位置、真实车载货物、地区可用库存、容量和资金后才允许落账。浏览器不得决定资产、存贷款、利息、冻结、违约处置、邀请奖励、封禁、拍卖、合同交付、成交、配方、生产结果、商业周期结算或排行榜。

跨州运输继续使用 `transportShip` 的 `cycle-start` 与 `node-service` 两类权威操作推进。客户端负责节点装卸规划，但只能提交当前节点的装卸意图；服务端只结算当前到期运输段，并在每次 `node-service` 重新校验路线、周期、当前访问节点、真实车载货物、地区库存与容量。车辆抵达节点后进入 `docked`，不得因离线恢复一次跨越多个未来节点。`transportShipments` 与 `transportRoutes` 一并归入 `player.misc`，运输到站或装卸不得新增第七父分区或错误推进市场分区。

每趟运输启动事务保存服务器构造的 `policySnapshot`；后续耗时与节点容量读取快照，不读取最新模式参数。新版本快照标记商品燃料，服务器根据未取整的全线距离整趟向上取整一次，从起点真实 `available` 扣除 `industrial-fuel`，现金只扣运费。资金、动力燃料与燃料装货合计、其他货物和容量均在变更前校验；任一不足不能部分扣款或扣货。燃料估值只属于客户端预测，不能作为第二次现金扣款。客户端不能覆盖快照、费用、距离、库存或截止时间。旧现金燃料版本和无快照存量运输按共享兼容策略保留已付成本、数量、容量与当前段截止时间，不追缴商品燃料；新规则只用于新启动的趟次。具体业务取价、阈值和兼容规则唯一引用 `WAREHOUSE_EXPANSION_DESIGN.md`。

`node-service` 必须匹配当前 `cycleId + visitIndex`，同事务先卸后装并记录真实 `nodeHistory`。最终访问必须一次卸完车载货物；过期、重复、超量或部分最终卸货请求不能再改资产。活跃 `manifest` 不再携带推测目的地，只有历史交货项带真实卸货地；当前段与下一站继续使用独立字段。`nodeHistory` 投影复制实际站次、地区、时间与装卸数量，不下发来源批次内部资产信息。`deletionPending` 随路线持久化和投影；运行中删除只预约，最终返回并卸完时同事务删除路线，协调器和服务端均阻止再次启动。不新增顶层状态分区或周期补跑机制。

周期轮询、动作响应权威增量、六分区补丁和权威截止时间确认只负责传输服务器权威状态，不承担客户端选择、表单草稿、弹层、焦点或滚动位置的初始化和重置职责。客户端可以基于稳定实体 ID 保留交互状态；服务器只在实体删除、权限变化或动作确认中返回足以判定失效与冲突的权威数据，不通过刷新频率隐式驱动界面默认值。

工业目录升级的在途周期兼容按 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 执行。集群平衡版本、服务器成本生效时点、旧配方及旧成本随已有玩家段原子持久化，不新增资产类型或客户端可写配置。共享批量结算基线显式包含成本边界并参与指纹；服务端从持久化状态重建，不采纳请求中的价格。旧客户端提议基线不匹配时使用既有过期确认／服务器补算路径，不能静默以新成本解释旧提议。新老成本的工资、资金、产出及统计在同一事务落账。

## 2. 领域边界

- `domain.js` 是服务器领域公共门面；普通玩家可达 Action 的限流、Mutation Scope、确认语义和延迟预算由统一 Action 注册表声明。
- 市场、生产、仓库与运输、拍卖、合同、银行、研发、邀请／礼品码、人口需求分别由领域模块实现，但模块文件名和函数清单属于代码运行事实，不在 DESIGN 维护副本。
- 追加式审计与 SQLite 持久化属于服务器权威实现；任何资产变化必须与对应事务和审计原子一致。
- API、周期调度、状态投影和缓存只能传输或推进服务器权威状态，不得成为第二套业务规则来源。
- 玩家可见业务资格和经济语义引用对应玩法 DESIGN；服务器只负责权威校验、事务、存储、容量和安全边界。

## 3. SQLite 持久化

正式世界存储使用分段存储 V2，但仍共享一个全局世界修订号和一个 SQLite 事务边界：

```sql
economy_world_meta(
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL,
  world_version INTEGER NOT NULL,
  storage_schema_version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)

economy_world_players(
  user_id INTEGER PRIMARY KEY,
  updated_revision INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)

economy_world_segments(
  segment_key TEXT PRIMARY KEY,
  updated_revision INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)
```

旧 `economy_world` 只保留兼容迁移入口和轻量 manifest；完成 V2 迁移后不得继续把完整世界 JSON 写回该表。玩家行与世界顶层 segment 只是持久化粒度，不形成独立经济权威：资金、库存、订单、银行、拍卖和合同仍由同一全局 `revision`、同一 `BEGIN IMMEDIATE` 事务和同一回滚边界统一提交。

拍卖审计独立于世界 JSON 使用 `economy_asset_auction_events` 追加式事件表，保存稳定来源键、拍卖 ID、事件类型、真实内部参与者 ID、金额微单位、截止时间变化、规则快照摘要和发生时间。普通玩家只能通过独立只读接口获得固定最近 10 条匿名有效出价；审计真实参与者 ID、发布费托管、收费与退款明细不得进入六分区或主状态。拍卖动作和世界调度必须在保存世界后的同一个 `BEGIN IMMEDIATE` 事务内刷新审计；审计写入失败必须回滚世界、修订号、幂等确认、费用与资产变化。 异常结算需要退还发布费但卖方账户缺失时，服务器必须保持拍卖 `listingFeeStatus = held` 和世界级托管余额不变，追加 `listing_fee_refund_deferred` 事件；后续世界迁移必须继续汇总这类终态未释放托管，不得把无法送达的退款转为就业收入或无接收方扣款。

合同审计独立于世界 JSON 使用三张 SQLite 表：`economy_contract_audit_contracts` 保存可重建的查询摘要，`economy_contract_audit_events` 保存按 `contract_id + sequence` 排序的追加式事件，`economy_contract_audit_transfers` 保存每个事件的商品、货款、服务费和保证金流向。事件与转移表必须通过 SQLite Trigger 拒绝 `UPDATE` 和 `DELETE`，并以唯一 `source_key` 阻止幂等重试、重复调度和服务重启写入重复事件。摘要表可以由事件重建，不代替事件权威。

合同动作和世界调度必须在保存世界后的同一个 `BEGIN IMMEDIATE` 事务内写入审计，再更新内存世界缓存；审计插入失败必须回滚世界、修订号、幂等确认和审计。审计事件、资产转移和查询摘要不进入 `economy_world.state_json`。

商品供货合同议价线程属于公开合同的服务器权威轻量状态：每份合同最多 3 个同时进行中的线程，每个玩家最多一个进行中线程，每线程最多 5 轮，每次报价 24 小时无回应失效且不越过公开合同截止时间。世界 JSON 只保留当前有效报价，不保留完整聊天式历史；提出、反报价、接受、拒绝、撤回和过期都必须通过既有合同追加式审计形成可汇总事件。议价阶段不得冻结资金、商品、仓库预占或保证金；接受动作必须在同一事务内按最终条款重新运行正式供货合同签约校验，失败时不得留下已接受状态或修改公开条款。普通客户端投影只向发布者返回其收到的议价，向发起者返回自己的议价；其他玩家收到空议价数组，且客户端结构不得暴露 `proposerId`。

`GET /api/game/contracts/history` 必须在一次分页查询中返回合同原始条款与服务器终态摘要。终态摘要固定包含稳定结束原因、权威结束时间、按合同领域表达的完成数量／总量／比例，以及当前玩家视角的结束统计；赔付款必须区分“当前玩家支付”和“当前玩家获得”，不得只返回无方向的总额。商品合作统计累计交付、货款、服务费和净收入；玩家借贷统计本金发放、实际偿还和冻结工厂处置／退回；工厂租赁统计已结算期数、租金、服务费和净收入。资金、商品、保证金和冻结返还只统计实际审计转移，旧合同缺少转移事件时返回部分完整标记并保持缺失项为零。

历史查询的 `productId` 参数兼作玩家可见“合同标的”选择器：普通商品直接使用商品 ID，`credits` 只匹配玩家借贷，`facility:<facilityTypeId>` 只匹配对应工厂类型的工厂租赁；服务器必须同时约束合同领域与标的，不能把货币或工厂选择器当作商品 ID 查询，也不能只在客户端假筛选。

合同历史、履约档案和参与者审计详情的可见性必须覆盖发布者以及采购、供货、放贷、贷款、出租、租赁全部实际参与关系；借贷和租赁的非发布方不得因为旧审计摘要表只有 `buyer_id / supplier_id` 快速列而丢失自己的记录。商业合同参与关系以不可变审计 `contract_json` 中的 `lenderId / borrowerId / lessorId / lesseeId` 与现有快速列共同判定，第三方仍返回不可见。

旧有限批次商品合同的宽限结束只确认违约：服务器只写入违约责任与 `breachedAt`，停止后续自动履约并进入“已违约待解除”；与赔偿无关的托管资金、商品和无责方保证金按权威规则释放，责任方保证金或冻结继续冻结等待受偿方处理。已违约待解除合同不得通过事后补货、补款、还款、自动准备、自动补款、续签或恢复履约重新激活；受偿玩家必须再执行既有解除／领取动作完成赔付或冻结处置。该两阶段状态机属于既有合同权威边界，本次商品市场改为每日官方价即时交易不得改变。

普通玩家合同页只读取历史终态摘要，不读取审计事件时间线。`GET /api/game/contracts/:contractId/audit`、三张追加式审计表和防篡改 Trigger 继续保留，供参与者故障核查、管理员诊断和未来纠纷工具使用；精简玩家界面不得删除、改写或降级这些审计记录。

正式数据库：

```text
/var/lib/riversoft-economy/economy.sqlite
```

写事务固定：

1. 普通玩家写入若命中已到期世界截止时间，先通过同一权威写执行器完成调度 barrier；
2. `BEGIN IMMEDIATE`，并校验幂等缓存；
3. 从已完成冷迁移的 committed world 计算动作 Mutation Scope，只复制本动作可能写入的玩家和世界 segment；
4. 执行动作；正式调度启用时动作主体不得再次执行通用全世界推进；
5. 校验本动作可写范围内的资产、仓库、合同托管和经济状态不变量，并只对 Dirty Scope 做资金精度收口；
6. 将草稿与 committed snapshot 按声明范围比较，只有实际变化的玩家行和 segment 写入 V2 表，同时只增加一次全局修订号；
7. 在同一事务内写入合同／拍卖审计与精简幂等确认；
8. `COMMIT` 后把已提交草稿直接交接为新的 committed world。

完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载、旧单行世界迁移或世界版本升级时执行，不属于普通写事务步骤。动作失败回滚 SAVEPOINT 并丢弃草稿；数据库、审计或分段写入失败则整个外层事务回滚。

运行时内存状态必须区分**已提交世界（committed world）**与**请求草稿（world draft）**。正式服务命中内存缓存的玩家写入必须先通过 `createRuntimeMutationScope` 声明可写玩家与世界 segment，再由 `cloneWorldForMutation` 创建 Copy-on-Write 草稿：可写对象必须隔离复制，未声明对象允许与 committed world 共享引用且必须被视为只读。普通玩家可达 Action 必须先登记到统一玩家动作注册表并显式声明 Mutation Scope；正式 `scheduledProcessing` 服务遇到未登记 Action、未登记订单 execution、无法从参数推导安全 scope 或任何 `allPlayers`／`allSegments` 无界 scope 时必须拒绝请求，不得静默退回完整世界草稿。只有关闭正式调度的内存测试／兼容测试可以显式使用 full-world 草稿，以保持旧测试确定性。起始州选择与州解锁只修改当前玩家资金、统计和州访问字段，必须固定使用当前玩家局部 Mutation Scope；不得因这类 O(1) 玩家写入复制、比较或序列化全部玩家与全部世界 segment。工厂建造、启停、配方切换与自动经营策略的直接修改只涉及当前玩家；动作若结算到期生产，按本文周期交易规则额外纳入实际经营商品市场与可履约合同参与者。一键购料纳入对应材料市场键，不得因此退回完整世界草稿。正式玩家资料路由的昵称和头像修改只复制当前玩家与必要核心域，不得复制或重写 `orders`、`facilityListings` 等世界公共 segment；昵称权威值只保存在玩家行，订单内兼容 `ownerName` 不随正式资料改名回写。头像文件写入同样不得要求复制世界公共 segment。非显然原因是普通玩家订单与订单历史已经匿名化，订单身份由稳定 `ownerId` 决定；为改一个昵称回写历史订单会把 O(1) profile 动作放大成全局订单 segment 序列化与持久化。合同动作复制当前操作者、当前合同集合中的全部玩家参与者、`productionContracts` 与必要核心资金域，但不得复制无合同玩家或无关世界 segment；非显然原因是动作提交后的合同域统一后处理仍会遍历当前合同集合，因此 Copy-on-Write 必须覆盖该后处理可能触碰的全部合同参与者。旧设施挂牌动作只复制买卖相关玩家、`facilityListings` 与必要核心资金域。普通商品下单只复制下单者、当前价格可交叉的玩家对手方、订单／市场及必要核心资金域；商品撤单只复制下单者、订单及必要核心资金域；拍卖动作只复制相关卖方／当前最高出价者／当前操作者、拍卖及必要核心资金域。统一注册表同时为本地、市场和合同类交互声明 250ms、500ms、750ms 请求延迟预算；请求指标必须输出 `interactiveActionBudgetMs`、Mutation Scope 玩家数／segment 数／订单数／市场键数和 `unexpectedFullWorldAction`，超过动作自身预算、出现 5xx 或发现意外无界 scope 时进入异常请求日志。

V2 热保存不得做完整世界 `isDeepStrictEqual`、完整世界 `JSON.stringify` 或全世界资金精度扫描。保存层只序列化 Mutation Scope 覆盖的玩家与 segment，与 committed segmented snapshot 比较并形成 Dirty Set；没有 Dirty Row 时世界修订号保持不变。写入成功后草稿直接成为新的 committed world，未变玩家和 segment 的 SQLite 行内容及 `updated_revision` 必须保持原值。

玩家 V2 持久化行不得保存仅用于旧客户端展示的 `trades`、`ledger`、`assetEvents` 或旧 `facilities` 实例日志。Copy-on-Write 动作必须把这些字段视为可缺省展示数据：写动作不得因为字段不存在而失败，也不得为了兼容旧展示结构重新把它们写回玩家行；历史审计继续由各自独立追加式 SQLite 表承担。

失败动作、重复操作或其他无业务状态变化的动作可以保存精简幂等确认，但不得仅因兼容规范化、空数组补全、`lastProcessedAt` 更新时间或其他派生容器初始化而产生 Dirty Row、写回世界或推进全局 `revision`。这类结构迁移只允许发生在冷加载、旧单行世界迁移或明确世界版本升级。合同历史冷启动导入必须优先读取 V2 分段世界；只有尚未建立 V2 元数据时才允许回退读取旧 `economy_world.state_json`。

`GET state` 的正式投影路径必须是纯只读操作：已有玩家、无需登录周结算且后台调度启用时，缓存未命中也直接从 committed world 构造当前玩家状态、合同／拍卖／银行／研发／排行榜投影和六分区，不得创建 world draft，不得执行世界迁移、领域结算、全玩家兼容初始化或持久化，也不得再通过 `worldCacheIsolationCloneMs` 复制 committed world 来容忍投影写入。首次建档或登录周结算等确实需要写入的 GET 必须先完成权威事务，再从新 committed world 执行同一只读投影。

正式服务的到期世界推进仍由单一权威调度器负责。若普通玩家写入到达时全局最早截止时间已经到期，`runtime-store.js` 必须先建立一个可复用的系统调度 barrier，在同一权威写执行器中先完成一次到期世界处理，再放行随后到达的玩家写入；同一到期窗口不得由多个玩家请求重复承担全服推进。系统调度任务不继承玩家 HTTP 请求的性能采集上下文，玩家请求只记录等待 barrier 的 `schedulerBarrierWaitMs`，不得把系统 `worldProcessMs` 伪装成该玩家动作自身处理阶段。非正式调度的内存测试存储仍可在请求内按到期领域推进，以保持确定性测试。

订单历史清理截止时间只能由**可清理的关闭订单历史**触发：超过 800 条近期关闭历史时允许立即清理，未超过上限时按最早关闭订单的 24 小时保留期安排下一次清理。开放或部分成交订单属于不可清理权威状态，无论其数量达到数千或更多，都不得计入历史容量阈值、不得把 `orderPrune` 永久登记为 `now`。原因是生产环境可以合法长期保留大量开放订单；若用 `world.orders.length` 触发清理，而实际清理又必须保留这些订单，调度器会在每次无变化处理后继续判定同一领域立即到期，形成无业务变化的高 CPU 调度自旋并饿死 HTTP 事件循环。生产规模回归必须覆盖至少 13,000 条开放订单加 800 条近期关闭历史，并证明一分钟空闲窗口内不会产生清理事务或删除开放订单。

验证码记录清理、验证码创建／状态更新和完成前校验只写注册专用 SQLite 表（包括 `economy_email_verifications`），必须继续经过同一个权威写执行器串行化，但 actor 固定使用 `system:registration:*`，不得触发世界到期调度 barrier、世界草稿复制、资金规范化或世界分段比较。最终创建 Economy 玩家档案继续属于普通用户世界写入：验证码验证完成后真正创建玩家档案／发放邀请奖励的 `registration-profile-creation` 继续使用 `user:<id>`。

已有 `economy_registrations` 且永久邀请码元数据完整的 `/api/game/session` 必须直接读取注册、邀请和封禁 SQLite 状态并返回，不得进入权威写执行器、加载世界或等待 scheduler barrier；已有注册但缺失永久邀请码时只允许以 `system:session-metadata:*` 补齐该元数据。只有没有 Economy 注册记录、需要真正创建玩家档案的 session 才使用 `user:<id>` 的 `session-profile-creation` 世界写语义。慢 session 只记录模式、总耗时和写队列深度等非敏感诊断，不得记录 Cookie、密码、邀请码、邮箱或 IP。

市场需求模型 20 的州级规划阶段必须在同一个需求组内复用未发生订单写入前的行情统计和卖盘报价缓存，并在真正创建／撮合人口订单前清空该规划缓存；一次 `processMarketDemand` 中多个到期需求组必须复用同一份活跃州 PCE 权重。原因是三类人口 × 最多 48 州会重复读取相同商品行情和盘口，规划阶段数据静态时重复扫描只增加事件循环占用，不应改变统一订单簿撮合、资金守恒或后续订单可见性。连续 48 州完整需求周期必须有生产规模回归测试，并保持低于服务器请求超时预算。

普通商品 `placeOrder` 在上述到期 barrier 完成后必须直接复用 `applySettledCommodityOrder` 与统一订单簿撮合，不得再绕经会执行 `processFacilityGroupWorld` 的工厂动作适配层。普通商品下单与撤单必须使用动作专用 Copy-on-Write Scope；拍卖动作同样只复制本次交易可能修改的参与者与拍卖域。上述优化不改变订单冻结、撮合、成交价、手续费、幂等、全局修订号、资产守恒或统一订单簿语义。热保存只做 scoped money normalization 和 Dirty Row 比较／写入；完整资金精度收口只保留给冷迁移、完整世界升级和明确的全世界写入。

## 4. 世界迁移、状态交付与客户端版本

- 客户端状态版本唯一来源是 `server/shared/economy-state-version.js`；版本数值和最低兼容下限以该共享模块为准。商品燃料结算必须提高兼容下限，使旧现金燃料规划器不能继续消费新版运输投影，而通过既有入口刷新流程取得匹配客户端。运输投影继续复用 `transportRoutes` 与 `transportShipments`：路线只保存路径与运输方式，当前运输记录只携带节点循环所需的轻量当前段、当前车载摘要、每趟费用／燃料摘要和 `docked` 状态；普通玩家不存在手动 `route-dispatch`。商业目录 `commercialBuildingTypes` 与商品、工厂、研发和地区目录同为 catalog 完整快照的必需字段；否则会把同一玩家的工业建设入口保留在旧目录中而静默丢失商业建设入口。服务器响应、`src/types.ts`、浏览器合并器、README、DESIGN 和 verifier 不得维护独立版本常量。版本低于下限或高于当前值时返回明确的“客户端状态版本不兼容”，客户端只允许刷新入口 HTML，不得在旧 JavaScript 内原地重试状态请求。
- 客户端状态版本不兼容属于当前页面不可恢复错误。登录、注册、会话初始化和状态请求的网络异常转换为中文刷新提示，不得直接展示浏览器原生英文错误。
- 世界 32 是当前持久化边界，世界存储 schema 为 V2。世界级银行状态写入顶层 segment，玩家银行账户、冻结明细和统计随玩家行保存；全部权威资产仍共享同一全局修订号、SQLite 事务和回滚边界，不得形成第二套余额权威。
- 冷加载按实现中的领域迁移链把旧快照推进到当前世界与市场需求模型。迁移链必须幂等、资产守恒，并在兼容字段清理、科技节点补授和当前版本写回完成后才进入客户端序列化；具体顺序以领域实现为准，DESIGN 不维护第二份逐步清单。
- 迁移只补齐缺失状态、归一化旧结构或释放并重建系统订单。玩家资金、库存、工厂、订单、冻结资产、拍卖、合同、银行、真实成交、累计统计、订单优先级和运行中周期进度不得被复制、改写或重复结算。缺少地区的旧项目归入默认地区，持久化状态只保存一份 `provinceId:assetId` 权威记录。
- 破坏性或结构迁移必须先按第 8 节创建可校验的紧凑数据库快照；回滚同时恢复匹配代码与数据库快照。含已移除藏品项目的开放资产包必须整包取消并释放全部托管，不得删项后继续竞价。
- 六分区状态交付、父分区 revision、可选 `sliceRevisions` 和按需详情以 `state-partitions.js`、`state-delivery.js` 与 `market-detail` 实现为权威。`transportShipments` 与 `transportRoutes` 一并归入 `player.misc`，不得再让车辆到站或装卸变化推进 `market.misc`，也不得新增第七父分区。

`GET state` 支持 `?revision=N&catalog=<revision>` 式已知分区修订；六个父分区固定为 `catalog`、`player`、`market`、`auction`、`contract`、`leaderboard`。无变化时返回 `{ revision, unchanged: true, serverNow }`；有变化时每个返回的 `patches[name]` 都是该分区的完整快照，客户端整块替换同名缓存分区，字段缺失即代表该字段已经被服务器删除。`catalog` 的必需目录字段必须在完整快照中同时存在；客户端必须拒绝发布该坏状态并清空本地分区修订缓存，只允许自动执行一次无条件完整状态重拉。

`serverNow` 是状态交付 envelope 的顶层响应元数据，不属于 `EconomyState`、世界 JSON 或任何状态分区。每次 `GET state` 都必须生成当前值，不能在客户端每次接收轮询时重新解释为当前服务器时间；共享单调服务器时钟与 `X-Economy-State-Revisions` 请求头共同驱动完整快照过滤。

状态交付性能预算固定为：首次未压缩 JSON 响应必须不超过 2 MiB，状态读取 p95 不超过 800 ms，市场详情 p95 不超过 300 ms，事件循环 p99 不超过 200 ms。预算以真实构建与正式服务指标验证，不用牺牲权威完整性或匿名边界的方式达标。

普通商品市场状态摘要只允许携带玩家页面实际消费的当日 `officialPrice`、下次调价时间、当日买卖量、必要的轻量需求摘要与 24 小时成交摘要；不得复制服务器内部完整 `demand`、系统价格迁移诊断、旧 `cycleBuyQuantity`／`cycleSellQuantity` 别名、`priceHistory` 或零值公开盘口。商品盘口对玩家固定为空，只有独立市场详情接口负责返回有界成交历史与显式空盘口。

浏览器发布六分区前必须校验 catalog 完整性；初始或增量 catalog 缺失必需字段时事务式拒绝该次发布，清空分区修订缓存并只允许一次无条件完整重拉，重拉失败进入受控中文状态同步错误。

普通玩家权威动作的持久化幂等确认仍固定为 `{ result: { ok, message }, revision }`；动作事务和 `economy_idempotency.response_json` 只生成并保存这份精简确认。HTTP 传输层在事务提交且权威写执行器释放串行写队列之后生成，从当前 committed world 为当前玩家生成一次权威状态交付，`commandRevision` 表示该命令实际提交时的世界修订号。客户端先把动作响应中的权威状态送入与 `GET state` 共用的缓存再结束 pending；正常成功路径不得为了取得同一动作结果再追加一次 `GET state`。 手动商品即时买卖是延迟敏感例外：事务与幂等确认提交成功后，HTTP 立即返回 `{ result, revision, commandRevision, serverNow }` 精简确认，不等待提交后的全状态投影；客户端收到确认即结束交易 pending，再通过既有非阻塞 `GET state`／普通轮询恢复资金、库存与市场权威状态。该补拉失败不得把已经提交的成交改写为失败，也不得用新的幂等键重复成交。提交成功但本地增量验收失败时，补拉失败不得把已经提交成功的动作改写为失败，由非阻塞状态读取或后续轮询恢复。

具有明确目标且失败可恢复的直接控制允许维护独立于 authority 的客户端 Intent Overlay。Intent 只影响控件展示，不写入 `EconomyState` 或参与权威推导；快速连续目标按顺序发送且只允许一个请求在途，最新目标始终优先。

`EconomyStore` 必须在单进程内缓存已迁移、已清理的 committed world、对应全局修订号和 segmented snapshot。当前 V2 世界冷启动直接从 `economy_world_meta`、`economy_world_players` 与 `economy_world_segments` 重建；当 storage schema 和世界版本都已经是当前值时，重复重启不得再次执行完整迁移、重写分段行或增加修订号。旧 `economy_world.state_json` 只允许被读取一次完成 V2 迁移，迁移成功后改写为轻量 manifest。

正式服务必须启用单一全局到期调度器：`world-deadline-planner.js` 从运行中工厂周期、市场需求和价格传导周期、人口政策到期、开放拍卖、合同到期／宽限期／公开过期、银行每日结息、贷款到期／宽限结束、每日签到跨日、排行榜结算、运输当前在途段到站与订单历史裁剪中选出最早绝对时间，只设置一个 `setTimeout`；没有到期事件时不得进入 SQLite 世界事务。调度器最多每秒推进一次到期世界；玩家写入到达已过期截止时间时，`runtime-store.js` 必须先复用同一权威写执行器中的调度 barrier 完成一次推进，再执行玩家动作。调度器对当前世界调用工厂、拍卖、排行榜等处理器时必须传递 `migrate: false`；完整迁移仅属于冷加载。

同修订号状态请求必须在进入 SQLite 事务前直接返回轻量确认。不同修订号但无需登录周结算的已有玩家状态读取，同样直接从 committed world 纯只读投影；基础客户端快照、合同、拍卖、银行、研发和排行榜必须复用同一 committed world。投影辅助函数不得通过“规范化”修改源世界，例如订单公开序列化必须先复制订单再补兼容字段。分区和子切片哈希只由业务内容驱动，客户端投影缓存不得以复制完整世界来容忍副作用。

工厂、拍卖、合同、银行和排行榜的时间推进统一由运行时世界处理路径完成，禁止通过原型钩子在 `getStateSnapshot`、`apply` 或商店读取前后重复执行。正式服务的普通玩家动作在进入自身事务前由调度 barrier 保证已到期领域完成一次权威推进，动作事务本身不得再执行通用动作前／动作后全世界处理；只有合同动作等确实需要立即完成本领域状态转换的路径可以执行本领域专项后处理。关闭正式调度的内存测试可以在请求内按实际到期领域推进，以保持确定性。普通轮询不得承担时间推进，正式服务的全局调度器保证到期处理延后不超过 1 秒。排行榜视图在生成当前玩家客户端状态时注入，不得为了不同查看者把同一榜单快照重复写入世界。保存前只对 Mutation Scope 做一次资金精度收口；实际变化由分段 snapshot 的 Dirty Set 比较确定，只序列化可能变化的玩家行和 segment，并只写入内容真实变化的行。事务回滚必须同时恢复数据库和内存缓存。

空闲状态读取不得仅因服务器时间推进而修改 `lastProcessedAt`、`lastEconomicActivityAt`、增加修订号或写回相同的 `state_json`。只有成功经济写操作可以刷新玩家活跃时间，失败操作、轮询和后台生产不得刷新。管理员世界概况与玩家运营统计只返回只读诊断；活跃玩家数、库存价值、财富分位数和留存不得用于扩张人口需求预算。旧兼容字段 `lastPlayerScaleBudget` 与 `lastInventoryBoost` 必须保持停用和零值。只有处理生产、拍卖、合同、银行或排行榜时结构结果实际变化才允许保存并增加修订号。普通动作与合同动作即使业务返回失败仍必须保存幂等确认，但只有缓存世界结构实际变化时才能更新 `economy_world` 与递增修订号；失败或无变化动作不得制造全服状态补拉。

多输入配方以 `inputs[]` 为唯一正式结构。服务器必须先合并相同商品输入并检查全部库存、资金和仓库条件，再在同一事务中扣除所有输入；任一输入不足时不得发生部分扣料。世界版本 8 升级到 9 时，正在运行的电子厂周期从迁移时刻重新开始，以避免旧塑料单输入周期按新双输入规则结算。

### 4.1 管理员玩家运营统计

`player-admin-statistics.js` 是玩家运营分析的唯一服务器模块，负责建立 `economy_player_activity_daily`、`economy_player_milestones` 与覆盖元数据表，在现有世界写事务中记录成功经济写操作、生产／成交／合同结算增量和首次里程碑，并从已迁移世界与 SQLite 聚合只读统计。分析数据不进入世界 JSON、客户端状态、状态分区或世界修订内容，读取统计不得仅因生成报表而推进世界修订。

成功经济写操作只有在业务动作成功并刷新 `lastEconomicActivityAt` 时写入日活动；失败请求、幂等重放、轮询和管理员读取不得重复计数。后台生产、成交和合同自动结算只能写入对应参与量，不得计为玩家经济活跃。分析写入与世界保存、动作幂等响应共享同一 SQLite 事务，任一步失败必须整体回滚。

管理员接口固定为 `GET /api/game/admin/player-statistics?range=7d|30d|90d`，只返回聚合快照、时间序列、留存、漏斗、经营参与、财富分布和关注群体。响应携带 `coverageStartsAt`、北京时间范围和历史完整性；覆盖前不得通过 `lastEconomicActivityAt` 反推伪造日活动或留存。接口必须再次校验管理员权限，不返回邮箱、IP 指纹、邀请码、管理员备注、逐玩家资产或订单对手。

活跃玩家数、库存价值与分析分位数仅用于运营诊断，不参与消费需求预算、稳定需求、价格传导、市场储备或排行榜。旧兼容字段 `lastPlayerScaleBudget` 与 `lastInventoryBoost` 必须保持停用和零值，不得恢复玩家规模预算或库存追加预算。

## 5. 请求安全、账号认证与 Economy 注册

- 只接受正式站点的同源或可信 same-site 请求。
- 使用主页账号 Cookie，不接受客户端自报用户 ID 或角色。
- `GET /api/game/state`、`GET /api/game/market-detail` 与 `GET /api/game/facility-build-quote` 最多复用 10 秒认证结果，普通写操作最多复用 2 秒，`/api/game/admin/` 每次重新验证且不读取缓存。
- 401 只缓存 1 秒；超时、无效响应、502 和 503 不缓存，也不得使用过期结果执行资产写操作。
- 缓存键只保存完整 Cookie header 的 SHA-256 摘要，使用最多 5,000 条的 LRU。
- 同一摘要的并发未命中共享一个上游验证 Promise，并在 `finally` 中移除。
- 所有资产、签到、邀请与管理员写操作要求 8～128 字符的 `Idempotency-Key`。
- 服务器重新校验价格、数量、资金、库存、仓库、工厂、订单归属、拍卖资产归属与冻结、合同参与者与托管、邀请码、封禁和管理员角色。
- 禁止玩家自成交；任何两个系统商品订单也必须禁止互相成交。储备买单必须验证并冻结真实储备资金，储备卖单必须验证并冻结真实储备库存。卖家不得竞拍自己的商品或工厂，玩家不得填写自己的邀请码，也不得承接自己发布的合同。
- 每名玩家最多 10 笔未完成商品／工厂订单、10 份公开合同和 20 份进行中合同。
- Nginx 游戏 API 请求体上限为 256 KB；普通 JSON 仍由应用限制为 16 KB。
- 生产 HTTPS `server` 必须由 `scripts/configure-economy-nginx.py` 统一维护动态 gzip：`gzip_vary on`、`gzip_proxied any`、最小长度 `1024`、静态资源压缩级别 `6`。超过 1 KB 的 HTML、JavaScript、CSS、JSON、SVG、Web Manifest、XML 与 WASM 必须压缩；游戏 API `location` 继续使用面向 JSON 的压缩级别 `5`。PNG、JPEG、WebP、AVIF 与 WOFF2 等已经压缩的媒体和字体不得加入 `gzip_types` 重复压缩。`/economy/assets/` 与 `/economy/` 两个静态 `location` 必须直接输出 `Vary: Accept-Encoding`，不得只依赖服务器级继承；资产位置原有 `Cache-Control` 必须保留。哈希静态资源缓存固定为 365 天，使用 `public, max-age=31536000, immutable`；入口 HTML 固定使用 `no-cache, max-age=0, must-revalidate`，确保刷新页面重新验证并取得最新资源地址。`scripts/configure-economy-static-cache.py` 必须幂等修补这两个位置、通过本机正式 HTTPS 验证入口与实际构建资源的缓存头，并在验证失败时回滚配置。配置脚本必须扫描 `sites-enabled`、`conf.d`、`sites-available` 与 `snippets` 四个 Nginx 配置根目录，按解析后的真实路径去重，并修补位于主 `server` 文件或任意被 include 的独立 snippet 中的 Economy 静态位置；扫描时必须跳过 `.bak`、`.backup-*` 与 `.economy-proxy.bak` 等备份文件，已规范的 `Vary` 指令必须保持幂等。脚本必须清除目标 `server` 中冲突的顶层 gzip 指令、写入唯一托管块并保持重复执行幂等；`scripts/configure-economy-nginx.py` 重载 Nginx 后必须通过 `--resolve game.riversoft.top:443:127.0.0.1` 命中本机正式 HTTPS 与 TLS SNI 入口，禁止使用可能返回 301 跳转页的 80 端口；Nginx reload 后必须在 5 秒窗口内对旧 worker 导致的缺 gzip、缺 `Vary` 或本机 curl 暂态失败进行有限重试，确定性内容错误必须立即失败；必须以 `Accept-Encoding: gzip` 实测 HTML、实际构建 JS 与 CSS，要求 `Content-Encoding: gzip`、`Vary: Accept-Encoding`、压缩流可解码且正文与磁盘源文件一致，线上压缩响应体必须小于构建产物原始字节数；任一检查最终失败必须恢复旧配置并重新加载 Nginx。
- Nginx 修改前备份只能写入 `/var/tmp/economy-nginx-backups`，不得留在 `sites-enabled`、`conf.d` 或 `snippets` 等 Nginx 会加载的目录；主配置脚本发现 `sites-enabled` 内残留备份文件必须立即失败并列出路径。
- 单进程操作限流缓存每分钟清理已过期桶，并限制最多 10,000 个用户／类别桶；不得让历史用户键永久累积。

### 5.1 Economy 注册、邀请归因、异常上报与管理员封禁

“Economy 注册完成”的准确时点是：某个统一账号第一次创建 Economy 玩家档案。任何已登录主页账号首次进入 Economy 时仍允许自动创建玩家档案，并在同一事务记录 Economy 注册 IP 指纹、邮箱、完成时间和来源；不得要求该账号再次走验证码注册。邮箱验证码注册完成接口是另一条首次建档入口，两条入口必须共用同一首次建档、邀请归因、IP 检测和记录逻辑。

统一账号密码重置由主页账号服务权威处理，Economy 游戏服务不得保存密码哈希、重置验证码或会话失效状态。Economy 只通过 Nginx 暴露同源 `/economy-api/password-reset/` 代理到主页 `127.0.0.1:3001/api/password-reset/`；发送验证码前的已注册邮箱确认、验证码校验、密码更新和旧会话失效均由主页账号服务完成。

主页已经完成账号信任与邮箱验证，但邮箱验证码注册和来源为 `homepage_session` 的首次建档仍统一执行注册 IP 规则。Nginx 必须覆盖并传入可信 `X-Real-IP`；应用优先使用该值，避免客户端伪造 `X-Forwarded-For`。只保存由服务器秘密 HMAC 生成的注册 IP 指纹，不保存或展示明文 IP。

同一注册 IP 指纹出现两个或更多不同统一账号时，服务器只创建或更新异常事件、补充事件成员并写事件审计，不得自动写入、恢复或扩大账号封禁。服务启动扫描只补齐异常上报。已复核或已关闭事件出现新成员时重新进入待复核，但成员普通游戏访问不受影响。

只有管理员可以手动封禁单个账号或事件全部成员。封禁、解禁、复核和关闭均要求 1～240 字管理备注与 `Idempotency-Key`，并在同一 SQLite 事务写入状态和审计。封禁账号访问普通 `/api/game/` 接口返回 `423 Locked`、`ECONOMY_ACCOUNT_BANNED` 和关联事件编号；异常事件本身不得触发 423。管理员接口每次重新验证管理员角色，管理员账号被手动封禁时仍可访问管理员接口完成复核。

历史由系统产生且仍活动的 `duplicate_registration_ip` 封禁在迁移时一次性解除并恢复为待复核事件；管理员已有手动封禁保持不变。服务重启或新账号加入异常事件都不得改变管理员封禁决定。

每名玩家拥有一个服务器生成的永久 8 位邀请码。分享链接和注册表单邀请码只在首次创建 Economy 玩家档案时归因。相同注册 IP 的邀请关系记录为 `blocked_same_ip` 且不发放宝石，但双方账号不会因此被封禁；管理员后续处理不得自动补发奖励。注册事务提交后，已有 Economy 档案不得补绑、重复奖励或更换邀请人。

### 5.2 邮箱验证码

## 6. 注册、密码重置与游戏 API

注册公网前缀 `/economy-api/registration/`，内部前缀 `/api/registration/`。

| 方法 | 公网路径 | 内部路径 | 用途 |
|---|---|---|---|
| POST | `/economy-api/registration/email-code` | `/api/registration/email-code` | 发送邮箱验证码 |
| POST | `/economy-api/registration/complete` | `/api/registration/complete` | 校验验证码、统一账号、邀请链接、同 IP 规则并首次建档 |

密码重置公网前缀 `/economy-api/password-reset/`，由 Nginx 直接代理主页账号服务 `/api/password-reset/`。

| 方法 | 公网路径 | 主页内部路径 | 用途 |
|---|---|---|---|
| POST | `/economy-api/password-reset/email-code` | `/api/password-reset/email-code` | 确认邮箱已注册后发送密码重置验证码 |
| POST | `/economy-api/password-reset/complete` | `/api/password-reset/complete` | 校验验证码、更新统一账号密码并使既有会话失效 |

游戏公网前缀 `/economy-api/game/`，内部前缀 `/api/game/`。

| 方法 | 内部路径 | 用途 |
|---|---|---|
| POST | `/api/game/session` | 已登录账号首次建档、分享链接归因与封禁状态初始化 |
| GET | `/api/game/state` | 获取六分区初始状态、增量补丁或带 `serverNow` 的修订号轻量确认 |
| GET | `/api/game/invitations` | 获取宝石余额、邀请码、分享链接和邀请统计 |
| POST | `/api/game/invitations/claim` | 已永久移除；固定返回 `410 Gone`，不得读取或写入邀请业务状态 |
| GET | `/api/game/gem-shop` | 获取今日终端报价、接受／放弃状态、兑换边界、累计与最近记录 |
| POST | `/api/game/gem-shop/exchange` | 接受今日报价并原子扣除宝石、增加普通货币；每天一次 |
| POST | `/api/game/gem-shop/quote/reject` | 明确放弃今日报价；当天不可恢复 |
| GET | `/api/game/community-link` | 获取侧边栏社区跳转链接 |
| POST | `/api/game/facilities` | 按 `provinceId` 建设当地工厂；可选在同一地区事务内 FOK 购齐缺少的正式建造材料 |
| POST | `/api/game/facilities/construction/accelerate` | 已退役兼容墓碑，固定返回 `410 Gone` 且不进入经济事务 |
| POST | `/api/game/facilities/:facilityTypeId/start` | 开启工厂集群 |
| POST | `/api/game/facilities/:facilityTypeId/pause` | 停止工厂集群 |
| POST | `/api/game/facilities/:facilityTypeId/recipe` | 设置当前或下一周期配方 |
| POST | `/api/game/orders` | 按 `provinceId` 创建本地商品或工厂订单 |
| POST | `/api/game/orders/:orderId/cancel` | 撤销订单 |
| POST | `/api/game/warehouse/upgrade` | 已退役兼容墓碑，固定返回 `410 Gone` 且不进入经济事务 |
| POST | `/api/game/bank/deposits` | 把可用资金存入银行账户 |
| POST | `/api/game/bank/withdrawals` | 把银行存款取回可用资金；宽限期禁止 |
| POST | `/api/game/bank/loans` | 按 `provinceId + facilityTypeId + quantity` 工厂冻结明细与服务器额度评估发放唯一进行中贷款 |
| POST | `/api/game/bank/loans/:loanId/repay` | 使用可用资金部分或全部偿还，先息后本 |
| POST | `/api/game/bank/loans/:loanId/auto-repay` | 设置到期自动还款；先存款后可用资金 |
| POST | `/api/game/gifts/redeem` | 兑换礼品 |
| POST | `/api/game/auctions` | 以 `items[]`、起拍价、可选隐藏保留价和时长创建资产包拍卖；原子扣除发布费并冻结资产 |
| POST | `/api/game/auctions/:auctionId/bids` | 按服务器最低加价对整个资产包竞价，更新资金冻结、匿名摘要和必要的截止延时 |
| GET | `/api/game/auctions/:auctionId/bids` | 固定返回最近 10 条匿名有效出价，最新在上；不分页且不暴露真实竞买身份 |
| POST | `/api/game/auctions/:auctionId/cancel` | 取消无出价资产包拍卖 |
| POST | `/api/game/contracts` | 发布长期采购或供应合同 |
| POST | `/api/game/contracts/:contractId/accept` | 承接合同并冻结首批货款与双方保证金 |
| POST | `/api/game/contracts/:contractId/cancel` | 取消本人尚未承接的公开合同 |
| POST | `/api/game/contracts/:contractId/prepare` | 供应方手动准备本批商品 |
| POST | `/api/game/contracts/:contractId/fund` | 采购方手动补充本批货款 |
| POST | `/api/game/contracts/:contractId/auto-reserve` | 设置供应方自动准备 |
| POST | `/api/game/contracts/:contractId/auto-fund` | 设置采购方自动补款 |
| POST | `/api/game/contracts/:contractId/request-termination` | 申请当前批次完成后结束 |
| POST | `/api/game/contracts/:contractId/terminate-now` | 立即违约终止并赔付保证金 |
| GET | `/api/game/contracts/history` | 按最终状态、角色、商品、日期与游标读取当前玩家参与的合同审计摘要 |
| GET | `/api/game/contracts/:contractId/audit` | 按游标读取参与合同的条款、累计对账、追加式事件与资产转移 |
| ANY | `/api/game/collectible-auctions*` | 已永久移除；固定返回 `410 Gone`，不得读取或写入业务状态 |
| ANY | `/api/game/admin/collectibles*` | 已永久移除；固定返回 `410 Gone`，不得读取或写入业务状态 |
| PATCH | `/api/game/profile` | 修改昵称 |
| GET | `/api/game/save-deletion/preflight` | 返回删除存档阻止事项、一次性额度和可自动关闭项目 |
| POST | `/api/game/save-deletion` | 精确确认后原子删除当前经济存档并恢复新玩家初始状态 |
| POST | `/api/game/reset` | 已永久移除；兼容旧客户端固定返回 `410 Gone`，不得执行任何状态写入 |
| GET | `/api/game/admin/community-link` | 管理员读取社区跳转链接 |
| PUT | `/api/game/admin/community-link` | 管理员幂等更新社区跳转链接 |
| GET | `/api/game/admin/bans` | 管理员查看同 IP 异常事件 |
| GET | `/api/game/admin/bans/:incidentId` | 管理员查看事件成员 |
| POST | `/api/game/admin/bans/users/:userId/ban` | 管理员封禁单个账号 |
| POST | `/api/game/admin/bans/users/:userId/unban` | 管理员解禁单个账号 |
| POST | `/api/game/admin/bans/users/:userId/reban` | 管理员重新封禁账号 |
| POST | `/api/game/admin/bans/:incidentId/ban-all` | 管理员封禁事件全部账号 |
| POST | `/api/game/admin/bans/:incidentId/unban-all` | 管理员解禁事件全部账号 |
| POST | `/api/game/admin/bans/:incidentId/review` | 管理员标记事件已复核 |
| POST | `/api/game/admin/bans/:incidentId/close` | 管理员关闭事件 |

旧工厂固定挂牌路由只作迁移兼容。旧 `/api/game/facilities/:facilityTypeId/plan` 返回 `410 Gone`，不得恢复生产模式或目标产量。

人口饮食需求以 `world.demandGroups.staples` 为唯一预算周期状态，每周期最多承诺 330，在食品、小麦、水稻、肉、蛋和奶间按卖盘深度、效用、偏好和预算上限分配。六种商品不得生成独立人口订单，满足率按效用计算。棉花、毛、铜矿石、铜材和纺织品只保留基础流动性，不生成独立人口消费；家具和服装共享 `household-goods` 固定预算。

### 6.1 商店事务

商店固定使用 1 宝石兑换 10 普通货币，单次接受 1～100 的整数宝石。`POST /api/game/gem-shop/exchange` 必须先通过封禁检查和普通写操作限流，并要求 `Idempotency-Key`。在一个 `BEGIN IMMEDIATE` 事务中完成宝石余额校验、扣除宝石、增加可用资金、普通货币账本写入、`economy_gem_shop_exchanges` 插入、世界修订号更新和精简幂等确认保存；任一步失败全部回滚。

`GET /api/game/gem-shop` 只返回服务器固定汇率、当前余额、累计值和最近 20 笔兑换。客户端预览不得成为结算依据。相同幂等键重试返回第一次精简确认，不重复扣除或发行；不同路径复用幂等键继续返回冲突。

### 6.2 社区入口配置

QQ群入口与经济世界快照分离，保存在 `economy_settings`，修改链接不得推进世界修订号。默认地址为 `https://qm.qq.com/q/eN8hya0Yn0`；普通已登录玩家可以读取，只有管理员可以写入。写接口要求 `Idempotency-Key`，并只接受长度不超过 2048、无账号信息的 HTTPS URL，避免脚本协议、明文 HTTP 和带凭据地址进入侧边栏。

### 6.3 长期生产合作合同事务

每日额度商品合同直接参与权威生产输入择源，但不创建第二套库存或订单系统。每次正式生产结算前，服务器按工厂所在 `provinceId + productId` 计算当次真实投入需求，并读取同地区统一商品订单簿完成该需求所需的边际可执行卖价；只有 `contract.unitPrice < executableMarketPrice` 时才按固定价从最低价有效采购合同开始消费当日剩余额度，随后使用本地仓库，仍不足时复用统一订单簿即时采购与现有经济回滚边界。市场不比合同贵时不主动消费较贵合同，直接使用本地仓库并只为仓库缺口采购市场。供应合同的自动商品预留可以使用供应方私有 `minDailyProduction + minContractPrice` 条件；当日真实产量只由正式生产结算后的产出增量派生，多个符合条件合同按合同价高者、承接早者、合同 ID 排序。所有合同货物、市场补购与生产扣料均严格地区隔离。客户端状态版本继续使用共享当前协议版本、世界状态版本继续为 32；本次合同字段通过兼容别名与现有分区增量投影交付，不单独扩大客户端兼容窗口。

每日额度商品合同承接时，采购方和供应方分别冻结“固定价格 × 每日最大供应量”的 20% 履约保证金；采购方自动补款和供应方自动准备只为当前北京时间自然日剩余额度冻结真实货款／商品，不能透支未来资金、未来产量或其他地区库存。合同实际使用可以小于每日额度，并按每次真实取得数量即时转移同地区商品、扣除固定价货款和累计 1% 卖方市场服务费；未用满额度本身不是违约。跨日时先释放上一日未使用货款和商品预留，再把 `dailyUsedQuantity` 归零并按自动设置准备新一天。

正式世界处理对旧有限批次合同继续维持到期生产、自动准备、批次结算与宽限；每日额度合同只在实际生产输入择源、手动／自动当日托管、北京时间自然日边界和合同到期边界推进，不因“当日额度未用满”启动宽限或违约。玩家商品写动作不进入开放订单簿：服务器在同一事务内读取州×商品当日 `officialPrice` 并即时结算资金、地区库存、卖出手续费、成交记录与当日买卖量。世界级截止时间机制通过北京时间每日 00:00 唤醒完整世界处理并按前一自然日玩家↔系统买卖量失衡更新官方价；重复处理同一 `priceDateKey` 不得重复调价。`world.systemMarketAudit` 继续作为顶层 segment 随事务持久化且只用于服务器审计。服务器内部人口／储备订单撮合与玩家即时交易严格分离，普通玩家状态不得下发内部订单深度。

合同交付不得写入统一订单簿、最近真实成交价、市场价格历史、商品或工厂估值以及交易排行榜。卖方合同货款按单份合同累计成交额精确收取 1% 市场服务费，并沿既有市场服务就业规则进入人口钱包。合同状态、交付时间、宽限期与违约只能由服务器权威时间判定。旧有限批次／市场储备合同的处理、动作或客户端序列化只能对旧合同视图建立一次 `contract-runtime-index.js` 派生索引；采购方下一批仓库预占、旧公开合同数量、旧参与者进行中合同数量和合同 ID 查询必须读取该索引，不得在每份旧合同容量检查中再次遍历全部合同。旧合同进入或离开 `active` 状态、完成批次、过期、取消或终止时必须同步刷新索引计数；索引不进入世界 JSON、客户端分区、分区哈希或 SQLite，事务回滚后直接丢弃。每日额度商品合同由 `daily-supply-contracts.js` 的地区＋商品＋参与方条件直接派生当日额度和托管状态，不得伪造“下一批仓库预占”，也不得为了兼容旧索引重复建立第二个全合同索引。

合同审计必须同时区分新每日额度事件与旧兼容事件。每日额度合同的追加式审计覆盖发布、承接、议价、自动准备／补款设置变化、手动准备／补款、每次真实部分交付、当前日结束申请、有限合同到期、立即违约终止和保证金赔付；北京时间跨日的未用额度释放与重置属于权威状态推进，当前不伪造独立审计事件。交付事件必须记录真实 `lastDeliveryQuantity / lastDeliveryGross / lastDeliveryFee`，不得把每日上限伪装成实际交付量。旧有限批次合同继续保留原发布、批次准备／补款、宽限、逐批成功交付、续签、违约确认与受偿方领取事件。每个事件保存稳定事件类型、执行主体、触发类型、服务器事务时间、原因代码、前后紧凑快照和资产转移；玩家查询不得返回请求幂等键、来源哈希、世界修订号或其他玩家的非合同资产。旧世界既有合同只允许按已有审计完整度读取，不根据缺失字段伪造过程。

合同审计查询只允许合同实际参与者访问：发布者以及采购、供货、放贷、贷款、出租、租赁对应玩家均按权威参与关系判定；第三方不可见。审计读取不参与普通状态认证缓存之外的写操作，也不改变世界修订号。历史列表默认 20、最大 100，详情事件使用稳定游标分页。审计读取独立于六分区交付，不进入 `contract` 分区、分区哈希、世界缓存或五秒轮询；合同审计差异收集只能复用既有动作／调度前后合同快照和一次 O(C) 仓库原因派生，不得为每个合同重新遍历全部合同或建立第二个运行索引。

玩家贷款承接时从出借方可用资金原子转移本金到借款方，并锁定借款方冻结工厂；冻结工厂继续生产，但不得出售、拍卖、银行冻结、重复借贷冻结或出租。到期优先按自动还款设置从可用资金结清本金和固定利息；宽限结束仍不足时只确认借款方违约，并按当时审慎价格的 80% 锁定处置单价与“足以覆盖欠款的最少冻结数量”快照，不得立即转移工厂。冻结在等待期间继续锁定且不得通过迟到还款恢复合同；只有出借方主动执行“解除合同并处置冻结”时才按已锁快照转移对应数量并结束合同。未偿本金在最终处置前继续分别计入出借方合同应收和借款方合同负债，未支付利息不提前计入净资产。

工厂租赁承接时冻结首期租金和双方 20% 保证金。所有权和资产毛值仍归出租方；出租数量退出合同地区内出租方生产，租入数量加入承租方同地区同类型集群，承租方承担当地原料与运营成本并取得当地产出。承租方必须具备对应研发等级。欠租时使用权立即暂停并进入宽限；当前服务器时间前已经完成的生产周期先结算，合同变化不得回滚产量。宽限结束仍欠租时只确认承租方违约：未使用租金与出租方保证金立即退回，租赁使用权和出租方资产锁定立即解除，承租方保证金继续冻结；只有出租方主动执行“解除合同并领取违约金”后才划转该保证金并结束合同。每期租金和玩家贷款利息分别按累计口径收取 1% 服务费。

### 6.4 银行事务、利息与冻结不变量

`server/src/banking.js` 是银行状态与结算的唯一权威实现。存取款、放款、还款和自动还款设置都通过现有普通游戏动作进入 `BEGIN IMMEDIATE`、幂等缓存、世界迁移、动作前推进、动作执行、动作后推进、资产校验与修订写回；相同幂等键不得重复转账、重复放款、重复还本付息或重复改变自动还款。

工厂冻结只限制转让。服务器计算工厂生产可用数量时只扣同地区订单簿和拍卖冻结，计算订单簿卖单、拍卖和新增冻结可转让数量时再扣同一 `provinceId + facilityTypeId` 的当前贷款冻结。贷款评估使用冻结地区的 `min(systemValue, lastTradePrice)`，当地无真实成交时使用 `systemValue`；客户端预览不得覆盖服务器重新计算。放款同时增加玩家可用资金和同额本金负债；还本从玩家资金扣除并减少本金负债，二者不进入人口就业收入。

借款人实际支付利息按整数最大余数法精确拆分为存款利息池 70%、人口银行服务就业 20% 和风险准备金 10%。银行服务就业固定按基础人口 10%／技术人口 60%／专业人口 30% 分配。未付利息不得进入任何池；拆分之和必须精确等于本次已支付利息。银行利息池使用百万分之一普通货币的整数微单位保存，风险准备金和已入账存款使用整数普通货币。

每日结息按 `Asia/Shanghai` 00:00 进入统一截止时间调度。只有成功经济写操作激活的当前自然周具备计息资格；有效计息余额是日初与当日最低存款的较小值，当日新增存款不得参与当日结息，取款、自动还款从存款扣除时必须同步降低最低余额。服务器按每日固定 1% 向下结算到六位微单位并直接计入存款，贷款利息池优先支付，缺口明确计入补贴发行。利息池最多保留按当前总存款和固定日利率计算的 7 日额度，超出部分转入风险准备金。

贷款到期时自动还款先扣银行存款再扣可用资金；不足进入 12 小时宽限期并暂停取款。宽限结束再次自动还款后仍有负债才允许违约处置。处置前必须已经通过统一世界处理结算到该时间的完整生产周期；按当前审慎单价 80% 和最少足额数量移除冻结工厂，先息后本，多余价值进入银行存款，缺口先由风险准备金吸收后核销。银行储备工厂只进入 `world.bank.facilityReserves`，一期不得自动创建系统工厂订单。重启、迟到轮询、重复截止时间或事务重试不得重复处置。

世界保存前必须满足：所有存款、利息池、风险准备金、贷款金额和冻结数量是安全非负整数；冻结数量不超过对应工厂总量减交易冻结数量；进行中贷款最多一笔；贷款负债等于未偿本金与未付利息之和；玩家净资产等于资产毛值减贷款负债。任何违反都必须回滚整个动作，不得以静默清零、截断工厂或重新发行资金修复。

## 7. 容量与客户端交付

正式服务的每个 60 秒请求指标窗口最多保留 256 个方法／归一化路由键，并预留统一溢出项 `OTHER /api/other`；超过上限的未知或高基数路由只能累计到该项，不得继续扩张内存 Map、排序集合或日志路由维度。窗口结束后必须同时清空路由聚合与溢出请求计数。每个路由必须同时汇总请求总耗时的平均值、p50、p95、p99、最大值和应用层 JSON 响应字节数。响应字节以 `sendJson` 写入请求上下文的 `responseJsonBytes` 为优先权威来源，`Content-Length` 只允许作为无应用层字节指标时的回退；响应结束后头部不可读不得把已经记录的非零 JSON 响应误记为 `0 B`。同一请求上下文必须记录事务等待、世界草稿解析／复制、玩家动作前快照、世界推进、经济不变量检查、资金规范化、世界等值比较、状态投影、合同投影、分区构造、分区哈希、市场详情／建造报价投影、世界序列化、世界 SQLite 更新、响应序列化和 SQLite 提交等阶段耗时，其中正式名称至少包括 `playerSnapshotMs`、`economicInvariantMs`、`worldEqualityMs`、`marketDetailProjectionMs`、`facilityBuildQuoteProjectionMs`、`serializeWorldMs` 与 `worldUpdateMs`。指标窗口还必须输出事件循环延迟 p50／p95／p99／最大值，以及世界 JSON 字节数、响应 JSON 字节数、六个分区各自 JSON 字节数、`orders`／`provinceMarkets`／`provinceFacilityMarkets` 字段字节数和状态分区数量等无身份容量指标。分区哈希序列化必须在同一次遍历中顺带计数字节，不得为容量指标重复序列化大字段。

世界存储必须区分冷加载迁移与热保存收口。`migrateLoadedWorld` 只在数据库世界首次载入、新世界创建或明确版本升级时执行完整迁移、全玩家兼容字段补全和合同迁移；`finalizeWorldForStorage` 只负责删除禁止持久化的旧实例／玩家日志、执行一次资金精度收口并固定世界版本，不得在普通动作保存时重新运行银行、拍卖、工厂、研发或合同迁移。普通动作在同一 `now` 下只允许执行一次银行、周结算、研发和排行榜全局到期推进；工厂与市场继续由统一领域动作处理，合同动作完成后的即时交付只调用合同专项处理并捕获审计变化，不得再次执行全部全局处理器。

幂等确认仍保留 24 小时，但过期删除使用服务内 5 分钟门控：首次有写操作时允许清理一次，后续写操作在门控窗口内只插入／读取自己的幂等确认，不得重复执行 `DELETE ... WHERE created_at < ?`。门控时间属于事务内运行时状态，事务回滚必须一并恢复，避免失败事务错误推迟后续清理。

阶段指标只能使用 `AsyncLocalStorage` 在请求内部聚合，不得写入世界、分区、SQLite 或客户端响应。异常摘要和周期日志不得记录 Cookie、请求体、邮箱、玩家 ID、玩家资产、合同内容、订单内容或其他敏感数据。阶段样本必须有固定上限，路由和阶段名称必须使用固定枚举或归一化名称，防止高基数内存增长。压力测试基线必须保留 GitHub Node 24 的用户数、轮询频率、RPS、状态 p95／p99 和写动作 p95／p99，用于后续优化前后比较。

正式客户端默认每 5 秒轮询一次修订号，可选 3／5／10 秒，不得恢复每 1 秒完整状态轮询。客户端根游戏模型不得维护每秒 `now` 状态；倒计时与进度只在概览、生产、拍卖、合同和银行等实际需要时间变化的局部页面维护，市场订单簿、导航和银行资产总览等静态区域不得被全局秒级时钟重渲染。每次 `GET state` 的顶层 `serverNow` 用于向前校准共享单调服务器时钟，局部倒计时只叠加该响应在当前浏览器接收后的单调经过时长；迟到或较旧响应不得让时钟回退。`lastProcessedAt` 只作为世界最后保存时间和旧响应兼容回退值，不得在每次轮询时重新建立本地时钟，也不得直接以客户端墙上时间替代服务器时间。管理员入口、游戏入口和十个游戏页面必须使用动态 `import()` 按需拆包。 根应用必须在登录页首次执行时启动管理员与游戏入口分块预加载，避免已打开的旧登录页在部署完成后才请求已过期入口分块；页面组件仍由 `lazy` 与 `Suspense` 按需渲染。只有 `GET state` 或权威动作响应中的状态交付可以更新 `EconomyState` 和客户端已接受修订号；两类响应共用同一状态交付缓存和修订号门禁，动作结果本身不得绕过该缓存直接改写 authority。低修订号或缺少修订号的迟到状态响应不得覆盖新状态。

分区内容哈希只能由业务内容决定。响应生成时间只能位于 envelope `serverNow`；经济日历滚动窗口、排行榜生成时刻及其他逐请求时间不得进入分区。全局修订因其他玩家操作前进时，服务器仍必须使用当前查看者的六个已知分区哈希逐个比较，不得因为全局修订变化无条件返回完整 `market`、`player` 或排行榜分区。

运行时客户端投影必须在最终业务状态生成后立即构造六分区和分区修订，并按 `世界修订号 + 玩家 ID` 缓存最终投影；同一修订的重复初始请求或重试必须直接复用状态对象、分区对象和分区修订，不得再次进入 SQLite 事务、再次克隆合同投影或重新执行分区 `JSON.stringify`／SHA-256。缓存最多保留 256 个玩家投影，世界修订变化时立即清空；目录分区在同一服务进程内是静态快照，商品、工厂、研发目录和客户端版本相同的所有玩家必须复用同一目录对象与修订。HTTP 交付层优先消费已经构造的 `partitions` 与 `partitionRevisions`，只负责比较客户端已知修订和选择补丁；仅兼容单元测试或旧内部调用时才允许从完整 `state` 临时拆分。

所有权威写入必须由 `server/src/authoritative-write-executor.js` 的单一进程内执行器串行提交。执行器使用严格 FIFO，同一时刻只允许一个回调接触共享 `DatabaseSync` 连接、世界缓存和追加式审计；不得为注册、管理员、世界调度、合同或拍卖创建第二套写队列、独立 SQLite 写连接或跨线程拆分事务。默认总深度上限固定为 128，包含正在执行的任务；同一玩家、注册网络指纹或系统主体最多保留 4 个正在执行或排队任务，普通请求排队最多 10 秒。达到全局／主体上限、等待超时或服务关闭后提交时必须返回 `503 Service Unavailable`、稳定的 `WRITE_QUEUE_BUSY`／`WRITE_QUEUE_ACTOR_LIMIT`／`WRITE_QUEUE_TIMEOUT`／`WRITE_QUEUE_CLOSED` 代码和 `Retry-After: 1`，这些预期容量拒绝不得输出异常堆栈或玩家标识。

世界截止时间调度必须通过同一权威写执行器提交 `system:scheduler` 任务，并保持单一未决调度任务；调度任务不因普通请求占满队列而丢弃，也不设置普通等待超时，但服务停止后不得再重新排程。常规 `GET state` 在已有玩家、无需登录周结算且正式到期调度已启用时继续走队列外只读快路径；首次建档、登录结算或无后台调度的到期推进才进入队列。订单历史、拍卖出价历史和其他确定性只读接口不得无条件进入写队列。

注册流程的数据库阶段必须分别入队，但统一账号可用性检查、邮件发送和统一账号创建／登录等外部网络调用必须在队列外执行，禁止持有写执行权等待网络。外部调用成功或失败后再提交独立的标记发送、标记失败或建档事务。HTTP 健康检查与管理员摘要只暴露无身份的 `accepting`、`running`、队列深度、拒绝数、平均／最大等待等诊断；请求阶段指标固定使用 `writeQueueWaitMs`、`writeExecutionMs`、`writeQueueDepth` 和 `writeQueueRejected`，不得记录主体键、邮箱、玩家 ID 或操作正文。

优雅关闭必须先停止 HTTP 接收与世界调度，拒绝新写入，排空已经接受的 FIFO 任务，再关闭唯一 SQLite 连接；同步 `close()` 只允许测试在执行器空闲时调用。后续若迁移到 Worker Thread，只允许把完整执行器、唯一数据库连接、世界缓存和全部审计事务整体迁移，外部调用接口和单写语义保持不变；不得把部分领域写入移到线程外形成两套权威状态。

发起任一权威动作时必须使用 `AbortController` 取消正在进行的状态轮询，并在动作 HTTP 确认前暂停新轮询。存在重复提交风险的权威按钮必须在请求发出时同步进入本地“处理中”状态并立即阻止重复提交；正常成功响应携带的权威状态交付必须在该次 HTTP 响应内进入状态缓存，资产仍以服务器交付后的 authority 为准。动作已经提交但响应增量本地验收失败时，必须保留成功结果并允许非阻塞补拉和后续轮询恢复，不得提示操作未提交或自动重复写操作。

优先级：

1. 登录、注册、封禁检查、邀请奖励、资产、银行存贷款与利息、冻结、生产、订单、成交、拍卖和合同结算；
2. 系统需求与公共市场；
3. 排行榜、长周期图表和公开统计。

资源不足时宁可拒绝写操作，也不能产生负库存、重复发放、重复扣款、重复邀请奖励、重复合同交付或超额成交。资产包拍卖必须先预检全部 `items[]` 再冻结，并在结算前再次验证全部归属、冻结资金、商品仓库和工厂数量；任一项目失败时回滚整包。新每日额度商品合同必须先预检双方、地区权限、日额度保证金与当前日自动托管能力再进入进行中状态；实际交付允许在当日额度内分多次部分结算。旧有限批次商品合同继续按其首批货款、保证金和原批次原子规则兼容。资产毛值只从可用／冻结资金、银行存款、库存和工厂归属等权威余额派生，净资产必须扣除贷款本金与利息；拍卖、合同和银行冻结记录不得重复计价。

## 8. Node、systemd 与部署权限

```text
WorkingDirectory=/var/www/game/economy-api
PORT=3002
ECONOMY_DB_PATH=/var/lib/riversoft-economy/economy.sqlite
ECONOMY_REGISTRATION_SECRET_FILE=/var/lib/riversoft-economy/registration-secret
ACCOUNT_SERVICE_URL=http://127.0.0.1:3001
ACCOUNT_SERVICE_HOST=riversoft.top
ACCOUNT_AUTH_STATE_CACHE_TTL_MS=10000
ACCOUNT_AUTH_WRITE_CACHE_TTL_MS=2000
ACCOUNT_AUTH_NEGATIVE_CACHE_TTL_MS=1000
ACCOUNT_AUTH_CACHE_MAX_ENTRIES=5000
PUBLIC_ORIGIN=https://game.riversoft.top
```

GitHub Actions 使用 `SERVER_USER=deploy`，Economy systemd 服务也使用该账号。`deploy` 只能通过白名单完成发布、systemd 和 Nginx 操作；不得扩大为 root 服务或把数据库移入发布目录。

正式 systemd 单元固定为 `riversoft-economy-api.service`；固定 Node 运行时入口为 `/var/www/game/economy-api/runtime/bin/node`。

生产公网 IP 的唯一部署来源固定为 `ECONOMY_PRODUCTION_PUBLIC_IP=116.204.134.56`；SSH、IP 证书、临时 Nginx 入口和 Deploy 外部验收必须全部读取该值，不得继续使用独立 `SERVER_HOST` Secret，不得在脚本中维护第二个独立 IP 常量。临时 IP HTTPS 入口保持 `COOKIE_SECURE=true`；短期证书申请使用 `--preferred-profile shortlived`，续签由 `riversoft-economy-ip-cert-renew.timer` 管理。TLS 验收不得加 `-k`，证书状态直接读取 `/etc/letsencrypt/live/`，本机正式 HTTPS 验收使用 `--connect-to` 指向 `127.0.0.1:443`。回收 fallback 时必须删除临时 IP 虚拟主机、续签 timer 和专用短期证书。

## 9. Nginx 与验收

账号路由和游戏 API 路由分别位于：

```text
/etc/nginx/snippets/game-riversoft-economy-account.conf
/etc/nginx/snippets/game-riversoft-economy-game-api.conf
```

注册与密码重置路由由 `scripts/configure-economy-registration-nginx.py` 幂等加入正式 HTTPS `server`：

```text
/economy-api/registration/ → 127.0.0.1:3002/api/registration/
/economy-api/password-reset/ → 127.0.0.1:3001/api/password-reset/
```

部署脚本必须识别已有 snippet 和手工路由，只补缺失部分。

- 不得在账号 snippet 已存在时再次生成同名账号 `location`。
- 不得在游戏 API snippet 或手动游戏路由已存在时再次生成 `/economy-api/game/`。
- 生产正式域名与临时公网 IP fallback Nginx 都必须保留 exact `location = /economy-api/health`，并把该路径代理到 `http://127.0.0.1:3002/health`；主部署通过生产公网 IP 与正式域名验收时都必须得到 2xx。该路由只用于无认证健康检查，不得开放其他 `/economy-api/*` 根前缀；health 代理读超时固定为 90 秒，避免权威写事务在高峰期阻塞单线程事件循环时把仍在运行的服务误判为网关失败。
- 临时公网 IP fallback 必须镜像客户端所需的同源账号路由，至少包含登录／会话／退出、注册与 `/economy-api/password-reset/`；密码重置继续代理主页 `127.0.0.1:3001/api/password-reset/`、清除浏览器 `Origin`、传入可信 `X-Real-IP` 并保持 `16k` 请求体上限。发布后公网验收必须通过生产 IP 对密码重置空 JSON 请求得到 `400`，不得把只在正式域名存在的代理视为部署完成。
- 不得在手动注册路由已存在时再次生成 `/economy-api/registration/`。
- 不得在手动密码重置路由已存在时再次生成 `/economy-api/password-reset/`；该代理必须清除浏览器 `Origin`、向主页传入可信 `X-Real-IP`，并保持 `16k` 请求体上限。
- 连续执行两次，第二次不得产生配置变化。
- 游戏 API `client_max_body_size` 固定为 `256k`；注册与密码重置 API 固定为 `16k`。

大于 1 KB 的 `application/json` 响应启用 gzip：`gzip_vary on`、`gzip_proxied any`、`gzip_types application/json`、压缩级别 5。部署脚本必须修补既有游戏 API snippet 或手工 `location`，不得只对新安装生效。

修改 Nginx 前保留回滚配置；修改后执行 `nginx -t`，成功才 reload，失败立即恢复。

`npm run build` 必须执行设计与架构验证、Nginx 测试、服务器语法和测试、TypeScript 与 Vite 构建。服务器语法检查由 Node 枚举 `server/src` 顶层 JavaScript 文件并逐个调用当前 Node 的 `--check`，不得依赖 shell 展开通配符，确保 Windows 本地与 Linux CI 检查同一文件集。需要浏览器验证的增量 CI 与主部署都必须使用固定 Playwright 版本执行 `npm run test:browser`；浏览器准备统一调用 `scripts/prepare-playwright-chromium.sh`，优先复用 runner 本地 Chrome／Chromium并通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 交给 Playwright，只有本地候选都不存在时才下载固定 Chromium。浏览器 CDN 不得成为 CI 或主部署的必需单点依赖，也不得以 CDN 不可达为理由跳过浏览器回归；应用根节点必须由错误边界包裹，意外渲染异常只能显示可恢复页面，不得留下空白屏。主部署后验证 API 健康、静态网页、账号代理、注册代理、未登录 401、systemd 用户／端口／数据库、注册秘密和无重复路由；邀请与封禁专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 异常上报不封禁、管理员手动封禁、423 响应、历史自动封禁幂等迁移和管理员解禁。邮件配置工作流另行验证运行进程实际环境和服务健康，并以 `deploy/economy-email` 独立状态防止主部署误报验证码可用。 静态发布验收还必须确认 `/economy/` 与 `/economy/index.html` 返回入口重新验证策略、实际构建哈希资源返回一年 `immutable` 策略、新入口引用的全部资源可读取，并且入口只在服务与 Nginx 验证通过后发布。

## 9.1 验证策略

固定文案、禁止导入和样式入口可以使用源码字符串检查；交易估值、状态缓存快路径、资产比例、虚拟列表可视区间和本地日志持久化等行为不得仅靠 `includes()` 证明。核心规则必须至少由以下一种方式验证：服务器／浏览器行为测试、可直接执行的纯函数测试或 TypeScript 语法 token／AST 结构检查。注释、死代码或同名字符串不得让核心行为测试通过；变量改名和格式化也不得无意义破坏验证。

## 9.2 固定压力测试账号池

`transaction-mix` 的操作构成固定为 60% 状态读取、15% 商品订单、10% 工厂启停、5% 配方切换、5% 即时建设、5% 研发；执行器必须以确定性序列覆盖全部类别，写动作确认后立即补拉状态并继续校验全局修订号、分区修订和 `serverNow` 不倒退。该场景不得用于 staging 或生产，生产继续只允许只读 `smoke`／`poll`。

测试环境分为以下两类：

- 隔离环境使用模拟统一账号服务、临时 SQLite 和真实 Economy API 进程，允许执行 `mixed`／`transaction-mix`／`soak` 写入场景；`transaction-mix` 固定只允许本地隔离环境，临时 SQLite 可为固定测试账号预置充足现金、宝石、库存、仓库和农场资产，但不得增加生产调试接口或改变正式玩家初始资产。结束后必须关闭子进程并删除临时数据库。PR 和 `npm run build` 只运行短时隔离行为测试，证明执行器、状态协议、幂等和安全门禁正确，不把共享 CI 机器延迟作为正式容量基线。
- 远程 staging 必须由受保护的 `economy-stress` GitHub Environment 提供固定目标和密码，可以执行完整写压测，但目标不得解析为生产域名。生产环境只允许 `smoke`／`poll`，必须使用明确确认词、至少 3 秒轮询、最多 5 分钟，并且固定账号必须已经完成 Economy 建档；生产模式不得调用游戏写操作、初始化会话、注册、管理员、礼品码、封禁或数据库维护接口。

正式场景为 `smoke`、`poll`、`burst`、`mixed`、`transaction-mix` 和 `soak`：`smoke` 验证登录与完整／增量状态，`poll` 模拟正常轮询，`burst` 验证隔离环境冷状态尖峰，`mixed` 在隔离环境混合状态读取、商品订单写动作、动作补拉和幂等重放，`transaction-mix` 在本地隔离环境覆盖状态、订单、工厂启停、配方、即时建设和研发，`soak` 长时间验证延迟、SQLite／WAL 与错误是否持续增长。未专门声明限流场景时，超时、5xx、非预期 4xx 和 429 必须为零。

`.github/workflows/stress.yml` 是唯一完整压力测试工作流。每周运行一次五分钟隔离 `poll`，人工运行可选择目标、场景、1～24 个槽位、最长一小时和轮询间隔；同一目标不得并行压测。成功或失败都把脱敏 JSON 与 Markdown 报告写入 Job Summary 并作为 14 天 Artifact 保存，报告只记录槽位范围，不得记录邮箱、密码、Cookie、Token、Session 或请求正文。完整压力测试不得绑定到每个 PR 或主部署；性能预算调整必须依据至少三次同环境基线并作为独立审查修改，所用 GitHub Actions run ID、环境和观测值必须随 `budgets.json` 保存。

## 10. 防回退

不得恢复：

- 在客户端状态版本不兼容时继续原地重试状态请求、把刷新按钮改回普通重试、直接展示浏览器原生 `Failed to fetch`／`Load failed`／`NetworkError`，或让登录后才首次请求游戏入口分块；
- 缩短哈希资源一年不可变缓存、把入口 HTML 设为长期或 `immutable` 缓存、在新入口发布前删除旧哈希资源、让旧资源保留期短于 400 天，或在服务与 Nginx 验证完成前发布 `index.html`；

未更新设计文档的架构回退不应合并。未更新防回退检查的架构变更同样不应合并。

## 普通玩家订单序列化边界

世界 JSON 内部保留完整撮合信息；普通玩家主状态与订单历史必须通过单一公开订单序列化函数输出当前玩家自己的匿名订单，其他玩家和系统逐笔订单不得进入普通玩家 DTO。该函数删除本人订单的真实所有者、人口需求字段和 `marketSellFeeVersion / marketSellFeeGross / marketSellFeeCharged`，只返回匿名 fills。本人 fill 可以返回 `fee` 与 `netTotal`，但不得借此返回对手、maker/taker 订单 ID 或需求来源；公共盘口只返回市场摘要与匿名聚合五档。管理员审计若需要真实对手信息必须使用独立管理员接口，不得复用普通玩家 DTO。

当前客户端状态版本为 40，本地匿名成交存储为 v7，世界状态版本为 32，市场需求模型版本为 20；人口迁移、手续费迁移、储备迁移、资产拍卖删除迁移、产业目录迁移与州级经济目录替换都不得重置商品／工厂资产、玩家订单或既有订单簿成交，储备种子只允许初始化一次。

## 市场需求模型 17 迁移与运行顺序

- 权威状态使用 `marketDemand.modelVersion = 20`、`populationEconomy.modelVersion = 7`。早于市场需求模型 16 或早于人口经济模型 7 的旧状态升级时，先原额释放并取消旧消费需求与市场储备订单，保留玩家订单、人口钱包、储备真实资产、价格传导关系和玩家资产，不重复补发储备资产或人口启动资金；市场需求模型 16 升级至 17 仅降低后续报价增长速率，必须保留报价锚点、过剩周期、未完成系统订单、真实冻结资金和储备资产。
- 每个五分钟人口周期固定为：结算上一周期消费成交与积压 → 读取上一周期需求满足度 → 计算工厂结构承载与活跃承载 EMA → 迁入迁出与相邻人口类别转换 → 转入就业收入 → 保存补贴前状态指标 → 按实际人口计算稳定预算并补钱包缺口 → 更新类别与商品分配 → 生成派生需求与三档消费买盘 → 应用价值上限和双向压力 → 撤销并重挂市场储备订单。
- 人口周期以 `cycleId` 幂等；已处理周期或更旧周期不得再次迁移、类别转换、结算收入或发放补贴。服务重启从持久化 `lastPopulationCycleId` 继续，不追补断线期间的多个历史人口周期。
- 人口参考需求固定为 `实际人口 × 0.57`；商品目录中的 5,700 只作为 10,000 人校准基线，不再作为运行时固定总预算。消费需求、储备成交、合同交付、库存价值、商品价格和活跃玩家数不得形成系统自我放大。
- 世界 22 升级至 23 时，旧人口模型一次性初始化为基础 6,000、技术 3,000、专业 1,000；新世界初始化为 1,000。迁移保留全部人口资金、资金切片、收入和累计统计，并从下一个完整周期逐步向工厂目标人口收敛。

## 人口经济与货币事务

- 人口是世界级聚合状态，不属于玩家或单座工厂；基础人口固定 1,000，C1 单厂承载基数固定 11，C1～C7 权重固定为 1.00／1.50／2.20／3.20／4.50／6.20／8.50；
- 结构承载读取全部已建成工厂 `count`，活跃承载只读取运行 `participatingCount × staffingRateBps`；活跃 EMA 使用 80%旧值／20%当前值；人口占用率为 35%底线加产业运行、收入健康和需求满足加权；
- 每周期迁入剩余缺口 2%、迁出超额人口 0.5%，类别转换最多总人口 1%，劳动参与率 55%；所有人口与分配计算必须确定性、守恒并使用安全整数／微单位边界；
- 工厂交易不得改变世界总结构承载，即时建设、产量、库存、商品价格和玩家活跃数不得直接创造人口或补贴；管理员不得直接编辑人口、就业、迁移或承载参数；
- 商店兑换继续直接发行普通货币，不使用准备金，也不根据通胀自动调整；
- 生产周期成本、建造费、仓库扩容费、玩家卖出手续费和合同服务费只转移已有货币到人口；借款人实际支付利息的 20% 形成银行服务就业，其余进入存款利息池与风险准备金；
- 建造业固定 60%／30%／10%，不得读取工厂复杂度改变比例；生产岗位按 C1～C7 分配；
- 人口消费不得发行普通货币，必须从真实 `credits` 转入 `frozenCredits` 后结算；
- 五档状态只重新分配食品／家庭与类别份额，不得改变周期总预算公式、稳定需求发行、直接／派生资金池比例或订单冻结约束；
- 状态判定必须使用人均收入健康度、基础收入覆盖和自动稳定补充前的钱包覆盖；近期峰值按当前人均收入 EMA 与 92% 衰减旧人均峰值取大，不得使用单周期原始收入尖峰；
- 奢靡和繁荣分别需要连续 3／2 个合格周期，失去上档资格连续 2 个周期后逐级下降；收入健康度低于 65%／35% 或连续两个周期无收入时必须立即进入拮据／生存；
- 不存在人口侧税费、回收、余额衰减、储蓄过期或货币总量控制；
- `populationModelId` 和 `fundingPool` 必须由单一公开订单序列化函数删除；
- 人口启动发行只允许在历史人口迁移中执行一次；目录扩展、模型升级或旧施工费追溯都不得再次发放人口启动资金；
- `issued` 只用于兑换、礼品、管理员和迁移发行；就业与人口消费使用 `income`／`transferred` 统计。

管理员 `/api/game/admin/summary` 与 `/api/game/admin/population-economy` 必须直接读取已提交世界并返回只读人口经济摘要；已有世界缓存时不得进入 SQLite 事务、权威写队列、强制世界推进或世界保存路径，冷缓存仅允许通过只读事务装载当前持久化世界，并返回实际／目标人口、结构／活跃承载、迁移、就业失业、岗位缺口、人均收入、消费状态、状态原因、持续周期、收入健康度、基础收入覆盖和状态判定钱包覆盖；玩家市场状态不得包含管理员人口指标。

### 每日签到持久化与调度

`economy_daily_check_ins` 以 `(user_id, date_key)` 唯一约束保证每天最多签到一次，并以 `(user_id, week_key)` 的部分唯一索引保证每周最多发放一次全勤奖励。`economy_gem_ledger.source_key` 为每日签到、全勤和排行榜奖励提供不可重复来源键。签到、宝石余额、签到记录、宝石流水、幂等确认与世界修订共享同一 `BEGIN IMMEDIATE` 事务。

单一世界到期调度器把下一个北京时间 00:00 纳入候选截止时间，并更新世界 `checkInDateKey` 以产生一次全局修订；所有客户端因此能在跨日后通过现有玩家分区补丁获得新的 `todayKey`，不得增加独立轮询或客户端日期判断。

### 旧有限批次商品合同续签兼容与公开经济事件调度

旧有限批次商品合同的 schema 8 在原合同上保存单个续签提议、条款版本、采购方同意时间、供应方同意时间、双方确认时间和前后合同关联。仅剩余三批以内的固定批次进行中合同可以提出续签，长期合同无需且不得提出续签；提出条款本身不计为提出方同意，采购方与供应方都必须对当前条款版本执行显式同意动作。第一方单方同意只记录本人同意时间，单方同意不冻结任何续签资产、不增加采购方仓库预占，也不创建后续合同；双方均同意时才在第二个同意动作的同一 SQLite 世界事务内重新校验双方当前资金和参与者状态，冻结续签首批货款、双方 20% 保证金和按现有自动准备规则可冻结的首批商品，并把已确认续签的首批商品计入采购方仓库预占。双方确认前任一方可以撤销自己的同意，提出方可以取消提议，另一方可以拒绝提议；双方确认后不得单方撤回。原合同正常完成最后一批时原子创建并激活关联新合同；原合同宽限违约、批次后结束、立即终止或参与者异常时释放全部续签托管资产。旧 schema 7 的 `proposed` 提议迁移后双方均保持未同意，旧 `accepted`／`activated` 提议按原提出方和接受方补齐双方同意时间。所有续签写操作继续要求幂等，并进入追加式合同审计；单方同意、撤销同意、双方确认、取消、拒绝、过期和激活分别保留可区分事件。

公开经济事件日历由服务器固定模板和时间槽确定，不持久化第二套可编辑事件数据。状态快照在现有六分区中的 `market` 分区返回 `economicCalendar`，客户端唯一归属玩家外壳右侧日志列，不进入概览或市场页面正文；返回内容不包含逐请求变化的 `visibleUntil`。世界截止时间规划器只纳入事件开始和结束边界，不再为了事件进入滚动七天可见窗口唤醒世界。需求运行时仅在既有预算分配阶段应用事件权重，保持总预算、真实人口钱包、市场储备和货币发行守恒。

## 单一微单位货币核心

普通货币只允许一个服务端运算尺度：`1 credit = 1,000,000 micros`。订单价格、拍卖出价、合同单价和银行玩家输入仍受 `0.01` 步长约束，但不得维护独立的“分”运算体系；两位价格通过“微单位必须是 `10,000` 的倍数”表达。金额乘整数数量、费率、利息、手续费和预算分配必须使用整数或 `BigInt` 微单位，仅在最终除法处按场景执行一次 half-up、floor 或 ceil。

世界状态和客户端状态暂时保留十进制数字段以兼容状态版本 22；`money.js` 是十进制兼容边界和微单位核心的唯一入口。业务模块不得自行使用 `value * 100`、`value * 1_000_000`、`toFixed()` 或字段名递归补偿尾差。世界保存前只校验六位账户精度、两位价格步长和整数数量；价格尾差不得进入准备金。

合同审计 SQLite 的金额列和信用货币转账数量以整数微单位保存，并用 `money_precision_version` 区分旧整数货币快照；商品转账数量继续保存整数。银行存款、取款、借款、还款、利息池分配和合同托管、保证金、手续费全部保留六位账户精度。

## 统一订单簿运行时容量边界

六分区主状态不得发送公共逐笔订单或全部 800 笔关闭历史：`orders` 固定只包含当前玩家全部未完成订单，以及当前玩家最近 `ECONOMY_CONSTANTS.maxOpenOrders` 笔已关闭订单，用于撤单、自动交易关联和覆盖一次轮询窗口内可能新增的本人 fills；其他玩家和系统订单无论是否未完成均排除。公共盘口读取市场摘要和按需详情。更早的本人关闭订单由只读 `GET /api/game/orders/history?cursor=&limit=` 按活动时间和订单 ID 的不透明游标分页，默认 50、最多 100 条；接口总数只统计当前玩家关闭订单，复用唯一公开订单序列化并继续删除对手、需求、人口和资金切片字段。历史读取不推进世界、不改变修订号、不进入常规轮询或分区哈希。

## 活跃周固定利息与周资金结算事务

`weekly-cash-settlement.js` 是北京时间自然周、成功经济写操作激活、次日计息资格、10% 活跃周账单、长期回归一次性账单、登录扣款、欠缴负债和客户端摘要的唯一服务器实现。`banking.js` 只负责每日 1% 利息、贷款利息池优先支付与补贴发行；不得在客户端或排行榜复制资格判断。

周一 00:00 的权威顺序为截止时间前世界推进、贷款与最后一日利息、关闭周资金账单、排行榜周期切换。账单关闭不扫描撤销玩家托管；冻结资金只参与计税。正式状态读取、商店读取和所有写操作必须在返回或执行业务前执行玩家登录结算，先扣存款、再扣可用资金，未缴金额留作负债。成功且改变经济状态的写操作在旧债清零后激活当前周；轮询、签到、失败和幂等重放不能激活。

周资金扣除的实际收取额必须在同一世界事务中转入市场储备，不得销毁或进入人口钱包。分配读取 `MARKET_DEMAND_GROUP_CATALOG` 的 `baseBudget`，当前食品市场与社会消费市场固定按 **3000:2700** 权重在微单位精度下分配，最后必须满足储备增加总额与本次实际扣款严格相等；只增加各组可用 `credits`，不得改变 `frozenCredits`、商品库存、人口收入 EMA 或消费预算。旧 `weeklyCashSettlementBurned` / `burnedCredits` 只保留历史审计且不得继续累计，新收取额累计到 `weeklyCashSettlementReserveTransferred` / `reserveTransferredCredits`；排行榜政策调整同时扣除历史销毁和新储备转移，避免把周结算误记为经营亏损。

世界 20 迁移初始化周结算状态和银行版本 3，不追溯规则上线前利息或扣除，并把上线所在周标记为不完整周；下一个完整周开始正式关闭活跃周账单。客户端状态版本 23 增加周结算摘要。重复加载、登录重试、服务重启与跨周追赶不得重复建账或重复扣款。同一自然周内的普通状态读取、无账单登录和幂等重试不得刷新登录周标记，也不得因此推进世界修订号。

## 研发宝石加速接口

正式写接口增加 `POST /api/game/research/accelerate`，继续要求 `Idempotency-Key`；持久化幂等确认仍只保存 `{ result: { ok, message }, revision }`，HTTP 层继续使用通用权威动作增量交付 envelope。存储事务必须先推进世界和研发，确认玩家存在进行中的未到期研发与至少 1 宝石，再扣费、将截止时间最多提前 30 分钟、释放对应研发就业收入、完成到期等级、更新周活跃经济状态并写入 `economy_research_gem_actions`。审计记录目标等级、请求键、宝石余额、前后剩余时间、实际缩短时间、是否立即完成和本次就业资金释放量；失败动作不得扣费、改写截止时间或写审计。

## 科技节点研发状态与迁移

世界版本 27 将研发持久状态从单一 `unlockedComplexity` 扩展为 `completedTechnologyIds`、`completedAtByTechnologyId` 和单个 `active` 科技项目。`active` 保存 `technologyId`、所属阶段、原始 `durationMs`、截止时间、费用和已释放就业资金；宝石加速只缩短截止时间，进度和就业释放仍使用原始基础时长计算。

服务器 `research-catalog.js` 是科技节点、前置关系与工厂映射的唯一目录。所有工厂资产入口、生产操作和工厂租赁运营资格均调用同一具体科技校验；`unlockedComplexity` 只作为连续完整阶段的兼容派生值。旧世界按既有等级、资产、施工、买单与最高竞拍承诺授予科技及前置闭包；旧进行中阶段研发保存为 `legacy-stage-Cn`，到期授予该阶段剩余节点。迁移、处理和加速必须幂等，不得重复扣费、重复发放就业资金或降低既有准入。

世界 29 研发迁移把生产资料的生产能力与使用能力拆开。只在 `world.version < 29` 时按已完成的旧生产科技一次性授予等价作业科技：工具制造→工具作业、化肥工程→化肥施用、饲料加工→饲料饲养、养殖药剂→药剂精养、石油炼化→工业动力作业+工业化学作业、机械工程→机械化作业、农业机械→拖拉机作业。迁移前已经开始的上述生产科技必须在同一活动研发的 `grantTechnologyIds` 中补入对应作业科技；迁移完成后生产科技和作业科技必须独立研发，服务器 `setFacilityRecipe` 只按正式制度声明的作业科技进行权限校验。

## 工厂即时建设事务

`POST /api/game/facilities` 接受必填 `provinceId`、`facilityTypeId` 与可选 `quantity`（1～100）；省略 `autoProcure` 时保持原有“当地库存齐全才建设”行为。缺料但当地卖盘足以一次购齐时，客户端可以提交 `autoProcure = true`、`materialPriceCaps: Record<productId, price>` 与 `maxProcurementTotal`。服务器必须在同一幂等写事务和经济回滚边界中先计算目标地区真实库存缺口，再按该地区统一商品订单簿重新预扫非本人卖盘；只有全部缺口都能在逐材料价格上限内一次成交且“建造费 + 当前真实采购额”可支付时，才按价格档位执行内部 Fill-or-Kill 买入。无限本地仓库不检查旧容量或临时交割空间。价格下降按当前更低 maker price 成交，盘口深度、逐材料价格或采购总额任一超过客户端确认边界时拒绝。内部 FOK 买单因预检保证本事务关闭，可跳过普通玩家“同时未完成订单”数量上限，但不得跳过地区隔离、自成交检查、资金、手续费、成交记录、市场储备和订单簿撮合规则。全部买入完成后复用既有即时建设逻辑扣除当地材料与建造资金；采购、卖方结算、市场记录或建设任一步失败都通过同一 SQLite savepoint 与世界快照完全回滚，不留下部分材料、部分卖方结算或未完成订单。

只读 `GET /api/game/facility-build-quote` 负责按当前玩家库存、地区、工厂类型和数量预扫真实全量卖盘，不建立采购状态、不写世界；卖盘不足时的写入仍继续复用 `POST /api/game/orders`，不新增建厂采购写路由。`execution = facility-build-procurement` 只表示一次建造意图的批量普通商品买单：服务器先计算原始缺口并校验具体科技、1～100 数量及逐材料 `materialOrderPrices`，随后在同一个 SQLite savepoint／世界回滚边界内自动撤销与本次买价交叉的本人同商品未完成卖单；撤单释放剩余冻结库存后必须重新计算真实缺口、动态未完成订单上限和全部新买单最大金额，释放库存已经补足的材料不得继续下 BUY，未交叉卖单保持不动。完成重算后再校验安全金额和“可用资金 ≥ 建造费 + 全部新买单最大金额”并逐材料调用正式 `placeOrder`；自动撤单或任何一张子订单之后失败，都必须恢复本次已撤销卖单、释放库存以及已经创建或成交的其他子订单。普通手动订单与 `autoProcure = true` 的 FOK 建材采购仍按原规则拒绝自交叉，不使用该自动撤单例外。成功响应可以额外返回仅供当前浏览器立即建立聚类关系的 `procurementGroup`（工厂类型、建造数量、正式订单 ID、商品、原始数量和提交价格），但该组不进入世界 JSON、六分区、客户端状态版本或额外轮询。`execution = facility-build-procurement-cancel` 在同一 `/orders` 写接口中批量撤销所给当前玩家普通商品 BUY 的未完成部分，已成交材料保持在仓库。两种 execution 都继续使用请求 `Idempotency-Key`；前者按 `buildFacility` 复用科技准入，后者不触发自动建厂。建造现金不被冻结。`POST /api/game/facilities/construction/accelerate` 固定返回 `410 Gone`，不得进入经济写事务或写入新的施工宝石审计。

## 12. 玩家自助删除存档

`save-deletion.js` 是玩家自助删除存档的唯一领域入口。`GET /api/game/save-deletion/preflight` 与 `POST /api/game/save-deletion` 都属于正式玩家可触发的权威写，必须登记显式交互元数据、延迟预算和 Mutation Scope；生产服务器先通过统一权威写队列的 scheduler barrier 推进到当前世界状态，删档领域自身不得再 `force` 推进或复制完整世界。预检查只复制当前玩家与必要核心资金域；正式删除只额外复制 `orders`、旧 `facilityListings`、`assetAuctions`、`productionContracts` 等实际会清理的有界共享分区，无关玩家、市场与工厂行情必须保持共享引用。这个边界是强制规则，因为删除一个玩家的延迟不得随全服玩家数量增长并超过浏览器普通写请求超时。

`POST /api/game/save-deletion` 继续使用 `Idempotency-Key`、精确确认文字“删除存档”和同一 `BEGIN IMMEDIATE` 事务再次检查。开放订单和旧工厂挂牌与被删除玩家本身处于同一原子事务，可直接从共享集合移除，冻结资产随旧玩家存档销毁，不得为了“先解冻再销毁”调用全局工厂迁移或协调；无出价自有拍卖仍走不推进全世界的定向取消路径以保留发布费分配和拍卖审计；未承接自有合同走不执行全局合同处理器的定向取消路径。未偿银行贷款、未完成周资金结算、已有出价的自有拍卖、当前最高出价和履约合同必须返回 `409 SAVE_DELETION_BLOCKED`，任何资产不得改变。

删除事务通过首次建档共用的 `ensurePlayer` 初始化重新创建玩家，保留原 `registeredAt`、宝石余额和宝石发行统计，每次重新发放新存档的 500 普通货币，并写入递增 `saveEpoch`、`saveCreatedAt` 与一条追加式删除审计。`economy_save_deletions` 允许同一 `user_id` 保存多条历史记录，`request_key` 继续唯一，并保存前后世代、删除时间、资产摘要和自动关闭数量；旧的 `user_id UNIQUE` 表结构在首次访问删档领域时幂等迁移为追加式历史表，并建立 `(user_id, deleted_at DESC, id DESC)` 查询索引。同一幂等键只返回第一次结果，但历史删除记录不得阻止再次删除当前经济存档。`economy_registrations`、邀请码与邀请关系、宝石账本、商店兑换、每日签到、礼品兑换、封禁、拍卖审计和合同审计不得删除或重置。教程完成行在同一事务删除，使每个新存档重新进入基础教程。

服务器状态固定下发 `saveEpoch`。当前客户端对普通写请求和删除存档请求都发送 `X-Economy-Save-Epoch`；仅当当前存档仍处于初始 `saveEpoch = 0` 时允许兼容旧客户端缺失该请求头。删档 POST 必须先匹配当前页面世代，再进入当前世代的清理和重建；一旦玩家成功删除存档进入更高世代，缺失或与当前玩家不一致的世代都必须返回 `409 SAVE_EPOCH_MISMATCH`，不得推进世界修订号或改变现金、订单、工厂、研发或再次删除新存档，从而防止删档前的旧标签页作用于后续世代；当前世代请求仍必须保持可写。旧 `POST /api/game/reset` 继续固定返回 `410 Gone`，不得映射到删除存档领域能力。

### 经营决策支持与精确漏斗

`economy_player_milestones` 增加 `first_research_at` 与 `first_bank_deposit_at`，并以 `economy_player_statistics_meta.gameplay_strategy_funnel_coverage_started_at` 记录完整新漏斗开始覆盖的服务器时间。`economy_tutorial_completions` 增加 `completion_source`，固定为 `legacy`、`migration` 或 `player`；历史行迁移默认 `legacy`，版本迁移写 `migration`，玩家实际完成幂等接口只写 `player`。管理员经营成长漏斗只把覆盖起点之后新建档玩家和 `player` 来源完成计入完整转化与 24h／7d 完成率。

合同新增只读 `GET /api/game/contracts/performance`，服务端直接从参与者可见的追加式合同审计汇总已结束合同、完成、异常、违约、赔付和最近结果，不进入六分区状态轮询，也不产生信用分。工厂经营诊断、研发产业视角和排行榜分段由客户端对已经加载的服务器权威状态做无副作用派生；经济事件结果反馈读取商品市场摘要中的紧凑事件窗口聚合，不要求完整行情历史。它们不得产生新的经济写操作。公开经济事件日历额外保留结束后 24 小时的事件供事后反馈，实际需求重分配仍只在正式事件生效窗口内发生。

排行榜个人最好成绩保存在玩家权威 `stats.leaderboardPersonalBests` 中，按 `wealth/growth/production/trading` 保存已结算最好分数与 `periodKey`。只有完整周结算可以更新该历史值；排行榜读取只比较当前完整周成绩与已结算最好成绩并返回 `currentIsRecord`，不得由 GET 请求或浏览器本地状态写入历史纪录。

### 六分区内部子修订元数据

状态交付的六个外层分区保持不变，字段归属仍由 `state-partitions.js` 决定。为允许新客户端在收到完整 `player` / `market` 快照时复用未变化字段引用，服务器可在 envelope 顶层同时返回 `sliceRevisions`。子切片定义唯一维护在 `server/shared/economy-state-slices.js`；服务端与客户端必须共享同一字段归属，禁止各自复制一套映射。`transportShipments` 与 `transportRoutes` 一并归入 `player.misc`；运输运行态不再归入 `market.misc`，不得为运输新增第七个父分区。

`sliceRevisions` 只是传输元数据，不写入世界 JSON、SQLite 玩家状态或 `EconomyState`，也不参与经济规则。客户端仍只提交六个父分区 revision 作为已知状态，服务器仍以父分区 revision 判断是否需要发送完整父分区 patch；子修订不能让服务器发送字段级 patch。没有父分区 patch 的轻量无变化响应仍可省略子修订。

增加、删除或调整子切片不得修改客户端状态版本或世界状态版本，除非实际 `EconomyState` 字段或持久化结构同时发生了不兼容变化。旧客户端会忽略 `sliceRevisions`；新客户端遇到缺少该元数据的旧响应必须按整个父分区变化处理，因此发布期间不需要双协议切换。

## 生产懒结算与调度边界

正式工厂生产采用“客户端计算生产结算提案、服务器闭式校验并权威入账”的按玩家懒结算模型。客户端直接复用正常状态响应和 envelope `serverNow`，不新增一套可写资产状态；提案只允许声明稳定排序后的工厂组完成周期数。服务器必须从当前 committed world／请求 COW 草稿重新取得真实玩家资源与工厂基线，使用共享闭式 `staffingRateBps + staffingBatchCarryBps` 数学验证 `n` 与 `n + 1`，再在同一权威写事务中生成实际资金、库存、产出、就业和运行状态变化。正常提案验证复杂度按当前玩家工厂组数增长，不得按离线欠周期数增长；客户端二分搜索和旧客户端服务端兜底可以按 `log(欠周期数)` 搜索，但服务端兜底只能作用于当前玩家。

全局世界截止时间计划固定 `facility = null`。排行榜、市场、服务冷启动和常规世界调度不得通过 `processFacilityGroupWorld` 扫描全部玩家工厂或逐周期重放离线生产。供货与工厂租赁合同在真实到期时可以从合同参与者索引确定供应方／承租方，只对这些明确受影响玩家物化生产，然后继续合同结算；不得把合同兜底扩展为全玩家遍历。普通玩家动作可以携带最近一次客户端提案并与业务动作同一 COW 事务提交；提案过期返回稳定 `PRODUCTION_SETTLEMENT_*` 冲突，客户端可以清除旧提案并由同一动作触发当前玩家服务端兜底。独立 `POST /api/game/production/settle` 使用当前玩家经营足迹的有界 Mutation Scope，包含实际周期交易与合同需要的市场／对手方，不能因为结算动作恢复完整世界克隆。

## 玩家头像静态资源

玩家头像是展示资源，不进入 EconomyState、状态分区或五秒轮询。设置页继续复用 `PATCH /api/game/profile` 写入口；浏览器必须先把原图居中裁切、缩放并编码为 64×64 WebP，最终请求体中的头像数据不得超过 8 KiB，服务器再次校验 WebP 容器、64×64 实际尺寸和体积后才允许原子替换文件。

生产头像目录固定为 `/var/lib/riversoft-economy-avatars`，由 Economy API 服务用户写入，Nginx 只读并通过 `/economy-avatars/<userId>.webp` 提供 `image/webp`。资源使用重新验证缓存而不是把图片字节写入游戏 JSON；头像更新后客户端只给 64px URL 增加本地版本查询参数触发重取。这样状态轮询大小不随头像增长，玩家选择的原始大图也不会产生服务器上传流量。

Nginx 头像 `location ~` 正则包含 `{m,n}` 量词，必须整体使用引号包裹；未引用时 Nginx 会把 `{` 识别为配置块边界并把截断表达式交给 PCRE，因此部署验证必须同时锁定生成脚本和静态 location 模板的引用形式。

### 玩家身份关系与可变资料

玩家昵称、头像等可变身份资料的权威值只存在于玩家实体。普通权威业务实体（订单、订单成交记录、玩家拍卖、供货/借贷/租赁合同及旧工厂交易兼容数据）与玩家的关系必须只用稳定数值 ID 持久化，不得复制玩家昵称作为关系字段。对外 DTO 若需要显示当前昵称，应在状态/API 投影阶段按 ID 从玩家实体解析，且不得把解析结果写回 World。系统市场、人口需求、市场储备等非玩家主体可以继续持久化自身固定标签。明确的不可变历史快照是例外：合同追加式审计、已结算排行榜历史等若语义要求保留事件发生时的名称，可以在写入历史记录时由稳定 ID 解析一次并保存名称快照；快照必须同时保留稳定玩家 ID，且不得反向成为当前身份来源。服务器 `trades` / `ledger` / `assetEvents` 等展示日志不属于权威历史记录，继续禁止进入当前 World、SQLite 或普通玩家状态。

因此资料修改的 Mutation Scope 只覆盖当前玩家和必要本地核心域；昵称修改不得通过订单、合同、拍卖或旧兼容列表做扇出同步。迁移层可以读取旧存档中的昵称镜像以保持兼容，但必须逐步规范化为 ID-only 关系。该规则用于保证资料修改的时间/写入复杂度与全服历史数据量无关。

## 压缩后关键运行与部署不变量

以下条目只保留服务器领域必须长期稳定的边界；具体模块清单仍以代码为运行事实。

- 资产拍卖追加式审计由 `auction-audit-store.js` 承担；即时建厂缺料采购由 `facility-auto-procure.js` 承担；玩家卖出手续费由 `market-sell-fee.js` 落实；人口需求实现包含 `population-economy.js`。这些文件名只作为实现与验证映射，不创建第二套业务规则。
- 地区化每日商品合同继续通过统一合同门面执行，合同时间单位统一为天；邮箱验证码有效期为 10 分钟，错误 5 次即失效，并核对发送 IP 和提交 IP。`RESEND_API_KEY` 与 `EMAIL_FROM` 只保存在服务器；共享 `/etc/riversoft-email.env` 先加载，Economy 专用 `/etc/riversoft-economy-api.env` 后加载。未配置时返回“邮箱验证码服务未配置，请联系管理员”。发送前通过 `POST /api/internal/account-email-exists` 检查统一账号；已注册邮箱不得创建 `economy_email_verifications` 记录，也不得发送邮件。
- 验证码记录清理、验证码创建／状态更新和完成前校验只写注册专用 SQLite 表，不得触发世界到期调度 barrier；最终创建 Economy 玩家档案继续属于普通用户世界写入。已有 `economy_registrations` 且永久邀请码元数据完整的 `/api/game/session` 直接走只读会话；仅缺元数据时使用 `system:session-metadata:*`，真正建档使用 `session-profile-creation`。验证码终态记录保留 30 天。
- 正式 SQLite 必须保持 `auto_vacuum=INCREMENTAL`；普通玩家事务不得执行 `incremental_vacuum`。每周一北京时间 02:30 执行受限维护，每批固定 1,024 页、单次最多四批。迁移备份使用紧凑 gzip SQLite 快照并通过 `VACUUM INTO` 消除 freelist；解压后的 `auto_vacuum` 必须保持 `INCREMENTAL`。最多保留最近 5 个迁移族，迁移工作空间至少为预计有效数据两倍再加 512 MiB，删除临时 SQLite 前显式关闭全部连接。Windows 本地行为验证与 Linux 正式部署共用同一实现，分段存储 V2 首次迁移前必须创建 `economy-pre-storage-v2`。
- API 代码继续使用 `rsync --delete-before` 完整替换，同步 `server/` 时必须排除 `runtime/`。固定 Node runtime 完全匹配时必须复用且不得重新下载或上传；正式运行时固定 Node 24.4.0。旧哈希资源至少保留 400 天，发布时最后原子替换 `index.html`。
- CI 的事件、测试选择、聚合门禁和构建产物流转统一由 `CI_EXECUTION_DESIGN.md` 负责；本文不维护第二份 PR／push 拓扑。正式发布必须使用已验证的同一源码，不得用手工成功状态替代真实检查。
- 部署 SSH 主机密钥不得依赖单次 `ssh-keyscan`，最多尝试 5 次；连接验证失败必须在数据库备份、文件上传和服务变更之前终止。成功步骤日志不得上传；失败摘要使用 `economy-failure-summary.txt`，禁止重新扫描或拼接成功步骤日志，不得再为单次构建失败创建临时诊断工作流。服务安装阶段只确认 `systemd active + 127.0.0.1:3002 TCP` 已监听，避免业务事件循环正在处理长事务时把“已启动但暂时繁忙”误判为“服务未启动”；安装器不得用 HTTP `/health` 复制正式健康门禁。真实 HTTP 健康唯一由紧随其后的发布前远端验收执行。生产验收同时包含发布前远端验收和发布后公网验收，`ECONOMY_DEPLOY_VERIFY_START` 之后的 45 秒真实健康检查门槛保持不变。
- 压力测试继续报告 p50／p90／p95／p99，并验证高负载不会突破请求超时和事件循环容量边界。

### 实现映射补充

- 统一合同门面：`server/src/unified-contracts.js`；客户端与 API 的合同时间统一以天表达。
- 认证环境：共享文件先加载，Economy 专用文件后加载；邮件密钥只保存在服务器。
- 人口运行映射：`population-demographics.js`；人口经济内部版本固定为 7；五档状态只重新分配食品／家庭与类别份额；人口消费不得发行普通货币。

商业自动经营策略与可选周期锁定明细随 `commercialBuildingGroups` 交付到 `player.production`，目录保持 `catalog` 归属。新增可选字段不改变状态版本或旧周期金额。设置复用现有 `commercialBuilding` 幂等动作的 `auto-operation` 操作，服务器校验玩家、本州集群所有权及策略。真实采购只在实际周期完成的同一事务中通过正式市场执行，禁止新增后台扫描；旧在途周期缺失明细不按当前目录、价格或数量追填。业务规则引用 `COMMERCIAL_BUILDINGS_DESIGN.md`，保障策略引用 `WAREHOUSE_EXPANSION_DESIGN.md`。

用户写入在入队时先等待当时已到期的世界调度 barrier；成功后必须直接进入同一权威串行写执行器，不能递归追赶新一轮到期调度而导致用户请求永久饥饿。barrier 失败仍阻止经济动作；调度、用户写、事务提交及幂等回执保持原串行和原子边界。沿用 `schedulerBarrierWaitMs` 和写执行阶段计时诊断等待，不能通过绕过到期经济处理或提前返回成功降低表面耗时。

商业满员率基线、余数、周期存在标记和可选锁定经营量随既有 `commercialBuildingGroups` 保存并归属 `player.production`，不把实时投影写入读请求缓存。零收入周期必须进入既有商业截止时间计算，不新增轮询或另一条结算链路。迁移、经营量和锁定语义唯一引用 `COMMERCIAL_BUILDINGS_DESIGN.md`。

## 周期交易与商品冻结的事务交付

商品来源冻结、可用／冻结总量、生产／商业结算、合同货款和交付、即时成交、市场费用、审计与已处理周期游标必须在同一权威经济事务中提交或一起回滚。不得先在另一个准备事务中采购，再执行可能失败的玩家动作。真实完成事件是内部结算能力，旧客户端直接自动买卖请求不能伪造它。未完成或重复周期不增加成交与游标。

玩家动作可能顺带结算其到期生产，因此 Mutation Scope 必须从已加载的真实世界明确纳入该玩家活跃建筑、自动经营可能完成周期的地区全部真实商品市场、正式成交记录、必要资金域以及可参与已备妥采购或供货的合同参与者。冷缓存先加载再派生 scope，不能用空世界省略自动成交的市场与对手方。范围仍局限于该玩家真实经营足迹，不退回无界世界写入。合同动作已有参与者集合继续覆盖其统一后处理；失败不能污染已提交世界的共享对象。

生产补算协议包含每个集群自己的原料冻结，用相同纯函数投影真实资源上限并纳入指纹。先校验全部集群提议、再结算旧周期，最后执行新交易；新采购不倒填历史缺料周期。旧协议提议按过期处理，在原事务中使用服务器重算，而非信任客户端数量或丢掉已完成结果。

库存冻结明细、地区出售授权与周期自动出售累计数归入现有 `player.assets` 子切片，和库存总量同 revision 交付；不进入共享公开行情缓存，不新增父分区。投影只读且按当前玩家隔离；内部周期游标和工业记录去重字段不进入公开业务字段。客户端协议升级要求重新同步完整状态，原始世界与内部生产补算协议随真实结构变化升级。

冷迁移只依据可验证合同、续约与拍卖归类已有冻结，残差保持待核对，不改余额或补发历史利润。重复迁移必须幂等，地区自动出售缺失默认不授权；业务默认读取不得写回存档。

## 游戏写请求的预期身份校验

游戏写请求可携带 `X-Economy-User-Id`，表示发起页面原先认证的玩家，而不是授权来源。服务端仍只信任 Cookie 认证身份；请求头存在时必须是正安全整数且与认证身份完全一致，否则在会话初始化、业务动作、幂等回放和写队列提交之前返回 HTTP 409 与 `WRITE_SESSION_MISMATCH`，不得对新账号执行旧请求。缺少该新增请求头的旧客户端继续通过既有认证和存档世代校验；新正式客户端在账号初始化后始终携带该头。此规则覆盖另一标签页修改共享 Cookie 的情况，不依赖浏览器成功取消网络请求。
