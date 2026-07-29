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
  test('shows photography while checking the account session', async ({ page }) => {
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
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-photographic-state-variant', 'auth');
    await expect(page.locator('.login-image-layer')).toBeVisible();
    await expect(page.locator('.login-atmosphere-layer')).toBeVisible();
    await expect(page.getByText('正在连接统一账号服务…', { exact: true })).toBeVisible();

    const visual = await page.evaluate(() => ({
      bodyGridDisplay: getComputedStyle(document.body, '::before').display,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(visual.bodyGridDisplay).toBe('none');
    expect(visual.documentOverflow).toBeLessThanOrEqual(1);

    releaseAccountCheck();
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
    await expect(page.locator('.game-image-layer')).toBeVisible();
    await expect(page.locator('.game-atmosphere-layer.financial-backdrop-atmosphere--critical')).toBeVisible();
    await expect(page.getByRole('heading', { name: '账号已封禁', exact: true })).toBeVisible();
    await expect(page.getByText('事件编号：#17', { exact: true })).toBeVisible();
  });

  test('uses the admin atmosphere for denied access', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routePhotography(page);
    await configureSession(page, { role: 'user' });

    await page.goto('/economy/admin');

    const shell = page.locator('.photographic-state-shell');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-photographic-state-variant', 'admin');
    await expect(shell).toHaveClass(/photographic-state-shell--critical/);
    await expect(page.locator('.admin-image-layer')).toBeVisible();
    await expect(page.locator('.admin-atmosphere-layer')).toBeVisible();
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
    await expect(page.locator('.admin-image-layer img')).toBeHidden();
    await expect(page.locator('.admin-atmosphere-layer')).toBeVisible();
    await expect(page.locator('.admin-command-bar')).toBeVisible();
    await expect(page.locator('.admin-sidebar')).toBeVisible();

    const visual = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.admin-shell');
      const image = document.querySelector<HTMLElement>('.admin-image-layer');
      const atmosphere = document.querySelector<HTMLElement>('.admin-atmosphere-layer');
      if (!shell || !image || !atmosphere) throw new Error('administrator photography fixture is incomplete');
      const children = [...shell.children];
      return {
        shellBackground: getComputedStyle(shell).backgroundColor,
        shellIsolation: getComputedStyle(shell).isolation,
        imagePosition: getComputedStyle(image).position,
        atmospherePosition: getComputedStyle(atmosphere).position,
        imageIndex: children.indexOf(image),
        atmosphereIndex: children.indexOf(atmosphere),
        sidebarIndex: children.findIndex((element) => element.classList.contains('admin-sidebar')),
        workspaceIndex: children.findIndex((element) => element.classList.contains('admin-workspace')),
      };
    });

    expect(visual.shellBackground).toBe('rgba(0, 0, 0, 0)');
    expect(visual.shellIsolation).toBe('isolate');
    expect(visual.imagePosition).toBe('fixed');
    expect(visual.atmospherePosition).toBe('fixed');
    expect(visual.imageIndex).toBe(0);
    expect(visual.atmosphereIndex).toBe(1);
    expect(visual.sidebarIndex).toBeGreaterThan(visual.atmosphereIndex);
    expect(visual.workspaceIndex).toBeGreaterThan(visual.sidebarIndex);
  });
});
