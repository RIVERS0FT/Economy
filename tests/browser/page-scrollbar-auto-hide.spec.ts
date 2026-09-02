import { expect, test } from '@playwright/test';

test('player page scrollbar hides after idle even while page content stays hovered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const pageScrollArea = page.locator('.page-card-scroll-area');
  const pageScroll = page.locator('.page-card-scroll');
  const verticalRail = pageScrollArea.locator(':scope > .ui-scrollbar--vertical');

  await expect(pageScrollArea).toBeVisible();
  await expect(pageScrollArea).toHaveAttribute('data-scrollbar-visibility', 'adaptive');
  await expect(pageScrollArea).toHaveAttribute('data-scrollbar-reveal-on-hover', 'false');

  const scrollBox = await pageScroll.boundingBox();
  expect(scrollBox).not.toBeNull();
  await page.mouse.move(
    scrollBox!.x + scrollBox!.width / 2,
    scrollBox!.y + Math.min(120, scrollBox!.height / 2),
  );
  expect(await pageScrollArea.evaluate((element) => element.matches(':hover'))).toBe(true);

  await page.waitForTimeout(150);
  await expect(pageScrollArea).not.toHaveAttribute('data-scrollbar-active-y', 'true');
  await expect(verticalRail).toHaveCSS('visibility', 'hidden');

  const before = await pageScroll.evaluate((element) => ({
    scrollTop: element.scrollTop,
    maximum: Math.max(0, element.scrollHeight - element.clientHeight),
  }));
  expect(before.maximum).toBeGreaterThan(0);

  await pageScroll.evaluate((element) => {
    element.scrollTop = Math.min(180, element.scrollHeight - element.clientHeight);
  });
  await expect(pageScrollArea).toHaveAttribute('data-scrollbar-active-y', 'true');
  await expect(verticalRail).toHaveCSS('visibility', 'visible');
  expect(await pageScrollArea.evaluate((element) => element.matches(':hover'))).toBe(true);

  await expect(pageScrollArea).not.toHaveAttribute('data-scrollbar-active-y', 'true', { timeout: 2_500 });
  await expect(verticalRail).toHaveCSS('visibility', 'hidden');
  expect(await pageScrollArea.evaluate((element) => element.matches(':hover'))).toBe(true);
});
