import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(`missing file: ${path}`);
}
function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} missing: ${text}`);
}
function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(`${path} must not contain: ${text}`);
}

for (const path of [
  'server/src/research-catalog.js',
  'server/src/research.js',
  'server/src/state-partitions.js',
  'server/src/commercial-contracts.js',
  'src/hooks/useStableSelection.ts',
  'src/research/researchTreeLayout.ts',
  'src/research/ResearchTreeViewport.tsx',
  'src/components/shell/SignedInShell.tsx',
  'src/components/ui/layout.tsx',
  'src/pages/ResearchPage.tsx',
  'src/styles/research-page.css',
  'src/styles/strategic-game-shell.css',
  'src/styles/design-system.css',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'src/types.ts',
  'src/utils/authoritativeCountdowns.ts',
  'server/src/game-routes.js',
  'server/src/gem-economy-store.js',
  'server/test/research.test.js',
  'server/test/research-gem-acceleration.test.js',
  'tests/browser/research-technology-tree.spec.ts',
  'scripts/verify-research-progression.mjs',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
]) requireFile(path);

for (const text of [
  'RESEARCH_TECHNOLOGY_CATALOG',
  "id: 'basic-crops'",
  "id: 'appliance-engineering'",
  'prerequisiteTechnologyIds',
  'unlockFacilityTypeIds',
  "id: 'tool-operation'",
  "kind: 'operation'",
  'operationProductIds',
]) requireText('server/src/research-catalog.js', text);

for (const text of [
  'completedTechnologyIds',
  'completedAtByTechnologyId',
  'startTechnologyResearch',
  'startLegacyStageResearch',
  'hasResearchAccessForFacility',
  'researchTechnologies',
  'GEM_RESEARCH_ACCELERATION_MS',
  'nextResearchDeadlineAt',
]) requireText('server/src/research.js', text);

for (const text of [
  'className="research-workspace"',
  'className="research-tree-panel"',
  '<PagePanel className="research-action-panel">',
  'className="research-tree"',
  'data-layout-direction="downward"',
  'ResearchTreeViewport',
  'className="research-tree-connections"',
  'research-technology-node',
  'ResearchDetailBody',
  'ResearchDetailActions',
  'MobileResearchDetailSheet',
  'MobileWorkspaceDetailSheet',
  'MobileDetailSummary',
  'useStableSelection<string>',
  'const technologyId = selectedTechnology.id;',
  'model.startResearch(technologyId)',
  'model.accelerateResearch()',
  'className="research-investment mobile-detail-section"',
  '研发中 · ${formatNumber(accelerationCost)} 宝石加速 ${formatDuration(accelerationMs)}',
  'outputProductIdsForFacility',
  'className="facility-build-output-list"',
  '按产业链选择科技节点',
  "technology.kind === 'operation' ? '作业科技' : '生产科技'",
  "technology.kind === 'operation' ? '解锁作业制度' : '解锁工厂'",
  'active.durationMs ?? technology.durationMs',
  'buildResearchTreeLayout(technologies)',
  'buildResearchTreeFocus(technologies',
  'scrollable={false}',
]) requireText('src/pages/ResearchPage.tsx', text);

const researchPageSource = read('src/pages/ResearchPage.tsx');
const finalPageLayoutCloseIndex = researchPageSource.lastIndexOf('</PageLayout>');
const mobileResearchDetailIndex = researchPageSource.lastIndexOf('<MobileResearchDetailSheet');
if (finalPageLayoutCloseIndex < 0 || mobileResearchDetailIndex <= finalPageLayoutCloseIndex) {
  failures.push('mobile research detail registration must remain outside PageLayout so the tree is the only fixed-page body child');
}

for (const text of [
  'technologyDepths',
  'orderedLayers',
  'x: number',
  'y: number',
  'path: string',
  'buildResearchTreeFocus',
]) requireText('src/research/researchTreeLayout.ts', text);

for (const text of [
  '.research-tree-viewport',
  '.research-action-panel {',
  'position: absolute;',
  'top: var(--layout-gutter);',
  'left: var(--layout-gutter);',
  'width: min(320px, calc(100% - var(--layout-gutter) * 2));',
  '.research-tree-transform-layer',
  '.research-tree-connections',
  'touch-action: none;',
  'border: 0;',
  'border-radius: 0;',
  'background: transparent;',
  '--research-focus-color: var(--color-accent-violet);',
  ".research-tree-edge[data-related='true']",
  ".research-tree-edge[data-highlighted='true']",
  'translate: -50% -50%;',
  'transform: none;',
  '.research-technology-node',
  '.research-technology-node[data-status=',
  '.research-technology-node[data-selected=',
  '@media (max-width: 720px)',
  '.mobile-detail-summary.research-detail-summary {',
  'aspect-ratio: 1 / 1;',
  '.research-investment-list {',
  '.research-unlock-copy .facility-build-output-list {',
  '.page-card-static .research-workspace {',
  'height: 100%;',
  'overflow: hidden;',
  '.page-card-static .research-tree-viewport {',
]) requireText('src/styles/research-page.css', text);
requireText(
  'src/components/shell/SignedInShell.tsx',
  '<FrostedGlassSurface variant="workspaceCard" className="signed-in-shell__primary-card">',
);
for (const text of [
  '.game-shell .signed-in-shell__primary-card {',
  'border-radius: var(--strategic-panel-radius);',
]) requireText('src/styles/strategic-game-shell.css', text);
for (const text of [
  '.game-shell.strategic-tab-research .signed-in-shell__primary-card {',
  '.game-shell.strategic-tab-research .signed-in-shell__primary-card::before {',
]) forbidText('src/styles/strategic-game-shell.css', text);
for (const text of [
  '.page-card-static > .ui-page-stack {',
  'grid-template-rows: minmax(0, 1fr);',
  'align-content: stretch;',
]) requireText('src/styles/design-system.css', text);
for (const text of [
  'position: sticky;',
  'grid-template-areas: "action tree"',
]) forbidText('src/styles/research-page.css', text);
for (const text of [
  'scrollable = true',
  'className="page-card-static"',
  "pageNavigation && !scrollable && 'page-content--fixed-body'",
]) requireText('src/components/ui/layout.tsx', text);

for (const text of [
  'renders a downward prerequisite tree on desktop',
  'actionInsideTree',
  'expect(researchGeometry.treeViewport).toEqual(researchGeometry.treePanel)',
  "expect(fixedPageOverflow.stackAlignContent).toBe('stretch')",
  'fixedPageOverflow.stackChildCount',
  'fixedPageOverflow.stackOnlyWorkspace',
  'fixedPageOverflow.stackScrollHeight',
  'mobilePageStructure.containsDialog',
  'researchGeometry.workspace?.bottom',
  'researchGeometry.outerCard',
  'researchGeometry.treeSurface',
  "toHaveAttribute('data-frosted-glass-variant', 'workspaceCard')",
  "researchGeometry.outerCard?.borderTopWidth).toBe('1px')",
  "researchGeometry.outerCard?.backgroundColor).toBe('rgba(5, 20, 14, 0.76)')",
  "researchGeometry.outerCard?.backdropFilter).toContain('blur(18px)')",
  'keeps node geometry stable on hover and selected dependency lines visible',
  'preserves an explicit technology selection across refreshed snapshots',
  'shows only research cost and time while merging active acceleration into the research action',
  'uses the stored base duration for accelerated node research progress',
  'uses one world geometry on mobile with pan and zoom instead of two-lane reflow',
  'supports desktop drag, wheel zoom, and double-click focus without changing world coordinates',
  'zoomBeforeDoubleClick',
  'expectedY: viewportRect.top + viewportRect.height * 0.42',
  'opens technology details in the shared mobile sheet',
  'distinguishes operation research from production research',
  "not.toContainText('使用后剩余')",
  "page.getByRole('heading', { name: '技术树' })).toHaveCount(0)",
  "getByText('32 项科技', { exact: true })).toHaveCount(0)",
  "page.locator('.page-card-scroll-area')).toHaveCount(0)",
  "page.locator('.page-card-static')).toBeVisible()",
  "getByText('完整阶段', { exact: false })).toHaveCount(0)",
  "page.locator('.page-heading-actions')).toHaveCount(0)",
]) requireText('tests/browser/research-technology-tree.spec.ts', text);

for (const text of [
  'clampResearchTreeViewport',
  'zoomResearchTreeAtPoint',
  'translate3d(',
  'data-pan-x',
  'data-zoom',
  'normalizedDeltaY',
  'onDoubleClick={handleDoubleClick}',
  'centerCurrent();',
  '定位当前科技',
  '查看完整技术树',
]) requireText('src/research/ResearchTreeViewport.tsx', text);
forbidText('src/research/ResearchTreeViewport.tsx', 'if (!event.ctrlKey && !event.metaKey) return;');

requireText('src/api/game.ts', "postAction('/research/start', { technologyId })");
requireText('src/api/game.ts', "postAction('/research/accelerate')");
requireText('src/types.ts', 'export interface ResearchTechnologyDefinition');
requireText('src/types.ts', 'researchTechnologies?: ResearchTechnologyDefinition[]');
requireText('src/utils/authoritativeCountdowns.ts', 'game.research?.active?.completesAt');
requireText('server/src/game-routes.js', "path === '/api/game/research/start'");
requireText('server/src/game-routes.js', "path === '/api/game/research/accelerate'");
requireText('server/src/state-partitions.js', "'researchTechnologies'");
requireText('server/src/commercial-contracts.js', 'hasResearchAccessForFacility');

for (const text of [
  '工厂研发准入由具体科技节点决定',
  'complexity` 继续负责',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);
for (const text of [
  'C1–C7 只作为产业阶段',
  '其余节点按照真实产业链设置前置关系',
  '自上而下 DAG',
  '结构定位不得复用 `transform`',
  '选中科技只能改变节点和连接线的强调状态',
  '同一确定性 DAG 世界坐标',
  '单指拖动平移',
  '普通鼠标滚轮',
  '双击定位当前科技',
  '双指缩放',
  '桌面研发页继续使用与其他玩家页面相同的统一 `workspaceCard` 外层容器',
  '旧客户端',
  '周期轮询、动作后同步和权威倒计时确认对客户端交互状态必须透明',
  '投入信息只显示研发费用和研发时间',
  '不得在进度区再渲染第二个宝石加速按钮',
  '可生产产物图标与名称',
  '页面自身不得纵向滚动',
  '科技节点画布必须占满标题下方的全部可用页面区域',
  '页面卡片正文只允许包含科技画布工作区本身',
  '树状图下方不得再渲染详情、操作、摘要或其他卡片',
  '移动端详情注册组件必须位于 `PageLayout` 正文之外',
  '操作卡覆盖在科技画布内部左上角',
  '不显示“完整阶段 Cn”',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
requireText('docs/UI_DESIGN_SYSTEM.md', '固定宿主必须显式使用 `grid-template-rows: minmax(0, 1fr)`');
for (const text of [
  'completedTechnologyIds',
  'legacy-stage-',
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);

for (const forbidden of [
  'C1-C7 是不可跳级的主干',
  '只能启动当前等级的下一级',
  '桌面研发页去掉最外围工作区卡片视觉',
]) forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', forbidden);
for (const forbidden of [
  'createPortal',
  'useWorkspaceDialogLayer',
  'setSelectedTechnologyId(defaultTechnologyId);',
  'technologies[technologies.length - 1]',
  'research-stage-node',
  '具体要求',
  '产业经营视角',
  '就业资金已释放',
  'className="research-gem-acceleration"',
  'remainingAfterAcceleration',
  '完整阶段',
  'actions={',
]) forbidText('src/pages/ResearchPage.tsx', forbidden);
for (const forbidden of [
  'grid-template-columns: repeat(7',
  '.research-stage-node',
  'var(--color-accent)',
  'transform: translate(-50%, -50%)',
  '.research-tree-scroll',
  '.research-tree-connections--mobile',
  '--research-node-mobile-x',
  '--research-node-desktop-x',
  '.research-requirements',
  '.research-industry-context',
  '.research-gem-acceleration',
  '.research-tree-heading',
]) forbidText('src/styles/research-page.css', forbidden);
for (const forbidden of [
  'MOBILE_COLUMNS',
  'mobileXPercent',
  'mobileY',
  'mobilePath',
  'desktopX',
  'desktopPath',
]) forbidText('src/research/researchTreeLayout.ts', forbidden);
for (const forbidden of [
  'research-tree-connections--mobile',
  'research-tree-connections--desktop',
]) forbidText('src/pages/ResearchPage.tsx', forbidden);

const researchCss = read('src/styles/research-page.css');
const relatedEdgeIndex = researchCss.indexOf(".research-tree-edge[data-related='true']");
const highlightedEdgeIndex = researchCss.indexOf(".research-tree-edge[data-highlighted='true']");
if (relatedEdgeIndex < 0 || highlightedEdgeIndex < relatedEdgeIndex) {
  failures.push('research highlighted edge rule must follow the weaker related edge rule');
}

if (failures.length > 0) {
  console.error(`research page verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('downward prerequisite research DAG, stable hover geometry, ordinary wheel zoom, drag pan, double-click current focus, shared workspace card with transparent research canvas, shared mobile pan/zoom viewport, stable selection, no below-tree page-flow card, detail sheet and design verification passed');
