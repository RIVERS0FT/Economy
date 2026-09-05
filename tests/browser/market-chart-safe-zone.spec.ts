import { expect, test, type Locator, type Page } from '@playwright/test';

// compact 变体继续满足“成交量图区实际高度不得低于 48px”，本回归验证 full 变体提高后的 68px 基线。
const marketChartViewports = [
  { width: 1684, height: 931, label: '桌面端' },
  { width: 390, height: 844, label: '移动端' },
  { width: 320, height: 700, label: '极窄移动端' },
] as const;

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
    const divider = wrapper.querySelector<HTMLElement>('.market-chart-price-volume-divider');
    const legendCount = wrapper.querySelectorAll<HTMLElement>('.market-chart-legend-item').length;
    const title = wrapper.querySelector<HTMLElement>('.market-chart-x-axis-title');
    if (!canvas || !svg || !divider) throw new Error('ECharts market chart fixture is incomplete');
    const canvasRect = canvas.getBoundingClientRect();
    const dividerRect = divider.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect() ?? null;
    const readNumber = (name: string) => {
      const value = Number(wrapper.dataset[name]);
      if (!Number.isFinite(value)) throw new Error(`market chart is missing data-${name}`);
      return value;
    };
    const timeTicks = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
      .filter((text) => /^\d{2}[/\-]\d{2}$/.test(text.textContent?.trim() ?? ''))
      .map((text) => text.getBoundingClientRect());
    const volumeTop = readNumber('volumeTop');
    const volumeBottom = readNumber('volumeBottom');
    const priceBottom = readNumber('priceBottom');
    return {
      ready: wrapper.querySelector('.economy-chart')?.getAttribute('data-echarts-ready'),
      hasSvg: svg.getBoundingClientRect().width > 0,
      timeVolumeGap: timeTicks.length > 0 ? Math.min(...timeTicks.map((rect) => rect.top)) - (wrapperRect.top + volumeBottom) : readNumber('timeLabelHeight'),
      titleGap: titleRect ? titleRect.top - canvasRect.bottom : null,
      bottomGap: wrapperRect.bottom - (titleRect?.bottom ?? canvasRect.bottom),
      legendCount,
      chartWidth: wrapperRect.width,
      actualHeight: wrapperRect.height,
      declaredHeight: readNumber('chartHeight'),
      volumeHeight: volumeBottom - volumeTop,
      volumeShare: readNumber('volumeShare'),
      priceVolumeGap: volumeTop - priceBottom,
      dividerBoundaryDelta: Math.abs(dividerRect.top - (wrapperRect.top + priceBottom)),
      dividerHeight: dividerRect.height,
      timeAxisInterval: readNumber('timeAxisInterval'),
      priceTickCount: readNumber('priceTickCount'),
      volumeTickCount: readNumber('volumeTickCount'),
      axisPointerLinked: wrapper.dataset.axisPointerLinked,
      hoverEmphasisDisabled: wrapper.dataset.hoverEmphasisDisabled,
      mobileAxisTitles: wrapper.dataset.mobileAxisTitles,
      xAxisTitleVisible: wrapper.dataset.xAxisTitleVisible,
      titlePresent: Boolean(titleRect),
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
  expect(bounds.legendCount, `${context}不得显示净主动买入／卖出图例`).toBe(0);
  if (bounds.xAxisTitleVisible === 'true') {
    expect(bounds.titlePresent, `${context}宽图日期轴标题必须存在`).toBe(true);
    expect(bounds.titleGap, `${context}日期刻度与日期轴标题之间必须保留安全区`).toBeGreaterThanOrEqual(7);
  } else {
    expect(bounds.titlePresent, `${context}窄图不得保留冗余日期轴标题`).toBe(false);
    expect(bounds.titleGap).toBeNull();
  }
  expect(bounds.bottomGap, `${context}底部可见内容不得贴住图表边缘`).toBeGreaterThanOrEqual(5);
  expect(bounds.volumeHeight, `${context}完整行情图成交量图区实际高度不得低于 68px`).toBeGreaterThanOrEqual(68);
  expect(bounds.volumeShare, `${context}成交量图区不得低于数据绘图区的 22%`).toBeGreaterThanOrEqual(0.219);
  expect(Math.abs(bounds.priceVolumeGap), `${context}价格与成交量 Grid 必须零间距连续排列`).toBeLessThanOrEqual(0.5);
  expect(bounds.dividerBoundaryDelta, `${context}分界线必须贴合两个 Grid 的共同边界`).toBeLessThanOrEqual(1);
  expect(bounds.dividerHeight, `${context}分界线必须保持 1px`).toBeGreaterThanOrEqual(0.9);
  expect(Math.abs(bounds.actualHeight - bounds.declaredHeight), `${context}动态计算高度必须同步到真实容器`).toBeLessThanOrEqual(2);
  expect(bounds.priceTicks.length).toBe(bounds.priceTickCount);
  expect(bounds.volumeTicks.length).toBe(bounds.volumeTickCount);
  expect(bounds.priceTicks.every(Number.isInteger)).toBe(true);
  expect(bounds.volumeTicks.every(Number.isInteger)).toBe(true);
  expect(bounds.axisPointerLinked).toBe('true');
  expect(bounds.hoverEmphasisDisabled).toBe('true');
  return bounds;
}

function expectWidthResponsiveAxisChrome(
  bounds: Awaited<ReturnType<typeof inspectChartGeometry>>,
  context: string,
) {
  const usesMobileAxisChrome = bounds.chartWidth <= 720;
  expect(
    bounds.mobileAxisTitles,
    `${context}轴标题模式必须由图表自身宽度决定`,
  ).toBe(usesMobileAxisChrome ? 'true' : 'false');
  expect(
    bounds.xAxisTitleVisible,
    `${context}可见日期标题必须由图表自身宽度决定`,
  ).toBe(usesMobileAxisChrome ? 'false' : 'true');
}

async function resizeAndInspectChart(
  page: Page,
  chart: Locator,
  viewport: { width: number; height: number },
  previousWidth: number,
) {
  await page.setViewportSize(viewport);
  await expect.poll(async () => {
    const bounds = await inspectChartGeometry(chart);
    const usesMobileAxisChrome = bounds.chartWidth <= 720;
    return {
      widthChanged: Math.abs(bounds.chartWidth - previousWidth) > 1,
      responsiveChrome: bounds.mobileAxisTitles === (usesMobileAxisChrome ? 'true' : 'false')
        && bounds.xAxisTitleVisible === (usesMobileAxisChrome ? 'false' : 'true'),
      heightSynced: Math.abs(bounds.actualHeight - bounds.declaredHeight) <= 2,
    };
  }).toEqual({ widthChanged: true, responsiveChrome: true, heightSynced: true });
  return inspectChartGeometry(chart);
}

for (const viewport of marketChartViewports) {
  test(`market chart ${viewport.label} preserves readable volume height, zero-gap grids and dynamic ticks`, async ({ page }) => {
    const pageErrors = await capturePageErrors(page);
    await page.setViewportSize(viewport);
    await page.goto('market-runtime-test.html?scenario=active');
    const bounds = await expectChartGeometry(page.locator('.market-history-chart.full'), viewport.label);
    expectWidthResponsiveAxisChrome(bounds, viewport.label);
    expect(pageErrors).toEqual([]);
  });
}

test('market chart responsive tick density follows real chart width in one runtime', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  const chart = page.locator('.market-history-chart.full');

  await page.setViewportSize(marketChartViewports[0]);
  await page.goto('market-runtime-test.html?scenario=active');
  const desktop = await expectChartGeometry(chart, marketChartViewports[0].label);

  const mobile = await resizeAndInspectChart(page, chart, marketChartViewports[1], desktop.chartWidth);
  expectWidthResponsiveAxisChrome(mobile, marketChartViewports[1].label);
  const narrow = await resizeAndInspectChart(page, chart, marketChartViewports[2], mobile.chartWidth);
  expectWidthResponsiveAxisChrome(narrow, marketChartViewports[2].label);

  expect(desktop.timeAxisInterval).toBeLessThan(mobile.timeAxisInterval);
  expect(mobile.timeAxisInterval).toBeLessThanOrEqual(narrow.timeAxisInterval);
  expect(desktop.priceTickCount).toBeGreaterThanOrEqual(mobile.priceTickCount);
  expect(pageErrors).toEqual([]);
});

test('market chart 125% root font keeps mobile safe geometry and tick density', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  const chart = page.locator('.market-history-chart.full');
  await page.setViewportSize(marketChartViewports[1]);
  await page.goto('market-runtime-test.html?scenario=active');
  const baseline = await expectChartGeometry(chart, marketChartViewports[1].label);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
    window.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => {
    const bounds = await inspectChartGeometry(chart);
    return bounds.timeAxisInterval >= baseline.timeAxisInterval
      && Math.abs(bounds.actualHeight - bounds.declaredHeight) <= 2;
  }).toBe(true);

  const enlarged = await expectChartGeometry(chart, '125% 根字号移动端');
  expectWidthResponsiveAxisChrome(enlarged, '125% 根字号移动端');
  expect(enlarged.timeAxisInterval).toBeGreaterThanOrEqual(baseline.timeAxisInterval);
  expect(pageErrors).toEqual([]);
});
