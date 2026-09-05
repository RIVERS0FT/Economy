import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const formula = [read('src/components/facilities/FacilityProductionFormula.tsx'), read('src/components/buildings/BuildingSettlementPanel.tsx'), read('src/components/buildings/BuildingSettlementProducts.tsx')].join('\n');
const detail = read('src/pages/production/ProductionFacilityDetail.tsx');
const productionPage = read('src/pages/BuildingsPage.tsx');
const configControls = read('src/components/facilities/FacilityProductionConfigControls.tsx');
const richSelect = read('src/components/ui/RichSelectInput.tsx');
const productArtwork = read('src/components/products/ProductArtwork.tsx');
const formulaCss = read('src/styles/facility-production-formula.css');
const groupCss = read('src/styles/facility-group-card-grid.css');
const diagnosticsCss = read('src/styles/facility-operating-diagnostics.css');
const controlsCss = read('src/styles/form-controls.css');
const artworkCss = read('src/styles/product-artwork.css');
const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const profitAnalysis = read('src/components/facilities/FacilityRecipeProfitAnalysis.tsx');
const browserTest = read('tests/browser/production-methods.spec.ts');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const buildingLayoutDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');
const main = read('src/main.tsx');

for (const text of [
  'data-status={status}',
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
  "quantityLabel = '生产数量'",
  'onClick={() => onOpenProductMarket(item.productId)}',
  'onOpenProductMarket={onOpenProductMarket}',
]) assert.equal(formula.includes(text), true, `生产结算结构缺少: ${text}`);

assert.equal((formula.match(/<RecipeItems/g) ?? []).length, 2, '生产结算必须保留输入和输出调用');
assert.equal((formula.match(/onOpenProductMarket=\{onOpenProductMarket\}/g) ?? []).length, 2, '投入和产出都必须传递本地商品详情入口');
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
const quantityStart = formula.indexOf('<strong><CompactNumber value={quantity} /></strong>', itemStart);
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
  '.facility-formula-progress .progress-track {',
  'border-radius: var(--radius-control);',
  '.facility-formula-progress .progress-track > span {',
  'inset: 0 auto 0 0;',
  'border-radius: inherit;',
  'overflow: hidden;',
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
  '  .facility-formula-meta {\n    width: 100%;\n  }',
  'right: -0.18rem;',
  '.facility-formula-progress .progress-track span::after',
  'clip-path: polygon(0 0, 100% 50%, 0 100%);',
  'border-radius: var(--radius-pill);',
]) assert.equal(formulaCss.includes(forbidden), false, `生产结算样式不得包含: ${forbidden}`);
for (const forbidden of [
  '@container (max-width: 519px)',
  'grid-area: input;',
  'grid-area: output;',
  '.facility-formula-center',
]) assert.equal(groupCss.includes(forbidden), false, `工厂主从样式不得控制生产结算内部网格: ${forbidden}`);

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
  'aria-label={ariaLabel ?? `${typeName}生产产物`}',
  'visual: <ProductArtwork productId={plan.output.productId} />',
  'visual: <ProductionMethodIcon methodId={method.id} iconId={method.iconId} />',
  'data-production-method-icon={iconId}',
  'data-production-method-id={methodId}',
  'variant="production-config"',
  '<ProductPlanDetail',
  '<MethodPlanDetail',
]) assert.equal(productionSettingsSource.includes(text), true, `生产配置富内容选项缺少: ${text}`);
const settingsStart = detail.indexOf('<section className="facility-production-settings mobile-detail-section" aria-label="生产配置">');
const settingsEnd = detail.indexOf('<FacilityProductionFormula', settingsStart);
const detailSettingsSource = detail.slice(settingsStart, settingsEnd);
const settingsSource = `${detailSettingsSource}\n${configControls}`;
for (const forbidden of ['<strong>生产设置</strong>', 'facility-production-settings-heading']) {
  assert.equal(settingsSource.includes(forbidden), false, `生产配置不得恢复: ${forbidden}`);
}
assert.equal(configControls.includes('<SelectInput'), false, '生产产物与作业制度两个 production-config 槽不得恢复通用 SelectInput');
assert.equal(configControls.includes('<option'), false, '生产产物与作业制度必须继续使用富内容 option 数据而不是原生 option JSX');
assert.equal((detailSettingsSource.match(/<SelectInput/g) ?? []).length, 1, '生产配置区必须且只允许一个原料保障共享 SelectInput');
assert.equal((detailSettingsSource.match(/<option /g) ?? []).length, 4, '原料保障共享 SelectInput 必须保留四个周期候选');
for (const text of [
  'label={<GameConcept concept="input-coverage">原料保障</GameConcept>}',
  'aria-label={`${type.name}原料保障`}',
  'fieldClassName="facility-auto-operation__coverage"',
  'inputCoverageCycles: Number(event.target.value) as 1 | 2 | 3 | 5',
]) assert.equal(detailSettingsSource.includes(text), true, `原料保障共享下拉缺少: ${text}`);

for (const text of [
  'description={',
  'className="facility-information-details"',
  'className="facility-count-summary"',
  '<FacilityRecipeProfitAnalysis',
  '<FacilityStaffingSummary entry={entry} now={liveNow} />',
]) assert.equal(detail.includes(text), true, `插画右侧工厂信息缺少: ${text}`);
const summaryDescriptionStart = detail.indexOf('description={');
const summaryDescriptionEnd = detail.indexOf('/>', summaryDescriptionStart);
assert.ok(summaryDescriptionStart >= 0, '工厂主信息必须提供插画右侧详情区');
assert.ok(detail.indexOf('className="facility-count-summary"', summaryDescriptionStart) > summaryDescriptionStart, '数量摘要必须位于插画右侧详情区');
assert.ok(detail.indexOf('<FacilityRecipeProfitAnalysis', summaryDescriptionStart) > summaryDescriptionStart, '平均利润必须位于插画右侧详情区');
assert.ok(detail.indexOf('<FacilityStaffingSummary entry={entry} now={liveNow} />', summaryDescriptionStart) > summaryDescriptionStart, '满员率必须位于插画右侧详情区');
assert.equal(detail.includes('<strong>生产设置</strong>'), false, '生产配置不得恢复可见“生产设置”标题');
for (const text of [
  '.facility-information-details > .facility-average-profit',
  '.facility-information-details > .facility-staffing-summary',
  'grid-template-rows: auto auto auto;',
  'grid-row: 1;',
  'grid-row: 2;',
  'grid-row: 3;',
  'display: inline-flex;',
  'white-space: nowrap;',
]) assert.equal(groupCss.includes(text), true, `工厂详情布局样式缺少: ${text}`);
assert.equal(groupCss.includes('.facility-information > .facility-average-profit'), false, '平均利润不得移回插画下方');
assert.equal(groupCss.includes('.facility-production-settings-heading'), false, '不得保留已删除生产设置标题样式');

for (const text of [
  'onOpenProductMarket: (productId: string) => void;',
  'usePlayerPageNavigation()',
  "currentLocation?.type === 'regional-facility'",
  "type: 'regional-product'",
  "host: currentLocation.host === 'province' ? 'province' : 'market'",
  'provinceId: currentLocation.provinceId,',
  'pageNavigation.pushPage({',
  'onOpenProductMarket={openProductDetail}',
  'onOpenProductMarket(productId);',
]) assert.equal(detail.includes(text), true, `工厂详情本地商品导航缺少: ${text}`);
assert.equal(productionPage.includes('onOpenProductMarket={openProductMarket}'), true, '建筑页必须保留无页面栈环境的商品导航回调');
assert.equal(
  (productionPage.match(/onOpenProductMarket=\{openProductMarket\}/g) ?? []).length,
  1,
  '统一工厂二级详情必须且只需接入一次商品导航回调',
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
assert.equal(profitAnalysis.includes('<small>'), false, '单厂平均利润行不得显示副说明');
assert.equal(profitAnalysis.includes('最近真实成交价 · 满员率'), false, '单厂平均利润行不得恢复成交价与满员率副说明');
assert.equal(groupCss.includes('.facility-information-details > .facility-average-profit'), true, '插画右侧信息布局必须承担利润分隔线');
assert.equal(profitRule.includes('border-top:'), false, '利润组件基础样式不得绑定生产结算分隔线');
for (const forbidden of ['border-radius:', 'background:']) {
  assert.equal(profitRule.includes(forbidden), false, `利润结果栏不得恢复独立卡片视觉: ${forbidden}`);
}

for (const text of [
  "getByRole('combobox', { name: '机械工厂生产产物' })",
  "getByRole('listbox', { name: '机械工厂生产产物' })",
  "getByRole('option', { name: '单元制造' })",
  "getByRole('button', { name: /^查看钢材本地商品详情/ })",
  "getByRole('button', { name: /^查看机械本地商品详情/ })",
  "locator('.facility-average-profit__copy small')).toHaveCount(0)",
  'summaryRows.profit.top',
  'summaryRows.staffing.top',
  'mobileSummaryRows.profitTop',
  'mobileSummaryRows.staffingTop',
  "settlement.locator('svg.product-icon')",
  "settlement.locator('.product-artwork')",
  "settlement.locator('.facility-formula-separator')",
  "'steel'",
  "'machinery'",
  'await inputSlot.click();',
  'not.toHaveClass(/is-dragging/)',
  "not.toContainText('生产设置')",
  "informationMain.locator('.facility-count-summary')",
  "informationMain.locator('.facility-average-profit')",
  "informationMain.locator('.facility-staffing-summary')",
  'trackBorderRadius',
  'fillBorderRadius',
  "expect(transitions.fillBorderRadius).toBe(transitions.trackBorderRadius)",
  "expect(transitions.arrowClipPath).toBe('none')",
  "getByRole('button', { name: /交易该建筑资产/ })).toHaveCount(0)",
  'expect(box.x + box.width).toBeLessThanOrEqual(width)',
  'expect(geometry.metaBox.width).toBeLessThan(geometry.visualBox.width - 8)',
  'expect(Math.abs(geometry.costBox.y - geometry.cycleBox.y)).toBeLessThanOrEqual(1)',
  'expect(Math.abs(geometry.inputBox.y - geometry.outputBox.y)).toBeLessThanOrEqual(1)',
  'settlementOverflow',
  'diagnosticsOverflow',
  'scrollOverflow',
  'expect(geometry.diagnosticsBox.y).toBeGreaterThanOrEqual(geometry.settlementBox.y + geometry.settlementBox.height + 6)',
  'expect(geometry.mobileDiagnosticsIndex).toBeGreaterThan(geometry.mobileSettlementIndex)',
  'for (const width of [320, 360, 390, 430, 720])',
  'await expect(workspaceHost).toHaveCount(1);',
  "await expect(workspaceHost).toHaveAttribute('data-detail-active', 'false');",
  "await expect(workspaceHost.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);",
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
  '插画右侧主信息固定为三行',
  '单厂平均利润固定第二行且只显示标题和值',
  '生产配置区不显示独立“生产设置”标题',
  '每个投入／产出物资槽整体使用原生按钮语义并可直接打开当前州对应本地商品详情',
  '生产进度轨道使用与按钮相同的 `--radius-control` 圆角，不使用胶囊圆角、流光或箭头端点',
  '工厂详情不得显示“交易该建筑资产”入口，工厂所有权交易只允许通过拍卖页完成',
  '不得把承载可交互物资槽的 `.facility-formula-visual` 整体设为 `aria-hidden`',
]) assert.equal(uiDesign.includes(text) || industryDesign.includes(text), true, `权威设计缺少: ${text}`);
assert.equal(
  buildingLayoutDesign.includes('不得使用 `--radius-pill` 半圆端点、扫光或箭头端点'),
  true,
  '地区工厂详情布局设计必须禁止恢复旧胶囊、扫光和箭头端点。',
);

for (const text of [
  '生产结算 → 经营诊断 → 市场入口',
  '经营诊断固定紧跟生产结算',
  '不得与生产结算发生视觉重叠',
]) assert.equal(industryDesign.includes(text) || uiDesign.includes(text), true, `经营诊断权威设计缺少: ${text}`);

for (const text of [
  '工厂详情“生产结算”的投入／产出物资槽是当前州本地商品详情的直接导航入口',
  "`regional-facility`",
  "`regional-product`",
  '不得先进入商品全局详情或商品目录',
  '不得根据生产配方语义自动推断采购／出售方向',
  '进入商品详情后即时交易数量重置为 `1`',
  '成交价格只读取服务器当日 `officialPrice`',
  '不得由生产配方或来源页面预填自定义价格',
  '不得自动提交交易',
  '不得改写建筑页建设工厂类型、数量、配方、作业制度或任何服务器权威生产状态',
]) assert.equal(pageDesign.includes(text), true, `生产本地商品导航权威设计缺少: ${text}`);

for (const text of [
  '点击工厂卡片后进入当前地区建筑分区内部的二级详情视图',
  '移动端工厂卡点击行为与桌面一致',
]) assert.equal(buildingLayoutDesign.includes(text), true, `地区工厂详情布局设计缺少: ${text}`);

console.log('生产结算商品 PNG、无标题生产配置、插画右侧经营指标、本地商品详情导航、按钮圆角进度、资产入口同行与几何防回退验证通过。');