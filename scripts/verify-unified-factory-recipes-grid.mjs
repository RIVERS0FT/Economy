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
    if (recipe.input) assert.ok(productIds.has(recipe.input.productId), `${facility.id}/${recipe.id} 输入商品无效`);
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
  "return '运行中'",
  "return '已停止'",
  'disabled={group.count < 1 || recipes.length === 1}',
  'showNextCyclePreview={showNextCyclePreview}',
  'facility-card-spacer',
  '前往市场交易该工厂 →',
  'className="production-surface widget build-card production-build-card"',
  'className="production-surface facility-card facility-group-card"',
]) assert.equal(page.includes(text), true, `生产页缺少: ${text}`);
for (const forbidden of [
  '种植作物',
  '在统一订单簿中买卖该工厂',
  '>前往市场 →',
  '{recipes.length > 1 ? (',
  '<StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>\n                      <h2>',
]) {
  assert.equal(page.includes(forbidden), false, `生产页不应包含: ${forbidden}`);
}

const warehouse = read('src/components/warehouse/WarehouseUpgradeCard.tsx');
assert.equal(warehouse.includes('production-surface warehouse-upgrade-card'), true, '共享仓库必须使用 production-surface');

const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
for (const text of [
  'multiplier={activeCount}',
  'type.operatingCost * activeCount',
  'nextType.operatingCost * nextCount',
  'formatDuration(type.cycleMs)',
  'formatDuration(nextType.cycleMs)',
]) assert.equal(formula.includes(text), true, `生产公式缺少: ${text}`);
for (const forbidden of [
  'facility-formula-summary',
  'facility-formula-next-cycle',
  'type.cycleMs * activeCount',
  'nextType.cycleMs * nextCount',
  '总工时',
]) assert.equal(formula.includes(forbidden), false, `生产公式不应包含: ${forbidden}`);

const css = read('src/styles/facility-group-card-grid.css');
for (const text of [
  '.facility-group-card-shell',
  'container-type: inline-size;',
  'align-self: stretch;',
  'grid-template-rows: auto auto auto minmax(0, 1fr) auto;',
  'grid-template-areas:',
  'grid-area: title;',
  'grid-area: status;',
  'grid-area: summary;',
  '.facility-card-title-row',
  'grid-template-columns: minmax(0, 1fr) auto;\n  align-items: start;',
  'line-height: var(--line-height-tight);',
  '.facility-card-status-row',
  '.facility-count-summary',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  'grid-auto-rows: auto;',
  '@container (max-width: 319px)',
  '@container (min-width: 320px) and (max-width: 419px)',
  '@container (min-width: 420px)',
  '.facility-market-link-row',
  'align-self: end;',
  '.facility-card-spacer',
  '@media (max-width: 960px)',
  'display: none;',
]) assert.equal(css.includes(text), true, `卡片样式缺少: ${text}`);
for (const forbidden of [
  '.facility-formula-summary',
  '.facility-formula-next-cycle',
  '--facility-card-height',
  'grid-auto-rows: 1fr;',
  'grid-template-areas: none;',
  'grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;',
  'height: var(--facility-card-height)',
  'min-height: var(--facility-card-height)',
  'max-height: var(--facility-card-height)',
]) {
  assert.equal(css.includes(forbidden), false, `卡片样式不应包含: ${forbidden}`);
}

const surfaceCss = read('src/styles/production-surface.css');
for (const text of [
  '.panel.production-surface',
  '--production-surface-inset: var(--space-4);',
  '--production-pill-visible-height: 1.6rem;',
  '--production-switch-thumb-size: 1rem;',
  '--production-switch-thumb-inset: 0.25rem;',
  '--production-switch-thumb-travel: 1.25rem;',
  'padding: var(--production-surface-inset);',
  '.panel.production-surface > .widget-heading',
  '.panel.production-surface .facility-card-title-row',
  'min-height: var(--production-pill-visible-height);',
  'line-height: var(--line-height-tight);',
  '.panel.production-surface .facility-card-title-row > .ui-switch {',
  'width: 2.75rem;',
  'height: var(--production-pill-visible-height);',
  '.panel.production-surface .facility-card-title-row > .ui-switch::before',
  'inset: 0;',
  'height: auto;',
  'border-radius: var(--radius-pill);',
  '.panel.production-surface .facility-card-title-row > .ui-switch::after',
  'top: calc((var(--production-pill-visible-height) - var(--production-switch-thumb-size)) / 2);',
  'transform: translateX(var(--production-switch-thumb-travel));',
  '@media (max-width: 720px)',
  '--production-surface-inset: var(--space-3);',
]) assert.equal(surfaceCss.includes(text), true, `生产一级表面样式缺少: ${text}`);
for (const forbidden of [
  'padding-top:',
  'padding-right:',
  'padding-bottom:',
  'padding-left:',
  'inset: 0.625rem 0;',
  'height: 2.75rem;',
  'min-height: 2.75rem;',
]) {
  assert.equal(surfaceCss.includes(forbidden), false, `生产一级表面不应包含: ${forbidden}`);
}

const designCss = read('src/styles/design-system.css');
for (const text of [
  'min-height: 1.6rem;',
  '.ui-switch {',
  'width: 2.75rem;',
  'height: 2.75rem;',
  '.ui-switch:focus-visible::before',
  'outline-offset: 2px;',
]) assert.equal(designCss.includes(text), true, `设计系统缺少胶囊或开关基础规则: ${text}`);

const pillDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');
for (const text of [
  '点击区域规则以本文为准',
  '可见高度：1.6rem',
  '点击高度：1.6rem',
  '点击区域必须与可见胶囊完全一致',
  '不得保留超出可见胶囊的透明点击区域',
  '标题行最小高度必须使用同一个 `1.6rem` 胶囊高度',
  '其他页面和表单开关继续遵循全局触控目标规则',
  '焦点环继续绘制在 `.ui-switch::before` 可见轨道外侧',
]) assert.equal(pillDesign.includes(text), true, `生产胶囊设计文档缺少: ${text}`);

const main = read('src/main.tsx');
assert.ok(main.indexOf("./styles/production-surface.css") < main.indexOf("./styles/design-system.css"), '生产一级表面样式必须在 design-system.css 前加载');

const server = read('server/src/facility-groups.js');
assert.equal(server.includes('if (recipes.length < 2) {'), true);
assert.equal(server.includes('return result(true, `${type.name}使用固定生产配方`)'), true);
const tests = read('server/test/facility-groups.test.js');
assert.equal(tests.includes('fixed recipes are idempotent'), true);

for (const [path, required] of [
  ['README.md', ['选择工厂生产配方', '所有工厂集群统一使用服务器正式配方', '同一网格行中的卡片等高', '状态位于第二行', '市场入口始终固定在卡片底部', '大于 720px 时四边内边距统一为 16px']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['持续生产与通用配方切换', '所有工厂卡统一显示“生产配方”选择器', '输入、输出和运行成本按 `participatingCount` 计算', '周期不乘以工厂规模', '进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字', '工厂名称和运行开关位于第一行', '状态独占第二行', '数量摘要独占第三行', '同一网格行中的卡片等高', '前往市场交易该工厂', '统一使用 `.production-surface`']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['统一运行开关位于第一行右侧', '状态位于第二行', '数量摘要位于第三行', '同一网格行中的卡片等高', '所有工厂统一显示“生产配方”选择器', '前往市场交易该工厂', '同一一级平面的卡片']],
  ['docs/UI_DESIGN_SYSTEM.md', ['名称与 `SwitchControl` 位于第一行', '状态位于第二行', '数量摘要位于第三行', '显式命名网格区域', '名称可见文字从统一卡片上内边距开始', '同一网格行中的卡片等高', '市场入口固定在卡片底部', '周期不乘以工厂规模', '进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字', '统一带 `.production-surface`']],
  ['docs/WAREHOUSE_EXPANSION_DESIGN.md', ['共享仓库与建设新工厂、工厂集群属于生产页同一一级平面', '大于 `720px` 时四边内边距为 `16px`']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['所有工厂类型至少包含一个正式配方', '单配方工厂提交唯一配方时幂等成功']],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', ['通用配方切换与下一周期生效']],
]) {
  const content = read(path);
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log('通用工厂配方、三行标题结构、同平面统一内边距、胶囊点击可见一致、自适应同排等高卡片和底部市场入口验证通过。');
