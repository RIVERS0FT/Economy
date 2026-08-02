import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
const formulaCss = read('src/styles/facility-production-formula.css');
const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const browserTest = read('tests/browser/production-methods.spec.ts');
const design = read('docs/UI_DESIGN_SYSTEM.md');
const main = read('src/main.tsx');

for (const text of [
  'data-status={group.status}',
  'className="facility-formula-input-side"',
  'className="facility-formula-input"',
  'className="facility-formula-meta"',
  'facility-formula-meta-unit is-cycle',
  'facility-formula-meta-unit is-cost',
  'className="facility-formula-output"',
  '<FacilityGroupProgress group={group} type={type} now={now} />',
]) assert.equal(formula.includes(text), true, `生产结算结构缺少: ${text}`);

assert.equal(formula.includes('facility-formula-center'), false, '周期与成本不得恢复为独立中列');
const inputSideStart = formula.indexOf('className="facility-formula-input-side"');
const inputStart = formula.indexOf('className="facility-formula-input"', inputSideStart);
const metaStart = formula.indexOf('className="facility-formula-meta"', inputSideStart);
const outputStart = formula.indexOf('className="facility-formula-output"', inputSideStart);
assert.ok(inputSideStart >= 0 && inputStart > inputSideStart, '输入物资必须位于输入侧组合区内');
assert.ok(metaStart > inputStart && outputStart > metaStart, '周期成本仪表必须位于输入物资之后、输出之前');

for (const text of [
  '.facility-formula-input-side',
  '.facility-formula-meta',
  '.facility-formula-item-group',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
  'grid-template-areas: none;',
  '.facility-formula-progress .progress-track span::after',
  'clip-path: polygon(0 0, 100% 50%, 0 100%);',
  '@container (max-width: 420px)',
  '@media (prefers-reduced-motion: reduce)',
]) assert.equal(formulaCss.includes(text), true, `生产结算样式缺少: ${text}`);

for (const forbidden of [
  '.facility-formula-center',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
]) assert.equal(formulaCss.includes(forbidden), false, `生产结算样式不得包含: ${forbidden}`);

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
  'arrowClipPath',
]) assert.equal(browserTest.includes(text), true, `生产结算浏览器回归缺少: ${text}`);

for (const text of [
  '工厂生产公式固定采用双列顶层布局',
  '左侧为输入组合区，右侧为输出区',
  '周期与成本不得回到输入输出之间的独立中列',
  '输入侧周期成本仪表只显示周期 SVG、周期数值、成本 SVG 和集群成本数值',
  '进度填充允许使用内置方向端帽和低强度高光',
  '不得新增独立箭头元素或第二条连接线',
  '顶层仍保持输入侧／输出双列',
  '把周期成本移回独立中列',
]) assert.equal(design.includes(text), true, `UI 权威设计缺少: ${text}`);

for (const forbidden of [
  '工厂生产公式固定采用三列顶层布局',
  '周期成本中列只显示',
  '破坏输入／中央信息／输出三列语义',
]) assert.equal(design.includes(forbidden), false, `UI 权威设计仍保留旧生产结算规则: ${forbidden}`);

console.log('生产结算输入侧周期成本、工业物资槽、流向进度、样式加载与利润结果栏验证通过。');
