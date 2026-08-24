import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
function replace(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`${path}: missing replacement anchor: ${before.slice(0, 180)}`);
  write(path, source.replace(before, after));
}

// UI architecture: catalog artwork now lives in shared MarketCommodityRow.
replace(
  'scripts/verify-ui-architecture.mjs',
  "const marketPagePath = 'src/pages/MarketPage.tsx';\nconst productionDetailPath",
  "const marketPagePath = 'src/pages/MarketPage.tsx';\nconst marketCommodityRowPath = 'src/components/market/MarketCommodityRow.tsx';\nconst productionDetailPath",
);
replace(
  'scripts/verify-ui-architecture.mjs',
  "  marketPagePath,\n  'src/styles/design-system.css',",
  "  marketPagePath,\n  marketCommodityRowPath,\n  'src/styles/design-system.css',",
);
replace(
  'scripts/verify-ui-architecture.mjs',
  "const marketPage = read(marketPagePath);",
  "const marketPage = read(marketPagePath);\nconst marketCommodityRow = read(marketCommodityRowPath);",
);
replace(
  'scripts/verify-ui-architecture.mjs',
  "  'FactoryIcon',\n  '<ProductArtwork productId={entry.id} />',\n  '<FacilityIcon facilityTypeId={selectedFacility.id} />',\n]) requireText(marketPagePath, text);",
  "  'FactoryIcon',\n  '<MarketCommodityRow',\n  '<FacilityIcon facilityTypeId={selectedFacility.id} />',\n]) requireText(marketPagePath, text);\nfor (const text of [\n  \"from '../products/ProductArtwork'\",\n  '<ProductArtwork productId={productId} />',\n]) {\n  if (!marketCommodityRow.includes(text)) failures.push(`${marketCommodityRowPath} 缺少: ${text}`);\n}",
);

// Product artwork: the shared row owns catalog artwork; MarketPage owns detail artwork.
replace(
  'scripts/verify-product-artwork.mjs',
  "const formulaPath = 'src/components/facilities/FacilityProductionFormula.tsx';\nconst denseProductPages = [",
  "const formulaPath = 'src/components/facilities/FacilityProductionFormula.tsx';\nconst marketCommodityRowPath = 'src/components/market/MarketCommodityRow.tsx';\nconst denseProductPages = [",
);
replace(
  'scripts/verify-product-artwork.mjs',
  "  'src/pages/MarketPage.tsx',\n  formulaPath,",
  "  'src/pages/MarketPage.tsx',\n  marketCommodityRowPath,\n  formulaPath,",
);
replace(
  'scripts/verify-product-artwork.mjs',
  "  richSelectPath,\n  formulaPath,\n]) {",
  "  richSelectPath,\n  formulaPath,\n  marketCommodityRowPath,\n]) {",
);
replace(
  'scripts/verify-product-artwork.mjs',
  "  const marketPage = read('src/pages/MarketPage.tsx');\n  for (const required of [\n    '<ProductArtwork productId={entry.id} />',\n    '<ProductArtwork productId={selectedProduct.id} />',\n    'className=\"market-catalog-row__artwork\"',\n    'className=\"market-detail-hero__artwork\"',\n  ]) {\n    if (!marketPage.includes(required)) failures.push(`src/pages/MarketPage.tsx 缺少商品市场主视觉: ${required}`);\n  }",
  "  const marketPage = read('src/pages/MarketPage.tsx');\n  const marketCommodityRow = read(marketCommodityRowPath);\n  for (const required of [\n    '<ProductArtwork productId={selectedProduct.id} />',\n    'className=\"market-detail-hero__artwork\"',\n  ]) {\n    if (!marketPage.includes(required)) failures.push(`src/pages/MarketPage.tsx 缺少商品详情主视觉: ${required}`);\n  }\n  for (const required of [\n    \"from '../products/ProductArtwork'\",\n    '<ProductArtwork productId={productId} />',\n    'className=\"market-commodity-row__artwork\"',\n  ]) {\n    if (!marketCommodityRow.includes(required)) failures.push(`${marketCommodityRowPath} 缺少商品目录主视觉: ${required}`);\n  }",
);
replace(
  'scripts/verify-product-artwork.mjs',
  '市场列表与详情、生产结算及富内容下拉框使用 ProductArtwork PNG',
  '共享市场商品行与详情、生产结算及富内容下拉框使用 ProductArtwork PNG',
);

// Market asset verifier: shared row replaces the old inline regional catalog DOM.
replace(
  'scripts/verify-market-assets.mjs',
  "  'src/pages/MarketPage.tsx','src/pages/BuildingsPage.tsx'",
  "  'src/pages/MarketPage.tsx','src/components/market/MarketCommodityRow.tsx','src/pages/BuildingsPage.tsx'",
);
replace(
  'scripts/verify-market-assets.mjs',
  "  \"if (!facilityAssetId && marketViewMode === 'catalog')\",'market-catalog-filters','market-catalog-row','placeAssetOrder'",
  "  \"if (!facilityAssetId && marketViewMode === 'catalog')\",'market-catalog-filter-disclosure','<MarketCommodityRow','placeAssetOrder'",
);
replace(
  'scripts/verify-market-assets.mjs',
  "  '<ProductArtwork productId={entry.id} />','<FacilityIcon facilityTypeId={selectedFacility.id} />','backAction={{',",
  "  '<FacilityIcon facilityTypeId={selectedFacility.id} />','backAction={{',",
);
const marketAssets = read('scripts/verify-market-assets.mjs');
const marketAssetsAnchor = "for (const text of [\n  'unified-asset-tabs'";
if (!marketAssets.includes("requireText('src/components/market/MarketCommodityRow.tsx', '<ProductArtwork productId={productId} />');")) {
  const index = marketAssets.indexOf(marketAssetsAnchor);
  if (index < 0) throw new Error('scripts/verify-market-assets.mjs: shared-row anchor missing');
  write('scripts/verify-market-assets.mjs', marketAssets.slice(0, index)
    + "requireText('src/components/market/MarketCommodityRow.tsx', '<ProductArtwork productId={productId} />');\nrequireText('src/components/market/MarketCommodityRow.tsx', 'className=\"market-commodity-row\"');\n"
    + marketAssets.slice(index));
}

// Browser information hierarchy: product-first global detail and shared regional row.
write('tests/browser/market-information-hierarchy.spec.ts', `import { expect, test } from '@playwright/test';\n\ntest('market uses product-first global and regional information hierarchy', async ({ page }) => {\n  await page.setViewportSize({ width: 1440, height: 900 });\n  await page.goto('?preview=game');\n  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();\n\n  await expect(page.locator('.global-market-summary-strip')).toHaveCount(0);\n  await expect(page.locator('.global-market-provinces-panel')).toHaveCount(0);\n  await expect(page.locator('.global-market-filter-disclosure').first()).toBeVisible();\n  expect(await page.locator('.global-market-filter-disclosure').first().getAttribute('open')).toBeNull();\n  await expect(page.getByRole('searchbox')).toHaveCount(0);\n  const goods = page.locator('.global-market-goods-list');\n  await expect(goods).toBeVisible();\n  const globalRow = page.getByRole('button', { name: '打开小麦全局详情' });\n  await expect(globalRow).toBeVisible();\n  const globalGeometry = await globalRow.evaluate((row) => ({ clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }));\n  expect(globalGeometry.scrollWidth).toBeLessThanOrEqual(globalGeometry.clientWidth + 1);\n\n  await globalRow.click();\n  await expect(page.locator('.global-market-product-detail-panel')).toBeVisible();\n  const regionalRow = page.getByRole('button', { name: '打开加利福尼亚州小麦详情' });\n  await expect(regionalRow).toBeVisible();\n  for (const label of ['卖单量', '买单量', '市场价', '24h']) {\n    await expect(regionalRow.getByText(label, { exact: true })).toBeVisible();\n  }\n  for (const label of ['挂单差额', '基准偏离', '挂单状态']) {\n    await expect(regionalRow.getByText(label, { exact: true })).toHaveCount(0);\n  }\n\n  await regionalRow.click();\n  await expect(page.locator('.market-detail-hero__market-price')).toBeVisible();\n  await expect(page.locator('.market-fundamentals-balance .market-balance-bar')).toHaveCount(1);\n  const chartBox = await page.locator('.market-chart-card').boundingBox();\n  const tradeBox = await page.locator('.market-trade-card').boundingBox();\n  expect(chartBox).not.toBeNull();\n  expect(tradeBox).not.toBeNull();\n  expect(chartBox!.y).toBeLessThan(tradeBox!.y);\n});\n`);

// Auto-trade regression should target the shared row rather than a removed class.
replace(
  'tests/browser/warehouse-auto-sell.spec.ts',
  "    const rows = page.locator('.market-catalog-row');",
  "    const rows = page.locator('.market-commodity-row');",
);

console.log('Market verifier migration applied.');
