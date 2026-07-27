import { expect, test } from '@playwright/test';

async function openLoginPage(page: import('@playwright/test').Page) {
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

test.describe('auth three-layer layout', () => {
  test.describe('desktop', () => {
    test.use({
      viewport: { width: 1440, height: 900 },
    });

    test('keeps image, atmosphere and content in distinct stacking layers', async ({ page }) => {
      await openLoginPage(page);

      const imageLayer = page.locator('.login-image-layer');
      const atmosphereLayer = page.locator('.login-atmosphere-layer');
      const contentLayer = page.locator('.login-content-layer');
      const brand = page.locator('.login-brand');
      const card = page.locator('.login-card');

      await expect(imageLayer).toBeVisible();
      await expect(atmosphereLayer).toBeVisible();
      await expect(contentLayer).toBeVisible();
      await expect(card).toBeVisible();

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
    });
  });

  test.describe('mobile', () => {
    test.use({
      viewport: { width: 390, height: 844 },
    });

    test('stacks brand above the authentication card without restoring an outer panel', async ({ page }) => {
      await openLoginPage(page);
      await page.getByRole('tab', { name: '注册' }).click();

      const shell = page.locator('.login-shell');
      const brand = page.locator('.login-brand');
      const card = page.locator('.login-card');
      const content = page.locator('.login-content-layer');

      const brandBox = await brand.boundingBox();
      const cardBox = await card.boundingBox();
      expect(brandBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.y).toBeGreaterThan(brandBox!.y + brandBox!.height);

      const visual = await page.evaluate(() => {
        const shellStyle = getComputedStyle(document.querySelector('.login-shell') as HTMLElement);
        const cardStyle = getComputedStyle(document.querySelector('.login-card') as HTMLElement);
        const contentStyle = getComputedStyle(document.querySelector('.login-content-layer') as HTMLElement);
        return {
          shellBorder: shellStyle.borderTopWidth,
          shellRadius: shellStyle.borderTopLeftRadius,
          cardBorder: cardStyle.borderTopWidth,
          cardRadius: cardStyle.borderTopLeftRadius,
          contentColumns: contentStyle.gridTemplateColumns,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });

      expect(visual.shellBorder).toBe('0px');
      expect(visual.shellRadius).toBe('0px');
      expect(visual.cardBorder).not.toBe('0px');
      expect(visual.cardRadius).not.toBe('0px');
      expect(visual.contentColumns.trim().split(/\s+/)).toHaveLength(1);
      expect(visual.documentWidth).toBeLessThanOrEqual(visual.viewportWidth);
      await expect(content).toBeVisible();
    });
  });
});
