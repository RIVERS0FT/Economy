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
    for (const input of recipe.inputs)
      assert.ok(productIds.has(input.productId), `${facility.id}/${recipe.id} 输入商品无效`);
  }
}

const page = read('src/pages/BuildingsPage.tsx');
const detail = read('src/pages/production/ProductionFacilityDetail.tsx');
const mobile = read('src/pages/production/MobileFacilityDetailSheet.tsx');
const sharedSheet = read('src/components/ui/MobileWorkspaceDetailSheet.tsx');
const sharedDrag = read('src/components/ui/useMobileWorkspaceSheetDrag.ts');
const sharedSummary = read('src/components/ui/MobileDetailSummary.tsx');
const catalogPresentationDesign = read('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md');
const pageContentDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const productionSource = `${page}
${detail}
${mobile}
${sharedSheet}
${sharedDrag}
${sharedSummary}`;
assert.equal(
  page.includes('按产业和运行状态筛选建筑，选择后查看经营与生产详情。'),
  true,
  '建筑页必须说明正式复杂度顺序',
);
for (const forbidden of [
  'game.facilityTypes.sort(',
  'game.facilityTypes.toSorted(',
  'game.facilityTypes.slice().sort(',
]) assert.equal(page.includes(forbidden), false, `建筑页不得对服务器工厂目录二次排序: ${forbidden}`);
for (const required of [
  '正式目录必须按 `complexity` 从 `C1` 到 `C7` 升序排列',
  '同一复杂度内保持服务器目录声明的相对顺序',
  '不得对 `game.facilityTypes` 再次执行 `sort()` 或 `toSorted()`',
]) assert.equal(catalogPresentationDesign.includes(required), true, `工厂目录权威设计缺少: ${required}`);

for (const text of [
  'interface FacilityClusterEntry',
  'interface MobileWorkspaceSheetDragSession',
  'function FacilityClusterSelectorCard',
  'function FacilityClusterInformation',
  'function FacilityClusterDetailBody',
  'function FacilityMarketAction',
  'function FacilityClusterDetailContent',
  'function MobileFacilityDetailSheet',
  'function MobileWorkspaceDetailSheet',
  'function MobileDetailSummary',
  "import { createPortal } from 'react-dom';",
  "import { ScrollArea } from './ScrollArea';",
  "import { FacilityIcon } from '../../components/icons/FacilityIcons';",
  '<FacilityIcon facilityTypeId={type.id} className="facility-cluster-icon" />',
  'artworkClassName="facility-detail-artwork facility-information-artwork"',
  'className="facility-detail-artwork-icon"',
  '<FacilityStaffingSummary entry={entry} now={liveNow} />',
  'return createPortal(',
  "const [selectedFacilityGroupId, setSelectedFacilityGroupId] = useState('')",
  'const [isFacilityDetailOpen, setFacilityDetailOpen] = useState(false)',
  "window.matchMedia('(max-width: 720px)')",
  'game.facilityTypes.flatMap((type): FacilityClusterEntry[] =>',
  'if (!group || group.count < 1) return [];',
  'return [{ type, group: displayGroup }];',
  '?? filteredFacilityGroups[0]',
  'className="facility-cluster-selector-card"',
  'data-ui-interactive="surface"',
  'data-status={group.status}',
  'aria-label={`${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}，每分钟平均利润：${profit.accessibleValue}`}',
  'className="facility-cluster-name"',
  'className="facility-cluster-icon"',
  'className={`facility-cluster-profit is-${profit.tone}`}',
  'className="facility-cluster-count"',
  'className="facility-cluster-detail-shell"',
  'className="facility-production-settings mobile-detail-section"',
  'className="facility-production-settings-grid"',
  'className="facility-information"',
  '<MobileDetailSummary',
  'className="facility-information-summary"',
  'role="dialog"',
  'aria-modal="true"',
  'ariaLabelledBy="mobile-facility-detail-title"',
  'tabIndex={-1}',
  "event.key === 'Escape'",
  "event.key !== 'Tab'",
  'useLayoutEffect',
  "window.visualViewport?.height ?? window.innerHeight",
  "sheet?.focus({ preventScroll: true });",
  "document.querySelector<HTMLElement>('.page-scroll')",
  "pageScroll.style.overflowY = 'hidden'",
  "pageScrollArea.dataset.modalScrollbarSuppressed = 'true'",
  'returnFocusRef.current?.focus({ preventScroll: true })',
  'useWorkspaceDialogLayer',
  'WorkspaceFloatingLayerContext.Provider value={dialogLayer}',
  '!dialogLayer',
  '<strong>生产设置</strong>',
  'productionRecipeVariantId',
  'MOBILE_WORKSPACE_SHEET_CLOSE_VELOCITY',
  'MOBILE_WORKSPACE_SHEET_AXIS_DOMINANCE',
  'setPointerCapture',
  'const requestClose = useCallback',
  'const backdropPointerIdRef = useRef<number | undefined>(undefined)',
  'const isClosingRef = useRef(false)',
  'const handleBackdropPointerDown = useCallback',
  'const handleBackdropPointerUp = useCallback',
  'const handleBackdropPointerCancel = useCallback',
  'onPointerDown={handleBackdropPointerDown}',
  'onPointerUp={handleBackdropPointerUp}',
  'onPointerCancel={handleBackdropPointerCancel}',
  'isClosingRef.current = false;',
  "sheet.classList.add('is-settling', 'is-closing')",
  'requestClose(onOpenMarket)',
  'className="mobile-detail-sheet-drag-handle"',
  'className="mobile-detail-sheet-header"',
  'className="mobile-detail-sheet-footer"',
  'className="mobile-detail-sheet-scroll-area"',
  'viewportClassName="mobile-detail-sheet-scroll"',
  'scrollbarVisibility="adaptive"',
  '前往市场交易该工厂 →',
  'className="production-surface build-card production-build-card"',
  'className="production-surface facility-cluster-navigation"',
  'className="production-surface facility-card facility-group-card facility-cluster-detail-card"',
  'products={game.products}',
  'resolveFacilityProfitPresentation({',
])
  assert.equal(productionSource.includes(text), true, `建筑页组合源码缺少: ${text}`);

assert.equal(
  (mobile.match(/ariaLabelledBy="mobile-facility-detail-title"/g) ?? []).length,
  1,
  '移动详情框只能声明一次 aria-labelledby',
);
assert.equal(
  sharedSheet.includes("from './useMobileWorkspaceSheetDrag'"),
  true,
  '移动工厂详情必须复用共享工作区 Sheet 拖动内核',
);

const selectorCardSource = detail.slice(
  detail.indexOf('function FacilityClusterSelectorCard'),
  detail.indexOf('function FacilityClusterInformation'),
);
assert.equal(selectorCardSource.includes('×'), false, '工厂选择卡数量不得显示乘号');
assert.equal(selectorCardSource.includes(' x '), false, '工厂选择卡数量不得显示字母 x');
assert.equal(pageContentDesign.includes('亏损数字为红色且不显示负号'), true, '页面设计必须记录亏损数字不显示负号');
assert.equal(pageContentDesign.includes('亏损数字为红色且保留负号'), false, '页面设计不得保留亏损负号旧规则');

for (const forbidden of [
  'facility-group-card-shell',
  'className="facility-list facility-group-list"',
  'orderedFacilityGroups.map(({ group, type })',
  'label="生产周期"',
  'label="单座周期产量"',
  'label="单座周期成本"',
  '种植作物',
  '在统一订单簿中买卖该工厂',
  '>前往市场 →',
  'showNextCyclePreview = Boolean(pendingRecipe) || group.pendingJoinCount > 0',
  'recipes.length === 1',
  'closeButtonRef',
  'closeAction',
  'mobile-detail-sheet-close',
  "document.body.style.overflow = 'hidden'",
  'aria-label="关闭工厂详情"',
  'aria-pressed={isSelected}',
  'isSelected: boolean',
  'facility-current-selection-bar',
  '查看详情',
  'if (event.target === event.currentTarget) requestClose();',
  'useWorkspaceFloatingLayer',
  'selectedMethod.description',
  'constructionOnly',
  'FacilityConstructionAcceleration',
  'onAccelerateConstruction',
  '宝石加速',
])
  assert.equal(
    detail.includes(forbidden) || mobile.includes(forbidden),
    false,
    `工厂详情源码不应包含: ${forbidden}`,
  );

const facilitySheetBrowserTest = read('tests/browser/mobile-detail-sheet.spec.ts');
for (const text of [
  'view=production&scenario=activity',
  'hasTouch: true',
  'for (let iteration = 0; iteration < 3; iteration += 1)',
  'page.touchscreen.tap',
  'Input.dispatchTouchEvent',
  'data-input-modality',
  'outlineStyle',
  'await expect(trigger).toBeFocused()',
  "page.locator('.workspace-dialog-layer')",
  'expect(navigationCovered).toBe(true)',
  'for (const width of [320, 390, 430, 720])',
  'expect(sheetBox.x).toBeCloseTo(0, 1)',
  'expect(sheetBox.width).toBeCloseTo(width, 1)',
  "expect(alignment.justifyContent).toBe('stretch')",
  "'.mobile-detail-sheet-header > :not(.mobile-detail-sheet-drag-handle)'",
  "'.facility-production-formula .facility-average-profit'",
  "'.facility-information .facility-average-profit'",
])
  assert.equal(facilitySheetBrowserTest.includes(text), true, `移动工厂详情浏览器回归缺少: ${text}`);

const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
for (const text of [
  'function currentFormulaScope',
  'function clusterRecipeDescription',
  "group.status === 'running'",
  'group.participatingCount',
  'group.productionAvailableCount',
  'item.quantity * multiplier',
  'type.operatingCost * scope.count',
  'multiplier={scope.count}',
  'formatDuration(type.cycleMs)',
  '<FacilityGroupProgress group={group} type={type} now={now} />',
])
  assert.equal(formula.includes(text), true, `生产公式缺少: ${text}`);
for (const forbidden of [
  '单座配方每',
  'function recipeDescription',
  'multiplier={group.count}',
  'type.operatingCost * group.count',
  'item.quantity * group.count',
  'multiplier={group.pendingJoinCount}',
  'facility-formula-summary',
  'facility-formula-next-cycle',
  'facility-formula-scope',
  '总工时',
])
  assert.equal(formula.includes(forbidden), false, `生产公式不应包含: ${forbidden}`);

const css = read('src/styles/facility-group-card-grid.css');
for (const text of [
  '.production-workspace',
  'grid-template-areas: "build navigation detail";',
  '.facility-cluster-navigation',
  '.facility-cluster-selector-list',
  '.facility-cluster-selector-card',
  ".facility-cluster-selector-card[data-status='running']",
  ".facility-cluster-selector-card[data-status='error']",
  ".facility-cluster-selector-card[data-status='stopped']",
  ".facility-cluster-selector-card[data-status='constructing']",
  '.facility-cluster-name',
  '.facility-cluster-icon',
  '.facility-cluster-profit',
  '.facility-cluster-profit.is-positive',
  '.facility-cluster-profit.is-negative',
  '.facility-cluster-count',
  'max-width: 60rem;',
  'grid-template-columns: repeat(auto-fit, minmax(8.25rem, 1fr));',
  'minmax(480px, 1040px)',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  'aspect-ratio: 4 / 5;',
  'max-width: 10rem;',
  '.facility-cluster-selector-card::before',
  'inset: 0;',
  'width: 100%;',
  'height: 100%;',
  'transform: none;',
    'rgb(0 0 0 / 82%) 0%',
    'transparent 44%',
    'rgb(0 0 0 / 76%) 0%',
    'transparent 42%',
  '.facility-cluster-detail-shell',
  '.facility-cluster-detail-card',
  '.facility-information',
  '.facility-information > .facility-average-profit',
  '@media (max-width: 720px)',
])
  assert.equal(css.includes(text), true, `生产主从与悬浮框基础样式缺少: ${text}`);
for (const forbidden of [
  '.facility-cluster-selector-card:hover',
  '.facility-cluster-selector-card:active',
  '.facility-cluster-selector-card:focus-visible',
  '.facility-group-card-shell',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '--facility-card-height',
  'height: var(--facility-card-height)',
  '.facility-cluster-selector-card.is-selected',
  '.facility-current-selection-bar',
  '@media (max-width: 359px)',
  '@container (max-width: 479px)',
])
  assert.equal(css.includes(forbidden), false, `生产主从与悬浮框样式不应包含: ${forbidden}`);

const staffingRule = css.slice(
  css.indexOf('.facility-staffing-summary {'),
  css.indexOf('.facility-staffing-heading {'),
);
for (const forbidden of ['border:', 'border-radius:', 'background:'])
  assert.equal(staffingRule.includes(forbidden), false, `满员率状态不得恢复卡片外观: ${forbidden}`);

const settingsRuleStart = css.indexOf('.facility-production-settings {');
const settingsRule = css.slice(settingsRuleStart, css.indexOf('}', settingsRuleStart) + 1);
for (const required of [
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
]) assert.equal(css.includes(required), true, `生产设置响应式布局缺少: ${required}`);
for (const forbidden of ['border-radius:', 'background:'])
  assert.equal(settingsRule.includes(forbidden), false, `生产设置不得恢复嵌套卡片: ${forbidden}`);

const settlementStart = formula.indexOf('<section className="facility-production-formula"');
const settlementEnd = formula.indexOf('</section>', settlementStart);
const profitIndex = formula.indexOf('<FacilityRecipeProfitAnalysis', settlementStart);
const informationStart = detail.indexOf('className="facility-information"');
const informationProfitIndex = detail.indexOf('<FacilityRecipeProfitAnalysis', informationStart);
assert.equal(formula.includes('<strong>生产结算</strong>'), true, '生产公式缺少生产结算标题');
assert.equal(profitIndex, -1, '生产结算不得继续包含单厂利润');
assert.equal(informationProfitIndex > informationStart, true, '单厂利润必须位于工厂信息区');
void settlementEnd;

const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const profitRule = profitCss.slice(
  profitCss.indexOf('.facility-average-profit {'),
  profitCss.indexOf('.facility-average-profit__copy {'),
);
assert.equal(profitRule.includes('border-top:'), false, '利润组件基础样式不得绑定生产结算分隔线');
assert.equal(css.includes('.facility-information > .facility-average-profit'), true, '工厂信息必须承载利润行');
for (const forbidden of ['border:', 'border-radius:', 'background:'])
  assert.equal(profitRule.includes(forbidden), false, `单厂利润行不得恢复独立卡片: ${forbidden}`);

const detailBodySource = detail.slice(
  detail.indexOf('export function FacilityClusterDetailBody'),
  detail.indexOf('export function FacilityMarketAction'),
);
for (const forbidden of [
  'facility-recipe-section',
  'facility-production-method-section',
  '<strong>{selectedMethod.name}</strong>',
  'selectedMethod.description',
]) assert.equal(detailBodySource.includes(forbidden), false, `生产设置不得恢复拆分结构: ${forbidden}`);

const sheetCss = read('src/styles/mobile-detail-sheet.css');
for (const text of [
  'Final authority for signed-in mobile workspace sheets',
  ".page-scroll-area[data-modal-scrollbar-suppressed='true']",
  '--mobile-detail-sheet-backdrop-progress',
  '--mobile-detail-sheet-drag-offset',
  '.mobile-detail-sheet:focus',
  '.mobile-detail-sheet.is-dragging',
  '.mobile-detail-sheet.is-settling',
  '.mobile-detail-sheet.is-closing',
  'pointer-events: none;',
  '.mobile-detail-sheet-drag-handle',
  'touch-action: none;',
  '.mobile-detail-sheet-header',
  '.mobile-detail-sheet-scroll-area',
  '.mobile-detail-sheet-scroll',
  'overflow-y: auto;',
  'overscroll-behavior-y: auto;',
  '.mobile-detail-sheet-footer',
  'env(safe-area-inset-bottom)',
  'min-height: 32px;',
  '@media (prefers-reduced-motion: reduce)',
  '.workspace-dialog-layer > .mobile-detail-sheet-backdrop',
  'grid-template-columns: minmax(0, 1fr);',
  'justify-content: stretch;',
  'justify-items: stretch;',
  'justify-self: stretch;',
  '.workspace-dialog-layer > .ui-rich-select__listbox',
  '.mobile-detail-summary',
  '.mobile-workspace-page-sheet',
  'overscroll-behavior-y: contain;',
]) assert.equal(sheetCss.includes(text), true, `共享移动详情样式缺少: ${text}`);
for (const forbidden of [
  'display: none !important; /* vertical */',
  '.mobile-detail-sheet-close',
  '.workspace-floating-layer > .mobile-detail-sheet-backdrop',
  '.workspace-dialog-layer > .mobile-workspace-page-sheet',
  '.research-detail-sheet-scroll {',
]) assert.equal(sheetCss.includes(forbidden), false, `共享移动详情样式不应包含: ${forbidden}`);

for (const text of [
  '.mobile-detail-sheet .facility-production-settings-grid',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.mobile-detail-sheet-footer .facility-market-link-row',
  '.mobile-detail-sheet-footer .facility-market-link',
]) assert.equal(css.includes(text), true, `移动工厂详情业务样式缺少: ${text}`);

const main = read('src/main.tsx');
assert.equal(
  main.includes("import './styles/mobile-detail-sheet.css';"),
  true,
  '入口必须加载移动工作区 Sheet 样式',
);
assert.equal(
  main.indexOf("import './styles/mobile-detail-sheet.css';") >
    main.indexOf("import './styles/strategic-game-shell.css';"),
  true,
  '移动工作区 Sheet 样式必须晚于战略页面外壳加载以收束移动几何',
);

const formulaCss = read('src/styles/facility-production-formula.css');
for (const text of ['.facility-formula-side-label', 'font-variant-numeric: tabular-nums;'])
  assert.equal(formulaCss.includes(text), true, `生产公式样式缺少: ${text}`);
assert.equal(formulaCss.includes('.facility-formula-scope'), false, '生产结算范围长描述样式必须删除');

const surfaceCss = read('src/styles/production-surface.css');
for (const text of [
  '.panel.production-surface',
  '--production-pill-visible-height: 1.6rem;',
  '.panel.production-surface .facility-information-summary .mobile-detail-summary__heading',
  'min-height: var(--production-pill-visible-height);',
  '.panel.production-surface .facility-information-summary .mobile-detail-summary__action > .ui-switch {',
  'height: var(--production-pill-visible-height);',
  '.panel.production-surface .facility-information-summary .mobile-detail-summary__action > .ui-switch::before',
  'inset: 0;',
  'Primary surface padding is owned by primary-surfaces.css.',
])
  assert.equal(surfaceCss.includes(text), true, `生产一级表面样式缺少: ${text}`);
for (const forbidden of ['--production-surface-inset', 'padding: var(--production-surface-inset);']) {
  assert.equal(surfaceCss.includes(forbidden), false, `生产一级表面样式不应包含: ${forbidden}`);
}

const primarySurfaceCss = read('src/styles/primary-surfaces.css');
for (const text of [
  '--primary-surface-inset: var(--space-4);',
  '.panel.ui-primary-surface {',
  'padding: var(--primary-surface-inset);',
  '@media (max-width: 720px)',
  '--primary-surface-inset: var(--space-3);',
])
  assert.equal(primarySurfaceCss.includes(text), true, `共享一级表面样式缺少: ${text}`);

const warehouse = read('src/components/warehouse/WarehouseInventoryPanel.tsx');
assert.equal(
  warehouse.includes('production-surface warehouse-inventory-panel'),
  true,
  '共享仓库必须使用 production-surface',
);

const industryDoc = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
for (const text of [
  '建筑管理区：建设新工厂 + 可筛选建筑列表 + 当前建筑详情',
  '默认详情工厂是正式目录顺序中的第一种已拥有工厂',
  '首次进入移动端只建立默认详情目标，不自动弹出详情悬浮框',
  '当前详情工厂必须使用独立本地状态',
  '桌面和平板只渲染一个当前工厂的完整详情',
  '不大于 `720px` 时页面内只显示固定三列的紧凑工厂选择网格',
  '不显示独立“当前工厂”栏或“查看详情”按钮',
  '选择卡统一为 `4:5` 竖卡',
  '`FacilityIcon` 场景插画等比铺满整卡并以中心裁切',
  '选择卡右上角显示与详情相同口径的单厂有效平均利润／分钟',
  '正数不加正号并使用绿色，负数显示绝对值、不显示负号并使用红色',
    '不得恢复“正数不加正号并使用绿色，负数保留负号并使用红色”的旧规则',
  '不得显示货币图标、货币符号、“利润”“每分钟”“/分”等标签、单位或胶囊',
  '不使用 `aria-pressed`、选中描边或持久选中背景',
  '绿色、红色、灰色分别表达运行中、异常、已停止',
  '所有工厂详情统一显示启用的“生产配方”选择器',
  '单配方工厂显示唯一选项并保持启用',
  '重复选择当前正式配方不得提交经济动作',
  '工厂信息是唯一身份与经营摘要区',
  '详情只显示一行“单厂平均利润／分钟”',
  '指标固定按一座工厂计算',
  '打开后焦点进入可程序化聚焦的对话框容器',
  '不显示关闭按钮',
  '点击遮罩和按下 `Escape` 必须与有效下拉关闭共用同一收起流程',
  '关闭互斥状态只覆盖当前一次收起流程',
  '不得只依赖移动浏览器合成的 `click`',
  '稳定视觉视口高度快照',
  '关闭后焦点返回触发卡',
  '固定拖动头部／唯一 `ScrollArea` 正文／固定底部操作区',
  '正文 `scrollTop` 实际变化后显示',
  '空闲 `1600ms` 后淡出',
  '正文 `scrollTop = 0`',
  '向下距离达到悬浮框高度的 `25%`',
  '`src/styles/mobile-detail-sheet.css`',
  '`MobileWorkspaceDetailSheet`',
  '`MobileDetailSummary`',
  '视口变为大于 `720px` 时必须自动关闭并解除滚动锁与轨道抑制',
  '选择卡内部不得嵌套运行开关、配方选择器或市场按钮',
  '生产公式只展示集群参数',
  '公式不得使用总持有 `count` 作为生产乘数',
  '玩家可见“生产产物”与“作业制度”必须合并为同一个“生产设置”区',
  '生产进度位于数据带下方，并且是生产结算最后一个可见元素',
  '移动工厂详情必须 Portal 到 `SignedInShell` 的根级业务 Dialog 层',
  'Bottom Sheet 左边缘固定为视口 `x = 0`',
  '生产设置下方不得显示“周期 · 产出 · 成本”摘要、制度说明或重复当前制度名称',
])
  assert.equal(industryDoc.includes(text), true, `产业设计缺少: ${text}`);
for (const forbidden of [
  '右侧工厂集群列表',
  '生产管理区',
  '大于 1380px 时右侧固定四列',
  '移动端恢复自然高度；不得在单张卡内部增加纵向滚动条',
  '单配方工厂显示唯一选项并禁用',
  '打开后焦点进入关闭按钮',
  '`Escape`、关闭按钮、点击遮罩',
  '关闭按钮点击区域不得小于',
])
  assert.equal(industryDoc.includes(forbidden), false, `产业设计不应保留旧页面规则: ${forbidden}`);

const catalogDoc = read('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md');
for (const text of [
  '建筑页已拥有工厂集群选择卡',
  '默认选择过滤结果中的第一项',
  '详情目标状态与建设下拉框状态必须独立',
  '选择卡不绘制持久选中态',
  '五秒状态轮询只替换权威工厂数据',
  '不得把“运行中优先”“最近查看”作为默认详情规则',
])
  assert.equal(catalogDoc.includes(text), true, `工厂目录展示设计缺少: ${text}`);

for (const [path, required] of [
  [
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    [
      '建设卡不显示生产周期、单座产量和单座成本',
      '公式只展示集群输入、输出、周期和成本',
      '运行中公式使用 `participatingCount`、实时投影的 `staffingRateBps` 和跨周期 `staffingBatchCarryBps`，在周期完成时计算整数等效产能',
      '移动端选择网格固定三列',
      '`FacilityIcon` 场景插画等比居中裁切并铺满整卡',
      '右上只显示单厂有效平均利润数字',
    ],
  ],
  [
    'docs/UI_DESIGN_SYSTEM.md',
    [
      '生产公式是集群运行能力展示',
      '停止或异常使用 `productionAvailableCount`、实时投影的满员率和 `staffingBatchCarryBps` 计算启动后或恢复后的整数等效产能',
      '不得使用 `group.count` 作为公式乘数',
      '工厂集群选择卡统一为最大宽度 `160px`、`4:5` 竖卡',
      '盈利为绿色且不加正号，亏损为红色、显示绝对值且不显示负号',
        '不得恢复“盈利为绿色且不加正号，亏损为红色且保留负号”的旧规则',
        '上下两层黑色渐变',
        '中央主体区域保持透明',
      '卡片点击不保留选中态',
      '当前工厂详情顺序固定为“移动把手（桌面无）→ 工厂信息 → 满员率 → 生产设置 → 生产结算 → 经营诊断 → 市场入口”',
      '玩家可见的“生产产物”与“作业制度”固定使用同一个“生产设置”区',
      '生产进度位于数据带下方，并且是生产结算最后一个可见元素',
      '作业制度说明不得显示',
      '根级 Dialog',
    ],
  ],
  [
    'docs/PRIMARY_SURFACE_INSET_DESIGN.md',
    [
      '建筑页 `.panel.production-surface` 的独立桌面／移动 padding',
      '`src/styles/primary-surfaces.css` 是玩家端一级卡片外层内边距的唯一 CSS 权威',
    ],
  ],
]) {
  const content = read(path);
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log(
  '工厂集群三列状态卡、无持久选中态、主从布局、状态标题层级、无顶部关闭按钮、统一收起动画、单厂平均利润布局、紧凑标题、共享活动滚动条、目录顺序默认详情、焦点与滚动控制、通用配方和集群公式验证通过。',
);
