# Economy 服务器权威架构与部署设计

> 状态：当前服务器、API、容量和生产部署权威基线  
> 适用项目：`RIVERS0FT/Economy`  
> 生产网页：`https://game.riversoft.top/economy/`  
> 更新时间：2026-07-12  
> 客户端状态版本：10  
> 世界状态版本：6

## 1. 目标

- 所有正式经济状态由服务器保存和判定。
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
- 工厂集群、运行意图、三态、周期、计划和施工；
- 商品和工厂统一订单、冻结、撮合、逐笔成交和撤单；
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

客户端负责页面、倒计时、图表、筛选、排序、预测和本地日志，不得直接决定资产、冷却、周期、撮合、估值或排名。

## 4. 状态与存储

- 客户端 `EconomyState.version` 固定为 10。
- SQLite 世界版本固定为 6。
- 数据库使用 Node 内置 `node:sqlite`、WAL 和事务。
- 资产写操作使用 `BEGIN IMMEDIATE`。
- 单节点只运行一个游戏 API 进程。
- 旧世界加载时执行版本迁移和目录补齐。
- 正式数据库不得位于网页或 API 发布目录。
- 部署不得删除或覆盖数据库。

## 5. 请求安全

- 只接受正式站点的同源或可信 same-site 请求。
- 使用主页账号 Cookie 验证用户，不接受客户端自报用户 ID 或角色。
- 请求体上限 16 KB。
- 所有资产写操作要求 8～128 字符的 `Idempotency-Key`。
- 服务器重新校验价格、数量、余额、库存、仓库、工厂数量和订单归属。
- 禁止自成交。
- 每名玩家最多 10 笔未完成订单。
- 创建和撤销订单受服务器限流。
- 未登录返回 401，非管理员访问管理员 API 返回 403。

## 6. 当前游戏 API

公网前缀为 `/economy-api/game/`，内部前缀为 `/api/game/`。

| 方法 | 内部路径 | 用途 |
|---|---|---|
| GET | `/api/game/state` | 获取完整权威状态 |
| POST | `/api/game/work` | 工作 |
| POST | `/api/game/facilities` | 建设工厂 |
| POST | `/api/game/facilities/:facilityTypeId/start` | 开启工厂集群 |
| POST | `/api/game/facilities/:facilityTypeId/pause` | 关闭工厂集群，兼容 `stop` |
| POST | `/api/game/facilities/:facilityTypeId/plan` | 保存生产计划 |
| POST | `/api/game/orders` | 创建商品或工厂统一订单 |
| POST | `/api/game/orders/:orderId/cancel` | 撤销统一订单 |
| POST | `/api/game/warehouse/upgrade` | 扩容共享仓库 |
| POST | `/api/game/gifts/redeem` | 兑换礼品 |
| PATCH | `/api/game/profile` | 修改玩家昵称 |
| POST | `/api/game/reset` | 重置玩家经济状态 |

旧 `facility-listings` 与工厂 `list` 路由只允许作为迁移兼容入口，不得成为当前客户端业务入口，也不得在设计中恢复固定价格市场。

管理员 API：

- `GET /api/game/admin/summary`
- `GET /api/game/admin/gift-codes`
- `POST /api/game/admin/gift-codes`
- `POST /api/game/admin/gift-codes/:id/disable`
- `GET /api/game/admin/gift-codes/:id/redemptions`

## 7. 容量与优先级

首发设计目标：

- 最低稳定验收：50 名同时在线；
- 产品设计目标：100 名同时在线；
- 更高人数只作为压测观察，不是承诺。

优先级：

1. 登录、资产、冻结、生产结算、订单和成交；
2. 系统需求与公共市场；
3. 排行榜、长周期图表和公开统计。

资源不足时宁可拒绝新写操作，也不能允许负库存、重复发放、重复扣款或超额成交。

当前页面只展示 5+5 笔订单，不等于服务器只能保存 10 笔全服订单。公共行情和排行榜可以延迟刷新，玩家自己的操作结果必须立即返回明确成功或失败。

## 8. Node 与 systemd

- GitHub Actions 使用 Node 24 构建和测试。
- 部署包携带与 Actions 架构匹配的官方 Node 运行时。
- 运行时目录：`/var/www/game/economy-api/runtime/`。
- Node 最低不得低于 `22.16.0`，必须支持 `node:sqlite`。
- systemd 优先使用随包 Node，只在不存在时回退到系统 Node。

服务固定环境：

```text
WorkingDirectory=/var/www/game/economy-api
PORT=3002
ECONOMY_DB_PATH=/var/lib/riversoft-economy/economy.sqlite
ACCOUNT_SERVICE_URL=http://127.0.0.1:3001
ACCOUNT_SERVICE_HOST=riversoft.top
PUBLIC_ORIGIN=https://game.riversoft.top
```

服务不得以 root 运行。当前生产用户和组为 `deploy`，保留 `NoNewPrivileges`、`ProtectSystem`、`ProtectHome` 和受限写目录。

## 9. 部署权限

当前 GitHub Actions：

```text
SERVER_USER=deploy
```

`deploy` 必须：

- 可通过 SSH 密钥登录；
- 可写 `/var/www/game/economy`；
- 可写 `/var/www/game/economy-api`；
- 可免密执行部署白名单所需的 `/usr/bin/true`、`/usr/bin/install` 和 `/usr/bin/python3`；
- 可通过部署脚本完成 systemd 和 Nginx 配置；
- 服务器存在 `python3`、`curl`、`rsync`、Nginx 和 systemd。

错误必须使用明确标识：

```text
ECONOMY_DEPLOY_PRIVILEGES_UNAVAILABLE
ECONOMY_WEB_DIRECTORY_NOT_WRITABLE
ECONOMY_API_DIRECTORY_NOT_WRITABLE
ECONOMY_REMOTE_PYTHON_MISSING
ECONOMY_REMOTE_CURL_MISSING
```

不得通过让 API 以 root 运行、扩大 systemd 可写目录或把数据库移入发布目录规避权限。

## 10. Nginx

账号路由和游戏 API 路由职责分离：

```text
/etc/nginx/snippets/game-riversoft-economy-account.conf
/etc/nginx/snippets/game-riversoft-economy-game-api.conf
```

部署脚本必须识别已有 snippet、已有手工路由和旧托管块，只补缺失部分，不生成重复 `location`。

修改前保留可回滚配置；修改后必须执行 `nginx -t`，只有成功才 reload。失败时恢复旧配置并保持现网可用。

## 11. 构建与部署验收

`npm run build` 必须完成：

- 设计和架构防回退检查；
- Nginx 配置测试；
- 服务器语法检查；
- 服务器测试；
- TypeScript；
- Vite 生产构建。

部署后必须验证：

- API 健康；
- 静态网页；
- 账号代理；
- 未登录游戏状态返回 401；
- systemd 使用正确端口、用户和数据库；
- 数据库未被发布覆盖；
- Nginx 无重复路由。

## 12. 防回退

不得恢复：

- 浏览器 `localStorage` 作为正式钱包或库存；
- 服务器持久化玩家展示日志；
- 单座工厂 API 作为当前模型；
- 固定价格工厂市场；
- 连续工作递增冷却；
- 依赖服务器预装全局 Node；
- API 监听公网地址；
- API 以 root 运行；
- 自动部署删除数据库或在 Nginx 失败后保留坏配置。
