import { expect, test, type Page } from '@playwright/test';

async function openLoginPage(page: Page) {
  await page.goto('auth-three-layer-test.html');
  await expect(page.locator('.login-page')).toBeVisible();
}

async function readFrostedAuth(page: Page) {
  return page.locator('.login-card').evaluate((card) => {
    const surface = card.querySelector<HTMLElement>('.frosted-glass-surface');
    const content = card.querySelector<HTMLElement>('.frosted-glass-surface__content');
    if (!surface || !content) throw new Error('frosted auth fixture is incomplete');
    const style = getComputedStyle(surface) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
    const cardStyle = getComputedStyle(card);
    const contentStyle = getComputedStyle(content);
    const surfaceBox = surface.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    return {
      surfaceCount: card.querySelectorAll('.frosted-glass-surface').length,
      surfaceVariant: surface.dataset.frostedGlassVariant,
      surfaceLayout: surface.dataset.frostedGlassLayout,
      surfaceRadius: style.borderRadius,
      surfaceBorder: style.borderTopWidth,
      surfaceBackground: style.backgroundColor,
      surfaceShadow: style.boxShadow,
      cardOverflowY: cardStyle.overflowY,
      backdropFilter: style.backdropFilter || style.webkitBackdropFilter || '',
      contentPaddingTop: contentStyle.paddingTop,
      contentOverflowY: contentStyle.overflowY,
      surfaceHeight: surfaceBox.height,
      contentHeight: contentBox.height,
      cardHeight: cardBox.height,
      liquidDomCount: card.querySelectorAll('.liquid-glass-surface, .glass__warp, svg feDisplacementMap').length,
    };
  });
}

test.describe('authentication root and frosted surface', () => {
  test('desktop keeps one photography root and one CSS frosted authentication card', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLoginPage(page);

    await expect(page.locator('.application-image-layer')).toHaveCount(1);
    await expect(page.locator('.application-atmosphere-layer')).toHaveCount(1);
    await expect(page.locator('.application-map-layer')).toHaveCount(1);
    await expect(page.locator('.application-ui-layer')).toHaveCount(1);
    await expect(page.locator('.login-card')).not.toHaveClass(/panel/);

    const root = await page.evaluate(() => {
      const samplingRoot = document.querySelector<HTMLElement>('#root');
      const image = document.querySelector<HTMLElement>('.application-image-layer');
      const atmosphere = document.querySelector<HTMLElement>('.application-atmosphere-layer');
      const map = document.querySelector<HTMLElement>('.application-map-layer');
      const ui = document.querySelector<HTMLElement>('.application-ui-layer');
      if (!samplingRoot || !image || !atmosphere || !map || !ui) throw new Error('auth root fixture is incomplete');
      return {
        isolation: getComputedStyle(samplingRoot).isolation,
        imageZ: getComputedStyle(image).zIndex,
        atmosphereZ: getComputedStyle(atmosphere).zIndex,
        mapZ: getComputedStyle(map).zIndex,
        uiZ: getComputedStyle(ui).zIndex,
        sharedParent: image.parentElement === samplingRoot
          && atmosphere.parentElement === samplingRoot
          && map.parentElement === samplingRoot
          && ui.parentElement === samplingRoot,
      };
    });
    expect(root).toEqual({
      isolation: 'isolate',
      imageZ: '0',
      atmosphereZ: '10',
      mapZ: '20',
      uiZ: '30',
      sharedParent: true,
    });

    const frosted = await readFrostedAuth(page);
    expect(frosted.surfaceCount).toBe(1);
    expect(frosted.surfaceVariant).toBe('authCard');
    expect(frosted.surfaceLayout).toBe('content');
    expect(frosted.surfaceRadius).toBe('24px');
    expect(frosted.surfaceBorder).toBe('1px');
    expect(frosted.surfaceBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(frosted.surfaceShadow).not.toBe('none');
    expect(frosted.backdropFilter).toContain('blur(18px)');
    expect(frosted.contentPaddingTop).toBe('32px');
    expect(frosted.liquidDomCount).toBe(0);
    expect(Math.abs(frosted.surfaceHeight - frosted.contentHeight)).toBeLessThanOrEqual(2);
  });

  test('login and registration grow naturally in the same frosted host and retain form values across breakpoints', async ({ page }) => {
    await page.setViewportSize({ width: 721, height: 900 });
    await openLoginPage(page);
    const surface = page.locator('.login-card .frosted-glass-surface');
    const email = page.getByLabel('账号邮箱');
    const password = page.getByLabel('密码');
    await email.fill('kept@example.com');
    await password.fill('password123');
    await surface.evaluate((element) => { (element as HTMLElement).dataset.instanceProbe = 'stable'; });
    const loginHeight = (await surface.boundingBox())!.height;

    await page.getByRole('tab', { name: '注册' }).click();
    await expect(page.getByLabel('邀请码（可选）')).toBeVisible();
    await expect(page.getByLabel('邮箱验证码')).toBeVisible();
    await expect(email).toHaveValue('kept@example.com');
    const registrationHeight = (await surface.boundingBox())!.height;
    expect(registrationHeight).toBeGreaterThan(loginHeight);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(surface).toHaveCount(1);
    await expect(surface).toHaveAttribute('data-instance-probe', 'stable');
    await expect(surface).toHaveCSS('border-radius', '40px');
    await expect(email).toHaveValue('kept@example.com');
    await expect(password).toHaveValue('password123');

    await page.getByRole('tab', { name: '登录' }).click();
    await expect(page.getByLabel('邀请码（可选）')).toHaveCount(0);
    await expect(page.getByLabel('邮箱验证码')).toHaveCount(0);
    await expect(email).toHaveValue('kept@example.com');
  });

  test('mobile authentication has no internal scrollport and remains inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLoginPage(page);
    await page.getByRole('tab', { name: '注册' }).click();

    const frosted = await readFrostedAuth(page);
    expect(frosted.surfaceRadius).toBe('40px');
    expect(frosted.cardOverflowY).toBe('visible');
    expect(frosted.contentOverflowY).toBe('visible');
    expect(frosted.contentPaddingTop).toBe('20px');
    expect(frosted.liquidDomCount).toBe(0);
    expect(Math.abs(frosted.surfaceHeight - frosted.contentHeight)).toBeLessThanOrEqual(2);
    const card = await page.locator('.login-card').boundingBox();
    expect(card).not.toBeNull();
    expect(card!.x).toBeGreaterThanOrEqual(0);
    expect(card!.x + card!.width).toBeLessThanOrEqual(390);
  });
});
