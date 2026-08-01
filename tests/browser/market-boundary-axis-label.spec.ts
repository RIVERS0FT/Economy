import { expect, test, type Locator, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

async function inspectBoundaryLabels(chart: Locator) {
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  return chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const svg = wrapper.querySelector<SVGSVGElement>('.economy-chart__canvas svg');
    if (!svg) throw new Error('ECharts SVG is not ready');

    const axisLeft = Number(wrapper.dataset.axisLeft);
    const priceBottom = Number(wrapper.dataset.priceBottom);
    const priceMinLabel = wrapper.dataset.priceMinLabel ?? '';
    const volumeMaxLabel = wrapper.dataset.volumeMaxLabel ?? '';
    if (![axisLeft, priceBottom].every(Number.isFinite) || !priceMinLabel || !volumeMaxLabel) {
      throw new Error('Market boundary label contract is incomplete');
    }

    const boundaryY = wrapperRect.top + priceBottom;
    const axisLabelRight = wrapperRect.left + axisLeft + 4;
    const tickLabelPattern = /^(?:\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?[KMBT])$/;
    const labels = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
      .map((text) => {
        const rect = text.getBoundingClientRect();
        return {
          text: text.textContent?.trim() ?? '',
          top: rect.top,
          bottom: rect.bottom,
          right: rect.right,
          height: rect.height,
        };
      })
      .filter((label) => tickLabelPattern.test(label.text) && label.right <= axisLabelRight)
      .filter((label) => Math.abs((label.top + label.bottom) / 2 - boundaryY) <= Math.max(12, label.height));

    return {
      owner: wrapper.dataset.sharedBoundaryLabelOwner,
      volumeMaxLabelVisible: wrapper.dataset.volumeMaxLabelVisible,
      priceMinLabel,
      volumeMaxLabel,
      boundaryLabels: labels.map((label) => label.text),
      priceMinMatches: labels.filter((label) => label.text === priceMinLabel).length,
      volumeMaxMatches: labels.filter((label) => label.text === volumeMaxLabel).length,
    };
  });
}

async function expectSinglePriceBoundaryLabel(chart: Locator, context: string) {
  const result = await inspectBoundaryLabels(chart);
  expect(result.owner, `${context}共享边界必须归价格轴所有`).toBe('price');
  expect(result.volumeMaxLabelVisible, `${context}成交量最大刻度必须声明为隐藏`).toBe('false');
  expect(result.priceMinLabel, `${context}测试数据必须能区分价格最小值和成交量最大值`).not.toBe(result.volumeMaxLabel);
  expect(result.priceMinMatches, `${context}价格轴最小刻度必须保留`).toBe(1);
  expect(result.volumeMaxMatches, `${context}成交量轴最大刻度不得出现在共享边界`).toBe(0);
  expect(result.boundaryLabels, `${context}共享边界只能存在一项纵轴刻度`).toEqual([result.priceMinLabel]);
}

test('market zero-gap grids give the shared boundary label to the price axis only', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  const viewports = [
    { width: 721, height: 445, label: '问题截图尺寸' },
    { width: 390, height: 844, label: '移动端' },
    { width: 320, height: 700, label: '极窄移动端' },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('market-runtime-test.html?scenario=active');
    await expectSinglePriceBoundaryLabel(page.locator('.market-history-chart.full'), viewport.label);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
    window.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => {
    const result = await inspectBoundaryLabels(page.locator('.market-history-chart.full'));
    return `${result.priceMinMatches}:${result.volumeMaxMatches}:${result.boundaryLabels.length}`;
  }).toBe('1:0:1');
  await expectSinglePriceBoundaryLabel(page.locator('.market-history-chart.full'), '125% 根字号移动端');

  expect(pageErrors).toEqual([]);
});
