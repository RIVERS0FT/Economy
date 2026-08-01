import { expect, test } from '@playwright/test';

test('market tooltip survives idle rerenders and real option updates until the pointer leaves', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 960, height: 720 });
  await page.goto('market-tooltip-persistence-test.html');

  const chart = page.locator('.market-history-chart.full');
  const economyChart = chart.locator('.economy-chart');
  const canvas = chart.locator('.economy-chart__canvas');
  const tooltip = page.locator('.economy-chart-tooltip');
  await expect(economyChart).toHaveAttribute('data-echarts-ready', 'true');
  await expect(chart).toHaveAttribute('data-tooltip-persistence', 'true');

  const bounds = await chart.boundingBox();
  expect(bounds).not.toBeNull();
  const geometry = await chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const read = (name: string) => Number(wrapper.dataset[name]);
    return {
      left: read('axisLeft'),
      right: read('axisRight'),
      priceTop: read('priceTop'),
      priceBottom: read('priceBottom'),
    };
  });
  const x = bounds!.x + geometry.left + (bounds!.width - geometry.left - geometry.right) * 0.502;
  const y = bounds!.y + (geometry.priceTop + geometry.priceBottom) / 2;
  await page.mouse.move(x, y);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('价格');
  const initialText = (await tooltip.innerText()).replace(/\s+/g, ' ').trim();
  const initialInstanceId = await canvas.getAttribute('data-echarts-instance-id');
  expect(initialInstanceId).toBeTruthy();

  await page.waitForTimeout(6_500);
  await expect.poll(async () => Number(await page.getByTestId('market-tooltip-render-count').getAttribute('data-render-count'))).toBeGreaterThanOrEqual(6);
  await expect(tooltip).toBeVisible();
  expect((await tooltip.innerText()).replace(/\s+/g, ' ').trim()).toBe(initialText);
  await expect(canvas).toHaveAttribute('data-echarts-instance-id', initialInstanceId!);

  await page.evaluate(() => window.__advanceMarketTooltipData?.());
  await expect.poll(async () => page.getByTestId('market-tooltip-render-count').getAttribute('data-data-revision')).toBe('1');
  await expect(tooltip).toBeVisible();
  await expect.poll(async () => (await tooltip.innerText()).replace(/\s+/g, ' ').trim()).not.toBe(initialText);
  await expect(canvas).toHaveAttribute('data-echarts-instance-id', initialInstanceId!);

  await page.mouse.move(4, 4);
  await expect(tooltip).toBeHidden();
  expect(pageErrors).toEqual([]);
});
