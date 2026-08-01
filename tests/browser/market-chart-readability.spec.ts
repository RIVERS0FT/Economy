import { expect, test } from '@playwright/test';

const mobileViewport = { width: 390, height: 844 };

test('market chart keeps price, volume and mobile axis semantics readable', async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto('market-runtime-test.html?scenario=active');

  const chart = page.locator('.market-history-chart.full');
  await expect(chart).toBeVisible();
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');

  const state = await chart.evaluate((element) => ({
    priceTicks: (element.getAttribute('data-price-ticks') ?? '').split(',').map(Number),
    volumeTicks: (element.getAttribute('data-volume-ticks') ?? '').split(',').map(Number),
    volumeTickCount: Number(element.getAttribute('data-volume-tick-count')),
    volumeNonzeroLabelVisible: element.getAttribute('data-volume-nonzero-label-visible'),
    priceColorRole: element.getAttribute('data-price-color-role'),
    mobileAxisTitles: element.getAttribute('data-mobile-axis-titles'),
    xAxisTitleVisible: element.getAttribute('data-x-axis-title-visible'),
    axisLeft: Number(element.getAttribute('data-axis-left')),
    volumeHeight: Number(element.getAttribute('data-volume-bottom')) - Number(element.getAttribute('data-volume-top')),
  }));

  expect(state.priceTicks).not.toContain(0);
  expect(Math.min(...state.priceTicks)).toBeGreaterThanOrEqual(9);
  expect(Math.max(...state.priceTicks)).toBeLessThanOrEqual(13);
  expect(state.volumeTickCount).toBeGreaterThanOrEqual(3);
  expect(state.volumeTicks.some((value) => value > 0 && value < Math.max(...state.volumeTicks))).toBe(true);
  expect(state.volumeNonzeroLabelVisible).toBe('true');
  expect(state.priceColorRole).toBe('info');
  expect(state.mobileAxisTitles).toBe('true');
  expect(state.xAxisTitleVisible).toBe('false');
  expect(state.axisLeft).toBeLessThan(68);
  expect(state.volumeHeight).toBeGreaterThanOrEqual(68);

  await expect(chart.locator('.market-chart-section-label')).toHaveCount(2);
  await expect(chart.locator('.market-chart-x-axis-title')).toHaveCount(0);
  await expect(chart.locator('.market-chart-legend')).toBeVisible();

  const cssColors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      info: root.getPropertyValue('--color-info').trim(),
      success: root.getPropertyValue('--color-success').trim(),
    };
  });
  expect(cssColors.info).not.toBe(cssColors.success);

  const visibleSvgLabels = await chart.locator('.economy-chart__canvas svg text').allTextContents();
  expect(visibleSvgLabels).toContain('2');
});
