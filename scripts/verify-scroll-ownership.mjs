import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const walk = (path) => readdirSync(resolve(root, path)).flatMap((entry) => {
  const relative = `${path}/${entry}`;
  return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
});

const hook = read('src/hooks/useOverlayScrollbar.ts');
for (const text of [
  'SCROLLABLE_OVERFLOW_VALUES',
  'function descendantCanScrollInDirection',
  "descendantCanScrollInDirection(event.target, viewport, 'x', delta)",
  "descendantCanScrollInDirection(event.target, viewport, 'y', event.deltaY)",
  'event.stopPropagation()',
]) assert.ok(hook.includes(text), `覆盖式滚动条缺少滚轮归属规则: ${text}`);

for (const [path, selector] of [
  ['src/styles/industry-system.css', '.production-build-card'],
  ['src/styles/unified-market-admin.css', '.admin-page-scroll'],
]) {
  const source = read(path);
  const blocks = source.split(`${selector} {`).slice(1).map((part) => part.slice(0, part.indexOf('}')));
  assert.ok(blocks.length > 0, `${path} 缺少 ${selector}`);
  assert.ok(
    blocks.some((block) => block.includes('overscroll-behavior-y: auto;')),
    `${path} 的 ${selector} 必须释放纵向边界`,
  );
}

for (const path of walk('src/styles').filter((item) => item.endsWith('.css'))) {
  assert.equal(
    /overscroll-behavior\s*:\s*contain\s*;/.test(read(path)),
    false,
    `${path} 不得使用同时吞掉纵向边界的 overscroll-behavior: contain`,
  );
}

const browser = read('tests/browser/scroll-ownership.spec.ts');
for (const text of [
  'the nearest custom ScrollArea owns the wheel until it reaches its boundary',
  'a native nested scrollport is not stolen by the parent ScrollArea',
  'the final boundary leaves the wheel event unconsumed',
  'defaultPrevented: false',
]) assert.ok(browser.includes(text), `滚轮归属浏览器测试缺少: ${text}`);

const design = read('docs/UI_DESIGN_SYSTEM.md');
for (const text of [
  '最近且仍能沿当前方向滚动的后代视口',
  '当前视口真正发生滚动时必须同时调用 `preventDefault()` 与 `stopPropagation()`',
  '生产页桌面“建设新工厂”卡',
  '管理员后台整页滚动区',
]) assert.ok(design.includes(text), `UI 设计文档缺少滚轮规则或控件位置: ${text}`);

console.log('Nested custom/native scroll ownership, boundary release and control location verification passed.');
