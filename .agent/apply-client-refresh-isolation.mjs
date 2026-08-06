import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(file(relativePath), 'utf8');
const write = (relativePath, content) => {
  fs.mkdirSync(path.dirname(file(relativePath)), { recursive: true });
  fs.writeFileSync(file(relativePath), content);
};

function replaceExact(relativePath, before, after) {
  const source = read(relativePath);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${relativePath}: expected one exact match, found ${count}`);
  write(relativePath, source.replace(before, after));
}

write('src/hooks/useStableSelection.ts', `import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type StableSelectionContextKey = string | number | null;

export interface StableSelectionOptions<Id extends string> {
  availableIds: readonly Id[];
  fallbackId: Id | '';
  contextKey?: StableSelectionContextKey;
}

export function resolveStableSelection<Id extends string>(
  currentId: Id | '',
  availableIds: ReadonlySet<Id>,
  fallbackId: Id | '',
): Id | '' {
  if (currentId && availableIds.has(currentId)) return currentId;
  if (fallbackId && availableIds.has(fallbackId)) return fallbackId;
  return '';
}

export function useStableSelection<Id extends string>({
  availableIds,
  fallbackId,
  contextKey = null,
}: StableSelectionOptions<Id>): readonly [Id | '', Dispatch<SetStateAction<Id | ''>>] {
  const availableIdSet = useMemo(() => new Set<Id>(availableIds), [availableIds]);
  const [selectedId, setSelectedId] = useState<Id | ''>(() => (
    resolveStableSelection('', availableIdSet, fallbackId)
  ));
  const previousContextKeyRef = useRef<StableSelectionContextKey>(contextKey);

  useEffect(() => {
    const contextChanged = !Object.is(previousContextKeyRef.current, contextKey);
    previousContextKeyRef.current = contextKey;
    setSelectedId((currentId) => resolveStableSelection(
      contextChanged ? '' : currentId,
      availableIdSet,
      fallbackId,
    ));
  }, [availableIdSet, contextKey, fallbackId]);

  return [selectedId, setSelectedId] as const;
}
`);

write('src/hooks/useServerDraft.ts', `import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type ServerDraftRevision = string | number;
export type ServerDraftResetKey = string | number | null;

export interface ServerDraftSnapshot<Value> {
  draft: Value;
  baseValue: Value;
  baseRevision: ServerDraftRevision;
  resetKey: ServerDraftResetKey;
  dirty: boolean;
  conflicted: boolean;
}

export interface ServerDraftOptions<Value> {
  serverValue: Value;
  serverRevision: ServerDraftRevision;
  resetKey: ServerDraftResetKey;
  isEqual?: (left: Value, right: Value) => boolean;
}

const objectIs = <Value,>(left: Value, right: Value) => Object.is(left, right);

function cleanServerDraft<Value>(
  serverValue: Value,
  serverRevision: ServerDraftRevision,
  resetKey: ServerDraftResetKey,
): ServerDraftSnapshot<Value> {
  return {
    draft: serverValue,
    baseValue: serverValue,
    baseRevision: serverRevision,
    resetKey,
    dirty: false,
    conflicted: false,
  };
}

export function reconcileServerDraft<Value>(
  current: ServerDraftSnapshot<Value>,
  {
    serverValue,
    serverRevision,
    resetKey,
    isEqual = objectIs,
  }: ServerDraftOptions<Value>,
): ServerDraftSnapshot<Value> {
  if (!Object.is(current.resetKey, resetKey)) {
    return cleanServerDraft(serverValue, serverRevision, resetKey);
  }
  if (current.dirty && isEqual(current.draft, serverValue)) {
    return cleanServerDraft(serverValue, serverRevision, resetKey);
  }
  if (!current.dirty) {
    if (
      isEqual(current.draft, serverValue)
      && isEqual(current.baseValue, serverValue)
      && Object.is(current.baseRevision, serverRevision)
    ) return current;
    return cleanServerDraft(serverValue, serverRevision, resetKey);
  }
  if (!isEqual(current.baseValue, serverValue)) {
    return current.conflicted ? current : { ...current, conflicted: true };
  }
  return current;
}

export function useServerDraft<Value>({
  serverValue,
  serverRevision,
  resetKey,
  isEqual = objectIs,
}: ServerDraftOptions<Value>) {
  const [snapshot, setSnapshot] = useState<ServerDraftSnapshot<Value>>(() => (
    cleanServerDraft(serverValue, serverRevision, resetKey)
  ));

  useEffect(() => {
    setSnapshot((current) => reconcileServerDraft(current, {
      serverValue,
      serverRevision,
      resetKey,
      isEqual,
    }));
  }, [isEqual, resetKey, serverRevision, serverValue]);

  const setDraft = useCallback<Dispatch<SetStateAction<Value>>>((value) => {
    setSnapshot((current) => {
      const nextDraft = typeof value === 'function'
        ? (value as (currentValue: Value) => Value)(current.draft)
        : value;
      if (isEqual(nextDraft, serverValue)) {
        return cleanServerDraft(serverValue, serverRevision, resetKey);
      }
      const dirty = !isEqual(nextDraft, current.baseValue);
      if (isEqual(nextDraft, current.draft) && dirty === current.dirty) return current;
      return {
        ...current,
        draft: nextDraft,
        dirty,
        conflicted: dirty ? current.conflicted : false,
      };
    });
  }, [isEqual, resetKey, serverRevision, serverValue]);

  const discardDraft = useCallback(() => {
    setSnapshot(cleanServerDraft(serverValue, serverRevision, resetKey));
  }, [resetKey, serverRevision, serverValue]);

  const commitConfirmed = useCallback((
    confirmedValue: Value = serverValue,
    confirmedRevision: ServerDraftRevision = serverRevision,
  ) => {
    setSnapshot(cleanServerDraft(confirmedValue, confirmedRevision, resetKey));
  }, [resetKey, serverRevision, serverValue]);

  return {
    draft: snapshot.draft,
    setDraft,
    dirty: snapshot.dirty,
    conflicted: snapshot.conflicted,
    baseRevision: snapshot.baseRevision,
    discardDraft,
    commitConfirmed,
  };
}
`);

replaceExact(
  'src/pages/ResearchPage.tsx',
  `import {\n  useCallback,\n  useEffect,\n  useMemo,`,
  `import {\n  useCallback,\n  useMemo,`,
);
replaceExact(
  'src/pages/ResearchPage.tsx',
  `import { useNow } from '../hooks/useNow';`,
  `import { useNow } from '../hooks/useNow';\nimport { useStableSelection } from '../hooks/useStableSelection';`,
);
replaceExact(
  'src/pages/ResearchPage.tsx',
  `  const firstAvailable = technologies.find((technology) => (\n    !technology.initial\n    && !completed.has(technology.id)\n    && missingPrerequisites(technology, completed, technologiesById).length === 0\n  ));\n  const initialTechnologyId = activeTechnology?.id\n    ?? firstAvailable?.id\n    ?? technologies[technologies.length - 1]?.id\n    ?? '';\n  const [selectedTechnologyId, setSelectedTechnologyId] = useState(initialTechnologyId);`,
  `  const firstAvailable = technologies.find((technology) => (\n    !technology.initial\n    && !completed.has(technology.id)\n    && missingPrerequisites(technology, completed, technologiesById).length === 0\n  ));\n  const fallbackTechnologyId = activeTechnology?.id\n    ?? firstAvailable?.id\n    ?? technologies[0]?.id\n    ?? '';\n  const selectableTechnologyIds = useMemo(() => {\n    const technologyIds = technologies.map((technology) => technology.id);\n    if (activeTechnology && !technologyIds.includes(activeTechnology.id)) {\n      technologyIds.push(activeTechnology.id);\n    }\n    return technologyIds;\n  }, [activeTechnology, technologies]);\n  const [selectedTechnologyId, setSelectedTechnologyId] = useStableSelection<string>({\n    availableIds: selectableTechnologyIds,\n    fallbackId: fallbackTechnologyId,\n  });`,
);
replaceExact(
  'src/pages/ResearchPage.tsx',
  `  const selectedTechnology = technologiesById.get(selectedTechnologyId)\n    ?? (activeTechnology?.id === selectedTechnologyId ? activeTechnology : null)\n    ?? firstAvailable\n    ?? technologies[0];`,
  `  const selectedTechnology = technologiesById.get(selectedTechnologyId)\n    ?? (activeTechnology?.id === selectedTechnologyId ? activeTechnology : null)\n    ?? technologiesById.get(fallbackTechnologyId)\n    ?? (activeTechnology?.id === fallbackTechnologyId ? activeTechnology : null)\n    ?? technologies[0];`,
);
replaceExact(
  'src/pages/ResearchPage.tsx',
  `\n  useEffect(() => {\n    const defaultTechnologyId = activeTechnology?.id\n      ?? technologies.find((technology) => (\n        !technology.initial\n        && !completed.has(technology.id)\n        && missingPrerequisites(technology, completed, technologiesById).length === 0\n      ))?.id\n      ?? technologies[technologies.length - 1]?.id\n      ?? '';\n    setSelectedTechnologyId(defaultTechnologyId);\n  }, [activeTechnology?.id, completed, technologies, technologiesById]);\n`,
  `\n`,
);
replaceExact(
  'src/pages/ResearchPage.tsx',
  `  const startSelectedResearch = useCallback(() => {\n    if (!selectedTechnology || selectedTechnology.legacy) return;\n    const confirmed = window.confirm(\n      \`将支付 \${selectedTechnology.cost} 普通货币并开始研发「\${selectedTechnology.name}」，基础时间 \${formatDuration(selectedTechnology.durationMs)}。研发开始后不可取消，是否继续？\`,\n    );\n    if (confirmed) void model.showResult(model.startResearch(selectedTechnology.id));\n  }, [model, selectedTechnology]);`,
  `  const startSelectedResearch = useCallback(() => {\n    if (!selectedTechnology || selectedTechnology.legacy) return;\n    const technologyId = selectedTechnology.id;\n    const technologyName = selectedTechnology.name;\n    const technologyCost = selectedTechnology.cost;\n    const technologyDurationMs = selectedTechnology.durationMs;\n    const confirmed = window.confirm(\n      \`将支付 \${technologyCost} 普通货币并开始研发「\${technologyName}」，基础时间 \${formatDuration(technologyDurationMs)}。研发开始后不可取消，是否继续？\`,\n    );\n    if (confirmed) void model.showResult(model.startResearch(technologyId));\n  }, [model, selectedTechnology]);`,
);

replaceExact(
  'src/app/gameViewModel.ts',
  `import { defaultOrderPrice } from '../utils/defaultOrderPrice';`,
  `import { defaultOrderPrice } from '../utils/defaultOrderPrice';\nimport { useServerDraft } from '../hooks/useServerDraft';`,
);
replaceExact(
  'src/app/gameViewModel.ts',
  `  const [playerName, setPlayerName] = useState('');\n`,
  ``,
);
replaceExact(
  'src/app/gameViewModel.ts',
  `  const noticeTimerRef = useRef<number | null>(null);\n`,
  `  const noticeTimerRef = useRef<number | null>(null);\n  const playerNameDraft = useServerDraft({\n    serverValue: game?.playerName ?? '',\n    serverRevision: game?.lastProcessedAt ?? 0,\n    resetKey: user.id,\n  });\n`,
);
replaceExact(
  'src/app/gameViewModel.ts',
  `  useEffect(() => {\n    if (!game) return;\n    setPlayerName(game.playerName);\n    if (!game.facilityTypes.some((facility) => facility.id === selectedFacilityTypeId)) setSelectedFacilityTypeId(game.facilityTypes[0]?.id ?? 'farm');\n  }, [game, selectedFacilityTypeId]);`,
  `  const facilityTypes = game?.facilityTypes;\n  useEffect(() => {\n    if (!facilityTypes) return;\n    if (!facilityTypes.some((facility) => facility.id === selectedFacilityTypeId)) {\n      setSelectedFacilityTypeId(facilityTypes[0]?.id ?? 'farm');\n    }\n  }, [facilityTypes, selectedFacilityTypeId]);`,
);
replaceExact(
  'src/app/gameViewModel.ts',
  `    playerName, setPlayerName, compactNumbers, setCompactNumbers, refreshRate, setRefreshRate,`,
  `    playerName: playerNameDraft.draft, setPlayerName: playerNameDraft.setDraft,\n    compactNumbers, setCompactNumbers, refreshRate, setRefreshRate,`,
);

write('tests/browser/research-technology-tree.spec.ts', `import { expect, test } from '@playwright/test';

test.describe('research technology tree', () => {
  test('renders seven stages and split technology nodes', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });

    await page.goto('runtime-test.html?view=production&scenario=facility-order');
    const productionGeometry = await page.evaluate(() => {
      const build = document.querySelector<HTMLElement>('.production-build-card')?.getBoundingClientRect();
      const navigation = document.querySelector<HTMLElement>('.facility-cluster-navigation')?.getBoundingClientRect();
      const detail = document.querySelector<HTMLElement>('.facility-cluster-detail-card')?.getBoundingClientRect();
      return {
        actionWidth: build?.width ?? 0,
        contentLeft: navigation?.left ?? 0,
        contentRight: detail?.right ?? 0,
      };
    });

    await page.goto('runtime-test.html?view=research&scenario=research-active');
    await expect(page.locator('.research-stage-node')).toHaveCount(7);
    await expect(page.locator('.research-technology-node')).toHaveCount(24);
    const researchGeometry = await page.evaluate(() => {
      const action = document.querySelector<HTMLElement>('.research-action-panel')?.getBoundingClientRect();
      const tree = document.querySelector<HTMLElement>('.research-tree-panel')?.getBoundingClientRect();
      const stage = document.querySelector<HTMLElement>('.research-stage-node');
      const detailArtwork = document.querySelector<HTMLElement>(
        '.research-action-panel .research-detail-level-artwork',
      );
      const detailArtworkBox = detailArtwork?.getBoundingClientRect();
      const detailArtworkStyle = detailArtwork ? getComputedStyle(detailArtwork) : null;
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      return {
        actionWidth: action?.width ?? 0,
        contentLeft: tree?.left ?? 0,
        contentRight: tree?.right ?? 0,
        stageRadius: stage ? getComputedStyle(stage).borderRadius : '',
        detailArtworkWidth: detailArtworkBox?.width ?? 0,
        detailArtworkHeight: detailArtworkBox?.height ?? 0,
        detailArtworkAspectRatio: detailArtworkStyle?.aspectRatio ?? '',
        expectedDetailArtworkSize: rootFontSize * 4.5,
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });

    expect(Math.abs(researchGeometry.actionWidth - productionGeometry.actionWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentLeft - productionGeometry.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentRight - productionGeometry.contentRight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.stageRadius).toBe('50%');
    expect(researchGeometry.detailArtworkWidth).toBeCloseTo(researchGeometry.expectedDetailArtworkSize, 0);
    expect(Math.abs(researchGeometry.detailArtworkWidth - researchGeometry.detailArtworkHeight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.detailArtworkAspectRatio).toBe('1 / 1');
    expect(researchGeometry.fitsViewport).toBe(true);
  });

  test('preserves an explicit technology selection across refreshed snapshots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const applianceNode = page.getByRole('button', { name: /家电工程，尚未开放/ });
    await applianceNode.click();
    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');

    const assetsButton = page.locator('button').filter({ hasText: '净资产' }).first();
    await expect(assetsButton).toBeVisible();
    await assetsButton.click();

    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    await expect(page.getByRole('button', { name: /冶金技术，研发中/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('shows concrete prerequisite requirements and active acceleration', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    await page.getByRole('button', { name: /家电工程，尚未开放/ }).click();
    await expect(page.locator('.research-action-panel')).toContainText('还需完成');
    await expect(page.locator('.research-action-panel')).toContainText('电子工程');
    await expect(page.locator('.research-action-panel')).toContainText('研发费用');

    await page.getByRole('button', { name: /冶金技术，研发中/ }).click();
    await expect(page.locator('.research-action-panel')).toContainText('宝石加速');
    await expect(page.getByRole('button', { name: '1 宝石 · 加速 30m' })).toBeVisible();
  });

  test('uses the stored base duration for accelerated node research progress', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-accelerated');

    await expect(page.getByRole('progressbar', { name: '机械工程研发进度' })).toHaveAttribute('aria-valuenow', '67');
    const ringProgress = await page.getByRole('button', { name: /机械工程，研发中/ }).evaluate((element) => (
      getComputedStyle(element).getPropertyValue('--research-node-progress').trim()
    ));
    expect(ringProgress).toBe('240deg');
  });

  test('opens technology details in the shared mobile sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    await expect(page.locator('.research-action-panel')).toBeHidden();
    await expect(page.locator('.research-tree')).toBeVisible();
    const activeNode = page.getByRole('button', { name: /冶金技术，研发中/ });
    await activeNode.click();
    const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/mobile-detail-sheet/);
    await expect(dialog).toContainText('具体要求');
    await expect(dialog).toContainText('宝石加速');
    await expect(dialog.locator('.mobile-detail-summary')).toBeVisible();
    await expect(dialog.locator('.mobile-detail-sheet-footer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(activeNode).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
`);

write('scripts/verify-form-state-isolation.mjs', `import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const fail = (message) => {
  console.error(\`form state isolation verification failed: \${message}\`);
  process.exitCode = 1;
};
const requireText = (source, text, label) => {
  if (!source.includes(text)) fail(\`\${label} is missing\`);
};
const forbidText = (source, text, label) => {
  if (source.includes(text)) fail(\`\${label} must not exist\`);
};

const viewModel = read('src/app/gameViewModel.ts');
const productionPage = read('src/pages/ProductionPage.tsx');
const auctionPage = read('src/pages/AuctionPage.tsx');
const researchPage = read('src/pages/ResearchPage.tsx');
const stableSelection = read('src/hooks/useStableSelection.ts');
const serverDraft = read('src/hooks/useServerDraft.ts');
const researchBrowserTest = read('tests/browser/research-technology-tree.spec.ts');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');

requireText(
  viewModel,
  'buildFacility: (facilityTypeId: string) => Promise<ActionResult>;',
  'required buildFacility interface parameter',
);
requireText(
  viewModel,
  "buildFacility: (facilityTypeId) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId))",
  'explicit buildFacility implementation parameter',
);
forbidText(
  viewModel,
  "if (kind === 'facility') setSelectedFacilityTypeId(assetId);",
  'market-to-construction setter coupling',
);
forbidText(
  viewModel,
  'if (type.id !== selectedFacilityTypeId) setSelectedFacilityTypeId(type.id);',
  'market validation construction backfill',
);
forbidText(
  viewModel,
  '[game, marketAssetId, marketAssetKind, selectedFacilityTypeId]',
  'construction state in market validation dependencies',
);
forbidText(
  viewModel,
  'buildFacility: (facilityTypeId = selectedFacilityTypeId)',
  'implicit buildFacility state fallback',
);
requireText(
  viewModel,
  '}, [game, marketAssetId, marketAssetKind]);',
  'market-only validation dependencies',
);
requireText(
  productionPage,
  'buildFacility(selectedType.id)',
  'production page explicit facility submission',
);
requireText(
  auctionPage,
  "import { useEffect, useMemo, useState } from 'react';",
  'auction option legalization effect import',
);
requireText(
  auctionPage,
  'setSelectedAssetId((current) => (',
  'auction selected asset legalization',
);
requireText(
  auctionPage,
  'value={selectedAssetId}',
  'auction select single source of truth',
);

requireText(stableSelection, 'export function useStableSelection', 'shared stable selection hook');
requireText(
  stableSelection,
  'if (currentId && availableIds.has(currentId)) return currentId;',
  'valid explicit selection preservation',
);
requireText(serverDraft, 'export function useServerDraft', 'shared server draft hook');
requireText(
  serverDraft,
  'if (current.dirty && isEqual(current.draft, serverValue))',
  'server-confirmed draft cleanup',
);
requireText(
  viewModel,
  "import { useServerDraft } from '../hooks/useServerDraft';",
  'player name server draft adoption',
);
requireText(viewModel, 'playerName: playerNameDraft.draft', 'player name draft value');
requireText(viewModel, 'setPlayerName: playerNameDraft.setDraft', 'player name draft setter');
forbidText(viewModel, 'setPlayerName(game.playerName);', 'poll refresh player name overwrite');
requireText(
  researchPage,
  "import { useStableSelection } from '../hooks/useStableSelection';",
  'research stable selection adoption',
);
requireText(researchPage, 'fallbackId: fallbackTechnologyId', 'research explicit fallback');
forbidText(
  researchPage,
  'setSelectedTechnologyId(defaultTechnologyId);',
  'research refresh selection overwrite',
);
forbidText(
  researchPage,
  'technologies[technologies.length - 1]',
  'catalog tail fallback',
);
requireText(
  researchBrowserTest,
  'preserves an explicit technology selection across refreshed snapshots',
  'research refresh transparency browser regression',
);

requireText(pageDesign, '### 1.1 跨页面表单状态隔离', 'page design state isolation rule');
requireText(
  pageDesign,
  '建设动作必须显式提交表单当前选择的 \`facilityTypeId\`',
  'explicit construction submission design rule',
);
requireText(
  pageDesign,
  '周期轮询、动作后同步和权威倒计时确认对客户端交互状态必须透明',
  'page refresh transparency rule',
);
requireText(uiDesign, '\`useStableSelection\`', 'UI stable selection primitive rule');
requireText(uiDesign, '\`useServerDraft\`', 'UI server draft primitive rule');
requireText(
  serverDesign,
  '不承担客户端选择、表单草稿、弹层、焦点或滚动位置的初始化和重置职责',
  'server delivery interaction boundary',
);

const sourceRoot = path.join(root, 'src');
const sourceFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(target);
  }
};
walk(sourceRoot);
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(root, file);
  if (/\\bbuildFacility\\s*\\(\\s*\\)/.test(source)) {
    fail(\`\${relativePath} calls buildFacility without a facilityTypeId\`);
  }
  if (/key\\s*=\\s*\\{\\s*(?:model\\.)?game\\.(?:revision|lastProcessedAt)\\s*\\}/.test(source)) {
    fail(\`\${relativePath} remounts UI from a server revision or timestamp key\`);
  }
  if (/key\\s*=\\s*\\{\\s*JSON\\.stringify\\(\\s*(?:model\\.)?game\\s*\\)\\s*\\}/.test(source)) {
    fail(\`\${relativePath} remounts UI from the complete game snapshot\`);
  }
}

if (!process.exitCode) console.log('form state and polling refresh isolation verification passed');
`);

write('scripts/verify-research-page.mjs', `import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(\`missing file: \${path}\`);
}
function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(\`\${path} missing: \${text}\`);
}
function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(\`\${path} must not contain: \${text}\`);
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
  'complexity\` 继续负责',
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
  console.error(\`research page verification failed:\\n- \${failures.join('\\n- ')}\`);
  process.exit(1);
}

console.log('split technology tree, refresh-stable selection, detail requirements, mobile sheet, acceleration, server access and design verification passed');
`);

replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `- 市场当前选择的商品或工厂只属于市场交易上下文。市场切换资产、从工厂详情进入市场和市场目录合法化只能修改 \`marketAssetKind\`、\`marketAssetId\` 及对应订单草稿，不得改写生产页“建设新工厂”的类型选择。\n- 建设工厂类型只属于生产页建设表单；目录变化时只在自身候选目录内合法化。建设动作必须显式提交表单当前选择的 \`facilityTypeId\`，不得通过可选参数或其他页面状态隐式回退。\n- 拍卖、合同、设置和管理员等下拉框必须由所属页面或业务表单状态控制；候选项变化时应在本表单内同步合法化显示值与提交值，不得借用其他页面的选择状态。`,
  `- 市场当前选择的商品或工厂只属于市场交易上下文。市场切换资产、从工厂详情进入市场和市场目录合法化只能修改 \`marketAssetKind\`、\`marketAssetId\` 及对应订单草稿，不得改写生产页“建设新工厂”的类型选择。\n- 建设工厂类型只属于生产页建设表单；目录变化时只在自身候选目录内合法化。建设动作必须显式提交表单当前选择的 \`facilityTypeId\`，不得通过可选参数或其他页面状态隐式回退。\n- 拍卖、合同、设置和管理员等下拉框必须由所属页面或业务表单状态控制；候选项变化时应在本表单内同步合法化显示值与提交值，不得借用其他页面的选择状态。\n- 周期轮询、动作后同步和权威倒计时确认对客户端交互状态必须透明；只允许更新服务器权威数据，不得覆盖仍然有效的页面选择、未提交表单草稿、弹层、展开状态、焦点或滚动位置。\n- 页面实体选择统一使用 \`useStableSelection\`：首次进入、业务上下文明确切换或当前实体失效时才允许使用显式业务回退；普通快照对象替换、资金变化、进度变化和目录引用变化必须保留当前选择，不得默认选择目录最后一项。\n- 可编辑服务器字段统一使用 \`useServerDraft\`：未编辑时跟随服务器值；\`dirty\` 时保留草稿；编辑期间服务器值变化时标记 \`conflicted\`；服务器确认值与草稿一致时清除草稿状态。\n- 操作提交必须在点击时冻结实体 ID 和表单载荷，异步确认与后续刷新不得重新读取默认选项或推荐值。页面、表单和弹层不得以服务器修订号、\`lastProcessedAt\`、完整 \`game\` 快照或序列化快照作为 React \`key\`。`,
);

replaceExact(
  'docs/UI_DESIGN_SYSTEM.md',
  '> 更新时间：2026-08-05',
  '> 更新时间：2026-08-06',
);
replaceExact(
  'docs/UI_DESIGN_SYSTEM.md',
  `管理员入口、游戏入口和十个游戏页面必须使用 \`React.lazy\` 与动态 \`import()\` 按需加载；登录页不得静态拉入管理员和全部游戏页面。根游戏模型不得维护每秒变化的时间状态，倒计时只在概览、生产、拍卖、合同和银行等实际需要的局部页面通过共享 \`useNow\` 维护，市场订单簿、导航和银行资产总览等静态区域不得被全局秒级时钟重渲染。\n\n\`SwitchControl\` 是布尔开关的唯一 React 基础组件，`,
  `管理员入口、游戏入口和十个游戏页面必须使用 \`React.lazy\` 与动态 \`import()\` 按需加载；登录页不得静态拉入管理员和全部游戏页面。根游戏模型不得维护每秒变化的时间状态，倒计时只在概览、生产、拍卖、合同和银行等实际需要的局部页面通过共享 \`useNow\` 维护，市场订单簿、导航和银行资产总览等静态区域不得被全局秒级时钟重渲染。\n\n服务器快照与客户端交互状态必须使用不同原语。实体选择使用 \`src/hooks/useStableSelection.ts\` 的 \`useStableSelection\`，有效选择在任意轮询快照和无关分区变化中保持不变；服务器字段编辑使用 \`src/hooks/useServerDraft.ts\` 的 \`useServerDraft\`，以 \`dirty\`、\`baseRevision\` 和 \`conflicted\` 区分已确认值与未提交草稿。业务页面不得通过依赖完整 \`game\` 对象的 Effect 无条件重置本地 setter，也不得用服务器修订号、时间戳或完整状态作为 React \`key\` 触发重新挂载。\n\n\`SwitchControl\` 是布尔开关的唯一 React 基础组件，`,
);

replaceExact(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `浏览器只持有展示缓存、本地匿名成交记录、偏好和按教程版本／玩家 ID 隔离的客户端本轮教程状态。浏览器不得决定资产、存贷款、利息、抵押、违约处置、邀请奖励、封禁、拍卖、合同交付、成交、扩容、配方、生产结果或排行榜。\n\n## 2. 领域模块`,
  `浏览器只持有展示缓存、本地匿名成交记录、偏好和按教程版本／玩家 ID 隔离的客户端本轮教程状态。浏览器不得决定资产、存贷款、利息、抵押、违约处置、邀请奖励、封禁、拍卖、合同交付、成交、扩容、配方、生产结果或排行榜。\n\n周期轮询、动作后补拉、六分区补丁和权威截止时间确认只负责传输服务器权威状态，不承担客户端选择、表单草稿、弹层、焦点或滚动位置的初始化和重置职责。客户端可以基于稳定实体 ID 保留交互状态；服务器只在实体删除、权限变化或动作确认中返回足以判定失效与冲突的权威数据，不通过刷新频率隐式驱动界面默认值。\n\n## 2. 领域模块`,
);

console.log('client refresh isolation implementation applied');
