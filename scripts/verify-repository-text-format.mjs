import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const attributesPath = resolve(root, '.gitattributes');
const ignorePath = resolve(root, '.gitignore');
const failures = [];

const requiredAttributeLines = [
  '* text=auto eol=lf',
  '*.png binary',
  '*.jpg binary',
  '*.jpeg binary',
  '*.gif binary',
  '*.webp binary',
  '*.ico binary',
  '*.woff binary',
  '*.woff2 binary',
  '*.ttf binary',
  '*.otf binary',
  '*.pdf binary',
  '*.zip binary',
  '*.gz binary',
  '*.sqlite binary',
  '*.db binary',
];

const generatedArtifactPrefixes = [
  'test-results/',
  'playwright-report/',
  'blob-report/',
  'coverage/',
  '.nyc_output/',
  'src/dev/generated/',
];

let attributes = '';
try {
  attributes = readFileSync(attributesPath, 'utf8');
} catch {
  failures.push('仓库根目录缺少 .gitattributes');
}

const attributeLines = new Set(
  attributes
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
);

for (const line of requiredAttributeLines) {
  if (!attributeLines.has(line)) failures.push(`.gitattributes 缺少规则: ${line}`);
}

let ignoreRules = '';
try {
  ignoreRules = readFileSync(ignorePath, 'utf8');
} catch {
  failures.push('仓库根目录缺少 .gitignore');
}

const ignoreLines = new Set(
  ignoreRules
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
);

for (const prefix of generatedArtifactPrefixes) {
  if (!ignoreLines.has(prefix)) failures.push(`.gitignore 缺少测试产物规则: ${prefix}`);
}

const listedFiles = spawnSync('git', ['ls-files', '--eol', '-z'], {
  cwd: root,
  encoding: 'utf8',
});

if (listedFiles.error || listedFiles.status !== 0) {
  failures.push(`无法读取 Git 行尾状态: ${listedFiles.error?.message ?? listedFiles.stderr.trim()}`);
} else {
  for (const record of listedFiles.stdout.split('\0').filter(Boolean)) {
    const match = record.match(/^i\/(\S+)\s+w\/(\S*)\s+attr\/(.*?)\t(.*)$/u);
    if (!match) {
      failures.push(`无法解析 Git 行尾状态: ${record}`);
      continue;
    }

    const [, indexEol, worktreeEol, fileAttributes, path] = match;
    const generatedArtifactPrefix = generatedArtifactPrefixes.find((prefix) => path.startsWith(prefix));
    if (generatedArtifactPrefix) {
      failures.push(`${path} 是可再生成测试产物，不应被 Git 跟踪（规则: ${generatedArtifactPrefix}）`);
    }

    if (!worktreeEol && !existsSync(resolve(root, path))) continue;
    if (fileAttributes.includes('-text')) continue;

    if (!fileAttributes.includes('eol=lf')) {
      failures.push(`${path} 未应用 LF 属性: ${fileAttributes || '(none)'}`);
    }
    if (indexEol !== 'lf') failures.push(`${path} 的仓库行尾不是 LF: ${indexEol}`);
    if (worktreeEol !== 'lf') failures.push(`${path} 的工作区行尾不是 LF: ${worktreeEol}`);
  }
}

if (failures.length > 0) {
  console.error('仓库格式与清洁度验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('仓库格式与清洁度验证通过：文本文件使用 LF，二进制资源不参与转换，可再生成测试产物未被跟踪。');
