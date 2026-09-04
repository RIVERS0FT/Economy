import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));

assert.equal(
  FACILITY_TYPE_CATALOG.find((facility) => facility.id === 'electronics-factory')?.name,
  '电子厂',
  'electronics-factory 正式显示名称必须为电子厂',
);

for (const facility of FACILITY_TYPE_CATALOG) {
  assert.ok(Array.isArray(facility.recipes) && facility.recipes.length >= 1, `${facility.id} 必须显式提供配方`);
  assert.ok(facility.defaultRecipeId, `${facility.id} 缺少默认配方`);
  assert.ok(
    facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId),
    `${facility.id} 默认配方无效`,
  );
  assert.equal(
    new Set(facility.recipes.map((recipe) => recipe.id)).size,
    facility.recipes.length,
    `${facility.id} 配方 ID 必须唯一`,
  );
  for (const recipe of facility.recipes) {
    assert.ok(recipe.name, `${facility.id}/${recipe.id} 缺少正式名称`);
    assert.ok(recipe.cycleMs > 0, `${facility.id}/${recipe.id} 周期无效`);
    assert.ok(recipe.operatingCost >= 0, `${facility.id}/${recipe.id} 成本无效`);
    assert.ok(productIds.has(recipe.output.productId), `${facility.id}/${recipe.id} 输出商品无效`);
    assert.ok(Array.isArray(recipe.inputs), `${facility.id}/${recipe.id} 必须使用 inputs[]`);
    for (const input of recipe.inputs) {
      assert.ok(productIds.has(input.productId), `${facility.id}/${recipe.id} 输入商品无效`);
    }
  }
}

const page = read('src/pages/BuildingsPage.tsx');
const provincePage = read('src/pages/ProvincePage.tsx');
const detail = read('src/pages/production/ProductionFacilityDetail.tsx');
const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
const controls = read('src/components/facilities/FacilityProductionConfigControls.tsx');
const baseCss = read('src/styles/facility-group-card-grid.css');
const surfaceCss = read('src/styles/production-surface.css');
const primarySurfaceCss = read('src/styles/primary-surfaces.css');
const sheetCss = read('src/styles/mobile-detail-sheet.css');
const sharedSheet = read('src/components/ui/MobileWorkspaceDetailSheet.tsx');
const sharedHost = read('src/components/ui/MobileWorkspaceSheetHost.tsx');
const sharedDrag = read('src/components/ui/useMobileWorkspaceSheetDrag.ts');
const catalogPresentationDesign = read('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md');
const buildingLayoutDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');

for (const forbidden of [
  'game.facilityTypes.sort(',
  'game.facilityTypes.toSorted(',
  'game.facilityTypes.slice().sort(',
]) assert.equal(page.includes(forbidden), false, `建筑页不得对服务器工厂目录二次排序: ${forbidden}`);

for (const required of [
  '正式目录必须按 `complexity` 从 `C1` 到 `C7` 升序排列',
  '同一复杂度内保持服务器目录声明的相对顺序',
  '不得对 `game.facilityTypes` 本身执行 `sort()` 或 `toSorted()`',
  '默认态和第三态必须恢复正式目录顺序',
  '地区 `BuildingsPage` 的工厂选择卡仍禁止客户端重排',
]) assert.equal(catalogPresentationDesign.includes(required), true, `工厂目录权威设计缺少: ${required}`);

for (const text of [
  'game.facilityTypes.flatMap((type): FacilityClusterEntry[] =>',
  'if (!group || group.count < 1) return [];',
  'return [{ type, group: displayGroup }];',
  'detailFacilityTypeId?: string;',
  'onDetailFacilityChange?: (facilityTypeId: string | null) => void;',
  'const selectedFacilityEntry = orderedFacilityGroups.find(',
  'const buildCard = (',
  'const facilityList = (',
  'className="regional-buildings-management"',
  'className="facility-cluster-selector-region"',
  'orderedFacilityGroups.map((entry) => (',
  'onSelect={() => selectFacilityEntry(entry.type.id)}',
  'className="facility-cluster-detail-shell facility-cluster-detail-page"',
  '<FacilityClusterDetailContent',
  'className="production-surface facility-card facility-group-card facility-cluster-detail-card"',
  'products={game.products}',
  'inventories={game.inventories}',
  'now={now}',
  'setFacilityRecipe',
]) assert.equal(page.includes(text), true, `建筑页组合源码缺少: ${text}`);

assert.equal(page.indexOf('{buildCard}') < page.indexOf('{facilityList}'), true, '建设新工厂必须位于工厂卡片网格之前');

for (const forbidden of [
  'buildingQuery',
  'buildingCategory',
  'buildingStatus',
  'facility-cluster-navigation',
  '按产业和运行状态筛选建筑',
  'MobileFacilityDetailSheet',
  'isMobileFacilityLayout',
  'aria-pressed={isSelected}',
  'facility-current-selection-bar',
  '查看详情',
]) assert.equal(page.includes(forbidden), false, `地区建筑列表不得恢复可执行旧结构: ${forbidden}`);

for (const text of [
  "const [fallbackFacilityDetailTypeId, setFallbackFacilityDetailTypeId] = useState<string | null>(null);",
  "location?.type === 'regional-facility'",
  "location.host === 'province'",
  "activeSection === 'buildings' && Boolean(facilityDetailType)",
  '{!isEntityDetail ? sectionSwitch : null}',
  '<RegionalEntityPageTitle',
  "type: 'regional-facility'",
  "host: 'province'",
  'pageNavigation.pushPage({',
  'detailFacilityTypeId={facilityDetailTypeId ?? undefined}',
  'onDetailFacilityChange={handleFacilityDetailChange}',
]) assert.equal(provincePage.includes(text), true, `地区工厂二级详情缺少: ${text}`);
assert.equal(provincePage.includes('actions={sectionSwitch}'), false, '地区五分区切换不得恢复到固定标题操作区');

const selectorCardSource = detail.slice(
  detail.indexOf('export function FacilityClusterSelectorCard'),
  detail.indexOf('export function FacilityClusterInformation'),
);
for (const text of [
  'className="facility-cluster-selector-card"',
  'data-ui-interactive="surface"',
  'data-status={group.status}',
  'className="facility-cluster-name"',
  '<FacilityIcon facilityTypeId={type.id} className="facility-cluster-icon" />',
  'className={`facility-cluster-profit is-${profit.tone}`}',
  'className="facility-cluster-count"',
  'resolveFacilityProfitPresentation({',
]) assert.equal(selectorCardSource.includes(text), true, `工厂卡结构缺少: ${text}`);
assert.equal(selectorCardSource.includes('×'), false, '工厂选择卡数量不得显示乘号');
assert.equal(selectorCardSource.includes(' x '), false, '工厂选择卡数量不得显示字母 x');

for (const text of [
  'export function FacilityClusterInformation',
  'export function FacilityClusterDetailBody',
  'export function FacilityClusterDetailContent',
  'className="facility-information"',
  '<MobileDetailSummary',
  'className="facility-information-summary"',
  '<FacilityStaffingSummary entry={entry} now={liveNow} />',
  'className="facility-production-settings mobile-detail-section"',
  'className="facility-production-settings-grid"',
  'aria-label="生产配置"',
  '<FacilityProductionConfigControls',
  'productionRecipeVariantId',
]) assert.equal(detail.includes(text), true, `工厂详情缺少: ${text}`);
assert.equal(detail.includes('<strong>生产设置</strong>'), false, '工厂详情不得恢复可见生产设置标题');

for (const forbidden of [
  'FacilityMarketAction',
  '交易该建筑资产',
  'onOpenMarket',
  'facility-recipe-section',
  'facility-production-method-section',
  '<strong>{selectedMethod.name}</strong>',
  'selectedMethod.description',
  'facility-card-spacer',
  'constructionOnly',
  '宝石加速',
]) assert.equal(detail.includes(forbidden), false, `工厂详情不得恢复: ${forbidden}`);

for (const text of [
  'label="生产产物"',
  'aria-label={ariaLabel ?? `${typeName}生产产物`}',
  'aria-label={ariaLabel ?? `${typeName}生产方式`}',
  'variant="production-config"',
]) assert.equal(controls.includes(text), true, `统一生产设置控件缺少: ${text}`);

for (const text of [
  'export function currentFormulaScope',
  "group.status === 'running'",
  'group.participatingCount',
  'group.productionAvailableCount',
  'item.quantity * multiplier',
  'type.operatingCost * scope.count',
  'multiplier={scope.count}',
  'formatDuration(type.cycleMs)',
  '<FacilityGroupProgress group={group} type={type} now={now} />',
  'import { GameConcept }',
  '<strong><GameConcept concept="production-settlement" /></strong>',
  '<GameConcept concept="production-input" />',
  '<GameConcept concept="production-output" />',
]) assert.equal(formula.includes(text), true, `生产公式缺少: ${text}`);
for (const forbidden of [
  'function recipeDescription',
  'multiplier={group.count}',
  'type.operatingCost * group.count',
  'item.quantity * group.count',
  'facility-formula-summary',
  'facility-formula-next-cycle',
  'facility-formula-scope',
  '<strong>生产结算</strong>',
]) assert.equal(formula.includes(forbidden), false, `生产公式不应包含: ${forbidden}`);

for (const text of [
  '.facility-cluster-selector-list',
  '.facility-cluster-selector-card',
  'aspect-ratio: 4 / 5;',
  '.facility-cluster-name',
  '.facility-cluster-icon',
  '.facility-cluster-profit',
  '.facility-cluster-profit.is-positive',
  '.facility-cluster-profit.is-negative',
  '.facility-cluster-count',
  '.facility-cluster-detail-shell',
  '.facility-cluster-detail-card',
  '.facility-information',
  '.facility-information-details > .facility-average-profit',
  '.facility-information-details > .facility-staffing-summary',
  'grid-template-rows: auto auto auto;',
]) assert.equal(baseCss.includes(text), true, `工厂卡与详情基础样式缺少: ${text}`);

for (const text of [
  '.regional-buildings-management {',
  '.facility-cluster-selector-region {',
  '.facility-cluster-selector-list {',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.facility-cluster-selector-card {',
  'width: 100%;',
  'max-width: none;',
  'aspect-ratio: 4 / 5;',
  '.facility-cluster-detail-shell.facility-cluster-detail-page {',
  'display: flex;',
  'position: static;',
  'max-height: none;',
  'overflow: visible;',
  '.province-facility-detail-title {',
  'font-size: clamp(',
  'text-overflow: ellipsis;',
  'white-space: nowrap;',
]) assert.equal(surfaceCss.includes(text), true, `地区工厂卡最终样式缺少: ${text}`);
for (const forbidden of [
  ".facility-cluster-selector-card[data-status='running']::after",
  "content: '运行中';",
  "content: '异常';",
  "content: '已停止';",
  ".facility-cluster-count::before",
]) assert.equal(surfaceCss.includes(forbidden), false, `不得恢复横向账本标注: ${forbidden}`);

for (const text of [
  '--production-pill-visible-height: 1.6rem;',
  'width: 2.75rem;',
  'height: var(--production-pill-visible-height);',
  '--production-switch-thumb-size: 1rem;',
]) assert.equal(surfaceCss.includes(text), true, `建筑页胶囊／开关规则缺少: ${text}`);

for (const text of [
  '--primary-surface-inset: var(--space-4);',
  '.panel.ui-primary-surface {',
  'padding: var(--primary-surface-inset);',
  '@media (max-width: 720px)',
  '--primary-surface-inset: var(--space-3);',
]) assert.equal(primarySurfaceCss.includes(text), true, `共享一级表面样式缺少: ${text}`);

// 工厂详情不再由 BuildingsPage 打开移动 Sheet，但共享 Sheet 基础设施仍是其他移动详情的唯一宿主。
for (const text of [
  'Final authority for the single signed-in mobile workspace sheet',
  '.mobile-detail-sheet-backdrop {',
  '.mobile-detail-sheet-drag-handle',
  '.mobile-detail-sheet-scroll-area',
  '.mobile-detail-sheet-footer',
  '.mobile-workspace-sheet-detail-view',
]) assert.equal(sheetCss.includes(text), true, `共享移动 Sheet 样式缺少: ${text}`);
for (const text of [
  "from './useMobileWorkspaceSheetDrag'",
  'root.focus({ preventScroll: true });',
]) assert.equal(sharedHost.includes(text), true, `共享移动 Sheet Host 缺少: ${text}`);
assert.equal(sharedSheet.includes("from './MobileWorkspaceSheetHost'"), true, '共享详情适配器必须注册到唯一 Host');
for (const text of ['setPointerCapture', 'MOBILE_WORKSPACE_SHEET_CLOSE_VELOCITY', 'MOBILE_WORKSPACE_SHEET_AXIS_DOMINANCE']) {
  assert.equal(sharedDrag.includes(text), true, `共享移动拖动内核缺少: ${text}`);
}

for (const text of [
  '删除“建筑概况”卡片',
  '建筑列表不显示搜索输入框、产业分类下拉框或运行状态下拉框',
  '正式呈现恢复为原 4:5 插画卡片',
  '列表正式使用三列',
  '点击工厂卡片后进入当前地区建筑分区内部的二级详情视图',
  '地区子导航的名称与顺序以 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为唯一权威',
  '移动端工厂卡点击行为与桌面一致',
]) assert.equal(buildingLayoutDesign.includes(text), true, `地区建筑权威设计缺少: ${text}`);

console.log('统一工厂配方与地区卡片验证通过：目录顺序、三列 4:5 工厂卡、二级详情、无标题生产配置、游戏名词解释与共享移动基础设施均已锁定。');
