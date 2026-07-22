// Desktop production workspace geometry regression guard.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const shell = read('src/styles/game-shell-layout.css');
const page = read('src/pages/ProductionPage.tsx');
const production = read('src/styles/facility-group-card-grid.css');
const legacyIndustryStyles = read('src/styles/industry-system.css');
const industry = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const chrome = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
const readme = read('README.md');

for (const text of [
  '--desktop-page-top-offset: calc(',
  'padding-top: var(--desktop-page-top-offset);',
  'scroll-padding-top: var(--desktop-page-top-offset);',
]) assert.equal(shell.includes(text), true, `桌面外壳缺少: ${text}`);

for (const text of [
  'Desktop production workspace density',
  '@media (min-width: 961px)',
  'position: sticky;',
  'top: var(--desktop-page-top-offset);',
  'max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));',
  'align-self: start;',
  'grid-template-rows: auto;',
  'align-content: start;',
  '@media (min-width: 1600px)',
  'minmax(440px, 520px)',
  'minmax(480px, 680px)',
  'justify-content: start;',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
]) assert.equal(production.includes(text), true, `桌面生产布局缺少: ${text}`);

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

assert.equal(chrome.includes('页面顶部避让必须集中为 `--desktop-page-top-offset`'), true, '外壳设计缺少统一顶部避让规则');
assert.equal(readme.includes('大于等于 1600px 时建设卡、两列工厂集群选择器和自然高度的当前详情卡紧凑排列'), true, 'README 缺少桌面生产布局摘要');

console.log('桌面生产页单一布局权威、自然高度详情、两列集群与统一 sticky 间隔验证通过。');
