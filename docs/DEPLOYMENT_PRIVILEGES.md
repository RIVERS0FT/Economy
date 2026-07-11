# Economy 部署权限规则

> 完整服务器架构、目录、端口、Nginx 兼容规则、验收标准和不可回退项见 `docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`。涉及部署的修改必须同时遵守并更新该设计文档。

部署工作流支持两种远程 SSH 用户：

1. `root`：直接创建目录、安装 systemd 服务和修改 Nginx，不要求服务器安装 `sudo`。
2. 普通用户：必须具备免密 `sudo` 权限，才能完成上述系统级操作。

当前生产环境使用：

```text
SERVER_USER=deploy
```

`deploy` 必须满足：

- 可写 `/var/www/game/economy`；
- 可写 `/var/www/game/economy-api`；
- 可免密执行 `/usr/bin/true`、`/usr/bin/install` 和 `/usr/bin/python3`；
- 服务器存在 `python3`、`curl`、`rsync`、Nginx 和 systemd。

如果普通用户没有免密 `sudo`，工作流会输出 `ECONOMY_DEPLOY_PRIVILEGES_UNAVAILABLE`，而不是在不明确的 `sudo -n` 命令处中止。

目录不可写时必须分别输出：

- `ECONOMY_WEB_DIRECTORY_NOT_WRITABLE`
- `ECONOMY_API_DIRECTORY_NOT_WRITABLE`

不得通过让游戏 API 以 root 身份运行、扩大 systemd 可写目录或把正式数据库放入发布目录来规避权限问题。