import { expect, test, type Locator, type Page } from '@playwright/test';

type RowMetrics = {
  minHeight: string;
  height: number;
  slot: [number, number];
  artwork: [number, number];
};

async function readRowMetrics(row: Locator, slotSelector: string): Promise<RowMetrics> {
  return row.evaluate((element, selector) => {
    const rowElement = element as HTMLElement;
    const slot = rowElement.querySelector<HTMLElement>(selector);
    const artwork = slot?.querySelector<HTMLElement>('.product-artwork');
    if (!slot || !artwork) throw new Error(`missing commodity artwork for ${selector}`);
    const rowRect = rowElement.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const artworkRect = artwork.getBoundingClientRect();
    return {
      minHeight: getComputedStyle(rowElement).minHeight,
      height: Math.round(rowRect.height),
      slot: [Math.round(slotRect.width), Math.round(slotRect.height)] as [number, number],
      artwork: [Math.round(artworkRect.width), Math.round(artworkRect.height)] as [number, number],
    };
  }, slotSelector);
}

function expectAllowedDensity(metrics: RowMetrics) {
  expect(metrics.slot[0]).toBe(metrics.slot[1]);
  expect(metrics.artwork[0]).toBe(metrics.artwork[1]);
  const expected = {
    '50px': { slot: [36, 36], artwork: [32, 32] },
    '46px': { slot: [32, 32], artwork: [28, 28] },
    '44px': { slot: [30, 30], artwork: [26, 26] },
  } as const;
  expect(Object.keys(expected)).toContain(metrics.minHeight);
  const density = expected[metrics.minHeight as keyof typeof expected];
  expect(metrics.slot).toEqual(density.slot);
  expect(metrics.artwork).toEqual(density.artwork);
  expect(metrics.height).toBeGreaterThanOrEqual(Number.parseInt(metrics.minHeight, 10));
  expect(metrics.height).toBeLessThanOrEqual(52);
}

async function openMarketFromVisibleNavigation(page: Page) {
  const candidates = page.getByRole('button', { name: /^市场/ });
  for (let index = 0; index < await candidates.count(); index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }
  throw new Error('no visible market navigation button');
}

test('market and regional commodity lists share compact square artwork geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('?preview=game');
  await openMarketFromVisibleNavigation(page);
  const globalRow = page.getByRole('button', { name: '打开小麦全局详情' });
  await expect(globalRow).toBeVisible();
  expectAllowedDensity(await readRowMetrics(globalRow, '.global-market-goods-row__artwork'));

  await page.goto('market-runtime-test.html?scenario=active&view=catalog');
  const regionalRow = page.getByRole('button', { name: '查看小麦详情' });
  await expect(regionalRow).toBeVisible();
  expectAllowedDensity(await readRowMetrics(regionalRow, '.market-commodity-row__artwork'));

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('?preview=game');
  await openMarketFromVisibleNavigation(page);
  const compactGlobalRow = page.getByRole('button', { name: '打开小麦全局详情' });
  await expect(compactGlobalRow).toBeVisible();
  const compactGlobal = await readRowMetrics(compactGlobalRow, '.global-market-goods-row__artwork');
  expectAllowedDensity(compactGlobal);
  expect(compactGlobal.minHeight).toBe('44px');
  expect(compactGlobal.slot).toEqual([30, 30]);
  expect(compactGlobal.artwork).toEqual([26, 26]);

  await page.goto('market-runtime-test.html?scenario=active&view=catalog');
  const compactRegionalRow = page.getByRole('button', { name: '查看小麦详情' });
  await expect(compactRegionalRow).toBeVisible();
  const compactRegional = await readRowMetrics(compactRegionalRow, '.market-commodity-row__artwork');
  expectAllowedDensity(compactRegional);
  expect(compactRegional).toEqual(compactGlobal);
});
