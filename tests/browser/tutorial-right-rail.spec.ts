import { expect, test, type Locator } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test('desktop tutorial shares one animated overlay rail with public events and fullscreen content', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');

  const rail = page.locator('.strategic-right-rail');
  const tutorial = rail.locator(':scope > .game-guide-strip');
  const eventLog = rail.locator(':scope > .economic-event-log-panel');
  await expect(rail).toHaveClass(/\bstrategic-economic-event-rail\b/);
  await expect(rail).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(rail).toHaveAttribute('data-event-log-visible', 'true');
  await expect(tutorial).toBeVisible();
  await expect(eventLog).toBeVisible();
  await expect(tutorial).toHaveClass(/\bpanel\b/);
  await expect(tutorial.getByText('教程', { exact: true })).toBeVisible();
  await expect(tutorial.locator('[role="progressbar"]')).toHaveAttribute('aria-label', '教程进度');

  const styles = await rail.evaluate((element) => {
    const railStyle = getComputedStyle(element);
    const tutorialStyle = getComputedStyle(element.querySelector('.game-guide-strip')!);
    return {
      animationName: railStyle.animationName,
      animationDuration: railStyle.animationDuration,
      backdropFilter: tutorialStyle.backdropFilter,
      backgroundColor: tutorialStyle.backgroundColor,
      borderTopColor: tutorialStyle.borderTopColor,
    };
  });
  expect(styles.animationName).toBe('strategic-right-rail-enter');
  expect(styles.animationDuration).toBe('0.22s');
  expect(styles.backdropFilter).toContain('blur(18px)');
  expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(styles.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');

  await page.waitForTimeout(260);
  await rail.evaluate((element) => {
    const target = window as typeof window & {
      __strategicRightRailNode?: Element;
      __strategicRightRailAnimationStarts?: number;
    };
    target.__strategicRightRailNode = element;
    target.__strategicRightRailAnimationStarts = 0;
    element.addEventListener('animationstart', () => {
      target.__strategicRightRailAnimationStarts = (target.__strategicRightRailAnimationStarts ?? 0) + 1;
    });
  });

  await page.locator('.desktop-sidebar').getByRole('button', { name: '研发', exact: true }).click();
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'research');
  await expect(rail).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(rail).toHaveAttribute('data-event-log-visible', 'false');
  await expect(tutorial).toBeVisible();
  await expect(eventLog).toHaveCount(0);

  const sameRailNode = await page.evaluate(() => (
    document.querySelector('.strategic-right-rail')
    === (window as typeof window & { __strategicRightRailNode?: Element }).__strategicRightRailNode
  ));
  expect(sameRailNode).toBe(true);
  await page.waitForTimeout(260);
  expect(await page.evaluate(() => (
    (window as typeof window & { __strategicRightRailAnimationStarts?: number }).__strategicRightRailAnimationStarts
  ))).toBe(0);

  const primaryCardBox = await requireBox(page.locator('.signed-in-shell__primary-card'));
  const railBox = await requireBox(rail);
  expect(primaryCardBox.x + primaryCardBox.width).toBeGreaterThan(railBox.x + 1);
  expect(Math.abs(
    (primaryCardBox.x + primaryCardBox.width) - (railBox.x + railBox.width),
  )).toBeLessThanOrEqual(2);

  await page.locator('.desktop-sidebar').getByRole('button', { name: '合同', exact: true }).click();
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'contracts');
  await expect(rail).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(rail).toHaveAttribute('data-event-log-visible', 'false');
  await expect(tutorial).toBeVisible();
  expect(await page.evaluate(() => (
    (window as typeof window & { __strategicRightRailAnimationStarts?: number }).__strategicRightRailAnimationStarts
  ))).toBe(0);
});

test('reduced motion disables the desktop right rail entrance animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');

  const rail = page.locator('.strategic-right-rail');
  await expect(rail).toBeVisible();
  await expect(rail).toHaveCSS('animation-name', 'none');
});

test('mobile keeps the overview tutorial entry while the desktop right rail stays hidden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');

  const rail = page.locator('.strategic-right-rail');
  await expect(rail).toBeHidden();
  await expect(page.locator('.overview-mobile-tutorial .game-guide-strip')).toBeVisible();
  await expect(page.locator('.overview-mobile-tutorial').getByText('教程', { exact: true })).toBeVisible();
});
