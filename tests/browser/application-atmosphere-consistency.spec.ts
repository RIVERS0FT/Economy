import { expect, test, type Page } from '@playwright/test';

type BackdropVariant = 'auth' | 'game' | 'admin';

type AtmosphereSnapshot = {
  imageFilter: string;
  imageWillChange: string;
  atmosphereBackground: string;
  primaryGlow: string;
  secondaryGlow: string;
  shadeStart: string;
  shadeMid: string;
  shadeFocus: string;
  shadeEnd: string;
  gridOpacity: string;
  gridOpacityToken: string;
  gridSizeToken: string;
  gridBackground: string;
  gridMask: string;
  noiseOpacity: string;
  noiseOpacityToken: string;
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
    const token = (name: string) => atmosphereStyle.getPropertyValue(name).trim();
    return {
      imageFilter: getComputedStyle(image).filter,
      imageWillChange: getComputedStyle(image).willChange,
      atmosphereBackground: atmosphereStyle.backgroundImage,
      primaryGlow: token('--application-atmosphere-primary-glow'),
      secondaryGlow: token('--application-atmosphere-secondary-glow'),
      shadeStart: token('--application-atmosphere-shade-start'),
      shadeMid: token('--application-atmosphere-shade-mid'),
      shadeFocus: token('--application-atmosphere-shade-focus'),
      shadeEnd: token('--application-atmosphere-shade-end'),
      gridOpacity: gridStyle.opacity,
      gridOpacityToken: token('--application-atmosphere-grid-opacity'),
      gridSizeToken: token('--application-atmosphere-grid-size'),
      gridBackground: gridStyle.backgroundImage,
      gridMask: gridStyle.maskImage,
      noiseOpacity: noiseStyle.opacity,
      noiseOpacityToken: token('--application-atmosphere-noise-opacity'),
      noiseBackground: noiseStyle.backgroundImage,
      noiseBlendMode: noiseStyle.mixBlendMode,
    };
  });
}

async function expectUnifiedAtmosphere(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  const mode = viewport.width <= 720 ? 'mobile' : 'desktop';
  await page.goto(`open-glass-sampling-test.html?surface=game&mode=${mode}`);
  await expect(page.locator('.application-image-layer')).toHaveCount(1);
  await expect(page.locator('.application-atmosphere-layer')).toHaveCount(1);

  const auth = await atmosphereSnapshot(page, 'auth');
  const game = await atmosphereSnapshot(page, 'game');
  const admin = await atmosphereSnapshot(page, 'admin');

  expect(game).toEqual(auth);
  expect(admin).toEqual(auth);
  return auth;
}

test('desktop shares one atmosphere baseline and locks its intensity', async ({ page }) => {
  const atmosphere = await expectUnifiedAtmosphere(page, { width: 1440, height: 900 });

  expect(atmosphere.imageFilter).toBe('saturate(0.72) contrast(1.08) brightness(0.72)');
  expect(atmosphere.imageWillChange).toBe('auto');
  expect(atmosphere.primaryGlow).toBe('rgba(86, 224, 137, 0.10)');
  expect(atmosphere.secondaryGlow).toBe('rgba(44, 176, 102, 0.06)');
  expect(atmosphere.shadeStart).toBe('rgba(1, 7, 4, 0.96)');
  expect(atmosphere.shadeMid).toBe('rgba(2, 10, 6, 0.90)');
  expect(atmosphere.shadeFocus).toBe('rgba(3, 12, 8, 0.84)');
  expect(atmosphere.shadeEnd).toBe('rgba(2, 9, 6, 0.90)');
  expect(atmosphere.gridOpacity).toBe('0.16');
  expect(atmosphere.gridOpacityToken).toBe('0.16');
  expect(atmosphere.gridSizeToken).toBe('46px 46px');
  expect(atmosphere.noiseOpacity).toBe('0.045');
  expect(atmosphere.noiseOpacityToken).toBe('0.045');
});

test('mobile shares one atmosphere baseline and locks its intensity', async ({ page }) => {
  const atmosphere = await expectUnifiedAtmosphere(page, { width: 390, height: 844 });

  expect(atmosphere.imageFilter).toBe('saturate(0.68) contrast(1.08) brightness(0.62)');
  expect(atmosphere.imageWillChange).toBe('auto');
  expect(atmosphere.primaryGlow).toBe('rgba(86, 224, 137, 0.09)');
  expect(atmosphere.shadeStart).toBe('rgba(1, 7, 4, 0.78)');
  expect(atmosphere.shadeMid).toBe('rgba(2, 10, 6, 0.76)');
  expect(atmosphere.shadeEnd).toBe('rgba(2, 8, 5, 0.90)');
  expect(atmosphere.gridOpacity).toBe('0.08');
  expect(atmosphere.gridOpacityToken).toBe('0.08');
  expect(atmosphere.gridSizeToken).toBe('42px 42px');
  expect(atmosphere.noiseOpacity).toBe('0.03');
  expect(atmosphere.noiseOpacityToken).toBe('0.03');
});
