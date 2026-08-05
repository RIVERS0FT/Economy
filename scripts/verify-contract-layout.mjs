import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Contract market remains visible while the personal pane switches active/history views.
const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

const pagePath = 'src/pages/ContractPage.tsx';
const stylePath = 'src/styles/contracts.css';
const designPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const browserTestPath = 'tests/browser/contract-layout.spec.ts';
const attentionBrowserTestPath = 'tests/browser/contract-attention-background.spec.ts';
const workspaceTestPath = 'tests/browser/contract-workspace.spec.ts';
const harnessPath = 'tests/browser/runtime-harness.tsx';
const formVerifierPath = 'scripts/verify-form-controls.mjs';
const packagePath = 'package.json';

[
  pagePath,
  stylePath,
  designPath,
  browserTestPath,
  attentionBrowserTestPath,
  workspaceTestPath,
  harnessPath,
  formVerifierPath,
  packagePath,
].forEach(requireFile);

for (const text of [
  'PagePanel',
  'ProductIconLabel',
  'IntegerInput',
  'SelectInput',
  'ToggleField',
  'parseIntegerDraft',
  'role="tablist"',
  'role="tab"',
  'role="tabpanel"',
  "type PersonalContractView = 'active' | 'history'",
  "useState<PersonalContractView>('active')",
  'contractNeedsAttention',
  'contract-workspace',
  'contract-market-pane',
  'contract-market-grid',
  'contract-personal-pane',
  'contract-personal-tabs',
  'contract-active-grid',
  "contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'",
  'contract-publish-layout',
  'contract-type-grid',
  'contract-type-option',
  'contract-history-panel',
  'contract-history-result-grid',
  '重新拟定',
  '自动准备商品',
  '自动补充货款',
]) requireText(pagePath, text);

for (const text of [
  'Number(event.target.value)',
  '<input type="number"',
  '<select',
  'type ContractTab',
  'contract-tab-market',
  'contract-tab-pending',
  "tab === 'market'",
  "tab === 'pending'",
]) forbidText(pagePath, text);

for (const text of [
  '.contract-summary-grid',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '.contract-workspace {',
  'gap: var(--layout-gutter);',
  '.contract-pane-grid,',
  '.contract-active-grid {',
  '.contract-personal-tabs {',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.contract-workspace .contract-card--attention {',
  'background: linear-gradient(0deg, var(--color-warning-soft), var(--color-warning-soft)), var(--gradient-panel);',
  '.contract-publish-layout',
  '.contract-history-panel',
  '@media (max-width: 1399px)',
  '@media (max-width: 960px)',
  '@media (max-width: 720px)',
  '  .contract-publish-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }',
]) requireText(stylePath, text);

for (const text of [
  '--page-section-gap',
  '--color-surface-primary',
  '.ui-segmented.contract-tabs {',
  '.contract-tabs .contract-tab-count {',
  'grid-auto-flow: column;',
  'grid-auto-columns: max-content;',
]) forbidText(stylePath, text);

for (const text of [
  '合同页的四项摘要在宽布局四列同排',
  '桌面合同主体固定为四列工作区',
  '左侧两列是常驻“合同广场”',
  '右侧只使用“进行中的合同／历史合同”两个共享分段按钮切换',
  '待处理不再是独立标签',
  '待处理卡片使用警示色边框与柔和背景',
  '桌面视口不小于 `1400px`',
  '`961px–1399px` 时左右区域仍并排但各自单列',
  '发布合同面板必须使用 `PagePanel`',
  '进行中合同卡先展示当前批次履约状态',
  '合同历史使用右侧区域内的单张一级 `PagePanel`',
  '工作区内部左右区域使用 `var(--layout-gutter)`',
  '作为 `PageLayout` 自动生成的 `.ui-page-stack` 直接子元素',
  '发布面板必须先展示六种类型',
  '移动端六类入口至少两列且不得横向溢出',
]) requireText(designPath, text);

for (const text of [
  "runtime-test.html?view=contracts",
  'desktop contract workspace uses shared controls and dense two-column layouts',
  'tablet contract publish form keeps two-column fields',
  'mobile contract workspace keeps two-column summaries, scrollable tabs and full-size inputs',
  'narrow mobile contract tabs keep two stable hit areas',
  "openContracts(page, 320, 844)",
  "openContracts(page, 390, 844)",
  "toHaveValue('')",
  "toHaveValue('100')",
  'expectUniformPageSectionGaps',
  'expectPersonalContractTabs',
  "page.locator('.contract-workspace')",
  "page.locator('.contract-market-grid')",
  "page.locator('.contract-active-grid')",
  'toHaveClass(/contract-card--attention/)',
  "page.locator('.contract-type-option')",
  "hasText: '采购合同'",
]) requireText(browserTestPath, text);

for (const text of [
  "runtime-test.html?view=contracts",
  'pending contract card keeps warning tint over panel material',
  '.contract-card--attention',
  '.contract-card--normal',
  'backgroundImage',
  'rgba(242, 197, 104, 0.08)',
  'rgb(242, 197, 104)',
]) requireText(attentionBrowserTestPath, text);

for (const text of [
  'contract market stays visible while personal contracts switch views',
  "getByRole('region', { name: '合同广场' })",
  "getByRole('region', { name: '我的合同' })",
  "getByRole('tab', { name: '历史合同', exact: true })",
  'toHaveClass(/contract-card--attention/)',
  'toHaveClass(/contract-card--normal/)',
]) requireText(workspaceTestPath, text);

for (const text of [
  "import { ContractPage } from '../../src/pages/ContractPage';",
  "view === 'contracts'",
  '<ContractPage model={model} />',
  "id: 'contract-active-normal'",
  "kind: 'supply'",
  "publisherSide: 'supplier'",
]) requireText(harnessPath, text);

requireText(formVerifierPath, "'src/pages/ContractPage.tsx'");

for (const text of [
  '"verify:contract-layout": "node scripts/verify-contract-layout.mjs"',
  'node scripts/verify-contract-layout.mjs',
]) requireText(packagePath, text);

if (failures.length) {
  console.error(`合同页统一布局验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('合同页四列工作区、常驻合同广场、待处理置顶与警示背景、双视图切换、历史结果、重新拟定和响应式浏览器回归验证通过。');
