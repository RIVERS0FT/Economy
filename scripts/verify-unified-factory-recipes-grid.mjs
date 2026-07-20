import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));

for (const facility of FACILITY_TYPE_CATALOG) {
  assert.ok(Array.isArray(facility.recipes) && facility.recipes.length >= 1, `${facility.id} 必须显式提供配方`);
  assert.ok(facility.defaultRecipeId, `${facility.id} 缺少默认配方`);
  assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId), `${facility.id} 默认配方无效`);
  assert.equal(new Set(facility.recipes.map((recipe) => recipe.id)).size, facility.recipes.length, `${facility.id} 配方 ID 必须唯一`);
  for (const recipe of facility.recipes) {
    assert.ok(recipe.name, `${facility.id}/${recipe.id} 缺少正式名称`);
    assert.ok(recipe.cycleMs > 0, `${facility.id}/${recipe.id} 周期无效`);
    assert.ok(recipe.operatingCost >= 0, `${facility.id}/${recipe.id} 成本无效`);
    assert.ok(productIds.has(recipe.output.productId), `${facility.id}/${recipe.id} 输出商品无效`);
    assert.ok(Array.isArray(recipe.inputs), `${facility.id}/${recipe.id} 必须使用 inputs[]`);
    for (const input of recipe.inputs) assert.ok(productIds.has(input.productId), `${facility.id}/${recipe.id} 输入商品无效`);
  }
}

const page = read('src/pages/ProductionPage.tsx');
for (const text of [
  'facility-group-card-shell',
  'facility-card-title-row',
  'facility-card-status-row',
  'facility-count-summary',
  'facility-recipe-section',
  '<strong>生产配方</strong>',
  '下一周期切换为：',
  '公式展示本周期或恢复后的集群输入、输出与成本',
  '固定配方：',
  '可选配方：',
  'label="建造费用"',
  'label="施工时间"',
  'disabled={group.count < 1 || recipes.length === 1}',
  'showNextCyclePreview={showNextCyclePreview}',
  'facility-card-spacer',
  '前往市场交易该工厂 →',
  'className="production-surface widget build-card production-build-card"',
  'className="production-surface facility-card facility-group-card"',
]) assert.equal(page.includes(text), true, `生产页缺少: ${text}`);
for (const forbidden of [
  'label="生产周期"',
  'label="单座周期产量"',
  'label="单座周期成本"',
  '种植作物',
  '在统一订单簿中买卖该工厂',
  '>前往市场 →',
  'showNextCyclePreview = Boolean(pendingRecipe) || group.pendingJoinCount > 0',
]) assert.equal(page.includes(forbidden), false, `生产页不应包含: ${forbidden}`);

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
]) assert.equal(formula.includes(text), true, `生产公式缺少: ${text}`);
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
]) assert.equal(formula.includes(forbidden), false, `生产公式不应包含: ${forbidden}`);

const css = read('src/styles/facility-group-card-grid.css');
for (const text of [
  '.facility-group-card-shell',
  'container-type: inline-size;',
  'grid-template-areas:',
  'grid-area: title;',
  'grid-area: status;',
  'grid-area: summary;',
  '.facility-card-title-row',
  'grid-template-columns: minmax(0, 1fr) auto;',
  '.facility-card-status-row',
  '.facility-count-summary',
  '.facility-market-link-row',
  'align-self: end;',
  '.facility-card-spacer',
]) assert.equal(css.includes(text), true, `卡片样式缺少: ${text}`);
for (const forbidden of ['--facility-card-height', 'grid-auto-rows: 1fr;', 'height: var(--facility-card-height)']) {
  assert.equal(css.includes(forbidden), false, `卡片样式不应包含: ${forbidden}`);
}

const formulaCss = read('src/styles/facility-production-formula.css');
for (const text of [
  '.facility-formula-scope',
  'justify-self: end;',
  'font-variant-numeric: tabular-nums;',
]) assert.equal(formulaCss.includes(text), true, `生产公式样式缺少: ${text}`);

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
]) assert.equal(surfaceCss.includes(text), true, `生产一级表面样式缺少: ${text}`);
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
]) assert.equal(primarySurfaceCss.includes(text), true, `共享一级表面样式缺少: ${text}`);

const warehouse = read('src/components/warehouse/WarehouseUpgradeCard.tsx');
assert.equal(warehouse.includes('production-surface warehouse-upgrade-card'), true, '共享仓库必须使用 production-surface');

for (const [path, required] of [
  ['README.md', ['建设卡只显示建造费用和施工时间', '生产公式只展示集群参数', '运行中按 `participatingCount`']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['建设卡不得显示生产周期、单座周期产量或单座周期成本', '生产公式只展示集群参数', '停止或异常使用 `nextCycleCount`']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['建设卡不显示生产周期、单座产量和单座成本', '公式只展示集群输入、输出、周期和成本', '当前周期只使用 `participatingCount`']],
  ['docs/UI_DESIGN_SYSTEM.md', ['生产公式是集群运行能力展示', '停止或异常使用 `nextCycleCount`', '不得使用 `group.count` 作为公式乘数']],
  ['docs/PRIMARY_SURFACE_INSET_DESIGN.md', ['生产页 `.panel.production-surface` 的独立桌面／移动 padding', '`src/styles/primary-surfaces.css` 是玩家端一级卡片外层内边距的唯一 CSS 权威']],
]) {
  const content = read(path);
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log('通用工厂配方、建设卡精简、集群规模公式、三行标题结构、底部市场入口和共享一级表面内边距验证通过。');
