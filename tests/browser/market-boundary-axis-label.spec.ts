import { expect, test, type Locator, type Page } from '@playwright/test';

const marketBoundaryViewports = [
  { width: 721, height: 445, label: '问题截图尺寸' },
  { width: 390, height: 844, label: '移动端' },
  { width: 320, height: 700, label: '极窄移动端' },
] as const;

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

async function inspectEdgeLabels(chart: Locator) {
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  return chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const svg = wrapper.querySelector<SVGSVGElement>('.economy-chart__canvas svg');
    if (!svg) throw new Error('ECharts SVG is not ready');

    const axisLeft = Number(wrapper.dataset.axisLeft);
    const priceTop = Number(wrapper.dataset.priceTop);
    const priceBottom = Number(wrapper.dataset.priceBottom);
    const volumeTop = Number(wrapper.dataset.volumeTop);
    const volumeBottom = Number(wrapper.dataset.volumeBottom);
    const priceMaxLabel = wrapper.dataset.priceMaxLabel ?? '';
    const priceMinLabel = wrapper.dataset.priceMinLabel ?? '';
    const volumeMaxLabel = wrapper.dataset.volumeMaxLabel ?? '';
    const volumeMinLabel = wrapper.dataset.volumeMinLabel ?? '';
    if (![axisLeft, priceTop, priceBottom, volumeTop, volumeBottom].every(Number.isFinite)
      || !priceMaxLabel || !priceMinLabel || !volumeMaxLabel || !volumeMinLabel) {
      throw new Error('Market edge label contract is incomplete');
    }

    const plotLeft = wrapperRect.left + axisLeft;
    const edges = {
      priceTop: wrapperRect.top + priceTop,
      priceBottom: wrapperRect.top + priceBottom,
      volumeTop: wrapperRect.top + volumeTop,
      volumeBottom: wrapperRect.top + volumeBottom,
    };
    const tickLabelPattern = /^(?:\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?[KMBT])$/;
    const labels = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
      .map((text) => {
        const rect = text.getBoundingClientRect();
        return {
          text: text.textContent?.trim() ?? '',
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
        };
      })
      .filter((label) => tickLabelPattern.test(label.text));

    const nearest = (
      text: string,
      boundary: number,
      edge: 'top' | 'bottom',
      rangeTop: number,
      rangeBottom: number,
    ) => labels
      .filter((label) => label.text === text && label.bottom >= rangeTop - 2 && label.top <= rangeBottom + 2)
      .map((label) => ({ ...label, delta: Math.abs(label[edge] - boundary) }))
      .sort((left, right) => left.delta - right.delta)[0] ?? null;

    const priceMax = nearest(priceMaxLabel, edges.priceTop, 'top', edges.priceTop, edges.priceBottom);
    const priceMin = nearest(priceMinLabel, edges.priceBottom, 'bottom', edges.priceTop, edges.priceBottom);
    const volumeMax = nearest(volumeMaxLabel, edges.volumeTop, 'top', edges.volumeTop, edges.volumeBottom);
    const volumeMin = nearest(volumeMinLabel, edges.volumeBottom, 'bottom', edges.volumeTop, edges.volumeBottom);

    return {
      layout: wrapper.dataset.sharedBoundaryLabelLayout,
      edgeAligned: wrapper.dataset.yAxisEdgeLabelsAligned,
      yAxisLabelsInside: wrapper.dataset.yAxisLabelsInside,
      volumeMaxLabelVisible: wrapper.dataset.volumeMaxLabelVisible,
      plotLeft,
      edges,
      priceMax,
      priceMin,
      volumeMax,
      volumeMin,
    };
  });
}

async function expectEdgeAlignedLabels(chart: Locator, context: string) {
  const result = await inspectEdgeLabels(chart);
  expect(result.layout, `${context}共享边界应拆分到上下两个分区`).toBe('split-edge');
  expect(result.edgeAligned, `${context}纵轴端点刻度必须声明为贴边对齐`).toBe('true');
  expect(result.yAxisLabelsInside, `${context}纵轴刻度必须位于绘图区内部`).toBe('true');
  expect(result.volumeMaxLabelVisible, `${context}成交量顶端刻度必须显示`).toBe('true');

  for (const [name, label] of Object.entries({
    priceMax: result.priceMax,
    priceMin: result.priceMin,
    volumeMax: result.volumeMax,
    volumeMin: result.volumeMin,
  })) {
    expect(label, `${context} ${name} 端点刻度缺失`).not.toBeNull();
    expect(label!.delta, `${context} ${name} 必须与对应 Grid 边缘对齐`).toBeLessThanOrEqual(4);
    expect(label!.left, `${context} ${name} 必须位于 Grid 内部`).toBeGreaterThanOrEqual(result.plotLeft - 1);
  }

  expect(result.priceMax!.top, `${context}价格顶端刻度不得越出价格区`).toBeGreaterThanOrEqual(result.edges.priceTop - 1);
  expect(result.priceMin!.bottom, `${context}价格底端刻度不得越出价格区`).toBeLessThanOrEqual(result.edges.priceBottom + 1);
  expect(result.volumeMax!.top, `${context}成交量顶端刻度不得越出成交量区`).toBeGreaterThanOrEqual(result.edges.volumeTop - 1);
  expect(result.volumeMin!.bottom, `${context}成交量底端刻度不得越出成交量区`).toBeLessThanOrEqual(result.edges.volumeBottom + 1);
  expect(result.priceMin!.bottom, `${context}共享边界两侧文字不得重叠`).toBeLessThanOrEqual(result.volumeMax!.top + 1);
}

for (const viewport of marketBoundaryViewports) {
  test(`market y-axis endpoint labels align to grid edges at ${viewport.label}`, async ({ page }) => {
    const pageErrors = await capturePageErrors(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('market-runtime-test.html?scenario=active');
    await expectEdgeAlignedLabels(page.locator('.market-history-chart.full'), viewport.label);
    expect(pageErrors).toEqual([]);
  });
}

test('market y-axis endpoint labels stay edge-aligned at 125% root font', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
    window.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => {
    const result = await inspectEdgeLabels(page.locator('.market-history-chart.full'));
    return `${result.layout}:${result.edgeAligned}:${result.volumeMaxLabelVisible}:${result.yAxisLabelsInside}`;
  }).toBe('split-edge:true:true:true');
  await expectEdgeAlignedLabels(page.locator('.market-history-chart.full'), '125% 根字号移动端');
  expect(pageErrors).toEqual([]);
});
