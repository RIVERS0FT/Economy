import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('global filtering and separate province building tabs and use the same detail page without commercial asset conversion', () => {
  const province = read('src/pages/ProvincePage.tsx');
  const regional = read('src/pages/RegionalBuildingsPage.tsx');
  const global = read('src/pages/GlobalBuildingsPage.tsx');
  const commerce = read('src/pages/CommercePage.tsx');
  const industrial = read('src/pages/BuildingsPage.tsx');
  const stack = read('src/navigation/playerPageStack.ts');
  assert.ok(province.indexOf("{ id: 'buildings', label: '工业' }") > province.indexOf("{ id: 'market', label: '市场' }"));
  assert.ok(province.includes("{ id: 'commerce', label: '商业' }"));
  assert.match(read('src/styles/province-page.css'), /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(province, /RegionalBuildingsPage/);
  assert.equal(regional.includes('<BuildingTypeFilter'), false);
  assert.equal(regional.includes('useBuildingTypeFilter'), false);
  assert.match(regional, /data-building-kind=\{kind\}/);
  assert.match(regional, /useBuildingConstructionDraft/);
  assert.match(global, /<BuildingTypeFilter/);
  assert.match(regional, /unified-building-list/);
  assert.match(global, /commercialBuildingGroups/);
  assert.match(stack, /type: 'global-commercial'/);
  assert.match(stack, /type: 'regional-commercial'/);
  assert.match(commerce, /<BuildingDetailPage kind="commercial"/);
  assert.match(industrial, /<BuildingDetailPage kind="industrial"/);
  assert.equal(commerce.includes('as FacilityGroup'), false);
  assert.match(read('src/components/commercial/CommercialBuildingDetail.tsx'), /<BuildingSettlementPanel/);
  assert.match(read('src/components/facilities/FacilityProductionFormula.tsx'), /<BuildingSettlementPanel/);
});

test('commercial economics, inventory intent and page owners remain documented independently', () => {
  const design = read('docs/COMMERCIAL_BUILDINGS_DESIGN.md');
  const page = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  const ui = read('docs/UI_DESIGN_SYSTEM.md');
  assert.match(design, /商业建筑不是工厂的另一种配方/);
  assert.match(design, /固定商业利润是服务器目录声明的\*\*绝对金额\*\*/);
  assert.match(design, /不得跨州寻找库存/);
  assert.match(design, /不是市场成交/);
  assert.match(design, /旧存档/);
  assert.match(page, /概览｜市场｜商业｜工业｜仓库/);
  assert.match(page, /商业建筑卡片与详情/);
  assert.match(page, /全部.*商业建筑.*工业建筑/);
  assert.match(ui, /BuildingDetailPage/);
  assert.match(ui, /BuildingSettlementPanel/);
  assert.match(ui, /BuildingTypeFilter/);
});
