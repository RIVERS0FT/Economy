# Economy 网站部署

> 当前目标地址：`https://game.riversoft.top/economy/`

## 部署结构

```text
公开地址：https://game.riversoft.top/economy/
服务器目录：/var/www/game/economy/
Vite base：/economy/
```

Economy 不使用独立的 `economy.riversoft.top` 子域名，也不部署到主站 `riversoft.top/economy/`。

## 自动部署

推送到 `main` 分支后，GitHub Actions 会：

1. 使用 Node.js 20 安装依赖。
2. 执行 `npm run build`。
3. 将 `dist/` 同步到 `/var/www/game/economy/`。
4. 将 Economy 的 `/economy/` 路由加入 `game.riversoft.top` 的 Nginx server 块。
5. 在需要时为 `game.riversoft.top` 申请 HTTPS 证书。
6. 验证 `https://game.riversoft.top/economy/` 或 HTTP 回退地址。

## GitHub Secrets

`RIVERS0FT/Economy` 仓库需要以下 Actions Secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_PORT`
- `SERVER_SSH_KEY`

这些值应与 `RIVERS0FT/RIVERSOFT_WEBSITE` 使用的服务器连接信息一致。

## DNS

`game.riversoft.top` 必须通过 A 记录或等效记录指向部署服务器。

如果域名尚未解析：

- 静态文件仍可能上传到服务器。
- Certbot 无法完成证书签发。
- 工作流的公开地址验证步骤会失败。

## Nginx 路由

Economy 只管理以下路径：

```text
/economy
/economy/
/economy/assets/*
```

部署脚本不会覆盖 `game.riversoft.top` 的其他游戏路径。

相关配置：

```text
deploy/nginx/game.riversoft.top.economy-location.conf
deploy/nginx/game.riversoft.top.conf
.github/workflows/deploy.yml
```

## 当前限制

当前仓库中的可构建网页仍是已有的 Economy 回合制原型。部署流程可以发布该网页，但它尚未实现设计文档中的多人服务器、工厂产权、统一订单簿和人口消费后端。
