import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const style = readFileSync('src/styles/form-controls.css', 'utf8');
const design = readFileSync('docs/UI_DESIGN_SYSTEM.md', 'utf8');
const browser = readFileSync('tests/browser/production-config-visual.spec.ts', 'utf8');

for (const text of [
  ".ui-rich-select[data-variant='production-config'] {",
  'width: fit-content;',
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger {",
  'width: 52px;',
  'height: 52px;',
  'aspect-ratio: 1;',
  'width: 48px;',
  'height: 48px;',
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger .ui-rich-select__content,",
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger .ui-rich-select__chevron",
  'display: none;',
  'justify-items: center;',
  ".ui-rich-select__listbox[data-variant='production-config'] .ui-rich-select__option .ui-rich-select__visual",
  'background: transparent;',
  'border: 0;',
]) {
  assert.ok(style.includes(text), `生产配置收起态视觉缺少 ${text}`);
}

for (const text of [
  '收起触发按钮固定为正方形并按内容宽度布局',
  '只显示当前产物／作业制度图片',
  '不显示名称、参数摘要或下拉箭头',
  '图片槽不得绘制独立黑色底板',
  '不得横向拉伸填满所在列',
  '完整名称与参数只在展开候选中显示',
]) {
  assert.ok(design.includes(text), `UI 设计文档缺少生产配置规则：${text}`);
}
assert.equal(
  design.includes('控件收起时只显示当前方案的图标、名称和紧凑参数摘要'),
  false,
  'UI 设计文档不得保留旧的收起态名称与参数规则',
);

for (const text of [
  'collapsed production selectors use square artwork buttons without filling their columns',
  'expectSquareImageOnlyTrigger',
  'Math.abs(geometry.width - geometry.height)',
  'geometry.fieldWidth - geometry.width',
  'expectedSize',
  "innerText.trim()",
  "toBe('')",
  '.ui-rich-select__chevron',
  'backgroundColor',
  'borderTopWidth',
  '机械工厂生产产物',
  '机械工厂生产方式',
  "toContainText('投入')",
  "toContainText('周期 60s')",
]) {
  assert.ok(browser.includes(text), `生产配置浏览器回归缺少 ${text}`);
}

console.log('生产配置视觉验证通过：收起态使用不拉伸的正方形透明底图片按钮且无箭头，完整详情只在展开菜单中显示。');
