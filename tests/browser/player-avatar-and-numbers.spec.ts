import { expect, test } from '@playwright/test';

test('status identity uses the player avatar and opens settings', async ({ page }) => {
  await page.route('**/economy-avatars/*.webp*', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('?preview=game');

  const identity = page.getByRole('button', { name: /玩家 .+，打开设置/ });
  await expect(identity).toBeVisible();
  await expect(identity.locator('.player-avatar')).toBeVisible();
  await identity.click();

  await expect(page.getByRole('heading', { level: 1, name: '设置' })).toBeVisible();
  await expect(page.getByLabel('玩家头像')).toHaveAttribute('type', 'file');
  await expect(page.getByText(/64×64 WebP/)).toBeVisible();
});

test('compact status values expose a full number tooltip while numeric inputs stay exact', async ({ page }) => {
  await page.route('**/economy-avatars/*.webp*', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('?preview=game');

  const credits = page.locator('.asset-bar-item').filter({ hasText: '可用资金' }).locator('.safe-tooltip-anchor').first();
  await expect(credits).toBeVisible();
  await credits.hover();
  await expect(page.locator('.safe-tooltip')).toBeVisible();

  await page.locator('.desktop-sidebar').getByRole('button', { name: /^银行/ }).click();
  await page.getByRole('button', { name: '全部存入' }).click();
  const amount = page.getByRole('textbox', { name: '存入金额' });
  await expect(amount).toHaveValue(/^-?\d+(?:\.\d+)?$/);
  await expect(amount).not.toHaveValue(/[KMBT]/);
});

test('leaderboard player column uses the final label and compact scores have tooltips', async ({ page }) => {
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^排行/ }).click();

  await expect(page.locator('.leaderboard-column-labels').first().locator('span'))
    .toHaveText(['排名', '玩家', '成绩', '奖励']);
  const score = page.locator('.leaderboard-board-card:visible .leaderboard-score .safe-tooltip-anchor').first();
  await expect(score).toBeVisible();
  await score.hover();
  await expect(page.locator('.safe-tooltip')).toBeVisible();
});
