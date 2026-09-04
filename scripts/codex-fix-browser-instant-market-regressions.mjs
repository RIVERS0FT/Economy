import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function replaceOnce(path, oldText, newText, label) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: ${label} not found`);
  const next = source.replace(oldText, newText);
  if (next === source) throw new Error(`${path}: ${label} made no change`);
  writeFileSync(path, next);
}

function replaceAllExact(path, oldText, newText, expectedCount, label) {
  const source = readFileSync(path, 'utf8');
  const count = source.split(oldText).length - 1;
  if (count !== expectedCount) throw new Error(`${path}: ${label} expected ${expectedCount}, got ${count}`);
  writeFileSync(path, source.split(oldText).join(newText));
}

replaceOnce(
  'src/styles/market-detail-direct-flow.css',
  `/* Regional market detail keeps contextual and trading content in the page flow.\n * Order-entry and order-book controls keep their internal boundaries without an outer card shell.\n * Commodity identity exposes only the two retained facts, so removed fundamentals reserve no layout tracks.\n * This page-flow contract is independent of unrelated global state-version migrations. */`,
  `/* Regional market detail keeps contextual and trading content in the page flow.\n * Immediate-trade controls keep their internal boundaries without an outer card shell.\n * Commodity identity keeps the retained daily-price, trend, and inventory facts without restoring removed fundamentals.\n * This page-flow contract is independent of unrelated global state-version migrations. */`,
  'stale direct-flow header',
);
replaceOnce(
  'src/styles/market-detail-direct-flow.css',
  `\n.market-detail-surface .market-trade-summary > span:nth-child(2) {\n  display: none;\n}\n`,
  '\n',
  'hidden today volume rule',
);

replaceOnce(
  'tests/browser/all-pages-preview.spec.ts',
  `  for (const label of ['地区', '卖单量', '买单量', '24h成交量', '市场价', '24h价格变化']) await expect(regionalHeader.getByText(label, { exact: true })).toBeVisible();\n  for (const label of ['卖单量', '买单量', '24h成交量', '市场价', '24h价格变化', '挂单差额', '基准偏离', '挂单状态']) await expect(regionalRow.getByText(label, { exact: true })).toHaveCount(0);`,
  `  for (const label of ['地区', '今日价格', '24h成交量', '24h价格变化']) await expect(regionalHeader.getByText(label, { exact: true })).toBeVisible();\n  for (const label of ['卖单量', '买单量', '今日价格', '24h成交量', '24h价格变化', '挂单差额', '基准偏离', '挂单状态']) await expect(regionalRow.getByText(label, { exact: true })).toHaveCount(0);`,
  'regional market header expectations',
);

replaceOnce(
  'tests/browser/province-locked-access.spec.ts',
  `  await expect(page.locator('.market-submit-order')).toBeVisible();\n  await expect(page.getByText('实时五档 · 点击填价', { exact: true })).toHaveCount(1);`,
  `  await expect(page.locator('.market-submit-order')).toBeVisible();\n  await expect(page.getByText('即时交易', { exact: true })).toBeVisible();\n  await expect(page.locator('#market-trade-quantity')).toBeVisible();\n  await expect(page.getByText('实时五档 · 点击填价', { exact: true })).toHaveCount(0);`,
  'legacy locked market assertion',
);

replaceOnce(
  'tests/browser/market-desktop-cleanup.spec.ts',
  `  await expect(detail.locator('.market-immediate-trade-card')).toBeVisible();\n  await expect(detail.getByText('今日价格', { exact: true }).first()).toBeVisible();\n  await expect(detail.getByText('今日成交量', { exact: true })).toBeVisible();\n  await expect(detail.getByText('24h 成交量', { exact: true })).toBeVisible();\n  await expect(detail.getByText('下次调价', { exact: true })).toBeVisible();`,
  `  await expect(detail.locator('.market-immediate-trade-card')).toBeVisible();\n  const summary = detail.locator('.market-trade-summary');\n  await expect(summary.getByText('今日价格', { exact: true })).toBeVisible();\n  await expect(summary.getByText('今日成交量', { exact: true })).toBeVisible();\n  await expect(summary.getByText('24h 成交量', { exact: true })).toBeVisible();\n  await expect(summary.getByText('下次调价', { exact: true })).toBeVisible();`,
  'ambiguous detail summary assertions',
);

replaceOnce(
  'tests/browser/market-order-entry-compact.spec.ts',
  `  await page.goto('/market-runtime-test.html');`,
  `  await page.goto('/market-runtime-test.html?view=catalog');`,
  'catalog entry URL',
);

replaceOnce(
  'tests/browser/market-runtime.spec.ts',
  `  await page.goto('/market-runtime-test.html');`,
  `  await page.goto('/market-runtime-test.html?view=catalog');`,
  'catalog helper URL',
);
replaceOnce(
  'tests/browser/market-runtime.spec.ts',
  `  await expect(page.locator('.market-immediate-trade-card')).toBeVisible();\n  await expect(page.getByText('今日成交价')).toBeVisible();\n  await expect(page.getByText('下次调价')).toBeVisible();`,
  `  await expect(page.locator('.market-immediate-trade-card')).toBeVisible();\n  const entry = page.locator('.market-immediate-trade');\n  await expect(entry.getByText('今日成交价', { exact: true })).toBeVisible();\n  await expect(entry.getByText('下次调价', { exact: true })).toBeVisible();`,
  'daily-price entry assertions',
);

replaceOnce(
  'tests/browser/shell-floating-safe-zone.spec.ts',
  `  const priceInput = page.getByRole('textbox', { name: '价格', exact: true });\n  await expect(priceInput).toHaveValue('2');\n  await page.getByRole('button', { name: '价格增加 0.01' }).click();\n  await expect(priceInput).toHaveValue('2.01');`,
  `  const quantityInput = page.getByRole('textbox', { name: '数量', exact: true });\n  await expect(quantityInput).toHaveValue('1');\n  await page.getByRole('button', { name: '数量增加 1' }).click();\n  await expect(quantityInput).toHaveValue('2');\n  await expect(page.getByRole('textbox', { name: '价格', exact: true })).toHaveCount(0);`,
  'retired price-input pointer assertion',
);

replaceAllExact(
  'tests/browser/warehouse-auto-sell.spec.ts',
  `page.locator('.market-detail-hero__metric')).toHaveCount(2)`,
  `page.locator('.market-detail-hero__metrics > span')).toHaveCount(3)`,
  2,
  'retired hero metric selector',
);

replaceOnce(
  'tests/browser/market-runtime-harness.tsx',
  `        officialPrice: assetId === 'wheat' ? 11 : 10,\n        nextPriceAt: fixedNow + 60_000,\n        cycleBuyQuantity: 0,\n        cycleSellQuantity: 0,`,
  `        officialPrice: assetId === 'wheat' ? 11 : 10,\n        priceDateKey: '2026-07-18',\n        nextPriceAt: fixedNow + (23 * 60 + 30) * 60_000,\n        todayBuyQuantity: assetId === 'wheat' ? 5 : 0,\n        todaySellQuantity: assetId === 'wheat' ? 4 : 0,\n        previousDayBuyQuantity: assetId === 'wheat' ? 3 : 0,\n        previousDaySellQuantity: assetId === 'wheat' ? 2 : 0,`,
  'market detail daily counters',
);
replaceOnce(
  'tests/browser/market-runtime-harness.tsx',
  `        officialPrice: product.id === 'wheat' ? 11 : product.basePrice,\n        nextPriceAt: fixedNow + 60_000,\n        cycleBuyQuantity: 0,\n        cycleSellQuantity: 0,`,
  `        officialPrice: product.id === 'wheat' ? 11 : product.basePrice,\n        priceDateKey: '2026-07-18',\n        nextPriceAt: fixedNow + (23 * 60 + 30) * 60_000,\n        todayBuyQuantity: product.id === 'wheat' ? 5 : 0,\n        todaySellQuantity: product.id === 'wheat' ? 4 : 0,\n        previousDayBuyQuantity: product.id === 'wheat' ? 3 : 0,\n        previousDaySellQuantity: product.id === 'wheat' ? 2 : 0,`,
  'game market daily counters',
);

replaceOnce(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  `地区商品详情只展示当前商品身份、今日价格、真实 24h 变化、可用库存、行情、即时买卖数量控件、交易总额／预计到账、今日／24h 成交量、下次北京时间 00:00 调价时间以及当前浏览器最近成交。`,
  `地区商品详情只展示当前商品身份、今日价格、真实 24h 变化、可用库存、行情、即时买卖数量控件、交易总额／预计到账、今日／24h 成交量、下次北京时间 00:00 调价时间以及当前浏览器最近成交。“今日成交量”与“24h 成交量”在桌面和移动端均为可见市场事实，不得通过响应式 CSS 隐藏其中任一项。`,
  'visible daily volume rule',
);

replaceOnce(
  'scripts/verify-market-page-layout-regional.mjs',
  `requireText(detailStyles, '.market-detail-surface .market-trade-card {', '详情样式必须继续拥有直接交易区。');\nrequireText(detailStyles, 'background: transparent;', '直接交易区不得恢复一级卡片背景。');`,
  `requireText(detailStyles, '.market-detail-surface .market-trade-card {', '详情样式必须继续拥有直接交易区。');\nrequireText(detailStyles, 'background: transparent;', '直接交易区不得恢复一级卡片背景。');\nforbidText(detailStyles, '.market-trade-summary > span:nth-child(2)', '今日成交量不得被响应式样式隐藏。');`,
  'visible today-volume verifier',
);
replaceOnce(
  'scripts/verify-market-page-layout-regional.mjs',
  `  '不得恢复成玩家盘口玩法',\n]) requireText(marketDesign, token, \`商品市场设计必须锁定即时交易边界: \${token}\`);`,
  `  '不得恢复成玩家盘口玩法',\n  '“今日成交量”与“24h 成交量”在桌面和移动端均为可见市场事实',\n]) requireText(marketDesign, token, \`商品市场设计必须锁定即时交易边界: \${token}\`);`,
  'market design visibility verifier',
);

for (const temp of [
  'scripts/codex-fix-browser-instant-market-regressions.mjs',
  '.github/workflows/codex-fix-browser-instant-market-regressions.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
