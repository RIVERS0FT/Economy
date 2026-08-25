import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const obsoleteBaseFailures = new Set([
  'src/pages/MarketPage.tsx 缺少: market-catalog-row',
  'src/pages/MarketPage.tsx 缺少: <ProductArtwork productId={entry.id} />',
  'src/pages/MarketPage.tsx 缺少: <small>卖单量</small>',
  'src/pages/MarketPage.tsx 缺少: <small>买单量</small>',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: | 建筑 | `buildings` | `BuildingsPage` |',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 页面主标题固定为“{州级地区全称}建筑”',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 市场目录固定提供“市场行情／自动交易”两个工作区',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 邀请卡唯一归属商店，只展示玩家自己的专属分享链接、永久邀请码',
]);

const baseResult = spawnSync(
  process.execPath,
  ['scripts/verify-page-content-base.mjs'],
  { cwd: root, encoding: 'utf8' },
);

if (baseResult.error) throw baseResult.error;

if (baseResult.status !== 0) {
  const failureLines = String(baseResult.stderr || '')
    .split(/\r?\n/)
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
  const remainingFailures = failureLines.filter((failure) => !obsoleteBaseFailures.has(failure));
  const recognizedOnly = failureLines.length > 0
    && remainingFailures.length === 0
    && failureLines.every((failure) => obsoleteBaseFailures.has(failure));

  if (!recognizedOnly) {
    if (baseResult.stdout) process.stdout.write(baseResult.stdout);
    if (baseResult.stderr) process.stderr.write(baseResult.stderr);
    process.exit(baseResult.status || 1);
  }
}

const failures = [];
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const forbidFile = (path) => {
  if (existsSync(resolve(root, path))) failures.push(`不应存在文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

for (const path of [
  'src/pages/GlobalMarketPage.tsx',
  'src/pages/GlobalBuildingsPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/components/market/MarketCommodityRow.tsx',
  'src/styles/market-commodity-row.css',
  'src/pages/BuildingsPage.tsx',
  'src/pages/ProvincePage.tsx',
  'src/pages/PageRouter.tsx',
  'src/components/shell/StrategicWorkspace.tsx',
  'src/styles/global-operation-pages.css',
  'src/styles/facility-artwork.css',
  'src/styles/design-system.css',
  'src/styles/regional-entity-page-title.css',
  'src/styles/production-surface.css',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  'docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md',
]) requireFile(path);
forbidFile('src/styles/map-zoom-controls.css');

for (const text of [
  '| 市场 | `market` | `GlobalMarketPage` |',
  '| 建筑 | `buildings` | `GlobalBuildingsPage` |',
  '一级导航中的“市场”和“建筑”固定进入全局视图',
  '`ProvincePage` 内的市场与建筑分区仍始终是地图所打开当前州的本地视图',
  '邀请卡与礼品码兑换唯一归属商店',
  '用户缩放范围固定为 `0.5～4`',
  '地图不得提供独立的放大、缩小或重置功能面板',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  '44px 放大／缩小／重置控制',
  '地图舞台右下角必须提供 44px 触控目标的放大、缩小和重置控制',
]) forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '一级“建筑”全局页的默认内容顺序固定为“全局工厂目录 → 地区建筑”',
  '全局工厂目录直接位于页面内容区，不使用 `PagePanel` 外层卡片',
  '页面内容区不得再显示“全局工厂目录”标题行或“类已拥有”状态',
  '统一表头固定为“工厂｜平均利润／分钟｜拥有”',
  '场景插画固定使用圆角正方形裁剪',
  '全局工厂行必须整行可点击，先进入该工厂类型的地区列表',
  '地区行再切换经营州并复用现有 `BuildingsPage` 工厂详情',
  '返回层级固定为“地区工厂详情 → 该工厂的地区列表 → 全局工厂列表”',
  '地区建筑入口同样固定使用纵向列表行',
  '跨州单厂平均利润必须逐州复用地区工厂现有利润口径',
  '再按 `scope.physicalCount` 对各州单厂利润加权',
  '任一参与州缺少当前配方所需商品的最近真实成交价时，全局值统一显示 `—`',
]) requireText('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md', text);

for (const text of [
  '所有玩家 `PageLayout` 标题统一使用 `design-system.css` 的 `--player-page-title-track-height: 40px`',
  '普通单行标题统一使用 `--font-size-player-page-title`',
  '建筑页不得再通过 `body:has(...)`',
]) requireText('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md', text);

for (const text of [
  '--font-size-player-page-title: 1.25rem;',
  '--player-page-title-track-height: 40px;',
  '.page-heading--player-navigation .page-heading-title {',
  'height: var(--player-page-title-track-height);',
  '.page-heading--player-navigation .page-heading-title > h1 {',
  'font-size: var(--font-size-player-page-title);',
  'text-overflow: ellipsis;',
  'white-space: nowrap;',
]) requireText('src/styles/design-system.css', text);
requireText(
  'src/styles/regional-entity-page-title.css',
  'height: var(--player-page-title-track-height);',
);
for (const text of [
  '--size-control-md',
  '--size-control-sm',
  'body:has(.regional-buildings-management) .page-heading--player-navigation .page-heading-title',
  'body:has(.facility-cluster-detail-page) .page-heading--player-navigation .page-heading-title',
]) forbidText('src/styles/production-surface.css', text);

for (const text of [
  "market: loadGlobalMarketPage",
  "buildings: loadGlobalBuildingsPage",
  "case 'market':",
  'renderPage = () => <GlobalMarketPage model={model} />;',
  "case 'buildings':",
  '<GlobalBuildingsPage model={model} />',
]) requireText('src/pages/PageRouter.tsx', text);
for (const text of [
  "renderPage = () => <MarketPage model={model} />;",
  '<BuildingsPage model={model} />',
]) forbidText('src/pages/PageRouter.tsx', text);

for (const text of [
  '<EmbeddedMarketPage model={model} embedded />',
  '<EmbeddedBuildingsPage',
  'onDetailFacilityChange={setFacilityDetailTypeId}',
]) requireText('src/pages/ProvincePage.tsx', text);

for (const [path, expected] of [
  ['src/pages/GlobalMarketPage.tsx', [
    'export function GlobalMarketPage',
    '<PageLayout title="市场">',
    'data-global-scope="market"',
    '<WidgetHeading title="商品"',
    'global-market-filter-disclosure',
    'selectedGlobalProductId',
    'global-market-product-detail-panel',
    '<MarketCommodityRow',
    'model.setSelectedProvinceId(provinceId);',
    '<EmbeddedMarketPage model={model} embedded />',
  ]],
  ['src/pages/GlobalBuildingsPage.tsx', [
    'export function GlobalBuildingsPage',
    '<PageLayout title="建筑">',
    'data-global-scope="buildings"',
    'selectedGlobalFacilityTypeId',
    'openGlobalFacility',
    'openRegionalFacility',
    'model.setSelectedProvinceId(provinceId);',
    'setFacilityDetailTypeId(selectedGlobalFacilityTypeId);',
    '<EmbeddedBuildingsPage',
    'onDetailFacilityChange={setFacilityDetailTypeId}',
    'className="global-facility-catalog"',
    'className="global-facility-catalog-header"',
    'className="global-facility-catalog-list"',
    'className="global-facility-catalog-row"',
    'onClick={() => openGlobalFacility(row.facilityTypeId)}',
    '<FacilityIcon facilityTypeId={row.facilityTypeId} className="global-facility-catalog-row__artwork" />',
    'data-global-facility-type-id={selectedGlobalFacilityTypeId}',
    'className="global-facility-region-header"',
    'className="global-facility-region-list"',
    'className="global-facility-region-row"',
    "label: '返回地区工厂'",
    'className="global-province-list"',
    'className="global-province-row"',
    'resolveFacilityProfitPresentation({',
    'resolveFacilityDetailRecipeState({ group, type })',
    'currentFormulaScope(group, game.lastProcessedAt)',
    'markets: game.provinceMarkets?.[province.id] ?? {},',
    'presentation.profitPerMinute * scope.physicalCount',
    'incompleteProfitProvinces.length === 0 && weightedProfitCount > 0',
  ]],
]) {
  for (const text of expected) requireText(path, text);
}

for (const text of [
  'global-market-provinces-panel',
  'global-market-province-row',
  'MarketCoverageBar',
]) forbidText('src/pages/GlobalMarketPage.tsx', text);
for (const text of [
  '卖单量',
  '买单量',
  '市场价',
  '24h',
]) requireText('src/components/market/MarketCommodityRow.tsx', text);
for (const text of ['挂单差额', '基准偏离', '挂单状态']) forbidText('src/components/market/MarketCommodityRow.tsx', text);
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '商品目录 → 商品全局详情 → 地区商品详情');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '筛选默认折叠且不提供商品名称搜索框');

for (const text of [
  '<MetricCard',
  'global-operation-metrics',
  'global-current-scope-summary',
  '<WidgetHeading title="当前经营州"',
  '<WidgetHeading title="全局工厂目录"',
  '类已拥有',
  '<PagePanel>\n          <WidgetHeading title="全局工厂目录"',
  'global-operation-summary-row',
  'global-facility-catalog-grid',
  'global-facility-catalog-card',
  'global-province-grid',
  'global-province-card',
  '<small>运行中</small><strong>{formatNumber(row.runningCount)}</strong>',
  '分布州数',
  'provinceIds',
]) forbidText('src/pages/GlobalBuildingsPage.tsx', text);

for (const text of [
  '.global-facility-catalog-header,',
  '.global-facility-region-header {',
  '.global-facility-catalog-list,',
  '.global-facility-catalog-row,',
  '.global-facility-region-row {',
  '.global-facility-catalog-row__artwork {',
  'grid-template-columns: minmax(0, 1.6fr) minmax(7rem, .8fr) minmax(4rem, .45fr) 1rem;',
  'height: 44px;',
  'aspect-ratio: 1;',
  '.global-facility-catalog-row__profit.is-positive',
  '.global-facility-catalog-row__profit.is-negative',
  '.global-province-list > li {',
  '.global-province-row {',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  'border-bottom: 1px solid var(--color-divider);',
]) requireText('src/styles/global-operation-pages.css', text);
for (const text of [
  'height: 55px;',
  'height: 50px;',
  'global-operation-metrics',
  'global-current-scope-summary',
  'global-operation-summary-row',
  'global-operation-summary-artwork',
  '.global-facility-catalog-grid',
  '.global-facility-catalog-card {',
  '.global-province-grid',
  '.global-province-card {',
]) forbidText('src/styles/global-operation-pages.css', text);

requireText('src/styles/facility-artwork.css', '.global-facility-catalog-row,');
forbidText('src/styles/facility-artwork.css', '.global-facility-catalog-card,');

for (const text of [
  'StrategicMapZoomControls',
  'map-zoom-controls.css',
  'aria-label="地图缩放"',
  'aria-label="放大地图"',
  'aria-label="缩小地图"',
  'aria-label="重置地图缩放和平移"',
]) forbidText('src/components/shell/StrategicWorkspace.tsx', text);

if (failures.length) {
  console.error(`页面内容与职责验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('页面内容与职责验证通过：一级市场/建筑锁定全局视图；全局建筑保留正式标题，工厂列表使用统一表头、单行可点击条目和正方形插画，并按工厂类型 → 地区 → 现有地区工厂详情下钻；地区建筑仍使用纵向列表并保留跨州平均利润；所有玩家 PageLayout 共用 40px 标题轨道与紧凑单行标题；州级上下文继续复用本地市场/建筑，邀请卡与礼品码兑换唯一归属商店，地图保留 0.5–4 手势缩放并禁止恢复独立缩放功能面板。');
