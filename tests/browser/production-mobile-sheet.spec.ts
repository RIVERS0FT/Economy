import { expect, test } from '@playwright/test';

async function openFirstFacilityDetail(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('production-runtime-test.html?scenario=active');
  await expect(page.getByRole('heading', { name: '生产', exact: true })).toBeVisible();

  const detailButton = page.getByRole('button', { name: '查看详情' });
  if (await detailButton.isVisible()) {
    await detailButton.click();
  } else {
    await page.locator('.facility-cluster-selector-card').first().click();
  }

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('mobile facility sheet keeps single recipe selector enabled and uses one scroll viewport', async ({ page }) => {
  const dialog = await openFirstFacilityDetail(page);
  const selector = dialog.getByRole('combobox', { name: /生产配方/ });
  await expect(selector).toBeVisible();
  await expect(selector).toBeEnabled();

  await expect(dialog.locator('.facility-detail-sheet-scroll-area')).toHaveCount(1);
  await expect(dialog.locator('.facility-detail-sheet-scroll')).toHaveCount(1);
  await expect(dialog.locator('.facility-detail-sheet-footer .facility-market-link')).toBeVisible();
});

test('mobile facility sheet closes after a downward drag from the handle', async ({ page }) => {
  const dialog = await openFirstFacilityDetail(page);
  const handle = dialog.locator('.facility-detail-sheet-drag-handle');
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('facility sheet drag handle has no box');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 180, { steps: 8 });
  await page.mouse.up();

  await expect(dialog).toBeHidden();
});

test('touch scrolling reveals the sheet vertical scrollbar while background rail stays suppressed', async ({ page }) => {
  const dialog = await openFirstFacilityDetail(page);
  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerType: 'touch',
      pointerId: 71,
    }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');

  const scrollRoot = dialog.locator('.facility-detail-sheet-scroll-area');
  const viewport = dialog.locator('.facility-detail-sheet-scroll');
  await viewport.evaluate((element) => {
    element.scrollTop = Math.min(160, element.scrollHeight - element.clientHeight);
  });

  await expect.poll(() => scrollRoot.locator('.ui-scrollbar--vertical').evaluate((element) => (
    getComputedStyle(element).opacity
  ))).toBe('1');
  await expect(page.locator('.page-scroll-area')).toHaveAttribute('data-modal-scrollbar-suppressed', 'true');
  await expect(page.locator('.page-scroll-area > .ui-scrollbar--vertical')).toHaveCSS('pointer-events', 'none');
});
