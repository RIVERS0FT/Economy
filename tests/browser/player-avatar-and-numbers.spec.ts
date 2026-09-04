import { expect, test, type Page } from '@playwright/test';

async function servePlayerAvatars(page: Page) {
  await page.route('**/economy-avatars/*.webp*', (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#6b8f71"/></svg>',
  }));
}

test('status identity uses the player avatar and opens settings', async ({ page }) => {
  await page.route('**/economy-avatars/*.webp*', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('?preview=game');

  const identity = page.getByRole('button', { name: /玩家 .+，打开设置/ });
  await expect(identity).toBeVisible();
  await expect(identity.locator('.player-avatar')).toBeVisible();
  await identity.click();

  await expect(page.getByRole('heading', { level: 1, name: '设置' })).toBeVisible();
  await expect(page.getByLabel('玩家头像')).toHaveAttribute('type', 'file');
  await expect(page.getByText(/64×64 WebP/)).toHaveCount(0);
});

test('shared player avatars stay square across responsive status layouts', async ({ page }) => {
  await servePlayerAvatars(page);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('?preview=game');

  const avatar = page.locator('.asset-bar .player-avatar').first();
  for (const width of [1200, 800, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(avatar).toBeVisible();
    const box = await avatar.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThanOrEqual(0.5);
    await expect(avatar.locator('img')).toBeVisible();
  }
});

test('compact status values expose a full number tooltip while numeric inputs stay exact', async ({ page }) => {
  await page.route('**/economy-avatars/*.webp*', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('?preview=game');

  const credits = page.locator('.asset-bar-item').filter({ hasText: '可用资金' }).locator('.safe-tooltip-anchor').first();
  await expect(credits).toBeVisible();
  await credits.hover();
  await expect(page.locator('.safe-tooltip')).toBeVisible();

  const sidebar = page.locator('.desktop-sidebar');
  await sidebar.getByRole('button', { name: /^银行/ }).click();
  await page.mouse.move(900, 450);
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByRole('button', { name: '存入', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '最大', exact: true }).click();
  const amount = page.getByRole('textbox', { name: '存入金额' });
  await expect(amount).toHaveValue(/^-?\d+(?:\.\d+)?$/);
  await expect(amount).not.toHaveValue(/[KMBT]/);
});

test('leaderboard player column uses real player avatars and compact scores have tooltips', async ({ page }) => {
  await servePlayerAvatars(page);
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^排行/ }).click();

  await expect(page.locator('.leaderboard-column-labels').first().locator('span'))
    .toHaveText(['排名', '玩家', '成绩', '奖励']);
  const playerAvatar = page.locator('.leaderboard-board-card:visible .leaderboard-player .player-avatar').first();
  await expect(playerAvatar).toBeVisible();
  await expect(playerAvatar.locator('img')).toHaveAttribute('src', /\/economy-avatars\/\d+\.webp/);
  const score = page.locator('.leaderboard-board-card:visible .leaderboard-score .safe-tooltip-anchor').first();
  await expect(score).toBeVisible();
  await score.hover();
  await expect(page.locator('.safe-tooltip')).toBeVisible();
});
