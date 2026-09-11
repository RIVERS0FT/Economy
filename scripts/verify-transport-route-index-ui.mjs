import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message);
};
const forbidText = (source, text, message) => {
  if (source.includes(text)) failures.push(message);
};

const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const primaryDesign = read('docs/PRIMARY_SURFACE_INSET_DESIGN.md');
const transportPage = read('src/pages/TransportPage.tsx');
const transportCss = read('src/styles/transport-page.css');
const layoutSource = read('src/components/ui/layout.tsx');
const fixedActionCss = read('src/styles/primary-surfaces.css');
const scrollingCss = read('src/styles/scrolling-page-sections.css');
const browserTest = read('tests/browser/transport-route-cost-style-lock.spec.ts');
const allPagesBrowserTest = read('tests/browser/all-pages-preview.spec.ts');
const transportMapPickingTest = read('tests/browser/transport-map-picking.spec.ts');
const transportBalanceTest = read('tests/browser/transport-balance.spec.ts');
const pageContentVerifier = read('scripts/verify-page-content.mjs');

for (const text of [
  '页面底部固定操作层',
  '正文滚动视口之外并覆盖正文',
  '正文滚动必须预留按钮高度、页面间距和移动安全区',
  '不得显示路线数量／上限胶囊',
  '路线目录不重复显示“运输路线”分区标题',
  '独立业务对象',
  '不绘制行分割线',
]) requireText(pageDesign, text, `页面设计缺少运输目录规则：${text}`);

for (const text of [
  '运输路线是已登记的独立业务对象例外',
  '每条路线固定使用 `.ui-entity-card`',
  '路线卡之间只使用共享 `gap` 分隔',
  '不显示路线数量／上限胶囊',
]) requireText(uiDesign, text, `UI 设计缺少运输路线对象卡规则：${text}`);

requireText(
  primaryDesign,
  '运输路线是否使用对象卡由 `UI_DESIGN_SYSTEM.md` 的运输页视觉语义唯一决定',
  '页面表面设计必须把运输路线卡片资格交给 UI 设计系统。',
);

for (const text of [
  'className="transport-route-card ui-entity-card"',
  'fixedActions={(',
  'data-transport-page-fixed-action="true"',
  '增加路线',
]) requireText(transportPage, text, `运输页缺少固定路线操作结构：${text}`);

forbidText(transportPage, 'className="transport-page-actions"', '运输页不得恢复顶部增加路线操作区。');
forbidText(transportPage, 'className="transport-page-footer"', '运输页不得把增加路线按钮恢复到滚动正文 footer。');
forbidText(transportPage, '<WidgetHeading title="运输路线"', '运输目录不得恢复“运输路线”重复标题。');
forbidText(
  transportPage,
  '{routes.length}/{TRANSPORT_MAX_ROUTES_PER_PLAYER}',
  '运输目录不得恢复路线数量/上限胶囊。',
);

for (const text of [
  '.transport-page-content {',
  'gap: var(--layout-gutter);',
  '.transport-route-grid {',
  'gap: var(--space-3);',
]) requireText(transportCss, text, `运输页样式缺少：${text}`);
forbidText(transportCss, '.transport-page-footer {', '运输页不得保留旧 sticky footer 样式。');
forbidText(transportCss, '.ui-page-stack', '运输页不得覆盖共享 .ui-page-stack 几何。');
forbidText(transportCss, '--page-section-gap', '运输页不得重定义共享页面一级间距。');

for (const text of [
  'fixedActions?: ReactNode;', "fixedActionsVisibility?: 'always' | 'mobile';",
  "hasFixedActions && 'page-content--with-fixed-actions'",
  'data-fixed-actions-scroll-reserve="true"',
  "'page-fixed-actions',",
]) requireText(layoutSource, text, `PageLayout 缺少共享固定操作槽：${text}`);
for (const text of [
  '.game-shell .page-content--player.page-content--with-fixed-actions {',
  'position: relative;', '.game-shell .page-content--player .page-fixed-actions {', 'position: absolute;',
  'bottom: max(var(--player-page-content-inset), env(safe-area-inset-bottom));',
  ".game-shell .page-content--player [data-fixed-actions-scroll-reserve='true'] {",
  'padding-bottom: calc(', '+ var(--control-height)', '+ var(--space-3)',
  ".game-shell .page-content--player.page-content--with-mobile-fixed-actions [data-fixed-actions-scroll-reserve='true'] {",
  '.game-shell .page-content--player .page-fixed-actions > * {', 'pointer-events: auto;',
  '.game-shell .page-content--player .page-fixed-actions > .ui-button {', 'width: 100%;',
]) requireText(fixedActionCss, text, `共享固定操作层样式缺少：${text}`);
forbidText(
  fixedActionCss,
  '.page-content--player.page-content--with-fixed-actions .page-card-scroll {',
  '固定操作余量不得只放在 overflow 视口自身的尾部 padding。',
);

forbidText(
  scrollingCss,
  '.page-card-scroll .transport-route-card {',
  '共享滚动正文样式不得再次把运输路线对象卡扁平化。',
);

for (const text of [
  'transport route cards stay rounded without row dividers and the fixed add action overlays the scroll viewport',
  "getByRole('heading', { name: '运输路线', exact: true })",
  "page.locator('.page-fixed-actions')",
  "page.locator('[data-transport-page-fixed-action=\"true\"]')",
  "page.locator('[data-fixed-actions-scroll-reserve=\"true\"]')",
  "fixedActions.locator('.ui-status-tag')",
  'await expect(fixedActions).not.toContainText',
  'routeBorderRadius',
  'fixedActionBefore',
  'fixedActionAfter',
  'scrollReservePaddingBottom',
  "expect(visual.fixedActionStyle.position).toBe('absolute')",
]) requireText(browserTest, text, `运输浏览器回归缺少：${text}`);
forbidText(browserTest, "toContainText('0/50')", '运输浏览器回归不得要求已删除的路线数量胶囊。');
forbidText(browserTest, "page.locator('.transport-page-footer')", '运输浏览器回归不得继续定位旧 sticky footer。');

for (const [source, label] of [
  [allPagesBrowserTest, '全页面浏览器回归'],
  [transportMapPickingTest, '运输地图选点回归'],
  [transportBalanceTest, '运输数值回归'],
]) {
  requireText(source, 'data-transport-page-fixed-action', `${label}必须通过共享底部固定操作定位增加路线按钮。`);
  forbidText(source, '.transport-page-footer', `${label}不得继续定位旧 sticky footer。`);
  forbidText(source, '.transport-page-actions', `${label}不得恢复已删除的顶部运输操作区定位。`);
}

for (const text of [
  "'页面底部固定操作层'",
  "'data-transport-page-fixed-action=\"true\"'",
  "requireText('src/components/ui/layout.tsx', 'fixedActions?: ReactNode;');",
  "requireText('src/styles/primary-surfaces.css', '.page-fixed-actions {');",
  "'className=\"transport-page-footer\"',",
]) requireText(pageContentVerifier, text, `页面内容 verifier 未同步运输固定操作层规则：${text}`);

if (failures.length > 0) {
  console.error('运输路线目录 UI 防回退验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('运输路线目录 UI 防回退验证通过：路线使用对象卡且无行分割线，增加路线通过 PageLayout 固定操作层覆盖正文且脱离滚动，滚动内容尾部保留可真实滚动的安全余量。');