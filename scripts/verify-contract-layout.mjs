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
const coreStylePath = 'src/styles/contract-core-workspace.css';
const contentSurfacePath = 'src/styles/content-surfaces.css';
const scrollingSurfacePath = 'src/styles/scrolling-page-sections.css';
const auditStylePath = 'src/styles/contract-audit.css';
const navigationPath = 'src/contracts/navigation.ts';
const marketPanelPath = 'src/components/market/MarketContractSummary.tsx';
const designPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const productDesignPath = 'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md';
const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';
const surfaceDesignPath = 'docs/PRIMARY_SURFACE_INSET_DESIGN.md';
const serverDesignPath = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
const browserTestPath = 'tests/browser/contract-layout.spec.ts';
const attentionBrowserTestPath = 'tests/browser/contract-attention-background.spec.ts';
const workspaceTestPath = 'tests/browser/contract-workspace.spec.ts';
const harnessPath = 'tests/browser/runtime-harness.tsx';
const formVerifierPath = 'scripts/verify-form-controls.mjs';
const serverPath = 'server/src/contract-audit-store.js';
const packagePath = 'package.json';

[
  routePath, pagePath, stylePath, coreStylePath, contentSurfacePath, scrollingSurfacePath, auditStylePath,
  navigationPath, marketPanelPath, designPath, productDesignPath, uiDesignPath, surfaceDesignPath,
  serverDesignPath, browserTestPath, attentionBrowserTestPath, workspaceTestPath, harnessPath,
  formVerifierPath, serverPath, packagePath,
].forEach(requireFile);

for (const text of [
  "import { ContractWorkspacePage } from './ContractWorkspacePage';",
  "import '../styles/contract-core-workspace.css';",
  'return <ContractWorkspacePage model={model} />;',
]) requireText(routePath, text);
for (const text of ['productionContractActions', 'productionContractAudit', 'PagePanel', 'LegacyRenewalResolution']) forbidText(routePath, text);

for (const text of [
  'PagePanel', 'IntegerInput', 'MoneyInput', 'SelectInput', 'ToggleField', 'parseIntegerDraft',
  "type ContractWorkspaceView = 'workbench' | 'market' | 'active' | 'history'", 'contract-workspace-tabs',
  '合同工作台', '合同市场', '我的合同', '历史合同', 'contract-master-detail', 'contract-master-list-item',
  'contract-market-master-detail', '合作方向', '我要采购', '我要供货',
  'contract-content-actions', 'contract-summary-grid', 'contract-market-pane', 'contract-personal-pane',
  'contract-publish-layout', 'contract-type-grid', 'contract-history-panel', 'contract-history-result-grid',
  '每日最大供应量', '合同时间（天，可选）', '开始延迟（天）', '今日已使用', '今日剩余额度', '累计交付',
  '自动准备商品', '自动补充货款', '按当前日结束', 'LegacyRenewalResolution', '旧合同续签',
  '该区域只处理已经存在的旧有限批次续签', '我的履约档案', '完成事实', '实际交付事件',
  '重新拟定', '<option value="credits">普通货币</option>', 'value={`facility:${facility.id}`}',
]) requireText(pagePath, text);
for (const text of [
  'description="商品合同按地区使用固定价格', "type PersonalContractView = 'active' | 'history'",
  'contract-personal-tabs', 'contract-active-grid', '合同广场',
]) forbidText(pagePath, text);
for (const text of ['总交付批次（可选）', '首次交付（分钟）', '首次交付（小时）']) forbidText(pagePath, text);

const pageSource = read(pagePath);
const pageLayoutStart = pageSource.indexOf('<PageLayout title="合同">');
const pageActionIndex = pageSource.indexOf('className="contract-content-actions"', pageLayoutStart);
const pageSummaryIndex = pageSource.indexOf('className="contract-summary-grid"', pageLayoutStart);
const pageTabsIndex = pageSource.indexOf('className="ui-segmented contract-workspace-tabs"', pageLayoutStart);
if (pageLayoutStart < 0 || pageActionIndex < 0 || pageSummaryIndex < 0 || pageTabsIndex < 0) failures.push('合同 PageLayout 一级结构不完整');
else {
  if (pageActionIndex > pageSummaryIndex) failures.push('合同正文发布按钮必须位于摘要条之前');
  if (pageSummaryIndex > pageTabsIndex) failures.push('合同摘要必须位于工作区分段按钮之前');
}

for (const text of [
  '.contract-workspace-tabs', 'grid-template-columns: repeat(4, minmax(0, 1fr));', '.contract-master-detail',
  'grid-template-columns: minmax(16rem, 0.72fr) minmax(0, 1.28fr);', '.contract-master-list-item.ui-button',
  'border-bottom: 1px solid var(--color-divider);', '.contract-market-filters',
  '@media (max-width: 960px)', '@media (max-width: 720px)',
]) requireText(coreStylePath, text);
forbidText(coreStylePath, 'backdrop-filter');

for (const text of ['.contract-publish-layout', '.contract-history-panel', '@media (max-width: 960px)', '@media (max-width: 720px)']) requireText(stylePath, text);
forbidText(stylePath, '--page-section-gap');
for (const text of [
  '.panel.contract-card,', '.panel.asset-auction-card {', 'border-radius: var(--radius-card);',
  'padding: var(--primary-surface-inset);', 'background: var(--color-surface-subtle);', 'backdrop-filter: none;',
  '.panel.contract-card--attention {', '.panel.contract-card--danger {', '.contract-summary-grid {',
  '.contract-summary-grid > .ui-metric-card {', 'border-radius: 0;', 'background: transparent;',
]) requireText(contentSurfacePath, text);
requireText(scrollingSurfacePath, '.page-card-scroll .panel:not(.ui-entity-card):not(.contract-card):not(.asset-auction-card),');
forbidText(scrollingSurfacePath, '.page-card-scroll .panel,\n.page-card-scroll .ui-primary-surface {');
for (const text of ['.contract-history-result-grid', '.contract-history-entry', '.contract-history-republish']) requireText(auditStylePath, text);

for (const text of [
  "export type ContractMarketDirection = 'purchase' | 'supply'", 'direction?: ContractMarketDirection',
  'setContractMarketIntent(productId: string, provinceId?: string, direction?: ContractMarketDirection)',
]) requireText(navigationPath, text);
for (const text of ['setContractMarketIntent(productId, model.selectedProvinceId);', '查看相关合同']) requireText(marketPanelPath, text);
forbidText(marketPanelPath, 'setContractMarketIntent(productId, model.selectedProvinceId,');

for (const text of [
  '合同是连接生产、市场、库存、运输与玩家资本关系的核心长期经营机制',
  '现货市场负责即时价格发现与即时成交，合同负责锁定未来经营关系',
]) requireText(productDesignPath, text);
for (const text of [
  '工作台｜合同市场｜我的合同｜历史', '默认进入“工作台”', '左侧选择、右侧完整详情',
  '合同市场按领域、合作方向、地区和商品筛选', '不得恢复合同市场与我的合同桌面常驻双栏',
]) requireText(designPath, text);
for (const text of [
  '合同页作为当前对象卡样板', '当前选中的公开合同或进行中合同使用独立对象卡',
  '合同顶部四项摘要使用无逐项圆角的同一摘要条',
]) requireText(uiDesignPath, text);
for (const text of ['公开合同和进行中合同必须保持对象卡边界', '页面摘要指标属于同一比较条', '正文对象卡禁止 `backdrop-filter` 和高层浮动阴影']) requireText(surfaceDesignPath, text);

requireText(serverDesignPath, '历史查询的 `productId` 参数兼作玩家可见“合同标的”选择器');
for (const text of ["target === 'credits'", "target.startsWith('facility:')", "json_extract(contract_json, '$.facilityTypeId') = ?"]) requireText(serverPath, text);

for (const text of [
  'desktop contract page prioritizes workbench and master detail contract management',
  'tablet contract page keeps compact master detail and two-column publish fields',
  'mobile contract page keeps two-column summaries, two-by-two workspace tabs and full-size inputs',
  'narrow mobile contract workspace keeps four stable two-by-two hit areas',
  "getByLabel('每日最大供应量')", "getByLabel('合同时间（天，可选）')", "getByLabel('开始延迟（天）')",
  "getByText('完成事实'", "getByText('我的履约档案'", 'auditRequestCount()',
]) requireText(browserTestPath, text);
for (const text of ['independent contract cards keep object boundaries and warning tint', '.contract-card--attention', '.contract-card--normal', 'normalStyle.borderRadius', 'normalStyle.backdropFilter', 'summaryStyle.borderRadius']) requireText(attentionBrowserTestPath, text);
for (const text of ['contract core workspace switches between workbench market active and history views', "getByRole('tabpanel', { name: '合同工作台' })", "getByRole('tabpanel', { name: '合同市场' })", "getByRole('tabpanel', { name: '我的合同' })"]) requireText(workspaceTestPath, text);
for (const text of ["import { ContractPage } from '../../src/pages/ContractPage';", '<ContractPage model={model} />', "id: 'contract-active'", 'renewalProposal:', "id: 'contract-active-normal'", "supplyMode: 'daily'", "dailyMaxQuantity: 60", "id: 'contract-open'"]) requireText(harnessPath, text);
requireText(formVerifierPath, "'src/pages/ContractWorkspacePage.tsx'");
for (const text of ['"verify:contract-layout": "node scripts/verify-contract-layout.mjs"', 'node scripts/verify-contract-layout.mjs']) requireText(packagePath, text);

if (failures.length) {
  console.error(`合同页统一布局验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('合同页布局验证通过：默认工作台、四视图、主从详情、方向筛选与既有合同对象卡/审计兼容保持当前规则。');
