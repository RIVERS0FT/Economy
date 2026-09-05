import { expect, test, type Locator } from '@playwright/test';

async function expectBackgroundImageResolution(locator: Locator, expectedSize: number) {
  await expect(locator).toBeVisible();
  await expect.poll(() => locator.evaluate((element) => getComputedStyle(element).backgroundImage))
    .not.toBe('none');

  const imageMetadata = await locator.evaluate(async (element) => {
    const backgroundImage = getComputedStyle(element).backgroundImage;
    const match = backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!match) return null;

    const image = new Image();
    image.src = match[1];
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  });

  expect(imageMetadata).toEqual({ width: expectedSize, height: expectedSize });
}

test('building cards and facility details use 256px facility thumbnails without market trade entry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=production&scenario=facility-card-profit');
  await expectBackgroundImageResolution(
    page.locator('.facility-cluster-selector-card .facility-icon').first(),
    256,
  );

  await page.locator('.facility-cluster-selector-card').first().click();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  await expect(page.getByRole('button', { name: /交易该建筑资产/ })).toHaveCount(0);
  await expectBackgroundImageResolution(
    page.locator('.facility-detail-artwork .facility-detail-artwork-icon'),
    256,
  );
});
