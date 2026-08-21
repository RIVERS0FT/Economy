import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const map = read('src/components/provinces/UsMainlandMap.tsx');
const labels = read('src/components/provinces/provinceMapLabels.ts');
const styles = read('src/styles/province-map.css');
const browser = read('tests/browser/province-map.spec.ts');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');

for (const text of [
  'name: region.name',
  'name: province.name',
  'label: {\n        show: false,',
  'createProvinceMapLabelRenderer',
  'data-map-label-mode="curved-chinese-full-name"',
]) assert.ok(map.includes(text), `地图中文州名实现缺少: ${text}`);

for (const text of [
  'export function pointInPolygon',
  'export function longestInteriorChord',
  'export function quadraticPathInsidePolygon',
  "createSvgElement('textPath')",
  "text.dataset.labelFit = 'inside'",
  "chart.on('georoam', handleGeoRoam)",
  "textPath.setAttribute('lengthAdjust', 'spacingAndGlyphs')",
]) assert.ok(labels.includes(text), `曲线州名几何实现缺少: ${text}`);

for (const text of [
  '.province-map-label-overlay',
  '.province-map-label',
  'pointer-events: none;',
]) assert.ok(styles.includes(text), `曲线州名样式缺少: ${text}`);

for (const text of [
  "data-map-label-count', '48'",
  "'加利福尼亚州', '得克萨斯州', '华盛顿州', '佛罗里达州', '纽约州'",
  'provinceLabelFontSize',
  "value === 'inside'",
]) assert.ok(browser.includes(text), `曲线州名浏览器回归缺少: ${text}`);

for (const text of [
  '中文州全名作为唯一州面名称',
  'SVG `textPath` 标签层',
  '名称与字号随地图缩放和平移同步变化',
]) assert.ok(pageDesign.includes(text), `页面权威设计缺少: ${text}`);

for (const text of [
  '中文州全名',
  'SVG `textPath`',
  '完整落在州面内部',
  '随地图缩放和平移同步重算',
]) assert.ok(uiDesign.includes(text), `UI 权威设计缺少: ${text}`);

for (const forbidden of [
  'name: region.shortName',
  'name: province.shortName',
  'HOVER_LABEL_STATE_CODES',
]) assert.equal(map.includes(forbidden), false, `地图不得恢复英文州缩写标签: ${forbidden}`);

console.log('地图中文曲线州名验证通过：中文全名、州内 textPath 拟合、无交互覆盖和随相机重算均已锁定。');
