import { expect, test, type Locator, type Page } from '@playwright/test';

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

  test('factory detail page keeps the signed-in overscroll boundary without opening a sheet', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    await trigger.tap();
    const detail = page.locator('.facility-cluster-detail-page');
    const content = page.locator('.page-card-scroll');
    await expect(detail).toBeVisible();
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
    await expect(page.locator('html')).toHaveCSS('overscroll-behavior-y', 'none');
    await content.evaluate((element) => { element.scrollTop = 0; });

    const originalUrl = page.url();
    let topLevelNavigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) topLevelNavigations += 1;
    });

    await swipeDownFromTop(page, content);

    await expect(detail).toBeVisible();
    expect(page.url()).toBe(originalUrl);
    expect(topLevelNavigations).toBe(0);
  });
});