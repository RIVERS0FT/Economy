# Economy 服务器权威架构与部署设计

> 状态：当前服务器、API、容量和生产部署权威基线  
> 适用项目：`RIVERS0FT/Economy`  
> 生产网页：`https://game.riversoft.top/economy/`  
> 更新时间：2026-07-16
> 客户端状态版本：12
> 世界状态版本：8

## 1. 目标

- 所有正式经济状态、藏品归属和拍卖结算由服务器保存和判定。
- 浏览器刷新、多标签页、本地时间和本地存储不能改变正式资产。
- 账号复用主页账号服务，不建立第二套密码或用户体系。
- 游戏 API 只监听回环地址，通过正式 HTTPS Nginx 入口提供。
- SQLite 事务、幂等和冻结规则优先保证资产一致性。
- 部署必须可重复执行，失败时保留旧的可用配置和数据库。
- 首发继续满足 2 vCPU、2 GB 内存的单节点约束。

## 2. 生产拓扑

```text
浏览器
  |
  | HTTPS https://game.riversoft.top
  v
Nginx
  |-- /economy/                         -> /var/www/game/economy
  |-- /economy-api/login                -> 127.0.0.1:3001/api/login
  |-- /economy-api/me                   -> 127.0.0.1:3001/api/me
  |-- /economy-api/logout               -> 127.0.0.1:3001/api/logout
  `-- /economy-api/game/*               -> 127.0.0.1:3002/api/game/*
                                               |
                                               v
                                  riversoft-economy-api.service
                                               |
                                               v
                         /var/lib/riversoft-economy/economy.sqlite
```

固定参数：

- 游戏 API：`127.0.0.1:3002`
- 账号服务：`127.0.0.1:3001`
- 数据库：`/var/lib/riversoft-economy/economy.sqlite`
- 网页目录：`/var/www/game/economy`
- API 目录：`/var/www/game/economy-api`
- systemd：`riversoft-economy-api.service`

## 3. 服务器权威边界

服务器保存并判定：

- 可用与冻结资金；
- 商品可用与冻结库存；
- 仓库等级、容量和买单预占；
- 工厂集群、运行意图、三态、周期、当前／待生效配方和施工；
- 商品和工厂统一订单、冻结、撮合、逐笔成交和撤单；
- 食品、小麦和水稻人口饮食预算、消费效用、需求分配和满足率；
- 藏品唯一实例、当前归属、归属历史、拍卖、最高出价冻结和自动结算；
- 工作冷却与收入；
- 市场价格历史、需求和统计；
- 商品与工厂估值、总资产和排行榜；
- 礼品码、兑换记录和管理员数据；
- 幂等响应。

服务器不得将以下浏览器展示日志保存进世界 JSON：

```text
trades
ledger
assetEvents
```

客户端负责页面、倒计时、图表、筛选、排序、预测和本地日志，不得直接决定资产、冷却、周期、撮合、估值、排名、需求预算、藏品归属或拍卖结算。

芝加哥艺术博物馆图片由玩家浏览器直接加载，游戏 API 只保存馆藏 ID、IIIF `imageId` 和元数据，不代理或缓存图片字节。

## 4. 领域模块权威入口

`server/src/domain.js` 是当前权威门面。服务器测试、`storage.js`、`facility-groups.js` 和其他业务模块必须从 `domain.js` 导入目录、迁移、动作、世界处理和客户端状态函数。

`server/src/domain-core.js` 保存迁移前的基础经济核心，只允许被 `domain.js` 导入。当前 `domain.js` 在兼容核心之上统一覆盖：

- 正式 `PRODUCT_CATALOG`、`FACILITY_TYPE_CATALOG` 和 `DEMAND_GROUP_CATALOG`；
- 农场 45 秒、产量 4、成本 2 的正式配方参数；
- 食品、小麦和水稻共享需求及旧独立人口需求抑制；
- `createWorld`、`migrateWorld`、`processWorld`、`applyAction` 和 `createClientState` 的权威出口。

除 `domain.js` 外，任何文件不得绕过 `domain.js` 直接导入 `domain-core.js`。否则可能重新启用旧的 60 预算主食需求、独立食品需求或旧农场参数。未来重构可以把兼容核心合并回单一模块，但必须先删除所有旁路并保持相同测试；不得形成第二套并行权威目录或需求引擎。

## 5. 状态与存储

- 客户端 `EconomyState.version` 固定为 12。
- SQLite 世界版本固定为 8。
- 饮食需求与农场目录参数调整不增加持久字段，不单独提高世界版本。
- 藏品和拍卖作为向后兼容的世界 JSON 字段加入，不单独提高世界版本。
- 数据库使用 Node 内置 `node:sqlite`、WAL 和事务。
- 资产写操作使用 `BEGIN IMMEDIATE`。
- 状态轮询使用延迟事务；只有规范化、到期结算、生产周期、玩家首次创建或其他权威内容实际变化时才升级为写入。
- `GET /api/game/state` 返回单调递增的世界 `revision`。客户端首次请求不带修订号；后续使用 `?revision=N`，修订号未变化时只返回 `{ revision, unchanged: true }`，不得重复返回完整状态。
- 空闲状态读取不得仅因服务器时间推进而修改 `lastProcessedAt`、增加修订号或写回相同的 `state_json`；`lastProcessedAt` 只在权威世界实际写入时更新。
- 单节点只运行一个游戏 API 进程。
- 旧世界加载时执行版本迁移、目录补齐以及空藏品／拍卖字段补齐。
- 正式数据库不得位于网页或 API 发布目录。
- 部署不得删除或覆盖数据库。

## 6. 请求安全

- 只接受正式站点的同源或可信 same-site 请求。
- 使用主页账号 Cookie 验证用户，不接受客户端自报用户 ID 或角色。
- 游戏 API 只在当前单进程内缓存已经由主页 `/api/me` 验证的账号结果：`GET /api/game/state` 最多复用 10 秒，普通写操作最多复用 2 秒，`/api/game/admin/` 每次重新验证且不读取缓存。401 只缓存 1 秒；超时、无效响应、502 和 503 不缓存，也不得使用过期结果继续执行资产写操作。
- 认证缓存键只能保存完整 Cookie header 的 SHA-256 摘要，不得保存或记录原始 Cookie。缓存使用最多 5,000 条的 LRU；同一摘要的并发未命中必须共享一个上游验证 Promise，Promise 必须在 `finally` 中移除，并发记录也不得超过相同上限。
- 进程重启会清空认证缓存。正常退出后浏览器 Cookie 被清除；被盗或被撤销的旧 Cookie 最多可能继续读取状态 10 秒、执行普通写操作 2 秒，管理员权限不得存在缓存失效窗口。多实例部署前必须改为可广播失效的共享缓存或本地验证的短期签名凭据。
- Nginx 对 `/economy-api/game/` 的请求体上限为 256 KB；普通游戏 JSON 仍由应用默认限制为 16 KB，只有管理员藏品导入接口允许读取最多 256 KB。
- 管理员每次只能导入 1～100 条藏品，服务端继续限制每个字段长度并拒绝任意图片 URL。
- 所有资产写操作要求 8～128 字符的 `Idempotency-Key`。
- 服务器重新校验价格、数量、余额、库存、仓库、工厂数量、订单归属、藏品归属、拍卖状态和公版标记。
- 禁止自成交；卖家不得竞拍自己的藏品。
- 每名玩家最多 10 笔未完成商品／工厂订单。
- 创建、撤销订单和藏品竞价受服务器限流。
- 未登录返回 401，非管理员访问管理员 API 返回 403。

## 7. 当前游戏 API

公网前缀为 `/economy-api/game/`，内部前缀为 `/api/game/`。

| 方法 | 内部路径 | 用途 |
|---|---|---|
| GET | `/api/game/state` | 首次或修订号变化时获取完整权威状态；`?revision=N` 未变化时只返回轻量确认 |
| POST | `/api/game/work` | 工作 |
| POST | `/api/game/facilities` | 建设工厂 |
| POST | `/api/game/facilities/:facilityTypeId/start` | 开启工厂集群 |
| POST | `/api/game/facilities/:facilityTypeId/pause` | 关闭工厂集群，兼容 `stop` |
| POST | `/api/game/facilities/:facilityTypeId/recipe` | 调整任意工厂的当前／下一周期配方；单配方唯一选项幂等成功 |
| POST | `/api/game/orders` | 创建商品或工厂统一订单 |
| POST | `/api/game/orders/:orderId/cancel` | 撤销统一订单 |
| POST | `/api/game/warehouse/upgrade` | 扩容共享仓库 |
| POST | `/api/game/gifts/redeem` | 兑换礼品 |
| POST | `/api/game/collectible-auctions` | 发起藏品拍卖 |
| POST | `/api/game/collectible-auctions/:auctionId/bids` | 提交藏品竞价 |
| POST | `/api/game/collectible-auctions/:auctionId/cancel` | 取消无出价拍卖 |
| PATCH | `/api/game/profile` | 修改玩家昵称 |
| POST | `/api/game/reset` | 重置玩家经济状态 |

旧 `facility-listings` 与工厂 `list` 路由只允许作为迁移兼容入口，不得成为当前客户端业务入口，也不得在设计中恢复固定价格市场。

旧 `/api/game/facilities/:facilityTypeId/plan` 已退役并返回 `410 Gone`。服务器不得再接受生产模式或目标产量；所有开启的工厂只持续生产。所有工厂类型至少包含一个正式配方和有效 `defaultRecipeId`；单配方工厂提交唯一配方时幂等成功，其他配方继续拒绝。

人口饮食需求以 `world.demandGroups.staples` 为唯一预算周期状态。每周期最多承诺 330 货币，在食品、小麦和水稻之间按卖盘深度、消费效用、偏好权重和预算上限分配；食品效用为 3，原粮效用为 1，满足率按成交效用计算。食品不得同时生成独立人口订单。所有需求订单使用 `demandCycleId` 防止重复挂单。需求周期未到时不得改写该状态；空闲 `GET state` 仍须保持不写数据库。

世界版本 8 在同一 SQLite 事务中把旧 `grain` 库存、冻结量、商品订单与行情迁移到 `wheat`，初始化 `rice` 和农场 `wheat-crop`；迁移必须幂等且保持资金、库存、冻结与订单剩余数量守恒。农场参数调整继续使用原配方 ID，不迁移玩家资产或世界版本。

管理员 API：

- `GET /api/game/admin/summary`
- `GET /api/game/admin/gift-codes`
- `POST /api/game/admin/gift-codes`
- `POST /api/game/admin/gift-codes/:id/disable`
- `GET /api/game/admin/gift-codes/:id/redemptions`
- `GET /api/game/admin/collectibles`
- `POST /api/game/admin/collectibles/import`
- `GET /api/game/admin/collectibles/:id/ownership`

## 8. 容量与优先级

首发设计目标：最低稳定验收 50 名同时在线，产品设计目标 100 名同时在线。更高人数只作为压测观察，不是承诺。

正式客户端默认每 5 秒轮询一次修订号，可选 3／5／10 秒。不得恢复每 1 秒完整状态轮询；动作响应必须同时返回最新修订号，避免动作后立即重复下载完整状态。

客户端必须维护最后接受的修订号，轮询和动作响应只有在 `revision` 不低于当前值时才能更新界面；低修订号或缺少修订号的迟到响应不得覆盖较新的权威状态。发起任一权威动作时必须使用 `AbortController` 取消正在进行的状态轮询，并在动作完成前拒绝启动新轮询，避免旧轮询与动作响应乱序。工作动作必须在请求发出时同步进入本地“处理中”状态、立即禁用按钮并阻止重复提交，在 `finally` 中恢复；货币和冷却仍以服务器响应为准，不做客户端资产乐观结算。

优先级：

1. 登录、资产、冻结、生产结算、订单、成交和藏品拍卖结算；
2. 系统需求与公共市场；
3. 排行榜、长周期图表和公开统计。

资源不足时宁可拒绝新写操作，也不能允许负库存、重复发放、重复扣款、超额成交、重复藏品归属或重复拍卖结算。

## 9. Node 与 systemd

- GitHub Actions 使用 Node 24 构建和测试。
- 部署包携带与 Actions 架构匹配的官方 Node 运行时。
- 运行时目录：`/var/www/game/economy-api/runtime/`。
- systemd 首选可执行文件：`/var/www/game/economy-api/runtime/bin/node`。
- Node 最低不得低于 `22.16.0`，必须支持 `node:sqlite`。
- 服务不得以 root 运行。

服务固定环境：

```text
WorkingDirectory=/var/www/game/economy-api
PORT=3002
ECONOMY_DB_PATH=/var/lib/riversoft-economy/economy.sqlite
ACCOUNT_SERVICE_URL=http://127.0.0.1:3001
ACCOUNT_SERVICE_HOST=riversoft.top
ACCOUNT_AUTH_STATE_CACHE_TTL_MS=10000
ACCOUNT_AUTH_WRITE_CACHE_TTL_MS=2000
ACCOUNT_AUTH_NEGATIVE_CACHE_TTL_MS=1000
ACCOUNT_AUTH_CACHE_MAX_ENTRIES=5000
PUBLIC_ORIGIN=https://game.riversoft.top
```

## 10. 部署权限

当前 GitHub Actions：

```text
SERVER_USER=deploy
```

`deploy` 必须可写网页和 API 发布目录，并可通过部署白名单完成 systemd 和 Nginx 配置。不得通过让 API 以 root 运行、扩大 systemd 可写目录或把数据库移入发布目录规避权限。

## 11. Nginx

账号路由和游戏 API 路由职责分离：

```text
/etc/nginx/snippets/game-riversoft-economy-account.conf
/etc/nginx/snippets/game-riversoft-economy-game-api.conf
```

部署脚本必须识别已有 snippet、已有手工路由和旧托管块，只补缺失部分，不生成重复 `location`。

- 不得在账号 snippet 已存在时再次生成同名账号 `location`。
- 不得在游戏 API snippet 或手动游戏路由已存在时再次生成 `/economy-api/game/`。
- 连续执行两次，第二次不得产生配置变化。
- 游戏 API 路由的 `client_max_body_size` 固定为 `256k`，以容纳受控的管理员藏品 JSON；不得扩大为不受控的大文件上传。
- `/economy-api/game/` 对大于 1 KB 的 `application/json` 响应固定启用 gzip，使用 `gzip_vary on`、`gzip_proxied any`、`gzip_types application/json` 和压缩级别 5。部署脚本必须修补既有游戏 API snippet 或手工 `location`，不得只对新安装生效。

修改前保留可回滚配置；修改后必须执行 `nginx -t`，只有成功才 reload。失败时恢复旧配置并保持现网可用。

## 12. 构建与部署验收

`npm run build` 必须完成设计和架构防回退检查、状态交付容量防回退检查、Nginx 配置测试、服务器语法检查、服务器测试、TypeScript 和 Vite 生产构建。

部署后必须验证 API 健康、静态网页、账号代理、未登录游戏状态返回 401、systemd 使用正确端口／用户／数据库、数据库未被发布覆盖以及 Nginx 无重复路由。

## 13. 防回退

不得恢复：

- 浏览器 `localStorage` 作为正式钱包、库存、藏品归属或拍卖状态；
- 服务器持久化玩家展示日志；
- 单座工厂 API 作为当前模型；
- 固定价格工厂市场；
- 连续工作递增冷却；
- 依赖服务器预装全局 Node；
- API 监听公网地址；
- API 以 root 运行；
- 自动部署删除数据库或在 Nginx 失败后保留坏配置；
- 允许管理员上传图片二进制或任意远程 URL；
- 由客户端宣布拍卖成交或转移归属；
- 空闲 `GET state` 修改 `lastProcessedAt`、增加修订号或写回相同世界 JSON；
- 修订号未变化时重复返回完整状态，或动作响应遗漏最新修订号；
- 接受低于当前值或缺少修订号的迟到状态响应，导致新状态被旧轮询覆盖；
- 权威动作与后台轮询并行更新界面，或工作请求期间不显示“处理中”、不禁用按钮和不阻止重复提交；
- 每次状态轮询都重复请求主页 `/api/me`，或让普通写操作使用超过 2 秒、管理员使用任意时长的认证缓存；
- 在认证缓存中保存原始 Cookie、缓存账号服务错误、允许超过 5,000 条 LRU 上限，或遗漏同会话并发请求合并；
- 恢复默认 3 秒或每 1 秒完整状态轮询；
- 删除 `/economy-api/game/` 的 JSON gzip，或让部署脚本只为全新路由配置压缩而遗漏既有 snippet／手工路由；
- 让任何模块绕过 `domain.js` 直接导入 `domain-core.js`；
- 恢复食品独立人口需求、60 预算旧主食需求或按商品件数计算满足率。

未更新设计文档的架构回退不应合并。
