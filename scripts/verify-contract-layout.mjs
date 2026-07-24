import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const harnessPath = 'tests/browser/runtime-harness.tsx';
const formVerifierPath = 'scripts/verify-form-controls.mjs';
const packagePath = 'package.json';

[
  pagePath,
  stylePath,
  designPath,
  browserTestPath,
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
  "useState<ContractTab>('active')",
  'contract-publish-layout',
  'contract-offer-grid',
  'contract-history-panel',
  '自动准备商品',
  '自动补充货款',
]) requireText(pagePath, text);

for (const text of [
  'Number(event.target.value)',
  '<input type="number"',
  '<select',
]) forbidText(pagePath, text);

for (const text of [
  '.contract-summary-grid',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '.contract-publish-layout',
  '.contract-offer-grid',
  '.contract-history-panel',
  '@media (max-width: 1219px)',
  '  .contract-publish-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }',
  'grid-auto-flow: column;',
  '@media (max-width: 720px)',
]) requireText(stylePath, text);

for (const text of [
  '.contract-tabs button {',
  '.contract-publish-grid input',
  '.contract-publish-grid select',
]) forbidText(stylePath, text);

for (const text of [
  '合同页的四项摘要在宽布局四列同排',
  '标签栏必须复用 `Button` 与 `.ui-segmented`',
  '发布合同面板必须使用 `PagePanel`',
  '进行中合同卡先展示当前批次履约状态',
  '合同广场在宽度不小于 `1220px` 时使用双列',
  '合同历史使用单张一级 `PagePanel`',
  '不得恢复合同页原生数字输入',
]) requireText(designPath, text);

for (const text of [
  "runtime-test.html?view=contracts",
  'desktop contract workspace uses shared controls and dense two-column layouts',
  'tablet contract publish form keeps two-column fields',
  'mobile contract workspace keeps two-column summaries, scrollable tabs and full-size inputs',
  "toHaveValue('')",
  "toHaveValue('100')",
]) requireText(browserTestPath, text);

for (const text of [
  "import { ContractPage } from '../../src/pages/ContractPage';",
  "view === 'contracts'",
  '<ContractPage model={model} />',
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

console.log('合同页统一表单、工作台层级、平板与移动响应式布局、历史列表和浏览器回归验证通过。');
