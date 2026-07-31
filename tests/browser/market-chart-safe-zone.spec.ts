import { expect, test, type Locator, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

async function inspectChartGeometry(chart: Locator) {
  return chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const canvas = wrapper.querySelector<HTMLElement>('.market-history-echart');
    const svg = wrapper.querySelector<SVGSVGElement>('.economy-chart__canvas svg');
    const legendRects = Array.from(wrapper.querySelectorAll<HTMLElement>('.market-chart-legend-item'))
      .map((item) => item.getBoundingClientRect());
    const title = wrapper.querySelector<HTMLElement>('.market-chart-x-axis-title');
    if (!canvas || !svg || legendRects.length !== 2 || !title) throw new Error('ECharts market chart fixture is incomplete');
    const canvasRect = canvas.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const readNumber = (name: string) => {
      const value = Number(wrapper.dataset[name]);
      if (!Number.isFinite(value)) throw new Error(`market chart is missing data-${name}`);
      return value;
    };
    const timeTicks = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
      .filter((text) => /^\d{2}:\d{2}$/.test(text.textContent?.trim() ?? ''))
      .map((text) => text.getBoundingClientRect());
    const legendLeft = Math.min(...legendRects.map((rect) => rect.left));
    const legendRight = Math.max(...legendRects.map((rect) => rect.right));
    const volumeTop = readNumber('volumeTop');
    const volumeBottom = readNumber('volumeBottom');
    const priceBottom = readNumber('priceBottom');
    const plotCenterX = readNumber('plotCenterX');
    return {
      ready: wrapper.querySelector('.economy-chart')?.getAttribute('data-echarts-ready'),
      hasSvg: svg.getBoundingClientRect().width > 0,
      timeVolumeGap: timeTicks.length > 0 ? Math.min(...timeTicks.map((rect) => rect.top)) - (wrapperRect.top + volumeBottom) : readNumber('timeLabelHeight'),
      timeLegendGap: Math.min(...legendRects.map((rect) => rect.top)) - canvasRect.bottom,
      legendTitleGap: titleRect.top - Math.max(...legendRects.map((rect) => rect.bottom)),
      bottomGap: wrapperRect.bottom - titleRect.bottom,
      legendCenterDelta: Math.abs((legendLeft + legendRight) / 2 - (wrapperRect.left + plotCenterX)),
      chartWidth: wrapperRect.width,
      actualHeight: wrapperRect.height,
      declaredHeight: readNumber('chartHeight'),
      volumeHeight: volumeBottom - volumeTop,
      volumeShare: readNumber('volumeShare'),
      priceVolumeGap: volumeTop - priceBottom,
      priceTicks: (wrapper.dataset.priceTicks || '').split(',').filter(Boolean).map(Number),
      volumeTicks: (wrapper.dataset.volumeTicks || '').split(',').filter(Boolean).map(Number),
    };
  });
}

async function expectChartGeometry(chart: Locator, context: string) {
  await expect(chart).toBeVisible();
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  const bounds = await inspectChartGeometry(chart);
  expect(bounds.ready).toBe('true');
  expect(bounds.hasSvg).toBe(true);
  expect(bounds.timeVolumeGap, `${context}时间刻度不得侵入成交量图区`).toBeGreaterThanOrEqual(1);
  expect(bounds.timeLegendGap, `${context}时间刻度区与图例之间必须保留安全区`).toBeGreaterThanOrEqual(7);
  expect(bounds.legendTitleGap, `${context}图例与时间轴标题之间必须保留安全区`).toBeGreaterThanOrEqual(9);
  expect(bounds.bottomGap, `${context}时间轴标题不得贴住图表底边`).toBeGreaterThanOrEqual(5);
  expect(bounds.legendCenterDelta, `${context}两项图例必须围绕绘图区中心整体居中`).toBeLessThanOrEqual(Math.max(2, bounds.chartWidth * 0.01));
  expect(bounds.volumeHeight, `${context}成交量图区实际高度不得低于 48px`).toBeGreaterThanOrEqual(48);
  expect(bounds.volumeShare, `${context}成交量图区不得低于数据绘图区的 22%`).toBeGreaterThanOrEqual(0.219);
  expect(bounds.priceVolumeGap, `${context}价格与成交量图区必须保持分隔`).toBeGreaterThan(0);
  expect(Math.abs(bounds.actualHeight - bounds.declaredHeight), `${context}动态计算高度必须同步到真实容器`).toBeLessThanOrEqual(2);
  expect(bounds.priceTicks.length).toBeGreaterThanOrEqual(3);
  expect(bounds.priceTicks.every(Number.isInteger)).toBe(true);
  expect(bounds.volumeTicks.every(Number.isInteger)).toBe(true);
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
