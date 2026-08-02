import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
const detail = read('src/pages/production/ProductionFacilityDetail.tsx');
const controls = read('src/components/ui/FormControls.tsx');
const formulaCss = read('src/styles/facility-production-formula.css');
const controlsCss = read('src/styles/form-controls.css');
const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const browserTest = read('tests/browser/production-methods.spec.ts');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const main = read('src/main.tsx');

for (const text of [
  'data-status={group.status}',
  'className="facility-formula-input-side"',
  'className="facility-formula-input"',
  'className="facility-formula-meta"',
  'facility-formula-meta-unit is-cycle',
  'facility-formula-meta-unit is-cost',
  'className="facility-formula-output"',
  'className="facility-formula-inventory"',
  '<ProductIcon productId={item.productId} />',
  '<WarehouseIcon className="facility-formula-meta-icon" />',
  '<FacilityGroupProgress group={group} type={type} now={now} />',
]) assert.equal(formula.includes(text), true, `生产结算结构缺少: ${text}`);

assert.equal((formula.match(/<RecipeItems/g) ?? []).length, 3, '生产结算必须保留组件定义、输入调用和输出调用');
for (const forbidden of [
  'showInventory',
  'facility-formula-meta-divider',
  '<strong>{formatNumber(quantity)} ×</strong>',
  'facility-formula-center',
]) assert.equal(formula.includes(forbidden), false, `生产结算不得包含: ${forbidden}`);

const itemStart = formula.indexOf('className={itemClassName}');
const productIconStart = formula.indexOf('<ProductIcon productId={item.productId} />', itemStart);
const quantityStart = formula.indexOf('<strong>{formatNumber(quantity)}</strong>', itemStart);
const inventoryStart = formula.indexOf('className="facility-formula-inventory"', itemStart);
assert.ok(itemStart >= 0 && productIconStart > itemStart, '商品 Icon 必须位于物资行内');
assert.ok(quantityStart > productIconStart && inventoryStart > quantityStart, '物资行必须依次为商品 Icon、生产数量、仓库数量');

const inputSideStart = formula.indexOf('className="facility-formula-input-side"');
const inputStart = formula.indexOf('className="facility-formula-input"', inputSideStart);
const metaStart = formula.indexOf('className="facility-formula-meta"', inputSideStart);
const outputStart = formula.indexOf('className="facility-formula-output"', inputSideStart);
assert.ok(inputSideStart >= 0 && inputStart > inputSideStart, '输入物资必须位于输入侧组合区内');
assert.ok(metaStart > inputStart && outputStart > metaStart, '两行周期成本仪表必须位于输入物资之后、输出之前');

for (const text of [
  '.facility-formula-input-side',
  '.facility-formula-meta',
  '.facility-formula-item-group',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
  'grid-template-columns: auto auto auto;',
  'grid-template-columns: minmax(0, 1fr);',
  'border-left: 1px solid var(--color-divider);',
  'grid-template-areas: none;',
  '.facility-formula-progress .progress-track span::after',
  'clip-path: polygon(0 0, 100% 50%, 0 100%);',
  '@container (max-width: 420px)',
  '@media (prefers-reduced-motion: reduce)',
]) assert.equal(formulaCss.includes(text), true, `生产结算样式缺少: ${text}`);

for (const forbidden of [
  '.facility-formula-center',
  '.facility-formula-meta-divider',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
  'border-top: 1px solid var(--color-divider);',
]) assert.equal(formulaCss.includes(forbidden), false, `生产结算样式不得包含: ${forbidden}`);

for (const text of [
  'leadingIcon?: ReactNode;',
  "classNames('ui-control-shell', leadingIcon && 'ui-control-shell--with-leading-icon')",
  'className="ui-control-leading-icon"',
]) assert.equal(controls.includes(text), true, `统一选择器前置 Icon 支持缺少: ${text}`);
for (const text of [
  '.ui-control-leading-icon',
  '.ui-control-shell--with-leading-icon > select.ui-control',
  'padding-left: 2.55rem;',
]) assert.equal(controlsCss.includes(text), true, `统一选择器前置 Icon 样式缺少: ${text}`);
for (const text of [
  'leadingIcon={<ProductIcon productId={selectedBaseRecipe.output.productId} />}',
  'leadingIcon={<ProductionMethodIcon methodId={recipeState.selectedProductionMethodId} />}',
  'data-production-method-icon={methodId}',
]) assert.equal(detail.includes(text), true, `生产设置 Icon 缺少: ${text}`);
for (const forbidden of ['<svg', '<path']) {
  const settingsStart = detail.indexOf('<section className="facility-production-settings">');
  const settingsEnd = detail.indexOf('<FacilityProductionFormula', settingsStart);
  assert.equal(detail.slice(settingsStart, settingsEnd).includes(forbidden), false, `生产设置不得手写图形标记: ${forbidden}`);
}

const groupCssImport = main.indexOf("import './styles/facility-group-card-grid.css';");
const formulaCssImport = main.indexOf("import './styles/facility-production-formula.css';");
assert.ok(groupCssImport >= 0 && formulaCssImport > groupCssImport, '生产结算样式必须在工厂详情基础样式之后加载');

const profitRule = profitCss.slice(
  profitCss.indexOf('.facility-average-profit {'),
  profitCss.indexOf('.facility-average-profit__copy {'),
);
assert.equal(profitRule.includes('border-top:'), true, '利润结果栏必须保留顶部分隔线');
for (const forbidden of ['border-radius:', 'background:']) {
  assert.equal(profitRule.includes(forbidden), false, `利润结果栏不得恢复独立卡片视觉: ${forbidden}`);
}

for (const text of [
  "const inputSide = settlement.locator('.facility-formula-input-side')",
  'expect(formulaColumns).toBe(2)',
  'expect(metaBox.x + metaBox.width).toBeLessThan(outputBox.x)',
  "settlement.locator('.facility-formula-item-group').first()",
  "settlement.locator('.facility-formula-output .facility-formula-inventory')",
  'expect(costBox.y).toBeGreaterThan(cycleBox.y + cycleBox.height - 1)',
  "settings.locator('.ui-control-leading-icon')",
  'arrowClipPath',
]) assert.equal(browserTest.includes(text), true, `生产结算浏览器回归缺少: ${text}`);

for (const text of [
  '工厂生产公式固定采用双列顶层布局',
  '商品 Icon、生产数量、仓库 Icon、当前可用库存',
  '时间和成本固定上下两行',
  '业务组件只能传入统一 Icon 组件',
  '`SelectInput` 的 `leadingIcon`',
  '输入与输出均显示当前可用库存',
]) assert.equal(uiDesign.includes(text) || industryDesign.includes(text), true, `权威设计缺少: ${text}`);

for (const forbidden of [
  '输入项目下方使用仓库 SVG',
  '输入项目下方显示对应当前可用库存',
  '输入和输出项目使用“数量 × 商品 SVG”结构',
]) assert.equal(uiDesign.includes(forbidden) || industryDesign.includes(forbidden), false, `权威设计仍保留旧生产结算规则: ${forbidden}`);

console.log('生产结算 Icon、数量、输入输出仓库库存、两行周期成本、Icon 选择器、流向进度、样式加载与利润结果栏验证通过。');
