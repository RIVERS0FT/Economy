import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

test('province page keeps market-commerce-industry order and commercial detail navigation', () => {
  const province = read('src/pages/ProvincePage.tsx');
  const stack = read('src/navigation/playerPageStack.ts');
  const commerce = read('src/pages/CommercePage.tsx');

  const marketIndex = province.indexOf("{ id: 'market', label: '市场' }");
  const commerceIndex = province.indexOf("{ id: 'commerce', label: '商业' }");
  const industryIndex = province.indexOf("{ id: 'buildings', label: '工业' }");
  assert.ok(marketIndex >= 0 && commerceIndex > marketIndex && industryIndex > commerceIndex);
  assert.match(stack, /ProvinceSection = 'overview' \| 'market' \| 'commerce' \| 'buildings' \| 'warehouse'/);
  assert.match(stack, /type: 'regional-commercial'/);
  assert.match(province, /EmbeddedCommercePage/);
  assert.match(province, /section: 'commerce'/);

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
  assert.match(index, /`COMMERCIAL_BUILDINGS_DESIGN\.md` \| 商业建筑资产、地区商品消费、营业周期与固定商业利润/);
  assert.match(design, /商业建筑不是工厂的另一种配方/);
  assert.match(design, /固定商业利润是服务器目录声明的\*\*绝对金额\*\*/);
  assert.match(design, /不得跨州寻找库存/);
  assert.match(design, /不是市场成交/);
});
