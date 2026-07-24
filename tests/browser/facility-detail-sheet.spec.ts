import { expect, test, type Locator, type Page } from '@playwright/test';

async function waitForSheetAnimations(dialog: Locator) {
  await expect.poll(() => dialog.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
}

async function swipeDown(page: Page, handle: Locator, distance = 180) {
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY }],
  });
  for (const offset of [24, 64, 112, distance]) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY + offset }],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

test.describe('mobile facility detail sheet close lifecycle', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('backdrop touch closes after every reopen and restores focus and page scrolling', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    const pageScroll = page.locator('.page-scroll');

    await expect(trigger).toBeVisible();

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await trigger.tap();
      await expect(dialog).toBeVisible();
      await expect(pageScroll).toHaveCSS('overflow-y', 'hidden');
      await waitForSheetAnimations(dialog);

      const sheetBox = await dialog.boundingBox();
      expect(sheetBox).not.toBeNull();
      expect(sheetBox!.y).toBeGreaterThan(8);
      expect(sheetBox!.y).toBeLessThan(844);
      await page.touchscreen.tap(sheetBox!.x + sheetBox!.width / 2, Math.max(8, sheetBox!.y / 2));

      await expect(dialog).toBeHidden();
      await expect(pageScroll).toHaveCSS('overflow-y', 'auto');
      await expect(trigger).toBeFocused();
    }
  });

  test('swipe close restores the touch surface visual while preserving semantic focus', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    const handle = page.locator('.facility-detail-sheet-drag-handle');
    const pageScroll = page.locator('.page-scroll');
    await page.mouse.move(1, 1);

    const baseVisual = await trigger.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.background,
        borderColor: style.borderColor,
      };
    });

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await trigger.tap();
      await expect(dialog).toBeVisible();
      await waitForSheetAnimations(dialog);
      await swipeDown(page, handle);

      await expect(dialog).toBeHidden();
      await expect(pageScroll).toHaveCSS('overflow-y', 'auto');
      await expect(trigger).toBeFocused();
      await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'touch');

      const closedVisual = await trigger.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
background: style.background,
borderColor: style.borderColor,
transform: style.transform,
outlineStyle: style.outlineStyle,
boxShadow: style.boxShadow,
        };
      });
      expect(closedVisual.background).toBe(baseVisual.background);
      expect(closedVisual.borderColor).toBe(baseVisual.borderColor);
      expect(closedVisual.transform).toBe('none');
      expect(closedVisual.outlineStyle).toBe('none');
      expect(closedVisual.boxShadow).toBe('none');
    }
  });

  test('keyboard escape keeps the returned trigger focus visibly accessible', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await waitForSheetAnimations(dialog);
    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'keyboard');
    const focusVisual = await trigger.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(focusVisual.outlineStyle).toBe('solid');
    expect(focusVisual.outlineWidth).toBe('2px');
    expect(focusVisual.boxShadow).not.toBe('none');
  });
});
