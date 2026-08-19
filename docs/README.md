# Economy 设计文档索引

> 状态：当前文档入口
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-08-19
> 客户端状态版本：36
> 世界状态版本：32

本目录只保留当前设计。旧规则不归档在 `docs/`，也不得以“补充说明”“V2/V3”或未登记专题文档的形式继续并行存在。未列入下方权威文档表的 Markdown 文件不得存在。

> 人口政策权威规则已纳入 `GIFT_CODE_AND_ADMIN_DESIGN.md`：仅允许受控稳定需求参数、缺口式立即补充、同周期约束、到期恢复和幂等，不要求管理备注、不生成调控记录；参数不设业务上限，但必须通过下限、安全整数和计算结果范围校验，且不允许任意余额编辑。

## 权威文档

| 文档 | 唯一职责 |
|---|---|
| `PRODUCT_AND_GAMEPLAY_DESIGN.md` | 产品定位、核心循环、美国本土连续 48 个州级经营地区、本地经济边界、工作冷却、每日签到、普通货币与宝石、直接货币发行、人口数量、工厂承载、迁入迁出、就业收入、三类人口真实钱包、消费需求与排行榜目标 |
| `GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md` | 工厂施工加速退役、研发宝石加速、每日终端动态报价、接受／拒绝决策、历史汇率、SQLite 审计与禁止宝石兑换工厂产量 |
| `INDUSTRY_AND_PRODUCTION_DESIGN.md` | 38 种商品、26 种工厂（含 C1 与 C2 工厂专属作业制度、生产科技／作业科技分离、工业燃料／工业化学品，以及配套工具、化肥、饲料、养殖药剂、机械、拖拉机产业支线）、州级工厂集群与本地投入产出、固定精度经济数值、参考利润、周期成本工资、C1–C7 人口承载权重、生产复杂度岗位结构、固定建造业岗位结构、持续生产、集群级生产方式、三态、自动恢复、工厂抵押生产资格，以及商品供货、玩家抵押借贷、工厂使用权租赁与生产／资产守恒审计边界 |
| `FACILITY_CATALOG_PRESENTATION_DESIGN.md` | 客户端工厂目录展示顺序、已拥有工厂卡片排序和目录顺序防回退 |
| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 州级本地商品和工厂统一限价订单、冻结、抵押后的可转让数量、撮合、成交价、估值、资产统计和普通玩家成交匿名化 |
| `WAREHOUSE_EXPANSION_DESIGN.md` | 州级本地无限仓库、真实商品库存、容量机制退役、州页仓库分区、市场在线自动采购／自动出售、商品自动交易卡和商品网格密度 |
| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 十一个正式页面、隐藏州级上下文页、所有玩家页面常驻的美国本土连续 48 州战略地图、四类页面战略面板、C1-C7 产业阶段与按产业链拆分的科技节点研发入口、银行资产总览与存贷款、商品／工厂资产拍卖、排行榜生产数量纯数字显示、统一导航角标语义与已读规则、进行中的合同默认视图、可审计合同历史、登录注册入口、独立商店、分享链接、邀请码、封禁提示、模块唯一归属和页面防回退规则 |
| `MARKET_CHART_LAYOUT_DESIGN.md` | 市场近 24h 行情图的整数坐标、成交量绘图区最低可读高度、动态纵横比、底部安全区、图例居中和真实浏览器几何回归 |
| `REGISTRATION_INVITE_FLOW_DESIGN.md` | 注册邀请码输入、分享链接预填、来源归因、首次绑定、注册完成后禁止补填、登录／注册入口三层视觉、认证卡片几何与旧接口退役 |
| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、战略页面面板与地图 Chrome、工作区浮层安全区、统一表单控件、统一 SVG 图标、统一导航角标视觉、商品与工厂场景插画主视觉、覆盖式滚动条、订单成交表、桌面导航行高、中文界面、响应式、移动触摸反馈与可访问性 |
| `AUTHORITATIVE_COUNTDOWN_DESIGN.md` | 服务器绝对截止时间、状态响应 `serverNow`、共享单调服务器时钟、本地资格倒计时、权威状态转换倒计时、到期立即刷新、每秒确认与统一注册表 |
| `PRIMARY_SURFACE_INSET_DESIGN.md` | 玩家端一级卡片外层内边距令牌、共享组件语义、加载顺序、页面 CSS 边界和贴边内容例外 |
| `OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md` | 概览真实内容宽度断点、外层轨道、签到日历、短列表滚动和浏览器几何回归 |
| `PRODUCTION_PILL_ALIGNMENT_DESIGN.md` | 建筑页状态／等级胶囊与工厂开关的统一可见几何和紧凑点击区域例外 |
| `LIQUID_GLASS_CHROME_DESIGN.md` | 认证卡片、游戏与管理员共享根外壳、纯 CSS 毛玻璃材质、玩家常驻战略地图、建筑式／全区域页面、独立公开事件右栏、侧栏输入方式、浮层安全根、移动工作区与底栏 |
| `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` | 服务器权威边界、世界级人口状态与周期迁移、银行事务与结息调度、每日签到、三类合同事务、追加式 SQLite 合同／拍卖审计、匿名最近 10 条出价接口与 `contract` 分区、普通玩家订单公开序列化、邮箱验证码注册、统一账号首次建档、邀请归因、注册 IP 封禁、生产 SQLite 只读诊断、生产 SQLite INCREMENTAL 空间维护、API、容量限制、Nginx、systemd 和部署 |
| `LOCAL_ACTIVITY_LOG_DESIGN.md` | 浏览器仅保留匿名逐笔成交所需的最小地区订单快照、v7 迁移、按当前地区展示、清除语义与银行权威流水边界 |
| `GIFT_CODE_AND_ADMIN_DESIGN.md` | 单个与最多 50,000 个批量礼品码、TXT 明文导出、礼品兑换、商品／工厂单项与捆绑资产包拍卖、发布费与卖方手续费、隐藏保留价、最低加价、自动延时、匿名出价、世界 15／21 迁移、人口规模与就业诊断、人口政策、封禁复核、管理员权限和运营控制台编排 |

## 修改规则

1. 一个规则只能有一个权威归属。
2. 跨主题内容只引用权威文档，不复制完整规则。
3. 修改状态版本、世界版本、API、路径、端口或部署权限时，必须同步更新本文档、根 `README.md` 和对应验证脚本。
4. 删除或替换设计时直接修改权威文档，不新建旧版本归档。
5. 新的功能规则必须合并进现有权威文档，不得重新创建已删除文档或追加独立 V2/V3 章节。
6. 代码与文档冲突时不得默认以较新的文件名为准；应核对当前类型、服务器实现、测试和构建检查并立即消除冲突。
7. `scripts/verify-document-authority.mjs` 必须遍历 `docs/*.md`，检查权威文件、版本号、禁止文件名和未登记 Markdown 文件；不得为了合并临时绕过或删除该检查。
8. 未更新设计文档和防回退检查的规则变更不应合并。
9. 过长文档优先通过删除重复表格、合并同一责任和调整章节顺序整理。只有拆分后的文件具备明确且唯一的职责时才允许拆分，并必须同步修改本索引、根 `README.md` 和权威性验证脚本。
10. 商品初始参考价和周期成本允许最多两位小数，生产数量和周期秒数必须保持整数；参考分钟利润必须由正式目录自动校验，不得只在文档中手算。
11. 移动端触控元素必须关闭浏览器原生蓝色 tap highlight，同时保留 `:focus-visible` 键盘焦点；实现统一放在 `src/styles/mobile-interaction.css`，并由 `scripts/verify-mobile-touch-feedback.mjs` 防回退。
12. 状态轮询修订号、响应防倒退、动作／轮询互斥、空闲读取不写库、默认刷新间隔、六分区完整快照替换、游戏 JSON 压缩和客户端状态版本兼容窗口属于服务器容量规则；当前版本与兼容下限统一定义在 `server/shared/economy-state-version.js`，必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并通过 `scripts/verify-state-delivery-capacity.mjs` 与 `scripts/verify-client-state-version.mjs` 防回退。
13. 主页账号认证缓存的分级 TTL、Cookie 摘要、并发合并、错误策略和 LRU 上限属于安全与容量规则；必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并通过 `scripts/verify-authentication-cache.mjs` 防回退。
14. 小麦／水稻目录、农场改种、持续生产和主食替代预算属于产业与需求权威规则；必须同步更新产业、产品、服务器文档，并通过产业、工厂与主食需求验证脚本防回退。
15. Economy 注册完成时点、主页账号自动建档、邮箱验证码、IP 指纹、多账号封禁、Resend、注册路由和登录注册双模式属于服务器与页面权威规则；必须同步更新服务器、页面、根 README、`scripts/verify-email-registration.mjs` 与服务器测试。
16. 人口数量、工厂结构与活跃承载、迁入迁出、类别转换、劳动力就业、按实际人口计算的消费需求、三类人口六位小数真实钱包、私有 `fundingSlices`、五档消费状态与预算份额、聚合落单、虚拟商品预算赤字、两位小数三档需求曲线、跨周期成交率保留、证据置信度供需压力、无业务总量上限、库存与资金守恒的双边市场储备（可通过订单簿、固定采购合同与储备清仓拍卖跨市场调节）、生产链双向滞后价格传导和迁移清理属于产品、产业、订单簿与服务器权威规则；必须同步更新对应文档、测试和 `scripts/verify-staple-crops-demand.mjs`。
17. 宝石、永久邀请码、首次建档时的分享链接／注册表单邀请码归因、注册完成后禁止补填、同 IP 异常上报、管理员手动封禁、423 响应、管理员解禁与审计属于产品、页面、服务器和管理员权威规则；必须同步更新对应文档、测试和 `scripts/verify-gems-invitations-and-bans.mjs`。
18. 商店每日终端动态报价、全服同价、接受／拒绝决策、单向兑换、直接货币发行、研发宝石加速、工厂施工加速退役、兑换幂等与独立页面属于产品、页面和服务器权威规则；必须同步更新 `GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md`、对应文档、测试和 `scripts/verify-gem-shop.mjs`；邀请卡唯一归属商店，不得恢复固定永久汇率、同日重复兑换、宝石兑换工厂产量或工厂施工宝石加速写路径。
19. 普通玩家成交记录不得暴露来源、去向或对手订单；API、本地存储和市场页面必须同时匿名化，并通过 `scripts/verify-local-trade-privacy.mjs` 防回退。
20. 运行时可靠性、依赖锁、浏览器测试、localStorage 容错、管理员记录分页、验证码保留和限流缓存上限属于服务器、页面与管理员共同规则；必须同步更新对应权威文档并通过 `scripts/verify-runtime-reliability.mjs` 防回退。
21. 商品与工厂单项或捆绑资产包竞价、卖方资产冻结、最高出价资金、发布费托管、卖方成交手续费、隐藏保留价、最低加价、自动延时、竞买匿名化、最近 10 条按需历史、追加式拍卖审计、冻结资产毛值计价、商品仓库预占、工厂生产冻结和订单簿行情隔离属于拍卖、订单簿、仓库、生产、页面与服务器共同规则；必须同步更新对应权威文档、测试和 `scripts/verify-asset-auctions.mjs`。
22. 艺术资产页面、`collections` 路由、管理员管理分区、图片接入、归属历史与 `collectible` 拍卖类型已永久删除；世界 15 必须保留纯商品／工厂拍卖并整包取消含已删除资产的旧拍卖，退回资金并释放同包商品／工厂。旧接口只返回 `410 Gone`，该规则由 `scripts/verify-asset-auctions.mjs` 和迁移测试防回退。
23. 统一订单簿玩家卖出手续费、按卖单累计精确 1%、人口真实冻结资金、匿名 `fee/netTotal` 与市场服务就业属于订单簿手续费规则；拍卖不得调用 `applyMarketSellFee` 或生成 fill，但独立按成交总价向卖方收取精确 1% 并另收发布费。两套规则必须同步更新对应文档、测试、`scripts/verify-market-sell-fee.mjs` 与 `scripts/verify-asset-auctions.mjs`。
24. 拍卖资产包数量输入的字符串草稿、空白编辑、合法性门控、失焦归一化和草稿清理属于页面权威规则；必须同步更新 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`、`AuctionPage.tsx` 与 `scripts/verify-asset-auctions.mjs`，不得恢复空值立即回填为 `1` 的实现。
25. 统一表单组件、正整数字符串草稿、错误／只读／禁用状态、移动端 `48px`／`16px`、登录未受控自动填充和最终样式加载顺序属于 UI 权威规则；必须同步更新 `UI_DESIGN_SYSTEM.md`、`FormControls.tsx`、`form-controls.css`、`integerDraft.ts` 与 `scripts/verify-form-controls.mjs`，不得在业务页面恢复平行基础输入视觉。
26. 登录后游戏与管理员桌面外壳几何、侧栏导航固有行高、覆盖式滚动条、移动贴边轨道和纵向滚动链分别归属 `LIQUID_GLASS_CHROME_DESIGN.md` 与 `UI_DESIGN_SYSTEM.md`；不得重新创建 `GAME_SHELL_LAYOUT_DESIGN.md`、`OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md` 或其他职责重叠的平行专题文档。
27. 工厂目录展示顺序、概览布局完整性、建筑页胶囊例外、注册邀请码交互和一级卡片外层内边距虽使用独立文档，但职责必须保持在本索引限定范围内；不得把产品经济、页面模块归属、通用 UI、服务器事务或部署规则复制进这些专题文档。
28. 玩家端一级卡片的外层内边距、组件语义、业务 CSS 责任和贴边内容例外唯一归属 `PRIMARY_SURFACE_INSET_DESIGN.md`；页面职责和通用 UI 文档只引用，不得重复维护具体间距表。
29. 状态交付使用 `server/shared/economy-state-version.js` 作为客户端版本唯一来源；README、权威文档、`src/types.ts` 和服务器序列化必须通过 `scripts/verify-client-state-version.mjs` 保持一致。客户端状态版本 25 是拍卖身份字段删除、主状态移除出价数组与收费／保留价／延时摘要的破坏性边界，只接受当前版本。
30. `serverNow` 只属于状态交付 envelope，不进入 `EconomyState`、世界 JSON 或状态分区；倒计时必须读取共享单调服务器时钟。普通权威动作只返回精简确认，动作成功后用动作前全局修订号与分区哈希补拉状态。
31. 六分区协议只在分区之间增量传输；每个返回分区内部都是完整快照，客户端必须整块替换同名缓存分区后再重组 `EconomyState`。服务器省略可选字段即表示删除，空对象也必须清空旧分区内容，不得恢复对旧完整状态的字段级浅合并。
32. 仓库与市场自动交易商品卡结构、网格密度唯一归属 `WAREHOUSE_EXPANSION_DESIGN.md`；默认五列，小于 560px 为四列，760px 起六列、960px 起七列，并通过 `scripts/verify-warehouse-expansion.mjs` 防回退。页面职责与通用 UI 文档只能引用该规则，不得维护另一套断点。
33. 移动操作结果通知归属 `LIQUID_GLASS_CHROME_DESIGN.md` 与 `GameShell` Chrome Overlay；DOM 必须位于 `StatusBar` 后、`MobileBottomNavigation` 前，顶部位置固定为安全区顶部 + `48px` 状态栏 + `8px` 间距。通知采用普通半透明提示样式，不新增毛玻璃宿主、不推动页面内容、不拦截状态栏或底栏交互，并通过 `scripts/verify-game-shell-layout.mjs` 与 `tests/browser/mobile-workspace-overlay.spec.ts` 防回退。
34. 游戏端与管理员端必须共享 `SignedInShell`、唯一页面 `ScrollArea`、悬浮桌面工作栏骨架和贴边滚动条，但桌面几何按用途分流：管理员保留传统下方双列布局；玩家固定使用 `8px` 屏幕边距、`64px` 状态栏和唯一 `workspaceCard`，状态栏与主卡片之间也只能保留一个 `8px` 间距，主卡片纵向铺满剩余区域且不得为低层地图镜头栏预留高度。主卡片共同承载 `78px／224px` 覆盖式指挥栏与当前页面，侧栏以竖线和阴影隔离，展开不得推动页面；概览、市场、建筑、设置共享 `56rem` 内容目标，但包含侧栏的主卡片总宽不得超过 `calc(100vw / 3)`，并与右侧公开事件日志并列；研发、拍卖、合同、银行、排行榜、商店占满主卡片页面区域，排行榜与商店保持相同宽度且隐藏事件栏。正式页面切换使用一次性横向展开动画，不得重新挂载或缩放地图实例；并通过 `scripts/verify-game-shell-layout.mjs`、`tests/browser/game-shell-layout.spec.ts` 与 `tests/browser/all-pages-preview.spec.ts` 防回退。
35. `GET state` 的响应时钟必须使用 envelope 顶层 `serverNow`，即使 `unchanged: true` 也必须返回；`serverNow` 不得进入六分区或世界 JSON。客户端只能用它向前校准共享单调服务器时钟，迟到或较旧响应不得让工作冷却、生产、研发、拍卖、合同或排行榜倒计时回退，也不得把 `lastProcessedAt` 在每次轮询时重新解释为当前服务器时间。工厂即时建设没有施工截止时间，不得重新加入倒计时注册表。
36. 人口数量、工厂承载、迁入迁出、就业收入、三类人口真实钱包、生产复杂度岗位结构、固定建造业岗位结构、即时建造业就业收入、仓储与市场服务就业、人口消费不得发行、工作与商店兑换直接发行、不设置人口回收或通胀控制属于产品、产业、订单簿、仓库、管理员与服务器共同规则；必须同步更新对应文档、测试和人口经济验证。
37. 状态刷新设置继续只保存和显示 `3s`／`5s`／`10s`，前台活跃时使用玩家选择的间隔；连续 30 秒无交互后临时使用 15 秒，页面隐藏时临时使用 60 秒，重新可见、网络恢复或从限速状态恢复交互时立即请求一次权威状态，临时间隔不得覆盖玩家偏好。正式服务每 60 秒输出一次按方法与归一化路由聚合的请求指标，包含平均／p50／p95／p99／最大处理时长、应用层 JSON 响应字节数（优先使用 `responseJsonBytes`，`Content-Length` 仅作回退）、固定阶段耗时（至少包含 `playerSnapshotMs`、`economicInvariantMs`、`worldEqualityMs`、`serializeWorldMs`、`worldUpdateMs`）、事件循环延迟和无身份容量指标；单个窗口最多保留 256 个方法／路由键，超出上限统一聚合为 `OTHER /api/other` 并记录溢出请求数；超过 1 秒、超过 200 KB 或返回 5xx 的请求立即输出异常摘要。`DatabaseSync` 的 5 秒超时是 SQLite 锁等待上限。同一 `GET state` 的合同分区必须复用当前修订缓存，只克隆玩家、合同与人口经济投影，不得再完整克隆世界；普通与合同动作只有世界结构实际变化时才能更新 `economy_world` 与修订号，失败或无变化动作仍保存幂等确认但不得触发全服补拉。以上规则通过 `scripts/verify-runtime-efficiency.mjs` 和服务器测试防回退，不得记录 Cookie、请求体、玩家资产或其他敏感内容。
38. 管理员桌面 `PageLayout` 标题必须隐藏并由 `AdminDesktopBar` 的桌面玻璃工作栏承载标题、说明、身份、世界／API 摘要和刷新操作；管理员移动端不得渲染该顶部工作栏，继续使用页面标题和统一移动底栏。管理员专属 CSS 只能负责业务内容网格、表单、表格和局部 sticky 编排，不得恢复独立根外壳、页面主滚动视口、全局居中限宽框或管理员专属玻璃参数。
39. 商品物资插画主视觉归属 `UI_DESIGN_SYSTEM.md` 的商品图标体系：`src/assets/product-icons/` 只保存 `1024 × 1024` RGBA PNG 正式源图，开发与构建统一由 `scripts/generate-product-artwork-thumbnails.mjs` 生成 `src/assets/product-icons/generated/128/` 下的 `128 × 128` RGBA PNG 运行时缩略图；`product-artwork.css` 只能通过 `ProductArtwork` 的 `data-product-icon` 映射缩略图，禁止直接加载源图。仓库商品卡、市场商品列表与详情、概览商品行情和拍卖商品主视觉使用缩略图，生产公式、订单表格、资产变动和未知商品继续使用 SVG，并通过 `scripts/verify-product-artwork.mjs` 校验正式源图、缩略图、映射、生成入口、降级和使用边界。
40. 人口政策参数、当前参数与持续时间展示、无管理备注、无调控记录、无业务上限及安全整数边界统一归属 `GIFT_CODE_AND_ADMIN_DESIGN.md`；就业来源与复杂度工资中的正数比例条必须保留最小可见填充，真实零值保持空轨道，并通过人口经济服务器测试、管理员浏览器测试和 `scripts/verify-staple-crops-demand.mjs` 防回退。
41. 市场只提供商品目录，并以“市场行情／自动交易”切换承载商品挂单总览和在线自动买卖策略。商品行显示卖单量、买单量、挂单差额、市场价、基准偏离、24h 变化和挂单状态；挂单量只来自公开订单簿，不得用库存或理论产量伪造供需。商品详情增加服务器消费需求基本面和正式配方生产者／消费者关系，并保留五档盘口、24h 行情、当前资产订单与本地成交。工厂资产交易只能从建筑详情打开从属视图并返回原建筑，不得恢复市场工厂目录。实现必须同步 `MarketPage.tsx`、`BuildingsPage.tsx`、`market-page-polish.css`、`scripts/verify-market-page-layout.mjs` 与市场浏览器测试。
42. 长期生产合作合同的页面职责归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`，工厂集群边界和生产先于合同交付归 `INDUSTRY_AND_PRODUCTION_DESIGN.md`，接口、事务、调度、追加式合同审计和 `contract` 分区归 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`。合同只允许商品与普通货币，不允许其他资产类型、工厂转移、工厂出租、自由文本或对方配方控制；每次合同处理、动作和状态序列化只能建立一次事务内合同索引，采购方下一批仓库预占不得在每份合同检查中再次遍历全部合同；必须通过 `server/test/contracts.test.js`、`server/test/contract-runtime-index.test.js`、`server/test/contract-audit.test.js` 和页面／状态容量验证防回退。
43. 所有可见倒计时必须先区分本地资格到期与服务器权威状态转换；统一读取 `serverNow` 校准的共享单调服务器时钟，状态转换到期后由权威刷新继续确认。每个返回分区内部都是完整快照，必须整块替换同名分区。工厂即时建设不属于倒计时系统。该规则由 `AUTHORITATIVE_COUNTDOWN_DESIGN.md` 与 `scripts/verify-authoritative-countdowns.mjs` 防回退。
44. 管理员玩家运营统计、成功经济写操作活跃口径、精确日活动覆盖起点、D1／D7／D30 留存、成长漏斗、经营参与、真实成交估值财富分布、关注群体、独立 SQLite 分析表和聚合隐私边界属于管理员与服务器共同规则；不得把统计结果用于扩张人口需求预算，必须同步更新 `GIFT_CODE_AND_ADMIN_DESIGN.md`、`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`、服务器测试和 `scripts/verify-admin-player-statistics.mjs`。
45. 输入方式、共享交互表面、混合输入运行时切换、React 根入口 bootstrap、触摸无粘滞 hover、程序化焦点与键盘焦点视觉属于 `UI_DESIGN_SYSTEM.md`；必须通过 `scripts/verify-interaction-modality.mjs` 和混合输入浏览器测试防回退，业务 CSS 不得增加未受约束的 hover。
46. 登录态根视口的纵向 overscroll 终止、浏览器下拉刷新阻止与共享移动工厂／研发详情局部触摸保护唯一归属 `LIQUID_GLASS_CHROME_DESIGN.md`；内部滚动区继续按 `UI_DESIGN_SYSTEM.md` 在边界释放滚动链。实现必须同步 `viewport.css`、`interactionBootstrap.ts`、`mobileDetailSheetPullRefresh.ts`、`scripts/verify-mobile-facility-pull-refresh.mjs` 与 `tests/browser/mobile-facility-pull-refresh.spec.ts`，不得改成内部 `contain` 或文档级全局 `touchmove` 拦截。
47. 统一订单簿运行时索引只属于服务器事务内派生状态；`world.orders` 仍是唯一持久化权威来源。每个资产方向必须使用“价格档位 + 同价 FIFO”组织未完成订单，价格档位按买高卖低排序，同价按创建时间再按原数组顺序稳定排队；撮合与盘口报价必须通过 `iterateOrderBookSide` 按需遍历，成交缩量和撤单必须即时更新或摘除节点，不得为一次撮合重新物化、过滤、排序或压缩完整盘口侧数组。撮合、自交叉、系统最优价、商品买单仓库预占、工厂卖单冻结、人口卖盘深度和需求组订单继续复用 `order-book-runtime.js`；必须通过 `server/test/order-book-runtime.test.js`、`server/test/order-book-price-level.test.js`、`server/test/order-matching.test.js` 与 `scripts/verify-order-matching-core.mjs` 防回退。
48. 正式世界调度只能使用 `world-deadline-planner.js` 计算的单一最早到期 `setTimeout`，不得恢复固定一秒 `setInterval` 或在空闲窗口反复克隆、迁移、深比较和写入世界；`world-deadline-runtime.js` 必须按世界对象与修订号缓存同一截止时间计划，`null` 截止时间不得被解释为 0。正式调度唤醒必须从计划中计算实际 `dueDomains` 并按实际到期领域推进，银行、研发、合同等未到期领域不得仅因其他领域到期而被重复处理；管理员或首次建档等显式完整处理路径可以保持完整推进。工厂即时建设不得注册施工完成或施工就业截止时间；正式服务的玩家写入若到达已过期截止时间，必须先等待同一权威写执行器中的调度 barrier，动作主体不得再次执行同一轮全服推进；关闭正式调度的内存测试才允许在请求内按实际到期领域推进。该规则通过 `server/test/world-deadline-planner.test.js`、`server/test/authoritative-hotpaths.test.js`、`server/test/runtime-hotpath-architecture.test.js`、`scripts/verify-runtime-efficiency.mjs` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。
49. 共享仓库统一预占必须同时包含未完成商品买单、当前最高出价拍卖和进行中采购合同的下一批商品；订单、拍卖、合同、生产空间检查和客户端仓库摘要必须调用 `warehouse.js` 的同一口径。合同容量检查必须复用 `contract-runtime-index.js` 并排除当前合同自身旧预占，禁止重新遍历全部合同或遗漏订单／拍卖预占；必须同步 `WAREHOUSE_EXPANSION_DESIGN.md`、`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`、统一仓库预占测试和 `scripts/verify-warehouse-expansion.mjs`。
50. 银行存取款、唯一进行中工厂抵押贷款、透明额度评估、72 小时期限与 12 小时宽限、抵押继续生产但禁止转让、贷款本金与负债同步、净资产口径、已实现贷款利息 70%／20%／10% 分配、北京时间每日最低余额、七日利息池上限、风险准备金、违约处置和世界 16 数据快照属于基础银行规则；活跃周固定收益与周资金结算另以第 62 条为准。两组规则必须同步更新对应权威文档、服务器与浏览器测试、`scripts/verify-banking.mjs`、`scripts/verify-weekly-cash-settlement.mjs`、版本验证和部署工作流，贷款本金不得计入净资产增长。
51. 市场行情图的整数坐标、动态横纵轴刻度、成交量绘图区最低 `48px` 实际高度、最低 `22%` 数据区占比、ECharts SVG 零间距双 Grid、统一 AxisPointer／Tooltip、悬浮折线保护、动态实际高度／纵横比、底部安全区与图例居中唯一归属 `MARKET_CHART_LAYOUT_DESIGN.md`；页面职责和通用 UI 文档只保留模块边界与引用。实现必须同步 `PriceSparkline.tsx`、`marketChartScale.ts`、`scripts/verify-market-chart.mjs` 和真实浏览器几何／交互回归，不得恢复固定刻度、上下图独立悬浮、窄屏压缩成交量区或强制固定 `16:9`。
52. 独立 `assets` 导航、`AssetsPage` 和浏览器本地资产变动已永久删除；资产总览唯一归属银行页，状态栏与概览资产入口统一打开银行。浏览器本地存储 v7 只保留匿名逐笔成交、州级地区和识别新增成交所需的最小自有订单快照，必须同步更新页面、本地日志、概览、银行、浏览器测试及 `scripts/verify-assets-page.mjs`，不得恢复资产事件差异扫描、资产页空壳或兼容路由。
53. 合同历史必须由 `economy_contract_audit_contracts`、`economy_contract_audit_events` 与 `economy_contract_audit_transfers` 组成的 SQLite 追加式审计账本提供；玩家动作、服务器调度、逐批商品／货款／手续费／保证金流转、宽限和违约必须与世界状态在同一事务提交，并以确定性来源键防止幂等重试或重复截止时间写入重复事件。旧世界合同只能导入 `legacy_partial` 当前快照，不得伪造上线前逐批事件。历史和详情通过独立只读 API 按需分页，只允许参与者读取，不进入世界 JSON、六分区、分区哈希或常规轮询；必须同步页面、产业、服务器设计、迁移备份、服务器／浏览器测试和 `scripts/verify-contract-audit.mjs` 防回退。
54. 未登录入口的图片背景、深色氛围背景、标语与认证卡片三层结构唯一归属 `REGISTRATION_INVITE_FLOW_DESIGN.md`；通用表单与颜色令牌继续归 `UI_DESIGN_SYSTEM.md`，认证行为继续归页面与服务器文档。实现必须同步 `LoginPage.tsx`、`auth.css`、`card-system.css`、`scripts/verify-auth-three-layer.mjs` 与 `tests/browser/auth-three-layer.spec.ts`，不得恢复移动端整页外层面板、共享卡片层登录几何映射、第四个全局背景层或改变登录／注册业务流程。

55. 认证卡片必须使用 `AuthCardSurface` 与唯一 `FrostedGlassSurface` 的 `authCard` 变体，任一时刻只允许一个自然内容高度的毛玻璃宿主；卡片几何归 `REGISTRATION_INVITE_FLOW_DESIGN.md`，材质归 `LIQUID_GLASS_CHROME_DESIGN.md`。不得恢复 `liquid-glass-react`、位移滤镜、测高观察器、`.panel`、固定高度或内部滚动区；必须同步两份权威文档、`scripts/verify-auth-three-layer.mjs`、`scripts/verify-liquid-glass-chrome.mjs` 与认证浏览器回归。
56. 排行榜按财富／增长／生产／交易排序：内容宽度不小于 `72rem` 时隐藏切换按钮并四列同时展示，宽度不足时才显示单行四按钮并只展示当前榜单；生产数量的显示规则唯一归属 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`：前十名和“我的成绩”必须共用 `scoreValue`，只显示经过 `formatNumber` 千分位格式化的纯数字，不附加“个”“件”“单位”或恢复“分”；显示调整不得改变服务器数量、排序、同分规则、奖励、迁移或历史结算，并通过 `scripts/verify-leaderboards.mjs` 防回退。
57. 状态版本 22 固定稳定分区时间字段：`economicCalendar` 不再返回按请求毫秒变化的 `visibleUntil`，未来七天展示使用 envelope `serverNow` 校准的共享时钟；排行榜不得返回请求生成 `generatedAt` 或逐行 `updatedAt`，四榜必须位于顶层 `leaderboards` 并归入 `leaderboard` 分区，不得嵌入玩家 `stats`。同一事件窗口连续请求必须保持相同的 `market` revision，其他玩家不改变市场的操作不得让无关用户收到完整 `market`，并通过状态轮询服务器测试、`scripts/verify-contract-renewal-economic-events.mjs`、`scripts/verify-leaderboards.mjs` 与权威倒计时验证防回退。
58. 生产数据库只读诊断工作流固定为 `.github/workflows/diagnose-production-database.yml`，只能手动触发并使用现有 `SERVER_HOST`、`SERVER_PORT`、`SERVER_USER` 与 `SERVER_SSH_KEY` 以服务用户连接；不得使用 `sudo`、停止或重启服务。诊断脚本必须以 SQLite URI `mode=ro`、`PRAGMA query_only = ON` 和 authorizer 三重只读约束打开 `/var/lib/riversoft-economy/economy.sqlite`，不得执行 `VACUUM`、`wal_checkpoint`、`PRAGMA optimize`、备份、附加数据库、DDL 或 DML。输出只允许包含数据库／WAL／SHM 字节数、页数、空闲页、预计有效页、世界修订号与 `state_json` 长度、`PRAGMA quick_check(1)`、Schema 数量和 `dbstat` 对象占用，不得输出玩家、邮箱、IP、邀请、Cookie、密钥或业务行内容；诊断不得上传数据库、WAL、SHM、备份或包含玩家明细的 Artifact。上述规则必须通过 `scripts/verify-readonly-database-diagnostics.mjs` 对临时数据库执行前后文件哈希、大小和修改时间完全一致的行为验证。
59. 生产 SQLite `INCREMENTAL` 自动压缩属于服务器存储维护规则：现有 `auto_vacuum=NONE` 正式库只能通过停服、WAL `TRUNCATE` checkpoint、`VACUUM INTO` 紧凑副本、在副本执行 `PRAGMA auto_vacuum=INCREMENTAL; VACUUM;`、Schema／逐表内容／世界 JSON 哈希校验、同文件系统原子替换、健康检查和失败自动回滚迁移；迁移脚本固定为 `scripts/manage-production-database.py`，人工工作流固定为 `.github/workflows/migrate-production-database-incremental.yml` 并要求确认词。空间维护固定由 `.github/workflows/maintain-production-database-space.yml` 在每周一北京时间 02:30 和人工触发时检查，只有可回收空间不少于 64 MiB 且 freelist 比例不少于 25% 才停服执行，每批 `PRAGMA incremental_vacuum(1024)`、单次最多四批，前后都执行 WAL checkpoint、`quick_check` 和健康检查；不得省略正数页数清空整个 freelist，不得把 `incremental_vacuum` 放入玩家请求事务，也不得使用 `auto_vacuum=FULL`。上述迁移、批量上限、逻辑不变和回滚行为必须由 `scripts/verify-production-database-maintenance.mjs` 防回退。
60. 普通货币精度与玩家结算属于跨模块强制规则：普通货币只有一种六位微单位运算精度，`1 货币 = 1,000,000` 微单位；账户余额、冻结资金、预算、总额、手续费、利息、退款和流水统一按微单位结算。玩家可编辑金额与单价最多两位并以 `0.01` 为步长，超过两位直接拒绝；两位限制不得形成第二套账户精度。普通界面显示两位，审计详情可显示六位，显示值不得参与运算；宝石、商品和工厂数量保持整数，比例使用整数 BPS／PPM。合同审计金额以 SQLite 整数微单位保存，世界与客户端十进制字段仅作为状态版本 22 的兼容边界。必须同步更新产品、订单簿、产业、服务器、页面、UI、商店、管理员、本地活动、根 README、测试和 `scripts/verify-money-precision.mjs`。

61. 统一订单簿运行时性能属于订单簿与服务器共同规则：`world.orders` 保持唯一持久化权威集合和单一混合盘口，不得按玩家／系统拆分盘口；活跃盘口使用“价格档位 + 同价 FIFO”派生索引，全量构建按价格分组后排序，尾部追加只更新对应价格档位，同价常规追加为 O(1)，成交缩量与撤单同步维护开放订单、价格档位数量、商品买单预占和工厂卖单冻结聚合。撮合、盘口深度和市场报价必须按需遍历价格档位，不得恢复完整盘口侧反复 `filter`／`sort`／关闭订单压缩扫描。当前版本迁移、无变化剪枝和无旧系统工厂订单清理必须保持订单数组引用；历史剪枝只限制已关闭订单为最近 800 笔，绝不得删除未完成订单。至少使用 50,000 未完成订单回归价格时间优先、档位聚合、撤单摘除和撮合访问量。必须同步更新 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md`、`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`、服务器测试、`scripts/verify-order-matching-core.mjs`、`scripts/verify-authoritative-hotpaths.mjs` 与 `scripts/verify-runtime-efficiency.mjs`。

62. 银行固定收益与周资金结算属于跨模块强制规则：银行存款仅在成功经济写操作激活的北京时间自然周内从次日开始按每日固定 1% 结息；贷款利息池优先支付，缺口记录为补贴发行。完整活跃周结束生成净货币资金 10% 账单，冻结资金计入但不直接扣除，登录时先扣存款再扣可用资金，欠缴保留为负债；离线周不累计，无旧账单时回归只结算一次。同一自然周普通读取不得刷新登录标记或推进世界修订号，固定利息与周资金销毁不得计入增长榜经营成绩。规则唯一归属产品、服务器和页面三份权威文档，并由银行、周结算、状态轮询与资金精度验证共同防回退。

63. 项目业务数据图表只允许通过共享 `EconomyChart` 使用 Apache ECharts SVG；只安装 `echarts`，不得引入 `echarts-for-react`、第二套图表库或业务页面直接 `echarts.init`。初始化、按需模块、`ResizeObserver`、逐帧 resize、`dispose()`、设计令牌、中文无障碍摘要和稳定测试接口归 `UI_DESIGN_SYSTEM.md`；市场专项几何继续归 `MARKET_CHART_LAYOUT_DESIGN.md`。

64. 压力测试执行器、环境隔离、安全门禁、24 个固定普通玩家槽位、秘密边界、状态协议断言、幂等重放、场景、性能预算、脱敏报告与 GitHub Actions 属于服务器架构规则。完整写压测只能使用模拟账号服务与临时 SQLite 或受保护的 staging；生产只允许已建档固定账号执行显式确认、至少 3 秒轮询且不超过 5 分钟的 `smoke`／`poll`，不得调用任何游戏写操作。必须通过 `scripts/verify-stress-test-accounts.mjs`、`scripts/verify-stress-test-flow.mjs` 和隔离行为测试防回退。

65. 工厂场景插画主视觉归属 `UI_DESIGN_SYSTEM.md`：`src/assets/facility-icons/` 必须与服务器 26 种正式工厂 ID 一一对应，只保存同名 `1024 × 1024` 8-bit RGBA PNG 源图；开发与构建通过共享缩略图管线生成 `src/assets/facility-icons/generated/256/`。建筑选择卡、建筑从属资产详情和拍卖工厂主视觉统一使用 `FacilityIcon`，紧凑订单／成交／银行／概览及未知 ID 继续使用 `FactoryIcon`，低流量模式回退厂房 SVG。任何目录增删、图片替换或使用边界变化必须同步更新 `FacilityIcons.tsx`、`facility-artwork.css`、本设计和 `scripts/verify-facility-artwork.mjs`。
66. 研发页是生产右侧、拍卖左侧的正式一级页面；C1-C7 产业阶段由按产业链拆分的科技节点组成，2 个 C1 科技初始掌握，其余节点按前置关系逐项研发；研发使用普通货币一次性扣款、进度式人口就业释放、单项目不可取消和服务器权威完成。具体科技准入必须覆盖建设、工厂买单、竞拍、启动、配置和租赁运营，旧等级、既有资产及承诺迁移必须授予对应科技及前置闭包；当前唯一研发任务允许 1 宝石减少 30 分钟。必须同步产品、产业、页面、服务器、倒计时、状态版本、测试与 `scripts/verify-research-progression.mjs`，不得恢复只读占位、研发点、并行队列或直接生产数值加成。
67. 世界冷加载迁移与热保存必须分离：完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载、旧单行世界迁移或版本升级时执行。正式持久化使用 `economy_world_meta + economy_world_players + economy_world_segments` 分段存储 V2，所有行仍共享一个世界修订号和一个 SQLite 事务；当前 V2 世界重复冷启动不得迁移、重写或推进修订号，旧 `economy_world.state_json` 只允许迁移一次并转为 manifest。正式运行时必须区分 committed world 与请求草稿；普通玩家权威写通过 Mutation Scope 创建 Copy-on-Write 草稿，只隔离本动作可能修改的玩家和世界 segment，未声明共享对象必须保持只读，未知动作才允许回退完整草稿。普通商品下单复制操作者、当前可交叉的玩家对手方、订单／市场与必要核心资金域；商品撤单和拍卖动作使用对应局部 Scope。热保存只允许 scoped money normalization、Dirty Row 比较与脏玩家／segment 写入，不得恢复完整世界 `isDeepStrictEqual`、完整 `JSON.stringify` 或全世界资金扫描。正式 `GET state` 对已有玩家的缓存未命中路径必须直接从 committed world 执行纯只读投影，不得创建请求草稿、执行迁移／领域结算／全玩家初始化、写库或通过额外完整世界克隆容忍投影副作用；公开订单等投影规范化必须先复制再修改。管理员 `GET /api/game/admin/summary` 与 `GET /api/game/admin/population-economy` 同样直接读取 committed world 并保持权威写队列外。幂等记录过期清理最多每 5 分钟执行一次。正式调度继续只按实际到期领域推进并对当前世界使用 `migrate: false`；玩家写入遇到已到期截止时间时先复用调度 barrier。以上规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `server/test/world-storage-v2.test.js`、`server/test/runtime-hot-path.test.js`、`server/test/authoritative-hotpaths.test.js`、`server/test/runtime-hotpath-architecture.test.js`、`scripts/verify-runtime-efficiency.mjs` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。
68. 最终客户端状态必须在运行时存储层直接形成六分区快照，并按世界修订号与玩家 ID 缓存；同修订重复请求不得重新进入事务、重建合同投影或重复分区哈希。目录分区固定为进程内共享静态快照，投影缓存上限为 256 个玩家并在世界修订变化时清空；HTTP 层只比较已生成的分区修订和选择补丁。浏览器接收分区后必须保留未变化分区的对象引用，允许页面或共享组件按分区订阅而不是依赖一份额外 React `EconomyState` 副本。必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`、`state-partitions.js`、`stateDelivery.js`、运行时存储、状态轮询测试和 `scripts/verify-authoritative-hotpaths.mjs`／`scripts/verify-runtime-efficiency.mjs`。
69. 六分区 `orders` 只允许全部未完成订单与当前玩家最近 `maxOpenOrders` 笔已关闭订单；更早的本人关闭订单必须通过只读不透明游标接口 `GET /api/game/orders/history` 分页读取，默认 50、最多 100 条。主状态瘦身和历史接口必须复用普通玩家匿名订单序列化，不得恢复其他玩家关闭订单、对手信息、需求来源或内部资金字段，并同步 `LOCAL_ACTIVITY_LOG_DESIGN.md`、服务器设计、测试及 `scripts/verify-local-trade-privacy.mjs`。
70. 所有可能修改 SQLite、世界状态、审计、注册、封禁、礼品、教程或运行时调度状态的操作必须进入同一进程内有界权威写执行器：严格 FIFO、同时最多执行一个回调，全局总深度最多 128、同一主体最多 4 个待处理操作、普通请求最多等待 10 秒。过载或超时返回 `503`、稳定 `WRITE_QUEUE_*` 代码和 `Retry-After`；世界调度使用同一执行器但不得因普通请求队列满而被丢弃。状态只读快路径、订单历史和纯查询保持队列外；注册邮件与统一账号网络调用必须位于写队列外，仅把前后 SQLite 阶段分别入队。关闭服务时先停止接收和调度，再排空已接受写入后关闭数据库。该规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由权威写执行器、注册、调度与 `scripts/verify-runtime-efficiency.mjs` 防回退。
71. 所有正式玩家经济动作（包括合同动作）必须在外层 `BEGIN IMMEDIATE` 权威事务内部再建立 SQLite `SAVEPOINT`，并统一在请求的 Copy-on-Write world draft 上执行：本动作声明为可写的对象必须独占，未声明对象可以与 committed world 共享但必须保持只读；动作业务返回失败或抛异常时回滚保存点并直接丢弃未提交草稿，不得再复制整个世界作为第二份回滚快照。经济活动判定只允许保存当前玩家的动作前快照；合同动作可额外保存合同集合快照用于变更判定与审计，但不得保存第二份完整世界。动作成功必须在释放保存点前执行资金、库存、工厂数量和银行负债等非负／安全整数不变量检查；合同动作允许在成功后执行合同领域专项后处理并在同一事务完成审计。失败动作仍可保存精简幂等确认，但不得写回世界或推进世界修订号。该规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `economic-mutation.js`、`runtime-action-executor.js`、`server/test/state-polling.test.js`、`server/test/authoritative-hotpaths.test.js`、`server/test/runtime-hotpath-architecture.test.js` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。
72. 浏览器服务器权威状态必须由 `stateDelivery.js` 的六分区缓存统一发布，`gameAuthorityStore.ts` 通过 React `useSyncExternalStore` 提供完整状态、修订号和单分区订阅；`gameViewModel.ts` 不得重新维护第二份 `useState<EconomyState>`，只保留动作编排、通知、导航、表单草稿和其他交互状态。分区 patch 只替换发生变化的分区，未变化分区必须保持引用稳定；服务器刷新不得通过权威状态发布隐式重置价格／数量草稿、选中项、弹层或滚动位置。该规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` 的状态交付边界，并由 `server/test/authoritative-hotpaths.test.js`、TypeScript 构建和 `scripts/verify-authoritative-hotpaths.mjs` 防回退。

73. 世界 32 的美国本土连续 48 个州级地区、本地无限仓库、本地商品／工厂行情、州级工厂集群与订单隔离属于产品、产业、仓库、订单簿、页面、UI、拍卖和服务器共同规则。世界 30 已使用的 34 个地区 ID 原位对应 34 个州，新增 14 个州 ID，不移动或合并既有资产；现金、宝石、研发、银行、排行榜与世界人口不按地区复制；跨州商品只能通过付费运输流动，客户端切换地图不得移动任何资产。内部 API 和复合键继续使用兼容名称 `provinceId`。地图使用共享 `EconomyChart` 的 ECharts Geo/Map 并位于铺满视口的根级地图层，州面点击直接切换地区；地图页不得恢复命令、经营详情、“当前经营地区”或图例卡片。开源底图精确锁定 ISC `us-atlas@3.0.1` 与 `topojson-client@3.1.0`，只注册连续 48 州，排除阿拉斯加、夏威夷、华盛顿特区和海外领地；来源、许可与非测绘说明由权威文档和依赖清单保留。实现必须同步共享目录、客户端状态版本 36、地图页、写动作 `provinceId`、专项服务器／浏览器测试与 `scripts/verify-provincial-economy.mjs`。
74. 每个州×商品的官方系统价、恰好等于系统价的玩家买卖单实时全量清算、按周期系统买卖量调价、调价瞬间的精确价格订单簿扫描、系统成交审计与商品／货币生成销毁边界属于产品、订单簿、页面和服务器共同规则；必须同步更新 `PRODUCT_AND_GAMEPLAY_DESIGN.md`、`UNIFIED_ASSET_ORDER_BOOK_DESIGN.md`、`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`、测试和 `scripts/verify-system-market.mjs`，不得恢复仅按订单簿成交生成市场价的旧口径，也不得把玩家间成交计入系统买卖比。
75. 新玩家起始州永久绑定、其他州按货币费用解锁、锁定州禁用市场／工厂／仓库、公路／铁路／航空三种跨州运输（成本、单次运量、时间、运费计入运输就业、在途商品按起始州官方价估值）属于产品、仓库、页面和服务器共同规则；必须同步更新 `PRODUCT_AND_GAMEPLAY_DESIGN.md`、`WAREHOUSE_EXPANSION_DESIGN.md`、`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`、`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`、测试和 `scripts/verify-provincial-unlock-transport.mjs`，不得恢复任意州自由经营、免费跨州物流或取消起始州绑定。
76. Economy API 的部署就绪与共享运行时目录细则归 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`：服务安装完成条件必须包含真实 `/health` 就绪，不能只以 `systemctl is-active` 作为完成信号。`server/src/provinces.js` 固定通过 `../../shared/provinces.json` 读取仓库根 `shared/provinces.json`，不得复制第二份州级目录到 `server/`；生产部署必须把仓库根 `shared/` 同步到 `/var/www/game/shared/`，确保运行时文件 `/var/www/game/shared/provinces.json` 与源码相对导入一致，并由 `scripts/install-economy-api.py` 在重启 systemd 前作为必需文件验证。安装器重启服务后必须在最长 45 秒内轮询 `127.0.0.1:3002/health`，同时要求 systemd 处于 active 且健康检查返回 2xx；发布前远端验收再独立执行有限重试，冷启动期间短暂的 `connection refused` 不得直接判定为发布失败。共享运行时文件缺失、就绪超时或重试耗尽都必须在原子发布 `index.html` 之前终止；失败日志必须包含 `systemctl status` 与最近 `journalctl`，从而区分发布包缺失、慢启动与真实服务崩溃并保持旧入口可用。该规则由 `scripts/verify-runtime-reliability.mjs` 防回退。

77. 工厂持续生产采用按玩家懒结算：客户端从正常权威状态与 `serverNow` 计算最大合法周期提案，只提交每个工厂组完成周期数；服务器必须重新读取当前玩家基线并用共享闭式公式验证 `n` 合法且 `n+1` 不合法后原子记账。全局截止时间固定不调度 facility，排行榜、市场、服务启动和常规调度不得扫描全服工厂或逐周期重放离线生产；旧客户端／过期提案兜底只能结算当前玩家，到期供货／租赁合同兜底只能结算明确参与者。staffing 固定点余数、生产工资微单位余数和人口就业累计最大余数分配必须保证生产结果不受结算批次大小影响。该规则唯一归属 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 与 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `scripts/verify-production-lazy-settlement.mjs` 和服务器测试防回退。

78. CI 与主部署的浏览器回归不得把 Playwright 浏览器 CDN 作为必需单点依赖：必须优先复用 GitHub runner 已安装的 Chrome／Chromium，并通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 交给 Playwright；只有 runner 没有可用浏览器时才执行固定 Chromium 下载兜底。浏览器测试仍是硬门禁，浏览器 CDN 地域不可达、403 或临时故障不得成为跳过 `npm run test:browser` 的理由。该规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，由 `scripts/prepare-playwright-chromium.sh` 与 `scripts/verify-runtime-reliability.mjs` 防回退。

- 游戏端与管理员端桌面顶部工作栏必须横跨侧栏列与内容列；侧栏和工作区从其下方开始。所有登录后业务浮层必须限制在工作区安全根内，并由 `scripts/verify-game-shell-layout.mjs` 与 `tests/browser/shell-floating-safe-zone.spec.ts` 防回退。

23. 商品供货、玩家抵押借贷和工厂使用权租赁采用三类合同领域与六类发布方向；供应／采购、放贷／贷款、出租／租赁只表示发布方角色。规则必须同步更新产业、订单簿、页面、服务器、状态版本、测试与 `scripts/verify-contract-types.mjs`，不得恢复六套重复状态机、工厂实例化或客户端到期结算。


## 即时建设不可回退规则

工厂建设以服务器正式目录的 `buildCost + buildInputs` 为唯一成本；在一个幂等事务中原子扣除资金和材料、一次性记入建造业就业收入并立即增加同类集群数量。农场和果园当前按正式目录不消耗建造材料，其他工厂使用各自正式 `buildInputs`。缺料且当前卖盘足够时允许在同一建造事务内执行真实统一订单簿 FOK 采购，保留逐材料价格保护、采购总额保护、自成交阻断、卖方手续费、无限共享仓库入库与全事务回滚。卖盘不足时允许通过统一 `/orders` 提交按单次建造聚类的缺料买单：服务器重新计算缺口，每种缺料创建普通玩家商品买单，可成交部分立即成交、剩余正常挂盘并冻结资金；整组取消只撤销该次提交剩余订单，已成交材料保留，建造现金不冻结且不得自动建厂。两条路径都不得创建系统材料商店、第二套订单类型、施工任务或绕过市场资产守恒。不得恢复施工时间、施工任务、施工队列、施工倒计时或工厂宝石加速。历史 `economy_facility_gem_actions` 仅保留只读审计，不得恢复 INSERT 写路径；旧 `POST /api/game/facilities/construction/accelerate` 必须继续在进入经济事务前返回 `410 Gone`。规则变更必须同步更新产业、产品、订单簿、仓库、页面、服务器、宝石与权威倒计时文档，以及一键采购、目录、宝石、倒计时和服务器测试。

### 客户端子修订与叶子时钟索引

客户端仍以六个外层完整状态分区为传输边界；`player / market` 的 `sliceRevisions`、结构共享、`useSyncExternalStore` 子切片 React 消费和共享秒级叶子 ticker 以 `AUTHORITATIVE_COUNTDOWN_DESIGN.md` 为准，服务器 envelope 元数据边界以 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` 为准。客户端订单索引分别受 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` 与 `WAREHOUSE_EXPANSION_DESIGN.md` 约束，只允许作为只读派生加速器。
