from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:180]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


def regex_once(path: str, pattern: str, replacement: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE | re.DOTALL)
    if count != 1:
        raise SystemExit(f'{path}: expected one regex match, found {count}: {pattern[:180]!r}')
    file.write_text(updated, encoding='utf-8')


workflow = '.github/workflows/deploy.yml'
replace_once(
    workflow,
    '      - name: Back up production database before world 18 migration',
    '      - name: Prune backups and back up production database before world 18 migration',
)

backup_block = '''          import datetime
          import json
          import os
          import re
          import shutil
          import sqlite3
          from pathlib import Path

          database = Path('/var/lib/riversoft-economy/economy.sqlite')
          target_world_version = 18
          MAX_BACKUP_FAMILIES = 5
          MIN_BACKUP_HEADROOM_BYTES = 512 * 1024 * 1024
          timestamp_pattern = re.compile(
              r'^(?P<family>economy-pre-.+)-\\d{8}T\\d{6}Z\\.sqlite$'
          )

          def snapshot_key(path):
              stat = path.stat()
              return (stat.st_mtime_ns, path.name)

          def backup_family(path):
              match = timestamp_pattern.match(path.name)
              return match.group('family') if match else path.stem

          def prune_backups():
              backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
              snapshots = sorted(
                  backup_dir.glob('economy-pre-*.sqlite'),
                  key=snapshot_key,
                  reverse=True,
              )
              latest_by_family = {}
              for snapshot in snapshots:
                  latest_by_family.setdefault(backup_family(snapshot), snapshot)
              representatives = sorted(
                  latest_by_family.values(),
                  key=snapshot_key,
                  reverse=True,
              )
              keep = set(representatives[:MAX_BACKUP_FAMILIES])
              removed_count = 0
              removed_bytes = 0
              for snapshot in snapshots:
                  if snapshot in keep:
                      continue
                  removed_bytes += snapshot.stat().st_size
                  snapshot.unlink()
                  removed_count += 1
              print(
                  'ECONOMY_BACKUP_RETENTION='
                  f'families={len(keep)} removed={removed_count} removed_bytes={removed_bytes}'
              )

          if not database.exists():
              print(f'ECONOMY_WORLD_{target_world_version}_BACKUP_SKIPPED_NO_DATABASE')
              raise SystemExit(0)

          backup_dir = database.parent / 'backups'
          prune_backups()

          with sqlite3.connect(database) as source:
              current_version = 0
              try:
                  row = source.execute(
                      "SELECT state_json FROM economy_world WHERE id = 1"
                  ).fetchone()
              except sqlite3.OperationalError as error:
                  if 'no such table' not in str(error).lower():
                      raise
                  row = None
              if row:
                  current_version = int(json.loads(row[0]).get('version') or 0)
              if current_version >= target_world_version:
                  print(f'ECONOMY_WORLD_{target_world_version}_BACKUP_SKIPPED_CURRENT_VERSION={current_version}')
                  raise SystemExit(0)

              available_bytes = shutil.disk_usage(database.parent).free
              required_bytes = database.stat().st_size + MIN_BACKUP_HEADROOM_BYTES
              if available_bytes < required_bytes:
                  raise RuntimeError(
                      'ECONOMY_BACKUP_INSUFFICIENT_DISK '
                      f'available_bytes={available_bytes} required_bytes={required_bytes}'
                  )

              timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
              backup_path = backup_dir / f'economy-pre-world-v{target_world_version}-{timestamp}.sqlite'
              with sqlite3.connect(backup_path) as destination:
                  source.backup(destination)
                  quick_check = destination.execute('PRAGMA quick_check').fetchone()[0]
                  if quick_check != 'ok':
                      raise RuntimeError(f'backup quick check failed: {quick_check}')
              os.chmod(backup_path, 0o600)
              print(f'ECONOMY_WORLD_{target_world_version}_BACKUP_CREATED={backup_path}')

          prune_backups()
          PYTHON'''

regex_once(
    workflow,
    r'^          import datetime\n.*?^          PYTHON$',
    backup_block,
)

replace_once(
    workflow,
    "          command -v curl >/dev/null || { echo ECONOMY_REMOTE_CURL_MISSING >&2; exit 1; }\n          REMOTE",
    "          command -v curl >/dev/null || { echo ECONOMY_REMOTE_CURL_MISSING >&2; exit 1; }\n\n          minimum_free_kb=$((1024 * 1024))\n          available_kb=\"$(df -Pk /var/www/game | awk 'NR == 2 { print $4 }')\"\n          case \"$available_kb\" in\n            ''|*[!0-9]*) echo ECONOMY_DEPLOY_DISK_CHECK_INVALID >&2; exit 1 ;;\n          esac\n          if [ \"$available_kb\" -lt \"$minimum_free_kb\" ]; then\n            echo \"ECONOMY_DEPLOY_INSUFFICIENT_DISK available_kb=$available_kb required_kb=$minimum_free_kb\" >&2\n            exit 1\n          fi\n          echo \"ECONOMY_DEPLOY_AVAILABLE_KB=$available_kb\"\n          REMOTE",
)

workflow_text = Path(workflow).read_text(encoding='utf-8')
delete_count = workflow_text.count('rsync -az --delete -e')
if delete_count != 3:
    raise SystemExit(f'{workflow}: expected 3 rsync --delete matches, found {delete_count}')
Path(workflow).write_text(
    workflow_text.replace('rsync -az --delete -e', 'rsync -az --delete-before -e'),
    encoding='utf-8',
)

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
