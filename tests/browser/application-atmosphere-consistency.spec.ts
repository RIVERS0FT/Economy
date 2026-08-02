import { expect, test, type Page } from '@playwright/test';

type BackdropVariant = 'auth' | 'game' | 'admin';

type AtmosphereSnapshot = {
  imageFilter: string;
  atmosphereBackground: string;
  gridOpacity: string;
  gridBackground: string;
  gridMask: string;
  noiseOpacity: string;
  noiseBackground: string;
  noiseBlendMode: string;
};

async function atmosphereSnapshot(page: Page, variant: BackdropVariant): Promise<AtmosphereSnapshot> {
  await page.evaluate((nextVariant) => {
    document.documentElement.dataset.appBackdrop = nextVariant;
    document.documentElement.dataset.appTone = 'normal';
  }, variant);

  return page.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>('.application-image-layer img');
    const atmosphere = document.querySelector<HTMLElement>('.application-atmosphere-layer');
    if (!image || !atmosphere) throw new Error('persistent application atmosphere is missing');
    const atmosphereStyle = getComputedStyle(atmosphere);
    const gridStyle = getComputedStyle(atmosphere, '::before');
    const noiseStyle = getComputedStyle(atmosphere, '::after');
    return {
      imageFilter: getComputedStyle(image).filter,
      atmosphereBackground: atmosphereStyle.backgroundImage,
      gridOpacity: gridStyle.opacity,
      gridBackground: gridStyle.backgroundImage,
      gridMask: gridStyle.maskImage,
      noiseOpacity: noiseStyle.opacity,
      noiseBackground: noiseStyle.backgroundImage,
      noiseBlendMode: noiseStyle.mixBlendMode,
    };
  });
}

async function expectUnifiedAtmosphere(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto('runtime-test.html');
  await expect(page.locator('.application-image-layer')).toHaveCount(1);
  await expect(page.locator('.application-atmosphere-layer')).toHaveCount(1);

  const auth = await atmosphereSnapshot(page, 'auth');
  const game = await atmosphereSnapshot(page, 'game');
  const admin = await atmosphereSnapshot(page, 'admin');

  expect(game).toEqual(auth);
  expect(admin).toEqual(auth);
}

test('auth, game and admin share the desktop atmosphere baseline', async ({ page }) => {
  await expectUnifiedAtmosphere(page, { width: 1440, height: 900 });
});

test('auth, game and admin share the mobile atmosphere baseline', async ({ page }) => {
  await expectUnifiedAtmosphere(page, { width: 390, height: 844 });
});
