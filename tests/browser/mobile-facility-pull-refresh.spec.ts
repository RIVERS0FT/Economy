import { expect, test, type Locator, type Page } from '@playwright/test';

async function waitForSheetAnimations(dialog: Locator) {
  await expect.poll(() => dialog.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
}

async function swipeDownFromTop(page: Page, surface: Locator, distance = 180) {
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const startY = box!.y + 4;
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

test.describe('mobile facility pull-to-refresh prevention', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('top content swipe closes the sheet and cancels browser overscroll', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    const content = page.locator('.facility-detail-sheet-scroll');
    await trigger.tap();
    await expect(dialog).toBeVisible();
    await waitForSheetAnimations(dialog);
    await expect(page.locator('html')).toHaveCSS('overscroll-behavior-y', 'none');
    await content.evaluate((element) => { element.scrollTop = 0; });

    await page.evaluate(() => {
      const browserWindow = window as Window & {
        __facilityTouchMovePrevented?: boolean;
      };
      browserWindow.__facilityTouchMovePrevented = false;
      document.addEventListener('touchmove', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.facility-detail-sheet')) {
          browserWindow.__facilityTouchMovePrevented ||= event.defaultPrevented;
        }
      });
    });

    const originalUrl = page.url();
    let topLevelNavigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) topLevelNavigations += 1;
    });

    await swipeDownFromTop(page, content);

    await expect.poll(() => page.evaluate(() => (
      (window as Window & { __facilityTouchMovePrevented?: boolean }).__facilityTouchMovePrevented
    ))).toBe(true);
    await expect(dialog).toBeHidden();
    expect(page.url()).toBe(originalUrl);
    expect(topLevelNavigations).toBe(0);
  });
});
