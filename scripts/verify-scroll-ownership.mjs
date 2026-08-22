import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
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

const productionStyles = read('src/styles/production-surface.css');
const productionBlocks = productionStyles
  .split('.production-workspace > .production-build-card {')
  .slice(1)
  .map((part) => part.slice(0, part.indexOf('}')));
assert.ok(productionBlocks.length > 0, 'src/styles/production-surface.css 缺少生产建设卡最终布局规则');
assert.ok(
  productionStyles.includes('.production-workspace > .production-build-card,\n  .production-workspace > .facility-cluster-detail-shell {\n    position: static;'),
  '建筑账本建设卡与详情必须回到页面主滚动流',
);
const activeDesktopProduction = productionStyles.match(
  /@media \(min-width: 961px\)\s*\{([\s\S]*?)\n\}\n\n@media \(max-width: 720px\)/,
)?.[1] ?? '';
assert.equal(activeDesktopProduction.includes('overflow-y: auto;'), false, '建筑账本不得恢复建设卡独立纵向滚动');
assert.equal(activeDesktopProduction.includes('overscroll-behavior-y:'), false, '建筑账本不再需要建设卡独立 overscroll 边界');

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

const strategicShellStyles = read('src/styles/strategic-game-shell.css');
const outlinerStyles = read('src/styles/strategic-outliner.css');
const strategicContainMatches = strategicShellStyles.match(/overscroll-behavior\s*:\s*contain\s*;/g) ?? [];
assert.equal(strategicContainMatches.length, 1, '战略外壳只允许既有 Outliner 滚动区出现一次 contain shorthand');
assert.ok(
  strategicShellStyles.includes('.strategic-outliner__scroll {')
    && strategicShellStyles.includes('overscroll-behavior: contain;'),
  'contain shorthand 只能属于 Strategic Outliner 内部滚动区',
);
for (const text of [
  '.strategic-outliner__scroll {',
  'overscroll-behavior-x: contain;',
  'overscroll-behavior-y: auto;',
]) assert.ok(outlinerStyles.includes(text), `Strategic Outliner 必须释放纵向滚动边界: ${text}`);
const main = read('src/main.tsx');
assert.ok(
  main.indexOf("import './styles/strategic-game-shell.css';")
    < main.indexOf("import './styles/strategic-outliner.css';"),
  'Strategic Outliner 轴向 overscroll 修正规则必须在战略外壳样式之后加载',
);

for (const path of walk('src/styles').filter((item) => item.endsWith('.css'))) {
  if (path === 'src/styles/strategic-game-shell.css') continue;
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
  '建筑页桌面“建设新工厂”卡',
  '管理员后台整页滚动区',
]) assert.ok(design.includes(text), `UI 设计文档缺少滚轮规则或控件位置: ${text}`);

const productionDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');
for (const text of [
  '建设卡与详情外壳不再使用建筑页场景 sticky',
  '页面唯一纵向滚动视口继续由 `PageLayout` 的页面滚动区负责',
  '不得恢复建设卡自己的纵向滚动条',
]) assert.ok(productionDesign.includes(text), `建筑账本滚动设计缺少: ${text}`);

const shellDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
for (const text of [
  '`SignedInShell`',
  '不得为管理员创建第二个原生主滚动容器',
]) assert.ok(shellDesign.includes(text), `共享外壳设计缺少管理员滚动所有权规则: ${text}`);

console.log('Nested custom/native scroll ownership, shared signed-in page scroll, Strategic Outliner vertical boundary release, building-ledger page flow and boundary release verification passed.');
