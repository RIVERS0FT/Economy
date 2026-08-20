import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function routePhotography(page: Page) {
  await page.route('https://upload.wikimedia.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#07100b"/><path d="M0 40h64v24H0z" fill="#153824"/></svg>',
    });
  });
}

async function configureSession(page: Page, { banned = false }: { banned?: boolean } = {}) {
  await page.route('**/economy-api/me', (route) => json(route, {
    user: { id: 1, email: 'player@example.com', name: '玩家', role: 'user' },
  }));
  await page.route('**/economy-api/game/session', (route) => json(route, {
    playerCreated: false,
    banned,
    incidentId: banned ? 17 : undefined,
    invitationBound: false,
    invalidInvite: false,
  }));
}

function alphaFromColor(color: string) {
  const match = color.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)/);
  return match?.[1] === undefined ? 1 : Number(match[1]);
}

test.describe('application error state glass', () => {
  test('game load failure uses the shared stateCard and browser-style page refresh', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routePhotography(page);
    await configureSession(page);
    await page.route('**/economy-api/game/state**', (route) => route.abort('failed'));

    await page.goto('/economy/');
    await expect(page.getByText('无法加载游戏状态', { exact: true })).toBeVisible();

    const surface = page.locator('.game-error-state-shell .frosted-glass-surface--stateCard');
    await expect(surface).toHaveCount(1);
    await expect(surface).toHaveAttribute('data-frosted-glass-variant', 'stateCard');

    const visual = await surface.evaluate((element) => {
      const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      const inner = element.querySelector<HTMLElement>('.photographic-state-card');
      if (!inner) throw new Error('state card content is missing');
      const innerStyle = getComputedStyle(inner);
      return {
        backgroundColor: style.backgroundColor,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter || '',
        borderWidth: style.borderTopWidth,
        innerBackground: innerStyle.backgroundColor,
        innerBoxShadow: innerStyle.boxShadow,
      };
    });
    expect(alphaFromColor(visual.backgroundColor)).toBeGreaterThan(0.5);
    expect(alphaFromColor(visual.backgroundColor)).toBeLessThan(0.95);
    expect(visual.backdropFilter).toContain('blur(18px)');
    expect(visual.borderWidth).toBe('1px');
    expect(alphaFromColor(visual.innerBackground)).toBe(0);
    expect(visual.innerBoxShadow).toBe('none');

    const refresh = page.getByRole('button', { name: '刷新页面' });
    await expect(refresh).toHaveAttribute('title', '刷新页面');
    await expect(refresh.locator('svg')).toHaveCount(1);
    await expect(refresh).toHaveText('');
    const geometry = await refresh.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
      };
    });
    expect(geometry.width).toBe(44);
    expect(geometry.height).toBe(44);
    expect(geometry.borderRadius).toBe('50%');
    expect(alphaFromColor(geometry.background)).toBe(0);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      refresh.click(),
    ]);
    await expect(page.getByText('无法加载游戏状态', { exact: true })).toBeVisible();
  });

  test('mobile photographic states use the same transparent-content stateCard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routePhotography(page);
    await configureSession(page, { banned: true });

    await page.goto('/economy/');
    await expect(page.getByRole('heading', { name: '账号已封禁', exact: true })).toBeVisible();

    const surface = page.locator('.photographic-state-shell .frosted-glass-surface--stateCard');
    await expect(surface).toHaveCount(1);
    await expect(surface).toHaveAttribute('data-frosted-glass-variant', 'stateCard');
    await expect(surface).toHaveCSS('border-radius', '40px');

    const visual = await surface.evaluate((element) => {
      const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      const shell = element.closest<HTMLElement>('.photographic-state-shell');
      const inner = element.querySelector<HTMLElement>('.photographic-state-card');
      if (!shell || !inner) throw new Error('photographic state fixture is incomplete');
      const shellStyle = getComputedStyle(shell);
      const innerStyle = getComputedStyle(inner);
      return {
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter || '',
        shellIsolation: shellStyle.isolation,
        shellFilter: shellStyle.filter,
        shellTransform: shellStyle.transform,
        innerBackground: innerStyle.backgroundColor,
        innerBoxShadow: innerStyle.boxShadow,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(visual.backdropFilter).toContain('blur(18px)');
    expect(visual.shellIsolation).toBe('isolate');
    expect(visual.shellFilter).toBe('none');
    expect(visual.shellTransform).toBe('none');
    expect(alphaFromColor(visual.innerBackground)).toBe(0);
    expect(visual.innerBoxShadow).toBe('none');
    expect(visual.documentOverflow).toBeLessThanOrEqual(1);
  });
});
