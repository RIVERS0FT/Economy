import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function routePhotography(page: Page, mode: 'success' | 'failure' = 'success') {
  await page.route('https://upload.wikimedia.org/**', async (route) => {
    if (mode === 'failure') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#07100b"/><path d="M0 40h64v24H0z" fill="#153824"/></svg>',
    });
  });
}

async function configureSession(page: Page, {
  role = 'user',
  banned = false,
  incidentId,
}: {
  role?: 'user' | 'admin';
  banned?: boolean;
  incidentId?: number;
} = {}) {
  await page.route('**/economy-api/me', (route) => json(route, {
    user: { id: 1, email: `${role}@example.com`, name: role === 'admin' ? '管理员' : '玩家', role },
  }));
  await page.route('**/economy-api/game/session', (route) => json(route, {
    playerCreated: false,
    banned,
    incidentId,
    invitationBound: false,
    invalidInvite: false,
  }));
}

test.describe('all-interface photography', () => {
  test('keeps the same photography node from account checking into authentication', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routePhotography(page);

    let releaseAccountCheck = () => {};
    const accountCheckGate = new Promise<void>((resolve) => {
      releaseAccountCheck = resolve;
    });
    await page.route('**/economy-api/me', async (route) => {
      await accountCheckGate;
      await json(route, { user: null });
    });

    await page.goto('/economy/', { waitUntil: 'domcontentloaded' });

    const shell = page.locator('.photographic-state-shell');
    const imageLayer = page.locator('.application-image-layer');
    const image = imageLayer.locator('img');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-photographic-state-variant', 'auth');
    await expect(imageLayer).toHaveCount(1);
    await expect(imageLayer).toBeVisible();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();
    await expect(page.getByText('正在连接统一账号服务…', { exact: true })).toBeVisible();

    await image.evaluate((element) => {
      const data = element.dataset;
      data.persistenceProbe = 'account-check';
    });

    releaseAccountCheck();
    await expect(page.locator('.login-shell')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-app-surface', 'auth');
    await expect(page.locator('html')).toHaveAttribute('data-app-backdrop', 'auth');
    await expect(imageLayer).toHaveCount(1);
    await expect(image).toHaveAttribute('data-persistence-probe', 'account-check');
    await expect(page.locator('.login-shell .financial-backdrop-image')).toHaveCount(0);

    const visual = await page.evaluate(() => ({
      bodyGridDisplay: getComputedStyle(document.body, '::before').display,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      imageLoading: document.querySelector<HTMLImageElement>('.application-image-layer img')?.loading,
      imageFetchPriority: document.querySelector<HTMLImageElement>('.application-image-layer img')?.fetchPriority,
    }));
    expect(visual.bodyGridDisplay).toBe('none');
    expect(visual.documentOverflow).toBeLessThanOrEqual(1);
    expect(visual.imageLoading).toBe('eager');
    expect(visual.imageFetchPriority).toBe('high');
  });

  test('uses the game critical atmosphere for banned accounts', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await routePhotography(page);
    await configureSession(page, { banned: true, incidentId: 17 });

    await page.goto('/economy/');

    const shell = page.locator('.photographic-state-shell');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-photographic-state-variant', 'game');
    await expect(shell).toHaveClass(/photographic-state-shell--critical/);
    await expect(page.locator('html')).toHaveAttribute('data-app-backdrop', 'game');
    await expect(page.locator('html')).toHaveAttribute('data-app-tone', 'critical');
    await expect(page.locator('.application-image-layer')).toBeVisible();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();
    await expect(page.getByRole('heading', { name: '账号已封禁', exact: true })).toBeVisible();
    await expect(page.getByText('事件编号：#17', { exact: true })).toBeVisible();
  });

  test('uses the admin critical atmosphere for denied access', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routePhotography(page);
    await configureSession(page, { role: 'user' });

    await page.goto('/economy/admin');

    const shell = page.locator('.photographic-state-shell');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-photographic-state-variant', 'admin');
    await expect(shell).toHaveClass(/photographic-state-shell--critical/);
    await expect(page.locator('html')).toHaveAttribute('data-app-backdrop', 'admin');
    await expect(page.locator('html')).toHaveAttribute('data-app-tone', 'critical');
    await expect(page.locator('.application-image-layer')).toBeVisible();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();
    await expect(page.getByRole('heading', { name: '无权访问', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '返回游戏', exact: true })).toBeVisible();

    const documentOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(documentOverflow).toBeLessThanOrEqual(1);
  });

  test('keeps the administrator interface readable when photography fails', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routePhotography(page, 'failure');
    await configureSession(page, { role: 'admin' });
    await page.route('**/economy-api/game/admin/**', (route) => json(route, { message: '测试中的管理员接口不可用' }, 503));

    await page.goto('/economy/admin');

    await expect(page.locator('.admin-shell')).toBeVisible();
    await expect(page.locator('.application-image-layer img')).toBeHidden();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();
    await expect(page.locator('.admin-command-bar')).toBeVisible();
    await expect(page.locator('.admin-sidebar')).toBeVisible();
    await expect(page.locator('.admin-shell .financial-backdrop-image')).toHaveCount(0);

    const visual = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.admin-shell');
      const image = document.querySelector<HTMLElement>('.application-image-layer');
      const atmosphere = document.querySelector<HTMLElement>('.application-atmosphere-layer');
      const contentRoot = document.querySelector<HTMLElement>('.application-content-root');
      if (!shell || !image || !atmosphere || !contentRoot) {
        throw new Error('administrator photography fixture is incomplete');
      }
      return {
        shellBackground: getComputedStyle(shell).backgroundColor,
        shellIsolation: getComputedStyle(shell).isolation,
        imagePosition: getComputedStyle(image).position,
        atmospherePosition: getComputedStyle(atmosphere).position,
        imageZIndex: getComputedStyle(image).zIndex,
        atmosphereZIndex: getComputedStyle(atmosphere).zIndex,
        contentZIndex: getComputedStyle(contentRoot).zIndex,
        imageInsideShell: shell.contains(image),
      };
    });

    expect(visual.shellBackground).toBe('rgba(0, 0, 0, 0)');
    expect(visual.shellIsolation).toBe('isolate');
    expect(visual.imagePosition).toBe('fixed');
    expect(visual.atmospherePosition).toBe('fixed');
    expect(visual.imageZIndex).toBe('0');
    expect(visual.atmosphereZIndex).toBe('1');
    expect(visual.contentZIndex).toBe('2');
    expect(visual.imageInsideShell).toBe(false);
  });
});
