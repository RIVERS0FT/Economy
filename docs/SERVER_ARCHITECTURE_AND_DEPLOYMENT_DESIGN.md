# Economy 服务器权威架构与部署设计

> 状态：当前服务器、API、容量和生产部署权威基线
> 适用项目：`RIVERS0FT/Economy`
> 生产网页：`https://game.riversoft.top/economy/`
> 更新时间：2026-07-18
> 客户端状态版本：15
> 世界状态版本：13

## 1. 目标与生产拓扑

- 所有普通货币、宝石、库存、工厂、订单、需求、藏品、拍卖、邀请关系、账号封禁和排行榜由服务器判定。
- 浏览器只负责展示、倒计时、筛选、预测和本地活动日志。
- SQLite 事务、幂等、冻结和资产守恒优先于可用性降级。
- 单节点目标继续受 2 vCPU、2 GB 内存约束。
- API 只监听回环地址，由正式 HTTPS Nginx 入口代理。

```text
浏览器 https://game.riversoft.top/economy/
  → Nginx /economy/                         → /var/www/game/economy
  → Nginx /economy-api/login|me|logout      → 127.0.0.1:3001
  → Nginx /economy-api/registration/*       → 127.0.0.1:3002/api/registration/*
  → Nginx /economy-api/game/*               → 127.0.0.1:3002/api/game/*
  → riversoft-economy-api.service
  → /var/lib/riversoft-economy/economy.sqlite
```

固定路径：

- 游戏 API：`127.0.0.1:3002`
- 账号服务：`127.0.0.1:3001`
- 网页目录：`/var/www/game/economy`
- API 目录：`/var/www/game/economy-api`
- 数据库：`/var/lib/riversoft-economy/economy.sqlite`
- 共享邮件环境：`/etc/riversoft-email.env`
- Economy 专用邮件环境：`/etc/riversoft-economy-api.env`
- systemd：`riversoft-economy-api.service`

## 2. 服务器权威边界

服务器保存并判定可用与冻结资金、宝石余额与流水、宝石商店兑换记录、商品库存、仓库、工厂集群及配方、商品与工厂订单、逐笔成交、需求预算、市场价格历史、藏品归属、拍卖、工作冷却、礼品、Economy 注册信息、邀请码、邀请关系、注册 IP 封禁、总资产和排行榜。

服务器不得把浏览器展示用 `trades`、`ledger`、`assetEvents` 数组保存进世界 JSON。宝石属于服务器权威资产，但不参与普通货币结算、总资产和排行榜。芝加哥艺术博物馆图片由浏览器直接加载；服务器只保存馆藏 ID、IIIF `imageId` 和元数据。

## 3. 领域模块权威入口

`server/src/domain.js` 是当前权威门面。服务器测试、`storage.js`、`facility-groups.js` 和其他业务模块必须从 `domain.js` 导入目录、迁移、动作、世界处理和客户端状态函数。

`server/src/domain-core.js` 保存迁移前的兼容经济核心，只允许被 `domain.js` 导入。当前门面统一覆盖：

- 正式 `PRODUCT_CATALOG`、`FACILITY_TYPE_CATALOG` 和 `DEMAND_GROUP_CATALOG`；
- 22 种商品与 15 种工厂的整数价格、数量、周期和成本；
- 农场 120 秒、产量 4、成本 6 的小麦和水稻配方；
- 食品、小麦、水稻、肉、蛋和奶共享需求、家庭用品聚合需求及无直接需求商品抑制；
- `createWorld`、`migrateWorld`、`processWorld`、`applyAction` 和 `createClientState` 的权威出口。

`server/src/balanced-market.js` 是 `domain.js` 使用的市场运行辅助层，负责市场结构修复、商品订单撮合和逐笔成交记录。它不得定义第二套商品目录，只能接收 `domain.js` 已生成的正式目录，也不得生成系统流动性、企业采购或普通人口需求订单。

`server/src/invitations.js` 是宝石邀请、邀请码、邀请关系、注册 IP 封禁与解禁审计的唯一业务模块。

`server/src/gem-shop.js` 是宝石兑换普通货币的唯一规则模块，固定定义 1 宝石兑换 10 普通货币和单次 1～100 宝石边界；`storage.js` 只负责在同一事务中保存世界与 `economy_gem_shop_exchanges` 记录，不得另设客户端汇率。它可以通过注入的 `EconomyStore` 事务和 `ensurePlayer` 操作世界状态，但不得重新定义玩家、普通货币、总资产或市场规则。邀请奖励、邀请关系、宝石流水和封禁记录必须在同一 SQLite 事务中保持一致。

除 `domain.js` 外，任何业务文件不得绕过 `domain.js` 直接导入 `domain-core.js`。辅助层也不得导入兼容核心。否则可能重新启用旧价格、旧 60 预算主食需求、独立食品需求或旧农场参数。未来合并兼容核心前必须保持相同测试，且不得形成平行权威目录或需求引擎。

## 4. 状态、迁移与存储

- 客户端 `EconomyState.version` 固定为 15。
- SQLite 世界版本固定为 13。
- 宝石字段采用同版本加法迁移：读取或序列化旧玩家时将缺失的 `gems` 与 `stats.invitationGemsIssued` 初始化为 0，不提高世界版本或客户端状态版本。
- 邀请码、邀请关系、宝石流水、宝石商店兑换记录、封禁事件和审计属于 SQLite 业务表，不写入世界 JSON。
- 邮箱验证码注册不修改世界 JSON 结构，不提高世界版本。
- 通用资产拍卖继续复用世界 JSON 的 `collectibleAuctions` 持久化数组，并为记录增加 `assetKind`、`assetId`、`quantity` 与 `escrowStatus`；客户端增加 `assetAuctions` 并保留藏品兼容别名。本次加法迁移不提高世界版本 13 或客户端状态版本 15。
- 世界版本 12 升级到 13 时删除旧人口订单，保留玩家订单及冻结资产，补齐玩家 `lastEconomicActivityAt` 和需求动态统计字段，并把两类人口需求标记为当前事务立即执行；旧 500／480 预算按单周期最多 20% 的上限向新目标过渡，不得留下一个需求周期的空窗。所有日志清理、兼容结构清理和序列化辅助函数只能保留或提升当前世界版本，不得把世界版本写回旧值，否则会重复执行迁移、重复生成需求并持续推进修订号。
- 旧 `grain` 库存、冻结量、订单和行情幂等迁移到 `wheat`，初始化 `rice` 和 `wheat-crop`。
- 数据库使用 Node 内置 `node:sqlite`、WAL 和事务；资产、邀请、封禁和解禁写操作使用 `BEGIN IMMEDIATE`。
- 正式数据库不得位于发布目录，部署不得删除或覆盖数据库。

`GET /api/game/state` 返回单调递增的世界 `revision`。首次不带修订号，后续使用 `?revision=N`；未变化时只返回 `{ revision, unchanged: true }`。空闲状态读取不得仅因服务器时间推进而修改 `lastProcessedAt`、`lastEconomicActivityAt`、增加修订号或写回相同的 `state_json`。只有成功经济写操作可以刷新玩家活跃时间，失败操作、轮询和后台生产不得刷新。管理员世界概况同时返回各需求组的目标预算、玩家规模预算、库存追加、活跃玩家数、库存价值、承诺预算与满足率；该入口仍属于只读，只有处理生产或拍卖后序列化结果实际变化时才允许保存并增加修订号。

多输入配方以 `inputs[]` 为唯一正式结构。服务器必须先合并相同商品输入并检查全部库存、资金和仓库条件，再在同一事务中扣除所有输入；任一输入不足时不得发生部分扣料。世界版本 8 升级到 9 时，正在运行的电子工厂周期从迁移时刻重新开始，以避免旧塑料单输入周期按新双输入规则结算。

## 5. 请求安全、账号认证与 Economy 注册

- 只接受正式站点的同源或可信 same-site 请求。
- 使用主页账号 Cookie，不接受客户端自报用户 ID 或角色。
- `GET /api/game/state` 最多复用 10 秒认证结果，普通写操作最多复用 2 秒，`/api/game/admin/` 每次重新验证且不读取缓存。
- 401 只缓存 1 秒；超时、无效响应、502 和 503 不缓存，也不得使用过期结果执行资产写操作。
- 缓存键只保存完整 Cookie header 的 SHA-256 摘要，使用最多 5,000 条的 LRU。
- 同一摘要的并发未命中共享一个上游验证 Promise，并在 `finally` 中移除。
- 所有资产、邀请与管理员写操作要求 8～128 字符的 `Idempotency-Key`。
- 服务器重新校验价格、数量、资金、库存、仓库、工厂、订单归属、藏品、拍卖资产归属与冻结、邀请码、封禁和管理员角色。
- 禁止玩家自成交，卖家不得竞拍自己的藏品、商品或工厂，玩家不得填写自己的邀请码。
- 每名玩家最多 10 笔未完成商品／工厂订单。
- Nginx 游戏 API 请求体上限为 256 KB；普通 JSON 仍由应用限制为 16 KB。
- 单进程操作限流缓存每分钟清理已过期桶，并限制最多 10,000 个用户／类别桶；不得让历史用户键永久累积。

### 5.1 Economy 注册、邀请归因与同 IP 封禁

“Economy 注册完成”的准确时点是：某个统一账号第一次创建 Economy 玩家档案。任何已登录主页账号首次进入 Economy 时仍允许自动创建玩家档案，并在同一事务记录 Economy 注册 IP 指纹、邮箱、完成时间和来源；不得要求该账号再次走验证码注册。邮箱验证码注册完成接口是另一条首次建档入口，两条入口必须共用同一首次建档、邀请归因、IP 检测和记录逻辑。

主页已经完成账号信任与邮箱验证，但邮箱验证码注册和来源为 `homepage_session` 的首次建档仍统一执行注册 IP 规则。Nginx 必须覆盖并传入可信 `X-Real-IP`；应用优先使用该值，避免客户端伪造 `X-Forwarded-For` 绕过规则。只保存由服务器秘密 HMAC 生成的注册 IP 指纹，不保存或展示明文 IP。同一注册 IP 指纹出现两个或更多不同统一账号时，必须先创建或更新封禁事件，再将该指纹下全部 Economy 账号标记为封禁；封禁优先于邀请奖励。普通登录时网络变化不触发封禁，判定只读取首次建档保存的注册 IP 指纹。

封禁账号访问普通 `/api/game/` 接口返回 `423 Locked`、`ECONOMY_ACCOUNT_BANNED` 和事件编号。管理员接口仍必须在重新验证管理员角色后可访问，以便被同 IP 规则命中的管理员完成复核和解禁。管理员可以解禁单个账号或整个事件，也可以重新封禁；操作必须保留事件和审计历史。手动解禁后，服务重启不得无条件重新封禁；只有该 IP 指纹出现新的注册账号时才重新封禁整个账号组。

每名玩家拥有一个服务器生成的永久 8 位邀请码。分享链接使用 `https://game.riversoft.top/economy/?invite=邀请码`。分享链接只在首次创建 Economy 玩家档案时自动归因；有效且未被封禁的邀请关系在注册事务中立即向邀请人发放 10 宝石，被邀请人不获得宝石。已有 Economy 档案的账号访问分享链接不得补绑或重复奖励。

未通过分享链接绑定的玩家可在首次建档后 24 小时内通过设置页手动填写一次邀请码。分享链接和手动邀请码共用 `invitee_user_id` 唯一约束，一个账号只能绑定一个邀请人。相同注册 IP 的邀请关系可以记录为 `blocked_same_ip`，但不得发放宝石，也不得改绑其他邀请人。重置经济状态不得清除宝石、邀请码、邀请关系、宝石流水、封禁或解禁历史。

### 5.2 邮箱验证码

- `economy_email_verifications` 保存请求幂等键、邮箱、验证码 HMAC、IP 指纹、有效期、错误次数、投递状态、使用状态和完成账号；不得保存验证码明文。
- `economy_registrations` 以统一账号 ID 为主键，保存首次玩家档案创建时的邮箱、注册 IP 指纹、完成时间和来源。
- `economy_invite_codes`、`economy_invitation_relations`、`economy_gem_ledger`、`economy_gem_shop_exchanges`、`economy_ip_ban_incidents`、`economy_ip_ban_members`、`economy_account_bans` 与 `economy_ban_audit` 是邀请、宝石兑换和封禁的权威业务表。
- 生成验证码记录和调用 Resend 前，Economy 必须通过主页账号服务仅限同机回环的 `POST /api/internal/account-email-exists` 查询邮箱是否已经注册。已注册邮箱返回 `409` 和“该邮箱已注册，请直接登录”，不得创建 `economy_email_verifications` 记录，也不得发送邮件；查询失败时返回统一账号服务不可用，不得绕过查重继续投递。
- 验证码固定为 6 位数字，有效期 10 分钟；同一邮箱或同一 IP 指纹 60 秒内禁止再次发送。
- 验证码错误 5 次后状态变为不可用；过期、已使用或作废验证码不能重复使用。
- 验证码终态记录保留 30 天；注册请求触发的清理任务最多每小时执行一次，先将已过期的 `pending`／`sent` 标记为 `expired`，再删除超过保留期的 `failed`、`expired`、`invalid` 和 `used` 记录。未过期活动验证码和永久注册记录不得删除。
- 发送 IP 和提交 IP 的指纹必须一致，否则拒绝完成注册。
- 发送与完成接口都要求 `Idempotency-Key`；同一完成请求重试只能返回同一个统一账号、玩家档案、邀请关系和宝石结果，不得重复创建或发放。
- `server/src/email.js` 只使用 Resend HTTP API，超时固定 8 秒，并向 Resend 发送稳定幂等键。
- 生产日志不得打印验证码、`RESEND_API_KEY`、注册秘密、注册 IP 明文或邮件请求正文。
- 统一账号创建顺序为先调用主页 `/api/register`；邮箱已存在时再调用 `/api/login`。成功响应的会话 Cookie 转发给 Economy 浏览器会话。
- 生产验证码投递必须同时配置 `RESEND_API_KEY` 与 `EMAIL_FROM`。`EMAIL_FROM` 是唯一正式发件人变量名，不使用旧名称。缺少任一项时接口返回 `424` 和“邮箱验证码服务未配置，请联系管理员”，不得把配置缺失伪装成整个游戏服务器故障；Resend 超时、拒绝或无效响应继续返回通用 `503`，不得向客户端泄露供应商响应正文。

## 6. 注册与游戏 API

注册公网前缀 `/economy-api/registration/`，内部前缀 `/api/registration/`。

| 方法 | 公网路径 | 内部路径 | 用途 |
|---|---|---|---|
| POST | `/economy-api/registration/email-code` | `/api/registration/email-code` | 发送邮箱验证码 |
| POST | `/economy-api/registration/complete` | `/api/registration/complete` | 校验验证码、统一账号、邀请链接、同 IP 规则并首次建档 |

游戏公网前缀 `/economy-api/game/`，内部前缀 `/api/game/`。

| 方法 | 内部路径 | 用途 |
|---|---|---|
| POST | `/api/game/session` | 已登录账号首次建档、分享链接归因与封禁状态初始化 |
| GET | `/api/game/state` | 获取完整状态或修订号轻量确认 |
| GET | `/api/game/invitations` | 获取宝石余额、邀请码、分享链接和邀请统计 |
| POST | `/api/game/invitations/claim` | 注册后 24 小时内手动填写邀请码 |
| GET | `/api/game/gem-shop` | 获取服务器汇率、兑换边界、累计与最近记录 |
| POST | `/api/game/gem-shop/exchange` | 原子扣除宝石并增加普通货币 |
| POST | `/api/game/work` | 工作 |
| POST | `/api/game/facilities` | 建设工厂 |
| POST | `/api/game/facilities/:facilityTypeId/start` | 开启工厂集群 |
| POST | `/api/game/facilities/:facilityTypeId/pause` | 停止工厂集群 |
| POST | `/api/game/facilities/:facilityTypeId/recipe` | 设置当前或下一周期配方 |
| POST | `/api/game/orders` | 创建商品或工厂订单 |
| POST | `/api/game/orders/:orderId/cancel` | 撤销订单 |
| POST | `/api/game/warehouse/upgrade` | 扩容仓库 |
| POST | `/api/game/gifts/redeem` | 兑换礼品 |
| POST | `/api/game/collectible-auctions` | 发起藏品拍卖 |
| POST | `/api/game/collectible-auctions/:auctionId/bids` | 竞价 |
| POST | `/api/game/collectible-auctions/:auctionId/cancel` | 取消无出价拍卖 |
| PATCH | `/api/game/profile` | 修改昵称 |
| POST | `/api/game/reset` | 重置玩家经济状态但保留宝石、邀请和封禁记录 |
| GET | `/api/game/admin/bans` | 管理员查看同 IP 封禁事件 |
| GET | `/api/game/admin/bans/:incidentId` | 管理员查看事件成员 |
| POST | `/api/game/admin/bans/users/:userId/unban` | 管理员解禁单个账号 |
| POST | `/api/game/admin/bans/:incidentId/unban-all` | 管理员解禁事件全部账号 |
| POST | `/api/game/admin/bans/users/:userId/reban` | 管理员重新封禁账号 |

旧工厂固定挂牌路由只作迁移兼容。旧 `/api/game/facilities/:facilityTypeId/plan` 返回 `410 Gone`，不得恢复生产模式或目标产量。

人口饮食需求以 `world.demandGroups.staples` 为唯一预算周期状态，每周期最多承诺 330，在食品、小麦、水稻、肉、蛋和奶间按卖盘深度、效用、偏好和预算上限分配。六种商品不得生成独立人口订单，满足率按效用计算。棉花、毛、铜矿石、铜材和纺织品只保留基础流动性，不生成独立人口消费；家具和服装共享 `household-goods` 固定预算。

### 6.1 宝石商店事务

宝石商店固定使用 1 宝石兑换 10 普通货币，单次接受 1～100 的整数宝石。`POST /api/game/gem-shop/exchange` 必须先通过封禁检查和普通写操作限流，并要求 `Idempotency-Key`。在一个 `BEGIN IMMEDIATE` 事务中完成宝石余额校验、扣除宝石、增加可用资金、普通货币账本写入、`economy_gem_shop_exchanges` 插入、世界修订号更新和幂等响应保存；任一步失败全部回滚。

`GET /api/game/gem-shop` 只返回服务器固定汇率、当前余额、累计值和最近 20 笔兑换。客户端预览不得成为结算依据。相同幂等键重试返回第一次响应，不重复扣除或发行；不同路径复用幂等键继续返回冲突。

## 7. 容量与客户端交付

正式客户端默认每 5 秒轮询一次修订号，可选 3／5／10 秒，不得恢复每 1 秒完整状态轮询。轮询和动作响应只有在 `revision` 不低于当前值时才能更新界面；低修订号或缺少修订号的迟到响应不得覆盖新状态。

发起任一权威动作时必须使用 `AbortController` 取消正在进行的状态轮询，并在动作完成前暂停新轮询。工作动作必须在请求发出时同步进入本地“处理中”状态、立即禁用按钮并阻止重复提交；资产仍以服务器响应为准。

优先级：

1. 登录、注册、封禁检查、邀请奖励、资产、冻结、生产、订单、成交和拍卖结算；
2. 系统需求与公共市场；
3. 排行榜、长周期图表和公开统计。

资源不足时宁可拒绝写操作，也不能产生负库存、重复发放、重复扣款、重复邀请奖励或超额成交。

## 8. Node、systemd 与部署权限

- GitHub Actions 固定使用 Node 24.4.0 构建和测试；根依赖必须使用精确版本并提交 `package-lock.json`，CI、Web Build 和 Deploy 统一使用 `npm ci`，不得恢复 `latest`、范围依赖或无锁安装。
- 浏览器运行时测试使用固定 Playwright 版本与 Chromium，至少覆盖 localStorage 拒绝访问仍能渲染、正式设置控件存在以及无效设置控件不存在。
- 部署包携带匹配架构的官方 Node 运行时。
- 服务端 Node 最低版本 `22.16.0`，必须支持 `node:sqlite`；构建工具链固定在 Node 24.4.0。
- systemd 首选可执行文件：`/var/www/game/economy-api/runtime/bin/node`。
- 服务不得以 root 运行。
- 安装脚本在 `/var/lib/riversoft-economy/registration-secret` 首次生成持久注册 HMAC 秘密，权限固定为服务用户 `0600`，部署不得覆盖。该秘密同时用于验证码、邀请码确定性生成和注册 IP 指纹。
- systemd 先加载共享 `/etc/riversoft-email.env`，再加载 `/etc/riversoft-economy-api.env`。共享文件先加载，Economy 专用文件后加载；专用文件中的同名变量可以覆盖共享值。
- 两个环境文件均为可选，但运行进程最终必须同时具有非空 `RESEND_API_KEY` 与 `EMAIL_FROM` 才能标记验证码可用；文件不得提交到仓库或打印到日志。
- 邮件密钥只保存在服务器。GitHub Actions 不保存、不上传也不改写 `RESEND_API_KEY` 或 `EMAIL_FROM`。
- `.github/workflows/configure-registration-email.yml` 在主部署成功后运行。主部署已负责重写 systemd 单元并重启服务；邮件配置工作流不得再次读取 root-only 环境文件或重启服务。
- 配置工作流必须以服务用户读取运行进程的 `/proc/<pid>/environ`，只验证 `RESEND_API_KEY` 与 `EMAIL_FROM` 是否非空，不得输出变量值，并写回 `deploy/economy-email` 提交状态。

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

## 9. Nginx 与验收

账号路由和游戏 API 路由分别位于：

```text
/etc/nginx/snippets/game-riversoft-economy-account.conf
/etc/nginx/snippets/game-riversoft-economy-game-api.conf
```

注册路由由 `scripts/configure-economy-registration-nginx.py` 幂等加入正式 HTTPS `server`：

```text
/economy-api/registration/ → 127.0.0.1:3002/api/registration/
```

部署脚本必须识别已有 snippet 和手工路由，只补缺失部分。

- 不得在账号 snippet 已存在时再次生成同名账号 `location`。
- 不得在游戏 API snippet 或手动游戏路由已存在时再次生成 `/economy-api/game/`。
- 不得在手动注册路由已存在时再次生成 `/economy-api/registration/`。
- 连续执行两次，第二次不得产生配置变化。
- 游戏 API `client_max_body_size` 固定为 `256k`；注册 API 固定为 `16k`。

大于 1 KB 的 `application/json` 响应启用 gzip：`gzip_vary on`、`gzip_proxied any`、`gzip_types application/json`、压缩级别 5。部署脚本必须修补既有游戏 API snippet 或手工 `location`，不得只对新安装生效。

修改 Nginx 前保留回滚配置；修改后执行 `nginx -t`，成功才 reload，失败立即恢复。

`npm run build` 必须执行设计与架构验证、Nginx 测试、服务器语法和测试、TypeScript 与 Vite 构建。CI 还必须安装固定 Chromium 并执行 `npm run test:browser`；应用根节点必须由错误边界包裹，意外渲染异常只能显示可恢复页面，不得留下空白屏。主部署后验证 API 健康、静态网页、账号代理、注册代理、未登录 401、systemd 用户／端口／数据库、注册秘密和无重复路由；邀请专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 全组封禁、423 响应和管理员解禁。邮件配置工作流另行验证运行进程实际环境和服务健康，并以 `deploy/economy-email` 独立状态防止主部署误报验证码可用。

## 10. 防回退

不得恢复：

- 浏览器本地存储作为正式资产；
- 服务器持久化展示日志；
- 单座工厂模型、固定价格工厂市场或定量生产；
- 连续工作递增冷却；
- API 公网监听、root 运行或部署覆盖数据库；
- 空闲读取或管理员摘要无变化时写库、每秒完整状态轮询或迟到响应覆盖新状态；
- 权威动作与轮询并行更新界面；
- 原始 Cookie 缓存、管理员认证缓存或超过 5,000 条 LRU；
- 永久保留失效验证码、让操作限流 Map 无边界增长、恢复浮动依赖或删除依赖锁；
- 删除 Chromium 浏览器运行时测试、localStorage 拒绝访问覆盖或顶层错误边界；
- 删除游戏 JSON gzip；
- 让任何模块绕过 `domain.js` 直接导入 `domain-core.js`；
- 让 `balanced-market.js` 维护第二套商品数值；
- 恢复旧商品参考价、旧农场参数、食品独立需求、60 预算旧主食需求或按件数计算满足率；
- 在登录 401 后自动调用主页注册接口；
- 保存验证码、注册 IP 明文或邀请人隐私信息，跳过 10 分钟有效期／60 秒重发／错误 5 次作废、允许验证码复用或允许发送与提交 IP 不一致；
- 让邮箱验证码入口和主页已登录自动建档维护两套首次建档、邀请归因或 IP 检测逻辑；
- 恢复主页账号共享注册 IP 的例外，或只封禁新账号而保留同 IP 旧账号可用；
- 在同 IP 封禁检查之前发放邀请宝石；
- 允许一个被邀请账号绑定多个邀请人、重置后重新领取、客户端决定奖励或把宝石计入总资产；
- 管理解禁删除事件与审计历史、服务重启立即推翻人工解禁，或解禁后自动补发被拦截的邀请奖励；
- 删除 `/economy-api/registration/` Nginx 路由或打印验证码、Resend API Key 与注册秘密；
- 把邮件密钥复制到 GitHub Actions，或让部署工作流覆盖服务器已有邮件配置；
- 删除 `/etc/riversoft-email.env` 的共享加载，颠倒共享文件与 Economy 专用文件的覆盖顺序，或让邮件配置工作流读取并打印环境文件内容；
- 在缺少 `RESEND_API_KEY` 或 `EMAIL_FROM` 时仍把部署标记为验证码可用，或把明确的邮件配置缺失重新改写成整个游戏服务器不可用；
- 把正式发件人变量从 `EMAIL_FROM` 改回其他名称。

未更新设计文档的架构回退不应合并。未更新防回退检查的架构变更同样不应合并。

## 普通玩家订单序列化边界

世界 JSON 内部保留完整撮合信息；普通玩家 API 必须通过单一公开订单序列化函数输出匿名视图。该函数删除所有订单的真实所有者和人口需求字段，只为本人订单返回匿名 fills，并删除其他订单 fills。管理员审计若需要真实对手信息必须使用独立管理员接口，不得复用普通玩家 DTO。

本次仅提升客户端状态版本到 15，本地活动存储提升到 v5；世界状态版本继续为 12，不迁移或重置玩家资产和订单。
