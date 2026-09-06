import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const fail = (message) => {
  console.error(`form state isolation verification failed: ${message}`);
  process.exitCode = 1;
};
const requireText = (source, text, label) => {
  if (!source.includes(text)) fail(`${label} is missing`);
};
const forbidText = (source, text, label) => {
  if (source.includes(text)) fail(`${label} must not exist`);
};

const viewModel = read('src/app/gameViewModel.ts');
const gameApp = read('src/app/GameApp.tsx');
const productionPage = read('src/pages/BuildingsPage.tsx');
const auctionPage = read('src/pages/AuctionPage.tsx');
const researchPage = read('src/pages/ResearchPage.tsx');
const richSelect = read('src/components/ui/RichSelectInput.tsx');
const stableSelection = read('src/hooks/useStableSelection.ts');
const serverDraft = read('src/hooks/useServerDraft.ts');
const researchBrowserTest = read('tests/browser/research-technology-tree.spec.ts');
const unifiedSelectBrowserTest = read('tests/browser/unified-selects.spec.ts');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');

requireText(
  viewModel,
  'buildFacility: (facilityTypeId: string, quantity?: number, procurement?: FacilityBuildProcurementOptions) => Promise<ActionResult>;',
  'required buildFacility interface parameter',
);
requireText(
  viewModel,
  "buildFacility: (facilityTypeId, quantity = 1, procurement) => runAction('buildFacility', () => gameActions.buildFacility(selectedProvinceId, facilityTypeId, quantity, procurement))",
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
  gameApp,
  'buildFacility: async (facilityTypeId = model.selectedFacilityTypeId, quantity = 1, procurement) => {',
  'tutorial wrapper quantity parameter',
);
requireText(
  gameApp,
  'const result = await model.buildFacility(facilityTypeId, quantity, procurement);',
  'tutorial wrapper quantity forwarding',
);
requireText(
  gameApp,
  'if (result.ok) tutorial.recordBuildSubmit(facilityTypeId, provinceId, baseline);',
  'tutorial wrapper success-gated advancement',
);
forbidText(
  gameApp,
  'return model.buildFacility(facilityTypeId);',
  'quantity-dropping tutorial wrapper',
);
requireText(
  productionPage,
  'buildFacility(selectedType.id, buildQuantity)',
  'production page explicit facility submission',
);
requireText(
  productionPage,
  '<DataRow label="建造材料" value="无需材料" />',
  'cash-only facility material presentation',
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
requireText(
  richSelect,
  'const [activeValue, setActiveValue] = useState<string | null>(null);',
  'rich select stable active option identity',
);
requireText(
  richSelect,
  'const activeOption = activeValue === null',
  'rich select active option legalization',
);
requireText(
  richSelect,
  'if (activeOption && !activeOption.disabled) return;',
  'rich select valid active option preservation',
);
forbidText(
  richSelect,
  'if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) setActiveIndex(selectedIndex);',
  'poll-rerender active index reset',
);
requireText(
  unifiedSelectBrowserTest,
  'open select preserves active option, focus, and scroll across periodic production rerenders',
  'select refresh transparency browser regression',
);

requireText(pageDesign, '### 1.1 跨页面表单状态隔离', 'page design state isolation rule');
requireText(
  pageDesign,
  '建设动作必须显式提交表单当前选择的 `facilityTypeId` 与 `quantity`',
  'explicit construction submission design rule',
);
requireText(
  pageDesign,
  '周期轮询、动作后同步和权威倒计时确认对客户端交互状态必须透明',
  'page refresh transparency rule',
);
requireText(
  pageDesign,
  '不得覆盖仍然有效的页面选择、未提交表单草稿、弹层、展开状态、焦点或滚动位置',
  'page refresh interaction preservation rule',
);
requireText(uiDesign, '`useStableSelection`', 'UI stable selection primitive rule');
requireText(uiDesign, '`useServerDraft`', 'UI server draft primitive rule');
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
    else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(target);
  }
};
walk(sourceRoot);
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(root, file);
  if (/\bbuildFacility\s*\(\s*\)/.test(source)) {
    fail(`${relativePath} calls buildFacility without a facilityTypeId`);
  }
  if (/key\s*=\s*\{\s*(?:model\.)?game\.(?:revision|lastProcessedAt)\s*\}/.test(source)) {
    fail(`${relativePath} remounts UI from a server revision or timestamp key`);
  }
  if (/key\s*=\s*\{\s*JSON\.stringify\(\s*(?:model\.)?game\s*\)\s*\}/.test(source)) {
    fail(`${relativePath} remounts UI from the complete game snapshot`);
  }
}

if (!process.exitCode) console.log('form state and polling refresh isolation verification passed');
