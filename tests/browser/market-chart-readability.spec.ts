import { expect, test } from '@playwright/test';

const mobileViewport = { width: 390, height: 844 };

test('market chart keeps price, volume and internal y-axis semantics readable', async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await page.goto('market-runtime-test.html?scenario=active');

  const chart = page.locator('.market-history-chart.full');
  await expect(chart).toBeVisible();
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');

  const state = await chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const svg = wrapper.querySelector<SVGSVGElement>('.economy-chart__canvas svg');
    if (!svg) throw new Error('market chart svg is missing');
    const axisLeft = Number(wrapper.dataset.axisLeft);
    const plotLeft = wrapperRect.left + axisLeft;
    const yTickPattern = /^(?:\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?[KMBT])$/;
    const yLabels = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
      .filter((text) => yTickPattern.test(text.textContent?.trim() ?? ''))
      .map((text) => {
        const rect = text.getBoundingClientRect();
        return { text: text.textContent?.trim() ?? '', left: rect.left, right: rect.right };
      });
    return {
      priceTicks: (wrapper.dataset.priceTicks ?? '').split(',').map(Number),
      volumeTicks: (wrapper.dataset.volumeTicks ?? '').split(',').map(Number),
      volumeTickCount: Number(wrapper.dataset.volumeTickCount),
      volumeNonzeroLabelVisible: wrapper.dataset.volumeNonzeroLabelVisible,
      priceColorRole: wrapper.dataset.priceColorRole,
      yAxisLabelsInside: wrapper.dataset.yAxisLabelsInside,
      xAxisTitleVisible: wrapper.dataset.xAxisTitleVisible,
      axisLeft,
      plotLeft,
      yLabels,
      volumeHeight: Number(wrapper.dataset.volumeBottom) - Number(wrapper.dataset.volumeTop),
    };
  });

  expect(state.priceTicks).not.toContain(0);
  expect(Math.min(...state.priceTicks)).toBeGreaterThanOrEqual(9);
  expect(Math.max(...state.priceTicks)).toBeLessThanOrEqual(13);
  expect(state.volumeTickCount).toBeGreaterThanOrEqual(3);
  expect(state.volumeTicks.some((value) => value > 0 && value < Math.max(...state.volumeTicks))).toBe(true);
  expect(state.volumeNonzeroLabelVisible).toBe('true');
  expect(state.priceColorRole).toBe('info');
  expect(state.yAxisLabelsInside).toBe('true');
  expect(state.xAxisTitleVisible).toBe('false');
  expect(state.axisLeft).toBeGreaterThanOrEqual(6);
  expect(state.axisLeft).toBeLessThanOrEqual(16);
  expect(state.volumeHeight).toBeGreaterThanOrEqual(68);
  expect(state.yLabels.length).toBeGreaterThanOrEqual(3);
  expect(state.yLabels.every((label) => label.left >= state.plotLeft - 1)).toBe(true);

  await expect(chart.locator('.market-chart-section-label')).toHaveCount(0);
  await expect(chart.locator('.market-chart-x-axis-title')).toHaveCount(0);
  await expect(chart.locator('.market-chart-legend')).toHaveCount(0);
  await expect(chart.locator('.market-chart-footer')).toHaveCount(0);

  const cssColors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      info: root.getPropertyValue('--color-info').trim(),
      success: root.getPropertyValue('--color-success').trim(),
    };
  });
  expect(cssColors.info).not.toBe(cssColors.success);

  const visibleSvgLabels = await chart.locator('.economy-chart__canvas svg text').allTextContents();
  const maxVolumeTick = Math.max(...state.volumeTicks);
  const visibleIntermediateVolumeTick = state.volumeTicks.find((value) => value > 0 && value < maxVolumeTick) ?? null;
  expect(visibleIntermediateVolumeTick).not.toBeNull();
  expect(visibleSvgLabels).toContain(String(visibleIntermediateVolumeTick));
});