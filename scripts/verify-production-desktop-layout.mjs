// Regional factory-card and second-level detail geometry regression guard.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const main = read('src/main.tsx');
const shell = read('src/styles/game-shell-layout.css');
const page = read('src/pages/BuildingsPage.tsx');
const provincePage = read('src/pages/ProvincePage.tsx');
const production = read('src/styles/facility-group-card-grid.css');
const productionSurface = read('src/styles/production-surface.css');
const designSystem = read('src/styles/design-system.css');
const regionalEntityTitle = read('src/styles/regional-entity-page-title.css');
const legacyIndustryStyles = read('src/styles/industry-system.css');
const productionAlignmentDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');
const browserTest = read('tests/browser/buildings-ledger-layout.spec.ts');
const pageGeometryTest = read('tests/browser/player-page-geometry.spec.ts');
const runtimeHarness = read('tests/browser/runtime-harness.tsx');
const chrome = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');

for (const text of [
  '--desktop-page-top-offset: var(--desktop-layout-gutter);',
  'padding-top: 0;',
  'scroll-padding-top: 0;',
]) assert.equal(shell.includes(text), true, `桌面外壳缺少: ${text}`);

const facilityGridImport = "import './styles/facility-group-card-grid.css';";
const productionSurfaceImport = "import './styles/production-surface.css';";
const regionalEntityTitleImport = "import './styles/regional-entity-page-title.css';";
const runtimeProductionSurfaceImport = "import '../../src/styles/production-surface.css';";
const runtimeRegionalEntityTitleImport = "import '../../src/styles/regional-entity-page-title.css';";
assert.equal(main.includes(facilityGridImport), true, '入口缺少工厂基础卡片样式');
assert.equal(main.includes(productionSurfaceImport), true, '入口缺少建筑页最终表面样式');
assert.equal(main.includes(regionalEntityTitleImport), true, '入口缺少地区实体共享两行标题样式');
assert.equal(
  main.indexOf(productionSurfaceImport) > main.indexOf(facilityGridImport),
  true,
  'production-surface.css 必须在 facility-group-card-grid.css 之后加载，才能收束地区工厂卡片',
);
assert.equal(
  main.indexOf(regionalEntityTitleImport) > main.indexOf(productionSurfaceImport),
  true,
  '地区实体标题样式必须在建筑页表面样式之后加载，以覆盖旧工厂详情标题兼容规则',
);
assert.equal(runtimeHarness.includes(runtimeProductionSurfaceImport), true, '浏览器夹具缺少建筑页最终表面样式');
assert.equal(runtimeHarness.includes(runtimeRegionalEntityTitleImport), true, '浏览器夹具缺少地区实体共享两行标题样式');
assert.equal(
  runtimeHarness.indexOf(runtimeRegionalEntityTitleImport) > runtimeHarness.indexOf(runtimeProductionSurfaceImport),
  true,
  '浏览器夹具必须按正式入口顺序在 production-surface.css 后加载地区实体标题样式',
);

for (const forbidden of [
  'buildingQuery',
  'buildingCategory',
  'buildingStatus',
  'facility-cluster-navigation',
  '按产业和运行状态筛选建筑',
  'MobileFacilityDetailSheet',
  'isMobileFacilityLayout',
]) assert.equal(page.includes(forbidden), false, `地区建筑列表不得恢复可执行旧结构: ${forbidden}`);

for (const text of [
  'detailFacilityTypeId?: string;',
  'onDetailFacilityChange?: (facilityTypeId: string | null) => void;',
  'const buildCard = (',
  'const facilityList = (',
  'className="regional-buildings-management"',
  '{buildCard}',
  '{facilityList}',
  'className="facility-cluster-selector-region"',
  'orderedFacilityGroups.map((entry) => (',
  'onSelect={() => selectFacilityEntry(entry.type.id)}',
  'className="facility-cluster-detail-shell facility-cluster-detail-page"',
  '<FacilityClusterDetailContent',
]) assert.equal(page.includes(text), true, `地区建筑实现缺少: ${text}`);
assert.equal(page.indexOf('{buildCard}') < page.indexOf('{facilityList}'), true, '建设新工厂必须位于工厂卡片列表之前');

for (const text of [
  '.regional-buildings-management {',
  '.facility-cluster-selector-region {',
  '.facility-cluster-selector-list {',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.facility-cluster-selector-card {',
  'width: 100%;',
  'max-width: none;',
  'aspect-ratio: 4 / 5;',
  '.facility-cluster-detail-shell.facility-cluster-detail-page {',
  'position: static;',
  'top: auto;',
  'max-height: none;',
  'overflow: visible;',
  '.province-facility-detail-title {',
  'text-overflow: ellipsis;',
  'white-space: nowrap;',
]) assert.equal(productionSurface.includes(text), true, `地区建筑最终样式缺少: ${text}`);

for (const forbidden of [
  '--size-control-md',
  '--size-control-sm',
  'body:has(.regional-buildings-management) .page-heading--player-navigation .page-heading-title',
  'body:has(.facility-cluster-detail-page) .page-heading--player-navigation .page-heading-title',
  '.page-heading-title:has(> .province-page-title)',
  ".facility-cluster-selector-card[data-status='running']::after",
  "content: '运行中';",
  "content: '异常';",
  "content: '已停止';",
  "content: '建设中';",
  ".facility-cluster-count::before",
]) assert.equal(productionSurface.includes(forbidden), false, `建筑页不得恢复旧场景规则: ${forbidden}`);

for (const text of [
  '--player-page-title-track-height: 40px;',
  '--font-size-player-page-title: 1.25rem;',
  '.page-heading--player-navigation .page-heading-title {',
  'height: var(--player-page-title-track-height);',
  '.page-heading--player-navigation .page-heading-title > h1 {',
  'font-size: var(--font-size-player-page-title);',
]) assert.equal(designSystem.includes(text), true, `共享玩家标题规则缺少: ${text}`);
assert.equal(
  regionalEntityTitle.includes('height: var(--player-page-title-track-height);'),
  true,
  '地区实体标题必须复用共享玩家标题轨道',
);

for (const text of [
  '--production-pill-visible-height: 1.6rem;',
  'width: 2.75rem;',
  'height: var(--production-pill-visible-height);',
  '--production-switch-thumb-size: 1rem;',
]) assert.equal(productionSurface.includes(text), true, `建筑页胶囊／开关规则缺少: ${text}`);

for (const text of [
  "const [fallbackFacilityDetailTypeId, setFallbackFacilityDetailTypeId] = useState<string | null>(null);",
  "location?.type === 'regional-facility'",
  "location.host === 'province'",
  "activeSection === 'buildings' && Boolean(facilityDetailType)",
  'className="province-facility-detail-title"',
  '<RegionalEntityPageTitle',
  "type: 'regional-facility'",
  "host: 'province'",
  'pageNavigation.pushPage({',
  '{!isEntityDetail ? sectionSwitch : null}',
  'detailFacilityTypeId={facilityDetailTypeId ?? undefined}',
  'onDetailFacilityChange={handleFacilityDetailChange}',
]) assert.equal(provincePage.includes(text), true, `地区工厂二级详情缺少: ${text}`);
assert.equal(provincePage.includes('actions={sectionSwitch}'), false, '地区五分区按钮不得回到固定标题操作区');

for (const text of [
  '删除“建筑概况”卡片',
  '“建设新工厂”是建筑列表态第一张一级卡片',
  '建筑列表不显示搜索输入框、产业分类下拉框或运行状态下拉框',
  '正式呈现恢复为原 4:5 插画卡片',
  '列表正式使用三列',
  '点击工厂卡片后进入当前地区建筑分区内部的二级详情视图',
  '地区子导航的名称与顺序以 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为唯一权威',
  '第一行是工厂实体名称',
  '第二行是州级地区全称并使用灰色次级文字',
  '`--player-page-title-track-height: 40px`',
  '`--font-size-player-page-title`',
  '建筑页不得再通过 `body:has(...)`',
  '`tests/browser/buildings-ledger-layout.spec.ts`',
  '`tests/browser/player-page-geometry.spec.ts`',
]) assert.equal(productionAlignmentDesign.includes(text), true, `建筑卡片设计缺少: ${text}`);

for (const text of [
  "runtime-test.html?view=production&scenario=activity",
  'regional buildings shows build first and three factory cards per row',
  'factory card opens second-level detail without changing header height',
  'mobile factory cards remain three columns without horizontal clipping',
  'gridTemplateColumns',
  'aspectRatio',
  'headerHeightBefore',
  'headerHeightAfter',
]) assert.equal(browserTest.includes(text), true, `建筑卡片浏览器回归缺少: ${text}`);

for (const text of [
  'expectSharedSingleLineTitleGeometry',
  'trackHeight',
  'fontSize',
  'toBeCloseTo(40, 0)',
  'toBeCloseTo(20, 0)',
]) assert.equal(pageGeometryTest.includes(text), true, `共享页面标题浏览器回归缺少: ${text}`);

assert.equal(page.includes('facility-card-spacer'), false, '生产详情不得渲染占位 spacer DOM');
assert.equal(production.includes('.facility-card-spacer'), false, '生产基础布局不得保留 spacer CSS');
assert.equal(legacyIndustryStyles.includes('.production-grid {'), false, '旧产业样式不得控制生产主网格');
assert.equal(chrome.includes('`--desktop-page-top-offset` 只表示下方工作区内部沟槽'), true, '外壳设计缺少工作区内部顶部偏移规则');

console.log('地区建筑验证通过：建设卡优先、三列 4:5 工厂卡、二级详情、正文分区导航、全玩家 40px 标题轨道与紧凑开关均已锁定。');