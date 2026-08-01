import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

const stylePath = 'src/styles/mobile-interaction.css';
const mainPath = 'src/main.tsx';
const designSystemPath = 'src/styles/design-system.css';
const docsPath = 'docs/README.md';
const chartDocsPath = 'docs/MARKET_CHART_LAYOUT_DESIGN.md';
const browserSpecPath = 'tests/browser/mobile-chart-tap-highlight.spec.ts';
const packagePath = 'package.json';

[
  stylePath,
  mainPath,
  designSystemPath,
  docsPath,
  chartDocsPath,
  browserSpecPath,
  packagePath,
].forEach(requireFile);

for (const text of [
  '@media (hover: none) and (pointer: coarse)',
  'button,',
  'a,',
  '.ui-button,',
  '.ui-switch,',
  '.ui-toggle-field,',
  '[role="button"],',
  '.economy-chart,',
  '.economy-chart__canvas,',
  '.economy-chart__canvas *,',
  '.market-history-chart',
  '-webkit-tap-highlight-color: transparent;',
]) requireText(stylePath, text);

for (const forbidden of [
  ':focus',
  ':focus-visible',
  'outline: none',
  'box-shadow: none',
]) forbidText(stylePath, forbidden);

requireText(mainPath, "import './styles/mobile-interaction.css'");
const main = read(mainPath);
const interactionIndex = main.indexOf("import './styles/mobile-interaction.css'");
const designIndex = main.indexOf("import './styles/design-system.css'");
if (interactionIndex < 0 || designIndex < 0 || interactionIndex > designIndex) {
  failures.push('mobile-interaction.css 必须在 design-system.css 之前加载');
}

for (const text of [
  'button:focus-visible',
  '.ui-button:focus-visible',
  '.ui-switch:focus-visible::before',
]) requireText(designSystemPath, text);

for (const text of [
  '移动触摸反馈与可访问性',
  '关闭浏览器原生蓝色 tap highlight',
  '保留 `:focus-visible` 键盘焦点',
  '`src/styles/mobile-interaction.css`',
  '`scripts/verify-mobile-touch-feedback.mjs`',
]) requireText(docsPath, text);

for (const text of [
  '移动端触控高亮',
  '`.economy-chart`',
  '`.economy-chart__canvas`',
  'ECharts 动态生成的 SVG／Canvas 子节点',
  '`.market-history-chart`',
  '`tests/browser/mobile-chart-tap-highlight.spec.ts`',
]) requireText(chartDocsPath, text);

for (const text of [
  "test.use({",
  'hasTouch: true',
  'isMobile: true',
  "page.goto('market-runtime-test.html?scenario=active')",
  "page.addStyleTag({ url: '/src/styles/mobile-interaction.css' })",
  "'.market-history-chart.full'",
  "'.economy-chart__canvas svg'",
  "'.economy-chart__canvas svg path'",
  'webkitTapHighlightColor',
  "await chart.tap({ position: { x: 180, y: 120 } })",
  "'rgba(0, 0, 0, 0)'",
]) requireText(browserSpecPath, text);

requireText(packagePath, 'node scripts/verify-mobile-touch-feedback.mjs');

if (failures.length > 0) {
  console.error('移动触摸反馈验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('移动触摸反馈验证通过：按钮、链接与图表交互区域的原生蓝色 tap highlight 已关闭，键盘 focus-visible 焦点保持不变。');
