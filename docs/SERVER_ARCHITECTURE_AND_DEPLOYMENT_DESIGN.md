# Economy 服务器权威架构与部署设计

> 状态：当前技术架构与生产部署设计基线  
> 适用项目：`RIVERS0FT/Economy`  
> 生产网页：`https://game.riversoft.top/economy/`  
> 更新时间：2026-07-11

本文件记录 Economy 已落地的服务器权威架构、数据持久化边界、生产部署拓扑、Nginx 兼容规则和不可回退约束。

产品与玩法以项目专题设计为准；涉及资金、库存、工厂、订单、账号接入、服务进程、数据库、Nginx 和 GitHub Actions 部署时，以本文件为技术实现基线。用户活动日志的详细规则以 `docs/LOCAL_ACTIVITY_LOG_DESIGN.md` 为准。

任何改变本文件所列路径、端口、权限、路由或权威边界的修改，都必须同步更新设计文档、自动化测试和部署验证。

## 1. 设计目标

- 所有正式经济状态由服务器保存和判定。
- 浏览器刷新、多标签页、本地时间修改和本地存储修改不能改变正式资产。
- 用户可见活动日志只保存在当前浏览器，不上传服务器，也不参与经济计算。
- 账号继续复用主页账号服务，不在 Economy 内建立第二套账号体系。
- 游戏 API 只监听本机回环地址，通过 `game.riversoft.top` 的 HTTPS Nginx 入口对外提供。
- 部署脚本必须可重复执行，不得生成重复 Nginx `location`。
- 生产部署失败时必须保留旧的可用 Nginx 配置。
- 首发环境继续满足 2 核 2G 服务器约束。

## 2. 生产拓扑

```text
浏览器
  |
  | HTTPS https://game.riversoft.top
  v
Nginx
  |-- /economy/                         -> /var/www/game/economy 静态网页
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

### 2.1 账号服务

- 主页账号服务监听 `127.0.0.1:3001`。
- Economy 通过 `/economy-api/login`、`/economy-api/me` 和 `/economy-api/logout` 复用主页账号会话。
- 反向代理到账号服务时，主机语义保持为 `riversoft.top`。
- Economy 游戏服务通过 `ACCOUNT_SERVICE_URL=http://127.0.0.1:3001` 验证当前登录用户。
- 不得在 Economy 项目中复制用户密码、另建登录表或绕过主页账号验证。

### 2.2 游戏 API

- 服务名称固定为 `riversoft-economy-api.service`。
- 服务只监听 `127.0.0.1:3002`，不得直接监听公网地址。
- 对外路由前缀固定为 `/economy-api/game/`。
- Nginx 将该前缀映射到内部 `/api/game/`。
- 未登录访问游戏状态接口返回 `401` 和登录提示属于正常结果。

### 2.3 数据持久化

- 数据库使用 Node 内置 `node:sqlite`。
- 正式数据库路径固定为 `/var/lib/riversoft-economy/economy.sqlite`。
- SQLite 使用 WAL，并由服务端事务保护资产修改。
- `/var/lib/riversoft-economy` 只允许服务用户写入。
- 部署网页和 API 程序文件时不得删除或覆盖正式数据库。

## 3. 服务器权威边界

服务器必须负责并持久化：

- 可用资金与冻结资金；
- 各商品可用库存与冻结库存；
- 仓库容量；
- 工厂产权、施工、生产计划、运行和挂牌状态；
- 工作收益、冷却和连续工作递增冷却；
- 商品买卖订单、撮合、部分成交和撤单后的当前状态；
- 工厂挂牌和即时产权交割；
- 商品参考价、价格历史、经济统计、总资产和排行榜；
- 幂等请求结果。

服务器不得持久化以下玩家活动日志：

```text
trades
ledger
assetEvents
```

`server/src/storage.js` 在读取旧世界状态和每次写入 SQLite 前调用日志清理逻辑。旧日志只作为历史展示数据被删除，不得影响资金、库存、工厂、订单、挂牌或市场状态。

客户端负责：

- 页面展示和用户输入；
- 倒计时和进度视觉；
- 图表、盘口、搜索、筛选和排序；
- 比较连续两次权威状态，并在 `localStorage` 中生成当前浏览器的本地活动记录；
- 不改变正式状态的收益预测和方案分析。

以下行为禁止：

- 不得使用浏览器 `localStorage` 作为正式钱包、库存、工厂、生产计划或订单来源。
- 不得让客户端直接决定资产变化、冷却完成、撮合或产权交割。
- 不得把旧客户端本地状态自动导入正式服务器资产。
- 不得把本地日志上传并反向修改正式状态。
- 不得恢复已移除的客户端 `gameStore` 权威经济状态。

## 4. 本地日志边界

浏览器本地记录包括：

- 资金和冻结资金变化；
- 商品可用与冻结库存变化；
- 工厂建设、收购、出售、挂牌和状态变化；
- 生产费用、原料和产成品变化；
- 下单、撤单和成交记录。

本地日志：

- 按用户 ID 隔离；
- 可以被玩家清除；
- 更换设备、浏览器或清除网站数据后允许丢失；
- 不参与总资产、排名、订单校验、生产结算或任何服务器判断；
- 读写失败不得阻断游戏操作。

API `EconomyState` 使用客户端版本 `version: 7`，不得包含 `trades`、`ledger` 或 `assetEvents` 数组。

## 5. 游戏 API 修改规则

- 所有资产修改必须在数据库事务内完成。
- 资金、库存、冻结资产和产权不得出现负数或重复交割。
- 写请求使用幂等键，重复请求不得重复发放收益、扣款或成交。
- 工厂购买必须原子完成买家扣款、卖家收款和产权转移。
- 商品成交必须原子更新买卖双方资产和订单剩余量。
- 状态接口只返回当前权威状态，不返回玩家历史日志。
- 排行榜和公开统计可以延迟刷新，但资产正确性不得降级。

## 6. 程序目录与运行时

生产路径固定为：

```text
/var/www/game/economy/       # 构建后的网页静态文件
/var/www/game/economy-api/   # 服务端程序和随部署携带的 Node 运行时
/var/lib/riversoft-economy/  # SQLite 正式状态目录
```

Node 运行时规则：

- GitHub Actions 使用 Node 24 构建和测试。
- 部署工作流根据服务器架构下载与 Actions 一致的官方 Linux Node 运行时。
- 运行时上传到 `/var/www/game/economy-api/runtime/`。
- systemd 优先使用 `/var/www/game/economy-api/runtime/bin/node`。
- 仅在随包运行时不存在时才允许回退到服务器全局 Node。
- Node 必须支持 `node:sqlite`，最低版本不得低于 `22.16.0`。
- 不得重新把“服务器预装全局 Node”设为部署成功的必要条件。

## 7. systemd 服务基线

`riversoft-economy-api.service` 必须保持：

- `User` 和 `Group` 使用部署指定的服务账号，当前生产账号为 `deploy`；
- `WorkingDirectory=/var/www/game/economy-api`；
- `PORT=3002`；
- `ECONOMY_DB_PATH=/var/lib/riversoft-economy/economy.sqlite`；
- `ACCOUNT_SERVICE_URL=http://127.0.0.1:3001`；
- `ACCOUNT_SERVICE_HOST=riversoft.top`；
- `PUBLIC_ORIGIN=https://game.riversoft.top`；
- 服务启用自动重启；
- 保留 `NoNewPrivileges`、`ProtectSystem`、`ProtectHome` 和受限写目录。

不得让服务以 root 身份运行，也不得扩大服务可写目录来规避权限问题。

## 8. 部署账号与权限

GitHub Actions 当前生产 Secret：

```text
SERVER_USER=deploy
```

当前 `deploy` 必须：

- 可通过 SSH 密钥登录；
- 可写 `/var/www/game/economy`；
- 可写 `/var/www/game/economy-api`；
- 可免密执行 `/usr/bin/true`、`/usr/bin/install` 和 `/usr/bin/python3`；
- 服务器提供 `python3`、`curl`、`rsync`、Nginx 和 systemd。

缺少权限时必须输出明确错误：

- `ECONOMY_DEPLOY_PRIVILEGES_UNAVAILABLE`
- `ECONOMY_WEB_DIRECTORY_NOT_WRITABLE`
- `ECONOMY_API_DIRECTORY_NOT_WRITABLE`
- `ECONOMY_REMOTE_PYTHON_MISSING`
- `ECONOMY_REMOTE_CURL_MISSING`

不得恢复成无上下文的 `sudo -n` 失败。

## 9. Nginx 路由设计

目标配置必须是 `game.riversoft.top` 的 HTTPS `server` 块，并同时包含 `server_name game.riversoft.top` 与 443 监听。

生产服务器使用两个独立 snippet：

```text
/etc/nginx/snippets/game-riversoft-economy-account.conf
/etc/nginx/snippets/game-riversoft-economy-game-api.conf
```

职责分离：

- 账号 snippet 只负责 `/economy-api/login`、`/economy-api/me`、`/economy-api/logout`；
- 游戏 API snippet 或托管块只负责 `/economy-api/game/`；
- 不得在账号 snippet 已存在时再次生成同名账号 `location`；
- 不得在游戏 API snippet 或手动游戏路由已存在时再次生成 `/economy-api/game/`。

### 9.1 自动配置决策矩阵

| 现有配置 | 脚本行为 |
|---|---|
| 账号与游戏 API snippet 都存在 | 不修改，只执行 `nginx -t` 与 reload |
| 只有账号 snippet | 只补充游戏 API 路由 |
| 只有游戏 API snippet | 只补充账号路由 |
| 两者都不存在 | 生成账号路由和游戏路由 |
| 已有三个账号 `location` | 不重复账号路由，只补游戏路由 |
| 已有手动 `/economy-api/game/` | 不重复游戏路由，只补账号路由 |
| 已有旧完整托管块 | 移除旧块后只生成缺失部分 |
| 已有旧宽泛 `/economy-api/` | 移除宽泛路由，改为明确路由 |

### 9.2 幂等与回滚

- `scripts/configure-economy-nginx.py` 必须幂等；连续执行两次，第二次不得产生配置变化。
- 写入前备份目标站点为 `.economy-proxy.bak`；
- 写入后执行 `nginx -t`；
- 测试失败时立即恢复备份并再次检查；
- 只有语法成功后才能 reload；
- 不得无条件字符串追加 `location`。

## 10. GitHub Actions 部署顺序

1. 检出代码并配置 Node；
2. 安装依赖；
3. 执行架构检查、API 语法和测试、Nginx 测试、TypeScript 与 Vite 构建；
4. 配置 SSH；
5. 准备并验证远程目录权限；
6. 准备便携 Node 运行时；
7. rsync 网页、服务端和运行时；
8. 安装并启动 `riversoft-economy-api.service`；
9. 配置 Nginx 路由；
10. 验证网页、账号路由和游戏 API。

不得在目录权限检查失败时继续上传，也不得在 Nginx 配置失败时把部署标记为成功。

## 11. 自动化测试契约

`npm run build` 必须覆盖：

- 服务器权威状态与浏览器本地日志边界；
- SQLite 世界 JSON 不包含玩家日志；
- API 状态不包含玩家日志；
- 旧服务器日志清理；
- 幂等和事务；
- 无现有 Nginx 路由时生成完整代理；
- 账号 snippet 存在时只添加游戏 API；
- 两个 snippet 都存在时保持不变；
- 旧托管块和宽泛路由迁移；
- 连续执行配置保持幂等；
- 本文件路径、端口和服务名与脚本一致。

不得删除测试来绕过失败。

## 12. 生产验收标准

服务器本地：

```text
systemctl is-active riversoft-economy-api.service -> active
curl http://127.0.0.1:3002/api/game/state       -> 401（未登录时）
nginx -t                                        -> success
```

公网：

```text
https://game.riversoft.top/economy/              -> 200
https://game.riversoft.top/economy-api/me         -> 200 或 401
https://game.riversoft.top/economy-api/game/state -> 401（未登录时）
```

登录后还必须验证：

- 状态接口返回服务器权威资产且不包含日志数组；
- 工作、建造、生产、订单、挂牌和排行榜均调用服务器 API；
- 市场和资金页的历史记录来自当前浏览器本地存储；
- 刷新和多标签页正式状态一致；
- 修改本地存储不能改变正式资产。

## 13. 不可回退清单

除非先修改设计并完成迁移评审，否则不得：

- 把经济状态迁回客户端；
- 把玩家日志重新写入服务器数据库；
- 把 `trades`、`ledger` 或 `assetEvents` 加回 `EconomyState`；
- 让端口 3002 直接暴露公网；
- 将游戏 API 合并进账号服务并破坏账号边界；
- 重复生成 Nginx 路由；
- 删除 Nginx 幂等检查、备份或失败回滚；
- 依赖服务器预装全局 Node；
- 把数据库放入 rsync `--delete` 的发布目录；
- 让 API 服务以 root 身份运行；
- 放宽 systemd 文件系统保护；
- 跳过事务、幂等键或服务端资产校验；
- 让本地日志参与资金、库存、产权、订单或排名计算。

## 14. 修改流程

涉及本架构的 PR 必须：

1. 说明改变的设计约束和原因；
2. 更新本文件和相关专题设计；
3. 更新或新增自动化测试；
4. 通过完整 `npm run build`；
5. 对生产部署变更提供回滚方式；
6. 合并后验证 systemd、Nginx、本地 API 和公网入口。

未更新设计文档的架构回退不应合并。

## 统一资产订单簿与玩家系统（2026-07-12）

- 商品和工厂共用同一限价订单簿，不再使用工厂固定价格挂牌或商品／工厂二级切换。
- 商品与工厂估值使用最高非本人有效买入价，服务器统一计算总资产和排行榜。
- 运行中工厂允许进入卖单，冻结数量立即减少当前参与数量和周期产量。
- 工作冷却固定为 10 秒，连续工作不再提高冷却。
- 玩家资料统计固定为点击工作次数、生产商品总数、买入商品总数、卖出商品总数。
- 状态栏固定显示可用资金、总资产、排行榜和仓库剩余。
- 设置页玩家资料卡包含统计、退出和重置；侧栏退出按钮保留；设置页增加礼品兑换。
- 管理员页面固定为 /economy/admin。
- 详细规则以 docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md 和 docs/GIFT_CODE_AND_ADMIN_DESIGN.md 为准。
