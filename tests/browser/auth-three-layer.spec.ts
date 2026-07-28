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
    const effect = surface?.querySelector<HTMLElement>(':scope > .liquid-glass-surface__effect');
    const glassElement = effect?.querySelector<HTMLElement>(':scope > .glass');
    const filterSvg = effect?.querySelector<SVGSVGElement>(':scope > svg');
    const content = surface?.querySelector<HTMLElement>('.liquid-glass-surface__content');
    const warp = surface?.querySelector<HTMLElement>('.glass__warp');
    if (!card || !surface || !effect || !glassElement || !filterSvg || !content || !warp) {
      throw new Error('authentication glass fixture is incomplete');
    }
    const cardStyle = getComputedStyle(card);
    const surfaceStyle = getComputedStyle(surface);
    const contentStyle = getComputedStyle(content);
    const outlineStyle = getComputedStyle(surface, '::after');
    const warpStyle = getComputedStyle(warp);
    const directDecorationSpans = Array.from(surface.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element.tagName === 'SPAN');
    const directAuxiliaryDivs = Array.from(surface.children)
      .filter((element): element is HTMLElement => (
        element instanceof HTMLElement
        && element.tagName === 'DIV'
        && !element.classList.contains('liquid-glass-surface__effect')
      ));
    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity) > 0;
    };
    return {
      cardBorder: cardStyle.borderTopWidth,
      cardOverflowY: cardStyle.overflowY,
      surfaceRadius: surfaceStyle.borderTopLeftRadius,
      surfaceHeight: surface.getBoundingClientRect().height,
      effectHeight: effect.getBoundingClientRect().height,
      glassHeight: glassElement.getBoundingClientRect().height,
      filterHeight: filterSvg.getBoundingClientRect().height,
      surfaceOverflowY: surfaceStyle.overflowY,
      surfaceBackground: surfaceStyle.backgroundColor,
      sharedContrast: getComputedStyle(document.documentElement)
        .getPropertyValue('--liquid-glass-contrast')
        .trim(),
      surfaceContain: surfaceStyle.contain,
      surfaceIsolation: surfaceStyle.isolation,
      contentHeight: content.getBoundingClientRect().height,
      contentOverflowY: contentStyle.overflowY,
      contentPaddingTop: contentStyle.paddingTop,
      contentInsideGlass: Boolean(content.closest('.glass')),
      materialFillCount: surface.querySelectorAll('.liquid-glass-surface__material-fill').length,
      directDecorationSpanCount: directDecorationSpans.length,
      visibleDirectDecorationSpanCount: directDecorationSpans.filter(isVisible).length,
      directAuxiliaryDivCount: directAuxiliaryDivs.length,
      visibleDirectAuxiliaryDivCount: directAuxiliaryDivs.filter(isVisible).length,
      outlineBorder: outlineStyle.borderTopWidth,
      outlineContent: outlineStyle.content,
      outlineZIndex: outlineStyle.zIndex,
      webkitBackdropFilter:
        warpStyle.getPropertyValue('-webkit-backdrop-filter')
        || warpStyle.getPropertyValue('backdrop-filter')
        || warpStyle.backdropFilter,
    };
  });
}

async function expectAuthGlassGeometryAligned(page: Page) {
  await expect.poll(async () => {
    const glass = await readAuthGlass(page);
    return {
      contentAligned: Math.abs(glass.surfaceHeight - glass.contentHeight) <= 1,
      effectAligned: Math.abs(glass.surfaceHeight - glass.effectHeight) <= 1,
      glassAligned: Math.abs(glass.surfaceHeight - glass.glassHeight) <= 1,
      filterAligned: Math.abs(glass.surfaceHeight - glass.filterHeight) <= 1,
      visibleDirectDecorationSpanCount: glass.visibleDirectDecorationSpanCount,
      visibleDirectAuxiliaryDivCount: glass.visibleDirectAuxiliaryDivCount,
    };
  }).toEqual({
    contentAligned: true,
    effectAligned: true,
    glassAligned: true,
    filterAligned: true,
    visibleDirectDecorationSpanCount: 0,
    visibleDirectAuxiliaryDivCount: 0,
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
      expect(glass.outlineBorder).toBe('0px');
      expect(glass.outlineContent).toBe('none');
      expect(glass.outlineZIndex).toBe('auto');
      expect(glass.webkitBackdropFilter).toContain('blur(7.84px)');
      expect(glass.surfaceBackground).toBe(glass.sharedContrast);
      expect(glass.contentInsideGlass).toBe(true);
      expect(glass.materialFillCount).toBe(0);
      expect(glass.surfaceContain).toBe('none');
      expect(glass.surfaceIsolation).toBe('auto');
      expect(glass.directDecorationSpanCount).toBeGreaterThanOrEqual(2);
      expect(glass.directAuxiliaryDivCount).toBeGreaterThanOrEqual(2);
      await expectAuthGlassGeometryAligned(page);

      await page.getByLabel('账号邮箱').click();
      await expect(page.getByLabel('账号邮箱')).toBeFocused();
    });

    test('keeps one authentication glass instance and form values while switching breakpoints', async ({ page }) => {
      await page.setViewportSize({ width: 721, height: 900 });
      await openLoginPage(page);
      const surfaces = page.locator('.login-card .liquid-glass-surface');
      const email = page.getByLabel('账号邮箱');
      const password = page.getByLabel('密码');
      await email.fill('kept@example.com');
      await password.fill('password123');
      await expect(surfaces).toHaveCount(1);
      await expect(surfaces).toHaveAttribute('data-liquid-glass-variant', 'desktopAuthCard');
      await expectAuthGlassGeometryAligned(page);

      await page.setViewportSize({ width: 720, height: 900 });
      await expect(surfaces).toHaveCount(1);
      await expect(surfaces).toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard');
      await expect(email).toHaveValue('kept@example.com');
      await expect(password).toHaveValue('password123');
      await expectAuthGlassGeometryAligned(page);

      await page.setViewportSize({ width: 721, height: 900 });
      await expect(surfaces).toHaveCount(1);
      await expect(surfaces).toHaveAttribute('data-liquid-glass-variant', 'desktopAuthCard');
      await expect(email).toHaveValue('kept@example.com');
      await expect(password).toHaveValue('password123');
      await expectAuthGlassGeometryAligned(page);
    });
  });

  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('registration content grows inside the same glass surface without an internal scrollport and keeps geometry aligned through login register and login switching', async ({ page }) => {
      await openLoginPage(page);

      const shell = page.locator('.login-shell');
      const brand = page.locator('.login-brand');
      const card = page.locator('.login-card');
      const content = page.locator('.login-content-layer');
      const surface = card.locator('.liquid-glass-surface');
      const email = page.getByLabel('账号邮箱');

      await expect(surface).toHaveCount(1);
      await expect(surface).toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard');
      await expect(surface).toHaveAttribute('data-liquid-glass-layout', 'content');
      await email.fill('mobile@example.com');
      await expectAuthGlassGeometryAligned(page);
      const loginGlass = await readAuthGlass(page);
      const atmosphere = await readMobileAtmosphere(page);

      expect(atmosphere.backgroundImage).toContain('rgba(1, 7, 4, 0.62)');
      expect(atmosphere.backgroundImage).toContain('rgba(2, 10, 6, 0.6)');
      expect(atmosphere.backgroundImage).toContain('rgba(2, 8, 5, 0.82)');
      expect(atmosphere.gridOpacity).toBe('0.12');
      expect(atmosphere.noiseOpacity).toBe('0.05');
      expect(loginGlass.surfaceBackground).toBe(loginGlass.sharedContrast);
      expect(loginGlass.contentInsideGlass).toBe(true);
      expect(loginGlass.materialFillCount).toBe(0);
      expect(loginGlass.webkitBackdropFilter).toContain('blur(7.2px)');
      expect(loginGlass.directDecorationSpanCount).toBeGreaterThanOrEqual(2);
      expect(loginGlass.directAuxiliaryDivCount).toBeGreaterThanOrEqual(2);

      await page.getByRole('tab', { name: '注册' }).click();
      await expect(page.getByLabel('邀请码（可选）')).toBeVisible();
      await expect(page.getByLabel('邮箱验证码')).toBeVisible();
      await expect(email).toHaveValue('mobile@example.com');
      await expect(surface).toHaveCount(1);
      await expect(surface).toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard');
      await expectAuthGlassGeometryAligned(page);

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
      expect(registrationGlass.outlineBorder).toBe('0px');
      expect(registrationGlass.outlineContent).toBe('none');
      expect(registrationGlass.webkitBackdropFilter).toContain('blur(7.2px)');
      expect(registrationGlass.surfaceBackground).toBe(registrationGlass.sharedContrast);
      expect(registrationGlass.contentInsideGlass).toBe(true);
      expect(registrationGlass.materialFillCount).toBe(0);
      expect(registrationGlass.surfaceHeight).toBeGreaterThan(loginGlass.surfaceHeight);
      expect(registrationGlass.cardOverflowY).not.toMatch(/auto|scroll/);
      expect(registrationGlass.surfaceOverflowY).not.toMatch(/auto|scroll/);
      expect(registrationGlass.contentOverflowY).not.toMatch(/auto|scroll/);
      const registrationHeight = registrationGlass.surfaceHeight;

      await page.getByRole('tab', { name: '登录' }).click();
      await expect(page.getByLabel('邀请码（可选）')).toHaveCount(0);
      await expect(page.getByLabel('邮箱验证码')).toHaveCount(0);
      await expect(email).toHaveValue('mobile@example.com');
      await expectAuthGlassGeometryAligned(page);
      const returnedLoginGlass = await readAuthGlass(page);
      expect(returnedLoginGlass.surfaceHeight).toBeLessThan(registrationHeight);

      await expect(content).toBeVisible();
      await expect(shell).toBeVisible();
    });
  });
});
