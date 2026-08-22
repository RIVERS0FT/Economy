import { expect, test, type Locator } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test('desktop strategic outliner persists across business and fullscreen pages', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('economy:strategic-outliner:')) localStorage.removeItem(key);
    }
  });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');

  const outliner = page.locator('.strategic-outliner');
  const tutorial = outliner.locator('.game-guide-strip--outliner');
  const eventsSection = outliner.locator('[data-outliner-section="events"]');
  const pinnedSection = outliner.locator('[data-outliner-section="pinned"]');

  await expect(outliner).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(outliner).toHaveAttribute('data-event-log-visible', 'true');
  await expect(tutorial).toBeVisible();
  await expect(tutorial).not.toHaveClass(/\bpanel\b/);
  await expect(tutorial.getByText('步骤 1/9', { exact: true })).toBeVisible();
  await expect(tutorial.locator('[role="progressbar"]')).toHaveAttribute('aria-label', '教程总体进度');
  await expect(eventsSection).toBeVisible();
  await expect(pinnedSection).toBeVisible();

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

  const outlinerStyle = await outliner.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
    };
  });
  expect(outlinerStyle.backdropFilter).toContain('blur(18px)');
  expect(outlinerStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(outlinerStyle.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');

  await outliner.evaluate((element) => element.setAttribute('data-browser-outliner-sentinel', 'persistent'));
  await eventsSection.getByRole('button', { name: /公开经济事件/ }).click();
  await expect(eventsSection).toHaveAttribute('data-collapsed', 'true');

  const contextPin = outliner.locator('.strategic-outliner__context-pin');
  await expect(contextPin).toHaveAttribute('aria-pressed', 'false');
  await contextPin.click();
  await expect(contextPin).toHaveAttribute('aria-pressed', 'true');
  await expect(pinnedSection.locator('.strategic-outliner-row')).toHaveCount(1);

  const fullscreenPages = [
    ['research', '研发'],
    ['auction', '拍卖'],
    ['contracts', '合同'],
    ['bank', '银行'],
    ['leaderboard', '排行'],
    ['gem-shop', '商店'],
  ] as const;
  for (const [tab, label] of fullscreenPages) {
    await page.locator('.desktop-sidebar').getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', tab);
    await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-presentation', 'fullscreen');
    await expect(outliner).toHaveAttribute('data-browser-outliner-sentinel', 'persistent');
    await expect(outliner).toBeVisible();
    await expect(tutorial).toBeVisible();
    await expect(tutorial.getByText('步骤 1/9', { exact: true })).toBeVisible();
    await expect(eventsSection).toHaveAttribute('data-collapsed', 'true');
    await expect(pinnedSection.locator('.strategic-outliner-row')).toHaveCount(1);

    const primaryCardBox = await requireBox(page.locator('.signed-in-shell__primary-card'));
    const outlinerBox = await requireBox(outliner);
    expect(primaryCardBox.x + primaryCardBox.width).toBeLessThanOrEqual(outlinerBox.x - 6);
  }

  await page.locator('.desktop-sidebar').getByRole('button', { name: '建筑', exact: true }).click();
  await expect(outliner).toHaveAttribute('data-browser-outliner-sentinel', 'persistent');
  await expect(eventsSection).toHaveAttribute('data-collapsed', 'true');
  await expect(pinnedSection.locator('.strategic-outliner-row')).toHaveCount(1);

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('确定跳过教程吗？');
    expect(dialog.message()).toContain('设置 → 游戏设置 → 教程');
    expect(dialog.message()).toContain('重新开始教程');
    await dialog.dismiss();
  });
  await tutorial.getByRole('button', { name: '跳过', exact: true }).click();
  await expect(tutorial).toBeVisible();
});

test('desktop strategic outliner collapse and pins persist through reload', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('economy:strategic-outliner:')) localStorage.removeItem(key);
    }
  });
  await page.reload();

  const outliner = page.locator('.strategic-outliner');
  await outliner.locator('.strategic-outliner__context-pin').click();
  await outliner.locator('.strategic-outliner__collapse').click();
  await expect(outliner).toHaveAttribute('data-collapsed', 'true');
  const collapsedBox = await requireBox(outliner);
  expect(collapsedBox.width).toBeCloseTo(44, 0);

  await page.reload();
  await expect(outliner).toHaveAttribute('data-collapsed', 'true');
  const reloadedBox = await requireBox(outliner);
  expect(reloadedBox.width).toBeCloseTo(44, 0);

  await outliner.locator('.strategic-outliner__collapse').click();
  await expect(outliner).toHaveAttribute('data-collapsed', 'false');
  await expect(outliner.locator('[data-outliner-section="pinned"] .strategic-outliner-row')).toHaveCount(1);
});

test('mobile tutorial stays shell-owned inside the shared outliner while pages and notifications cover it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('economy:strategic-outliner:')) localStorage.removeItem(key);
    }
  });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');

  const outliner = page.locator('.strategic-outliner');
  const tutorial = outliner.locator('.game-guide-strip--outliner');
  const statusBar = page.locator('.asset-bar');
  const pageSheet = page.locator('[data-mobile-workspace-sheet-host="true"]');

  await expect(page.locator('.overview-mobile-tutorial')).toHaveCount(0);
  await expect(page.locator('.overview-dashboard-shell .game-guide-strip')).toHaveCount(0);
  await expect(outliner).toHaveAttribute('data-tutorial-visible', 'true');
  await expect(tutorial).toBeVisible();
  await expect(tutorial.locator('[role="progressbar"]')).toHaveAttribute('aria-label', '教程总体进度');
  await expect(outliner.locator('[data-outliner-section="activity"]')).toBeHidden();
  await expect(outliner.locator('[data-outliner-section="pinned"]')).toBeHidden();
  await expect(outliner.locator('[data-outliner-section="events"]')).toBeHidden();
  await expect(pageSheet).toBeVisible();

  const statusBox = await requireBox(statusBar);
  const outlinerBox = await requireBox(outliner);
  expect(outlinerBox.y).toBeGreaterThanOrEqual(statusBox.y + statusBox.height);
  expect(outlinerBox.y - (statusBox.y + statusBox.height)).toBeLessThanOrEqual(16);

  const tutorialStyle = await outliner.evaluate((element) => {
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

  const workspaceGutter = await page.locator('.workspace').evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).paddingLeft)
  ));
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(outlinerBox.x).toBeGreaterThanOrEqual(workspaceGutter - 1);
  expect(viewportWidth - outlinerBox.x - outlinerBox.width).toBeGreaterThanOrEqual(workspaceGutter - 1);

  const sheetBox = await requireBox(pageSheet);
  const overlapTop = Math.max(outlinerBox.y, sheetBox.y);
  const overlapBottom = Math.min(outlinerBox.y + outlinerBox.height, sheetBox.y + sheetBox.height);
  expect(overlapBottom - overlapTop).toBeGreaterThan(8);
  const sheetOwnsOverlap = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return Boolean(element?.closest('[data-mobile-workspace-sheet-host="true"]'));
  }, {
    x: outlinerBox.x + outlinerBox.width / 2,
    y: overlapTop + 4,
  });
  expect(sheetOwnsOverlap).toBe(true);

  await page.locator('.notification-center-trigger').click();
  const notificationLayer = page.locator('.notification-panel-layer[data-notification-layer="dialog"]');
  await expect(notificationLayer).toBeVisible();
  await expect(tutorial).toHaveCount(1);

  const notificationBox = await requireBox(notificationLayer);
  const notificationOverlapTop = Math.max(outlinerBox.y, notificationBox.y);
  const notificationOverlapBottom = Math.min(
    outlinerBox.y + outlinerBox.height,
    notificationBox.y + notificationBox.height,
  );
  expect(notificationOverlapBottom - notificationOverlapTop).toBeGreaterThan(8);
  const notificationOwnsOverlap = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return Boolean(element?.closest('.notification-panel-layer'));
  }, {
    x: outlinerBox.x + outlinerBox.width / 2,
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
