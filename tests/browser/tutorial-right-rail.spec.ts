import { expect, test, type Locator } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test('desktop tutorial stays in the right rail across business pages and keeps frosted glass', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');

  const rail = page.locator('.strategic-economic-event-rail');
  const tutorial = rail.locator('.game-guide-strip');
  await expect(rail).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(rail).toHaveAttribute('data-event-log-visible', 'true');
  await expect(tutorial).toBeVisible();
  await expect(tutorial).toHaveClass(/\bpanel\b/);
  await expect(tutorial.getByText('教程', { exact: true })).toBeVisible();
  await expect(tutorial.locator('[role="progressbar"]')).toHaveAttribute('aria-label', '教程进度');
  const tutorialStyle = await tutorial.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
    };
  });
  expect(tutorialStyle.backdropFilter).toContain('blur(18px)');
  expect(tutorialStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(tutorialStyle.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');

  await page.locator('.desktop-sidebar').getByRole('button', { name: '研发', exact: true }).click();
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'research');
  await expect(rail).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(rail).toHaveAttribute('data-event-log-visible', 'false');
  await expect(tutorial).toBeVisible();
  await expect(rail.locator('.economic-event-log-panel')).toHaveCount(0);

  const primaryCardBox = await requireBox(page.locator('.signed-in-shell__primary-card'));
  const railBox = await requireBox(rail);
  expect(primaryCardBox.x + primaryCardBox.width).toBeLessThanOrEqual(railBox.x - 6);

  await page.locator('.desktop-sidebar').getByRole('button', { name: '合同', exact: true }).click();
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'contracts');
  await expect(rail).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(rail).toHaveAttribute('data-event-log-visible', 'false');
  await expect(tutorial).toBeVisible();
});

test('mobile keeps the overview tutorial entry while the desktop right rail stays hidden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');

  const rail = page.locator('.strategic-economic-event-rail');
  await expect(rail).toBeHidden();
  await expect(page.locator('.overview-mobile-tutorial .game-guide-strip')).toBeVisible();
  await expect(page.locator('.overview-mobile-tutorial').getByText('教程', { exact: true })).toBeVisible();
});
