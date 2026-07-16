# Economy 服务器权威架构与部署设计

> 状态：当前服务器、API、容量和生产部署权威基线  
> 适用项目：`RIVERS0FT/Economy`  
> 生产网页：`https://game.riversoft.top/economy/`  
> 更新时间：2026-07-16  
> 客户端状态版本：12  
> 世界状态版本：8

## 1. 目标与生产拓扑

- 所有货币、库存、工厂、订单、需求、藏品、拍卖和排行榜由服务器判定。
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
- systemd：`riversoft-economy-api.service`

## 2. 服务器权威边界

服务器保存并判定可用与冻结资金、商品库存、仓库、工厂集群及配方、商品与工厂订单、逐笔成交、需求预算、市场价格历史、藏品归属、拍卖、工作冷却、礼品、Economy 注册信息、总资产和排行榜。

服务器不得把浏览器展示用 `trades`、`ledger`、`assetEvents` 数组保存进世界 JSON。芝加哥艺术博物馆图片由浏览器直接加载；服务器只保存馆藏 ID、IIIF `imageId` 和元数据。

## 3. 领域模块权威入口

`server/src/domain.js` 是当前权威门面。服务器测试、`storage.js`、`facility-groups.js` 和其他业务模块必须从 `domain.js` 导入目录、迁移、动作、世界处理和客户端状态函数。

`server/src/domain-core.js` 保存迁移前的兼容经济核心，只允许被 `domain.js` 导入。当前门面统一覆盖：

- 正式 `PRODUCT_CATALOG`、`FACILITY_TYPE_CATALOG` 和 `DEMAND_GROUP_CATALOG`；
- 13 种商品与 12 种工厂的整数价格、数量、周期和成本；
- 农场 120 秒、产量 4、成本 6 的小麦和水稻配方；
- 食品、小麦和水稻共享需求及旧独立人口需求抑制；
- `createWorld`、`migrateWorld`、`processWorld`、`applyAction` 和 `createClientState` 的权威出口。

`server/src/balanced-market.js` 是 `domain.js` 使用的市场运行辅助层，负责让新世界、缺失市场、通用人口需求和系统流动性读取正式整数参考价。它不得定义第二套商品目录，只能接收 `domain.js` 已生成的正式目录。兼容核心执行期间，门面必须暂时抑制旧需求周期并保证正式流动性已存在，避免旧参考价重新生成系统订单。

除 `domain.js` 外，任何业务文件不得绕过 `domain.js` 直接导入 `domain-core.js`。辅助层也不得导入兼容核心。否则可能重新启用旧价格、旧 60 预算主食需求、独立食品需求或旧农场参数。未来合并兼容核心前必须保持相同测试，且不得形成平行权威目录或需求引擎。

## 4. 状态、迁移与存储

- 客户端 `EconomyState.version` 固定为 12。
- SQLite 世界版本固定为 8。
- 本次邮箱验证码注册不修改世界 JSON 结构，不提高世界版本。
- 现有玩家订单、成交和价格历史不重写；新世界、缺失市场及后续系统流动性使用新参考价。
- 旧 `grain` 库存、冻结量、订单和行情幂等迁移到 `wheat`，初始化 `rice` 和 `wheat-crop`。
- 数据库使用 Node 内置 `node:sqlite`、WAL 和事务；资产写操作使用 `BEGIN IMMEDIATE`。
- 正式数据库不得位于发布目录，部署不得删除或覆盖数据库。

`GET /api/game/state` 返回单调递增的世界 `revision`。首次不带修订号，后续使用 `?revision=N`；未变化时只返回 `{ revision, unchanged: true }`。空闲状态读取不得仅因服务器时间推进而修改 `lastProcessedAt`、增加修订号或写回相同的 `state_json`。

## 5. 请求安全、账号认证与 Economy 注册

- 只接受正式站点的同源或可信 same-site 请求。
- 使用主页账号 Cookie，不接受客户端自报用户 ID 或角色。
- `GET /api/game/state` 最多复用 10 秒认证结果，普通写操作最多复用 2 秒，`/api/game/admin/` 每次重新验证且不读取缓存。
- 401 只缓存 1 秒；超时、无效响应、502 和 503 不缓存，也不得使用过期结果执行资产写操作。
- 缓存键只保存完整 Cookie header 的 SHA-256 摘要，使用最多 5,000 条的 LRU。
- 同一摘要的并发未命中共享一个上游验证 Promise，并在 `finally` 中移除。
- 所有资产写操作要求 8～128 字符的 `Idempotency-Key`。
- 服务器重新校验价格、数量、资金、库存、仓库、工厂、订单归属、藏品和拍卖状态。
- 禁止玩家自成交，卖家不得竞拍自己的藏品。
- 每名玩家最多 10 笔未完成商品／工厂订单。
- Nginx 游戏 API 请求体上限为 256 KB；普通 JSON 仍由应用限制为 16 KB。

### 5.1 Economy 注册完成时点

“Economy 注册完成”的准确时点是：某个统一账号第一次创建 Economy 玩家档案。任何已登录主页账号首次进入 Economy 时仍允许自动创建玩家档案，并在同一事务记录 Economy 注册 IP 指纹、邮箱、完成时间和来源；不得要求该账号再次走验证码注册。邮箱验证码注册完成接口是另一条首次建档入口，两条入口必须共用同一首次建档和记录逻辑。

主页已经完成账号信任与邮箱验证，因此来源为 `homepage_session` 的已登录主页账号不再执行 Economy 注册 IP 多账号限制，即使同一网络已经创建其他玩家档案也允许自动建档。多账号限制只对 Economy 自身邮箱验证码入口执行注册 IP 多账号限制，继续阻止该入口使用已经登记给其他账号的注册 IP 指纹。已有 Economy 玩家升级后首次访问时仍补记注册信息，不因历史玩家共享网络而阻止其继续登录。数据库和日志都不得保存注册 IP 明文，只保存由服务器秘密 HMAC 生成的 IP 指纹。

### 5.2 邮箱验证码

- `economy_email_verifications` 保存请求幂等键、邮箱、验证码 HMAC、IP 指纹、有效期、错误次数、投递状态、使用状态和完成账号；不得保存验证码明文。
- `economy_registrations` 以统一账号 ID 为主键，保存首次玩家档案创建时的邮箱、注册 IP 指纹、完成时间和来源。
- 验证码固定为 6 位数字，有效期 10 分钟；同一邮箱或同一 IP 指纹 60 秒内禁止再次发送。
- 验证码错误 5 次后状态变为不可用；过期、已使用或作废验证码不能重复使用。
- 发送 IP 和提交 IP 的指纹必须一致，否则拒绝完成注册。
- 发送与完成接口都要求 `Idempotency-Key`；同一完成请求重试只能返回同一个统一账号和玩家档案，不得重复创建玩家或注册记录。
- `server/src/email.js` 只使用 Resend HTTP API，超时固定 8 秒，并向 Resend 发送稳定幂等键。
- 生产日志不得打印验证码、`RESEND_API_KEY`、注册秘密或邮件请求正文。
- 统一账号创建顺序为先调用主页 `/api/register`；邮箱已存在时再调用 `/api/login`。成功响应的会话 Cookie 转发给 Economy 浏览器会话。

## 6. 注册与游戏 API

注册公网前缀 `/economy-api/registration/`，内部前缀 `/api/registration/`。

| 方法 | 公网路径 | 内部路径 | 用途 |
|---|---|---|---|
| POST | `/economy-api/registration/email-code` | `/api/registration/email-code` | 发送邮箱验证码 |
| POST | `/economy-api/registration/complete` | `/api/registration/complete` | 校验验证码、统一账号、多账号规则并首次建档 |

游戏公网前缀 `/economy-api/game/`，内部前缀 `/api/game/`。

| 方法 | 内部路径 | 用途 |
|---|---|---|
| GET | `/api/game/state` | 获取完整状态或修订号轻量确认 |
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
| POST | `/api/game/reset` | 重置玩家经济状态 |

旧工厂固定挂牌路由只作迁移兼容。旧 `/api/game/facilities/:facilityTypeId/plan` 返回 `410 Gone`，不得恢复生产模式或目标产量。

人口饮食需求以 `world.demandGroups.staples` 为唯一预算周期状态，每周期最多承诺 330，在食品、小麦和水稻间按卖盘深度、效用、偏好和预算上限分配。食品不得生成独立人口订单，满足率按效用计算。

## 7. 容量与客户端交付

正式客户端默认每 5 秒轮询一次修订号，可选 3／5／10 秒，不得恢复每 1 秒完整状态轮询。轮询和动作响应只有在 `revision` 不低于当前值时才能更新界面；低修订号或缺少修订号的迟到响应不得覆盖新状态。

发起任一权威动作时必须使用 `AbortController` 取消正在进行的状态轮询，并在动作完成前暂停新轮询。工作动作必须在请求发出时同步进入本地“处理中”状态、立即禁用按钮并阻止重复提交；资产仍以服务器响应为准。

优先级：

1. 登录、注册、资产、冻结、生产、订单、成交和拍卖结算；
2. 系统需求与公共市场；
3. 排行榜、长周期图表和公开统计。

资源不足时宁可拒绝写操作，也不能产生负库存、重复发放、重复扣款或超额成交。

## 8. Node、systemd 与部署权限

- GitHub Actions 使用 Node 24 构建和测试。
- 部署包携带匹配架构的官方 Node 运行时。
- Node 最低版本 `22.16.0`，必须支持 `node:sqlite`。
- systemd 首选可执行文件：`/var/www/game/economy-api/runtime/bin/node`。
- 服务不得以 root 运行。
- 安装脚本在 `/var/lib/riversoft-economy/registration-secret` 首次生成持久注册 HMAC 秘密，权限固定为服务用户 `0600`，部署不得覆盖。
- Resend 配置从可选的 `/etc/riversoft-economy-api.env` 读取，至少包含 `RESEND_API_KEY` 和 `RESEND_FROM_EMAIL`；配置文件不得提交到仓库或打印到日志。

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

GitHub Actions 使用 `SERVER_USER=deploy`。`deploy` 只能通过白名单完成发布、systemd 和 Nginx 操作；不得扩大为 root 服务或把数据库移入发布目录。

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

`npm run build` 必须执行设计与架构验证、Nginx 测试、服务器语法和测试、TypeScript 与 Vite 构建。部署后验证 API 健康、静态网页、账号代理、注册代理、未登录 401、systemd 用户／端口／数据库、注册秘密和无重复路由。

## 10. 防回退

不得恢复：

- 浏览器本地存储作为正式资产；
- 服务器持久化展示日志；
- 单座工厂模型、固定价格工厂市场或定量生产；
- 连续工作递增冷却；
- API 公网监听、root 运行或部署覆盖数据库；
- 空闲读取写库、每秒完整状态轮询或迟到响应覆盖新状态；
- 权威动作与轮询并行更新界面；
- 原始 Cookie 缓存、管理员认证缓存或超过 5,000 条 LRU；
- 删除游戏 JSON gzip；
- 让任何模块绕过 `domain.js` 直接导入 `domain-core.js`；
- 让 `balanced-market.js` 维护第二套商品数值；
- 恢复旧商品参考价、旧农场参数、食品独立需求、60 预算旧主食需求或按件数计算满足率；
- 在登录 401 后自动调用主页注册接口；
- 保存验证码或注册 IP 明文、跳过 10 分钟有效期／60 秒重发／错误 5 次作废、允许验证码复用或允许发送与提交 IP 不一致；
- 让邮箱验证码入口和主页已登录自动建档维护两套首次建档或记录逻辑；
- 对主页可信账号重新执行 Economy 注册 IP 多账号限制，或让 Economy 自身邮箱验证码入口绕过该限制；
- 删除 `/economy-api/registration/` Nginx 路由或打印验证码、Resend API Key 与注册秘密。

未更新设计文档的架构回退不应合并。未更新防回退检查的架构变更同样不应合并。
