// Desktop production workspace geometry regression guard.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const shell = read('src/styles/game-shell-layout.css');
const production = read('src/styles/facility-group-card-grid.css');
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
  'top: var(--desktop-page-top-offset);',
  'max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));',
  'align-self: start;',
  '.facility-cluster-detail-card.facility-group-card',
  'grid-template-rows: auto;',
  'align-content: start;',
  '.facility-card-spacer',
  'display: none;',
  '@media (min-width: 1600px)',
  'minmax(440px, 520px)',
  'minmax(480px, 680px)',
  'justify-content: start;',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
]) assert.equal(production.includes(text), true, `桌面生产布局缺少: ${text}`);

for (const text of [
  '大于等于 `1600px` 时使用紧凑三列',
  '固定两列选择卡',
  '桌面详情卡高度由内容决定',
  '`--desktop-page-top-offset`',
]) assert.equal(industry.includes(text), true, `产业设计缺少: ${text}`);

assert.equal(chrome.includes('页面顶部避让必须集中为 `--desktop-page-top-offset`'), true, '外壳设计缺少统一顶部避让规则');
assert.equal(readme.includes('大于等于 1600px 时建设卡、两列工厂集群选择器和自然高度的当前详情卡紧凑排列'), true, 'README 缺少桌面生产布局摘要');

console.log('桌面生产页两列集群、自然高度详情、宽度约束与统一 sticky 间隔验证通过。');
