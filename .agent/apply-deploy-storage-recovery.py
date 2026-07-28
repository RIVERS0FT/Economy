from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:180]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    '- `main` 分支由 `.github/workflows/deploy.yml` 对实际待部署提交重新执行 `npm ci`、`npm run build`、固定 Chromium 安装和 `npm run test:browser`；构建与浏览器回归都成功后才允许上传、安装并执行线上验证。',
    '- `main` 分支由 `.github/workflows/deploy.yml` 对实际待部署提交重新执行 `npm ci`、`npm run build`、固定 Chromium 安装和 `npm run test:browser`；构建与浏览器回归都成功后才允许上传、安装并执行线上验证。\n- 正式 SQLite 迁移备份按文件名中的迁移族统一管理：每个迁移族只保留最新一份完整 SQLite 快照，最多保留最近 5 个迁移族。部署必须先执行全局备份清理，再判断是否需要创建当前迁移备份；版本已经满足目标时也不得跳过清理。不得删除正式数据库、注册 HMAC 秘密或运行中的权威状态。\n- 创建新迁移备份前，可用空间必须至少覆盖当前数据库完整大小再加 512 MiB 余量；上传前 `/var/www/game` 所在文件系统可用空间不得低于 1 GiB。空间不足必须在写入发布文件前明确失败。网站、API 和便携 Node 运行时三次同步统一使用 `rsync --delete-before`，先删除将被新发布完整替换的旧文件，降低发布峰值空间。',
)

replace_once(
    'package.json',
    'node scripts/verify-runtime-efficiency.mjs && node scripts/verify-runtime-reliability.mjs && node scripts/verify-mobile-facility-pull-refresh.mjs',
    'node scripts/verify-runtime-efficiency.mjs && node scripts/verify-runtime-reliability.mjs && node scripts/verify-deployment-storage.mjs && node scripts/verify-mobile-facility-pull-refresh.mjs',
)
