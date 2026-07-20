import { expect, test } from '@playwright/test';

test('mobile overview keeps all four market metrics on one row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const metricGrid = page.locator('.overview-market-metrics');
  const metrics = metricGrid.locator('.overview-metric');
  const labels = metricGrid.locator('.overview-metric > span');

  await expect(metrics).toHaveCount(4);
  await expect(labels).toHaveText(['最近成交', '最高买价', '最低卖价', '当前持仓']);

  const gridColumns = await metricGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
  expect(gridColumns).toBe(4);

  const metricBoxes = await metrics.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
  }));
  expect(Math.max(...metricBoxes.map((box) => box.top)) - Math.min(...metricBoxes.map((box) => box.top))).toBeLessThan(1);
  expect(Math.max(...metricBoxes.map((box) => box.bottom)) - Math.min(...metricBoxes.map((box) => box.bottom))).toBeLessThan(1);

  const labelLayout = await labels.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      whiteSpace: style.whiteSpace,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      height: box.height,
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  }));
  for (const label of labelLayout) {
    expect(label.whiteSpace).toBe('nowrap');
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
    expect(label.height).toBeLessThanOrEqual(label.lineHeight + 1);
  }

  const horizontalOverflow = await page.locator('.market-summary, .overview-market-metrics')
    .evaluateAll((elements) => elements.map((element) => element.scrollWidth > element.clientWidth + 1));
  expect(horizontalOverflow).toEqual([false, false]);
});
