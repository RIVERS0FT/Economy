import { test } from '@playwright/test';

test('diagnose market direct overflow geometry', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto('market-runtime-test.html?scenario=active');
  const surface = page.locator('.market-page-surface');
  await surface.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.style.width = '790px';
    htmlElement.style.maxWidth = '100%';
  });
  const report = await surface.evaluate((element) => {
    const surfaceElement = element as HTMLElement;
    const surfaceRect = surfaceElement.getBoundingClientRect();
    const describe = (node: HTMLElement) => {
      const rect = node.getBoundingClientRect();
      return {
        selector: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${Array.from(node.classList).map((name) => `.${name}`).join('')}`,
        left: rect.left - surfaceRect.left,
        right: rect.right - surfaceRect.left,
        width: rect.width,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        overflowX: getComputedStyle(node).overflowX,
        boxSizing: getComputedStyle(node).boxSizing,
        borderLeft: getComputedStyle(node).borderLeftWidth,
        borderRight: getComputedStyle(node).borderRightWidth,
      };
    };
    const selected = Array.from(surfaceElement.querySelectorAll<HTMLElement>(
      ':scope > *, .asset-directory-shell, .asset-directory-scroll-area, .unified-asset-tabs, .unified-market-grid, .market-account-panel, .market-account-grid, .table-scroll-area, .local-trades-scroll-area',
    ));
    return {
      surface: describe(surfaceElement),
      selected: selected.map(describe),
    };
  });
  console.error(`MARKET_OVERFLOW_DIAGNOSTIC ${JSON.stringify(report, null, 2)}`);
});
