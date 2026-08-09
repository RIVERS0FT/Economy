import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { getUnlockedFacilityTypeIds, getUnlockedFacilityTypes } from '../src/utils/facilityResearchAccess.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const fail = (message) => {
  console.error(`facility unlock select verification failed: ${message}`);
  process.exitCode = 1;
};
const requireText = (source, text, label) => {
  if (!source.includes(text)) fail(`${label} is missing`);
};
const forbidText = (source, text, label) => {
  if (source.includes(text)) fail(`${label} must not exist`);
};

const facilityTypes = [
  { id: 'farm', name: '农场', complexity: 'C1' },
  { id: 'mine', name: '矿场', complexity: 'C2' },
  { id: 'logging-camp', name: '伐木场', complexity: 'C2' },
  { id: 'steelworks', name: '冶炼厂', complexity: 'C3' },
];
const researchTechnologies = [
  { id: 'basic-crops', unlockFacilityTypeIds: ['farm'] },
  { id: 'mineral-exploration', unlockFacilityTypeIds: ['mine'] },
  { id: 'forestry-development', unlockFacilityTypeIds: ['logging-camp'] },
  { id: 'metallurgy', unlockFacilityTypeIds: ['steelworks'] },
];
const nodeResearchGame = {
  facilityTypes,
  researchTechnologies,
  research: {
    unlockedComplexity: 'C1',
    completedTechnologyIds: ['basic-crops', 'mineral-exploration'],
  },
};
assert.deepEqual(
  getUnlockedFacilityTypes(nodeResearchGame).map((facility) => facility.id),
  ['farm', 'mine'],
  'node research must unlock only facilities owned by completed technology nodes while preserving catalog order',
);
assert.deepEqual(
  [...getUnlockedFacilityTypeIds(nodeResearchGame)],
  ['farm', 'mine'],
  'completed technology nodes must be the modern unlock source instead of whole-stage complexity',
);

const legacyResearchGame = {
  facilityTypes,
  researchTechnologies: undefined,
  research: {
    unlockedComplexity: 'C2',
    completedTechnologyIds: undefined,
  },
};
assert.deepEqual(
  getUnlockedFacilityTypes(legacyResearchGame).map((facility) => facility.id),
  ['farm', 'mine', 'logging-camp'],
  'legacy states without node data must retain complexity-based compatibility access',
);

assert.deepEqual(
  getUnlockedFacilityTypes({ facilityTypes }).map((facility) => facility.id),
  facilityTypes.map((facility) => facility.id),
  'pre-research snapshots must keep the complete catalog instead of crashing or guessing a lock state',
);

const productionPage = read('src/pages/ProductionPage.tsx');
const pageRouter = read('src/pages/PageRouter.tsx');
const formControls = read('src/components/ui/FormControls.tsx');
const availabilityScope = read('src/components/facilities/FacilitySelectAvailabilityScope.tsx');
const contractPage = read('src/pages/ContractPage.tsx');
const browserTest = read('tests/browser/production-facility-cards.spec.ts');
const design = read('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md');

requireText(
  productionPage,
  "import { getUnlockedFacilityTypes } from '../utils/facilityResearchAccess';",
  'production shared unlock helper import',
);
requireText(
  productionPage,
  '{unlockedFacilityTypes.map((type) => (',
  'production unlocked construction options',
);
forbidText(
  productionPage,
  '{game.facilityTypes.map((type) => (',
  'production full-catalog construction options',
);
requireText(
  productionPage,
  'setSelectedFacilityTypeId(selectedType.id);',
  'production invalid selection legalization',
);
requireText(
  formControls,
  'export function SelectOptionAvailabilityProvider',
  'generic select option availability provider',
);
requireText(
  formControls,
  "optionValues.every((value) => value === '' || restrictedOptionValues.has(value))",
  'pure restricted-catalog detection',
);
requireText(
  formControls,
  "select.dispatchEvent(new Event('change', { bubbles: true }));",
  'filtered controlled select legalization',
);
requireText(
  formControls,
  "if (currentValue === '' || optionAvailability.allowedRestrictedOptionValues.has(currentValue)) return;",
  'valid filtered selection preservation',
);
requireText(
  availabilityScope,
  'getUnlockedFacilityTypeIds(game)',
  'facility availability scope unlock source',
);
requireText(
  pageRouter,
  '<FacilitySelectAvailabilityScope game={model.game}>',
  'page-wide facility select availability scope',
);
requireText(
  contractPage,
  'label="抵押工厂"',
  'contract collateral facility selector',
);
requireText(
  contractPage,
  'label="租赁工厂"',
  'contract lease facility selector',
);
requireText(
  browserTest,
  'preserves the full catalog for legacy snapshots without research state',
  'legacy production snapshot browser regression',
);
requireText(
  design,
  '未解锁工厂不得进入新业务操作型工厂下拉框',
  'facility unlock select design rule',
);
requireText(
  design,
  '只过滤、不二次排序',
  'facility unlock ordering design rule',
);
requireText(
  design,
  '完全缺少 `research`',
  'pre-research snapshot compatibility design rule',
);

if (!process.exitCode) console.log('facility unlock select verification passed');
