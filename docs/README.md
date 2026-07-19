# Economy 设计文档索引

> 状态：当前文档入口
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-07-19
> 客户端状态版本：15
> 世界状态版本：13

本目录只保留当前设计。旧规则不归档在 `docs/`，也不得以“补充说明”“V2/V3”或新专题文档的形式继续并行存在。

## 权威文档

| 文档 | 唯一职责 |
|---|---|
| `PRODUCT_AND_GAMEPLAY_DESIGN.md` | 产品定位、核心循环、工作冷却、普通货币与宝石、邀请奖励、商店兑换、货币来源回收、需求与排行榜目标 |
| `INDUSTRY_AND_PRODUCTION_DESIGN.md` | 31 种商品、21 种工厂、整数经济数值、参考利润、持续生产、通用工厂配方、生产周期、三态、自动恢复和生产页面结构 |
| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 商品和工厂统一限价订单、冻结、撮合、成交价、估值、资产统计和普通玩家成交匿名化 |
| `WAREHOUSE_EXPANSION_DESIGN.md` | 共享仓库占用、买单预占、无限扩容、商品卡和生产空间约束 |
| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 九个正式页面、登录注册入口、独立商店、分享链接、邀请码、封禁提示、藏品与拍卖、资产导航、模块唯一归属和页面防回退规则 |
| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、统一 SVG 图标、中文界面、响应式、移动触摸反馈、可编辑数字输入与可访问性 |
| `LIQUID_GLASS_CHROME_DESIGN.md` | 桌面与移动端状态栏、移动底栏和玻璃外壳 |
| `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` | 服务器权威边界、普通玩家订单公开序列化、邮箱验证码注册、统一账号首次建档、邀请归因、注册 IP 封禁、API、SQLite、容量限制、Nginx、systemd 和部署 |
| `LOCAL_ACTIVITY_LOG_DESIGN.md` | 浏览器本地快照、资产事件和匿名逐笔成交记录 |
| `GIFT_CODE_AND_ADMIN_DESIGN.md` | 单个与最多 50,000 个批量礼品码、TXT 明文导出、礼品兑换、芝加哥艺术博物馆藏品导入、唯一归属、竞价拍卖（单项与捆绑资产包）、封禁复核、管理员权限和后台范围 |

## 修改规则

1. 一个规则只能有一个权威归属。
2. 跨主题内容只引用权威文档，不复制完整规则。
3. 修改状态版本、世界版本、API、路径、端口或部署权限时，必须同步更新本文档、根 `README.md` 和对应验证脚本。
4. 删除或替换设计时直接修改权威文档，不新建旧版本归档。
5. 新的功能规则必须合并进现有权威文档，不得重新创建已删除文档或追加独立 V2/V3 章节。
6. 代码与文档冲突时不得默认以较新的文件名为准；应核对当前类型、服务器实现、测试和构建检查并立即消除冲突。
7. `scripts/verify-document-authority.mjs` 必须检查权威文件、版本号和禁止文件名；不得为了合并临时绕过或删除该检查。
8. 未更新设计文档和防回退检查的规则变更不应合并。
9. 过长文档优先通过删除重复表格、合并同一责任和调整章节顺序整理。只有拆分后的文件具备明确且唯一的职责时才允许拆分，并必须同步修改本索引、根 `README.md` 和权威性验证脚本。
10. 商品初始参考价、生产数量、周期秒数和周期成本必须保持整数；参考分钟利润必须由正式目录自动校验，不得只在文档中手算。
11. 移动端触控元素必须关闭浏览器原生蓝色 tap highlight，同时保留 `:focus-visible` 键盘焦点；实现统一放在 `src/styles/mobile-interaction.css`，并由 `scripts/verify-mobile-touch-feedback.mjs` 防回退。
12. 状态轮询修订号、响应防倒退、动作／轮询互斥、空闲读取不写库、默认刷新间隔和游戏 JSON 压缩属于服务器容量规则；必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并通过 `scripts/verify-state-delivery-capacity.mjs` 防回退。
13. 主页账号认证缓存的分级 TTL、Cookie 摘要、并发合并、错误策略和 LRU 上限属于安全与容量规则；必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并通过 `scripts/verify-authentication-cache.mjs` 防回退。
14. 小麦／水稻目录、农场改种、持续生产和主食替代预算属于产业与需求权威规则；必须同步更新产业、产品、服务器文档，并通过产业、工厂与主食需求验证脚本防回退。
15. Economy 注册完成时点、主页账号自动建档、邮箱验证码、IP 指纹、多账号封禁、Resend、注册路由和登录注册双模式属于服务器与页面权威规则；必须同步更新服务器、页面、根 README、`scripts/verify-email-registration.mjs` 与服务器测试。
16. 人口需求订单来源、活跃玩家与库存动态预算、生产链双向滞后价格传导和迁移清理属于产品、产业与订单簿权威规则；必须同步更新对应文档、测试和 `scripts/verify-staple-crops-demand.mjs`。
17. 宝石、永久邀请码、分享链接即时奖励、注册后 24 小时手动填写、同 IP 全组封禁、423 响应、管理员解禁与审计属于产品、页面、服务器和管理员权威规则；必须同步更新对应文档、测试和 `scripts/verify-gems-invitations-and-bans.mjs`。
18. 商店固定汇率、单向兑换、兑换幂等与独立页面属于产品、页面和服务器权威规则；必须同步更新对应文档、测试和 `scripts/verify-gem-shop.mjs`。
19. 普通玩家成交记录不得暴露来源、去向或对手订单；API、本地存储和市场页面必须同时匿名化，并通过 `scripts/verify-local-trade-privacy.mjs` 防回退。
20. 运行时可靠性、依赖锁、浏览器测试、localStorage 容错、管理员记录分页、验证码保留和限流缓存上限属于服务器、页面与管理员共同规则；必须同步更新对应权威文档并通过 `scripts/verify-runtime-reliability.mjs` 防回退。

21. 藏品、商品与工厂单项或捆绑资产包竞价、卖方资产冻结、最高出价资金、冻结资产总资产计价、商品仓库预占、工厂生产冻结和订单簿行情隔离属于拍卖、订单簿、仓库、生产、页面与服务器共同规则；必须同步更新对应权威文档、测试和 `scripts/verify-collectibles-auctions.mjs`。
22. 统一订单簿玩家卖出手续费、按卖单累计部分成交、最低手续费、人口需求成交、匿名 `fee/netTotal`、系统回收和拍卖豁免属于产品、订单簿、本地日志、页面、服务器与拍卖共同规则；必须同步更新对应文档、测试和 `scripts/verify-market-sell-fee.mjs`。
23. 受控正整数输入必须保存原始字符串草稿，允许编辑期间暂时为空；空白、非整数或越界草稿不得触发加入或发布，失焦时恢复或归一化为合法值。不得在每次按键时把空字符串立即强制回填为 `1`；资产包添加数量和资产包行数量必须通过 `scripts/verify-collectibles-auctions.mjs` 防回退。
