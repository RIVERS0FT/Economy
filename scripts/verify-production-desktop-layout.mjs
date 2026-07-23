// Desktop production workspace geometry regression guard.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const main = read('src/main.tsx');
const shell = read('src/styles/game-shell-layout.css');
const page = read('src/pages/ProductionPage.tsx');
const production = read('src/styles/facility-group-card-grid.css');
const productionSurface = read('src/styles/production-surface.css');
const legacyIndustryStyles = read('src/styles/industry-system.css');
const industry = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const productionAlignmentDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');
const chrome = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
const readme = read('README.md');

for (const text of [
  '--desktop-page-top-offset: calc(',
  'padding-top: var(--desktop-page-top-offset);',
  'scroll-padding-top: var(--desktop-page-top-offset);',
]) assert.equal(shell.includes(text), true, `桌面外壳缺少: ${text}`);

for (const text of [
  'Desktop production workspace density',
  'align-self: start;',
  'grid-template-rows: auto;',
  'align-content: start;',
  '@media (min-width: 1600px)',
  'minmax(440px, 520px)',
  'minmax(480px, 680px)',
  'justify-content: start;',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
]) assert.equal(production.includes(text), true, `桌面生产布局缺少: ${text}`);

const facilityGridImport = "import './styles/facility-group-card-grid.css';";
const productionSurfaceImport = "import './styles/production-surface.css';";
assert.equal(main.includes(facilityGridImport), true, '入口缺少工厂主从布局样式');
assert.equal(main.includes(productionSurfaceImport), true, '入口缺少生产表面样式');
assert.equal(
  main.indexOf(productionSurfaceImport) > main.indexOf(facilityGridImport),
  true,
  '生产表面样式必须在工厂主从布局后加载，才能成为 sticky 对齐最终权威',
);

for (const text of [
  'Desktop production sticky alignment',
  '.production-workspace > .production-build-card,',
  '.production-workspace > .facility-cluster-detail-shell {',
  'position: sticky;',
  'top: 0;',
  'align-self: start;',
  'max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));',
  'overflow-y: auto;',
  '.production-workspace > .facility-cluster-detail-shell,',
  '.production-workspace .facility-cluster-detail-card {',
  'max-height: none;',
  'overflow: visible;',
]) assert.equal(productionSurface.includes(text), true, `生产 sticky 最终样式缺少: ${text}`);

const detailNaturalHeightBlock = productionSurface.match(
  /\.production-workspace > \.facility-cluster-detail-shell,\s*\.production-workspace \.facility-cluster-detail-card\s*\{([^}]*)\}/s,
)?.[1] ?? '';
assert.equal(detailNaturalHeightBlock.includes('max-height: none;'), true, '详情固定外壳必须保持自然最大高度');
assert.equal(detailNaturalHeightBlock.includes('overflow: visible;'), true, '详情固定外壳必须保持可见溢出');
assert.equal(detailNaturalHeightBlock.includes('overflow-y:'), false, '详情固定外壳不得创建独立纵向滚动');

const gridBuildBlocks = [...production.matchAll(/\.production-build-card\s*\{([^}]*)\}/gs)]
  .map((match) => match[1]);
for (const block of gridBuildBlocks) {
  for (const forbidden of [
    'position: sticky',
    'top: var(--desktop-page-top-offset)',
    '100dvh',
    'overflow-y:',
    'overscroll-behavior',
  ]) assert.equal(block.includes(forbidden), false, `工厂主网格不得重新声明建设卡桌面固定职责: ${forbidden}`);
}

const gridDetailShellBlocks = [...production.matchAll(/\.facility-cluster-detail-shell\s*\{([^}]*)\}/gs)]
  .map((match) => match[1]);
for (const block of gridDetailShellBlocks) {
  for (const forbidden of [
    'position: sticky',
    'top:',
    'max-height:',
    'overflow-y:',
  ]) assert.equal(block.includes(forbidden), false, `工厂主网格不得重新声明详情外壳固定职责: ${forbidden}`);
}

assert.equal(page.includes('facility-card-spacer'), false, '生产详情不得渲染占位 spacer DOM');
assert.equal(production.includes('.facility-card-spacer'), false, '生产布局不得保留 spacer CSS');
assert.equal(legacyIndustryStyles.includes('.production-grid {'), false, '旧产业样式不得控制生产主网格');
const legacyBuildBlocks = [...legacyIndustryStyles.matchAll(/\.production-build-card\s*\{([^}]*)\}/gs)]
  .map((match) => match[1]);
for (const block of legacyBuildBlocks) {
  for (const property of [
    'position:',
    'top:',
    'align-self:',
    'max-height:',
    'overflow:',
    'overflow-y:',
    'overscroll-behavior',
  ]) assert.equal(block.includes(property), false, `旧产业建设卡不得声明: ${property}`);
}

for (const text of [
  '大于等于 `1600px` 时使用紧凑三列',
  '固定两列选择卡',
  '桌面详情卡高度由内容决定',
  '`--desktop-page-top-offset`',
  '`src/styles/facility-group-card-grid.css` 负责',
  '不得渲染无业务语义的 spacer DOM',
]) assert.equal(industry.includes(text), true, `产业设计缺少: ${text}`);

for (const text of [
  '生产页桌面 sticky 顶部定位也以本文为准',
  '`top: 0`',
  '`production-surface.css`',
  '唯一权威样式文件',
  '不得声明建设卡或详情外壳的 `position`',
  '建设卡与当前工厂详情外壳',
  '页面唯一纵向滚动视口',
  '`721px–960px` 恢复普通文档流',
]) assert.equal(productionAlignmentDesign.includes(text), true, `生产对齐设计缺少: ${text}`);

assert.equal(chrome.includes('页面顶部避让必须集中为 `--desktop-page-top-offset`'), true, '外壳设计缺少统一顶部避让规则');
assert.equal(readme.includes('大于等于 1600px 时建设卡、两列工厂集群选择器和自然高度的当前详情卡紧凑排列'), true, 'README 缺少桌面生产布局摘要');

console.log('桌面生产页建设卡与详情卡 sticky 对齐、唯一职责、自然高度详情和统一滚动验证通过。');
