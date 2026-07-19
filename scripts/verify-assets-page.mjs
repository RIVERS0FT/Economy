import fs from 'node:fs';

const assetsPage = fs.readFileSync('src/pages/AssetsPage.tsx', 'utf8');
const assetsStyles = fs.readFileSync('src/styles/assets.css', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');
const design = fs.readFileSync('docs/ASSETS_PAGE_DESIGN.md', 'utf8');
const runtimeHarness = fs.readFileSync('tests/browser/assets-runtime-harness.tsx', 'utf8');
const runtimeSpec = fs.readFileSync('tests/browser/assets-runtime.spec.ts', 'utf8');
const runtimeHtml = fs.readFileSync('assets-runtime-test.html', 'utf8');

const failures = [];
function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}
function forbidText(source, text, message) {
  if (source.includes(text)) failures.push(message);
}

for (const text of [
  'title="资产总览"',
  'asset-total-summary',
  'asset-total-splits',
  'asset-allocation-summary',
  'asset-composition-table',
  'role="table"',
  'aria-label="资产构成明细"',
  'asset-composition-row cash',
  'asset-composition-row commodity',
  'asset-composition-row facility',
  '冻结资产仍归当前玩家所有并计入总资产；冻结只限制交易、生产或使用。',
  'title="本地资产变动"',
  'items={filteredEvents}',
  'asset-event-virtual-list',
]) requireText(assetsPage, text, `资产页缺少去重总览或本地变化结构：${text}`);

for (const text of [
  'funds-summary-grid',
  'title="资产配置"',
  'title="资产估值明细"',
  '<MetricCard',
  '商品库存与估值',
  'product-asset-grid',
  'product-asset-card',
]) forbidText(assetsPage, text, `资产页不得恢复重复摘要或逐商品资产卡：${text}`);

for (const text of [
  '.assets-page-grid',
  'grid-template-columns: minmax(240px, 0.8fr) minmax(190px, 0.6fr) minmax(440px, 1.6fr)',
  '.asset-composition-header',
  '.asset-composition-row',
  '@media (max-width: 720px)',
  'grid-template-columns: 1fr;',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
]) requireText(assetsStyles, text, `资产页专用样式缺少响应式规则：${text}`);

requireText(main, "import './styles/assets.css';", '主入口必须加载资产页专用样式。');
requireText(design, '资产页固定只有两个一级 `Panel`', '资产页设计必须记录两个一级区域。');
requireText(design, '当前总资产只显示一次', '资产页设计必须禁止重复总资产。');
requireText(design, '不得恢复顶部五张资金／总资产摘要卡', '资产页设计必须记录防回退规则。');
requireText(runtimeHtml, '/tests/browser/assets-runtime-harness.tsx', '必须提供资产页浏览器测试入口。');
requireText(runtimeHarness, '<AssetsPage model={model} />', '资产页浏览器夹具必须渲染真实页面组件。');
requireText(runtimeSpec, "getByText('当前总资产', { exact: true })).toHaveCount(1)", 'Playwright 必须验证总资产可见文案只出现一次。');
requireText(runtimeSpec, "getByText('冻结资产', { exact: true })).toHaveCount(1)", 'Playwright 必须验证冻结资产可见文案只出现一次。');
requireText(runtimeSpec, 'compositionColumns).toBe(2)', 'Playwright 必须验证移动资产构成使用两列重排。');
requireText(runtimeSpec, 'scrollWidth <= element.clientWidth + 1', 'Playwright 必须验证资产页无水平溢出。');

if (failures.length > 0) {
  console.error('资产页结构与去重验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('资产页统一总览、构成拆分、移动布局与防回退验证通过。');
