import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const testPath = resolve(root, 'tests/browser/game-shell-layout.spec.ts');
const source = readFileSync(testPath, 'utf8');
const from = 'await expect(buttons).toHaveCount(9);';
const to = 'await expect(buttons).toHaveCount(10);';

if (!source.includes(from)) {
  throw new Error(`缺少旧九页浏览器断言：${from}`);
}
if (source.includes(to)) {
  throw new Error(`十页浏览器断言已经存在：${to}`);
}

writeFileSync(testPath, source.replace(from, to), 'utf8');

const self = resolve(root, 'scripts/apply-research-browser-baseline.mjs');
if (existsSync(self)) rmSync(self);
console.log('已将桌面侧栏浏览器回归从九个导航更新为十个导航。');
