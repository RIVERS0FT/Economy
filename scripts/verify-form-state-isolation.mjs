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
const productionPage = read('src/pages/ProductionPage.tsx');
const auctionPage = read('src/pages/AuctionPage.tsx');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');

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
requireText(
  pageDesign,
  '### 1.1 跨页面表单状态隔离',
  'page design state isolation rule',
);
requireText(
  pageDesign,
  '建设动作必须显式提交表单当前选择的 `facilityTypeId`',
  'explicit construction submission design rule',
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
  if (/\bbuildFacility\s*\(\s*\)/.test(source)) {
    fail(`${path.relative(root, file)} calls buildFacility without a facilityTypeId`);
  }
}

if (!process.exitCode) console.log('form state isolation verification passed');
