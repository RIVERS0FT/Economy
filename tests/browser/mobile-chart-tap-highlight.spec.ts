import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});

test('mobile chart interaction surfaces suppress the native blue tap highlight', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('market-runtime-test.html?scenario=active');

  const chart = page.locator('.market-history-chart.full');
  await expect(chart).toBeVisible();
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');

  const tapHighlights = await chart.evaluate((root) => {
    const targets = [
      { selector: '.market-history-chart', element: root },
      { selector: '.economy-chart', element: root.querySelector('.economy-chart') },
      { selector: '.economy-chart__canvas', element: root.querySelector('.economy-chart__canvas') },
      { selector: '.economy-chart__canvas svg', element: root.querySelector('.economy-chart__canvas svg') },
      { selector: '.economy-chart__canvas svg path', element: root.querySelector('.economy-chart__canvas svg path') },
    ];

    return targets.map(({ selector, element }) => {
      if (!(element instanceof Element)) throw new Error(`缺少图表触控节点: ${selector}`);
      const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitTapHighlightColor: string };
      return { selector, color: style.webkitTapHighlightColor };
    });
  });

  for (const { selector, color } of tapHighlights) {
    expect(color, `${selector} 不得保留浏览器原生蓝色点击高亮`).toBe('rgba(0, 0, 0, 0)');
  }

  await chart.tap({ position: { x: 180, y: 120 } });
  expect(await page.evaluate(() => document.getSelection()?.toString() ?? '')).toBe('');
  expect(pageErrors).toEqual([]);
});
