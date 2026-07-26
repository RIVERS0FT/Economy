import { expect, test, type Locator, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

async function inspectChartGeometry(chart: Locator) {
  return chart.evaluate((element) => {
    const svg = element as SVGSVGElement;
    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const scaleX = svgRect.width / viewBox.width;
    const scaleY = svgRect.height / viewBox.height;
    const readNumber = (name: string) => {
      const value = Number(svg.dataset[name]);
      if (!Number.isFinite(value)) throw new Error(`market chart is missing data-${name}`);
      return value;
    };
    const xTickRects = Array.from(svg.querySelectorAll<SVGTextElement>('.chart-x-tick-label'))
      .map((text) => text.getBoundingClientRect());
    const legendRects = Array.from(svg.querySelectorAll<SVGGElement>('.chart-legend-item'))
      .map((item) => item.getBoundingClientRect());
    const volumeTickRects = Array.from(svg.querySelectorAll<SVGTextElement>('.chart-volume-tick-label'))
      .map((text) => text.getBoundingClientRect())
      .sort((a, b) => a.top - b.top);
    const xAxisTitle = svg.querySelector<SVGTextElement>('.chart-x-axis-title');
    if (xTickRects.length === 0 || legendRects.length !== 2 || volumeTickRects.length < 2 || !xAxisTitle) {
      throw new Error('market chart geometry fixture is incomplete');
    }
    const titleRect = xAxisTitle.getBoundingClientRect();
    const legendLeft = Math.min(...legendRects.map((rect) => rect.left));
    const legendRight = Math.max(...legendRects.map((rect) => rect.right));
    const volumeTop = readNumber('volumeTop');
    const volumeBottom = readNumber('volumeBottom');
    const priceBottom = readNumber('priceBottom');
    const plotCenterX = readNumber('plotCenterX');
    const chartHeight = readNumber('chartHeight');
    const volumeShare = readNumber('volumeShare');
    const screenVolumeTop = svgRect.top + volumeTop * scaleY;
    const screenVolumeBottom = svgRect.top + volumeBottom * scaleY;
    const nonZeroBars = Array.from(svg.querySelectorAll<SVGRectElement>('rect[data-direction]'))
      .map((bar) => bar.getBoundingClientRect())
      .filter((rect) => rect.height > 0.25);
    const volumeTickGaps = volumeTickRects.slice(1).map((rect, index) => (
      rect.top - volumeTickRects[index].bottom
    ));
    return {
      timeVolumeGap: Math.min(...xTickRects.map((rect) => rect.top)) - screenVolumeBottom,
      timeLegendGap: Math.min(...legendRects.map((rect) => rect.top))
        - Math.max(...xTickRects.map((rect) => rect.bottom)),
      legendTitleGap: titleRect.top - Math.max(...legendRects.map((rect) => rect.bottom)),
      bottomGap: svgRect.bottom - titleRect.bottom,
      legendCenterDelta: Math.abs((legendLeft + legendRight) / 2 - (svgRect.left + plotCenterX * scaleX)),
      chartWidth: svgRect.width,
      chartHeight,
      actualHeight: svgRect.height,
      volumeHeight: (volumeBottom - volumeTop) * scaleY,
      volumeShare,
      priceVolumeGap: (volumeTop - priceBottom) * scaleY,
      volumeTickMinimumGap: Math.min(...volumeTickGaps),
      barsInsideVolumeArea: nonZeroBars.every((rect) => (
        rect.top >= screenVolumeTop - 1 && rect.bottom <= screenVolumeBottom + 1
      )),
    };
  });
}

async function expectChartGeometry(chart: Locator, context: string) {
  await expect(chart).toBeVisible();
  await expect.poll(async () => (await inspectChartGeometry(chart)).timeLegendGap, {
    message: `${context}旋转时间刻度与图例之间必须保留安全区`,
  }).toBeGreaterThanOrEqual(7);
  const bounds = await inspectChartGeometry(chart);
  expect(bounds.timeVolumeGap, `${context}时间刻度不得侵入成交量图区`).toBeGreaterThanOrEqual(1);
  expect(bounds.legendTitleGap, `${context}图例与时间轴标题之间必须保留安全区`).toBeGreaterThanOrEqual(9);
  expect(bounds.bottomGap, `${context}时间轴标题不得贴住 SVG 底边`).toBeGreaterThanOrEqual(5);
  expect(bounds.legendCenterDelta, `${context}两项图例必须围绕绘图区中心整体居中`).toBeLessThanOrEqual(Math.max(2, bounds.chartWidth * 0.01));
  expect(bounds.volumeHeight, `${context}成交量图区实际高度不得低于 48px`).toBeGreaterThanOrEqual(48);
  expect(bounds.volumeShare, `${context}成交量图区不得低于数据绘图区的 22%`).toBeGreaterThanOrEqual(0.219);
  expect(bounds.priceVolumeGap, `${context}价格与成交量图区必须保持分隔`).toBeGreaterThan(0);
  expect(bounds.volumeTickMinimumGap, `${context}成交量纵轴刻度不得互相覆盖`).toBeGreaterThanOrEqual(-1);
  expect(bounds.barsInsideVolumeArea, `${context}成交量柱不得越出成交量图区`).toBe(true);
}

test('market chart preserves readable volume height and separate bottom safe zones', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  const viewports = [
    { width: 1684, height: 931, label: '桌面端' },
    { width: 390, height: 844, label: '移动端' },
    { width: 320, height: 700, label: '极窄移动端' },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('market-runtime-test.html?scenario=active');
    await expectChartGeometry(page.locator('.market-history-chart.full'), viewport.label);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
    window.dispatchEvent(new Event('resize'));
  });
  await expectChartGeometry(page.locator('.market-history-chart.full'), '125% 根字号移动端');

  expect(pageErrors).toEqual([]);
});
