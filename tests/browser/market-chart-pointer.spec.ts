import { expect, test, type Locator, type Page } from '@playwright/test';

async function point(chart: Locator, ratio: number, volume = false) {
  return chart.evaluate((element, args) => {
    const el = element as HTMLElement; const r = el.getBoundingClientRect();
    const read = (key: string) => Number(el.dataset[key]);
    return { x: r.x + read('axisLeft') + (r.width - read('axisLeft') - read('axisRight')) * args.ratio,
      y: r.y + (args.volume ? (read('volumeTop') + read('volumeBottom')) / 2 : (read('priceTop') + read('priceBottom')) / 2) };
  }, { ratio, volume });
}
async function pointerLines(chart: Locator) {
  return chart.locator('svg [stroke-dasharray]').evaluateAll((elements) => elements.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, offset: Number(el.getAttribute('stroke-dashoffset') || 0) };
  }).filter((r) => r.width <= 2 && r.height >= 40).sort((a, b) => a.y - b.y));
}
async function expectPointers(chart: Locator) {
  await expect.poll(async () => (await pointerLines(chart)).length).toBe(2);
  const lines = await pointerLines(chart);
  expect(Math.abs(lines[0].x - lines[1].x)).toBeLessThanOrEqual(1);
  expect(Math.abs(lines[0].y + lines[0].height - lines[1].y)).toBeLessThanOrEqual(1);
}
async function expectForegroundTooltip(page: Page) {
  const tooltip = page.locator('.economy-chart-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCount(1);
  const geometry = await tooltip.evaluate((element) => {
    const el = element as HTMLElement; const r = el.getBoundingClientRect();
    const host = el.parentElement!; const safe = host.getBoundingClientRect();
    // The normal tooltip intentionally ignores hit-testing. Temporarily probe only its
    // actual node, never the host, to detect a tooltip painted underneath the Sheet.
    const previous = el.style.getPropertyValue('pointer-events');
    const priority = el.style.getPropertyPriority('pointer-events');
    el.style.setProperty('pointer-events', 'auto', 'important');
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 20));
    const inFront = hit === el || el.contains(hit);
    if (previous) el.style.setProperty('pointer-events', previous, priority); else el.style.removeProperty('pointer-events');
    const status = document.querySelector('.asset-bar')!.getBoundingClientRect();
    return { inFront, host: host.dataset.workspaceTooltipLayer, hostEvents: getComputedStyle(host).pointerEvents,
      top: r.top, bottom: r.bottom, left: r.left, right: r.right, safeTop: safe.top, safeBottom: safe.bottom,
      statusBottom: status.bottom, viewportWidth: window.innerWidth };
  });
  expect(geometry.inFront).toBe(true);
  expect(geometry.host).toBe('true');
  expect(geometry.hostEvents).toBe('none');
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.statusBottom);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
}

for (const width of [320, 390, 960]) {
  test(`linked daily pointers and foreground tooltip at ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('market-runtime-test.html?scenario=active');
    const chart = page.locator('.market-history-chart.full');
    await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
    await chart.scrollIntoViewIfNeeded();
    for (const ratio of [0.03, 0.502, 0.97]) {
      const upper = await point(chart, ratio); await page.mouse.move(upper.x, upper.y);
      await expectForegroundTooltip(page); await expectPointers(chart);
      const date = await page.locator('.economy-chart-tooltip strong').innerText();
      const lower = await point(chart, ratio, true); await page.mouse.move(lower.x, lower.y);
      await expectPointers(chart);
      await expect(page.locator('.economy-chart-tooltip strong')).toHaveText(date);
    }
    await page.mouse.move(4, 4);
    await expect(page.locator('.economy-chart-tooltip')).toBeHidden();
    await expect.poll(async () => (await pointerLines(chart)).length).toBe(0);
    expect(errors).toEqual([]);
  });
}

test.describe('touch market tooltip inside the actual mobile Sheet', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 1000 } });
  test('first tap persists across a refresh and closes both pointers on outside tap or Escape', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=freeze-details');
    const chart = page.locator('.market-history-chart.full');
    const sheet = page.locator('[data-mobile-workspace-sheet-host="true"]');
    await expect(sheet).toBeVisible();
    await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
    await chart.scrollIntoViewIfNeeded();
    const selected = await point(chart, 0.502);
    await page.touchscreen.tap(selected.x, selected.y);
    await expectForegroundTooltip(page); await expectPointers(chart);
    const text = await page.locator('.economy-chart-tooltip').innerText();
    await page.evaluate(() => window.__updateFreezeFixture?.());
    await page.waitForTimeout(6_500);
    await expect(page.locator('.economy-chart-tooltip')).toHaveText(text);
    await expectPointers(chart);
    await page.keyboard.press('Escape');
    await expect(page.locator('.economy-chart-tooltip')).toBeHidden();
    await expect(sheet).toBeVisible();
    await expect.poll(async () => (await pointerLines(chart)).length).toBe(0);
    await page.touchscreen.tap(selected.x, selected.y);
    await expectForegroundTooltip(page);
    await page.locator('.market-detail-product-icon-card').tap();
    await expect(page.locator('.economy-chart-tooltip')).toBeHidden();
    await expect.poll(async () => (await pointerLines(chart)).length).toBe(0);
  });
});
