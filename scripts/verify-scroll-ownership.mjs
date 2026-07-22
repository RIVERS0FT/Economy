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

const productionStyles = read('src/styles/facility-group-card-grid.css');
const productionBlocks = productionStyles
  .split('.production-build-card {')
  .slice(1)
  .map((part) => part.slice(0, part.indexOf('}')));
assert.ok(productionBlocks.length > 0, 'src/styles/facility-group-card-grid.css 缺少 .production-build-card');
assert.ok(
  productionBlocks.some((block) => block.includes('overscroll-behavior-y: auto;')),
  '生产建设卡必须释放纵向边界',
);

const performanceStyles = read('src/styles/performance.css');
assert.ok(
  performanceStyles.includes('.page-scroll {\n  overscroll-behavior: auto;\n}'),
  '共享 .page-scroll 必须使用 overscroll-behavior: auto 释放纵向边界',
);

const sharedShell = read('src/components/shell/SignedInShell.tsx');
for (const text of [
  'className="page-scroll-area"',
  "'page-scroll'",
  'scrollbarVisibility="adaptive"',
]) assert.ok(sharedShell.includes(text), `共享登录后外壳缺少页面滚动接入: ${text}`);

const adminApp = read('src/app/AdminApp.tsx');
for (const text of [
  '<SignedInShell',
  'pageViewportClassName="admin-page-scroll"',
]) assert.ok(adminApp.includes(text), `管理员后台未接入共享页面滚动视口: ${text}`);

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

const shellDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
for (const text of [
  '`SignedInShell`',
  '不得为管理员创建第二个原生主滚动容器',
]) assert.ok(shellDesign.includes(text), `共享外壳设计缺少管理员滚动所有权规则: ${text}`);

console.log('Nested custom/native scroll ownership, shared signed-in page scroll, boundary release and control location verification passed.');
