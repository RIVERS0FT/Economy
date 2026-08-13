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
  'src/pages/ResearchPage.tsx',
  'src/styles/research-page.css',
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
  'className="research-tree"',
  'research-stage-node',
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
  '宝石固定减少',
  '按产业链选择科技节点',
  "technology.kind === 'operation' ? '作业科技' : '生产科技'",
  "technology.kind === 'operation' ? '解锁作业制度' : '解锁工厂'",
  'active.durationMs ?? technology.durationMs',
]) requireText('src/pages/ResearchPage.tsx', text);

for (const text of [
  '.research-stage-node',
  '.research-technology-node',
  '.research-technology-node[data-status="active"]',
  '.research-technology-node[data-selected="true"]',
  '@media (max-width: 720px)',
  '.mobile-detail-summary.research-detail-summary {',
  'aspect-ratio: 1 / 1;',
]) requireText('src/styles/research-page.css', text);

for (const text of [
  'renders seven stages and split technology nodes',
  'preserves an explicit technology selection across refreshed snapshots',
  'shows concrete prerequisite requirements',
  'uses the stored base duration for accelerated node research progress',
  'opens technology details in the shared mobile sheet',
  'distinguishes operation research from production research',
]) requireText('tests/browser/research-technology-tree.spec.ts', text);

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
  '旧客户端',
  '周期轮询、动作后同步和权威倒计时确认对客户端交互状态必须透明',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  'completedTechnologyIds',
  'legacy-stage-',
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);

for (const forbidden of [
  'C1-C7 是不可跳级的主干',
  '只能启动当前等级的下一级',
]) forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', forbidden);
for (const forbidden of [
  'createPortal',
  'useWorkspaceDialogLayer',
  'setSelectedTechnologyId(defaultTechnologyId);',
  'technologies[technologies.length - 1]',
]) forbidText('src/pages/ResearchPage.tsx', forbidden);

if (failures.length > 0) {
  console.error(`research page verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('split technology tree, refresh-stable selection, detail requirements, mobile sheet, acceleration, server access and design verification passed');
