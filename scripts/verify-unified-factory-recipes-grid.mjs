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

const page = read('src/pages/ProductionPage.tsx');
const detail = read('src/pages/production/ProductionFacilityDetail.tsx');
const mobile = read('src/pages/production/MobileFacilityDetailSheet.tsx');
const productionSource = `${page}
${detail}
${mobile}`;
for (const text of [
  'interface FacilityClusterEntry',
  'interface FacilitySheetDragSession',
  'function FacilityClusterSelectorCard',
  'function FacilityClusterDetailHeader',
  'function FacilityClusterDetailBody',
  'function FacilityMarketAction',
  'function FacilityClusterDetailContent',
  'function MobileFacilityDetailSheet',
  "import { createPortal } from 'react-dom';",
  "import { ScrollArea } from '../../components/ui/ScrollArea';",
  "import { FacilityIcon } from '../../components/icons/FacilityIcons';",
  '<FacilityIcon facilityTypeId={type.id} className="facility-cluster-icon" />',
  'return createPortal(',
  "const [selectedFacilityGroupId, setSelectedFacilityGroupId] = useState('')",
  'const [isFacilityDetailOpen, setFacilityDetailOpen] = useState(false)',
  "window.matchMedia('(max-width: 720px)')",
  'game.facilityTypes.flatMap((type): FacilityClusterEntry[] =>',
  'return group && group.count > 0 ? [{ type, group }] : [];',
  '?? orderedFacilityGroups[0]',
  'className="facility-cluster-selector-card"',
  'data-ui-interactive="surface"',
  'data-status={group.status}',
  'aria-label={`${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}，每分钟平均利润：${profit.accessibleValue}`}',
  'className="facility-cluster-name"',
  'className="facility-cluster-icon"',
  'className={`facility-cluster-profit is-${profit.tone}`}',
  'className="facility-cluster-count"',
  'className="facility-cluster-detail-shell"',
  'className="facility-production-settings"',
  'className="facility-production-settings-grid"',
  'className="facility-card-title-block facility-cluster-selector-heading"',
  'role="dialog"',
  'aria-modal="true"',
  'aria-labelledby="mobile-facility-detail-title"',
  'tabIndex={-1}',
  "event.key === 'Escape'",
  "event.key !== 'Tab'",
  "document.body.style.overflow = 'hidden'",
  "document.querySelector<HTMLElement>('.page-scroll')",
  "pageScroll.style.overflowY = 'hidden'",
  "pageScrollArea.dataset.modalScrollbarSuppressed = 'true'",
  'returnFocusRef.current?.focus()',
  '<strong>生产设置</strong>',
  '下一周期切换为：',
  'showNextCyclePreview={recipeState.showNextCyclePreview}',
  'productionRecipeVariantId',
  'FACILITY_SHEET_CLOSE_VELOCITY',
  'FACILITY_SHEET_AXIS_DOMINANCE',
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
  'className="facility-detail-sheet-drag-handle"',
  'className="facility-detail-sheet-header"',
  'className="facility-detail-sheet-footer"',
  'className="facility-detail-sheet-scroll-area"',
  'viewportClassName="facility-detail-sheet-scroll"',
  'scrollbarVisibility="adaptive"',
  '前往市场交易该工厂 →',
  'className="production-surface build-card production-build-card"',
  'className="production-surface facility-cluster-navigation"',
  'className="production-surface facility-card facility-group-card facility-cluster-detail-card"',
  'products={game.products}',
  'resolveFacilityProfitPresentation({',
])
  assert.equal(productionSource.includes(text), true, `生产页组合源码缺少: ${text}`);

assert.equal(
  (mobile.match(/aria-labelledby="mobile-facility-detail-title"/g) ?? []).length,
  1,
  '移动详情框只能声明一次 aria-labelledby',
);

const selectorCardSource = detail.slice(
  detail.indexOf('function FacilityClusterSelectorCard'),
  detail.indexOf('function FacilityClusterDetailHeader'),
);
assert.equal(selectorCardSource.includes('×'), false, '工厂选择卡数量不得显示乘号');
assert.equal(selectorCardSource.includes(' x '), false, '工厂选择卡数量不得显示字母 x');

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
  'facility-detail-sheet-close',
  'aria-label="关闭工厂详情"',
  'aria-pressed={isSelected}',
  'isSelected: boolean',
  'facility-current-selection-bar',
  '查看详情',
  'if (event.target === event.currentTarget) requestClose();',
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

const facilitySheetBrowserTest = read('tests/browser/facility-detail-sheet.spec.ts');
for (const text of [
  'view=production&scenario=activity',
  'hasTouch: true',
  'for (let iteration = 0; iteration < 3; iteration += 1)',
  'page.touchscreen.tap',
  'Input.dispatchTouchEvent',
  'data-input-modality',
  'outlineStyle',
  'await expect(trigger).toBeFocused()',
])
  assert.equal(facilitySheetBrowserTest.includes(text), true, `移动工厂详情浏览器回归缺少: ${text}`);

const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
for (const text of [
  'function currentFormulaScope',
  'function nextFormulaScope',
  'function clusterRecipeDescription',
  "group.status === 'running'",
  'group.participatingCount',
  'group.nextCycleCount',
  'item.quantity * multiplier',
  'type.operatingCost * scope.count',
  'multiplier={scope.count}',
  'facility-formula-scope',
  'formatDuration(type.cycleMs)',
  '<FacilityGroupProgress group={group} type={type} now={now} />',
  'showNextCyclePreview',
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
  '.facility-detail-sheet-backdrop',
  '.facility-detail-sheet',
  'max-height: min(88dvh, 760px);',
  'env(safe-area-inset-bottom)',
  '.facility-detail-sheet-scroll',
  'overscroll-behavior-y: auto;',
  '.facility-detail-sheet .facility-status-header',
  '.facility-detail-sheet .facility-card-title-row > .ui-switch',
  'position: sticky;',
  '.facility-detail-sheet .facility-market-link-row',
  '@media (max-width: 720px)',
  '@media (prefers-reduced-motion: reduce)',
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
])
  assert.equal(css.includes(forbidden), false, `生产主从与悬浮框样式不应包含: ${forbidden}`);

const staffingRule = css.slice(
  css.indexOf('.facility-staffing-summary {'),
  css.indexOf('.facility-staffing-heading {'),
);
for (const forbidden of ['border:', 'border-radius:', 'background:'])
  assert.equal(staffingRule.includes(forbidden), false, `满员率状态不得恢复卡片外观: ${forbidden}`);

const settingsRule = css.slice(
  css.indexOf('.facility-production-settings {'),
  css.indexOf('.facility-production-formula {'),
);
for (const required of [
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '@container (max-width: 479px)',
]) assert.equal(css.includes(required), true, `生产设置响应式布局缺少: ${required}`);
for (const forbidden of ['border-radius:', 'background:'])
  assert.equal(settingsRule.includes(forbidden), false, `生产设置不得恢复嵌套卡片: ${forbidden}`);

const settlementStart = formula.indexOf('<section className="facility-production-formula"');
const settlementEnd = formula.indexOf('</section>', settlementStart);
const profitIndex = formula.indexOf('<FacilityRecipeProfitAnalysis', settlementStart);
assert.equal(formula.includes('<strong>生产结算</strong>'), true, '生产公式缺少生产结算标题');
assert.equal(profitIndex > settlementStart && profitIndex < settlementEnd, true, '单厂利润必须位于生产结算容器内');

const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const profitRule = profitCss.slice(
  profitCss.indexOf('.facility-average-profit {'),
  profitCss.indexOf('.facility-average-profit__copy {'),
);
assert.equal(profitRule.includes('border-top:'), true, '单厂利润行必须保留结算分隔线');
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
]) assert.equal(detailBodySource.includes(forbidden), false, `生产设置不得恢复拆分结构: ${forbidden}`);

const sheetCss = read('src/styles/facility-detail-sheet.css');
for (const text of [
  'Final authority for the mobile factory detail sheet',
  ".page-scroll-area[data-modal-scrollbar-suppressed='true']",
  '--facility-sheet-backdrop-progress',
  '--facility-sheet-drag-offset',
  '.facility-detail-sheet:focus',
  '.facility-detail-sheet.is-dragging',
  '.facility-detail-sheet.is-settling',
  '.facility-detail-sheet.is-closing',
  'pointer-events: none;',
  '.facility-detail-sheet-drag-handle',
  'touch-action: none;',
  '.facility-card-title-block',
  '.facility-detail-sheet-scroll-area',
  '.facility-detail-sheet-scroll',
  'overflow-y: auto;',
  'overscroll-behavior-y: auto;',
  '.facility-detail-sheet-footer',
  'env(safe-area-inset-bottom)',
  'min-height: 48px;',
  '@media (prefers-reduced-motion: reduce)',
])
  assert.equal(sheetCss.includes(text), true, `移动工厂详情样式缺少: ${text}`);
for (const forbidden of [
  'overscroll-behavior-y: contain',
  'display: none !important; /* vertical */',
  '.facility-detail-sheet-close',
])
  assert.equal(sheetCss.includes(forbidden), false, `移动工厂详情样式不应包含: ${forbidden}`);

const main = read('src/main.tsx');
assert.equal(
  main.includes("import './styles/facility-detail-sheet.css';"),
  true,
  '入口必须在旧工厂卡样式后加载移动详情样式',
);
assert.equal(
  main.indexOf("import './styles/facility-detail-sheet.css';") >
    main.indexOf("import './styles/facility-group-card-grid.css';"),
  true,
  '移动详情样式必须晚于基础工厂卡样式加载',
);

const formulaCss = read('src/styles/facility-production-formula.css');
for (const text of ['.facility-formula-scope', 'justify-self: end;', 'font-variant-numeric: tabular-nums;'])
  assert.equal(formulaCss.includes(text), true, `生产公式样式缺少: ${text}`);

const surfaceCss = read('src/styles/production-surface.css');
for (const text of [
  '.panel.production-surface',
  '--production-pill-visible-height: 1.6rem;',
  '.panel.production-surface .facility-card-title-row',
  'min-height: var(--production-pill-visible-height);',
  '.panel.production-surface .facility-card-title-row > .ui-switch {',
  'height: var(--production-pill-visible-height);',
  '.panel.production-surface .facility-card-title-row > .ui-switch::before',
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

const warehouse = read('src/components/warehouse/WarehouseUpgradeCard.tsx');
assert.equal(
  warehouse.includes('production-surface warehouse-upgrade-card'),
  true,
  '共享仓库必须使用 production-surface',
);

const industryDoc = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
for (const text of [
  '生产管理区：建设新工厂 + 工厂集群选择 + 当前工厂详情',
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
  '完整状态与工厂名称放在同一紧凑标题行',
  '详情只显示一行“单厂平均利润／分钟”',
  '指标固定按一座工厂计算',
  '打开后焦点进入可程序化聚焦的对话框容器',
  '不包含顶部关闭按钮',
  '点击遮罩和按下 `Escape` 必须与有效下拉关闭共用同一收起流程',
  '关闭互斥状态只覆盖当前一次收起流程',
  '不得只依赖移动浏览器合成的 `click`',
  '悬浮框最大高度为 `min(88dvh, 760px)`',
  '关闭后焦点返回触发卡',
  '固定头部／唯一 `ScrollArea` 正文／固定底部操作区',
  '正文 `scrollTop` 实际变化后显示',
  '空闲 `1600ms` 后淡出',
  '正文 `scrollTop = 0`',
  '向下距离达到悬浮框高度的 `25%`',
  '`src/styles/facility-detail-sheet.css`',
  '视口变为大于 `720px` 时必须自动关闭并解除滚动锁与轨道抑制',
  '选择卡内部不得嵌套运行开关、配方选择器或市场按钮',
  '生产公式只展示集群参数',
  '公式不得使用总持有 `count` 作为生产乘数',
  '生产配方与作业制度必须合并为同一个“生产设置”区',
  '生产公式与单厂平均利润共同属于同一个“生产结算”容器',
])
  assert.equal(industryDoc.includes(text), true, `产业设计缺少: ${text}`);
for (const forbidden of [
  '右侧工厂集群列表',
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
  '生产页已拥有工厂集群选择卡',
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
      '当前周期显示 `participatingCount`、`cycleStaffingRateBps` 和 `cycleEffectiveCount`',
      '移动端选择网格固定三列',
      '`FacilityIcon` 场景插画等比居中裁切并铺满整卡',
      '右上只显示单厂有效平均利润数字',
    ],
  ],
  [
    'docs/UI_DESIGN_SYSTEM.md',
    [
      '生产公式是集群运行能力展示',
      '停止或异常使用 `nextCycleCount`、预计满员率与 `nextCycleEffectiveCount`',
      '不得使用 `group.count` 作为公式乘数',
      '工厂集群选择卡统一为最大宽度 `160px`、`4:5` 竖卡',
      '盈利为绿色且不加正号，亏损为红色、显示绝对值且不显示负号',
        '不得恢复“盈利为绿色且不加正号，亏损为红色且保留负号”的旧规则',
        '上下两层黑色渐变',
        '中央主体区域保持透明',
      '卡片点击不保留选中态',
      '紧凑满员率状态必须使用无独立边框、圆角和背景的状态带',
      '生产配方与作业制度使用同一个“生产设置”区',
      '公式、进度和单厂平均利润共同组成一张“生产结算”卡',
    ],
  ],
  [
    'docs/PRIMARY_SURFACE_INSET_DESIGN.md',
    [
      '生产页 `.panel.production-surface` 的独立桌面／移动 padding',
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
