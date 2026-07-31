import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const serverSourceDirectory = resolve(root, 'server/src');
const sourceFiles = readdirSync(serverSourceDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => resolve(serverSourceDirectory, entry.name))
  .sort((left, right) => left.localeCompare(right));

if (sourceFiles.length === 0) {
  console.error('服务器语法检查失败：server/src 中没有 JavaScript 文件。');
  process.exit(1);
}

for (const sourceFile of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', sourceFile], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status ?? 1);
  }
}

console.log(`服务器语法检查通过，共检查 ${sourceFiles.length} 个文件。`);
