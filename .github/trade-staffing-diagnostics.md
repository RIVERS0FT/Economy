## types

> economy@0.4.0 typecheck
> tsc --noEmit



## focused
✔ commercial auto settings are strict, owned and independent of running intent (20.663851ms)
✔ legacy default and derived execution policy do not rewrite saved groups (8.139281ms)
✔ commercial purchase fills only the local two-cycle shortfall once (7.450381ms)
✔ commercial auto-purchase respects price caps, cash and operating intent (4.361468ms)
✔ commercial inventory protection adds per-consumer demand and survives disabling procurement (4.457205ms)
✔ commerce alone cannot create an automatic sale or return goods on stop (4.246412ms)
✔ server locks all commercial settlement details across price, count and policy changes (7.342806ms)
✔ offline commercial world advancement does not invoke automatic purchases (5.679688ms)
✔ commercial building consumes local goods and settles a fixed locked profit without market volume (19.092281ms)
✔ commercial auto operation recovers after missing local goods are restored (8.605161ms)
✔ commercial building never consumes inventory from another province (7.014311ms)
✔ stopping during an invested cycle keeps the locked settlement but prevents renewal (5.068761ms)
✔ commercial cycle locks staffing, integer inputs, costs and profit at start (20.897445ms)
✔ zero staffing enters a real recovery cycle and is included in the scheduler deadline (8.562264ms)
✔ stopping a zero-output cycle cannot mint carry or restart its deadline (7.726929ms)
✔ disabling procurement does not change staffing direction; stopping does (6.830964ms)
✔ persistent shortage decays from one baseline instead of losing fractional time on every poll (19.143709ms)
✔ legacy invested amounts survive migration and missing staffing does not retroactively decay (4.970672ms)
✔ staffed operation remains local and does not write market volumes (6.17747ms)
(node:2187) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ a user write joins the serial executor after its arrival barrier without recursively chasing later deadlines (10.465584ms)
✔ a failed world barrier does not execute or acknowledge an economic write (4.574822ms)
✔ buy confirmation after delayed admission mutates the real SQLite world once (117.62255ms)
✔ sell confirmation after delayed admission mutates the real SQLite world once (61.816852ms)
✔ commercial policies reject coercion and invalid coverage (1.232339ms)
✔ default commercial policy does not mutate a legacy group (0.22005ms)
✔ running settlement ignores current price, count and catalog changes (2.039888ms)
✔ legacy invested cycle cannot fabricate missing locked detail (0.155036ms)
✔ stopped preview uses full count and only real official prices (0.305207ms)
✔ commercial page locations retain distinct hosts and identities (0.186907ms)
✔ commercial staffing uses the authoritative baseline and remains read only (0.91084ms)
✔ missing or invalid commercial authority never becomes a fabricated 100 percent (0.228517ms)
✔ integer commercial capacity retains fractional work and supports safe large counts (0.797312ms)
✔ zero-revenue recovery cycles are active, while absent legacy cycles are not (0.151551ms)
✔ complete receipt is buffered and reusable after timeout cleanup (28.181438ms)
✔ headers without a completed body hit the deadline and confirm the identical request (11.610205ms)
✔ two missing receipts finish as unknown rather than claimed failure or success (18.189079ms)
✔ unusable success receipt is confirmed before being accepted: {"result": (1.035269ms)
✔ unusable success receipt is confirmed before being accepted: {} (0.561814ms)
✔ unusable success receipt is confirmed before being accepted: {"result":{"ok":"true","message":"x"},"revision":1} (0.608302ms)
✔ definitive business rejection and retryable status preserve their real HTTP results (2.011072ms)
✔ confirmation has a fresh signal even if the first caller signal was aborted (1.705904ms)
✔ a request already aborted before send is not retried into a new economic action (0.369572ms)
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 503.550446


## dt

> economy@0.4.0 validate:dt
> node scripts/verify-contract-renewal-economic-events.mjs && npm run verify:provincial-economy && npm run verify:architecture && npm run test:nginx-config && npm run server:check && npm run test:coverage:dt && tsc && vite build

Legacy contract renewal compatibility and strategic economic event verification passed.

> economy@0.4.0 verify:provincial-economy
> node scripts/verify-provincial-economy.mjs && node scripts/verify-commercial-buildings.mjs

Strategic map pruned 10m topology verified: 1030765 bytes
Strategic map pruned 110m topology verified: 16996 bytes
地区经济验证通过：美国连续 48 州、中文展示名、首府目录和州级经济隔离保持稳定；所有州直接经营；战略地图闲置使用 10m 土地填充和轻量 110m 背景描边，raster-ready active RAF 只直接变换 Canvas，snapshot 缺失时才回退变换 live-SVG Surface，settle 后单次提交根 SVG viewBox 并恢复 Surface/Canvas transform:none 与 will-change:auto；固定 world bounds 与州面、州名、路线矢量几何保持同一 Camera；公路、铁路和航空沿各自正式几何运动，运行时不保留车道数据模型或返程副线，地图专属镜头栏和选路面板不使用毛玻璃。
commercial buildings verification passed

> economy@0.4.0 verify:architecture
> npm run verify:repository-text-format && node --experimental-strip-types scripts/verify-money-precision.mjs && node --experimental-strip-types scripts/verify-order-book-decimal-levels.mjs && node scripts/verify-document-authority.mjs && npm run verify:code-coverage && node scripts/verify-client-state-version.mjs && node scripts/verify-order-matching-core.mjs && node scripts/verify-system-market.mjs && node scripts/verify-provincial-unlock-transport.mjs && npm run verify:transport-route-lanes && npm run verify:province-map-focus && node scripts/verify-market-action-latency.mjs && node --experimental-strip-types scripts/verify-runtime-architecture.mjs && node scripts/verify-state-delivery-capacity.mjs && npm run verify:client-update-recovery && npm run verify:client-response && node scripts/verify-authentication-cache.mjs && node scripts/verify-email-registration.mjs && npm run verify:stress && node scripts/verify-scroll-ownership.mjs && node scripts/verify-gems-invitations-and-bans.mjs && node scripts/verify-daily-check-in.mjs && node scripts/verify-banking.mjs && node scripts/verify-weekly-cash-settlement.mjs && node scripts/verify-gem-shop.mjs && npm run verify:local-preview && node scripts/verify-page-content.mjs && node scripts/verify-auth-three-layer.mjs && node scripts/verify-game-three-layer.mjs && node scripts/verify-open-glass-sampling.mjs && npm run verify:navigation-badges && npm run verify:notifications && node scripts/verify-game-tutorial.mjs && npm run verify:strategic-outliner && node scripts/verify-online-auto-sell.mjs && node scripts/verify-assets-page.mjs && node scripts/verify-settings-layout.mjs && npm run verify:player-avatar && node scripts/verify-save-deletion.mjs && node --experimental-strip-types scripts/verify-display-format.mjs && node scripts/verify-ui-architecture-runner.mjs && npm run verify:echarts && node scripts/verify-page-section-spacing.mjs && npm run verify:product-artwork && npm run verify:facility-artwork && node scripts/verify-form-state-isolation.mjs && npm run verify:facility-unlock-selects && node scripts/verify-form-controls.mjs && npm run verify:production-config-visual && node scripts/verify-market-order-entry-compact.mjs && node scripts/verify-contract-layout.mjs && node scripts/verify-contract-audit.mjs && node scripts/verify-contract-types.mjs && node scripts/verify-daily-supply-contracts.mjs && node scripts/verify-currency-svg.mjs && node scripts/verify-mobile-touch-feedback.mjs && node scripts/verify-interaction-modality.mjs && node scripts/verify-virtual-list-scroll-chaining.mjs && node scripts/verify-overlay-scrollbars.mjs && node scripts/verify-overview-content.mjs && node scripts/verify-industry-catalog.mjs && node scripts/verify-production-methods.mjs && node scripts/verify-c1-input-balance.mjs && node scripts/verify-unified-factory-recipes-grid.mjs && npm run verify:production-settlement && npm run verify:production-lazy-settlement && node scripts/verify-production-desktop-layout.mjs && node scripts/verify-staple-crops-demand.mjs && node scripts/verify-market-reserve-operations.mjs && node --experimental-strip-types scripts/verify-market-assets.mjs && node scripts/verify-market-page-layout.mjs && npm run verify:market-information-hierarchy && npm run verify:market-desktop-cleanup && node scripts/verify-local-trade-privacy.mjs && node scripts/verify-market-sell-fee.mjs && node scripts/verify-leaderboards.mjs && node --experimental-strip-types scripts/verify-market-chart.mjs && node scripts/verify-liquid-glass-chrome.mjs && node scripts/verify-mobile-status-value-fit.mjs && node scripts/verify-desktop-primary-surfaces.mjs && node scripts/verify-authoritative-countdowns.mjs && node scripts/verify-primary-surface-insets.mjs && node scripts/verify-game-shell-layout.mjs && node scripts/verify-sidebar-navigation-collapse.mjs && node scripts/verify-mobile-page-sheet.mjs && node scripts/verify-warehouse-expansion.mjs && npm run verify:research && npm run verify:facility-auto-procure && node scripts/verify-facility-groups.mjs && node --experimental-strip-types scripts/verify-recipe-profit-analysis.mjs && node scripts/verify-asset-auctions.mjs && node scripts/verify-gift-code-batches.mjs && node scripts/verify-admin-navigation.mjs && npm run verify:population-policy-publishing && node scripts/verify-admin-player-statistics.mjs && npm run verify:gameplay-decision-support && node scripts/verify-runtime-efficiency.mjs && npm run verify:authoritative-hotpaths && node scripts/verify-runtime-reliability.mjs && node scripts/verify-deployment-storage.mjs && node scripts/verify-readonly-database-diagnostics.mjs && node scripts/verify-production-database-maintenance.mjs && node scripts/verify-mobile-facility-pull-refresh.mjs


> economy@0.4.0 verify:repository-text-format
> node scripts/verify-repository-text-format.mjs

仓库格式与清洁度验证通过：文本文件使用 LF，二进制资源不参与转换，可再生成测试产物未被跟踪。
Money precision verification passed.
Internal decimal order-level compatibility verification passed; player commodity UI remains immediate-price only.
文档提示: docs/UI_DESIGN_SYSTEM.md 较长（133559 字节）；请审查职责与可读性，不据此阻断变更
文档登记与本地链接检查通过；语义归属和内容边界仍需设计审查。

> economy@0.4.0 verify:code-coverage
> node scripts/verify-code-coverage.mjs

代码覆盖率边界验证通过：DT/IT/ST 分层、DT 与 IT 覆盖范围及最低阈值均已锁定。
客户端状态版本契约验证通过：当前 40，最低兼容 40
共享撮合内核验证通过：共享内核继续服务服务器内部模拟与历史兼容；玩家商品交易保持每日系统价即时成交且不暴露盘口。
每日系统价即时市场验证通过：玩家无挂单、北京时间零点调价、±5% 日变动、旧冻结释放、自动经营与建厂购料均使用当日服务器价格。
州级经济与节点循环运输验证通过：路线业务行程仍按环线／往返结算，地图只使用单一正式几何；客户端装卸、距离计费、整周期燃料预付、单段离线到站与私有状态切片均已锁定。

> economy@0.4.0 verify:transport-route-lanes
> node --experimental-strip-types scripts/verify-transport-route-lanes.mjs

运输路网验证通过：Natural Earth 固定版本、1128×2 首府快照、首尾首府坐标与核心寻路继续受保护；公路与铁路直接复用各自真实中心线，重复路线完全共线且运行时无车道数据模型，往返只反转同一几何，航空使用唯一 Q 抛物线并沿同源采样点运动，路线列表与详情按 routeId 高亮，经济距离仍与地图几何解耦。

> economy@0.4.0 verify:province-map-focus
> node scripts/verify-province-map-focus.mjs

地图 active 栅格快照验证通过：唯一逻辑 Camera 与权威 SVG 保持不变；snapshot ready 时 active RAF 只变换 Canvas，SVG 保持 settled 几何，snapshot 缺失时才回退 live SVG，settle 后提交最终 SVG viewBox。
province map focus verification passed
市场动作延迟防回退验证通过：玩家商品写动作单次按服务器当日价即时结算，旧挂单迁移版本化，动作权威增量回执、确认即结束 pending、普通写请求超时、会话启动例外、限流保留与同键确认重试均已锁定。
运行时架构验证通过：全局市场/建筑与州级内嵌页面均按职责动态拆包，权威时间基准与叶子级共享时钟、虚拟列表二分与滚动合并、ECharts 资产圆环、资产比例和本地匿名成交缓存均已锁定。
状态交付容量验证通过：世界缓存、单一全局调度、六分区增量交付与完整快照替换、catalog 完整性门禁与单次全量恢复、独立 serverNow、共享单调服务器时钟、动作权威增量回执与直接控制 Intent、修订号门禁、可抢占刷新任务、5 秒默认间隔和 JSON gzip 均已锁定。

> economy@0.4.0 verify:client-update-recovery
> node scripts/verify-client-update-recovery.mjs

客户端版本更新、共享刷新控件、刷新恢复、缓存与原子发布规则验证通过。

> economy@0.4.0 verify:client-response
> node scripts/verify-client-response-performance.mjs

客户端响应性能防回退验证通过：六分区外层协议、动作权威增量交付、确认即结束 pending、player/market 子修订结构共享、React render 快照一致性、子切片隔离、共享秒级叶子时钟保持；玩家即时市场和自动经营均不再扫描开放订单或构建玩家挂单索引。
认证缓存验证通过：状态 10 秒、写操作 2 秒、管理员零缓存、请求合并和 5000 条 LRU 已锁定。
邮箱认证验证通过：注册发送前查重、验证码安全、首次建档邀请码归因、注册后禁止补填、统一同 IP 异常上报、管理员封禁、登录主面板与独立注册／密码重置子面板、密码重置代理和 Nginx 路由均已锁定。

> economy@0.4.0 verify:stress
> node scripts/verify-stress-test-accounts.mjs && node scripts/verify-stress-test-flow.mjs && npm run test:stress

Fixed reusable stress-test account registry, strict slicing and secret boundary verification passed.
压力测试执行器、事务混合覆盖、动作权威增量、幂等命令语义、隔离预置、性能预算、生产安全门禁、报告和工作流均已锁定。

> economy@0.4.0 test:stress
> node --test tests/stress/stress-flow.test.mjs

(node:2528) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ stress metrics calculate percentiles and enforce budgets (1.348795ms)
✔ budgeted routes must provide server-local timing instead of client end-to-end timing (0.195572ms)
✔ stress safety prevents production writes and unsafe targets (0.46611ms)
✔ isolated mixed stress exercises real authentication, state delivery, writes and idempotency (5192.028041ms)
✔ isolated transaction mix exercises state, orders, facilities, recipes, builds and research (8116.738239ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 18220.333826
Nested custom/native scroll ownership, shared signed-in page scroll, Strategic Outliner vertical boundary release, regional factory page flow and boundary release verification passed.
宝石、邀请与封禁验证通过：同 IP 仅上报异常，账号封禁只由管理员执行，邀请防刷与审计边界保持。
Daily check-in verification passed.
银行验证通过：现有存取款守恒、冻结生产、净资产、期限利率与活跃周结息规则保持不变，资金管理、连续冻结列表、授信利用率、移动端无横向冻结表格与权威流水筛选均已锁定。
固定利息与周资金结算验证通过：活跃周每日 1%、周末 10% 账单、登录扣款、实际收取额转入市场储备、长期回归一次性结算、冻结资金守恒和排行榜调整均已锁定。
商店验证通过：礼品码兑换唯一归属商店，每日终端报价和研发宝石加速保持有效，工厂施工加速仅保留只读历史审计与 410 兼容墓碑。

> economy@0.4.0 verify:local-preview
> npm run generate:local-preview && node scripts/verify-local-game-preview.mjs


> economy@0.4.0 generate:local-preview
> node scripts/generate-local-game-preview.mjs

Generated /home/runner/work/Economy/Economy/src/dev/generated/local-game-preview-state.json
Local no-login game preview verification passed.
页面内容与职责验证通过：一级市场/建筑锁定全局视图；市场目录使用今日价格与真实成交信息，地区商品详情使用服务器当日价即时交易且禁止恢复五档/自定义价格；建筑和地区建筑目录继续共用统一页面实体列表表面、相邻细线、Chevron、目录插画槽和正负数值色；一级建筑按工厂类型 → 地区 → 现有地区工厂详情下钻；所有玩家 PageLayout 共用 40px 标题轨道与紧凑单行标题；州级上下文继续复用本地市场/建筑，邀请卡与礼品码兑换唯一归属商店，地图保留逻辑 1–4 动态美国居中手势缩放并禁止恢复独立缩放功能面板。
认证三层验证通过：唯一摄影根、单一 CSS 毛玻璃认证宿主、自然内容高度、登录主面板与注册／密码重置子面板切换、断点表单保持和认证错误恢复布局满足当前基线。
持久全应用摄影背景验证通过：唯一图片节点、统一启动加载、已就绪 authority 复用、根级氛围切换、认证、玩家、管理员、状态页、失败回退、移动 Overlay 和浏览器 harness 均已锁定。
登录后毛玻璃开放采样链验证通过：唯一四层根隔离、桌面与移动玩家／管理员祖先和四场景浏览器回归均已锁定。

> economy@0.4.0 verify:navigation-badges
> node --experimental-strip-types scripts/verify-navigation-badges.mjs

navigation badge and auction attention verification passed

> economy@0.4.0 verify:notifications
> node --experimental-strip-types scripts/verify-notification-center.mjs

notification center verification passed
Tutorial verification passed.

> economy@0.4.0 verify:strategic-outliner
> node scripts/verify-strategic-outliner.mjs

strategic outliner verification passed
工厂自动经营防回退检查通过：工厂策略继续统一派生采购/出售阈值，在线客户端按当日官方系统价和库存缺口触发服务器即时交易，不再维护玩家托管挂单。
银行资产总览、商业建筑资产估值、资金管理与冻结融资布局、十二个正式页面与十一项可见导航、本地成交 v7、移动资产构成与独立资产页删除验证通过。
设置页统一单列、四项统计、账号分组、邀请移出与存档管理验证通过。

> economy@0.4.0 verify:player-avatar
> node scripts/verify-player-avatar.mjs

玩家头像验证通过：状态栏、设置页与排行榜复用 PlayerAvatar，头像盒保持 1:1，浏览器仅上传 64×64 WebP 缩略图并由服务器独立存储。
删除存档的确认、阻断、自动关闭、局部 Mutation Scope、账号级数据保留、页面存档世代锁、后台自动写 authority 门禁、旧标签页写入隔离与旧接口墓碑验证通过。
显示格式验证通过：只读数量、货币与排名统一紧凑显示并提供完整数字 Tooltip，输入继续使用精确值。
共享 UI、唯一开关、导航完全不透明状态色、独立工厂 SVG 与统一商品图标验证通过。
downward prerequisite research DAG, three-state icon-and-name technology nodes, edge-to-edge desktop canvas, stable hover geometry, ordinary wheel zoom, drag pan, double-click current focus, shared workspace card with transparent research canvas, shared mobile pan/zoom viewport, stable selection, no below-tree page-flow card, detail sheet and design verification passed
地区实体标题导航验证通过：商品、商业建筑与工厂详情共享两行地区标题与可点击地区名，统一通过受限页面栈 push 到对应地区概览并保留原详情返回路径，40px 标题轨道紧凑例外与浏览器回归均已锁定。
工厂目录扁平列表验证通过：一级与地区建筑保持两行生产配置与插画几何，但不再使用对象卡。
运输路线目录 UI 防回退验证通过：路线使用对象卡且无行分割线，重复标题和路线数量胶囊已移除，底部操作区不覆盖共享页面栈，浏览器回归统一使用底部入口。

> economy@0.4.0 verify:echarts
> node scripts/verify-echarts-adoption.mjs

ECharts 架构验证通过：唯一 EconomyChart 继续负责业务数据图表，战略地图使用独立静态 SVG 世界面与 SVG viewBox Camera；统一 commonTooltip 进入共享 Top Layer Tooltip 宿主，毛玻璃材质、精确依赖、SVG 按需模块、生命周期、无障碍、市场动态几何、统一 Pie padAngle 及管理员与资产图表均已锁定。
页面一级区块统一间距验证通过：PageLayout 自动内容栈、零 DOM 路由包装器、研发固定正文例外、地图全工作区例外、外壳沟槽映射、直接子元素外边距清理、新页面扫描、设计权威与真实几何回归均已锁定。

> economy@0.4.0 verify:product-artwork
> npm run generate:product-artwork && node scripts/verify-product-artwork.mjs


> economy@0.4.0 generate:product-artwork
> node scripts/generate-product-artwork-thumbnails.mjs

商品运行时缩略图生成完成：38 种 128×128 RGBA PNG，总计 850.3 KiB，更新 38 个文件。
商品图片视觉验证通过：38 种正式商品的 1024×1024 RGBA PNG 源图已生成 128×128 运行时缩略图，共享市场商品行、生产结算及富内容下拉框使用 ProductArtwork PNG，其余紧凑语义位置继续使用 SVG 或通用回退。

> economy@0.4.0 verify:facility-artwork
> npm run generate:facility-artwork && node scripts/verify-facility-artwork.mjs


> economy@0.4.0 generate:facility-artwork
> node scripts/generate-facility-artwork-thumbnails.mjs

工厂场景运行时缩略图生成完成：26 种 256×256 RGBA PNG，总计 4695.3 KiB，更新 26 个文件。
工厂场景插画验证通过：26 种正式工厂与 1024×1024 RGBA 源图、256×256 运行时缩略图、ID 映射、市场列表与详情独立插画槽、主视觉使用边界及 C1–C7 从空白新绘 SHA-256 基线一致。
form state and polling refresh isolation verification passed

> economy@0.4.0 verify:facility-unlock-selects
> node --experimental-strip-types scripts/verify-facility-unlock-selects.mjs

facility unlock select verification passed
统一表单、统一可见下拉、受控生产配置变体、共享 Tooltip 宿主与逐节点 Top Layer、游戏名词、数字草稿、整数输入滚轮归属、统一导航角标与移动端尺寸验证通过。

> economy@0.4.0 verify:production-config-visual
> node scripts/verify-production-config-visual.mjs

生产配置视觉验证通过：生产产物与作业制度使用 UMG 风格 Auto 槽连续左排；候选能够完整容纳时按真实内容高度展开，必要时在安全矩形内平移，不产生内部纵向滚动。
市场即时交易数量控件验证通过：商品成交价只读取服务器当日价，连续 48 州均可交易，玩家仅调整数量，价格输入与五档盘口不得恢复。
合同页布局验证通过：默认工作台、四视图、主从详情、方向筛选与既有合同对象卡/审计兼容保持当前规则。
Contract audit and compact history verification passed.
六类合同方向、资产锁定、现行工作区入口与权威设计验证通过
地区化每日商品合同验证通过：按地区固定价、每日额度、合同时间按天、生产择价来源、优先供应条件、商品详情摘要与跳转均已锁定。
货币 SVG 验证通过：50 处可见金额统一使用 CreditsIcon，通知边界兼容旧字符串，玩家端源码无字符货币符号。
移动触摸反馈验证通过：触摸输入不产生粘滞交互视觉，键盘 focus-visible 保留；原生 tap highlight 的实现和图表触控回归由对应 CSS 与图表 DESIGN 锁定。
全局输入方式验证通过；当前遗留未约束 hover 15 条，新增条目为 0。
Shared virtual windowing, single two-axis record viewport and boundary scroll chaining verification passed.
统一尺寸、玩家页面滚动条空闲自动隐藏、共享登录后页面滚动、共享移动详情安全边缘、鼠标与触控策略、市场列表无横向主滚动和单一双轴虚拟成交表验证通过。
概览验证通过：共享外壳折叠、桌面战略追踪器、移动同一 Outliner 教程、签到日历、服务器日期语义、权威资产状态、子切片依赖、状态栏趋势与浏览器碰撞回归满足设计基线。
产业目录验证通过：38 种商品、26 种工厂、全工厂具名作业制度、炼油工业耗材和 C2 3/6/9/10.5 利润梯度。
生产方式验证通过：26 类工厂均使用四种具名制度与语义图标，旧制度只参与等参数存档迁移，共享制度定义、固定精度、研发校验、独立移动视口门禁与客户端版本 40 均已锁定。
C1 投入品平衡验证通过：六种价格与上游批量产出、三级利润区间、同级差距和当前市场需求模型 20 均已锁定。
统一工厂配方与地区卡片验证通过：目录顺序、三列 4:5 工厂卡、二级详情、无标题生产配置、游戏名词解释与共享移动基础设施均已锁定。

> economy@0.4.0 verify:production-settlement
> node scripts/verify-production-settlement-layout.mjs

生产结算商品 PNG、无标题生产配置、插画右侧经营指标、本地商品详情导航、按钮圆角进度、资产入口同行与几何防回退验证通过。

> economy@0.4.0 verify:production-lazy-settlement
> node scripts/verify-production-lazy-settlement.mjs

production lazy settlement architecture verified
地区建筑验证通过：建设卡优先、三列 4:5 工厂卡、二级详情、正文分区导航、全玩家 40px 标题轨道与紧凑开关均已锁定。
市场需求验证通过：模型 20 使用工厂承载驱动的实际人口与真实钱包覆盖全部 38 种商品，并按州级 PCE 权重生成本地需求；共享撮合只服务服务器内部人口／储备模拟，玩家商品交易保持每日系统价即时成交。
market reserve operations verification passed
商品即时市场资产验证通过：玩家只按当日服务器价格即时交易；公开商品盘口为空；内部人口／储备档位兼容、商品／工厂主视觉、本地成交窗口化与管理员高增长列表继续受保护。
地区即时商品市场验证失败：
- 地区商品详情缺少即时成交结构: placeAssetOrder('commodity', assetId, orderSide, parsedQuantity, officialPrice)
- 地区商品详情缺少即时成交结构: {orderSide === 'buy' ? `立即买入${assetName}` : `立即卖出${assetName}`}


## contracts

FAILED node scripts/verify-market-page-layout.mjs 
 地区即时商品市场验证失败：
- 地区商品详情缺少即时成交结构: placeAssetOrder('commodity', assetId, orderSide, parsedQuantity, officialPrice)
- 地区商品详情缺少即时成交结构: {orderSide === 'buy' ? `立即买入${assetName}` : `立即卖出${assetName}`}


FAILED node scripts/verify-authoritative-countdowns.mjs 
 权威倒计时验证失败:
- src/api/game.ts 缺少: DEFAULT_WRITE_TIMEOUT_MS = 12_000



## it
ℹ tests 567
ℹ suites 0
ℹ pass 567
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 11293.964009


## browser
════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


[49/30] [chromium] › tests/browser/unified-buildings.spec.ts:52:3 › regional directory and both shared details remain usable at 1440px
[50/30] [chromium] › tests/browser/unified-buildings.spec.ts:90:1 › global commerce restores its region, detail and filtered catalog
[51/30] [chromium] › tests/browser/unified-buildings.spec.ts:110:1 › commercial automatic operation is independent and prevents duplicate requests
[52/30] [chromium] › tests/browser/unified-buildings.spec.ts:138:1 › failed commercial policy save preserves the authoritative setting
[53/30] (retries) [chromium] › tests/browser/unified-buildings.spec.ts:52:3 › regional directory and both shared details remain usable at 1440px (retry #1)
[54/30] (retries) [chromium] › tests/browser/unified-buildings.spec.ts:90:1 › global commerce restores its region, detail and filtered catalog (retry #1)
[55/30] (retries) [chromium] › tests/browser/unified-buildings.spec.ts:110:1 › commercial automatic operation is independent and prevents duplicate requests (retry #1)
[56/30] (retries) [chromium] › tests/browser/unified-buildings.spec.ts:138:1 › failed commercial policy save preserves the authoritative setting (retry #1)
  25) [chromium] › tests/browser/unified-buildings.spec.ts:52:3 › regional directory and both shared details remain usable at 1440px 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-regional-fb643-ils-remain-usable-at-1440px-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-regional-fb643-ils-remain-usable-at-1440px-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-regional-fb643-ils-remain-usable-at-1440px-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-regional-fb643-ils-remain-usable-at-1440px-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-regional-fb643-ils-remain-usable-at-1440px-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-regional-fb643-ils-remain-usable-at-1440px-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


  26) [chromium] › tests/browser/unified-buildings.spec.ts:90:1 › global commerce restores its region, detail and filtered catalog 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-global-c-dd581-detail-and-filtered-catalog-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-global-c-dd581-detail-and-filtered-catalog-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-global-c-dd581-detail-and-filtered-catalog-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-global-c-dd581-detail-and-filtered-catalog-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-global-c-dd581-detail-and-filtered-catalog-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-global-c-dd581-detail-and-filtered-catalog-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


  27) [chromium] › tests/browser/unified-buildings.spec.ts:110:1 › commercial automatic operation is independent and prevents duplicate requests 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-commerci-da9e5-prevents-duplicate-requests-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-commerci-da9e5-prevents-duplicate-requests-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-commerci-da9e5-prevents-duplicate-requests-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-commerci-da9e5-prevents-duplicate-requests-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-commerci-da9e5-prevents-duplicate-requests-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-commerci-da9e5-prevents-duplicate-requests-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


  28) [chromium] › tests/browser/unified-buildings.spec.ts:138:1 › failed commercial policy save preserves the authoritative setting 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-failed-c-2521e-s-the-authoritative-setting-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-failed-c-2521e-s-the-authoritative-setting-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-failed-c-2521e-s-the-authoritative-setting-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-failed-c-2521e-s-the-authoritative-setting-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-failed-c-2521e-s-the-authoritative-setting-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-failed-c-2521e-s-the-authoritative-setting-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


[57/30] [chromium] › tests/browser/unified-buildings.spec.ts:147:1 › commercial goods open the same local product and return without trading
[58/30] [chromium] › tests/browser/unified-buildings.spec.ts:160:1 › legacy unknown settlement detail stays unknown and empty commerce retains construction
[59/30] (retries) [chromium] › tests/browser/unified-buildings.spec.ts:147:1 › commercial goods open the same local product and return without trading (retry #1)
  29) [chromium] › tests/browser/unified-buildings.spec.ts:147:1 › commercial goods open the same local product and return without trading 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-commerci-4ce26--and-return-without-trading-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-commerci-4ce26--and-return-without-trading-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-commerci-4ce26--and-return-without-trading-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-commerci-4ce26--and-return-without-trading-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-commerci-4ce26--and-return-without-trading-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-commerci-4ce26--and-return-without-trading-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


[60/30] (retries) [chromium] › tests/browser/unified-buildings.spec.ts:160:1 › legacy unknown settlement detail stays unknown and empty commerce retains construction (retry #1)
  30) [chromium] › tests/browser/unified-buildings.spec.ts:160:1 › legacy unknown settlement detail stays unknown and empty commerce retains construction 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-legacy-u-caae8-mmerce-retains-construction-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-legacy-u-caae8-mmerce-retains-construction-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-legacy-u-caae8-mmerce-retains-construction-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/unified-buildings-legacy-u-caae8-mmerce-retains-construction-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-legacy-u-caae8-mmerce-retains-construction-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-legacy-u-caae8-mmerce-retains-construction-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


  30 failed
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:24:3 › commercial cards and details reuse industrial geometry at 320px 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:24:3 › commercial cards and details reuse industrial geometry at 390px 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:24:3 › commercial cards and details reuse industrial geometry at 720px 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:24:3 › commercial cards and details reuse industrial geometry at 1440px 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:70:1 › commercial cards show per-building profit and details show server-locked totals 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:87:1 › commercial switch prevents repeated requests and preserves an invested cycle after stop 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:115:3 › commercial network failure leaves the authoritative switch intact 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:115:3 › commercial server failure leaves the authoritative switch intact 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:133:1 › commercial countdown waits for the server and does not settle or restart locally 
    [chromium] › tests/browser/commercial-buildings-layout.spec.ts:147:1 › commercial empty state and long names remain usable at 320px 
    [chromium] › tests/browser/commercial-staffing.spec.ts:15:3 › commercial staffing and cycle tracks remain distinct at 320px 
    [chromium] › tests/browser/commercial-staffing.spec.ts:15:3 › commercial staffing and cycle tracks remain distinct at 390px 
    [chromium] › tests/browser/commercial-staffing.spec.ts:15:3 › commercial staffing and cycle tracks remain distinct at 720px 
    [chromium] › tests/browser/commercial-staffing.spec.ts:15:3 › commercial staffing and cycle tracks remain distinct at 1440px 
    [chromium] › tests/browser/commercial-staffing.spec.ts:47:1 › staffing changes never overwrite an invested commercial cycle or claim local settlement 
    [chromium] › tests/browser/commercial-staffing.spec.ts:65:1 › missing staffing is unknown and does not fabricate full efficiency or locked details 
    [chromium] › tests/browser/trade-confirmation.spec.ts:28:1 › concurrent identical writes share one HTTP attempt and each receives its own readable receipt 
    [chromium] › tests/browser/trade-confirmation.spec.ts:43:1 › two lost receipts retain one key across reload and successful confirmation releases it 
    [chromium] › tests/browser/trade-confirmation.spec.ts:63:1 › HTTP success with a broken receipt does not release the original transaction key 
    [chromium] › tests/browser/trade-confirmation.spec.ts:76:3 › buy controls freeze pending parameters and confirm even after funds or inventory change 
    [chromium] › tests/browser/trade-confirmation.spec.ts:76:3 › sell controls freeze pending parameters and confirm even after funds or inventory change 
    [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 320px 
    [chromium] › tests/browser/unified-buildings.spec.ts:52:3 › regional directory and both shared details remain usable at 320px 
    [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 1440px 
    [chromium] › tests/browser/unified-buildings.spec.ts:52:3 › regional directory and both shared details remain usable at 1440px 
    [chromium] › tests/browser/unified-buildings.spec.ts:90:1 › global commerce restores its region, detail and filtered catalog 
    [chromium] › tests/browser/unified-buildings.spec.ts:110:1 › commercial automatic operation is independent and prevents duplicate requests 
    [chromium] › tests/browser/unified-buildings.spec.ts:138:1 › failed commercial policy save preserves the authoritative setting 
    [chromium] › tests/browser/unified-buildings.spec.ts:147:1 › commercial goods open the same local product and return without trading 
    [chromium] › tests/browser/unified-buildings.spec.ts:160:1 › legacy unknown settlement detail stays unknown and empty commerce retains construction 