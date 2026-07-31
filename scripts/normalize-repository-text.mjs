import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const listedFiles = spawnSync('git', ['ls-files', '--eol', '-z'], {
  cwd: root,
  encoding: 'utf8',
});

if (listedFiles.error || listedFiles.status !== 0) {
  console.error(`无法读取 Git 行尾状态: ${listedFiles.error?.message ?? listedFiles.stderr.trim()}`);
  process.exit(1);
}

let normalizedCount = 0;

for (const record of listedFiles.stdout.split('\0').filter(Boolean)) {
  const match = record.match(/^i\/(\S+)\s+w\/(\S+)\s+attr\/(.*?)\t(.*)$/u);
  if (!match) {
    console.error(`无法解析 Git 行尾状态: ${record}`);
    process.exit(1);
  }

  const [, indexEol, , fileAttributes, path] = match;
  if (indexEol === '-text' || fileAttributes.includes('-text')) continue;

  const absolutePath = resolve(root, path);
  const source = readFileSync(absolutePath);
  const decoded = source.toString('utf8');
  if (!Buffer.from(decoded, 'utf8').equals(source)) {
    console.error(`拒绝转换非 UTF-8 文本文件: ${path}`);
    process.exit(1);
  }

  const normalized = Buffer.from(decoded.replace(/\r\n?/gu, '\n'), 'utf8');
  if (normalized.equals(source)) continue;

  writeFileSync(absolutePath, normalized);
  normalizedCount += 1;
}

console.log(`仓库文本换行规范化完成：${normalizedCount} 个已跟踪文本文件转换为 LF。`);
