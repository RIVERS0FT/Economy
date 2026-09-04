import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const style = readFileSync('src/styles/form-controls.css', 'utf8');
const layout = readFileSync('src/styles/facility-group-card-grid.css', 'utf8');
const richSelect = readFileSync('src/components/ui/RichSelectInput.tsx', 'utf8');
const design = readFileSync('docs/UI_DESIGN_SYSTEM.md', 'utf8');
const browser = readFileSync('tests/browser/production-config-visual.spec.ts', 'utf8');

for (const text of [
  ".ui-form-field:has(> .ui-rich-select[data-variant='production-config']) {",
  'width: fit-content;',
  'justify-self: start;',
  'justify-items: start;',
  ".ui-rich-select[data-variant='production-config'] {",
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger {",
  'width: 52px;',
  'height: 52px;',
  'aspect-ratio: 1;',
  'width: 48px;',
  'height: 48px;',
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger .ui-rich-select__content,",
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger .ui-rich-select__chevron",
  'display: none;',
  ".ui-rich-select__listbox[data-variant='production-config'] {",
  'overflow-y: hidden;',
  ".ui-rich-select__listbox[data-variant='production-config'][data-scrollable='true'] {",
  'overflow-y: auto;',
  'justify-items: center;',
  ".ui-rich-select__listbox[data-variant='production-config'] .ui-rich-select__option .ui-rich-select__visual",
  'background: transparent;',
  'border: 0;',
]) {
  assert.ok(style.includes(text), `生产配置收起态视觉缺少 ${text}`);
}

const autoSlotBlock = layout.match(/\.facility-production-settings-grid\s*\{([\s\S]*?)\}/)?.[1] ?? '';
for (const text of [
  'display: flex;',
  'align-items: flex-start;',
  'justify-content: flex-start;',
  'flex-wrap: nowrap;',
  'gap: var(--space-2);',
]) {
  assert.ok(autoSlotBlock.includes(text), `生产设置 Auto 槽容器缺少 ${text}`);
}
assert.equal(autoSlotBlock.includes('grid-template-columns'), false, '生产设置不得恢复 Fill 双列轨道');
assert.equal(autoSlotBlock.includes('display: grid;'), false, '生产设置 Auto 槽容器不得恢复 Grid Fill 布局');
assert.ok(
  layout.includes('.facility-production-settings-grid > * {\n  min-width: 0;\n  flex: 0 0 auto;'),
  '生产设置子字段必须使用 flex: 0 0 auto',
);
assert.equal(
  layout.includes(".mobile-detail-sheet .facility-production-settings-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));"),
  false,
  '移动生产设置不得恢复两等分 Fill 轨道',
);

for (const text of [
  'naturalScrollHeight',
  'element.scrollHeight',
  'element.offsetHeight - element.clientHeight',
  "variant === 'production-config'",
  'availableBelow >= estimatedHeight',
  'availableAbove >= estimatedHeight',
  'availableLayerHeight',
  'productionCanFitLayer',
  "scrollable: variant === 'production-config' && !productionCanFitLayer",
  'safeTop',
  'safeBottom',
  'clamp(preferredTop, safeTop, safeBottom - maxHeight)',
]) {
  assert.ok(richSelect.includes(text), `生产配置菜单自然高度定位缺少 ${text}`);
}
assert.equal(
  richSelect.includes('PRODUCTION_CONFIG_VISIBLE_OPTIONS'),
  false,
  '生产配置菜单不得恢复固定可见项数限高',
);

for (const text of [
  '类似 UMG Horizontal Box 的 Auto／Desired Size 槽位',
  '生产产物、作业制度和原料保障三个字段按自身内容宽度从左向右连续排列',
  '不得使用 `1fr`、百分比或 `flex-grow` 制造 Fill 槽',
  '收起触发按钮固定为正方形并按内容宽度布局',
  '只显示当前产物／作业制度图片',
  '不显示名称、参数摘要或下拉箭头',
  '图片槽不得绘制独立黑色底板',
  '完整名称与参数只在展开候选中显示',
  '候选菜单按自身实际内容高度展开',
  '上方或下方任一方向能够完整容纳全部候选',
  '不得生成内部纵向滚动条',
  '只有上下方向都无法完整容纳时才允许保留受限高度与内部滚动',
]) {
  assert.ok(design.includes(text), `UI 设计文档缺少生产配置规则：${text}`);
}
assert.equal(
  design.includes('移动工厂详情中的生产产物与作业制度继续同一行双列'),
  false,
  'UI 设计文档不得继续把生产配置描述为 Fill 双列',
);
assert.equal(
  design.includes('桌面和移动详情都固定双列同行'),
  false,
  'UI 设计文档不得继续把生产设置规定为固定双列',
);
assert.equal(
  design.includes('控件收起时只显示当前方案的图标、名称和紧凑参数摘要'),
  false,
  'UI 设计文档不得保留旧的收起态名称与参数规则',
);

for (const forbidden of [
  'geometry.columnWidth',
  'geometry.expectedFieldLeft',
  'expectColumnRemainderInactive',
]) {
  assert.equal(browser.includes(forbidden), false, `生产配置浏览器回归不得继续依赖 Fill 列：${forbidden}`);
}

for (const text of [
  'UMG-like auto slots instead of fill tracks',
  'expectSquareImageOnlyTrigger',
  'expectAutoSlotRow',
  'expectNoVerticalOverflow',
  'Math.abs(geometry.width - geometry.height)',
  "expect(geometry.display).toBe('flex')",
  "expect(geometry.justifyContent).toBe('flex-start')",
  "expect(geometry.flexWrap).toBe('nowrap')",
  "expect(field.flexGrow).toBe('0')",
  "expect(field.flexShrink).toBe('0')",
  "expect(field.flexBasis).toBe('auto')",
  'geometry.fields[1].left - geometry.fields[0].right',
  'geometry.rowRight - geometry.fields[2].right',
  'page.mouse.click',
  "expect(expanded).toEqual(['false', 'false'])",
  'expectedSize',
  "innerText.trim()",
  "toBe('')",
  '.ui-rich-select__chevron',
  'backgroundColor',
  'borderTopWidth',
  'scrollHeight',
  'clientHeight',
  'overflowY',
  "toBe('hidden')",
  'toBeLessThanOrEqual(1)',
  "toHaveLength(3)",
  "toEqual(['false', 'false', 'false'])",
  '机械工厂原料保障',
  '机械工厂生产产物',
  '机械工厂生产方式',
  "toContainText('投入')",
  "toContainText('周期 60s')",
]) {
  assert.ok(browser.includes(text), `生产配置浏览器回归缺少 ${text}`);
}

console.log('生产配置视觉验证通过：生产产物与作业制度使用 UMG 风格 Auto 槽连续左排；候选能够完整容纳时按真实内容高度展开，必要时在安全矩形内平移，不产生内部纵向滚动。');
