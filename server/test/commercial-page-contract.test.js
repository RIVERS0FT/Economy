import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

test('province page keeps market-commerce-industry order and commercial detail navigation', () => {
  const province = read('src/pages/ProvincePage.tsx');
  const provinceStyles = read('src/styles/province-page.css');
  const stack = read('src/navigation/playerPageStack.ts');
  const commerce = read('src/pages/CommercePage.tsx');
  const regionalTitle = read('src/components/ui/RegionalEntityPageTitle.tsx');

  const marketIndex = province.indexOf("{ id: 'market', label: '市场' }");
  const commerceIndex = province.indexOf("{ id: 'commerce', label: '商业' }");
  const industryIndex = province.indexOf("{ id: 'buildings', label: '工业' }");
  assert.ok(marketIndex >= 0 && commerceIndex > marketIndex && industryIndex > commerceIndex);
  assert.match(provinceStyles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(stack, /ProvinceSection = 'overview' \| 'market' \| 'commerce' \| 'buildings' \| 'warehouse'/);
  assert.match(stack, /type: 'regional-commercial'/);
  assert.match(province, /EmbeddedCommercePage/);
  assert.match(province, /section: 'commerce'/);
  assert.match(regionalTitle, /currentLocation\?\.type === 'regional-commercial'/);

  for (const token of [
    'regional-buildings-management',
    'production-build-card',
    'facility-cluster-selector-region',
    'facility-cluster-selector-list',
    'facility-cluster-detail-shell',
    'facility-cluster-detail-card',
    '建设新商业建筑',
    '稳定利润',
    '只消耗当前州本地仓库商品',
  ]) assert.ok(commerce.includes(token), `商业页面缺少工业布局复用或业务契约: ${token}`);
});

test('commercial rules remain independently documented from industrial production', () => {
  const index = read('docs/README.md');
  const design = read('docs/COMMERCIAL_BUILDINGS_DESIGN.md');
  const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
  assert.match(index, /`COMMERCIAL_BUILDINGS_DESIGN\.md` \| 商业建筑资产、地区商品消费、营业周期与固定商业利润/);
  assert.match(design, /商业建筑不是工厂的另一种配方/);
  assert.match(design, /固定商业利润是服务器目录声明的\*\*绝对金额\*\*/);
  assert.match(design, /不得跨州寻找库存/);
  assert.match(design, /不是市场成交/);
  assert.match(pageDesign, /概览｜市场｜商业｜工业｜仓库/);
  assert.match(pageDesign, /技术 section ID 不迁移/);
  assert.match(pageDesign, /`ProvincePage` 内的市场、商业与工业分区仍始终是地图所打开当前州的本地视图/);
  assert.match(pageDesign, /商业、工业与仓库直接显示本地经营内容/);
  assert.match(pageDesign, /概览始终显示官方常住人口以及该玩家在该州的只读经营摘要/);
  assert.match(pageDesign, /地区商品／商业建筑／工厂详情标题第二行的州级地区名是直接地区导航入口/);
  assert.match(pageDesign, /返回时必须恢复原商品／商业建筑／工厂详情/);
  assert.match(uiDesign, /`RegionalEntityPageTitle` 固定负责地区商品／商业建筑／工厂详情共享两行标题/);
  assert.match(uiDesign, /`regional-product`、`regional-commercial` 或 `regional-facility`/);
});
