# Economy 部署权限规则

部署工作流支持两种远程 SSH 用户：

1. `root`：直接创建目录、安装 systemd 服务和修改 Nginx，不要求服务器安装 `sudo`。
2. 普通用户：必须具备免密 `sudo` 权限，才能完成上述系统级操作。

如果普通用户没有免密 `sudo`，工作流会输出 `ECONOMY_DEPLOY_PRIVILEGES_UNAVAILABLE`，而不是在不明确的 `sudo -n` 命令处中止。
