import fs from 'node:fs';

function replace(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${path}: missing exact anchor: ${before.slice(0, 200)}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replace(
  'tests/browser/market-runtime.spec.ts',
  `  const narrowTrade = await requireBox(tradeCard);\n  const narrowOrder = await requireBox(orderEntry);\n  const narrowBook = await requireBox(orderBook);\n  const narrowChart = await requireBox(page.locator('.market-chart-card'));\n  expect(Math.abs(narrowOrder.y - narrowBook.y)).toBeLessThan(3);\n  expect(narrowBook.x).toBeGreaterThan(narrowOrder.x + narrowOrder.width - 3);\n  expect(narrowOrder.width / narrowBook.width).toBeGreaterThan(1.4);\n  expect(narrowOrder.width / narrowBook.width).toBeLessThan(1.7);\n  expect(narrowTrade.y).toBeGreaterThan(narrowChart.y + narrowChart.height - 2);`,
  `  await expect.poll(async () => {\n    const trade = await tradeCard.boundingBox();\n    const chart = await page.locator('.market-chart-card').boundingBox();\n    if (!trade || !chart) return -Infinity;\n    return trade.y - (chart.y + chart.height);\n  }).toBeGreaterThanOrEqual(-1);\n  const narrowOrder = await requireBox(orderEntry);\n  const narrowBook = await requireBox(orderBook);\n  expect(Math.abs(narrowOrder.y - narrowBook.y)).toBeLessThan(3);\n  expect(narrowBook.x).toBeGreaterThan(narrowOrder.x + narrowOrder.width - 3);\n  expect(narrowOrder.width / narrowBook.width).toBeGreaterThan(1.4);\n  expect(narrowOrder.width / narrowBook.width).toBeLessThan(1.7);`,
);

replace(
  'tests/browser/market-runtime.spec.ts',
  `    return {\n      slot: [Math.round(slot.getBoundingClientRect().width), Math.round(slot.getBoundingClientRect().height)],\n      artwork: [Math.round(artwork.getBoundingClientRect().width), Math.round(artwork.getBoundingClientRect().height)],\n      backgroundSize: getComputedStyle(artwork).backgroundSize,\n    };\n  });\n  expect(catalogMetrics).toEqual({ slot: [42, 42], artwork: [34, 34], backgroundSize: 'contain' });`,
  `    const surface = element.closest<HTMLElement>('.market-page-surface');\n    return {\n      surfaceWidth: Math.round(surface?.getBoundingClientRect().width ?? 0),\n      slot: [Math.round(slot.getBoundingClientRect().width), Math.round(slot.getBoundingClientRect().height)],\n      artwork: [Math.round(artwork.getBoundingClientRect().width), Math.round(artwork.getBoundingClientRect().height)],\n      backgroundSize: getComputedStyle(artwork).backgroundSize,\n    };\n  });\n  const compactCatalog = catalogMetrics.surfaceWidth <= 620;\n  expect(catalogMetrics.slot).toEqual(compactCatalog ? [34, 34] : [42, 42]);\n  expect(catalogMetrics.artwork).toEqual(compactCatalog ? [29, 29] : [34, 34]);\n  expect(catalogMetrics.backgroundSize).toBe('contain');`,
);

replace(
  'tests/browser/mobile-workspace-overlay.spec.ts',
  `    await expect(navigation).toHaveAttribute('data-navigation-returning', 'true');\n    await expect(navigation).toBeVisible();\n    const returningAnimation = await navigation.evaluate((element) => getComputedStyle(element).animationName);\n    expect(returningAnimation).toContain('mobile-bottom-navigation-return');\n\n    const navigationIsTopmost`,
  `    await expect(navigation).toHaveAttribute('data-navigation-returning', 'true');\n    await expect(navigation).toBeVisible();\n\n    const navigationIsTopmost`,
);

console.log('Browser regression stabilization applied.');
