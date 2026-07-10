# Economy 网站部署

> 当前目标地址：`https://game.riversoft.top/economy/`

## 部署结构

```text
公开地址：https://game.riversoft.top/economy/
服务器目录：/var/www/game/economy/
Vite base：/economy/
部署用户：deploy
```

Economy 不使用独立的 `economy.riversoft.top` 子域名，也不部署到主站 `riversoft.top/economy/`。

## 部署原则

GitHub Actions 使用无 sudo 部署：

1. 安装依赖并构建 Vite 网页。
2. 使用 SSH 私钥登录 `deploy` 用户。
3. 检查 `/var/www/game/economy/` 是否存在且可写。
4. 使用 rsync 更新该目录中的静态文件。
5. 验证服务器上的 Nginx `/economy/` 路由。

自动部署不会：

- 创建 `/var/www` 下的系统目录。
- 修改 `/etc/nginx`。
- 重载 Nginx。
- 安装或运行 Certbot。
- 获得任何免密 sudo 权限。

## 一次性服务器初始化

管理员需要在服务器上执行一次：

```bash
sudo install -d -m 0755 -o deploy -g deploy /var/www/game
sudo install -d -m 0755 -o deploy -g deploy /var/www/game/economy
```

确认部署用户可写：

```bash
sudo -u deploy test -w /var/www/game/economy
echo $?
```

输出 `0` 表示正常。

## Nginx 路由

将仓库文件：

```text
deploy/nginx/game.riversoft.top.economy-location.conf
```

安装为：

```text
/etc/nginx/snippets/game-riversoft-economy.conf
```

并在 `game.riversoft.top` 对应的 `server {}` 中加入：

```nginx
include /etc/nginx/snippets/game-riversoft-economy.conf;
```

然后检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

如果 `game.riversoft.top` 尚无 Nginx 站点配置，可以参考：

```text
deploy/nginx/game.riversoft.top.conf
```

## 自动部署

推送到 `main` 分支后，GitHub Actions 会：

1. 使用 Node.js 24 安装依赖。
2. 执行 `npm run build`。
3. 将 `dist/` 同步到 `/var/www/game/economy/`。
4. 检查服务器中存在 `index.html`。
5. 直接连接服务器 IP，并使用 `game.riversoft.top` Host 验证 `/economy/` 路由。

## GitHub Secrets

`RIVERS0FT/Economy` 仓库需要：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_PORT`
- `SERVER_SSH_KEY`

当前部署用户应设置为：

```text
SERVER_USER=deploy
```

服务器只保存公钥；私钥只保存在本地安全位置和 GitHub Actions Secret 中。

## DNS 与 HTTPS

`game.riversoft.top` 必须通过 A 记录或等效记录指向部署服务器。

HTTPS 证书和 Nginx TLS 配置由服务器管理员维护，不由 Economy 自动部署工作流修改。

## 验证记录

- 2026-07-10：四个 Actions Secrets 与 SSH 私钥认证验证成功。
- 2026-07-10：原工作流因远程 sudo 需要交互密码而失败。
- 2026-07-10：工作流改为无 sudo 静态发布。
- 当前阻塞：`/var/www/game/economy/` 尚未创建或尚未授予 `deploy` 写权限。

## 当前限制

当前仓库中的可构建网页仍是已有的 Economy 回合制原型。部署流程可以发布该网页，但它尚未实现设计文档中的多人服务器、工厂产权、统一订单簿和人口消费后端。
