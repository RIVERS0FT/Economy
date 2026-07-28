import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const files = {
  workflow: '.github/workflows/deploy.yml',
  design: 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
};

for (const path of Object.values(files)) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

if (failures.length === 0) {
  for (const text of [
    'MAX_BACKUP_FAMILIES = 5',
    "backup_dir.glob('economy-pre-*.sqlite')",
    'def prune_backups():',
    'prune_backups()',
    'shutil.disk_usage(database.parent).free',
    'database.stat().st_size + 512 * 1024 * 1024',
    'minimum_free_kb=$((1024 * 1024))',
    'ECONOMY_DEPLOY_INSUFFICIENT_DISK',
    'ECONOMY_DEPLOY_AVAILABLE_KB=',
  ]) requireText(files.workflow, text);

  const workflow = read(files.workflow);
  const deleteBeforeCount = (workflow.match(/rsync -az --delete-before/g) ?? []).length;
  if (deleteBeforeCount !== 3) {
    failures.push(`部署工作流必须有 3 次 rsync --delete-before，当前为 ${deleteBeforeCount}`);
  }

  for (const text of [
    "glob(f'economy-pre-world-v{target_world_version}-*.sqlite')",
    'for stale in backups[10:]',
  ]) forbidText(files.workflow, text);

  for (const text of [
    '每个迁移族只保留最新一份完整 SQLite 快照',
    '最多保留最近 5 个迁移族',
    '先执行全局备份清理，再判断是否需要创建当前迁移备份',
    '不得删除正式数据库、注册 HMAC 秘密或运行中的权威状态',
    '上传前可用空间不得低于 1 GiB',
    '`rsync --delete-before`',
  ]) requireText(files.design, text);
}

if (failures.length > 0) {
  console.error('部署磁盘容量、备份保留与上传峰值防回退验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('部署全局备份保留、空间预检、生产数据保护与低峰值 rsync 验证通过。');
