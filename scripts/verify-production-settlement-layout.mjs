import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
const detail = read('src/pages/production/ProductionFacilityDetail.tsx');
const richSelect = read('src/components/ui/RichSelectInput.tsx');
const productArtwork = read('src/components/products/ProductArtwork.tsx');
const formulaCss = read('src/styles/facility-production-formula.css');
const groupCss = read('src/styles/facility-group-card-grid.css');
const controlsCss = read('src/styles/form-controls.css');
const artworkCss = read('src/styles/product-artwork.css');
const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const browserTest = read('tests/browser/production-methods.spec.ts');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const main = read('src/styles/app.css');

for (const text of [
  'data-status={group.status}',
  'className="facility-formula-input-side"',
  'className="facility-formula-input"',
  'className="facility-formula-meta"',
  'facility-formula-meta-unit is-cycle',
  'facility-formula-meta-unit is-cost',
  'className="facility-formula-output-side"',
  'className="facility-formula-output"',
  'className="facility-formula-side-label"',
  'className="facility-formula-inventory"',
  '<ProductArtwork productId={item.productId} className="facility-formula-product-artwork" />',
  '<WarehouseIcon className="facility-formula-meta-icon" />',
  '<FacilityGroupProgress group={group} type={type} now={now} />',
]) assert.equal(formula.includes(text), true, `生产结算结构缺少: ${text}`);

assert.equal((formula.match(/<RecipeItems/g) ?? []).length, 2, '生产结算必须保留输入和输出调用');
for (const forbidden of [
  '<ProductIcon',
  'showInventory',
  'facility-formula-meta-divider',
  '<strong>{formatNumber(quantity)} ×</strong>',
  'facility-formula-center',
  'facility-formula-separator',
]) assert.equal(formula.includes(forbidden), false, `生产结算不得包含: ${forbidden}`);

const itemStart = formula.indexOf('className={itemClassName}');
const artworkStart = formula.indexOf('<ProductArtwork', itemStart);
const quantityStart = formula.indexOf('<strong>{formatNumber(quantity)}</strong>', itemStart);
const inventoryStart = formula.indexOf('className="facility-formula-inventory"', itemStart);
assert.ok(itemStart >= 0 && artworkStart > itemStart, '商品图片必须位于物资行内');
assert.ok(quantityStart > artworkStart && inventoryStart > quantityStart, '物资行必须依次为商品图片、生产数量、仓库数量');

for (const text of [
  'data-product-artwork={productId}',
  "classNames('product-icon', 'product-artwork', className)",
]) assert.equal(productArtwork.includes(text), true, `商品图片组件缺少: ${text}`);
for (const forbidden of ['<svg', '<path']) {
  assert.equal(productArtwork.includes(forbidden), false, `商品图片组件不得渲染: ${forbidden}`);
}
for (const text of [
  '.product-artwork {',
  'background-image: var(--product-artwork-image, none);',
  'background-size: contain;',
]) assert.equal(artworkCss.includes(text), true, `商品图片样式缺少: ${text}`);

const inputSideStart = formula.indexOf('className="facility-formula-input-side"');
const inputStart = formula.indexOf('className="facility-formula-input"', inputSideStart);
const outputStart = formula.indexOf('className="facility-formula-output"', inputSideStart);
const metaStart = formula.indexOf('className="facility-formula-meta"', outputStart);
assert.ok(inputSideStart >= 0 && inputStart > inputSideStart, '输入物资必须位于输入侧组合区内');
assert.ok(outputStart > inputStart && metaStart > outputStart, '周期成本操作数据带必须位于投入与产出之后');

for (const text of [
  '.facility-formula-input-side',
  '.facility-formula-meta',
  '.facility-formula-item-group',
  '.facility-formula-product-artwork',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
  'grid-template-columns: auto auto auto;',
  'display: inline-flex;',
  'grid-area: auto;',
  'width: fit-content;',
  'justify-self: start;',
  '.facility-formula-meta-unit.is-cost {',
  'border-left: 1px solid var(--color-divider);',
  '.facility-formula-progress .progress-track span::after',
  'clip-path: polygon(0 0, 100% 50%, 0 100%);',
  '@container (max-width: 420px)',
  '@media (prefers-reduced-motion: reduce)',
]) assert.equal(formulaCss.includes(text), true, `生产结算样式缺少: ${text}`);

for (const forbidden of [
  '.facility-formula-center',
  '.facility-formula-meta-divider',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
  '.facility-formula-separator',
  '  .facility-formula-meta {\n    width: 100%;\n  }',
]) assert.equal(formulaCss.includes(forbidden), false, `生产结算样式不得包含: ${forbidden}`);
for (const forbidden of [
  '@container (max-width: 519px)',
  'grid-area: input;',
  'grid-area: output;',
  '.facility-formula-center',
]) assert.equal(groupCss.includes(forbidden), false, `工厂主从样式不得控制生产结算内部网格: ${forbidden}`);

for (const text of [
  'export function RichSelectInput',
  'role="combobox"',
  'role="listbox"',
  'role="option"',
  'createPortal(',
  'useWorkspaceFloatingLayer()',
  "event.key === 'ArrowDown'",
  "case 'Escape':",
  'data-facility-sheet-no-drag="true"',
]) assert.equal(richSelect.includes(text), true, `统一富内容下拉框缺少: ${text}`);
for (const text of [
  '.ui-rich-select__trigger',
  '.ui-rich-select__listbox',
  '.ui-rich-select__option',
  "[aria-selected='true']",
  'min-height: 48px;',
]) assert.equal(controlsCss.includes(text), true, `统一富内容下拉框样式缺少: ${text}`);
for (const text of [
  'label="生产产物"',
  'aria-label={`${type.name}生产产物`}',
  'visual: <ProductArtwork productId={recipe.output.productId} />',
  'visual: <ProductionMethodIcon methodId={method.id} />',
  'data-production-method-icon={methodId}',
]) assert.equal(detail.includes(text), true, `生产设置富内容选项缺少: ${text}`);
for (const forbidden of ['<SelectInput', '<option']) {
  const settingsStart = detail.indexOf('<section className="facility-production-settings">');
  const settingsEnd = detail.indexOf('<FacilityProductionFormula', settingsStart);
  assert.equal(detail.slice(settingsStart, settingsEnd).includes(forbidden), false, `生产设置不得恢复: ${forbidden}`);
}

const groupCssImport = main.indexOf("url('./facility-group-card-grid.css')");
const formulaCssImport = main.indexOf("url('./facility-production-formula.css')");
assert.ok(groupCssImport >= 0 && formulaCssImport > groupCssImport, '生产结算样式必须在工厂详情基础样式之后加载');

const profitRule = profitCss.slice(
  profitCss.indexOf('.facility-average-profit {'),
  profitCss.indexOf('.facility-average-profit__copy {'),
);
assert.equal(formula.includes('<FacilityRecipeProfitAnalysis'), false, '生产结算不得继续包含单厂利润');
assert.equal(detail.includes('<FacilityRecipeProfitAnalysis'), true, '工厂信息必须渲染单厂利润');
assert.equal(groupCss.includes('.facility-information > .facility-average-profit'), true, '工厂信息布局必须承担利润分隔线');
assert.equal(profitRule.includes('border-top:'), false, '利润组件基础样式不得绑定生产结算分隔线');
for (const forbidden of ['border-radius:', 'background:']) {
  assert.equal(profitRule.includes(forbidden), false, `利润结果栏不得恢复独立卡片视觉: ${forbidden}`);
}

for (const text of [
  "getByRole('combobox', { name: '机械工厂生产产物' })",
  "getByRole('listbox', { name: '机械工厂生产产物' })",
  "getByRole('option', { name: '节约生产' })",
  "settlement.locator('svg.product-icon')",
  "settlement.locator('.product-artwork')",
  "settlement.locator('.facility-formula-separator')",
  'expect(box.x + box.width).toBeLessThanOrEqual(width)',
  'expect(metaBox.width).toBeLessThan(visualBox.width - 8)',
  'expect(Math.abs(costBox.y - cycleBox.y)).toBeLessThanOrEqual(1)',
  'expect(Math.abs(inputBox.y - outputBox.y)).toBeLessThanOrEqual(1)',
  'settlementOverflow.scrollWidth',
  'for (const width of [320, 390, 430])',
  'arrowClipPath',
]) assert.equal(browserTest.includes(text), true, `生产结算浏览器回归缺少: ${text}`);

for (const text of [
  '工厂生产公式固定采用双列顶层布局',
  '商品图片、生产数量、仓库 Icon、当前可用库存',
  '`ProductArtwork`',
  '`RichSelectInput`',
  '不得恢复浏览器浅色原生选项弹层',
  '输入与输出均显示当前可用库存',
  '不显示 `+` 或其他连接字符',
  '移动端不得拉伸为全宽',
]) assert.equal(uiDesign.includes(text) || industryDesign.includes(text), true, `权威设计缺少: ${text}`);

console.log('生产结算商品 PNG、投入产出、单行周期成本操作带、实时满员率、响应式与工厂信息利润归属验证通过。');
