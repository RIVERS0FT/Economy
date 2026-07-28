import { expect, test, type Page } from '@playwright/test';

async function openLoginPage(page: Page) {
  await page.route('**/economy-api/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: '未登录' }),
    });
  });
  await page.route('https://upload.wikimedia.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="#08130d"/></svg>',
    });
  });
  await page.goto('');
  await expect(page.locator('html')).toHaveAttribute('data-app-surface', 'auth');
  await expect(page.locator('.login-shell')).toBeVisible();
}

async function readAuthGlass(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.login-card');
    const surface = card?.querySelector<HTMLElement>('.liquid-glass-surface');
    const content = surface?.querySelector<HTMLElement>(':scope > .liquid-glass-surface__content');
    const warp = surface?.querySelector<HTMLElement>('.glass__warp');
    const materialFill = surface?.querySelector<HTMLElement>('.liquid-glass-surface__material-fill');
    if (!card || !surface || !content || !warp || !materialFill) {
      throw new Error('authentication glass fixture is incomplete');
    }
    const cardStyle = getComputedStyle(card);
    const surfaceStyle = getComputedStyle(surface);
    const contentStyle = getComputedStyle(content);
    const outlineStyle = getComputedStyle(surface, '::after');
    const warpStyle = getComputedStyle(warp);
    const materialFillStyle = getComputedStyle(materialFill);
    return {
      cardBorder: cardStyle.borderTopWidth,
      cardOverflowY: cardStyle.overflowY,
      surfaceRadius: surfaceStyle.borderTopLeftRadius,
      surfaceHeight: surface.getBoundingClientRect().height,
      surfaceOverflowY: surfaceStyle.overflowY,
      surfaceBackground: surfaceStyle.backgroundColor,
      surfaceContain: surfaceStyle.contain,
      surfaceIsolation: surfaceStyle.isolation,
      contentHeight: content.getBoundingClientRect().height,
      contentOverflowY: contentStyle.overflowY,
      contentPaddingTop: contentStyle.paddingTop,
      materialFillBackground: materialFillStyle.backgroundColor,
      materialFillInsideGlass: Boolean(materialFill.closest('.glass')),
      outlineBorder: outlineStyle.borderTopWidth,
      outlineZIndex: outlineStyle.zIndex,
      webkitBackdropFilter:
        warpStyle.getPropertyValue('-webkit-backdrop-filter')
        || warpStyle.getPropertyValue('backdrop-filter')
        || warpStyle.backdropFilter,
    };
  });
}

async function readMobileAtmosphere(page: Page) {
  return page.evaluate(() => {
    const atmosphere = document.querySelector<HTMLElement>('.login-atmosphere-layer');
    if (!atmosphere) throw new Error('mobile atmosphere layer is missing');
    return {
      backgroundImage: getComputedStyle(atmosphere).backgroundImage,
      gridOpacity: getComputedStyle(atmosphere, '::before').opacity,
      noiseOpacity: getComputedStyle(atmosphere, '::after').opacity,
    };
  });
}

test.describe('auth three-layer layout', () => {
  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('keeps image, atmosphere and content in distinct stacking layers', async ({ page }) => {
      await openLoginPage(page);

      const imageLayer = page.locator('.login-image-layer');
      const atmosphereLayer = page.locator('.login-atmosphere-layer');
      const contentLayer = page.locator('.login-content-layer');
      const brand = page.locator('.login-brand');
      const card = page.locator('.login-card');
      const surface = card.locator('.liquid-glass-surface');

      await expect(imageLayer).toBeVisible();
      await expect(atmosphereLayer).toBeVisible();
      await expect(contentLayer).toBeVisible();
      await expect(card).toBeVisible();
      await expect(card).not.toHaveClass(/panel/);
      await expect(surface).toHaveCount(1);
      await expect(surface).toHaveAttribute('data-liquid-glass-variant', 'desktopAuthCard');
      await expect(surface).toHaveAttribute('data-liquid-glass-layout', 'content');

      const stacking = await page.evaluate(() => {
        const read = (selector: string) => {
          const style = getComputedStyle(document.querySelector(selector) as HTMLElement);
          return { position: style.position, zIndex: style.zIndex };
        };
        return {
          image: read('.login-image-layer'),
          atmosphere: read('.login-atmosphere-layer'),
          content: read('.login-content-layer'),
        };
      });

      expect(stacking.image).toEqual({ position: 'fixed', zIndex: '0' });
      expect(stacking.atmosphere).toEqual({ position: 'fixed', zIndex: '1' });
      expect(stacking.content.zIndex).toBe('2');

      const brandBox = await brand.boundingBox();
      const cardBox = await card.boundingBox();
      expect(brandBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.x).toBeGreaterThan(brandBox!.x + brandBox!.width);

      const geometry = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        imageFit: getComputedStyle(document.querySelector('.login-image-layer img') as HTMLElement).objectFit,
      }));
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.imageFit).toBe('cover');

      const glass = await readAuthGlass(page);
      expect(glass.cardBorder).toBe('0px');
      expect(glass.surfaceRadius).toBe('24px');
      expect(glass.contentPaddingTop).toBe('32px');
      expect(glass.outlineBorder).toBe('1px');
      expect(glass.outlineZIndex).toBe('2');
      expect(glass.webkitBackdropFilter).toContain('blur(7.84px)');
      expect(glass.surfaceBackground).toBe('rgba(0, 0, 0, 0)');
      expect(glass.materialFillBackground).toBe('rgba(9, 25, 18, 0.46)');
      expect(glass.materialFillInsideGlass).toBe(true);
      expect(glass.surfaceContain).toBe('none');
      expect(glass.surfaceIsolation).toBe('auto');
      expect(glass.surfaceHeight).toBeCloseTo(glass.contentHeight, 0);

      await page.getByLabel('账号邮箱').click();
      await expect(page.getByLabel('账号邮箱')).toBeFocused();
    });

    test('keeps one authentication glass instance while switching breakpoints', async ({ page }) => {
      await page.setViewportSize({ width: 721, height: 900 });
      await openLoginPage(page);
      const surfaces = page.locator('.login-card .liquid-glass-surface');
      await expect(surfaces).toHaveCount(1);
      await expect(surfaces).toHaveAttribute('data-liquid-glass-variant', 'desktopAuthCard');

      await page.setViewportSize({ width: 720, height: 900 });
      await expect(surfaces).toHaveCount(1);
      await expect(surfaces).toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard');

      await page.setViewportSize({ width: 721, height: 900 });
      await expect(surfaces).toHaveCount(1);
      await expect(surfaces).toHaveAttribute('data-liquid-glass-variant', 'desktopAuthCard');
    });
  });

  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('registration content grows the same glass surface without an internal scrollport', async ({ page }) => {
      await openLoginPage(page);

      const shell = page.locator('.login-shell');
      const brand = page.locator('.login-brand');
      const card = page.locator('.login-card');
      const content = page.locator('.login-content-layer');
      const surface = card.locator('.liquid-glass-surface');

      await expect(surface).toHaveCount(1);
      await expect(surface).toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard');
      await expect(surface).toHaveAttribute('data-liquid-glass-layout', 'content');
      const loginGlass = await readAuthGlass(page);
      const atmosphere = await readMobileAtmosphere(page);

      expect(atmosphere.backgroundImage).toContain('rgba(1, 7, 4, 0.62)');
      expect(atmosphere.backgroundImage).toContain('rgba(2, 10, 6, 0.6)');
      expect(atmosphere.backgroundImage).toContain('rgba(2, 8, 5, 0.82)');
      expect(atmosphere.gridOpacity).toBe('0.12');
      expect(atmosphere.noiseOpacity).toBe('0.05');
      expect(loginGlass.surfaceBackground).toBe('rgba(0, 0, 0, 0)');
      expect(loginGlass.materialFillBackground).toBe('rgba(8, 23, 16, 0.3)');
      expect(loginGlass.materialFillInsideGlass).toBe(true);
      expect(loginGlass.webkitBackdropFilter).toContain('blur(7.2px)');

      await page.getByRole('tab', { name: '注册' }).click();
      await expect(page.getByLabel('邀请码（可选）')).toBeVisible();
      await expect(page.getByLabel('邮箱验证码')).toBeVisible();
      await expect(surface).toHaveCount(1);
      await expect(surface).toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard');

      const brandBox = await brand.boundingBox();
      const cardBox = await card.boundingBox();
      expect(brandBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.y).toBeGreaterThan(brandBox!.y + brandBox!.height);

      const visual = await page.evaluate(() => {
        const shellStyle = getComputedStyle(document.querySelector('.login-shell') as HTMLElement);
        const contentStyle = getComputedStyle(document.querySelector('.login-content-layer') as HTMLElement);
        return {
          shellBorder: shellStyle.borderTopWidth,
          shellRadius: shellStyle.borderTopLeftRadius,
          contentColumns: contentStyle.gridTemplateColumns,
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      });

      const registrationGlass = await readAuthGlass(page);
      expect(visual.shellBorder).toBe('0px');
      expect(visual.shellRadius).toBe('0px');
      expect(visual.contentColumns.trim().split(/\s+/)).toHaveLength(1);
      expect(visual.documentWidth).toBeLessThanOrEqual(visual.viewportWidth);
      expect(visual.documentHeight).toBeGreaterThanOrEqual(visual.viewportHeight);
      expect(registrationGlass.cardBorder).toBe('0px');
      expect(registrationGlass.surfaceRadius).toBe('40px');
      expect(registrationGlass.contentPaddingTop).toBe('20px');
      expect(registrationGlass.outlineBorder).toBe('1px');
      expect(registrationGlass.webkitBackdropFilter).toContain('blur(7.2px)');
      expect(registrationGlass.surfaceBackground).toBe('rgba(0, 0, 0, 0)');
      expect(registrationGlass.materialFillBackground).toBe('rgba(8, 23, 16, 0.3)');
      expect(registrationGlass.surfaceHeight).toBeGreaterThan(loginGlass.surfaceHeight);
      expect(registrationGlass.surfaceHeight).toBeCloseTo(registrationGlass.contentHeight, 0);
      expect(registrationGlass.cardOverflowY).not.toMatch(/auto|scroll/);
      expect(registrationGlass.surfaceOverflowY).not.toMatch(/auto|scroll/);
      expect(registrationGlass.contentOverflowY).not.toMatch(/auto|scroll/);
      await expect(content).toBeVisible();
      await expect(shell).toBeVisible();
    });
  });
});
