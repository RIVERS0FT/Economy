import { expect, test, type Locator } from '@playwright/test';

type HeightSample = {
  chartHeight: number;
  cardHeight: number;
  minimumHeight: number;
};

async function sampleAnimationFrames(chart: Locator): Promise<HeightSample[]> {
  return chart.evaluate(async (element) => {
    const samples: HeightSample[] = [];
    for (let frame = 0; frame < 120; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const chartCard = element.closest<HTMLElement>('.market-chart-card');
      if (!chartCard) throw new Error('Market chart card is missing');
      samples.push({
        chartHeight: element.getBoundingClientRect().height,
        cardHeight: chartCard.getBoundingClientRect().height,
        minimumHeight: Number((element as HTMLElement).dataset.chartMinimumHeight ?? 0),
      });
    }
    return samples;
  });
}

async function sampleStabilityFrames(chart: Locator): Promise<HeightSample[]> {
  return chart.evaluate(async (element) => {
    const samples: HeightSample[] = [];
    for (let frame = 0; frame < 16; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const chartCard = element.closest<HTMLElement>('.market-chart-card');
      if (!chartCard) throw new Error('Market chart card is missing');
      samples.push({
        chartHeight: element.getBoundingClientRect().height,
        cardHeight: chartCard.getBoundingClientRect().height,
        minimumHeight: Number((element as HTMLElement).dataset.chartMinimumHeight ?? 0),
      });
    }
    return samples;
  });
}

function range(samples: HeightSample[], field: keyof HeightSample) {
  const values = samples.map((sample) => sample[field]);
  return Math.max(...values) - Math.min(...values);
}

async function waitForStableGeometry(chart: Locator) {
  await expect.poll(async () => {
    const samples = await sampleStabilityFrames(chart);
    return Math.max(
      range(samples, 'chartHeight'),
      range(samples, 'cardHeight'),
      range(samples, 'minimumHeight'),
    );
  }, { timeout: 5_000 }).toBeLessThanOrEqual(1);
}

test('market chart row fill height remains stable without resize feedback', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');

  // The production market page is intentionally a one-third strategic card. Temporarily widen only
  // the test host so this regression still exercises the chart's real side-by-side row-fill path.
  // The production DOM now puts the chart before trading, so both cards must explicitly share row 1;
  // otherwise CSS Grid auto-placement can put the later trade card on row 2 despite fixed columns.
  const wideLayout = await page.addStyleTag({
    content: `
      .game-shell .signed-in-shell__primary-card { width: 100vw !important; }
      .market-page-surface .unified-market-grid {
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) !important;
      }
      .market-page-surface .unified-market-grid > .market-trade-card {
        grid-column: 1 !important;
        grid-row: 1 !important;
      }
      .market-page-surface .unified-market-grid > .market-chart-card {
        grid-column: 2 !important;
        grid-row: 1 !important;
      }
      .market-page-surface .unified-market-grid > .market-account-panel { grid-column: 1 / -1 !important; }
    `,
  });
  await expect(chart).toHaveAttribute('data-chart-fill-mode', 'row');
  await waitForStableGeometry(chart);

  const rowSamples = await sampleAnimationFrames(chart);
  expect(range(rowSamples, 'chartHeight')).toBeLessThanOrEqual(1);
  expect(range(rowSamples, 'cardHeight')).toBeLessThanOrEqual(1);
  expect(range(rowSamples, 'minimumHeight')).toBeLessThanOrEqual(1);
  const stableRowHeight = rowSamples.at(-1)?.chartHeight ?? 0;

  await page.waitForTimeout(6_500);
  const postPollSamples = await sampleAnimationFrames(chart);
  expect(range(postPollSamples, 'chartHeight')).toBeLessThanOrEqual(1);
  expect(range(postPollSamples, 'cardHeight')).toBeLessThanOrEqual(1);
  expect(range(postPollSamples, 'minimumHeight')).toBeLessThanOrEqual(1);
  expect(Math.abs((postPollSamples.at(-1)?.chartHeight ?? 0) - stableRowHeight)).toBeLessThanOrEqual(1);

  await wideLayout.evaluate((element) => element.remove());
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(chart).toHaveAttribute('data-chart-fill-mode', 'natural');
  await waitForStableGeometry(chart);

  const naturalSamples = await sampleAnimationFrames(chart);
  expect(range(naturalSamples, 'chartHeight')).toBeLessThanOrEqual(1);
  expect(range(naturalSamples, 'cardHeight')).toBeLessThanOrEqual(1);
  expect(range(naturalSamples, 'minimumHeight')).toBeLessThanOrEqual(1);
  expect(naturalSamples.at(-1)?.minimumHeight).toBe(0);
});
