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
  'src/config/navigation.ts',
  'src/components/icons/GameIcons.tsx',
  'src/pages/PageRouter.tsx',
  'src/pages/ResearchPage.tsx',
  'src/styles/research-page.css',
  'src/styles/mobile-detail-sheet.css',
  'src/components/ui/MobileWorkspaceDetailSheet.tsx',
  'src/components/ui/MobileDetailSummary.tsx',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'src/types.ts',
  'src/utils/authoritativeCountdowns.ts',
  'server/src/game-routes.js',
  'server/src/research.js',
  'server/src/storage.js',
  'server/src/gem-economy-store.js',
  'server/test/research.test.js',
  'server/test/research-gem-acceleration.test.js',
  'tests/browser/research-technology-tree.spec.ts',
  'scripts/verify-research-progression.mjs',
  'docs/README.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
]) requireFile(path);

requireText('src/config/navigation.ts', "id: 'research'");

for (const text of [
  "lazy(() => import('./ResearchPage')",
  "case 'research':",
  '<ResearchPage model={model} />',
]) requireText('src/pages/PageRouter.tsx', text);

for (const text of [
  'export function ResearchIcon',
  "case 'research': return <ResearchIcon",
]) requireText('src/components/icons/GameIcons.tsx', text);

for (const text of [
  'className="research-workspace"',
  'className="research-tree"',
  'className="research-level-node"',
  'className="research-facility-node"',
  'className="research-detail-content"',
  'className="research-requirements mobile-detail-section"',
  'MobileResearchDetailSheet',
  'MobileWorkspaceDetailSheet',
  'MobileDetailSummary',
  'ResearchDetailBody',
  'ResearchDetailActions',
  'FacilityIcon',
  'model.startResearch(selectedLevel.id)',
  'model.accelerateResearch()',
  '宝石固定减少',
  'useNow(',
  'active.completesAt',
  '(duration - remaining) / duration',
]) requireText('src/pages/ResearchPage.tsx', text);

requireText(
  'tests/browser/research-technology-tree.spec.ts',
  'uses the base duration for accelerated research progress',
);
for (const text of [
  'mobile research and factory details share the same sheet geometry',
  "page.locator('.mobile-detail-sheet')",
  'summaryColumns',
  'footerPaddingBottom',
  'artworkAspectRatio',
  'detailArtworkWidth',
  'detailArtworkHeight',
  'detailArtworkAspectRatio',
  'expectedDetailArtworkSize',
]) requireText('tests/browser/research-technology-tree.spec.ts', text);

for (const text of [
  'grid-template-columns: minmax(280px, 320px) minmax(300px, 360px) minmax(480px, 1fr);',
  'grid-template-areas: "action tree tree";',
  'border-radius: 50%;',
  '@media (max-width: 720px)',
  '.research-action-panel {\n    display: none;',
  '.mobile-detail-sheet-footer .research-detail-actions',
  '.mobile-detail-sheet .research-detail-summary-status',
  '.mobile-detail-summary.research-detail-summary {',
  '.mobile-detail-summary__artwork.research-detail-level-artwork {',
  'min-width: 4.5rem;',
  'max-width: 4.5rem;',
  'aspect-ratio: 1 / 1;',
]) requireText('src/styles/research-page.css', text);

for (const text of [
  '.mobile-detail-sheet-backdrop',
  '.mobile-detail-sheet-scroll',
  '.mobile-detail-sheet-footer',
  '.mobile-detail-summary',
  '--mobile-detail-sheet-max-height',
]) requireText('src/styles/mobile-detail-sheet.css', text);

for (const forbidden of [
  'createPortal',
  'useWorkspaceDialogLayer',
]) forbidText('src/pages/ResearchPage.tsx', forbidden);
for (const forbidden of [
  '.mobile-detail-sheet .research-detail-actions {\n    position: sticky;',
  'max-height: min(88svh, 760px);',
  '.research-detail-sheet-backdrop',
  'legacyClassPrefix',
]) forbidText('src/styles/research-page.css', forbidden);


for (const text of [
  'className="research-level-card"',
  'research-baseline-card',
]) forbidText('src/pages/ResearchPage.tsx', text);

requireText('src/api/game.ts', "postAction('/research/start'");
requireText('src/api/game.ts', "postAction('/research/accelerate')");
requireText('src/app/gameViewModel.ts', 'accelerateResearch: () => Promise<ActionResult>');
requireText('src/types.ts', 'gemAccelerationMs?: number');
requireText('src/utils/authoritativeCountdowns.ts', 'game.research?.active?.completesAt');
requireText('server/src/game-routes.js', "path === '/api/game/research/start'");
requireText('server/src/game-routes.js', "path === '/api/game/research/accelerate'");

for (const text of [
  'RESEARCH_LEVEL_CATALOG',
  'GEM_RESEARCH_ACCELERATION_MS',
  'GEM_RESEARCH_ACCELERATION_COST',
  "action !== 'startResearch' && action !== 'accelerateResearch'",
  'player.gems = Number(player.gems || 0) - GEM_RESEARCH_ACCELERATION_COST',
  'gemAccelerationMs',
  'validateResearchAccess',
  'nextResearchDeadlineAt',
]) requireText('server/src/research.js', text);

for (const text of [
  "action === 'accelerateResearch'",
  'recordResearchAcceleration',
]) requireText('server/src/storage.js', text);

for (const text of [
  'economy_research_gem_actions',
  'recordResearchAcceleration',
]) requireText('server/src/gem-economy-store.js', text);

for (const text of [
  'immediately completes research shorter than thirty minutes',
  'shortens a long active project by exactly thirty minutes',
  'rejects missing gems without changing the deadline',
]) requireText('server/test/research-gem-acceleration.test.js', text);

for (const text of [
  'C1-C7',
  '树状图',
  '圆形',
  '1 宝石',
  '30 分钟',
  'MobileWorkspaceDetailSheet',
  'MobileDetailSummary',
  '固定底栏',
  '桌面“研发新技术”摘要中的代表工厂图标固定为 1:1 正圆',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '研发加速',
  'economy_research_gem_actions',
  '/api/game/research/accelerate',
]) requireText('docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md', text);

if (failures.length > 0) {
  console.error(`research page verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('research tree, detail requirements, mobile sheet, gem acceleration, server audit, and design verification passed');
