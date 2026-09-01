import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

const routePath = 'src/pages/ContractPage.tsx';
const pagePath = 'src/pages/ContractWorkspacePage.tsx';
const stylePath = 'src/styles/contracts.css';
const auditStylePath = 'src/styles/contract-audit.css';
const designPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const serverDesignPath = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
const browserTestPath = 'tests/browser/contract-layout.spec.ts';
const attentionBrowserTestPath = 'tests/browser/contract-attention-background.spec.ts';
const workspaceTestPath = 'tests/browser/contract-workspace.spec.ts';
const harnessPath = 'tests/browser/runtime-harness.tsx';
const formVerifierPath = 'scripts/verify-form-controls.mjs';
const serverPath = 'server/src/contract-audit-store.js';
const packagePath = 'package.json';

[routePath, pagePath, stylePath, auditStylePath, designPath, serverDesignPath, browserTestPath, attentionBrowserTestPath, workspaceTestPath, harnessPath, formVerifierPath, serverPath, packagePath].forEach(requireFile);

for (const text of [
  "import { ContractWorkspacePage } from './ContractWorkspacePage';",
  'return <ContractWorkspacePage model={model} />;',
]) requireText(routePath, text);
for (const text of ['productionContractActions', 'productionContractAudit', 'PagePanel', 'LegacyRenewalResolution']) forbidText(routePath, text);

for (const text of [
  'PagePanel', 'IntegerInput', 'MoneyInput', 'SelectInput', 'ToggleField', 'parseIntegerDraft',
  'role="tablist"', 'role="tab"', 'role="tabpanel"', "type PersonalContractView = 'active' | 'history'",
  'contract-content-actions', 'contract-summary-grid', 'contract-workspace', 'contract-market-pane', 'contract-market-grid',
  'contract-personal-pane', 'contract-personal-tabs', 'contract-active-grid', 'contract-publish-layout', 'contract-type-grid',
  'contract-history-panel', 'contract-history-result-grid', '每日最大供应量', '合同时间（天，可选）', '开始延迟（天）',
  '今日已使用', '今日剩余额度', '累计交付', '自动准备商品', '自动补充货款', '按当前日结束',
  'LegacyRenewalResolution', '旧合同续签', '该区域只处理已经存在的旧有限批次续签',
  '我的履约档案', '完成事实', '实际交付事件', '重新拟定', '<option value="credits">普通货币</option>', 'value={`facility:${facility.id}`}',
]) requireText(pagePath, text);
for (const text of ['总交付批次（可选）', '首次交付（分钟）', '首次交付（小时）']) forbidText(pagePath, text);
const pageSource = read(pagePath);
const pageLayoutStart = pageSource.indexOf('<PageLayout title="合同"');
const pageActionIndex = pageSource.indexOf('className="contract-content-actions"', pageLayoutStart);
const pageSummaryIndex = pageSource.indexOf('className="contract-summary-grid"', pageLayoutStart);
const pageWorkspaceIndex = pageSource.indexOf('className="contract-workspace"', pageLayoutStart);
if (pageLayoutStart < 0 || pageActionIndex < 0 || pageSummaryIndex < 0 || pageWorkspaceIndex < 0) failures.push('合同 PageLayout 一级结构不完整');
else {
  if (pageActionIndex > pageSummaryIndex) failures.push('合同正文发布按钮必须位于摘要卡之前');
  if (pageSummaryIndex > pageWorkspaceIndex) failures.push('合同摘要必须位于工作区之前');
}

for (const text of [
  '.contract-summary-grid', 'grid-template-columns: repeat(4, minmax(0, 1fr));', '.contract-workspace {', 'gap: var(--layout-gutter);',
  '.contract-active-grid {', '.contract-personal-tabs {', 'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.contract-workspace .contract-card--attention {', '.contract-publish-layout', '.contract-history-panel',
  '@media (max-width: 1399px)', '@media (max-width: 960px)', '@media (max-width: 720px)',
]) requireText(stylePath, text);
for (const text of ['.contract-history-result-grid', '.contract-history-entry', '.contract-history-republish']) requireText(auditStylePath, text);
forbidText(stylePath, '--page-section-gap');

for (const text of [
  '玩家新发布的商品采购／供应合同统一使用地区化每日额度模型', '新每日额度商品合同不使用续签',
  '旧有限批次商品合同的当前批次、续签、宽限与受偿方主动解除界面只保留兼容展示',
  '合同标的覆盖商品、普通货币和工厂类型', '玩家历史页不展开、不加载审计事件时间线',
  '作为 `PageLayout` 自动生成的 `.ui-page-stack` 直接子元素',
]) requireText(designPath, text);
requireText(serverDesignPath, '历史查询的 `productId` 参数兼作玩家可见“合同标的”选择器');
for (const text of ["target === 'credits'", "target.startsWith('facility:')", "json_extract(contract_json, '$.facilityTypeId') = ?"]) requireText(serverPath, text);

for (const text of [
  'desktop contract workspace uses shared controls and dense two-column layouts',
  'tablet contract publish form keeps two-column fields',
  'mobile contract workspace keeps two-column summaries, scrollable tabs and full-size inputs',
  'narrow mobile contract tabs keep two stable hit areas',
  "getByLabel('每日最大供应量')", "getByLabel('合同时间（天，可选）')", "getByLabel('开始延迟（天）')",
  "getByText('完成事实'", "getByText('我的履约档案'", 'auditRequestCount()',
]) requireText(browserTestPath, text);

for (const text of ['pending contract card keeps warning tint over panel material', '.contract-card--attention', '.contract-card--normal']) requireText(attentionBrowserTestPath, text);
for (const text of ['contract market stays visible while personal contracts switch views', "getByRole('region', { name: '合同广场' })", "getByRole('region', { name: '我的合同' })"]) requireText(workspaceTestPath, text);
for (const text of [
  "import { ContractPage } from '../../src/pages/ContractPage';", '<ContractPage model={model} />', "id: 'contract-active'", "renewalProposal:",
  "id: 'contract-active-normal'", "supplyMode: 'daily'", "dailyMaxQuantity: 60", "id: 'contract-open'",
]) requireText(harnessPath, text);
requireText(formVerifierPath, "'src/pages/ContractWorkspacePage.tsx'");
for (const text of ['"verify:contract-layout": "node scripts/verify-contract-layout.mjs"', 'node scripts/verify-contract-layout.mjs']) requireText(packagePath, text);

if (failures.length) {
  console.error(`合同页统一布局验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('合同页现行工作区、新每日额度、旧合同兼容、历史标的筛选和响应式回归验证通过。');
