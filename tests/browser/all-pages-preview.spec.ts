import { expect, test } from '@playwright/test';

test('local preview catalog exposes all eleven formal pages without account services', async ({ page }) => {
  await page.goto('all-pages-preview.html');

  await expect(page.getByRole('heading', { name: 'Economy 全页面预览' })).toBeVisible();
  const previewLinks = page.locator('[data-preview-page]');
  await expect(previewLinks).toHaveCount(11);
  expect(await previewLinks.evaluateAll((links) => links.map((link) => link.getAttribute('target'))))
    .toEqual(Array.from({ length: 11 }, () => '_blank'));

  const pageIds = await previewLinks.evaluateAll((links) => links.map((link) => link.getAttribute('data-preview-page')));
  expect(pageIds).toEqual([
    'overview',
    'map',
    'market',
    'production',
    'research',
    'auction',
    'contracts',
    'bank',
    'leaderboard',
    'gem-shop',
    'settings',
  ]);
});

test('leaderboard has a populated account-free preview', async ({ page }) => {
  await page.goto('runtime-test.html?view=leaderboard&scenario=activity');

  await expect(page.getByRole('heading', { name: '排行榜', exact: true })).toBeVisible();
  await expect(page.locator('.leaderboard-board-card')).toHaveCount(4);
  for (const title of ['财富榜', '增长榜', '生产榜', '交易榜']) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByText('MEVIUS', { exact: true }).first()).toBeVisible();
});
