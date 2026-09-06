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
  test(`market date labels stay horizontal on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('market-runtime-test.html?scenario=active');

    const chart = page.locator('.market-history-chart.full');
    await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');

    const rotations = await chart.locator('.economy-chart__canvas svg text').evaluateAll((nodes) => nodes
      .filter((node) => /^\d{2}\/\d{2}$/.test(node.textContent?.trim() ?? ''))
      .map((node) => {
        const matrix = (node as SVGGraphicsElement).getCTM();
        if (!matrix) return Number.NaN;
        return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      }));

    expect(rotations.length).toBeGreaterThanOrEqual(2);
    for (const rotation of rotations) {
      expect(Number.isFinite(rotation)).toBe(true);
      expect(Math.abs(rotation)).toBeLessThan(0.5);
    }
  });
}
