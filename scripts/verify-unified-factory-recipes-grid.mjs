import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));

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
  "import { ScrollArea } from '../components/ui/ScrollArea';",
  'return createPortal(',
  "const [selectedFacilityGroupId, setSelectedFacilityGroupId] = useState('')",
  'const [isFacilityDetailOpen, setFacilityDetailOpen] = useState(false)',
  "window.matchMedia('(max-width: 720px)')",
  'game.facilityTypes.flatMap((type) =>',
  'group && group.count > 0',
  '?? orderedFacilityGroups[0]',
  'aria-pressed={isSelected}',
  'className={`facility-cluster-selector-card',
  'className="facility-current-selection-bar"',
  'className="facility-cluster-detail-shell"',
  'role="dialog"',
  'aria-modal="true"',
  'aria-labelledby="mobile-facility-detail-title"',
  "event.key === 'Escape'",
  "event.key !== 'Tab'",
  "document.body.style.overflow = 'hidden'",
  "document.querySelector<HTMLElement>('.page-scroll')",
  "pageScroll.style.overflowY = 'hidden'",
  "pageScrollArea.dataset.modalScrollbarSuppressed = 'true'",
  'detailTriggerRef.current?.focus()',
  '<strong>生产配方</strong>',
  '下一周期切换为：',
  'showNextCyclePreview={recipeState.showNextCyclePreview}',
  'event.target.value !== recipeState.selectedRecipeId',
  'FACILITY_SHEET_CLOSE_VELOCITY',
  'FACILITY_SHEET_AXIS_DOMINANCE',
  'setPointerCapture',
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
])
  assert.equal(page.includes(text), true, `生产页缺少: ${text}`);

assert.equal(
  (page.match(/aria-labelledby="mobile-facility-detail-title"/g) ?? []).length,
  1,
  '移动详情框只能声明一次 aria-labelledby',
);

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
])
  assert.equal(page.includes(forbidden), false, `生产页不应包含: ${forbidden}`);

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
  '.facility-cluster-selector-card.is-selected',
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
  '.facility-group-card-shell',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '--facility-card-height',
  'height: var(--facility-card-height)',
])
  assert.equal(css.includes(forbidden), false, `生产主从与悬浮框样式不应包含: ${forbidden}`);

const sheetCss = read('src/styles/facility-detail-sheet.css');
for (const text of [
  'Final authority for the mobile factory detail sheet',
  ".page-scroll-area[data-modal-scrollbar-suppressed='true']",
  '--facility-sheet-backdrop-progress',
  '--facility-sheet-drag-offset',
  '.facility-detail-sheet.is-dragging',
  '.facility-detail-sheet.is-settling',
  '.facility-detail-sheet-drag-handle',
  'touch-action: none;',
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
for (const forbidden of ['overscroll-behavior-y: contain', 'display: none !important; /* vertical */'])
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
  '首次进入移动端只选中默认工厂，不自动弹出详情悬浮框',
  '当前详情工厂必须使用独立本地状态',
  '桌面和平板只渲染一个当前工厂的完整详情',
  '不大于 `720px` 时页面内只显示当前选择栏和紧凑工厂选择网格',
  '悬浮框最大高度为 `min(88dvh, 760px)`',
  '关闭后焦点返回触发卡',
  '视口变为大于 `720px` 时必须自动关闭并解除滚动锁',
  '选择卡内部不得嵌套运行开关、配方选择器或市场按钮',
  '生产公式只展示集群参数',
  '公式不得使用总持有 `count` 作为公式乘数',
])
  assert.equal(industryDoc.includes(text), true, `产业设计缺少: ${text}`);
for (const forbidden of [
  '右侧工厂集群列表',
  '大于 1380px 时右侧固定四列',
  '移动端恢复自然高度；不得在单张卡内部增加纵向滚动条',
])
  assert.equal(industryDoc.includes(forbidden), false, `产业设计不应保留旧页面规则: ${forbidden}`);

const sheetDoc = read('docs/MOBILE_FACILITY_DETAIL_SHEET_DESIGN.md');
for (const text of [
  '本文件是移动工厂详情悬浮框的最终设计权威',
  '单配方工厂显示唯一选项并保持启用',
  '重复选择相同正式配方不得提交经济动作',
  '唯一 ScrollArea 正文',
  '固定底部操作区',
  '仅在 `scrollTop` 实际变化后显示纵向轨道',
  '空闲 `1600ms` 后淡出',
  '正文 `scrollTop = 0`',
  '向下距离达到悬浮框高度的 `25%`',
  '关闭后焦点返回触发控件',
  '`src/styles/facility-detail-sheet.css`',
])
  assert.equal(sheetDoc.includes(text), true, `移动工厂详情设计缺少: ${text}`);

const catalogDoc = read('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md');
for (const text of [
  '生产页已拥有工厂集群选择卡',
  '默认选择过滤结果中的第一项',
  '详情选择状态与建设下拉框状态必须独立',
  '五秒状态轮询只替换权威工厂数据',
  '不得把“运行中优先”“最近查看”作为默认详情规则',
])
  assert.equal(catalogDoc.includes(text), true, `工厂目录展示设计缺少: ${text}`);

for (const [path, required] of [
  [
    'README.md',
    [
      '建设卡只显示建造费用和施工时间',
      '生产公式只展示集群参数',
      '运行中按 `participatingCount`',
      '生产管理区采用工厂集群主从布局',
      '移动端不展开全部详情',
      '工厂详情选择与建设类型选择使用独立客户端状态',
    ],
  ],
  [
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    [
      '建设卡不显示生产周期、单座产量和单座成本',
      '公式只展示集群输入、输出、周期和成本',
      '当前周期只使用 `participatingCount`',
    ],
  ],
  [
    'docs/UI_DESIGN_SYSTEM.md',
    ['生产公式是集群运行能力展示', '停止或异常使用 `nextCycleCount`', '不得使用 `group.count` 作为公式乘数'],
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
  '工厂集群主从布局、可拖动移动详情框、共享活动滚动条、启用单配方选择器、目录顺序默认选择、焦点与滚动控制、通用配方和集群公式验证通过。',
);
