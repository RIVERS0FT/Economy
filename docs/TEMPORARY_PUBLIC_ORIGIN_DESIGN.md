# Economy 临时公网入口与部署验收设计

状态：临时生效。

## 背景

`game.riversoft.top` 当前公网路径暂时不可访问，但生产服务器仍可通过 `123.60.108.5` 访问。该故障属于公网域名链路问题，不改变 Economy 的正式域名、Nginx 域名配置或应用路径设计。

## 临时规则

1. 玩家临时入口使用 `http://123.60.108.5/economy/`。
2. `.github/workflows/deploy.yml` 的外部公网验收统一以 `http://123.60.108.5` 为 origin，验证 `/economy/`、`/economy-api/me`、`/economy-api/game/state`、`/economy-api/login` 与 `/economy-api/registration/email-code`。
3. 服务器本机验收继续使用 `Host: game.riversoft.top` 检查正式 Nginx 域名路由；不得因为临时 IP 入口删除、改名或弱化 `game.riversoft.top` 配置。
4. 构建、浏览器测试、SSH 预检、数据库检查、服务安装、Nginx 检查、静态发布顺序均保持不变。本修改只替换部署后的公网可达性检查来源。
5. 公网域名恢复后，必须先独立验证 `https://game.riversoft.top/economy/` 以及账号、游戏、登录和注册 API 均可正常访问，再将 Deploy 外部验收来源切回域名；切回时删除本临时规则或明确标记失效，避免未来反复切换。

## 非目标

- 不把 `123.60.108.5` 设为 Economy 的长期正式域名。
- 不修改客户端 API 路径；客户端继续使用同源 `/economy-api/**`。
- 不修改服务端权威经济逻辑、幂等逻辑、数据库或存档格式。
