import { expect, test, type Page } from '@playwright/test';

async function openEvents(page: Page) {
  await page.goto('runtime-test.html?view=map&scenario=economic-events');
  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-map-ready', 'true');
  await expect(page.locator('[data-economic-event-marker]')).toHaveCount(8);
  await expect.poll(async () => (await page.locator('[data-economic-event-marker="fixture-event-0"]').boundingBox())?.width).toBeCloseTo(44, 0);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`event dialog shares header and 50/50 content at ${viewport.width}px without changing map or page`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openEvents(page);
    const svg = page.locator('.province-map-world-svg');
    await expect(svg).toHaveCount(1);
    await page.locator('.province-map-region[data-province-id="US-TX"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.game-shell .page-fixed-header')).toBeVisible();
    const pageHeader = await page.locator('.game-shell .page-fixed-header').boundingBox();
    await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
    await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
    const originalCamera = await svg.getAttribute('viewBox');
    const marker = page.locator('[data-economic-event-marker="fixture-event-0"]');
    await marker.click();
    const dialog = page.locator('.economic-event-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('data-economic-event-id', 'fixture-event-0');
    const header = await dialog.locator('.page-fixed-header').boundingBox();
    expect(header!.height).toBeCloseTo(pageHeader!.height, 0);
    await expect(dialog.getByRole('button', { name: '关闭事件详情' })).toBeFocused();
    await expect(dialog.locator('.economic-event-dialog__scope')).toHaveText('全国生效');
    const geometry = await dialog.evaluate((element) => {
      const body = element.querySelector('.economic-event-dialog__body')!;
      const art = element.querySelector('.economic-event-dialog__art')!;
      const right = element.querySelector('.economic-event-dialog__scroll')!;
      const content = element.querySelector('.economic-event-dialog__content')!;
      const image = element.querySelector('img')!;
      return { bodyWidth: body.getBoundingClientRect().width, artWidth: art.getBoundingClientRect().width,
        rightWidth: right.getBoundingClientRect().width, imageSource: image.currentSrc,
        columns: getComputedStyle(body).gridTemplateColumns, overflow: content.scrollWidth - content.clientWidth,
        gradient: getComputedStyle(art, '::after').backgroundImage };
    });
    expect(geometry.artWidth).toBeCloseTo(geometry.bodyWidth / 2, 0);
    expect(geometry.rightWidth).toBeCloseTo(geometry.bodyWidth / 2, 0);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.gradient).toContain('linear-gradient');
    await expect.poll(() => dialog.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const headerTop = header!.y;
    await dialog.locator('.economic-event-dialog__content').evaluate((element) => { element.scrollTop = element.scrollHeight; });
    expect(await dialog.locator('.economic-event-dialog__content').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect((await dialog.locator('.page-fixed-header').boundingBox())!.y).toBeCloseTo(headerTop, 0);
    await page.screenshot({ path: testInfo.outputPath(`event-dialog-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(marker).toBeFocused();
    await expect(svg).toHaveAttribute('viewBox', originalCamera!);
    await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
    expect(errors).toEqual([]);
  });
}

test('all template illustrations, public project and outliner open the same current dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEvents(page);
  const sources = new Set<string>();
  for (let index = 0; index < 6; index += 1) {
    const marker = page.locator(`[data-economic-event-marker="fixture-event-${index}"]`);
    await marker.focus();
    await page.keyboard.press('Enter');
    const image = page.locator('.economic-event-dialog img');
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    sources.add(await image.getAttribute('src') || '');
    await page.getByRole('button', { name: '关闭事件详情' }).click();
  }
  expect(sources.size).toBe(6);
  const project = page.locator('[data-economic-event-marker="public-project-event:fixture-project"]');
  await project.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.economic-event-dialog__scope')).toHaveText('得克萨斯 · 全服参与');
  await expect(page.getByRole('heading', { name: '项目进度' })).toBeVisible();
  await page.keyboard.press('Escape');
  const entry = page.locator('.strategic-outliner-event').filter({ hasText: '家居翻新季' });
  await entry.click();
  await expect(page.locator('.economic-event-dialog')).toHaveAttribute('data-economic-event-id', 'fixture-event-2');
  await page.keyboard.press('Escape');
  await expect(entry).toBeFocused();
});

test('map markers retain real anchors and screen-sized hits after zoom; no per-second raster invalidation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEvents(page);
  const viewport = page.locator('.province-map-static-viewport');
  await expect(viewport).toHaveAttribute('data-map-raster-ready', 'true');
  const marker = page.locator('[data-economic-event-marker="fixture-event-0"]');
  const anchor = await marker.getAttribute('data-anchor-x');
  const before = await marker.boundingBox();
  await page.mouse.move(before!.x, before!.y);
  await page.mouse.wheel(0, -260);
  await expect(viewport).toHaveAttribute('data-map-zoom-active', 'false');
  await expect.poll(async () => (await marker.boundingBox())?.width).toBeCloseTo(44, 0);
  await expect(marker).toHaveAttribute('data-anchor-x', anchor!);
  await expect(viewport).toHaveAttribute('data-map-raster-ready', 'true');
  const revision = await viewport.getAttribute('data-map-raster-revision');
  await page.waitForTimeout(2100);
  await expect(viewport).toHaveAttribute('data-map-raster-revision', revision!);
  await marker.click();
  await expect(page.locator('.economic-event-dialog')).toBeVisible();
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
});

test('expiry and missing authority update the open detail without stale map points or page navigation', async ({ page }) => {
  await page.clock.install();
  await openEvents(page);
  await page.evaluate(async () => {
    // The isolated fixture has no HTTP state read to establish the server clock.
    const { acceptServerNow } = await import(new URL('./src/utils/serverClock.js', location.href).href);
    acceptServerNow(Date.now());
    (window as any).__setEconomicEventCalendar((calendar: any) => ({ ...calendar, events: calendar.events.map((event: any) => event.id === 'fixture-event-0' ? { ...event, endsAt: Date.now() + 60_000 } : event) }));
  });
  await page.locator('[data-economic-event-marker="fixture-event-0"]').click();
  await page.clock.fastForward(61_000);
  await expect(page.locator('[data-economic-event-marker="fixture-event-0"]')).toHaveCount(0);
  await expect(page.locator('.economic-event-dialog__copy')).toHaveAttribute('data-event-phase', 'completed');
  await page.evaluate(() => {
    (window as any).__setEconomicEventCalendar((calendar: any) => ({ ...calendar, events: calendar.events.filter((event: any) => event.id !== 'fixture-event-0') }));
  });
  await expect(page.locator('.economic-event-dialog')).toContainText('该事件已不在当前公开日历中');
  await page.keyboard.press('Escape');
  await expect(page.locator('.economic-event-dialog')).toHaveCount(0);
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
});
