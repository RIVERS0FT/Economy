# Economy 设计文档索引

> 状态：当前文档入口
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-07-24
> 客户端状态版本：16
> 世界状态版本：14

本目录只保留当前设计。旧规则不归档在 `docs/`，也不得以“补充说明”“V2/V3”或未登记专题文档的形式继续并行存在。未列入下方权威文档表的 Markdown 文件不得存在。

> 人口政策权威规则已纳入 `GIFT_CODE_AND_ADMIN_DESIGN.md`：仅允许受控稳定需求参数、缺口式立即补充、同周期约束、到期恢复和幂等，不要求管理备注、不生成调控记录；参数不设业务上限，但必须通过下限、安全整数和计算结果范围校验，且不允许任意余额编辑。

## 权威文档

| 文档 | 唯一职责 |
|---|---|
| `PRODUCT_AND_GAMEPLAY_DESIGN.md` | 产品定位、核心循环、工作冷却、普通货币与宝石、直接货币发行、人口就业收入、三类人口真实钱包、消费需求与排行榜目标 |
| `INDUSTRY_AND_PRODUCTION_DESIGN.md` | 31 种商品、21 种工厂、整数经济数值、参考利润、周期成本工资、生产复杂度岗位结构、固定建造业岗位结构、持续生产、三态、自动恢复，以及长期供货合同与工厂集群的边界 |
| `FACILITY_CATALOG_PRESENTATION_DESIGN.md` | 客户端工厂目录展示顺序、已拥有工厂卡片排序和目录顺序防回退 |
| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 商品和工厂统一限价订单、冻结、撮合、成交价、估值、资产统计和普通玩家成交匿名化 |
| `WAREHOUSE_EXPANSION_DESIGN.md` | 共享仓库占用、买单与合同采购预占、无限扩容、商品卡、商品网格密度和生产空间约束 |
| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 十个正式页面、进行中的合同默认视图、登录注册入口、独立商店、分享链接、邀请码、封禁提示、藏品与拍卖、资产导航、模块唯一归属和页面防回退规则 |
| `REGISTRATION_INVITE_FLOW_DESIGN.md` | 注册邀请码输入、分享链接预填、来源归因、首次绑定、24 小时补填和锁定展示交互 |
| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、统一表单控件、统一 SVG 图标、商品插画主视觉、覆盖式滚动条、订单成交表、桌面导航行高、中文界面、响应式、移动触摸反馈与可访问性 |
| `AUTHORITATIVE_COUNTDOWN_DESIGN.md` | 服务器绝对截止时间、状态响应 `serverNow`、共享单调服务器时钟、本地资格倒计时、权威状态转换倒计时、到期立即刷新、每秒确认与统一注册表 |
| `PRIMARY_SURFACE_INSET_DESIGN.md` | 玩家端一级卡片外层内边距令牌、共享组件语义、加载顺序、页面 CSS 边界和贴边内容例外 |
| `OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md` | 概览真实内容宽度断点、外层轨道、紧凑图表、短列表滚动、市场空值和浏览器几何回归 |
| `PRODUCTION_PILL_ALIGNMENT_DESIGN.md` | 生产页状态／等级胶囊与工厂开关的统一可见几何和紧凑点击区域例外 |
| `LIQUID_GLASS_CHROME_DESIGN.md` | 游戏与管理员共享桌面外壳、统一布局沟槽、侧栏与悬浮工作栏几何、桌面贴边页面滚动条、移动工作区与 Overlay、移动操作结果通知、移动底栏和液态玻璃材质 |
| `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` | 服务器权威边界、长期合同事务与 `contract` 分区、普通玩家订单公开序列化、邮箱验证码注册、统一账号首次建档、邀请归因、注册 IP 封禁、API、SQLite、容量限制、Nginx、systemd 和部署 |
| `LOCAL_ACTIVITY_LOG_DESIGN.md` | 浏览器本地快照、资产事件和匿名逐笔成交记录 |
| `GIFT_CODE_AND_ADMIN_DESIGN.md` | 单个与最多 50,000 个批量礼品码、TXT 明文导出、礼品兑换、芝加哥艺术博物馆藏品导入、唯一归属、竞价拍卖（单项与捆绑资产包）、封禁复核、管理员权限、后台范围与运营控制台编排 |

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
10. 商品初始参考价、生产数量、周期秒数和周期成本必须保持整数；参考分钟利润必须由正式目录自动校验，不得只在文档中手算。
11. 移动端触控元素必须关闭浏览器原生蓝色 tap highlight，同时保留 `:focus-visible` 键盘焦点；实现统一放在 `src/styles/mobile-interaction.css`，并由 `scripts/verify-mobile-touch-feedback.mjs` 防回退。
12. 状态轮询修订号、响应防倒退、动作／轮询互斥、空闲读取不写库、默认刷新间隔、六分区完整快照替换、游戏 JSON 压缩和客户端状态版本兼容窗口属于服务器容量规则；当前版本与兼容下限统一定义在 `server/shared/economy-state-version.js`，必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并通过 `scripts/verify-state-delivery-capacity.mjs` 与 `scripts/verify-client-state-version.mjs` 防回退。
13. 主页账号认证缓存的分级 TTL、Cookie 摘要、并发合并、错误策略和 LRU 上限属于安全与容量规则；必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并通过 `scripts/verify-authentication-cache.mjs` 防回退。
14. 小麦／水稻目录、农场改种、持续生产和主食替代预算属于产业与需求权威规则；必须同步更新产业、产品、服务器文档，并通过产业、工厂与主食需求验证脚本防回退。
15. Economy 注册完成时点、主页账号自动建档、邮箱验证码、IP 指纹、多账号封禁、Resend、注册路由和登录注册双模式属于服务器与页面权威规则；必须同步更新服务器、页面、根 README、`scripts/verify-email-registration.mjs` 与服务器测试。
16. 消费需求订单、三类人口真实钱包、五档消费状态与预算份额、就业收入、受控稳定需求补充、真实冻结资金、周期末成交结算、三档需求曲线、证据置信度供需压力、最低储备买盘、库存与资金守恒的双边市场储备、生产链双向滞后价格传导和迁移清理属于产品、产业、订单簿与服务器权威规则；必须同步更新对应文档、测试和 `scripts/verify-staple-crops-demand.mjs`。
17. 宝石、永久邀请码、分享链接即时奖励、注册后 24 小时手动填写、同 IP 全组封禁、423 响应、管理员解禁与审计属于产品、页面、服务器和管理员权威规则；必须同步更新对应文档、测试和 `scripts/verify-gems-invitations-and-bans.mjs`。
18. 商店固定汇率、单向兑换、直接货币发行、兑换幂等与独立页面属于产品、页面和服务器权威规则；必须同步更新对应文档、测试和 `scripts/verify-gem-shop.mjs`。
19. 普通玩家成交记录不得暴露来源、去向或对手订单；API、本地存储和市场页面必须同时匿名化，并通过 `scripts/verify-local-trade-privacy.mjs` 防回退。
20. 运行时可靠性、依赖锁、浏览器测试、localStorage 容错、管理员记录分页、验证码保留和限流缓存上限属于服务器、页面与管理员共同规则；必须同步更新对应权威文档并通过 `scripts/verify-runtime-reliability.mjs` 防回退。
21. 藏品、商品与工厂单项或捆绑资产包竞价、卖方资产冻结、最高出价资金、冻结资产总资产计价、商品仓库预占、工厂生产冻结和订单簿行情隔离属于拍卖、订单簿、仓库、生产、页面与服务器共同规则；必须同步更新对应权威文档、测试和 `scripts/verify-collectibles-auctions.mjs`。
22. 统一订单簿玩家卖出手续费、按卖单累计精确 1%、人口真实冻结资金、匿名 `fee/netTotal`、市场服务就业和拍卖豁免属于产品、订单簿、本地日志、页面、服务器与拍卖共同规则；必须同步更新对应文档、测试和 `scripts/verify-market-sell-fee.mjs`。
23. 拍卖资产包数量输入的字符串草稿、空白编辑、合法性门控、失焦归一化和草稿清理属于页面权威规则；必须同步更新 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`、`AuctionPage.tsx` 与 `scripts/verify-collectibles-auctions.mjs`，不得恢复空值立即回填为 `1` 的实现。
24. 统一表单组件、正整数字符串草稿、错误／只读／禁用状态、移动端 `48px`／`16px`、登录未受控自动填充和最终样式加载顺序属于 UI 权威规则；必须同步更新 `UI_DESIGN_SYSTEM.md`、`FormControls.tsx`、`form-controls.css`、`integerDraft.ts` 与 `scripts/verify-form-controls.mjs`，不得在业务页面恢复平行基础输入视觉。
25. 登录后游戏与管理员桌面外壳几何、侧栏导航固有行高、覆盖式滚动条、移动贴边轨道和纵向滚动链分别归属 `LIQUID_GLASS_CHROME_DESIGN.md` 与 `UI_DESIGN_SYSTEM.md`；不得重新创建 `GAME_SHELL_LAYOUT_DESIGN.md`、`OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md` 或其他职责重叠的平行专题文档。
26. 工厂目录展示顺序、概览布局完整性、生产页胶囊例外、注册邀请码交互和一级卡片外层内边距虽使用独立文档，但职责必须保持在本索引限定范围内；不得把产品经济、页面模块归属、通用 UI、服务器事务或部署规则复制进这些专题文档。
27. 玩家端一级卡片的外层内边距、组件语义、业务 CSS 责任和贴边内容例外唯一归属 `PRIMARY_SURFACE_INSET_DESIGN.md`；页面职责和通用 UI 文档只引用，不得重复维护具体间距表。
28. 状态交付使用 `server/shared/economy-state-version.js` 作为客户端版本唯一来源；README、权威文档、`src/types.ts` 和服务器序列化必须通过 `scripts/verify-client-state-version.mjs` 保持一致，当前客户端只接受当前版本与上一客户端状态版本。
29. `serverNow` 只属于状态交付 envelope，不进入 `EconomyState`、世界 JSON 或状态分区；倒计时必须读取共享单调服务器时钟。普通权威动作只返回精简确认，动作成功后用动作前全局修订号与分区哈希补拉状态。
30. 六分区协议只在分区之间增量传输；每个返回分区内部都是完整快照，客户端必须整块替换同名缓存分区后再重组 `EconomyState`。服务器省略可选字段即表示删除，空对象也必须清空旧分区内容，不得恢复对旧完整状态的字段级浅合并。
31. 仓库商品卡结构与网格密度唯一归属 `WAREHOUSE_EXPANSION_DESIGN.md`；移动和窄容器固定每行四张卡，760px 起五列、960px 起六列，并通过 `scripts/verify-warehouse-expansion.mjs` 防回退。页面职责与通用 UI 文档只能引用该规则，不得维护另一套断点。
32. 移动操作结果通知归属 `LIQUID_GLASS_CHROME_DESIGN.md` 与 `GameShell` Chrome Overlay；DOM 必须位于 `StatusBar` 后、`MobileBottomNavigation` 前，顶部位置固定为安全区顶部 + `48px` 状态栏 + `8px` 间距。通知采用普通半透明提示样式，不新增液态玻璃实例、不推动页面内容、不拦截状态栏或底栏交互，并通过 `scripts/verify-game-shell-layout.mjs` 与 `tests/browser/mobile-workspace-overlay.spec.ts` 防回退。
33. 游戏端与管理员端桌面外壳必须共享 `SignedInShell`、`--desktop-layout-gutter`、唯一页面 `ScrollArea`、悬浮桌面工作栏几何和贴边滚动条；普通桌面为 `12px`，宽度不大于 `960px` 或高度不大于 `760px` 的桌面为 `8px`。工作区与页面滚动视口继续铺满视口，桌面页面主滚动条固定贴合视口右边缘，并通过 `scripts/verify-game-shell-layout.mjs`、`scripts/verify-admin-navigation.mjs`、`tests/browser/game-shell-layout.spec.ts` 与 `tests/browser/admin-runtime.spec.ts` 防回退。
34. `GET state` 的响应时钟必须使用 envelope 顶层 `serverNow`，即使 `unchanged: true` 也必须返回；`serverNow` 不得进入六分区或世界 JSON。客户端只能用它向前校准共享单调服务器时钟，迟到或较旧响应不得让工作冷却、施工、生产、拍卖、合同或排行榜倒计时回退，也不得把 `lastProcessedAt` 在每次轮询时重新解释为当前服务器时间。
35. 人口就业收入、三类人口真实钱包、生产复杂度岗位结构、固定建造业岗位结构、施工托管、仓储与市场服务就业、人口消费不得发行、工作与商店兑换直接发行、不设置人口回收或通胀控制属于产品、产业、订单簿、仓库、管理员与服务器共同规则；必须同步更新对应文档、测试和人口经济验证。
36. 状态刷新设置继续只保存和显示 `3s`／`5s`／`10s`，前台活跃时使用玩家选择的间隔；连续 30 秒无交互后临时使用 15 秒，页面隐藏时临时使用 60 秒，重新可见、网络恢复或从限速状态恢复交互时立即请求一次权威状态，临时间隔不得覆盖玩家偏好。正式服务每 60 秒输出一次按方法与归一化路由聚合的请求指标，包含平均／最大处理时长和应用层 JSON 响应字节数；超过 1 秒、超过 200 KB 或返回 5xx 的请求立即输出异常摘要。`DatabaseSync` 的 5 秒超时是 SQLite 锁等待上限。以上规则通过 `scripts/verify-runtime-efficiency.mjs` 和服务器测试防回退，不得记录 Cookie、请求体、玩家资产或其他敏感内容。
37. 管理员桌面 `PageLayout` 标题必须隐藏并由 `AdminDesktopBar` 的桌面玻璃工作栏承载标题、说明、身份、世界／API 摘要和刷新操作；管理员移动端不得渲染该顶部工作栏，继续使用页面标题和统一移动底栏。管理员专属 CSS 只能负责业务内容网格、表单、表格和局部 sticky 编排，不得恢复独立根外壳、页面主滚动视口、全局居中限宽框或管理员专属玻璃参数。
38. 商品物资插画主视觉归属 `UI_DESIGN_SYSTEM.md` 的商品图标体系：`src/assets/product-icons/` 只保存 `1024 × 1024` RGBA PNG 正式源图，开发与构建统一由 `scripts/generate-product-artwork-thumbnails.mjs` 生成 `src/assets/product-icons/generated/128/` 下的 `128 × 128` RGBA PNG 运行时缩略图；`product-artwork.css` 只能通过 `ProductIcon` 的 `data-product-icon` 映射缩略图，禁止直接加载源图。仓库商品卡、市场商品目录、概览商品行情和拍卖商品主视觉使用缩略图，生产公式、订单表格、资产变动和未知商品继续使用 SVG，并通过 `scripts/verify-product-artwork.mjs` 校验 31 种源图、缩略图、映射、生成入口、降级和使用边界。
39. 人口政策参数、当前参数与持续时间展示、无管理备注、无调控记录、无业务上限及安全整数边界统一归属 `GIFT_CODE_AND_ADMIN_DESIGN.md`；就业来源与复杂度工资中的正数比例条必须保留最小可见填充，真实零值保持空轨道，并通过人口经济服务器测试、管理员浏览器测试和 `scripts/verify-staple-crops-demand.mjs` 防回退。
40. 市场商品目录卡内部信息布局归属页面职责与市场专用样式：卡片必须先渲染只包含居中 `ProductIcon` 的图标层，再渲染包含左上名称、右上 `CurrencyAmount` 最近真实成交价、左下真实 DOM“当前”胶囊和右下 `WarehouseIcon` 可用库存的数据层。桌面／移动卡片继续固定为 `138 × 92px`／`132 × 88px`，中央插画固定为 `64 × 64px`／`48 × 48px`，名称前固定增加 `14 × 14px` 对应商品 SVG；卡片使用 `var(--radius-control)` 圆角、`var(--space-3)` 间距、强边框和轻量阴影区分相邻项目，悬停不得位移。资产目录的隐式列必须按子项自身宽度生成：商品与工厂分组标签只占自身 `46px` 轨道，资产卡分别保持桌面 `138px`、移动 `132px` 固定宽度，标签与首张资产卡之间只保留 `var(--space-3)` 间距，不得让分组标签继承资产卡列宽形成额外空白。图标层必须位于数据层下方且不参与数据网格，两层均覆盖卡片并禁用指针事件；商品卡不得用 `::after` 生成“当前”胶囊。没有真实成交时商品和工厂目录价格统一显示 `—`，不得回退到商品基础价或工厂系统价值；实现必须同步 `MarketPage.tsx`、`market-page-polish.css`、`product-artwork.css`、`scripts/verify-market-page-layout.mjs` 与市场浏览器测试。
41. 长期生产合作合同的页面职责归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`，工厂集群边界和生产先于合同交付归 `INDUSTRY_AND_PRODUCTION_DESIGN.md`，接口、事务、调度和 `contract` 分区归 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`。合同只允许商品与普通货币，不允许藏品、工厂转移、工厂出租、自由文本或对方配方控制；必须通过 `server/test/contracts.test.js` 和页面／状态容量验证防回退。
42. 所有可见倒计时必须先区分本地资格到期与服务器权威状态转换；统一读取 `serverNow` 校准的共享单调服务器时钟，状态转换到期后由权威刷新继续确认。每个返回分区内部都是完整快照，必须整块替换同名分区。该规则由 `AUTHORITATIVE_COUNTDOWN_DESIGN.md` 与 `scripts/verify-authoritative-countdowns.mjs` 防回退。
43. 管理员玩家运营统计、成功经济写操作活跃口径、精确日活动覆盖起点、D1／D7／D30 留存、成长漏斗、经营参与、真实成交估值财富分布、关注群体、独立 SQLite 分析表和聚合隐私边界属于管理员与服务器共同规则；不得把统计结果用于扩张人口需求预算，必须同步更新 `GIFT_CODE_AND_ADMIN_DESIGN.md`、`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`、服务器测试和 `scripts/verify-admin-player-statistics.mjs`。
