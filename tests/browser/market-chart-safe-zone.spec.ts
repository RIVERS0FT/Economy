import { expect, test, type Locator, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

async function inspectBottomSafeZones(chart: Locator) {
  return chart.evaluate((element) => {
    const svg = element as SVGSVGElement;
    const svgRect = svg.getBoundingClientRect();
    const xTickRects = Array.from(svg.querySelectorAll<SVGTextElement>('.chart-x-tick-label'))
      .map((text) => text.getBoundingClientRect());
    const legendRects = Array.from(svg.querySelectorAll<SVGGElement>('.chart-legend-item'))
      .map((item) => item.getBoundingClientRect());
    const xAxisTitle = svg.querySelector<SVGTextElement>('.chart-x-axis-title');
    if (xTickRects.length === 0 || legendRects.length !== 2 || !xAxisTitle) {
      throw new Error('market chart bottom safe-zone fixture is incomplete');
    }
    const titleRect = xAxisTitle.getBoundingClientRect();
    const legendLeft = Math.min(...legendRects.map((rect) => rect.left));
    const legendRight = Math.max(...legendRects.map((rect) => rect.right));
    return {
      timeLegendGap: Math.min(...legendRects.map((rect) => rect.top))
        - Math.max(...xTickRects.map((rect) => rect.bottom)),
      legendTitleGap: titleRect.top - Math.max(...legendRects.map((rect) => rect.bottom)),
      bottomGap: svgRect.bottom - titleRect.bottom,
      legendCenterDelta: Math.abs((legendLeft + legendRight) / 2 - (svgRect.left + svgRect.width / 2)),
      chartWidth: svgRect.width,
    };
  });
}

async function expectBottomSafeZones(chart: Locator, context: string) {
  await expect(chart).toBeVisible();
  await expect.poll(async () => (await inspectBottomSafeZones(chart)).timeLegendGap, {
    message: `${context}旋转时间刻度与图例之间必须保留安全区`,
  }).toBeGreaterThanOrEqual(7);
  const bounds = await inspectBottomSafeZones(chart);
  expect(bounds.legendTitleGap, `${context}图例与时间轴标题之间必须保留安全区`).toBeGreaterThanOrEqual(9);
  expect(bounds.bottomGap, `${context}时间轴标题不得贴住 SVG 底边`).toBeGreaterThanOrEqual(5);
  expect(bounds.legendCenterDelta, `${context}两项图例必须作为整体居中`).toBeLessThanOrEqual(Math.max(2, bounds.chartWidth * 0.01));
}

test('market chart reserves separate bottom safe zones for time labels, legend and axis title', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  const viewports = [
    { width: 1684, height: 931, label: '桌面端' },
    { width: 390, height: 844, label: '移动端' },
    { width: 320, height: 700, label: '极窄移动端' },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('market-runtime-test.html?scenario=active');
    await expectBottomSafeZones(page.locator('.market-history-chart.full'), viewport.label);
  }

  expect(pageErrors).toEqual([]);
});
