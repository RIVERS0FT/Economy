# Economy 服务器权威架构与部署设计

> 状态：当前技术架构与生产部署设计基线  
> 适用项目：`RIVERS0FT/Economy`  
> 生产网页：`https://game.riversoft.top/economy/`  
> 更新时间：2026-07-11

本文件记录 Economy 已经落地的服务器权威架构、生产部署拓扑、Nginx 路由兼容规则和不可回退约束。

产品与玩法仍以 `docs/WEB_MULTIPLAYER_GAME_DESIGN.md` 为最高产品设计基线；涉及资金、库存、设施、订单、成交、账号接入、服务进程、数据库、Nginx 和 GitHub Actions 部署时，以本文件为技术实现基线。

任何改变本文件所列路径、端口、权限、路由或权威边界的修改，都必须同时更新本文件、自动化测试和部署验证，不能只修改代码。

## 1. 设计目标

- 所有正式经济状态由服务器保存和判定。
- 浏览器刷新、多标签页、本地时间修改和本地存储修改不能改变正式资产。
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
- 可用库存与冻结库存；
- 设施产权、施工、生产、升级和挂牌状态；
- 工作收益、冷却和连续工作递增冷却；
- 商品买卖订单、撮合、部分成交和撤单；
- 设施挂牌和即时产权交割；
- 成交记录、资产流水和幂等请求结果；
- 商品参考价、设施估值、总资产和排行榜。

客户端只负责：

- 页面展示和用户输入；
- 倒计时的视觉显示；
- 图表、盘口可视化、搜索、筛选和排序；
- 不改变正式状态的收益预测和方案分析。

以下行为禁止回退：

- 不得重新使用浏览器 `localStorage` 作为正式钱包、库存、设施或订单来源。
- 不得让客户端直接决定资产变化、冷却完成、撮合或产权交割。
- 不得把旧客户端本地状态自动导入正式服务器资产；客户端数据不可信。
- 不得恢复已移除的客户端 `gameStore` 权威经济状态或旧 multiplayer 状态模块。

## 4. 游戏 API 修改规则

- 所有资产修改必须在数据库事务内完成。
- 资金、库存、冻结资产和产权不得出现负数或重复交割。
- 写请求使用幂等键，重复请求不得重复发放收益、扣款或成交。
- 设施购买必须原子完成买家扣款、卖家收款和产权转移。
- 商品成交必须原子更新买卖双方资产、订单剩余量、成交和流水。
- 排行榜和公开统计可以延迟刷新，但资产正确性不得降级。

## 5. 程序目录与运行时

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

## 6. systemd 服务基线

`riversoft-economy-api.service` 必须保持以下关键属性：

- `User` 和 `Group` 使用部署指定的服务账号，当前生产账号为 `deploy`。
- `WorkingDirectory=/var/www/game/economy-api`。
- `PORT=3002`。
- `ECONOMY_DB_PATH=/var/lib/riversoft-economy/economy.sqlite`。
- `ACCOUNT_SERVICE_URL=http://127.0.0.1:3001`。
- `ACCOUNT_SERVICE_HOST=riversoft.top`。
- `PUBLIC_ORIGIN=https://game.riversoft.top`。
- 服务启用自动重启。
- 保留 `NoNewPrivileges`、`ProtectSystem`、`ProtectHome` 和受限写目录。

不得为了简化部署而让服务以 root 身份运行，也不得扩大服务可写目录。

## 7. 部署账号与权限

GitHub Actions 当前生产 Secret 为：

```text
SERVER_USER=deploy
```

工作流支持两种远程账号：

1. `root`：直接执行系统级安装。
2. 普通用户：必须具备工作流所需的免密 sudo。

当前 `deploy` 必须满足：

- 可通过 SSH 密钥登录；
- 可写 `/var/www/game/economy`；
- 可写 `/var/www/game/economy-api`；
- 可免密执行 `/usr/bin/true`、`/usr/bin/install` 和 `/usr/bin/python3`；
- 服务器提供 `python3`、`curl`、`rsync`、Nginx 和 systemd。

目录所有权必须允许 `deploy` 完成 rsync。部署脚本需要以 root 权限安装 systemd 服务和修改 Nginx，因此该 SSH 密钥应视为高权限部署凭据，只用于 CI。

缺少权限时，工作流必须输出明确错误，例如：

- `ECONOMY_DEPLOY_PRIVILEGES_UNAVAILABLE`
- `ECONOMY_WEB_DIRECTORY_NOT_WRITABLE`
- `ECONOMY_API_DIRECTORY_NOT_WRITABLE`
- `ECONOMY_REMOTE_PYTHON_MISSING`
- `ECONOMY_REMOTE_CURL_MISSING`

不得恢复成无上下文的 `sudo -n` 失败。

## 8. Nginx 路由设计

目标配置必须是 `game.riversoft.top` 的 HTTPS `server` 块，并同时包含 `server_name game.riversoft.top` 与 443 监听。

生产服务器使用两个可独立存在的 snippet：

```text
/etc/nginx/snippets/game-riversoft-economy-account.conf
/etc/nginx/snippets/game-riversoft-economy-game-api.conf
```

职责必须分离：

- 账号 snippet 只负责 `/economy-api/login`、`/economy-api/me`、`/economy-api/logout`。
- 游戏 API snippet 或托管块只负责 `/economy-api/game/`。
- 不得在账号 snippet 已存在时再次生成同名账号 `location`。
- 不得在游戏 API snippet 或手动游戏路由已存在时再次生成 `/economy-api/game/`。

### 8.1 自动配置决策矩阵

| 现有配置 | 脚本行为 |
|---|---|
| 账号与游戏 API snippet 都存在 | 不修改配置，只执行 `nginx -t` 与 reload |
| 只有账号 snippet | 只补充游戏 API 路由 |
| 只有游戏 API snippet | 只补充账号路由 |
| 两者都不存在 | 生成账号路由和游戏 API 路由 |
| 已有三个账号 `location` | 不重复账号路由，只补缺失的游戏 API 路由 |
| 已有手动 `/economy-api/game/` | 不重复游戏路由，只补缺失的账号路由 |
| 已有旧版完整托管块 | 移除旧块后只生成缺失部分 |
| 已有旧版宽泛 `/economy-api/` | 移除宽泛路由，改为明确的账号与游戏路由 |

### 8.2 幂等与回滚

- `scripts/configure-economy-nginx.py` 必须幂等；连续执行两次，第二次不得产生配置变化。
- 写入前必须备份目标站点文件为 `.economy-proxy.bak`。
- 写入后必须执行 `nginx -t`。
- 测试失败时必须立即恢复备份，再次运行语法检查，并保持旧配置可用。
- 只有语法检查成功后才能 reload Nginx。
- 不得使用简单字符串追加方式无条件插入 `location`。

## 9. GitHub Actions 部署顺序

正式部署顺序固定为：

1. 检出代码并配置 Node。
2. 安装依赖。
3. 执行架构检查、游戏 API 语法检查、API 测试、Nginx 配置测试、TypeScript 和 Vite 构建。
4. 配置 SSH。
5. 准备并验证远程目录权限。
6. 准备便携 Node 运行时。
7. rsync 网页、服务端和运行时。
8. 安装并启动 `riversoft-economy-api.service`。
9. 配置 Nginx 路由。
10. 验证网页、账号路由和游戏 API。

不得在目录权限检查失败时继续上传，也不得在 Nginx 配置失败时把部署标记为成功。

## 10. 自动化测试契约

`npm run build` 必须包含 Nginx 配置回归测试。

测试至少覆盖：

- 无现有路由时生成完整代理；
- 账号 snippet 存在时只添加游戏 API；
- 账号和游戏 API snippet 都存在时保持不变；
- 旧托管块迁移后不重复账号路由；
- 手动游戏 API 路由不被重复；
- 旧版宽泛 `/economy-api/` 被替换；
- 所有生成结果再次执行保持不变；
- 本文件中的路径、端口和服务名与脚本常量一致。

修改 Nginx 脚本时禁止删除这些测试来绕过失败。

## 11. 生产验收标准

服务器本地：

```text
systemctl is-active riversoft-economy-api.service -> active
curl http://127.0.0.1:3002/api/game/state  -> 401（未登录时）
nginx -t                                      -> success
```

公网：

```text
https://game.riversoft.top/economy/                 -> 200
https://game.riversoft.top/economy-api/me            -> 200 或 401
https://game.riversoft.top/economy-api/game/state    -> 401（未登录时）
```

登录后还必须验证：

- 状态接口能够返回服务器资产；
- 工作、建造、生产、订单、成交、挂牌和排行榜均调用服务器 API；
- 刷新和多标签页状态一致；
- 浏览器本地存储修改不能改变正式资产。

## 12. 不可回退清单

除非先修改设计并完成迁移评审，否则不得：

- 把经济状态重新迁回客户端；
- 让端口 3002 直接暴露公网；
- 将游戏 API 合并进账号服务并破坏现有账号边界；
- 在账号 snippet 存在时重复生成账号路由；
- 删除 Nginx 幂等检查、备份或失败回滚；
- 依赖服务器预装全局 Node；
- 把数据库放入 rsync `--delete` 的发布目录；
- 让 API 服务以 root 身份运行；
- 放宽 systemd 文件系统保护以解决普通权限问题；
- 跳过事务、幂等键或服务端资产校验；
- 因资源不足而牺牲资金、库存、产权、订单或成交正确性。

## 13. 修改流程

涉及本架构的 PR 必须同时满足：

1. 在 PR 中说明要改变的设计约束和原因。
2. 更新本文件。
3. 更新或新增自动化测试。
4. 通过完整 `npm run build`。
5. 对生产部署变更提供回滚方式。
6. 合并后验证 systemd、Nginx、本地 API 和公网三个入口。

未更新设计文档的架构回退不应合并。