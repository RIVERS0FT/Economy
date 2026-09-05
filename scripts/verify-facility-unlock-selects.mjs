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

const productionPage = read('src/pages/BuildingsPage.tsx');
const richSelect = read('src/components/ui/RichSelectInput.tsx');
const formControlStyles = read('src/styles/form-controls.css');
const buildSelectStyles = read('src/styles/facility-build-select.css');
const pageRouter = read('src/pages/PageRouter.tsx');
const formControls = read('src/components/ui/FormControls.tsx');
const availabilityScope = read('src/components/facilities/FacilitySelectAvailabilityScope.tsx');
const contractRoute = read('src/pages/ContractPage.tsx');
const contractWorkspace = read('src/pages/ContractWorkspacePage.tsx');
const browserTest = read('tests/browser/production-facility-cards.spec.ts');
const design = read('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md');

requireText(
  productionPage,
  "import { getUnlockedFacilityTypes } from '../utils/facilityResearchAccess';",
  'production shared unlock helper import',
);
requireText(
  productionPage,
  'const buildFacilityOptions = useMemo(() => unlockedFacilityTypes.map((type) => {',
  'production unlocked construction rich options',
);
requireText(
  productionPage,
  'const outputProductIds = recipesForType(type).flatMap((recipe) => {',
  'production recipe-derived output products',
);
requireText(
  productionPage,
  '<ProductArtwork productId={productId} />',
  'production output product artwork',
);
requireText(
  productionPage,
  'detail: (',
  'production rich option secondary output detail',
);
requireText(
  productionPage,
  '<RichSelectInput\n        label="工厂类型"',
  'production rich construction selector',
);
forbidText(
  productionPage,
  '{game.facilityTypes.map((type) => (',
  'production full-catalog construction options',
);
forbidText(
  productionPage,
  'facility-type-summary',
  'duplicate construction output summary',
);
requireText(
  productionPage,
  'setSelectedFacilityTypeId(selectedType.id);',
  'production invalid selection legalization',
);
requireText(
  richSelect,
  'detail?: ReactNode;',
  'rich select secondary detail slot',
);
requireText(
  richSelect,
  'const DETAIL_OPTION_HEIGHT = 64;',
  'rich select detailed option positioning height',
);
requireText(
  richSelect,
  'const selectedTriggerDetail = selectedOption?.triggerDetail ?? selectedOption?.detail;',
  'rich select detailed trigger compatibility',
);
requireText(
  richSelect,
  "data-has-detail={selectedTriggerDetail ? 'true' : undefined}",
  'rich select detailed trigger marker',
);
requireText(
  formControlStyles,
  ".ui-rich-select__trigger[data-has-detail='true']",
  'shared detailed trigger height style',
);
forbidText(
  buildSelectStyles,
  ".ui-rich-select__trigger[data-has-detail='true']",
  'construction page-owned shared trigger style',
);
requireText(
  buildSelectStyles,
  '.facility-build-output-item .product-artwork',
  'construction output artwork sizing',
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
  contractRoute,
  "import { ContractWorkspacePage } from './ContractWorkspacePage';",
  'contract route delegates to current workspace',
);
requireText(
  contractWorkspace,
  'label="冻结工厂"',
  'contract collateral facility selector',
);
requireText(
  contractWorkspace,
  'label="租赁工厂"',
  'contract lease facility selector',
);
requireText(
  browserTest,
  'preserves the full catalog for legacy snapshots without research state',
  'legacy production snapshot browser regression',
);
requireText(
  browserTest,
  'facility build selector shows production outputs in trigger and options',
  'construction output-rich selector browser regression',
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
  '建设新工厂的“工厂类型”选择器必须在收起按钮和展开选项中直接展示该工厂可生产的商品',
  'construction output presentation design rule',
);
requireText(
  design,
  '完全缺少 `research`',
  'pre-research snapshot compatibility design rule',
);

if (!process.exitCode) console.log('facility unlock select verification passed');
