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
  'src/api/game.ts',
  'src/utils/authoritativeCountdowns.ts',
  'server/src/game-routes.js',
  'server/src/research.js',
  'scripts/verify-research-progression.mjs',
  'docs/README.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
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
  'model.game.researchLevels.map',
  'model.startResearch(level.id)',
  'showResult(',
  '<Button',
  '<DataList>',
  'useNow(',
  'CurrencyAmount',
  'active.completesAt',
]) requireText('src/pages/ResearchPage.tsx', text);

for (const text of [
  '<EmptyState>',
  'research feature is not open',
]) forbidText('src/pages/ResearchPage.tsx', text);

requireText('src/api/game.ts', "postAction('/research/start'");
requireText('src/utils/authoritativeCountdowns.ts', 'game.research?.active?.completesAt');
requireText('server/src/game-routes.js', "path === '/api/game/research/start'");

for (const text of [
  'RESEARCH_LEVEL_CATALOG',
  'startResearch',
  'validateResearchAccess',
  'nextResearchDeadlineAt',
]) requireText('server/src/research.js', text);

for (const text of [
  'C1-C7',
  'researchLevels',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  'C1-C7',
  'verify-research-progression.mjs',
]) requireText('docs/README.md', text);

if (failures.length > 0) {
  console.error(`research page verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('research page, C1-C7 progression, server action, countdown, and design verification passed');
