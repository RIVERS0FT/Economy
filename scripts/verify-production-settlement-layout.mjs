import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
const detail = read('src/pages/production/ProductionFacilityDetail.tsx');
const productionPage = read('src/pages/ProductionPage.tsx');
const configControls = read('src/components/facilities/FacilityProductionConfigControls.tsx');
const richSelect = read('src/components/ui/RichSelectInput.tsx');
const productArtwork = read('src/components/products/ProductArtwork.tsx');
const formulaCss = read('src/styles/facility-production-formula.css');
const groupCss = read('src/styles/facility-group-card-grid.css');
const diagnosticsCss = read('src/styles/facility-operating-diagnostics.css');
const mobileDetailCss = read('src/styles/mobile-detail-sheet.css');
const controlsCss = read('src/styles/form-controls.css');
const artworkCss = read('src/styles/product-artwork.css');
const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const browserTest = read('tests/browser/production-methods.spec.ts');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const main = read('src/main.tsx');

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
  'type="button"',
  'className="facility-formula-item-group"',
  'data-ui-interactive="surface"',
  'aria-label={`查看${productName}市场，生产数量 ${formatNumber(quantity)}，仓库可用 ${formatNumber(warehouseQuantity)}`}',
  'onClick={() => onOpenProductMarket(item.productId)}',
  'onOpenProductMarket={onOpenProductMarket}',
]) assert.equal(formula.includes(text), true, `生产结算结构缺少: ${text}`);

assert.equal((formula.match(/<RecipeItems/g) ?? []).length, 2, '生产结算必须保留输入和输出调用');
assert.equal((formula.match(/onOpenProductMarket=\{onOpenProductMarket\}/g) ?? []).length, 2, '投入和产出都必须传递商品市场入口');
for (const forbidden of [
  '<ProductIcon',
  'showInventory',
  'facility-formula-meta-divider',
  '<strong>{formatNumber(quantity)} ×</strong>',
  'facility-formula-center',
  'facility-formula-separator',
  'className="facility-formula-visual" aria-hidden="true"',
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
  'appearance: none;',
  'font: inherit;',
  'cursor: pointer;',
  '--ui-interactive-hover-border-color:',
]) assert.equal(formulaCss.includes(text), true, `生产结算样式缺少: ${text}`);

for (const forbidden of [
  '.facility-formula-center',
  '.facility-formula-meta-divider',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
  '.facility-formula-separator',
  '  .facility-formula-meta {\
    width: 100%;\
  }',
]) assert.equal(formulaCss.includes(forbidden), false, `生产结算样式不得包含: ${forbidden}`);
for (const forbidden of [
  '@container (max-width: 519px)',
  'grid-area: input;',
  'grid-area: output;',
  '.facility-formula-center',
]) assert.equal(groupCss.includes(forbidden), false, `工厂主从样式不得控制生产结算内部网格: ${forbidden}`);

for (const text of [
  'grid-template-columns: minmax(0, 1fr);',
  'grid-auto-rows: max-content;',
  'align-items: start;',
  '.mobile-detail-sheet-scroll > * {',
  '.mobile-detail-sheet .mobile-detail-section {',
]) assert.equal(mobileDetailCss.includes(text), true, `移动详情正文纵向流缺少: ${text}`);

for (const text of [
  '.facility-operating-diagnostics .product-artwork {',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  'background: color-mix(in srgb, var(--color-surface-soft) 72%, var(--color-surface-inset));',
  'grid-template-columns: auto minmax(0, 1fr) auto;',
  'grid-template-columns: auto auto minmax(0, 1fr) auto;',
  'grid-column: 3 / -1;',
]) assert.equal(diagnosticsCss.includes(text), true, `经营诊断响应式样式缺少: ${text}`);
for (const forbidden of [
  'var(--text-muted)',
  'var(--text-warning)',
  'var(--border-subtle)',
  'var(--surface-muted)',
  'var(--radius-md)',
]) assert.equal(diagnosticsCss.includes(forbidden), false, `经营诊断不得恢复失效设计令牌: ${forbidden}`);

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
  "export type RichSelectVariant = 'default' | 'production-config';",
]) assert.equal(richSelect.includes(text), true, `统一富内容下拉框缺少: ${text}`);
for (const text of [
  '.ui-rich-select__trigger',
  '.ui-rich-select__listbox',
  '.ui-rich-select__option',
  "[aria-selected='true']",
  'min-height: 48px;',
  ".ui-rich-select__listbox[data-variant='production-config']",
]) assert.equal(controlsCss.includes(text), true, `统一富内容下拉框样式缺少: ${text}`);
const productionSettingsSource = `${detail}\n${configControls}`;
for (const text of [
  '<FacilityProductionConfigControls',
  'label="生产产物"',
  'aria-label={`${typeName}生产产物`}',
  'visual: <ProductArtwork productId={plan.output.productId} />',
  'visual: <ProductionMethodIcon methodId={method.id} />',
  'data-production-method-icon={methodId}',
  'variant="production-config"',
  '<ProductPlanDetail',
  '<MethodPlanDetail',
]) assert.equal(productionSettingsSource.includes(text), true, `生产设置富内容选项缺少: ${text}`);
for (const forbidden of ['<SelectInput', '<option']) {
  const settingsStart = detail.indexOf('<section className="facility-production-settings mobile-detail-section">');
  const settingsEnd = detail.indexOf('<FacilityProductionFormula', settingsStart);
  const settingsSource = `${detail.slice(settingsStart, settingsEnd)}\n${configControls}`;
  assert.equal(settingsSource.includes(forbidden), false, `生产设置不得恢复: ${forbidden}`);
}

for (const text of [
  'onOpenProductMarket: (productId: string) => void;',
  'onOpenProductMarket={onOpenProductMarket}',
]) assert.equal(detail.includes(text), true, `工厂详情商品市场回调缺少: ${text}`);
for (const text of [
  "selectMarketAsset('commodity', productId);",
  'onOpenProductMarket={openProductMarket}',
]) assert.equal(productionPage.includes(text), true, `生产页商品市场导航缺少: ${text}`);
assert.equal(
  (productionPage.match(/onOpenProductMarket=\{openProductMarket\}/g) ?? []).length,
  2,
  '桌面与移动工厂详情都必须接入商品市场导航',
);

const groupCssImport = main.indexOf("import './styles/facility-group-card-grid.css';");
const formulaCssImport = main.indexOf("import './styles/facility-production-formula.css';");
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
  "getByRole('button', { name: /^查看钢材市场/ })",
  "getByRole('button', { name: /^查看机械市场/ })",
  "settlement.locator('svg.product-icon')",
  "settlement.locator('.product-artwork')",
  "settlement.locator('.facility-formula-separator')",
  "asset: 'steel'",
  "asset: 'machinery'",
  'await inputSlot.click();',
  'not.toHaveClass(/is-dragging/)',
  'expect(box.x + box.width).toBeLessThanOrEqual(width)',
  'expect(metaBox.width).toBeLessThan(visualBox.width - 8)',
  'expect(Math.abs(costBox.y - cycleBox.y)).toBeLessThanOrEqual(1)',
  'expect(Math.abs(inputBox.y - outputBox.y)).toBeLessThanOrEqual(1)',
  'settlementOverflow.scrollWidth',
  'diagnosticsOverflow.scrollWidth',
  'scrollOverflow.scrollWidth',
  'expect(diagnosticsBox.y).toBeGreaterThanOrEqual(settlementBox.y + settlementBox.height + 6)',
  'expect(mobileDiagnosticsIndex).toBeGreaterThan(mobileSettlementIndex)',
  'expect(helperBox.y + helperBox.height).toBeLessThanOrEqual(footerBox.y + 1)',
  'for (const width of [320, 360, 390, 430, 720])',
  'arrowClipPath',
]) assert.equal(browserTest.includes(text), true, `生产详情浏览器回归缺少: ${text}`);

for (const text of [
  '工厂生产公式固定采用双列顶层布局',
  '商品图片、生产数量、仓库 Icon、当前可用库存',
  '`ProductArtwork`',
  '`RichSelectInput`',
  '不得恢复浏览器浅色原生选项弹层',
  '输入与输出均显示当前可用库存',
  '不显示 `+` 或其他连接字符',
  '移动端不得拉伸为全宽',
  '每个投入／产出物资槽整体使用原生按钮语义并可直接打开对应商品市场',
  '不得把承载可交互物资槽的 `.facility-formula-visual` 整体设为 `aria-hidden`',
]) assert.equal(uiDesign.includes(text) || industryDesign.includes(text), true, `权威设计缺少: ${text}`);

for (const text of [
  '生产结算 → 经营诊断 → 市场入口',
  '经营诊断固定紧跟生产结算',
  '不得与生产结算发生视觉重叠',
]) assert.equal(industryDesign.includes(text) || uiDesign.includes(text), true, `移动经营诊断权威设计缺少: ${text}`);

for (const text of [
  '工厂详情“生产结算”的投入／产出物资槽是商品市场的直接导航入口',
  '不得自动选择买入／卖出方向、数量或价格',
  '不得改写生产页建设工厂类型、数量、配方、作业制度或任何服务器权威生产状态',
]) assert.equal(pageDesign.includes(text), true, `生产商品市场导航权威设计缺少: ${text}`);

console.log('生产结算商品 PNG、生产配置方案下拉、投入产出市场跳转、移动详情纵向流、经营诊断响应式与几何防回退验证通过。');
