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
  "import { configureMobileFacilityPullRefreshGuard } from '../utils/mobileFacilityPullRefresh';",
  'configureMobileFacilityPullRefreshGuard();',
]) assert.ok(bootstrap.includes(text), `交互 bootstrap 缺少移动工厂详情保护: ${text}`);

const guard = read('src/utils/mobileFacilityPullRefresh.ts');
for (const text of [
  "const FACILITY_SHEET_SELECTOR = '.facility-detail-sheet';",
  "const FACILITY_SHEET_SCROLL_SELECTOR = '.facility-detail-sheet-scroll';",
  "sheet.addEventListener('touchstart', handleTouchStart, { passive: true });",
  "sheet.addEventListener('touchmove', handleTouchMove, { passive: false });",
  'if (event.cancelable) event.preventDefault();',
  'deltaY < Math.abs(deltaX) * FACILITY_SHEET_AXIS_DOMINANCE',
  "session.source === 'content'",
  'scrollViewport.scrollTop > 0',
]) assert.ok(guard.includes(text), `移动工厂详情保护缺少: ${text}`);
for (const forbidden of [
  "document.addEventListener('touchmove'",
  "window.addEventListener('touchmove'",
  "document.body.addEventListener('touchmove'",
]) assert.equal(guard.includes(forbidden), false, `不得全局拦截触摸滚动: ${forbidden}`);

const design = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
for (const text of [
  '登录态根视口的下拉刷新边界',
  '`html[data-app-surface="game"|"admin"]`',
  '`overscroll-behavior-y: none`',
  '`mobileFacilityPullRefresh.ts`',
  '非被动 `touchmove`',
  '内部滚动区继续保持 `overscroll-behavior-y: auto`',
]) assert.ok(design.includes(text), `应用外壳设计缺少下拉刷新规则: ${text}`);

const index = read('docs/README.md');
for (const text of [
  '登录态根视口的纵向 overscroll 终止',
  '`scripts/verify-mobile-facility-pull-refresh.mjs`',
  '`tests/browser/mobile-facility-pull-refresh.spec.ts`',
]) assert.ok(index.includes(text), `设计索引缺少下拉刷新防回退规则: ${text}`);

const browser = read('tests/browser/mobile-facility-pull-refresh.spec.ts');
for (const text of [
  'mobile facility pull-to-refresh prevention',
  "toHaveCSS('overscroll-behavior-y', 'none')",
  '__facilityTouchMovePrevented',
  'event.defaultPrevented',
  'topLevelNavigations',
]) assert.ok(browser.includes(text), `移动工厂详情浏览器回归缺少: ${text}`);

console.log('移动工厂详情下拉刷新保护验证通过：根视口终止 overscroll、详情局部非被动手势、设计与浏览器回归均已锁定。');
