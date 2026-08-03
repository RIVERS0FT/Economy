import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', 'dist', 'playwright-report', 'test-results']);
const allowedExtensions = new Set(['.md', '.mjs', '.ts', '.tsx']);
const replacements = [
  ['概览｜市场｜生产｜拍卖｜合同｜银行｜排行｜商店｜设置', '概览｜市场｜生产｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置'],
  ['玩家导航固定为九项', '玩家导航固定为十项'],
  ['九页导航', '十页导航'],
  ['九个正式页面', '十个正式页面'],
  ['九个游戏页面', '十个游戏页面'],
  ['九个页面按需拆包', '十个页面按需拆包'],
  ['九个导航按钮', '十个导航按钮'],
  ['概览、资产、商店和设置暂不显示但必须保留统一映射能力。', '概览、研发、银行、商店和设置暂不显示但必须保留统一映射能力。'],
];

function extension(path) {
  const index = path.lastIndexOf('.');
  return index >= 0 ? path.slice(index) : '';
}

function collect(directory, result = []) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) collect(path, result);
    else if (allowedExtensions.has(extension(path))) result.push(path);
  }
  return result;
}

let changedFiles = 0;
for (const path of collect(root)) {
  let content = readFileSync(path, 'utf8');
  const before = content;
  for (const [from, to] of replacements) content = content.split(from).join(to);

  if (path.endsWith('docs/README.md')) {
    for (const rule of [55, 61, 62, 63, 64, 65]) {
      content = content.replace(`\n${rule}. `, `\n\n${rule}. `);
    }
  }

  if (content !== before) {
    writeFileSync(path, content, 'utf8');
    changedFiles += 1;
  }
}

for (const [path, required] of [
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '玩家导航固定为十项'],
  ['docs/UI_DESIGN_SYSTEM.md', '概览｜市场｜生产｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置'],
  ['scripts/verify-page-content.mjs', '概览｜市场｜生产｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置'],
  ['scripts/verify-banking.mjs', '玩家导航固定为十项'],
]) {
  const content = readFileSync(resolve(root, path), 'utf8');
  if (!content.includes(required)) throw new Error(`${path} 未更新到十页基线：${required}`);
}

const self = resolve(root, 'scripts/apply-research-followup.mjs');
if (existsSync(self)) rmSync(self);
console.log(`已统一十页导航基线，修改 ${changedFiles} 个文件并删除一次性补丁。`);
