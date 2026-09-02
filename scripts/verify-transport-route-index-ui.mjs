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
const scrollingCss = read('src/styles/scrolling-page-sections.css');
const browserTest = read('tests/browser/transport-route-cost-style-lock.spec.ts');

for (const text of [
  '底部 sticky 操作区',
  '不得显示路线数量／上限胶囊',
  '一级目录不重复显示“运输路线”分区标题',
  '独立业务对象',
  '不绘制行分割线',
]) requireText(pageDesign, text, `页面设计缺少运输目录规则：${text}`);

for (const text of [
  '运输路线是已登记的独立业务对象例外',
  '每条路线固定使用 `.ui-entity-card`',
  '路线卡之间只使用共享 `gap` 分隔',
  '不显示路线数量／上限胶囊',
  '底部 sticky 操作区',
]) requireText(uiDesign, text, `UI 设计缺少运输路线对象卡规则：${text}`);

requireText(
  primaryDesign,
  '运输路线是否使用对象卡由 `UI_DESIGN_SYSTEM.md` 的运输页视觉语义唯一决定',
  '页面表面设计必须把运输路线卡片资格交给 UI 设计系统。',
);

for (const text of [
  'className="transport-route-card ui-entity-card"',
  'className="transport-page-footer"',
  'data-transport-page-footer="true"',
  '>增加路线</Button>',
]) requireText(transportPage, text, `运输页缺少底部路线卡结构：${text}`);

forbidText(transportPage, 'className="transport-page-actions"', '运输页不得恢复顶部增加路线操作区。');
forbidText(transportPage, '<WidgetHeading title="运输路线"', '运输目录不得恢复“运输路线”重复标题。');
forbidText(
  transportPage,
  '{routes.length}/{TRANSPORT_MAX_ROUTES_PER_PLAYER}',
  '运输目录不得恢复路线数量/上限胶囊。',
);

for (const text of [
  ".page-card-scroll:has([data-transport-route-index='true']) > .ui-page-stack",
  '.transport-page-footer {',
  'position: sticky;',
  'bottom: 0;',
  '.transport-route-grid {',
  'gap: var(--space-3);',
]) requireText(transportCss, text, `运输页样式缺少：${text}`);

forbidText(
  scrollingCss,
  '.page-card-scroll .transport-route-card {',
  '共享滚动正文样式不得再次把运输路线对象卡扁平化。',
);

for (const text of [
  'transport route cards stay rounded without row dividers and the add action stays pinned to the page bottom',
  "getByRole('heading', { name: '运输路线', exact: true })",
  "toHaveText('增加路线')",
  "footer.locator('.ui-status-tag')",
  'routeBorderRadius',
  'footerBefore',
  'footerAfter',
  'not.toContainText(/\\d+\\s*\\/\\s*50/)',
]) requireText(browserTest, text, `运输浏览器回归缺少：${text}`);
forbidText(browserTest, "toContainText('0/50')", '运输浏览器回归不得要求已删除的路线数量胶囊。');

if (failures.length > 0) {
  console.error('运输路线目录 UI 防回退验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('运输路线目录 UI 防回退验证通过：路线使用对象卡且无行分割线，重复标题和路线数量胶囊已移除，增加路线固定在页面底部。');
