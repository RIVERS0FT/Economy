// Regional buildings ledger geometry regression guard.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const main = read('src/main.tsx');
const shell = read('src/styles/game-shell-layout.css');
const page = read('src/pages/BuildingsPage.tsx');
const production = read('src/styles/facility-group-card-grid.css');
const productionSurface = read('src/styles/production-surface.css');
const legacyIndustryStyles = read('src/styles/industry-system.css');
const productionAlignmentDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');
const browserTest = read('tests/browser/buildings-ledger-layout.spec.ts');
const chrome = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');

for (const text of [
  '--desktop-page-top-offset: var(--desktop-layout-gutter);',
  'padding-top: 0;',
  'scroll-padding-top: 0;',
]) assert.equal(shell.includes(text), true, `桌面外壳缺少: ${text}`);

const facilityGridImport = "import './styles/facility-group-card-grid.css';";
const productionSurfaceImport = "import './styles/production-surface.css';";
assert.equal(main.includes(facilityGridImport), true, '入口缺少工厂基础主从样式');
assert.equal(main.includes(productionSurfaceImport), true, '入口缺少建筑页最终表面样式');
assert.equal(
  main.indexOf(productionSurfaceImport) > main.indexOf(facilityGridImport),
  true,
  'production-surface.css 必须在 facility-group-card-grid.css 之后加载，才能成为建筑账本最终权威',
);

for (const text of [
  'Victoria-style building ledger final layout',
  'grid-template-columns: repeat(auto-fit, minmax(min(26rem, 100%), 1fr));',
  'grid-template-areas: none;',
  '.production-workspace > .facility-cluster-navigation {',
  'grid-column: 1 / -1;',
  'order: 1;',
  '.production-workspace > .production-build-card {',
  'order: 2;',
  '.production-workspace > .facility-cluster-detail-shell {',
  'order: 3;',
  '.buildings-list-filters {',
  'repeat(auto-fit, minmax(min(11rem, 100%), 1fr))',
  '.facility-cluster-selector-list {',
  'grid-template-columns: minmax(0, 1fr);',
  '.facility-cluster-selector-card {',
  'min-height: 4.75rem;',
  'aspect-ratio: auto;',
  'max-width: none;',
  ".facility-cluster-selector-card[data-status='running']::after",
  "content: '运行中';",
  ".facility-cluster-selector-card[data-status='error']::after",
  "content: '异常';",
  ".facility-cluster-selector-card[data-status='stopped']::after",
  "content: '已停止';",
  ".facility-cluster-selector-card[data-status='constructing']::after",
  "content: '建设中';",
  ".facility-cluster-count::before",
  "content: '数量 ';",
  '@media (min-width: 961px)',
  'position: static;',
  'top: auto;',
  'max-height: none;',
  'overflow: visible;',
]) assert.equal(productionSurface.includes(text), true, `建筑账本最终样式缺少: ${text}`);

for (const text of [
  '--production-pill-visible-height: 1.6rem;',
  'width: 2.75rem;',
  'height: var(--production-pill-visible-height);',
  '--production-switch-thumb-size: 1rem;',
]) assert.equal(productionSurface.includes(text), true, `建筑页胶囊／开关规则缺少: ${text}`);

const finalDesktopBlock = productionSurface.match(
  /@media \(min-width: 961px\)\s*\{([\s\S]*)\}\s*$/,
)?.[1] ?? '';
assert.equal(finalDesktopBlock.includes('position: sticky;'), false, '建筑账本最终桌面布局不得恢复 sticky');
assert.equal(finalDesktopBlock.includes('overflow-y: auto;'), false, '建筑账本建设或详情不得恢复独立纵向滚动');

for (const text of [
  '建筑页参考大型经营模拟游戏的高密度建筑账本信息组织方式',
  '已拥有建筑账本（始终第一、始终占满当前管理区宽度）',
  '基于 `.production-workspace` 自身可用宽度',
  '不得恢复 4:5 大卡作为最终桌面／移动呈现',
  '建设卡与详情外壳不再使用建筑页场景 sticky',
  'position: static;',
  '`production-surface.css` 是地区建筑页最终账本密度',
  '`tests/browser/buildings-ledger-layout.spec.ts`',
]) assert.equal(productionAlignmentDesign.includes(text), true, `建筑账本设计缺少: ${text}`);

for (const text of [
  "runtime-test.html?view=production&scenario=activity",
  "regional buildings uses a dense ledger before build and detail surfaces",
  "mobile building ledger stays inside the workspace sheet without horizontal clipping",
  "expect(ledgerBox.y).toBeLessThan(buildBox.y)",
  "expect(rowBox.width).toBeGreaterThan(rowBox.height * 3)",
  "expect(geometry.buildPosition).toBe('static')",
  "expect(geometry.detailPosition).toBe('static')",
  'workspaceScrollWidth',
  'workspaceClientWidth',
]) assert.equal(browserTest.includes(text), true, `建筑账本浏览器回归缺少: ${text}`);

assert.equal(page.includes('facility-card-spacer'), false, '生产详情不得渲染占位 spacer DOM');
assert.equal(production.includes('.facility-card-spacer'), false, '生产基础布局不得保留 spacer CSS');
assert.equal(legacyIndustryStyles.includes('.production-grid {'), false, '旧产业样式不得控制生产主网格');
assert.equal(chrome.includes('`--desktop-page-top-offset` 只表示下方工作区内部沟槽'), true, '外壳设计缺少工作区内部顶部偏移规则');

console.log('建筑页账本验证通过：账本优先、承载宽度自适应、横向工厂行、桌面非 sticky、移动无裁切和紧凑开关规则均已锁定。');
