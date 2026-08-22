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
  await expect(tutorial.locator('[role="progressbar"]')).toHaveAttribute('aria-label', '教程总体进度');
  const progressPrecedesTask = await tutorial.evaluate((element) => {
    const progress = element.querySelector('.game-guide-progress');
    const task = element.querySelector('.game-guide-task');
    return Boolean(
      progress
      && task
      && (progress.compareDocumentPosition(task) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
  });
  expect(progressPrecedesTask).toBe(true);

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

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('确定跳过教程吗？');
    expect(dialog.message()).toContain('设置 → 游戏设置 → 教程');
    expect(dialog.message()).toContain('重新开始教程');
    await dialog.dismiss();
  });
  await tutorial.getByRole('button', { name: '跳过', exact: true }).click();
  await expect(tutorial).toBeVisible();

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

test('mobile tutorial stays shell-owned below the status bar while pages and notifications cover it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');

  const rail = page.locator('.strategic-economic-event-rail');
  const tutorial = rail.locator('.game-guide-strip');
  const statusBar = page.locator('.asset-bar');
  const pageSheet = page.locator('[data-mobile-workspace-sheet-host="true"]');

  await expect(page.locator('.overview-mobile-tutorial')).toHaveCount(0);
  await expect(page.locator('.overview-dashboard-shell .game-guide-strip')).toHaveCount(0);
  await expect(rail).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(rail).toHaveAttribute('data-event-log-visible', 'true');
  await expect(tutorial).toBeVisible();
  await expect(tutorial.locator('[role="progressbar"]')).toHaveAttribute('aria-label', '教程总体进度');
  await expect(rail.locator('.economic-event-log-panel')).toBeHidden();
  await expect(pageSheet).toBeVisible();

  const statusBox = await requireBox(statusBar);
  const railBox = await requireBox(rail);
  expect(railBox.y).toBeGreaterThanOrEqual(statusBox.y + statusBox.height);
  expect(railBox.y - (statusBox.y + statusBox.height)).toBeLessThanOrEqual(16);

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

  const tutorialBox = await requireBox(tutorial);
  const workspaceGutter = await page.locator('.workspace').evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).paddingLeft)
  ));
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(tutorialBox.x).toBeGreaterThanOrEqual(workspaceGutter - 1);
  expect(viewportWidth - tutorialBox.x - tutorialBox.width).toBeGreaterThanOrEqual(workspaceGutter - 1);

  const sheetBox = await requireBox(pageSheet);
  const overlapTop = Math.max(tutorialBox.y, sheetBox.y);
  const overlapBottom = Math.min(tutorialBox.y + tutorialBox.height, sheetBox.y + sheetBox.height);
  expect(overlapBottom - overlapTop).toBeGreaterThan(8);
  const sheetOwnsOverlap = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return Boolean(element?.closest('[data-mobile-workspace-sheet-host="true"]'));
  }, {
    x: tutorialBox.x + tutorialBox.width / 2,
    y: overlapTop + 4,
  });
  expect(sheetOwnsOverlap).toBe(true);

  await page.locator('.notification-center-trigger').click();
  const notificationLayer = page.locator('.notification-panel-layer[data-notification-layer="dialog"]');
  await expect(notificationLayer).toBeVisible();
  await expect(tutorial).toHaveCount(1);

  const notificationBox = await requireBox(notificationLayer);
  const notificationOverlapTop = Math.max(tutorialBox.y, notificationBox.y);
  const notificationOverlapBottom = Math.min(
    tutorialBox.y + tutorialBox.height,
    notificationBox.y + notificationBox.height,
  );
  expect(notificationOverlapBottom - notificationOverlapTop).toBeGreaterThan(8);
  const notificationOwnsOverlap = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return Boolean(element?.closest('.notification-panel-layer'));
  }, {
    x: tutorialBox.x + tutorialBox.width / 2,
    y: notificationOverlapTop + 4,
  });
  expect(notificationOwnsOverlap).toBe(true);

  const layerOrder = await page.evaluate(() => ({
    dialog: Number.parseInt(getComputedStyle(document.querySelector('.workspace-dialog-layer') as HTMLElement).zIndex, 10),
    chrome: Number.parseInt(getComputedStyle(document.querySelector('.signed-in-shell__chrome') as HTMLElement).zIndex, 10),
  }));
  expect(layerOrder.dialog).toBe(3000);
  expect(layerOrder.chrome).toBe(3001);
});
