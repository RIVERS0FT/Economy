import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const viewport = read('src/styles/viewport.css');
assert.ok(
  viewport.includes('html[data-app-surface="game"],\nhtml[data-app-surface="admin"] {') &&
    viewport.includes('overscroll-behavior-y: none;'),
  '登录态游戏与管理员根视口必须终止纵向 overscroll',
);
assert.ok(
  viewport.includes('body {') && viewport.includes('overscroll-behavior-y: auto;'),
  '认证页与普通文档滚动必须保留纵向 overscroll 默认行为',
);

const bootstrap = read('src/app/interactionBootstrap.ts');
for (const text of [
  "import { configureMobileDetailSheetPullRefreshGuard } from '../utils/mobileDetailSheetPullRefresh';",
  'configureMobileDetailSheetPullRefreshGuard();',
]) assert.ok(bootstrap.includes(text), `交互 bootstrap 缺少共享移动详情保护: ${text}`);

const guard = read('src/utils/mobileDetailSheetPullRefresh.ts');
for (const text of [
  "const MOBILE_DETAIL_SHEET_SELECTOR = '.mobile-detail-sheet';",
  "'.mobile-detail-sheet-scroll, .page-card-scroll';",
  "'.mobile-detail-sheet-header, .mobile-detail-sheet-drag-handle, .page-fixed-header';",
  "type MobileDetailSheetGestureSource = 'header' | 'content' | 'surface';",
  "source: scrollViewport ? 'content' : isHeader ? 'header' : 'surface',",
  "session.source === 'content' && (session.scrollViewport?.scrollTop ?? 0) > 0",
  'session.anchorY = touch.clientY;',
  "sheet.addEventListener('touchstart', handleTouchStart, { passive: true });",
  "sheet.addEventListener('touchmove', handleTouchMove, { passive: false });",
  'if (event.cancelable) event.preventDefault();',
  'deltaY < Math.abs(deltaX) * MOBILE_DETAIL_SHEET_AXIS_DOMINANCE',
]) assert.ok(guard.includes(text), `共享移动 Workspace Sheet 保护缺少: ${text}`);
for (const forbidden of [
  'INTERACTIVE_TARGET_SELECTOR',
  'isInteractiveTarget',
  "document.addEventListener('touchmove'",
  "window.addEventListener('touchmove'",
  "document.body.addEventListener('touchmove'",
]) assert.equal(guard.includes(forbidden), false, `不得缩小或全局化触摸保护范围: ${forbidden}`);

const design = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
for (const text of [
  '登录态根视口的下拉刷新边界',
  '`html[data-app-surface="game"|"admin"]`',
  '`overscroll-behavior-y: none`',
  '`mobileDetailSheetPullRefresh.ts`',
  '非被动 `touchmove`',
  '内部滚动区继续保持 `overscroll-behavior-y: auto`',
]) assert.ok(design.includes(text), `应用外壳设计缺少下拉刷新规则: ${text}`);

const buildingDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');
for (const text of [
  '移动端工厂卡点击行为与桌面一致',
  '地区工厂详情不再从 `BuildingsPage` 打开专用 `MobileFacilityDetailSheet`',
]) assert.ok(buildingDesign.includes(text), `地区工厂移动详情设计缺少: ${text}`);

const index = read('docs/README.md');
for (const text of [
  '登录态根视口的纵向 overscroll 终止',
  '`scripts/verify-mobile-facility-pull-refresh.mjs`',
  '`tests/browser/mobile-facility-pull-refresh.spec.ts`',
]) assert.ok(index.includes(text), `设计索引缺少下拉刷新防回退规则: ${text}`);

const browser = read('tests/browser/mobile-facility-pull-refresh.spec.ts');
for (const text of [
  'mobile workspace sheet pull-to-refresh prevention',
  'first-level page guard covers interactive targets without opening a detail layer',
  'content scrolling stays native until scrollTop reaches zero, then browser pull is canceled',
  'shared detail scroll keeps the same pull-refresh guard',
  "'.mobile-detail-sheet-scroll, .page-card-scroll'",
  "toHaveCSS('overscroll-behavior-y', 'none')",
  'expect(prevented).toEqual([true, true]);',
  'expect(prevented).toEqual([false, true, true]);',
  "toHaveAttribute('data-detail-active', 'true')",
]) assert.ok(browser.includes(text), `移动 Workspace Sheet 浏览器回归缺少: ${text}`);

console.log('移动 Workspace Sheet 下拉刷新保护验证通过：一级页面、共享详情、交互控件和滚动到顶后的同次手势均由物理根 Sheet 局部保护，内部原生滚动与登录态 overscroll 边界保持不变。');
