import { expect, test } from '@playwright/test';

test('market detail loading uses the unavailable placeholder without mounting a chart', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    let activeFetch = nativeFetch;
    let releaseGate!: () => void;
    const marketDetailGate = new Promise<void>((resolve) => { releaseGate = resolve; });

    Object.defineProperty(window, 'fetch', {
      configurable: true,
      get() { return activeFetch; },
      set(nextFetch: typeof window.fetch) {
        activeFetch = async (input, init) => {
          const requestUrl = new URL(
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
            window.location.href,
          );
          if (requestUrl.pathname === '/economy-api/game/market-detail') await marketDetailGate;
          return nextFetch(input, init);
        };
      },
    });

    (window as typeof window & { __releaseMarketDetailGate?: () => void }).__releaseMarketDetailGate = releaseGate;
  });

  await page.goto('market-runtime-test.html?scenario=active');
  const chartCard = page.locator('.market-chart-card');
  const chartContent = chartCard.locator('.market-chart-card__content');

  await expect(chartCard.getByText('正在加载当前市场行情…', { exact: true })).toBeVisible();
  await expect(chartCard).toHaveClass(/is-unavailable/);
  await expect(chartContent).toHaveAttribute('aria-disabled', 'true');
  await expect(chartCard.locator('.market-history-chart')).toHaveCount(0);
  await expect(chartCard.locator('.economy-chart')).toHaveCount(0);

  await page.evaluate(() => {
    (window as typeof window & { __releaseMarketDetailGate?: () => void }).__releaseMarketDetailGate?.();
  });

  await expect(chartCard.getByText('正在加载当前市场行情…', { exact: true })).toHaveCount(0);
  await expect(chartCard.locator('.market-history-chart.full')).toBeVisible();
  await expect(chartCard.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  await expect(chartContent).not.toHaveAttribute('aria-disabled', 'true');
});

for (const viewport of [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 390, height: 844, label: 'mobile' },
] as const) {
  test(`market date labels stay horizontal, unclipped and compact on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('market-runtime-test.html?scenario=active');

    const chartCard = page.locator('.market-chart-card');
    const chart = chartCard.locator('.market-history-chart.full');
    await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');

    const inspection = await chart.evaluate((element) => {
      const wrapper = element as HTMLElement;
      const svg = wrapper.querySelector<SVGSVGElement>('.economy-chart__canvas svg');
      if (!svg) throw new Error('market chart svg is missing');
      const canvasRect = svg.getBoundingClientRect();
      const dateLabels = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
        .filter((node) => /^\d{2}\/\d{2}$/.test(node.textContent?.trim() ?? ''))
        .map((node) => {
          const matrix = node.getCTM();
          const rect = node.getBoundingClientRect();
          return {
            text: node.textContent?.trim() ?? '',
            left: rect.left,
            right: rect.right,
            rotation: matrix ? Math.atan2(matrix.b, matrix.a) * 180 / Math.PI : Number.NaN,
          };
        })
        .sort((left, right) => left.left - right.left);
      return {
        canvasLeft: canvasRect.left,
        canvasRight: canvasRect.right,
        dateLabels,
        timeLabelHeight: Number(wrapper.dataset.timeLabelHeight),
      };
    });

    expect(inspection.dateLabels.length).toBeGreaterThanOrEqual(2);
    for (const label of inspection.dateLabels) {
      expect(Number.isFinite(label.rotation)).toBe(true);
      expect(Math.abs(label.rotation)).toBeLessThan(0.5);
    }
    const firstLabel = inspection.dateLabels[0];
    const lastLabel = inspection.dateLabels[inspection.dateLabels.length - 1];
    expect(firstLabel.left).toBeGreaterThanOrEqual(inspection.canvasLeft + 0.5);
    expect(lastLabel.right).toBeLessThanOrEqual(inspection.canvasRight - 0.5);
    expect(inspection.timeLabelHeight).toBeLessThanOrEqual(32);

    const cardInsets = await chartCard.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(Number.parseFloat);
    });
    expect(Math.max(...cardInsets) - Math.min(...cardInsets)).toBeLessThanOrEqual(0.5);
  });
}
