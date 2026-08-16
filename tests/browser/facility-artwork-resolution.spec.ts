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

test('production and market facility artwork use 256px runtime thumbnails', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=production&scenario=facility-card-profit');
  await expectBackgroundImageResolution(
    page.locator('.facility-cluster-selector-card .facility-icon').first(),
    256,
  );

  await page.goto('market-runtime-test.html?scenario=active&view=catalog');
  await page.getByRole('button', { name: '工厂', exact: true }).click();
  const marketFacility = page.getByRole('button', { name: '查看机械工厂详情' });
  await expectBackgroundImageResolution(
    marketFacility.locator('.market-catalog-row__artwork > .facility-icon'),
    256,
  );
});
